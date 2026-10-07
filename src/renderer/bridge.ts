import { applyAction, newProfile, parseProfile } from '../shared/game';
import { demoStep, initialActivity } from '../shared/activity';
import type { GuildBridge, GuildState } from '../shared/types';

function download(name: string, href: string): void {
  const link = document.createElement('a');
  link.download = name;
  link.href = href;
  link.click();
}

function browserBridge(): GuildBridge {
  const saved = localStorage.getItem('agent-guild:profile');
  let state: GuildState = {
    profile: saved ? parseProfile(JSON.parse(saved)) : newProfile(),
    activity: initialActivity(),
    savedConnection: null,
  };
  let step = 0;
  const listeners = new Set<(state: GuildState) => void>();
  const publish = () => listeners.forEach((listener) => listener(state));
  setInterval(() => {
    state = { ...state, activity: demoStep(state.activity, step++) };
    publish();
  }, 6500);
  return {
    state: async () => state,
    subscribe: (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    act: async (action) => {
      const profile = applyAction(state.profile, action);
      localStorage.setItem('agent-guild:profile', JSON.stringify(profile));
      state = { ...state, profile };
      publish();
      return state;
    },
    sessions: async () => {
      throw new Error(
        'Live sessions are available in the desktop app. This browser preview uses synthetic activity.',
      );
    },
    connect: async () => {
      throw new Error('Install the desktop app to connect OpenCode.');
    },
    demo: async () => {
      step = 0;
      state = { ...state, activity: demoStep(initialActivity(), step++) };
      publish();
    },
    openPanel: (page = 'guild') => {
      location.search = `?page=${page}`;
    },
    onNavigate: () => () => {},
    hideOverlay: async () => {},
    resetPosition: () => {},
    setInteractive: () => {},
    moveOverlay: () => {},
    saveImage: async (data) => {
      download('my-agent-guild.png', data);
      return true;
    },
    backup: async () => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(state.profile, null, 2)], { type: 'application/json' }),
      );
      download('agent-guild-backup.json', url);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    },
    openAdapterGuide: async () => {
      window.open(
        'https://github.com/azrialahmad/agent-guild/blob/main/integrations/README.md',
        '_blank',
        'noopener,noreferrer',
      );
    },
  };
}

export const isDesktop = Boolean(window.guild);
export const bridge = window.guild ?? browserBridge();
