import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OpenCode } from '@opencode/client';
import { Service } from '@opencode/client/service';
import { OpenCodeConnector } from '../src/main/connector';
import type { Activity } from '../src/shared/types';

// A disposable session exercises the actual connector without sending a model prompt.
const endpoint = await Service.discover();
if (!endpoint) throw new Error('Start OpenCode V2 before running this integration check.');
const client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) });
const directory = mkdtempSync(join(tmpdir(), 'agent-guild-connector-'));
const connector = new OpenCodeConnector();
let sessionId: string | undefined;
let latest: Activity | undefined;
const seenKinds = new Set<string>();
const waiters = new Set<() => void>();

async function waitFor(predicate: () => boolean): Promise<void> {
  if (predicate()) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(check);
      reject(new Error('Timed out waiting for real connector state'));
    }, 20000);
    const check = () => {
      if (predicate()) {
        clearTimeout(timer);
        waiters.delete(check);
        resolve();
      }
    };
    waiters.add(check);
  });
}

try {
  const session = await client.session.create({
    title: 'Agent Guild disposable connector check',
    location: { directory },
  });
  sessionId = session.id;
  connector.connect(session.id, (activity) => {
    latest = activity;
    seenKinds.add(activity.kind);
    waiters.forEach((check) => check());
  });
  await waitFor(() => latest?.connection === 'connected');
  await client.session.shell({
    sessionID: session.id,
    command: "printf 'agent-guild-connector-check\\n'",
  });
  await waitFor(() =>
    Boolean(latest?.events.some((event) => event.source === 'session.shell.ended')),
  );
  assert(seenKinds.has('command'), 'The real shell start must animate a command');
  assert.equal(latest!.kind, 'idle');
  assert(latest!.usage, 'The selected session exposes usage accounting');
  console.log(
    JSON.stringify({
      runtime: latest!.version,
      observedEventTypes: latest!.events.map((event) => event.source),
      observedKinds: [...seenKinds],
      returnedToIdle: true,
    }),
  );
} finally {
  connector.stop();
  if (sessionId) await client.session.remove({ sessionID: sessionId });
  rmSync(directory, { recursive: true, force: true });
}
