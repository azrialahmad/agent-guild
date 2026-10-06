import type { Adventure, Cloak, GameAction, Profile, Rune } from './types';

export const CLOAKS: { id: Cloak; name: string; color: string; adventures: number }[] = [
  { id: 'lavender', name: 'First light', color: '#9a87c6', adventures: 0 },
  { id: 'fern', name: 'Meadow keeper', color: '#7f9c7a', adventures: 1 },
  { id: 'sunset', name: 'Golden hour', color: '#d88b66', adventures: 3 },
  { id: 'midnight', name: 'Moon wanderer', color: '#626b9d', adventures: 5 },
];

export const ROUTES: Record<
  Adventure['route'],
  { name: string; sequence: Rune[]; description: string }
> = {
  meadow: {
    name: 'The lantern meadow',
    sequence: ['leaf', 'star', 'moon'],
    description: 'A little firefly has lost its way home. Remember its trail through the meadow.',
  },
  river: {
    name: 'Across the quiet river',
    sequence: ['moon', 'leaf', 'star'],
    description: 'Three stepping stones shimmer in the water. Remember the safe path across.',
  },
  grove: {
    name: 'A song for the grove',
    sequence: ['star', 'moon', 'leaf'],
    description: 'The grove answers in little notes of light. Echo them to wake a woodland friend.',
  },
};

export function newProfile(): Profile {
  return {
    schema: 1,
    name: 'Little Wanderer',
    xp: 0,
    completed: [],
    cloak: 'lavender',
    pet: false,
    adventure: null,
    activityDays: {},
    reducedMotion: false,
    overlayHidden: false,
  };
}

export function level(xp: number): number {
  return 1 + Math.floor(xp / 100);
}

export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function applyAction(
  profile: Profile,
  action: GameAction,
  id: () => string = () => crypto.randomUUID(),
  date = new Date(),
): Profile {
  if (!action || typeof action !== 'object') throw new Error('Invalid game action');
  switch (action.type) {
    case 'start': {
      if (profile.adventure || !ROUTES[action.route]) return profile;
      // Rotate the trail on later visits to keep repeated encounters from being identical.
      const route = ROUTES[action.route];
      const offset = profile.completed.length % route.sequence.length;
      const sequence = [...route.sequence.slice(offset), ...route.sequence.slice(0, offset)];
      return {
        ...profile,
        adventure: {
          id: id(),
          route: action.route,
          phase: 'scouting',
          sequence,
          progress: 0,
          attempts: 0,
        },
      };
    }
    case 'remember':
      if (!profile.adventure || profile.adventure.phase !== 'scouting') return profile;
      return { ...profile, adventure: { ...profile.adventure, phase: 'following' } };
    case 'rune': {
      const adventure = profile.adventure;
      if (!adventure || adventure.phase !== 'following') return profile;
      const correct = adventure.sequence[adventure.progress] === action.rune;
      const progress = correct ? adventure.progress + 1 : 0;
      return {
        ...profile,
        adventure: {
          ...adventure,
          progress,
          attempts: adventure.attempts + (correct ? 0 : 1),
          phase: progress === adventure.sequence.length ? 'complete' : 'following',
        },
      };
    }
    case 'collect': {
      const adventure = profile.adventure;
      if (!adventure || adventure.phase !== 'complete') return profile;
      if (profile.completed.includes(adventure.id)) return { ...profile, adventure: null };
      const day = localDay(date);
      return {
        ...profile,
        xp: profile.xp + 40,
        completed: [...profile.completed, adventure.id],
        adventure: null,
        activityDays: { ...profile.activityDays, [day]: (profile.activityDays[day] ?? 0) + 1 },
      };
    }
    case 'rename':
      if (typeof action.name !== 'string') throw new Error('Invalid companion name');
      return { ...profile, name: action.name.trim().slice(0, 32) || profile.name };
    case 'cloak': {
      const cloak = CLOAKS.find((item) => item.id === action.cloak);
      return cloak && profile.completed.length >= cloak.adventures
        ? { ...profile, cloak: action.cloak }
        : profile;
    }
    case 'pet':
      if (typeof action.enabled !== 'boolean') throw new Error('Invalid companion option');
      return profile.completed.length >= 2 ? { ...profile, pet: action.enabled } : profile;
    case 'motion':
      if (typeof action.reduced !== 'boolean') throw new Error('Invalid motion option');
      return { ...profile, reducedMotion: action.reduced };
    default:
      throw new Error('Unknown game action');
  }
}

export function parseProfile(value: unknown): Profile {
  if (!value || typeof value !== 'object') throw new Error('Invalid guild save');
  const p = value as Partial<Profile>;
  if (
    p.schema !== 1 ||
    typeof p.name !== 'string' ||
    p.name.length > 32 ||
    typeof p.xp !== 'number' ||
    !Number.isSafeInteger(p.xp) ||
    p.xp < 0 ||
    !Array.isArray(p.completed) ||
    !p.completed.every((entry) => typeof entry === 'string') ||
    !CLOAKS.some((cloak) => cloak.id === p.cloak) ||
    typeof p.pet !== 'boolean' ||
    typeof p.reducedMotion !== 'boolean' ||
    typeof p.overlayHidden !== 'boolean' ||
    !p.activityDays ||
    typeof p.activityDays !== 'object' ||
    !Object.entries(p.activityDays).every(
      ([day, count]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isSafeInteger(count) && count >= 0,
    )
  )
    throw new Error('Invalid or unsupported guild save');
  if (p.adventure !== null) {
    const a = p.adventure;
    if (
      !a ||
      typeof a.id !== 'string' ||
      !ROUTES[a.route] ||
      !['scouting', 'following', 'complete'].includes(a.phase) ||
      !Array.isArray(a.sequence) ||
      a.sequence.length !== 3 ||
      !a.sequence.every((r) => ['leaf', 'star', 'moon'].includes(r)) ||
      !Number.isInteger(a.progress) ||
      a.progress < 0 ||
      a.progress > 3 ||
      !Number.isInteger(a.attempts) ||
      a.attempts < 0 ||
      (a.phase === 'complete') !== (a.progress === 3)
    )
      throw new Error('Invalid adventure state');
  }
  if (p.position && (!Number.isFinite(p.position.x) || !Number.isFinite(p.position.y))) {
    throw new Error('Invalid desktop position');
  }
  return p as Profile;
}
