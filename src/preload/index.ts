import { contextBridge, ipcRenderer } from 'electron';
import type { GuildBridge, GuildState } from '../shared/types';

const bridge: GuildBridge = {
  state: () => ipcRenderer.invoke('guild:get'),
  subscribe: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: GuildState) => callback(state);
    ipcRenderer.on('guild:state', listener);
    return () => ipcRenderer.removeListener('guild:state', listener);
  },
  act: (action) => ipcRenderer.invoke('guild:action', action),
  sessions: () => ipcRenderer.invoke('guild:sessions'),
  connect: (id) => ipcRenderer.invoke('guild:connect', id),
  demo: () => ipcRenderer.invoke('guild:demo'),
  openPanel: () => ipcRenderer.send('guild:panel'),
  hideOverlay: (hidden) => ipcRenderer.invoke('guild:hidden', hidden),
  resetPosition: () => ipcRenderer.send('guild:reset-position'),
  setInteractive: (interactive) => ipcRenderer.send('guild:interactive', interactive),
  moveOverlay: (dx, dy) => ipcRenderer.send('guild:move', dx, dy),
  saveImage: (data) => ipcRenderer.invoke('guild:save-image', data),
  backup: () => ipcRenderer.invoke('guild:backup'),
};

contextBridge.exposeInMainWorld('guild', bridge);
