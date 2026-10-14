import { Plugin } from '@opencode/plugin';
import { createHash, randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { send } from '../bridge/send.mjs';
import type { BridgePacket } from '../../src/shared/bridge-activity';

export default Plugin.define({
  id: 'agent-guild',
  async setup(ctx) {
    const producer = `${process.pid}-${createHash('sha256').update(ctx.location.directory).digest('hex').slice(0, 8)}`;
    // Stable across PID changes, distinct for bundled private-server and shared-service binaries.
    const sourceId = createHash('sha256')
      .update(`${process.execPath}:${ctx.location.directory}`)
      .digest('hex')
      .slice(0, 24);
    const path = typeof ctx.options.socket === 'string' ? ctx.options.socket : undefined;
    const controller = new AbortController();
    const sessions = new Map<
      string,
      { title: string; running?: boolean; tools: Map<string, string>; pending: Set<string> }
    >();
    const foreign = new Set<string>();
    let delivery = Promise.resolve();
    let queued = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    function toolSnapshot(state: { tools: Map<string, string> }) {
      return [...state.tools].slice(-16).map(([id, name]) => ({ id, name }));
    }
    function clearForegroundTools(state: { tools: Map<string, string> }) {
      for (const id of state.tools.keys()) if (!id.startsWith('shell:')) state.tools.delete(id);
    }

    function emit(
      sessionId: string,
      type: BridgePacket['type'],
      fields: Partial<BridgePacket> = {},
    ) {
      const state = sessions.get(sessionId);
      if (!state || queued >= 128 || controller.signal.aborted) return;
      const packet: BridgePacket = {
        schema: 1,
        id: randomUUID(),
        producer,
        sourceId,
        harness: 'opencode',
        sessionId,
        type,
        time: Date.now(),
        title: state.title,
        project:
          basename(ctx.location.directory)
            .replace(/[\u0000-\u001f]/g, ' ')
            .slice(0, 80) || 'Local project',
        ...fields,
      };
      queued++;
      delivery = delivery
        .then(async () => {
          await send(packet, path);
        })
        .catch(() => {})
        .finally(() => {
          queued--;
        });
    }

    async function ensure(sessionId: string) {
      if (foreign.has(sessionId)) return undefined;
      const existing = sessions.get(sessionId);
      if (existing) return existing;
      try {
        const info = await ctx.session.get({ sessionID: sessionId });
        if (info.location.directory !== ctx.location.directory) {
          foreign.add(sessionId);
          if (foreign.size > 128) foreign.delete(foreign.values().next().value!);
          return undefined;
        }
        if (sessions.has(sessionId)) return sessions.get(sessionId);
        if (sessions.size >= 20) sessions.delete(sessions.keys().next().value!);
        const state = {
          title: (info.title || sessionId).replace(/[\u0000-\u001f]/g, ' ').slice(0, 128),
          running: undefined as boolean | undefined,
          tools: new Map<string, string>(),
          pending: new Set<string>(),
        };
        sessions.set(sessionId, state);
        emit(sessionId, 'session');
        return state;
      } catch {
        return undefined;
      }
    }

    // Observational context hooks also cover model calls made by a private server's UI.
    await ctx.session.hook('context', async (event) => {
      const state = await ensure(event.sessionID);
      if (!state) return;
      const wasRunning = state.running;
      state.running = true;
      if (wasRunning)
        emit(event.sessionID, 'snapshot', {
          running: true,
          tools: toolSnapshot(state),
          pending: [...state.pending],
        });
      else emit(event.sessionID, 'turn-start', { tools: toolSnapshot(state) });
    });

    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          if (
            ![
              'session.execution.started',
              'session.execution.succeeded',
              'session.execution.failed',
              'session.execution.interrupted',
              'session.tool.input.started',
              'session.tool.success',
              'session.tool.failed',
              'session.shell.started',
              'session.shell.ended',
              'permission.asked',
              'permission.replied',
              'form.created',
              'form.replied',
              'form.cancelled',
            ].includes(event.type)
          )
            continue;
          const data = event.data as Record<string, unknown>;
          const form = data.form as { sessionID?: string; id?: string } | undefined;
          const id = data.sessionID ?? form?.sessionID;
          if (typeof id !== 'string') continue;
          const state = await ensure(id);
          if (!state) continue;
          if (event.type === 'session.execution.started') {
            state.running = true;
            clearForegroundTools(state);
            state.pending.clear();
            emit(id, 'turn-start', { tools: toolSnapshot(state) });
          } else if (event.type.startsWith('session.execution.')) {
            state.running = false;
            clearForegroundTools(state);
            state.pending.clear();
            emit(id, 'turn-end', { tools: toolSnapshot(state) });
          } else if (event.type === 'session.tool.input.started') {
            const toolId = String(data.id);
            const name = String(data.name);
            state.running = true;
            state.tools.set(toolId, name);
            emit(id, 'tool-start', { toolId, toolName: name });
          } else if (
            event.type === 'session.tool.success' ||
            event.type === 'session.tool.failed'
          ) {
            const toolId = String(data.id);
            const name = state.tools.get(toolId) ?? 'tool';
            state.tools.delete(toolId);
            emit(id, 'tool-end', { toolId, toolName: name });
          } else if (
            event.type === 'session.shell.started' ||
            event.type === 'session.shell.ended'
          ) {
            const toolId = `shell:${(data.shell as { id: string }).id}`;
            if (state.running === undefined) state.running = false;
            if (event.type === 'session.shell.started') {
              state.tools.set(toolId, 'shell');
              emit(id, 'tool-start', { toolId, toolName: 'shell', running: state.running });
            } else {
              state.tools.delete(toolId);
              emit(id, 'tool-end', { toolId, toolName: 'shell' });
            }
          } else if (event.type === 'permission.asked' || event.type === 'form.created') {
            const toolId = String(form?.id ?? data.id);
            state.pending.add(toolId);
            emit(id, 'attention', { toolId });
          } else {
            const toolId = String(data.requestID ?? data.id);
            state.pending.delete(toolId);
            emit(id, 'attention-clear', { toolId });
          }
        }
      } catch {
        // A failed or closed subscription cannot keep claiming live execution.
      } finally {
        controller.abort();
        clearInterval(timer);
      }
    })();

    timer = setInterval(() => {
      for (const [id, state] of sessions) {
        if (state.running === undefined) emit(id, 'session');
        else
          emit(id, 'snapshot', {
            running: state.running,
            tools: toolSnapshot(state),
            pending: [...state.pending].slice(-32),
          });
      }
    }, 5000);
    timer.unref();
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  },
});
