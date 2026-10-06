import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function socketPath() {
  return (
    process.env.AGENT_GUILD_SOCKET ??
    join(homedir(), 'Library', 'Application Support', 'Agent Guild', 'activity.sock')
  );
}

/** Bounded, observational delivery. No stdout, tool decisions, retries, or background daemon. */
export function send(packet, path = socketPath()) {
  return new Promise((resolve) => {
    const socket = createConnection(path);
    let delivered = false;
    const timer = setTimeout(() => socket.destroy(), 150);
    socket.on('connect', () => socket.end(`${JSON.stringify(packet)}\n`));
    socket.on('end', () => {
      delivered = true;
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      clearTimeout(timer);
      resolve(delivered);
    });
  });
}
