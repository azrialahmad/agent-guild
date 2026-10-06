import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  screen,
  Tray,
} from 'electron';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applyAction } from '../shared/game';
import { demoStep, initialActivity } from '../shared/activity';
import type { GameAction, GuildState } from '../shared/types';
import { OpenCodeConnector, listSessions } from './connector';
import { ProfileStore } from './persistence';
import { clampPlacement } from './placement';

const smoke = process.env.AGENT_GUILD_SMOKE === '1';
if (process.env.AGENT_GUILD_DATA_DIR) app.setPath('userData', process.env.AGENT_GUILD_DATA_DIR);
if (smoke) app.setPath('userData', join(app.getPath('temp'), `agent-guild-smoke-${process.pid}`));
app.setName('Agent Guild');
let panel: BrowserWindow;
let overlay: BrowserWindow;
let tray: Tray;
let store: ProfileStore;
let state: GuildState;
let demoTimer: ReturnType<typeof setInterval> | undefined;
let demoIndex = 0;
let quitting = false;
const connector = new OpenCodeConnector();

function publish(): void {
  for (const window of [panel, overlay])
    if (window && !window.isDestroyed()) window.webContents.send('guild:state', state);
}

function save(): void {
  store.save(state.profile);
  publish();
}

function startDemo(): void {
  connector.stop();
  if (demoTimer) clearInterval(demoTimer);
  state.activity = demoStep(initialActivity(), demoIndex++);
  demoTimer = setInterval(() => {
    state.activity = demoStep(state.activity, demoIndex++);
    publish();
  }, 6500);
  publish();
}

function showPanel(): void {
  panel.show();
  panel.focus();
}

function place(
  position: { x: number; y: number } | null | undefined = state.profile.position,
): void {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const areas = [
    primary.workArea,
    ...displays.filter((display) => display.id !== primary.id).map((display) => display.workArea),
  ];
  const bounds = clampPlacement(position ?? undefined, areas, 260, 190);
  overlay.setBounds(bounds);
  state.profile = { ...state.profile, position: { x: bounds.x, y: bounds.y } };
  save();
}

function setHidden(hidden: boolean): void {
  state.profile = { ...state.profile, overlayHidden: hidden };
  if (hidden) overlay.hide();
  else overlay.showInactive();
  save();
  updateTray();
}

function updateTray(): void {
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open your guild', click: showPanel },
      {
        label: state.profile.overlayHidden ? 'Show companion' : 'Hide companion',
        click: () => setHidden(!state.profile.overlayHidden),
      },
      { label: 'Reset companion position', click: () => place(null) },
      { type: 'separator' },
      { label: 'Quit Agent Guild', click: () => app.quit() },
    ]),
  );
}

