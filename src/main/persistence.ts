import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { newProfile, parseProfile } from '../shared/game';
import type { Profile } from '../shared/types';

/** One versioned JSON document; atomic replacement keeps reward and adventure state together. */
export class ProfileStore {
  constructor(readonly path: string) {}

  load(): Profile {
    if (!existsSync(this.path)) return newProfile();
    return parseProfile(JSON.parse(readFileSync(this.path, 'utf8')));
  }

  save(profile: Profile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(`${this.path}.tmp`, JSON.stringify(profile, null, 2), { mode: 0o600 });
    renameSync(`${this.path}.tmp`, this.path);
  }
}
