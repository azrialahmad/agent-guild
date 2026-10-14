import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ConnectionSelection } from '../shared/types';

function text(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    !/[\u0000-\u001f]/.test(value)
  );
}

export function parseSelection(value: unknown): ConnectionSelection | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid saved connection.');
  const selection = value as Record<string, unknown>;
  if (!text(selection.sessionId) || !text(selection.title))
    throw new Error('Invalid saved session.');
  const allowed =
    selection.transport === 'bridge'
      ? ['transport', 'harness', 'sessionId', 'sourceId', 'title']
      : ['transport', 'harness', 'sessionId', 'title'];
  if (Object.keys(selection).some((key) => !allowed.includes(key)))
    throw new Error('Unexpected saved connection fields.');
  if (
    selection.transport === 'service' &&
    selection.harness === 'opencode' &&
    /^ses[\w-]+$/.test(selection.sessionId)
  )
    return selection as ConnectionSelection;
  if (
    selection.transport === 'bridge' &&
    ['opencode', 'codex', 'claude-code'].includes(String(selection.harness)) &&
    text(selection.sourceId)
  )
    return selection as ConnectionSelection;
  throw new Error('Unsupported saved connection.');
}

/** Runtime selection is separate from game saves; no credentials or event history are persisted. */
export class ConnectionStore {
  constructor(readonly path: string) {}

  load(): ConnectionSelection | null {
    if (!existsSync(this.path)) return null;
    const value: unknown = JSON.parse(readFileSync(this.path, 'utf8'));
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      (value as { schema?: unknown }).schema !== 1 ||
      Object.keys(value).some((key) => !['schema', 'selection'].includes(key))
    )
      throw new Error('Unsupported connection preferences.');
    return parseSelection((value as { selection: unknown }).selection);
  }

  save(selection: ConnectionSelection | null): void {
    const validated = parseSelection(selection);
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(
      `${this.path}.tmp`,
      JSON.stringify({ schema: 1, selection: validated }, null, 2),
      { mode: 0o600 },
    );
    renameSync(`${this.path}.tmp`, this.path);
  }
}
