import type { GuildBridge } from '../shared/types';

declare global {
  interface Window {
    guild?: GuildBridge;
  }
}
