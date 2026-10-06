import { describe, expect, it } from 'vitest';
import type { SessionInfo, V2Event } from '@opencode/client';
import { OpenCodeProjection } from '../../src/shared/opencode';

const session: SessionInfo = {
  id: 'ses_fixture',
  projectID: 'project-fixture',
  title: 'Build a greeting',
  cost: 0,
  tokens: { input: 200, output: 100, reasoning: 10, cache: { read: 0, write: 0 } },
  time: { created: 1700000000000, updated: 1700000001000 },
  location: { directory: '/synthetic/project' },
};
let seq = 0;
function event(type: string, data: Record<string, unknown>, sessionID = session.id): V2Event {
  const id = `event-${++seq}`;
  return {
    id,
    created: 1700000000000 + seq,
    type,
    durable: { aggregateID: sessionID, seq, version: 1 },
    data: { sessionID, ...data },
  } as V2Event;
}

describe('OpenCode V2 event projection', () => {
  it('recovers a running shell from a real V2 message shape even without a foreground model turn', () => {
    const projection = new OpenCodeProjection(session.id);
    projection.reconcile(
      session,
      [
        {
          type: 'shell',
          id: 'message-shell',
          shellID: 'shell-1',
          command: 'echo fixture',
          status: 'running',
          time: { created: 1700000000000 },
        },
      ],
      false,
      [],
    );
    expect(projection.activity).toMatchObject({ kind: 'command', activeTools: 1 });
    projection.accept(
      event('session.shell.ended', {
        shell: { id: 'shell-1' },
        output: { output: 'fixture', cursor: 0, size: 7, truncated: false },
      }),
    );
    expect(projection.activity.kind).toBe('idle');
  });
  it('tracks concurrent tools, survives a tool failure, and does not confuse turn end with task success', () => {
    const projection = new OpenCodeProjection(session.id);
    projection.reconcile(session, [], true, []);
    projection.accept(
      event('session.tool.input.started', {
        id: 'read-call',
        name: 'functions.read',
        assistantMessageID: 'msg-1',
      }),
    );
    projection.accept(
      event('session.tool.input.started', {
        id: 'patch-call',
        name: 'functions.patch',
        assistantMessageID: 'msg-1',
      }),
    );
    expect(projection.activity).toMatchObject({ kind: 'editing', activeTools: 2 });
    projection.accept(
      event('session.tool.failed', {
        id: 'patch-call',
        assistantMessageID: 'msg-1',
        error: { type: 'tool', message: 'Patch mismatch' },
        executed: true,
      }),
    );
    expect(projection.activity).toMatchObject({ kind: 'reading', activeTools: 1 });
    projection.accept(
      event('session.tool.success', {
        id: 'read-call',
        assistantMessageID: 'msg-1',
        content: [{ type: 'text', text: 'Synthetic contents' }],
        executed: true,
      }),
    );
    expect(projection.activity.kind).toBe('working');
    projection.accept(event('session.execution.succeeded', {}));
    expect(projection.activity.kind).toBe('idle');
    expect(projection.activity.label).not.toMatch(/task succeeded|code correct/i);
  });

  it('gives pending attention priority, handles multiple requests, and filters other sessions and duplicate events', () => {
    const projection = new OpenCodeProjection(session.id);
    projection.reconcile(session, [], true, []);
    const request = event('permission.asked', {
      id: 'permission-1',
      action: 'shell',
      resources: [],
    });
    expect(projection.accept(request)).toBe(true);
    expect(projection.accept(request)).toBe(false);
    projection.accept(
      event('form.created', {
        form: { id: 'form-1', sessionID: session.id, title: 'Question', fields: [] },
      }),
    );
    projection.accept(event('permission.replied', { requestID: 'permission-1', reply: 'once' }));
    expect(projection.activity.kind).toBe('attention');
    projection.accept(event('form.cancelled', { id: 'form-1' }));
    expect(projection.activity.kind).toBe('working');
    const count = projection.activity.events.length;
    projection.accept(event('session.execution.succeeded', {}, 'ses_other'));
    expect(projection.activity.kind).toBe('working');
    expect(projection.activity.events).toHaveLength(count);
  });

  it('shows unknown on disconnect and reconciles current state without fabricating history', () => {
    const projection = new OpenCodeProjection(session.id);
    projection.reconcile(session, [], true, []);
    projection.disconnected('Runtime restarted');
    expect(projection.activity).toMatchObject({
      kind: 'unknown',
      connection: 'disconnected',
      activeTools: 0,
    });
    projection.reconcile(session, [], false, ['permission-waiting']);
    expect(projection.activity).toMatchObject({
      kind: 'attention',
      connection: 'connected',
      usage: session.tokens,
    });
    expect(projection.activity.events).toHaveLength(0);
  });
});
