import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newProfile } from '../../src/shared/game';
import { ProfileStore } from '../../src/main/persistence';
import { clampPlacement } from '../../src/main/placement';

describe('local persistence and desktop placement', () => {
  it('persists a profile atomically and preserves a corrupt file for recovery', () => {
    const directory = mkdtempSync(join(tmpdir(), 'guild-store-'));
    try {
      const path = join(directory, 'profile.json');
      const store = new ProfileStore(path);
      const profile = { ...newProfile(), name: 'Mochi', xp: 40, completed: ['one'] };
      store.save(profile);
      expect(new ProfileStore(path).load()).toEqual(profile);
      writeFileSync(path, 'corrupt-save');
      expect(() => store.load()).toThrow();
      expect(readFileSync(path, 'utf8')).toBe('corrupt-save');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps an overlay reachable after monitor disconnect and supports negative-coordinate displays', () => {
    const primary = { x: 0, y: 24, width: 1440, height: 820 };
    const secondary = { x: -1920, y: 0, width: 1920, height: 1080 };
    expect(clampPlacement({ x: -500, y: 800 }, [primary, secondary], 260, 190).x).toBe(-500);
    const restored = clampPlacement({ x: -1800, y: 900 }, [primary], 260, 190);
    expect(restored.x).toBe(0);
    expect(restored.y).toBe(654);
    expect(clampPlacement(undefined, [primary], 260, 190)).toMatchObject({ x: 1152, y: 642 });
  });
});
