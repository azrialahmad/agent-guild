import { OpenCode, type OpenCodeClient, type V2Event } from '@opencode/client';
import { Service } from '@opencode/client/service';
import { setTimeout as delay } from 'node:timers/promises';
import { basename } from 'node:path';
import { OpenCodeProjection } from '../shared/opencode';
import type { Activity, SessionOption } from '../shared/types';

async function discoverClient(): Promise<{ client: OpenCodeClient; version: string }> {
  const endpoint = await Service.discover();
  if (!endpoint)
    throw new Error('Start OpenCode V2, then refresh sessions. No local service was found.');
  const client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) });
  const info = await client.server.info({ signal: AbortSignal.timeout(8000) });
  if (!info.version.startsWith('2.')) throw new Error('This connector supports OpenCode V2 only.');
  return { client, version: info.version };
}

export async function listSessions(): Promise<SessionOption[]> {
  const { client } = await discoverClient();
  const options = { signal: AbortSignal.timeout(8000) };
  const [sessions, active] = await Promise.all([
    client.session.list({ limit: 50, parentID: 'null' }, options),
    client.session.active(options),
  ]);
  return sessions.data.map((session) => ({
    id: session.id,
    title: session.title || 'Untitled session',
    project: basename(session.location.directory),
    active: Boolean(active[session.id]),
  }));
}

export class OpenCodeConnector {
  private controller?: AbortController;

  stop(): void {
    this.controller?.abort();
    this.controller = undefined;
  }

  connect(sessionId: string, publish: (activity: Activity) => void): void {
    this.stop();
    const controller = new AbortController();
    this.controller = controller;
    const projection = new OpenCodeProjection(sessionId);
    publish(projection.activity);
    void this.run(projection, controller.signal, publish);
  }

  private async run(
    projection: OpenCodeProjection,
    signal: AbortSignal,
    publish: (activity: Activity) => void,
  ): Promise<void> {
    let failures = 0;
    while (!signal.aborted) {
      let streamController: AbortController | undefined;
      let refreshTimer: ReturnType<typeof setInterval> | undefined;
      try {
        const { client, version } = await discoverClient();
        if (signal.aborted) return;
        streamController = new AbortController();
        const streamSignal = AbortSignal.any([signal, streamController.signal]);
        const queued: V2Event[] = [];
        let ready = false;
        let resolveConnected!: () => void;
        let rejectConnected!: (error: unknown) => void;
        const connected = new Promise<void>((resolve, reject) => {
          resolveConnected = resolve;
          rejectConnected = reject;
        });
        const stream = (async () => {
          try {
            for await (const event of client.event.subscribe({ signal: streamSignal })) {
              if (event.type === 'server.connected') resolveConnected();
              else if (!ready) queued.push(event);
              else if (projection.accept(event)) publish(projection.activity);
            }
            if (!streamSignal.aborted) throw new Error('The OpenCode event stream closed.');
          } catch (error) {
            rejectConnected(error);
            throw error;
          }
        })();
        // Observe a failure immediately, even while snapshot requests are in flight.
        void stream.catch(() => {});
        await Promise.race([
          connected,
          delay(8000, undefined, { signal: streamSignal }).then(() => {
            throw new Error('Timed out connecting to the event stream');
          }),
        ]);
        const options = { signal: AbortSignal.any([streamSignal, AbortSignal.timeout(8000)]) };
        const [info, messages, active, permissions, forms] = await Promise.all([
          client.session.get({ sessionID: projection.sessionId }, options),
          client.message.list(
            { sessionID: projection.sessionId, limit: 30, order: 'desc' },
            options,
          ),
          client.session.active(options),
          client.permission.list({ sessionID: projection.sessionId }, options),
          client.session.form.list({ sessionID: projection.sessionId }, options),
        ]);
        if (signal.aborted) return;
        projection.reconcile(
          info,
          [...messages.data].reverse(),
          Boolean(active[projection.sessionId]),
          [...permissions.map((item) => item.id), ...forms.map((item) => item.id)],
        );
        projection.activity.version = version;
        for (const event of queued) projection.accept(event);
        ready = true;
        failures = 0;
        publish(projection.activity);
        let refreshing = false;
        refreshTimer = setInterval(() => {
          if (refreshing) return;
          refreshing = true;
          void client.session
            .get(
              { sessionID: projection.sessionId },
              { signal: AbortSignal.any([streamSignal, AbortSignal.timeout(8000)]) },
            )
            .then((session) => {
              if (streamSignal.aborted) return;
              projection.activity = {
                ...projection.activity,
                usage: session.tokens,
                sessionTitle: session.title || 'Untitled session',
              };
              publish(projection.activity);
            })
            .catch(() => {
              streamController?.abort();
            })
            .finally(() => {
              refreshing = false;
            });
        }, 10000);
        await stream;
        if (!signal.aborted) throw new Error('OpenCode connection interrupted.');
      } catch (error) {
        if (signal.aborted) return;
        projection.disconnected(error instanceof Error ? error.message : 'Connection unavailable');
        publish(projection.activity);
      } finally {
        streamController?.abort();
        if (refreshTimer) clearInterval(refreshTimer);
      }
      await delay(Math.min(15000, 1000 * 2 ** failures++), undefined, { signal }).catch(() => {});
    }
  }
}
