import type { BridgePacket } from '../../src/shared/bridge-activity';
export function normalize(
  harness: string,
  input: Record<string, unknown>,
): BridgePacket | undefined;
