import type { SessionInfo, SessionMessageInfo, V2Event } from '@opencode/client';
import { addEvent, initialActivity, toolKind } from './activity';
import type { Activity, WorkKind } from './types';

interface Tool {
  name: string;
  running: boolean;
}

/** Adapter state is session-scoped. Raw events never become game rewards. */
export class OpenCodeProjection {
  activity: Activity;
  private tools = new Map<string, Tool>();
  private shells = new Set<string>();
  private pending = new Set<string>();
  private seen = new Set<string>();
  private running = false;
  private uncertain = false;

  constructor(readonly sessionId: string) {
    this.activity = { ...initialActivity('live'), sessionId };
  }

  reconcile(
    info: SessionInfo,
    messages: SessionMessageInfo[],
    running: boolean,
    pending: string[],
  ): void {
    this.running = running;
    // Another server can read the same database without owning this execution.
    const newest = messages.at(-1);
    this.uncertain =
      !running &&
      info.time.idle !== undefined &&
      Boolean(newest && newest.time.created > info.time.idle);
    this.pending = new Set(pending);
    this.tools.clear();
    this.shells.clear();
    for (const message of messages) {
      if (message.type === 'shell' && message.status === 'running')
        this.shells.add(message.shellID);
      if (message.type !== 'assistant') continue;
      for (const part of message.content) {
        if (part.type !== 'tool') continue;
        this.tools.set(part.id, {
          name: part.name,
          running: part.state.status === 'running' || part.state.status === 'streaming',
        });
      }
    }
    this.activity = {
      ...this.activity,
      connection: 'connected',
      sessionTitle: info.title || 'Untitled session',
      usage: info.tokens,
      error: undefined,
      historyNote:
        'Recent events since connection. Reconnect restores current state; missed timeline events are not replayed.',
    };
    this.refresh();
  }

  accept(event: V2Event): boolean {
    const data = event.data as Record<string, unknown>;
    const form = data.form as { sessionID?: string; id?: string } | undefined;
    if ((data.sessionID ?? form?.sessionID) !== this.sessionId || this.seen.has(event.id))
      return false;
    this.seen.add(event.id);
    if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!);
    let record = true;
    switch (event.type) {
      case 'session.execution.started':
        this.running = true;
        this.tools.clear();
        break;
      case 'session.execution.succeeded':
      case 'session.execution.failed':
      case 'session.execution.interrupted':
        this.running = false;
        this.tools.clear();
        this.pending.clear();
        break;
      case 'session.tool.input.started':
        this.running = true;
        this.tools.set(event.data.id, { name: event.data.name, running: true });
        break;
      case 'session.tool.called': {
        const tool = this.tools.get(event.data.id);
        if (tool) tool.running = true;
        this.running = true;
        break;
      }
      case 'session.tool.success':
      case 'session.tool.failed': {
        const tool = this.tools.get(event.data.id);
        if (tool) tool.running = false;
        break;
      }
      case 'session.shell.started':
        this.shells.add(event.data.shell.id);
        break;
      case 'session.shell.ended':
        this.shells.delete(event.data.shell.id);
        break;
      case 'permission.asked':
        this.pending.add(event.data.id);
        break;
      case 'permission.replied':
        this.pending.delete(event.data.requestID);
        break;
      case 'form.created':
        this.pending.add(event.data.form.id);
        break;
      case 'form.replied':
      case 'form.cancelled':
        this.pending.delete(String(data.id));
        break;
      default:
        record = false;
    }
    if (!record) return false;
    this.uncertain = false;
    this.refresh();
    this.activity = addEvent(this.activity, {
      id: event.id,
      source: event.type,
      time: 'created' in event ? event.created : Date.now(),
      kind: this.activity.kind,
      label:
        event.type === 'session.tool.failed'
          ? 'A tool failed; the agent may continue'
          : this.activity.label,
      detail: JSON.stringify(data, null, 2).slice(0, 6000),
    });
    return true;
  }

  disconnected(message: string): void {
    this.activity = {
      ...this.activity,
      connection: 'disconnected',
      kind: 'unknown',
      label: 'Connection lost · retrying',
      activeTools: 0,
      error: message,
    };
  }

  private refresh(): void {
    const active = [...this.tools.values()].filter((tool) => tool.running);
    let kind: WorkKind = this.running ? 'working' : 'idle';
    let label = this.running ? 'Agent is working' : 'No active turn on this server';
    if (active.length && this.running) {
      kind = toolKind(active.at(-1)!.name);
      label = active.at(-1)!.name;
    }
    if (this.shells.size) {
      kind = 'command';
      label = 'Running a session shell command';
    }
    if (this.pending.size) {
      kind = 'attention';
      label = 'Your attention is needed';
    }
    if (this.uncertain) {
      kind = 'unknown';
      label = 'Saved activity · execution source unconfirmed';
    }
    this.activity = {
      ...this.activity,
      kind,
      label,
      activeTools: active.length + this.shells.size,
    };
  }
}
