import { describe, expect, it } from 'vitest';
import { applyAction, newProfile, parseProfile } from '../../src/shared/game';

describe('resumable adventures and durable rewards', () => {
  it('resumes a partially followed trail and grants the reward only once', () => {
    let profile = applyAction(
      newProfile(),
      { type: 'start', route: 'meadow' },
      () => 'encounter-1',
    );
    profile = applyAction(profile, { type: 'remember' });
    profile = applyAction(profile, { type: 'rune', rune: 'leaf' });
    profile = parseProfile(JSON.parse(JSON.stringify(profile)));
    expect(profile.adventure?.progress).toBe(1);
    profile = applyAction(profile, { type: 'rune', rune: 'star' });
    profile = applyAction(profile, { type: 'rune', rune: 'moon' });
    const completed = structuredClone(profile);
    const day = new Date(2026, 9, 6, 23, 59);
    profile = applyAction(profile, { type: 'collect' }, undefined, day);
    expect(profile).toMatchObject({
      xp: 40,
      completed: ['encounter-1'],
      adventure: null,
      activityDays: { '2026-10-06': 1 },
    });
    // Re-delivery of the same completion after a restart cannot duplicate XP or activity.
    const replay = applyAction(
      { ...profile, adventure: completed.adventure },
      { type: 'collect' },
      undefined,
      day,
    );
    expect(replay.xp).toBe(40);
    expect(replay.activityDays).toEqual(profile.activityDays);
    expect(applyAction(replay, { type: 'collect' }).xp).toBe(40);
  });

  it('never grants rewards for an incomplete trail, and mistakes do not destroy the adventure', () => {
    let profile = applyAction(newProfile(), { type: 'start', route: 'river' }, () => 'encounter-2');
    expect(applyAction(profile, { type: 'collect' }).xp).toBe(0);
    profile = applyAction(profile, { type: 'remember' });
    profile = applyAction(profile, { type: 'rune', rune: 'moon' });
    profile = applyAction(profile, { type: 'rune', rune: 'star' });
    expect(profile.adventure).toMatchObject({
      id: 'encounter-2',
      phase: 'following',
      progress: 0,
      attempts: 1,
    });
    expect(profile.xp).toBe(0);
    expect(applyAction(profile, { type: 'start', route: 'grove' }).adventure?.id).toBe(
      'encounter-2',
    );
  });

  it('enforces cosmetic unlocks and rejects corrupt saves instead of silently resetting progress', () => {
    const fresh = newProfile();
    expect(applyAction(fresh, { type: 'cloak', cloak: 'midnight' }).cloak).toBe('lavender');
    expect(applyAction(fresh, { type: 'pet', enabled: true }).pet).toBe(false);
    const advanced = { ...fresh, completed: ['one', 'two'], xp: 80 };
    expect(applyAction(advanced, { type: 'cloak', cloak: 'fern' }).cloak).toBe('fern');
    expect(applyAction(advanced, { type: 'pet', enabled: true }).pet).toBe(true);
    expect(() => parseProfile({ ...fresh, xp: NaN })).toThrow();
    expect(() => parseProfile({ ...fresh, adventure: { id: 'bad' } })).toThrow();
    expect(() => parseProfile({ ...fresh, activityDays: { '2026-10-06': -1 } })).toThrow();
  });
});
