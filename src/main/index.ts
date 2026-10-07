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
  shell,
} from 'electron';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applyAction } from '../shared/game';
import { demoStep, initialActivity } from '../shared/activity';
import type {
  Activity,
  ConnectionSelection,
  GameAction,
  GuildState,
  SessionOption,
} from '../shared/types';
import { OpenCodeConnector, listSessions } from './connector';
import { ProfileStore } from './persistence';
import { clampPlacement } from './placement';
import { ActivityBridge } from './activity-bridge';
import { ConnectionStore } from './connection-store';

const smoke = process.env.AGENT_GUILD_SMOKE === '1';
// Resource measurements launch normally, without automation's background-throttling overrides.
const measureSurface = process.env.AGENT_GUILD_MEASURE_SURFACE;
if (process.env.AGENT_GUILD_DATA_DIR) app.setPath('userData', process.env.AGENT_GUILD_DATA_DIR);
if (smoke && !process.env.AGENT_GUILD_DATA_DIR)
  app.setPath('userData', join(app.getPath('temp'), `agent-guild-smoke-${process.pid}`));
app.setName('Agent Guild');
let panel: BrowserWindow | undefined;
let panelPage: 'guild' | 'adventures' = 'guild';
let overlay: BrowserWindow;
let tray: Tray;
let store: ProfileStore;
let connectionStore: ConnectionStore;
let state: GuildState;
let activityBridge: ActivityBridge;
let liveTransport: 'service' | 'bridge' | undefined;
let requestedSession = process.env.AGENT_GUILD_SESSION;
let selectedBridgeKey: string | undefined;
let explicitBridgeChoice = false;
let availableSessions: SessionOption[] = [];
let bootComplete = false;
let demoTimer: ReturnType<typeof setInterval> | undefined;
let demoIndex = 0;
let quitting = false;
let positionSaveTimer: ReturnType<typeof setTimeout> | undefined;
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
  activityBridge?.stopFollowing();
  liveTransport = undefined;
  selectedBridgeKey = undefined;
  explicitBridgeChoice = false;
  if (demoTimer) clearInterval(demoTimer);
  state.activity = demoStep(initialActivity(), demoIndex++);
  demoTimer = setInterval(() => {
    state.activity = demoStep(state.activity, demoIndex++);
    publish();
  }, 6500);
  publish();
}

function reportSurface(surface: 'panel' | 'overlay', window?: BrowserWindow): void {
  if (measureSurface)
    console.log(
      JSON.stringify({
        surface,
        exists: Boolean(window && !window.isDestroyed()),
        visible: Boolean(window && !window.isDestroyed() && window.isVisible()),
      }),
    );
}

function revealPanel(window: BrowserWindow): void {
  if (window.isDestroyed() || quitting) return;
  if (window.isMinimized()) window.restore();
  window.show();
  // This is an explicit player action from a non-focusable overlay, not a background update.
  if (process.platform === 'darwin') app.focus({ steal: true });
  window.focus();
  window.webContents.send('guild:navigate', panelPage);
}

function showPanel(page?: 'guild' | 'adventures'): void {
  if (page) panelPage = page;
  if (panel && !panel.isDestroyed()) {
    if (!panel.webContents.isLoadingMainFrame()) revealPanel(panel);
    return;
  }
  const window = new BrowserWindow({
    width: 520,
    height: 620,
    minWidth: 420,
    minHeight: 500,
    title: 'Agent Guild',
    backgroundColor: '#f8f7f2',
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hidden' as const, trafficLightPosition: { x: 14, y: 20 } }
      : {}),
    show: false,
    paintWhenInitiallyHidden: false,
    webPreferences: preferences(),
  });
  panel = window;
  window.on('closed', () => {
    if (panel === window) panel = undefined;
    reportSurface('panel');
  });
  window.webContents.once('did-finish-load', () => {
    revealPanel(window);
    reportSurface('panel', window);
    if (measureSurface === 'panel-closed')
      setTimeout(() => {
        if (!window.isDestroyed()) window.close();
      }, 1000);
  });
  load(window, 'panel', panelPage);
}

function updateActivity(activity: Activity): void {
  state = { ...state, activity };
  publish();
}

function remember(selection: ConnectionSelection | null): void {
  connectionStore.save(selection);
  state = { ...state, savedConnection: selection };
}

