import type { BridgePacket } from '../../src/shared/bridge-activity';
export function socketPath(): string;
export function send(packet: BridgePacket, path?: string): Promise<boolean>;