function load(window: BrowserWindow, surface: string): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  if (process.env.ELECTRON_RENDERER_URL)
    void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}?surface=${surface}`);
  else
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'), {
      query: { surface },
    });
}

async function setup(): Promise<void> {
  store = new ProfileStore(join(app.getPath('userData'), 'profile.json'));
  try {
    state = { profile: store.load(), activity: initialActivity() };
  } catch (error) {
    dialog.showErrorBox(
      'Your guild save needs attention',
      `${String(error)}\nThe existing file has been preserved. Move it aside or restore your backup before restarting.`,
    );
    app.quit();
    return;
  }
  const preferences = {
    preload: join(import.meta.dirname, '../preload/index.cjs'),
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
  };
  panel = new BrowserWindow({
    width: 1080,
    height: 800,
    minWidth: 820,
    minHeight: 650,
    title: 'Agent Guild',
    backgroundColor: '#f8f7f2',
    show: false,
    webPreferences: preferences,
  });
  overlay = new BrowserWindow({
    width: 260,
    height: 190,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: preferences,
  });
  overlay.setAlwaysOnTop(true, 'floating');
  if (process.platform === 'darwin')
    overlay.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  place();
  panel.on('close', (event) => {
    if (!quitting && !smoke) {
      event.preventDefault();
      panel.hide();
    }
  });
  panel.once('ready-to-show', () => panel.show());
  overlay.once('ready-to-show', () => {
    if (!state.profile.overlayHidden) overlay.showInactive();
  });
  // NativeImage accepts bitmap/PNG, not SVG. An original black pixel lantern is a template icon.
  const pixels = Buffer.alloc(16 * 16 * 4);
  const rows = [
    '................',
    '......####......',
    '......#..#......',
    '....########....',
    '...##########...',
    '...##......##...',
    '...##......##...',
    '...##..##..##...',
    '...##..##..##...',
    '...##..##..##...',
    '...##......##...',
    '...##......##...',
    '...##########...',
    '...##########...',
    '.....######.....',
    '................',
  ];
  rows.forEach((row, y) =>
    [...row].forEach((pixel, x) => {
      if (pixel === '#') pixels[(y * 16 + x) * 4 + 3] = 255;
    }),
  );
  const icon = nativeImage.createFromBitmap(pixels, { width: 16, height: 16 });
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Agent Guild');
  updateTray();
  tray.on('double-click', showPanel);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Agent Guild',
        submenu: [
          { label: 'Open your guild', accelerator: 'CmdOrCtrl+G', click: showPanel },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      { role: 'editMenu' },
      { role: 'viewMenu' },
    ]),
  );

  ipcMain.handle('guild:get', () => state);
  ipcMain.handle('guild:action', (_event, action: GameAction) => {
    const next = applyAction(state.profile, action);
    store.save(next); // Commit before publishing or replacing in-memory state.
    state = { ...state, profile: next };
    publish();
    return state;
  });
  ipcMain.handle('guild:sessions', () => listSessions());
  ipcMain.handle('guild:connect', (_event, id: string) => {
    if (typeof id !== 'string' || !/^ses[\w-]+$/.test(id))
      throw new Error('Invalid session identifier');
    if (demoTimer) clearInterval(demoTimer);
    connector.connect(id, (activity) => {
      state = { ...state, activity };
      publish();
    });
  });
  ipcMain.handle('guild:demo', startDemo);
  ipcMain.on('guild:panel', showPanel);
  ipcMain.handle('guild:hidden', (_event, hidden: boolean) => setHidden(Boolean(hidden)));
  ipcMain.on('guild:reset-position', () => place(null));
  ipcMain.on('guild:interactive', (event, interactive: boolean) => {
    if (event.sender.id === overlay.webContents.id)
      overlay.setIgnoreMouseEvents(!interactive, { forward: true });
  });
  ipcMain.on('guild:move', (event, dx: number, dy: number) => {
    if (event.sender.id !== overlay.webContents.id || !Number.isFinite(dx) || !Number.isFinite(dy))
      return;
    const [x, y] = overlay.getPosition();
    place({
      x: x + Math.max(-2000, Math.min(2000, dx)),
      y: y + Math.max(-2000, Math.min(2000, dy)),
    });
  });
  ipcMain.handle('guild:save-image', async (_event, data: string) => {
    if (
      typeof data !== 'string' ||
      !data.startsWith('data:image/png;base64,') ||
      data.length > 10000000
    )
      throw new Error('Invalid guild image');
    const result = await dialog.showSaveDialog(panel, {
      defaultPath: 'my-agent-guild.png',
      filters: [{ name: 'PNG image', extensions: ['png'] }],
    });
    if (result.canceled || !result.filePath) return false;
    await writeFile(
      result.filePath,
      Buffer.from(data.slice('data:image/png;base64,'.length), 'base64'),
    );
    return true;
  });
  ipcMain.handle('guild:backup', async () => {
    const result = await dialog.showSaveDialog(panel, {
      defaultPath: 'agent-guild-backup.json',
      filters: [{ name: 'Guild backup', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, JSON.stringify(state.profile, null, 2));
    return true;
  });
  screen.on('display-removed', () => place());
  screen.on('display-metrics-changed', () => place());
  powerMonitor.on('suspend', () => {
    connector.stop();
    if (state.activity.mode === 'live') {
      state.activity = {
        ...state.activity,
        connection: 'disconnected',
        kind: 'unknown',
        label: 'Computer is asleep',
        activeTools: 0,
      };
      publish();
    }
  });
  powerMonitor.on('resume', () => {
    place();
    if (state.activity.mode === 'live' && state.activity.sessionId)
      connector.connect(state.activity.sessionId, (activity) => {
        state.activity = activity;
        publish();
      });
  });
  load(panel, 'panel');
  load(overlay, 'overlay');
  startDemo();
}

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => {
    if (panel) showPanel();
  });
  app.on('activate', () => {
    if (panel) showPanel();
  });
  app.on('before-quit', () => {
    quitting = true;
    connector.stop();
    if (demoTimer) clearInterval(demoTimer);
  });
  void app
    .whenReady()
    .then(setup)
    .catch((error) => {
      console.error(error);
      app.quit();
    });
}
