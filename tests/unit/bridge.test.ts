import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { ActivityBridge } from '../../src/main/activity-bridge';
import {
  BridgeProjection,
  parseBridgePacket,
  type BridgePacket,
} from '../../src/shared/bridge-activity';
import { send } from '../../integrations/bridge/send.mjs';
import { normalize } from '../../integrations/hooks/normalize.mjs';
import type { Activity } from '../../src/shared/types';

function packet(type: BridgePacket['type'], fields: Partial<BridgePacket> = {}): BridgePacket {
  return {
    schema: 1,
    id: crypto.randomUUID(),
    producer: 'private-server',
    harness: 'opencode',
    sessionId: 'ses_fixture',
    time: Date.now(),
    type,
    ...fields,
  };
}

async function runHook(harness: string, input: Record<string, unknown>, socket: string) {
  const child = spawn(process.execPath, ['integrations/hooks/forward.mjs', harness], {
    env: { ...process.env, AGENT_GUILD_SOCKET: socket },
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    output += String(chunk);
  });
  child.stdin.end(JSON.stringify(input));
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once('close', resolve);
    child.once('error', reject);
  });
  return { code, output };
}

describe('harness activity bridge', () => {
  it('does not replace or remove another live listener when startup fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'guild-owner-'));
    const first = new ActivityBridge(join(directory, 'activity.sock'));
    const second = new ActivityBridge(first.path);
    await first.start();
    try {
      await expect(second.start()).rejects.toThrow('Another companion already owns');
      second.stop();
      expect(await send(packet('turn-start'), first.path)).toBe(true);
      expect(first.sessions()).toHaveLength(1);
    } finally {
      first.stop();
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('delivers actual Codex and Claude stdin metadata through the local socket without forwarding private content', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'guild-bridge-'));
    const bridge = new ActivityBridge(join(directory, 'activity.sock'));
    await bridge.start();
    try {
      for (const harness of ['codex', 'claude-code']) {
        const input = {
          session_id: `${harness}-session`,
          cwd: '/synthetic/project',
          hook_event_name: 'UserPromptSubmit',
          prompt: 'PRIVATE-PROMPT',
          transcript_path: '/PRIVATE-TRANSCRIPT',
        };
        const first = normalize(harness, input)!;
        expect(JSON.stringify(first)).not.toMatch(/PRIVATE/);
        expect(await runHook(harness, input, bridge.path)).toEqual({ code: 0, output: '' });
        const option = bridge.sessions().find((session) => session.source?.startsWith(harness))!;
        const observed: Activity[] = [];
        bridge.follow(option.id, (activity) => observed.push(activity));
        expect(observed.at(-1)?.kind).toBe('working');
        const tool = normalize(harness, {
          ...input,
          hook_event_name: 'PreToolUse',
          tool_use_id: 'call-1',
          tool_name: 'Bash',
          tool_input: { command: 'PRIVATE-COMMAND' },
        })!;
        expect(JSON.stringify(tool)).not.toMatch(/PRIVATE/);
        await send(tool, bridge.path);
        expect(observed.at(-1)).toMatchObject({ kind: 'command', activeTools: 1 });
        await send(
          normalize(harness, {
            ...input,
            hook_event_name: 'PostToolUse',
            tool_use_id: 'call-1',
            tool_name: 'Bash',
            tool_response: 'PRIVATE-OUTPUT',
          })!,
          bridge.path,
        );
        expect(observed.at(-1)?.kind).toBe('working');
        await send(normalize(harness, { ...input, hook_event_name: 'Stop' })!, bridge.path);
        expect(observed.at(-1)).toMatchObject({
          kind: 'idle',
          label: 'Turn ended · outcome unverified',
        });
      }
    } finally {
      bridge.stop();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('keeps concurrent tools and attention, ignores duplicates, and becomes unknown when the producer disappears', () => {
    const projection = new BridgeProjection('key', 'opencode', 'private-server', 'ses_fixture');
    const start = packet('turn-start');
    projection.accept(start, 1000);
    expect(projection.accept(start, 1001)).toBe(false);
    projection.accept(packet('tool-start', { toolId: 'a', toolName: 'read' }), 1002);
    projection.accept(packet('tool-start', { toolId: 'b', toolName: 'shell' }), 1003);
    projection.accept(packet('attention', { toolId: 'b' }), 1004);
    expect(projection.activity.kind).toBe('attention');
    projection.accept(packet('tool-end', { toolId: 'b', toolName: 'shell' }), 1005);
    expect(projection.activity).toMatchObject({ kind: 'reading', activeTools: 1 });
    expect(projection.expire(21006)).toBe(true);
    expect(projection.activity).toMatchObject({
      kind: 'unknown',
      connection: 'disconnected',
      activeTools: 0,
    });
    projection.accept(packet('snapshot', { running: false }), 21007);
    expect(projection.activity).toMatchObject({ kind: 'idle', connection: 'connected' });
    expect(projection.activity.events).toHaveLength(5);
  });

  it('rejects private payload additions, old timestamps and unknown versions rather than turning them into idle signals', () => {
    expect(parseBridgePacket({ ...packet('turn-start'), prompt: 'PRIVATE' })).toBeUndefined();
    expect(parseBridgePacket({ ...packet('turn-start'), schema: 2 })).toBeUndefined();
    expect(parseBridgePacket(packet('turn-start', { time: Date.now() - 300001 }))).toBeUndefined();
    expect(parseBridgePacket(packet('snapshot'))).toBeUndefined();
    expect(
      normalize('claude-code', { session_id: 'parent', hook_event_name: 'SubagentStop' }),
    ).toBeUndefined();
  });

  it('keeps the agent running silently when the companion is absent or hook input is unsupported', async () => {
    expect(
      await runHook(
        'codex',
        { session_id: 'fixture', hook_event_name: 'Stop' },
        '/nonexistent-agent-guild/activity.sock',
      ),
    ).toEqual({ code: 0, output: '' });
    expect(
      await runHook(
        'claude-code',
        { session_id: 'fixture', hook_event_name: 'Unknown' },
        '/nonexistent-agent-guild/activity.sock',
      ),
    ).toEqual({ code: 0, output: '' });
  });
});
