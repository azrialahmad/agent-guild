export type WorkKind =
  'idle' | 'working' | 'reading' | 'editing' | 'command' | 'attention' | 'unknown';

export interface ActivityEvent {
  id: string;
  source: string;
  time: number;
  kind: WorkKind;
  label: string;
  detail?: string;
}

export interface Usage {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}

export interface Activity {
  mode: 'demo' | 'live';
  connection: 'demo' | 'connected' | 'connecting' | 'disconnected';
  sessionId?: string;
  sessionTitle: string;
  kind: WorkKind;
  label: string;
  activeTools: number;
  events: ActivityEvent[];
  usage?: Usage;
  error?: string;
  historyNote?: string;
  version?: string;
}

export type Cloak = 'lavender' | 'fern' | 'sunset' | 'midnight';
export type Rune = 'leaf' | 'star' | 'moon';
export interface Adventure {
  id: string;
  route: 'meadow' | 'river' | 'grove';
  phase: 'scouting' | 'following' | 'complete';
  sequence: Rune[];
  progress: number;
  attempts: number;
}

export interface Profile {
  schema: 1;
  name: string;
  xp: number;
  completed: string[];
  cloak: Cloak;
  pet: boolean;
  adventure: Adventure | null;
  activityDays: Record<string, number>;
  reducedMotion: boolean;
  overlayHidden: boolean;
  position?: { x: number; y: number };
}

export interface SessionOption {
  id: string;
  title: string;
  project: string;
  active: boolean;
}

export interface GuildState {
  profile: Profile;
  activity: Activity;
}

export type GameAction =
  | { type: 'start'; route: Adventure['route'] }
  | { type: 'remember' }
  | { type: 'rune'; rune: Rune }
  | { type: 'collect' }
  | { type: 'rename'; name: string }
  | { type: 'cloak'; cloak: Cloak }
  | { type: 'pet'; enabled: boolean }
  | { type: 'motion'; reduced: boolean };

export interface GuildBridge {
  state(): Promise<GuildState>;
  subscribe(callback: (state: GuildState) => void): () => void;
  act(action: GameAction): Promise<GuildState>;
  sessions(): Promise<SessionOption[]>;
  connect(sessionId: string): Promise<void>;
  demo(): Promise<void>;
  openPanel(page?: 'guild' | 'adventures'): void;
  onNavigate(callback: (page: 'guild' | 'adventures') => void): () => void;
  hideOverlay(hidden: boolean): Promise<void>;
  resetPosition(): void;
  setInteractive(interactive: boolean): void;
  moveOverlay(dx: number, dy: number): void;
  saveImage(dataUrl: string): Promise<boolean>;
  backup(): Promise<boolean>;
}

export const WORK_LABELS: Record<WorkKind, string> = {
  idle: 'Turn ended',
  working: 'At work',
  reading: 'Exploring the archives',
  editing: 'At the crafting bench',
  command: 'Running a command',
  attention: 'Your attention is needed',
  unknown: 'Status unknown',
};