function followBridge(key: string): void {
  if (demoTimer) clearInterval(demoTimer);
  connector.stop();
  liveTransport = 'bridge';
  selectedBridgeKey = key;
  activityBridge.follow(key, updateActivity);
}

function restoreBridge(selection: Extract<ConnectionSelection, { transport: 'bridge' }>): void {
  if (explicitBridgeChoice && selectedBridgeKey && activityBridge.isConnected(selectedBridgeKey))
    return;
  const matches = activityBridge.matches(selection);
  if (matches.length === 1) {
    if (selectedBridgeKey !== matches[0]) followBridge(matches[0]!);
  } else if (matches.length > 1) {
    activityBridge.stopFollowing();
    selectedBridgeKey = undefined;
    updateActivity({
      ...initialActivity('live'),
      sessionId: selection.sessionId,
      sessionTitle: selection.title,
      connection: 'disconnected',
      label: 'Multiple matching runtimes · choose a source in Settings',
      error:
        'More than one producer matches the remembered source. Select the executing runtime explicitly.',
    });
  }
}

function waitForBridge(selection?: ConnectionSelection): void {
  liveTransport = 'bridge';
  updateActivity({
    ...initialActivity('live'),
    sessionId: selection?.sessionId ?? requestedSession,
    sessionTitle: selection?.title ?? requestedSession ?? 'Saved agent session',
    label: 'Waiting for the harness to report activity',
    historyNote:
      'Your connection is remembered. State stays unknown until the executing harness sends a fresh signal.',
  });
}

function preferences(): Electron.WebPreferences {
  return {
    preload: join(import.meta.dirname, '../preload/index.cjs'),
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
  };
}

