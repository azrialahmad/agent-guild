import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { OpenCode } from '@opencode/client';
import { Service } from '@opencode/client/service';
import { ActivityBridge } from '../src/main/activity-bridge';
import type { Activity } from '../src/shared/types';

const endpoint = await Service.discover();
if (!endpoint) throw new Error('Start OpenCode V2 before verifying the plugin.');
const explicit = process.env.AGENT_GUILD_OPENCODE_URL;
const client = OpenCode.make({
  baseUrl: explicit ?? endpoint.url,
  headers: explicit
    ? {
        authorization: `Basic ${Buffer.from(`opencode:${process.env.OPENCODE_SERVER_PASSWORD ?? ''}`).toString('base64')}`,
      }
    : Service.headers(endpoint),
});
const directory = await mkdtemp(join(tmpdir(), 'guild-plugin-'));
const bridge = new ActivityBridge(join(directory, 'activity.sock'));
await bridge.start();
let sessionId: string | undefined;
try {
  await writeFile(
    join(directory, 'opencode.json'),
    JSON.stringify({
      $schema: 'https://opencode.ai/config.json',
      plugins: [{ package: resolve('integrations/opencode'), options: { socket: bridge.path } }],
    }),
  );
  const session = await client.session.create({
    title: 'Agent Guild disposable plugin check',
    location: { directory },
  });
  sessionId = session.id;
  await client.session.shell({
    sessionID: session.id,
    command: "printf 'agent-guild-plugin-check\\n'",
  });
  let observed: Activity | undefined;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const option = bridge.sessions()[0];
    if (option) {
      bridge.follow(option.id, (activity) => {
        observed = activity;
      });
      if (observed?.events.some((event) => event.source === 'opencode.tool-end')) break;
    }
    await delay(100);
  }
  assert(observed, 'The real plugin must forward activity to the socket.');
  assert(
    observed.events.some((event) => event.kind === 'command'),
    'A native shell start must be observed.',
  );
  assert.equal(observed.kind, 'idle');
  console.log(
    JSON.stringify({
      runtime: (await client.server.info()).version,
      source: observed.source?.transport,
      observedEventTypes: observed.events.map((event) => event.source),
      returnedToIdle: true,
    }),
  );
} finally {
  if (sessionId) await client.session.remove({ sessionID: sessionId });
  bridge.stop();
  await rm(directory, { recursive: true, force: true });
}
