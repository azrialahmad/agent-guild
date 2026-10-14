import { addEvent, initialActivity, toolKind } from './activity';
import type { Activity, ConnectionSelection, SessionOption } from './types';

export const BRIDGE_TYPES = [
  'session',
  'turn-start',
  'turn-end',
  'tool-start',
  'tool-end',
  'attention',
  'attention-clear',
  'snapshot',
  'session-end',
] as const;
export interface BridgePacket {
  schema: 1;
  id: string;
  producer: string;
  sourceId?: string;
  harness: 'opencode' | 'codex' | 'claude-code';
  sessionId: string;
  type: (typeof BRIDGE_TYPES)[number];
  time: number;
  title?: string;
  project?: string;
  toolId?: string;
  toolName?: string;
  running?: boolean;
  tools?: { id: string; name: string }[];
  pending?: string[];
}

const fields = new Set([
  'schema',
  'id',
  'producer',
  'sourceId',
  'harness',
  'sessionId',
  'type',
  'time',
  'title',
  'project',
  'toolId',
  'toolName',
  'running',
  'tools',
  'pending',
]);
function short(value: unknown, max = 128): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    !/[\u0000-\u001f]/.test(value)
  );
}
export function parseBridgePacket(value: unknown, now = Date.now()): BridgePacket | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const packet = value as Record<string, unknown>;
  if (
    Object.keys(packet).some((key) => !fields.has(key)) ||
    packet.schema !== 1 ||
    !short(packet.id) ||
    !short(packet.producer) ||
    !short(packet.sessionId) ||
    !['opencode', 'codex', 'claude-code'].includes(String(packet.harness)) ||
    !BRIDGE_TYPES.includes(packet.type as BridgePacket['type']) ||
    typeof packet.time !== 'number' ||
    !Number.isFinite(packet.time) ||
    Math.abs(now - packet.time) > 300_000
  )
    return;
  for (const key of ['title', 'project', 'toolId', 'toolName', 'sourceId'])
    if (packet[key] !== undefined && !short(packet[key])) return;
  if (packet.running !== undefined && typeof packet.running !== 'boolean') return;
  if (packet.type === 'snapshot' && typeof packet.running !== 'boolean') return;
  if (
    (packet.type === 'tool-start' || packet.type === 'tool-end') &&
    (!short(packet.toolId) || !short(packet.toolName))
  )
    return;
  if (
    packet.tools !== undefined &&
    (!Array.isArray(packet.tools) ||
      packet.tools.length > 16 ||
      packet.tools.some(
        (tool) =>
          !tool ||
          typeof tool !== 'object' ||
          Object.keys(tool).some((key) => !['id', 'name'].includes(key)) ||
          !short(tool.id) ||
          !short(tool.name),
      ))
  )
    return;
  if (
    packet.pending !== undefined &&
    (!Array.isArray(packet.pending) ||
      packet.pending.length > 32 ||
      packet.pending.some((id) => !short(id)))
  )
    return;
  return packet as unknown as BridgePacket;
}

export class BridgeProjection {
  activity: Activity;
  project = 'Local project';
  lastSignal = 0;
  private running: boolean | undefined;
  private tools = new Map<string, string>();
  private pending = new Set<string>();
  private seen = new Set<string>();

  constructor(
    readonly key: string,
    readonly harness: BridgePacket['harness'],
    readonly producer: string,
    readonly sessionId: string,
    readonly sourceId = producer,
  ) {
    this.activity = {
      ...initialActivity('live'),
      sessionId,
      sessionTitle: sessionId,
      historyNote:
        'Sanitized lifecycle signals from the executing harness. No prompts, tool arguments, output, or transcript content are forwarded. Turn end does not establish task success.',
    };
  }