function place(
  position: { x: number; y: number } | null | undefined = state.profile.position,
  persist = true,
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
  if (positionSaveTimer) clearTimeout(positionSaveTimer);
  positionSaveTimer = undefined;
  if (persist) save();
  else
    positionSaveTimer = setTimeout(() => {
      positionSaveTimer = undefined;
      save();
    }, 200);
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
      { label: 'Open your guild', click: () => showPanel() },
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

function load(window: BrowserWindow, surface: string, page?: 'guild' | 'adventures'): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  const query = {
    surface,
    ...(page ? { page } : {}),
    ...(surface === 'panel' && process.platform === 'darwin' ? { titlebar: 'integrated' } : {}),
  };
  if (process.env.ELECTRON_RENDERER_URL)
    void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}?${new URLSearchParams(query)}`);
  else
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'), {
      query,
    });
}

async function setup(): Promise<void> {
  store = new ProfileStore(join(app.getPath('userData'), 'profile.json'));
  connectionStore = new ConnectionStore(join(app.getPath('userData'), 'connection.json'));
  try {
    state = { profile: store.load(), activity: initialActivity(), savedConnection: null };
  } catch (error) {
    dialog.showErrorBox(
      'Your guild save needs attention',
      `${String(error)}\nThe existing file has been preserved. Move it aside or restore your backup before restarting.`,
    );
    app.quit();
    return;
  }
  let connectionError = false;
  try {
    state.savedConnection = connectionStore.load();
  } catch {
    connectionError = true;
  }
  activityBridge = new ActivityBridge(
    process.env.AGENT_GUILD_SOCKET ?? join(app.getPath('userData'), 'activity.sock'),
    (key, selection) => {
      if (requestedSession) {
        if (selection.sessionId !== requestedSession) return;
        remember(selection);
        requestedSession = undefined;
        followBridge(key);
      }
      const saved = state.savedConnection;
      if (
        saved?.transport === 'bridge' &&
        saved.harness === selection.harness &&
        saved.sessionId === selection.sessionId &&
        saved.sourceId === selection.sourceId
      )
        restoreBridge(saved);
    },
  );
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
    paintWhenInitiallyHidden: false,
    webPreferences: preferences(),
  });
  overlay.setAlwaysOnTop(true, 'floating');
  if (process.platform === 'darwin')
    overlay.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  place();
  // Initial hidden renderers must have a real hidden visibility state. With
  // paintWhenInitiallyHidden disabled, did-finish-load replaces ready-to-show.
  overlay.webContents.once('did-finish-load', () => {
    if (!state.profile.overlayHidden && measureSurface !== 'tray-only') overlay.showInactive();
    reportSurface('overlay', overlay);
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
  tray.on('double-click', () => showPanel());
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Agent Guild',
        submenu: [
          { label: 'Open your guild', accelerator: 'CmdOrCtrl+G', click: () => showPanel() },
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
  ipcMain.handle('guild:sessions', async () => {
    const incoming = activityBridge.sessions();
    const native = await listSessions().catch((error: unknown) => {
      if (incoming.length) return [];
      throw error;
    });
    availableSessions = [...incoming, ...native];
    return availableSessions;
  });
  ipcMain.handle('guild:connect', (_event, id: string) => {
    requestedSession = undefined;
    if (typeof id === 'string' && id.startsWith('bridge:')) {
      remember(activityBridge.selection(id));
      explicitBridgeChoice = true;
      followBridge(id);
      return;
    }
    if (typeof id !== 'string' || !/^ses[\w-]+$/.test(id))
      throw new Error('Invalid session identifier');
    const selection = availableSessions.find((session) => session.id === id)?.selection;
    remember(selection ?? { transport: 'service', harness: 'opencode', sessionId: id, title: id });
    if (demoTimer) clearInterval(demoTimer);
    activityBridge.stopFollowing();
    selectedBridgeKey = undefined;
    explicitBridgeChoice = false;
    liveTransport = 'service';
    connector.connect(id, updateActivity, state.savedConnection!.title);
  });
  ipcMain.handle('guild:demo', () => {
    requestedSession = undefined;
    remember(null);
    startDemo();
  });
  ipcMain.on('guild:panel', (_event, page: unknown) =>
    showPanel(page === 'adventures' ? 'adventures' : 'guild'),
  );
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
    place(
      {
        x: x + Math.max(-2000, Math.min(2000, dx)),
        y: y + Math.max(-2000, Math.min(2000, dy)),
      },
      false,
    );
  });
  ipcMain.handle('guild:save-image', async (event, data: string) => {
    if (
      typeof data !== 'string' ||
      !data.startsWith('data:image/png;base64,') ||
      data.length > 10000000
    )
      throw new Error('Invalid guild image');
    const options = {
      defaultPath: 'my-agent-guild.png',
      filters: [{ name: 'PNG image', extensions: ['png'] }],
    };
    const owner = BrowserWindow.fromWebContents(event.sender);
    const result = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return false;
    await writeFile(
      result.filePath,
      Buffer.from(data.slice('data:image/png;base64,'.length), 'base64'),
    );
    return true;
  });
  ipcMain.handle('guild:backup', async (event) => {
    const options = {
      defaultPath: 'agent-guild-backup.json',
      filters: [{ name: 'Guild backup', extensions: ['json'] }],
    };
    const owner = BrowserWindow.fromWebContents(event.sender);
    const result = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, JSON.stringify(state.profile, null, 2));
    return true;
  });
  ipcMain.handle('guild:adapter-guide', () =>
    shell.openExternal(
      'https://github.com/azrialahmad/agent-guild/blob/main/integrations/README.md',
    ),
  );
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
    if (liveTransport === 'service' && state.activity.mode === 'live' && state.activity.sessionId)
      connector.connect(state.activity.sessionId, updateActivity, state.savedConnection?.title);
  });
  load(overlay, 'overlay');
  if (requestedSession) waitForBridge();
  else if (connectionError)
    updateActivity({
      ...initialActivity('live'),
      connection: 'disconnected',
      label: 'Saved connection could not be restored',
      error: 'Choose a session in Settings to replace the preserved connection preferences.',
    });
  else if (state.savedConnection?.transport === 'bridge') waitForBridge(state.savedConnection);
  else if (state.savedConnection?.transport === 'service') {
    liveTransport = 'service';
    connector.connect(state.savedConnection.sessionId, updateActivity, state.savedConnection.title);
  } else startDemo();
  await activityBridge.start();
  bootComplete = true;
  if (measureSurface === 'panel-and-overlay' || measureSurface === 'panel-closed') showPanel();
  else reportSurface('panel');
}

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => {
    if (bootComplete) showPanel();
  });
  app.on('activate', () => {
    if (bootComplete && !measureSurface) showPanel();
  });
  app.on('before-quit', () => {
    quitting = true;
    if (positionSaveTimer) {
      clearTimeout(positionSaveTimer);
      store.save(state.profile);
    }
    connector.stop();
    activityBridge?.stop();
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
