import { randomUUID, createHash } from 'node:crypto';
import { basename } from 'node:path';

/** Only allowlisted lifecycle metadata leaves the harness process. */
export function normalize(harness, input) {
  if (
    !['codex', 'claude-code'].includes(harness) ||
    !input ||
    typeof input.session_id !== 'string' ||
    !input.session_id
  )
    return;
  const event = input.hook_event_name;
  const type = {
    SessionStart: 'session',
    UserPromptSubmit: 'turn-start',
    PreToolUse: 'tool-start',
    PostToolUse: 'tool-end',
    PostToolUseFailure: 'tool-end',
    PermissionRequest: 'attention',
    Stop: 'turn-end',
    StopFailure: 'turn-end',
    Interrupt: 'turn-end',
    SessionEnd: 'session-end',
  }[event];
  if (!type) return;
  const project =
    (typeof input.cwd === 'string' ? basename(input.cwd) : 'Local project')
      .replace(/[\u0000-\u001f]/g, ' ')
      .slice(0, 80) || 'Local project';
  const sessionId =
    input.agent_id &&
    ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest'].includes(event)
      ? `${input.session_id}:${input.agent_id}`
      : input.session_id;
  const packet = {
    schema: 1,
    id: randomUUID(),
    producer: createHash('sha256')
      .update(`${harness}:${input.session_id}:${input.cwd ?? ''}`)
      .digest('hex')
      .slice(0, 12),
    harness,
    sessionId,
    type,
    time: Date.now(),
    title: `${harness} · ${project}`,
    project,
  };
  packet.sourceId = packet.producer;
  if (['tool-start', 'tool-end', 'attention'].includes(type)) {
    const name = typeof input.tool_name === 'string' ? input.tool_name.slice(0, 128) : 'tool';
    packet.toolName = name;
    packet.toolId =
      typeof input.tool_use_id === 'string' ? input.tool_use_id : `permission:${name}`;
  }
  return packet;
}
