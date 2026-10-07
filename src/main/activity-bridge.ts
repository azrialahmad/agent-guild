import { createConnection, createServer, type Server, type Socket } from 'node:net';
import { chmodSync, existsSync, lstatSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { BridgeProjection, parseBridgePacket } from '../shared/bridge-activity';
import type { Activity, ConnectionSelection, SessionOption } from '../shared/types';

export class ActivityBridge {
  private server?: Server;
  private ownsPath = false;
  private timer?: ReturnType<typeof setInterval>;
  private sockets = new Set<Socket>();
  private records = new Map<string, BridgeProjection>();
  private selected?: string;
  private publish?: (activity: Activity) => void;

  constructor(
    readonly path: string,
    private readonly detected?: (
      key: string,
      selection: Extract<ConnectionSelection, { transport: 'bridge' }>,
    ) => void,
  ) {}

  async start(): Promise<void> {
    mkdirSync(dirname(this.path), { recursive: true });
    if (existsSync(this.path)) {
      if (!lstatSync(this.path).isSocket())
        throw new Error('Activity bridge path is not a socket.');
      const active = await new Promise<boolean>((resolve, reject) => {
        const probe = createConnection(this.path);
        probe.setTimeout(150, () => {
          probe.destroy();
          reject(new Error('Existing activity socket did not respond.'));
        });
        probe.once('connect', () => {
          probe.destroy();
          resolve(true);
        });
        probe.once('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'ECONNREFUSED' || error.code === 'ENOENT') resolve(false);
          else reject(error);
        });
      });
      if (active) throw new Error('Another companion already owns this activity socket.');
      unlinkSync(this.path);
    }
    const server = createServer((socket) => {
      if (this.sockets.size >= 32) {
        socket.destroy();
        return;
      }
      this.sockets.add(socket);
      socket.setTimeout(1000, () => socket.destroy());
      socket.on('error', () => {});
      socket.on('close', () => this.sockets.delete(socket));
      let buffer = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => {
        buffer += chunk;
        if (Buffer.byteLength(buffer) > 8192) {
          socket.destroy();
          return;
        }
        const end = buffer.indexOf('\n');
        if (end < 0) return;
        try {
          const packet = parseBridgePacket(JSON.parse(buffer.slice(0, end)));
          if (packet) {
            const key = `bridge:${createHash('sha256')
              .update(
                `${packet.harness}:${packet.sourceId ?? packet.producer}:${packet.producer}:${packet.sessionId}`,
              )
              .digest('hex')
              .slice(0, 24)}`;
            let record = this.records.get(key);
            if (!record) {
              if (this.records.size >= 50) {
                const oldest = [...this.records.values()]
                  .filter((entry) => entry.key !== this.selected)
                  .sort((a, b) => a.lastSignal - b.lastSignal)[0];
                if (oldest) this.records.delete(oldest.key);
              }
              record = new BridgeProjection(
                key,
                packet.harness,
                packet.producer,
                packet.sessionId,
                packet.sourceId ?? packet.producer,
              );
              this.records.set(key, record);
            }
            if (record.accept(packet)) {
              this.detected?.(key, record.selection());
              if (key === this.selected) this.publish?.(record.activity);
            }
          }
        } catch {
          /* Malformed local input never changes activity. */
        }
        socket.end();
      });
    });
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.path, () => {
        this.ownsPath = true;
        server.removeListener('error', reject);
        resolve();
      });
    });
    chmodSync(this.path, 0o600);
    this.timer = setInterval(() => {
      for (const record of this.records.values())
        if (record.expire() && record.key === this.selected) this.publish?.(record.activity);
    }, 5000);
    this.timer.unref();
  }

  sessions(): SessionOption[] {
    return [...this.records.values()]
      .sort((a, b) => b.lastSignal - a.lastSignal)
      .map((record) => {
        if (record.expire() && record.key === this.selected) this.publish?.(record.activity);
        return record.option();
      });
  }

  follow(key: string, publish: (activity: Activity) => void): void {
    const record = this.records.get(key);
    if (!record) throw new Error('That harness has not sent a session signal yet.');
    this.selected = key;
    this.publish = publish;
    record.expire();
    publish(record.activity);
  }

  selection(key: string): Extract<ConnectionSelection, { transport: 'bridge' }> {
    const record = this.records.get(key);
    if (!record) throw new Error('That harness has not sent a session signal yet.');
    return record.selection();
  }

  matches(selection: Extract<ConnectionSelection, { transport: 'bridge' }>): string[] {
    return [...this.records.values()]
      .filter((record) => {
        if (record.expire() && record.key === this.selected) this.publish?.(record.activity);
        return (
          record.harness === selection.harness &&
          record.sessionId === selection.sessionId &&
          record.sourceId === selection.sourceId &&
          record.activity.connection === 'connected'
        );
      })
      .map((record) => record.key);
  }

  isConnected(key: string): boolean {
    const record = this.records.get(key);
    if (record?.expire() && record.key === this.selected) this.publish?.(record.activity);
    return record?.activity.connection === 'connected';
  }

  stopFollowing(): void {
    this.selected = undefined;
    this.publish = undefined;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    for (const socket of this.sockets) socket.destroy();
    if (this.server?.listening) this.server.close();
    if (this.ownsPath && existsSync(this.path) && lstatSync(this.path).isSocket())
      unlinkSync(this.path);
    this.ownsPath = false;
    this.stopFollowing();
  }
}
