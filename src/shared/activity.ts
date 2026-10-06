import type { Activity, ActivityEvent, WorkKind } from './types';

export function initialActivity(mode: Activity['mode'] = 'demo'): Activity {
  return {
    mode,
    connection: mode === 'demo' ? 'demo' : 'connecting',
    sessionTitle: mode === 'demo' ? 'A little demo adventure' : 'Select an OpenCode session',
    kind: mode === 'demo' ? 'working' : 'unknown',
    label: mode === 'demo' ? 'Dreaming up the next adventure' : 'Not connected',
    activeTools: 0,
    events: [],
  };
}

export function toolKind(name: string): WorkKind {
  const short = name.split('.').at(-1)?.toLowerCase() ?? name.toLowerCase();
  if (['read', 'grep', 'glob', 'search', 'list', 'webfetch', 'websearch'].includes(short))
    return 'reading';
  if (['patch', 'edit', 'write', 'apply_patch', 'multiedit'].includes(short)) return 'editing';
  if (['shell', 'bash', 'terminal', 'exec_command', 'execute'].includes(short)) return 'command';
  return 'working';
}

export function addEvent(activity: Activity, event: ActivityEvent): Activity {
  if (activity.events.some((existing) => existing.id === event.id)) return activity;
  return { ...activity, events: [event, ...activity.events].slice(0, 80) };
}

const DEMO_STEPS: { kind: WorkKind; label: string; source: string; detail: string }[] = [
  {
    kind: 'reading',
    label: 'Reading the project guide',
    source: 'demo.read',
    detail: 'Synthetic event: read README.md',
  },
  {
    kind: 'editing',
    label: 'Crafting a little feature',
    source: 'demo.patch',
    detail: 'Synthetic event: patch src/greeting.ts',
  },
  {
    kind: 'command',
    label: 'Running a command',
    source: 'demo.shell',
    detail: 'Synthetic event: npm run check',
  },
  {
    kind: 'working',
    label: 'Trying another approach',
    source: 'demo.tool.failed',
    detail: 'Synthetic tool failure. This does not determine task outcome.',
  },
  {
    kind: 'editing',
    label: 'Making a small adjustment',
    source: 'demo.patch',
    detail: 'Synthetic event: apply a follow-up patch',
  },
  {
    kind: 'attention',
    label: 'A question for you',
    source: 'demo.form',
    detail: 'Synthetic attention request: choose a greeting style',
  },
  {
    kind: 'idle',
    label: 'The demo turn has ended',
    source: 'demo.idle',
    detail: 'Synthetic end-of-turn event, not proof of code correctness',
  },
];

export function demoStep(activity: Activity, step: number, time = Date.now()): Activity {
  const event = DEMO_STEPS[step % DEMO_STEPS.length];
  return addEvent(
    {
      ...activity,
      kind: event.kind,
      label: event.label,
      activeTools: ['reading', 'editing', 'command'].includes(event.kind) ? 1 : 0,
    },
    { ...event, id: `demo-${step}-${time}`, time },
  );
}