  accept(packet: BridgePacket, now = Date.now()): boolean {
    if (this.seen.has(packet.id)) return false;
    this.seen.add(packet.id);
    if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!);
    this.lastSignal = now;
    this.project = packet.project ?? this.project;
    const transport = packet.harness === 'opencode' ? 'plugin' : 'hook';
    this.activity = {
      ...this.activity,
      connection: 'connected',
      error: undefined,
      sessionTitle: packet.title ?? this.activity.sessionTitle,
      source: {
        harness: packet.harness,
        transport,
        label: `${packet.harness} ${transport} · ${packet.producer}`,
        lastSignal: now,
      },
    };
    switch (packet.type) {
      case 'turn-start':
        this.running = true;
        this.tools = new Map((packet.tools ?? []).map((tool) => [tool.id, tool.name]));
        this.pending.clear();
        break;
      case 'tool-start':
        this.running = packet.running ?? true;
        this.tools.set(packet.toolId!, packet.toolName!);
        break;
      case 'tool-end':
        this.tools.delete(packet.toolId!);
        this.pending.delete(packet.toolId!);
        this.pending.delete(`permission:${packet.toolName}`);
        this.pending.delete('notification');
        break;
      case 'attention':
        this.pending.add(packet.toolId ?? `permission:${packet.toolName ?? 'notification'}`);
        break;
      case 'attention-clear':
        this.pending.delete(packet.toolId ?? `permission:${packet.toolName ?? 'notification'}`);
        break;
      case 'turn-end':
      case 'session-end':
        this.running = false;
        this.tools = new Map((packet.tools ?? []).map((tool) => [tool.id, tool.name]));
        this.pending.clear();
        break;
      case 'snapshot':
        this.running = packet.running;
        this.tools = new Map((packet.tools ?? []).map((tool) => [tool.id, tool.name]));
        this.pending = new Set(packet.pending ?? []);
        break;
    }
    while (this.tools.size > 16) this.tools.delete(this.tools.keys().next().value!);
    while (this.pending.size > 32) this.pending.delete(this.pending.values().next().value!);
    let kind: Activity['kind'] =
      this.running === undefined ? 'unknown' : this.running ? 'working' : 'idle';
    let label =
      this.running === undefined
        ? 'Harness connected · waiting for activity'
        : this.running
          ? 'Agent is working'
          : 'No active turn reported by harness';
    if (this.tools.size) {
      const name = [...this.tools.values()].at(-1)!;
      kind = toolKind(name);
      label = name;
    }
    if (this.pending.size) {
      kind = 'attention';
      label = 'Your attention is needed';
    }
    if (packet.type === 'turn-end' && !this.tools.size) label = 'Turn ended · outcome unverified';
    if (packet.type === 'session-end') {
      kind = 'unknown';
      label = 'Harness session ended · state unknown';
      this.tools.clear();
      this.activity = { ...this.activity, connection: 'disconnected' };
    }
    this.activity = { ...this.activity, kind, label, activeTools: this.tools.size };
    if (packet.type !== 'snapshot' && packet.type !== 'session')
      this.activity = addEvent(this.activity, {
        id: packet.id,
        source: `${packet.harness}.${packet.type}`,
        time: packet.time,
        kind,
        label,
        detail: JSON.stringify(packet, null, 2),
      });
    return true;
  }

  expire(now = Date.now()): boolean {
    const ttl = this.harness === 'opencode' ? 20_000 : 300_000;
    if (now - this.lastSignal <= ttl || this.activity.connection === 'disconnected') return false;
    this.activity = {
      ...this.activity,
      connection: 'disconnected',
      kind: 'unknown',
      label: 'Activity signal stale · state unknown',
      activeTools: 0,
    };
    return true;
  }

  option(): SessionOption {
    return {
      id: this.key,
      title: this.activity.sessionTitle,
      project: this.project,
      active:
        this.activity.connection === 'connected' &&
        !['idle', 'unknown'].includes(this.activity.kind),
      source: this.activity.source?.label,
      selection: this.selection(),
    };
  }

  selection(): Extract<ConnectionSelection, { transport: 'bridge' }> {
    return {
      transport: 'bridge',
      harness: this.harness,
      sessionId: this.sessionId,
      sourceId: this.sourceId,
      title: this.activity.sessionTitle,
    };
  }
}
