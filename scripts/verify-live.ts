import { OpenCode } from '@opencode/client';
import { Service } from '@opencode/client/service';
import { OpenCodeProjection } from '../src/shared/opencode';

const endpoint = await Service.discover();
if (!endpoint) throw new Error('No running OpenCode V2 service');
const client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) });
const version = (await client.server.info()).version;
const sessions = await client.session.list({ limit: 10, parentID: 'null' });
const active = await client.session.active();
const session = process.env.AGENT_GUILD_SESSION
  ? await client.session.get({ sessionID: process.env.AGENT_GUILD_SESSION })
  : (sessions.data.find((entry) => active[entry.id]) ?? sessions.data[0]);
if (!session) throw new Error('No session to observe');
const messages = await client.message.list({ sessionID: session.id, limit: 30, order: 'desc' });
const permissions = await client.permission.list({ sessionID: session.id });
const forms = await client.session.form.list({ sessionID: session.id });
const projection = new OpenCodeProjection(session.id);
projection.reconcile(session, [...messages.data].reverse(), Boolean(active[session.id]), [
  ...permissions.map((item) => item.id),
  ...forms.map((item) => item.id),
]);
console.log(
  JSON.stringify({
    version,
    sessionsFound: sessions.data.length,
    projectedKind: projection.activity.kind,
    toolParts: messages.data
      .filter((m) => m.type === 'assistant')
      .flatMap((m) => (m.type === 'assistant' ? m.content.filter((p) => p.type === 'tool') : []))
      .length,
    usageAvailable: Boolean(projection.activity.usage),
  }),
);
const signal = AbortSignal.timeout(10000);
const types = new Set<string>();
try {
  for await (const event of client.event.subscribe({ signal })) {
    if (event.type === 'server.connected') types.add(event.type);
    if (projection.accept(event)) types.add(event.type);
  }
} catch (error) {
  if (!signal.aborted) throw error;
}
console.log(JSON.stringify({ observedEventTypes: [...types] }));
// Only event type names and counts are printed. Raw sessions and credentials stay in memory.
