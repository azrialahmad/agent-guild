import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { join } from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { send } from '../../integrations/bridge/send.mjs';
import type { BridgePacket } from '../../src/shared/bridge-activity';
import type { ConnectionSelection } from '../../src/shared/types';

async function launchGuild(overrides: Record<string, string> = {}) {
  const env = { ...process.env };
  delete env.AGENT_GUILD_SESSION;
  delete env.AGENT_GUILD_SOCKET;
  delete env.AGENT_GUILD_MEASURE_SURFACE;
  return electron.launch({
    executablePath: process.env.AGENT_GUILD_EXECUTABLE,
    args: process.env.AGENT_GUILD_EXECUTABLE ? [] : ['.'],
    env: { ...env, AGENT_GUILD_SMOKE: '1', ...overrides },
  });
}

async function overlayWindow(app: ElectronApplication) {
  await expect
    .poll(() => app.windows().some((window) => window.url().includes('surface=overlay')))
    .toBe(true);
  const overlay = app.windows().find((window) => window.url().includes('surface=overlay'))!;
  await expect(overlay.getByRole('button', { name: 'Open your guild' })).toBeVisible();
  return overlay;
}

async function panelWindow(app: ElectronApplication, page: 'guild' | 'adventures' = 'guild') {
  if (!app.windows().some((window) => window.url().includes('surface=panel'))) {
    const overlay = await overlayWindow(app);
    await overlay.evaluate((page) => window.guild!.openPanel(page), page);
  }
  await expect
    .poll(() => app.windows().some((window) => window.url().includes('surface=panel')))
    .toBe(true);
  return app.windows().find((window) => window.url().includes('surface=panel'))!;
}

test('desktop follows the executing plugin source and never rewards observed tool activity', async () => {
  const app = await launchGuild({ AGENT_GUILD_SESSION: 'ses_fixture' });
  try {
    const panel = await panelWindow(app);
    await expect(
      panel.getByRole('heading', { name: 'Little Wanderer', exact: true }),
    ).toBeVisible();
    const path = join(await app.evaluate(({ app }) => app.getPath('userData')), 'activity.sock');
    const emit = (type: BridgePacket['type'], extra: Partial<BridgePacket> = {}) =>
      send(
        {
          schema: 1,
          id: crypto.randomUUID(),
          producer: 'private-server',
          harness: 'opencode',
          sessionId: 'ses_fixture',
          title: 'Private-server fixture',
          project: 'fixture',
          time: Date.now(),
          type,
          ...extra,
        },
        path,
      );
    await emit('turn-start');
    await expect
      .poll(() => panel.evaluate(async () => (await window.guild!.state()).activity.sessionId))
      .toBe('ses_fixture');
    await panel.getByRole('button', { name: 'Settings', exact: true }).click();
    await panel.getByRole('button', { name: 'Find local sessions' }).click();
    await panel.getByLabel('Choose a session').selectOption({
      label: '● Private-server fixture · fixture · opencode plugin · private-server',
    });
    await panel.getByRole('button', { name: 'Follow this session' }).click();
    await emit('tool-start', { toolId: 'patch-1', toolName: 'patch' });
    await expect
      .poll(() => panel.evaluate(async () => (await window.guild!.state()).activity.kind))
      .toBe('editing');
    await panel.getByRole('button', { name: 'Agent activity', exact: true }).click();
    await expect(panel.getByText(/Source: opencode plugin · private-server/)).toBeVisible();
    await emit('attention', { toolId: 'permission-1' });
    await expect
      .poll(() => panel.evaluate(async () => (await window.guild!.state()).activity.kind))
      .toBe('attention');
    await emit('attention-clear', { toolId: 'permission-1' });
    await emit('tool-end', { toolId: 'patch-1', toolName: 'patch' });
    await emit('turn-end');
    const state = await panel.evaluate(async () => window.guild!.state());
    expect(state.activity).toMatchObject({
      kind: 'idle',
      label: 'Turn ended · outcome unverified',
    });
    expect(state.profile.xp).toBe(0);
    expect(state.profile.completed).toHaveLength(0);
  } finally {
    await app.close();
  }
});

test('overlay controls open the requested page and support an actual pointer drag', async () => {
  const app = await launchGuild();
  try {
    const overlay = await overlayWindow(app);
    expect(app.windows()).toHaveLength(1);
    await overlay
      .getByRole('button', { name: 'Open your guild' })
      .hover({ position: { x: 110, y: 65 } });
    await overlay.getByRole('button', { name: 'Play an adventure' }).click();
    const panel = await panelWindow(app, 'adventures');
    await expect(panel.getByRole('heading', { name: 'Adventures', exact: true })).toBeVisible();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((window) => window.webContents.getURL().includes('surface=panel'))!
        .minimize(),
    );
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((window) => window.webContents.getURL().includes('surface=panel'))!
            .isMinimized(),
        ),
      )
      .toBe(true);
    await overlay
      .getByRole('button', { name: 'Open your guild' })
      .hover({ position: { x: 110, y: 65 } });
    await overlay.getByRole('button', { name: 'Play an adventure' }).click();
    await expect(panel.getByRole('heading', { name: 'Adventures', exact: true })).toBeVisible();
    expect(
      await app.evaluate(({ BrowserWindow }) => {
        const panel = BrowserWindow.getAllWindows().find((window) =>
          window.webContents.getURL().includes('surface=panel'),
        )!;
        return { visible: panel.isVisible(), minimized: panel.isMinimized() };
      }),
    ).toEqual({ visible: true, minimized: false });
    await panel.getByRole('button', { name: 'Wardrobe', exact: true }).click();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((window) => window.webContents.getURL().includes('surface=panel'))!
        .hide(),
    );
    await overlay
      .getByRole('button', { name: 'Open your guild' })
      .click({ position: { x: 110, y: 65 } });
    await expect(
      panel.getByRole('heading', { name: 'Little Wanderer', exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((window) => window.webContents.getURL().includes('surface=panel'))!
            .isFocused(),
        ),
      )
      .toBe(true);
    const original = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((window) => window.webContents.getURL().includes('surface=overlay'))!
        .getBounds(),
    );
    await overlay
      .getByRole('button', { name: 'Open your guild' })
      .hover({ position: { x: 110, y: 65 } });
    const grip = await overlay
      .getByRole('button', { name: 'Drag companion to reposition' })
      .boundingBox();
    if (!grip) throw new Error('No drag handle');
    const x = grip.x + grip.width / 2;
    const y = grip.y + grip.height / 2;
    await overlay.mouse.move(x, y);
    await overlay.mouse.down();
    await overlay.mouse.move(x - 40, y - 15);
    await overlay.mouse.up();
    await expect
      .poll(async () =>
        app.evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()
              .find((window) => window.webContents.getURL().includes('surface=overlay'))!
              .getBounds().x,
        ),
      )
      .toBe(original.x - 40);
    const profilePath = join(
      await app.evaluate(({ app }) => app.getPath('userData')),
      'profile.json',
    );
    await expect
      .poll(async () => JSON.parse(await readFile(profilePath, 'utf8')).position.x)
      .toBe(original.x - 40);
  } finally {
    await app.close();
  }
});

test('desktop adventure survives reload, unlocks cosmetics, and produces a real postcard', async () => {
  const app = await launchGuild();
  try {
    let panel = await panelWindow(app);
    await expect(
      panel.getByRole('heading', { name: 'Little Wanderer', exact: true }),
    ).toBeVisible();
    const bounds = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((window) => window.webContents.getURL().includes('surface=panel'))!
        .getBounds(),
    );
    expect({ width: bounds.width, height: bounds.height }).toEqual({ width: 520, height: 620 });
    const main = panel.locator('main');
    expect(await main.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(
      true,
    );
    const history = panel.getByLabel('Adventure completions in the last 84 local days');
    await expect(history).not.toBeVisible();
    await panel.getByText('Adventure history', { exact: false }).click();
    await expect(history).toBeVisible();
    await panel.getByText('Adventure history', { exact: false }).click();
    await panel.getByRole('button', { name: 'Adventures', exact: true }).click();
    await panel.getByRole('button', { name: /The lantern meadow/ }).click();
    await panel.getByRole('button', { name: 'I remember the trail' }).click();
    await panel.getByRole('button', { name: 'leaf', exact: true }).click();
    const rendererPid = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((window) => window.webContents.getURL().includes('surface=panel'))!
        .webContents.getOSProcessId(),
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((window) => window.webContents.getURL().includes('surface=panel'))!
        .close(),
    );
    await expect.poll(() => app.windows().length).toBe(1);
    await expect
      .poll(() =>
        app.evaluate(
          ({ app }, pid) => app.getAppMetrics().some((metric) => metric.pid === pid),
          rendererPid,
        ),
      )
      .toBe(false);
    const overlay = await overlayWindow(app);
    await overlay
      .getByRole('button', { name: 'Open your guild' })
      .hover({ position: { x: 110, y: 65 } });
    await overlay.getByRole('button', { name: 'Play an adventure' }).click();
    panel = await panelWindow(app, 'adventures');
    await expect(panel.getByRole('heading', { name: 'Adventures', exact: true })).toBeVisible();
    await expect(panel.getByLabel('1 of 3 signs followed')).toBeVisible();
    await panel.getByRole('button', { name: 'star', exact: true }).click();
    await panel.getByRole('button', { name: 'moon', exact: true }).click();
    await panel.getByRole('button', { name: 'Collect your keepsake' }).click();
    await panel.getByRole('button', { name: 'Wardrobe', exact: true }).click();
    await panel.getByRole('button', { name: /Meadow keeper/ }).click();
    await expect(panel.getByRole('button', { name: /Meadow keeper/ })).toContainText('Equipped');
    await panel.getByRole('button', { name: 'Share your guild' }).click();
    await expect(panel.getByRole('dialog')).toBeVisible();
    await expect(panel.getByRole('img', { name: /Preview of your character/ })).toHaveAttribute(
      'src',
      /^data:image\/png;base64,/,
    );
    await expect(panel.getByLabel(/Selected-session tokens/)).toBeDisabled();
    await panel.keyboard.press('Escape');
    await expect(panel.getByRole('dialog')).toHaveCount(0);
    const profile = await panel.evaluate(async () => (await window.guild!.state()).profile);
    expect(profile.xp).toBe(40);
    expect(profile.completed).toHaveLength(1);
    expect(profile.cloak).toBe('fern');
    await panel.getByRole('button', { name: 'My guild', exact: true }).click();
    await panel.screenshot({
      path: join('test-results', 'guild-desktop.png'),
      fullPage: true,
      scale: 'css',
      animations: 'disabled',
    });
  } finally {
    await app.close();
  }
});

test('remembered bridge source recovers after restart and runtime changes without following a conflicting source', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'guild-reconnect-'));
  let app: ElectronApplication | undefined;
  const emit = (producer: string, extra: Partial<BridgePacket> = {}) =>
    send(
      {
        schema: 1,
        id: crypto.randomUUID(),
        producer,
        sourceId: 'private-runtime',
        harness: 'opencode',
        sessionId: 'ses_remembered',
        title: 'Remembered fixture',
        project: 'fixture',
        time: Date.now(),
        type: 'turn-start',
        ...extra,
      },
      join(directory, 'activity.sock'),
    );
  try {
    app = await launchGuild({ AGENT_GUILD_DATA_DIR: directory });
    let overlay = await overlayWindow(app);
    expect(app.windows()).toHaveLength(1);
    expect(await emit('runtime-1')).toBe(true);
    let panel = await panelWindow(app);
    await panel.getByRole('button', { name: 'Settings', exact: true }).click();
    await panel.getByRole('button', { name: 'Find local sessions' }).click();
    await panel
      .getByLabel('Choose a session')
      .selectOption({ label: '● Remembered fixture · fixture · opencode plugin · runtime-1' });
    await panel.getByRole('button', { name: 'Follow this session' }).click();
    await expect(panel.getByText('Remembered: Remembered fixture')).toBeVisible();
    const saved = JSON.parse(await readFile(join(directory, 'connection.json'), 'utf8'));
    expect(saved).toEqual({
      schema: 1,
      selection: {
        transport: 'bridge',
        harness: 'opencode',
        sessionId: 'ses_remembered',
        sourceId: 'private-runtime',
        title: 'Remembered fixture',
      },
    });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((window) => window.webContents.getURL().includes('surface=panel'))!
        .close(),
    );
    await expect.poll(() => app!.windows().length).toBe(1);
    await emit('runtime-1', { type: 'tool-start', toolId: 'read-1', toolName: 'read' });
    await expect
      .poll(() => overlay.evaluate(async () => (await window.guild!.state()).activity.kind))
      .toBe('reading');
    await app.close();
    app = undefined;

    app = await launchGuild({ AGENT_GUILD_DATA_DIR: directory });
    overlay = await overlayWindow(app);
    expect(app.windows()).toHaveLength(1);
    expect((await overlay.evaluate(() => window.guild!.state())).activity).toMatchObject({
      mode: 'live',
      connection: 'connecting',
      kind: 'unknown',
      sessionId: 'ses_remembered',
      events: [],
    });
    await emit('other-harness', { harness: 'codex' });
    await emit('shared-service', { sourceId: 'shared-runtime' });
    await emit('other-session', { sessionId: 'ses_another' });
    expect((await overlay.evaluate(() => window.guild!.state())).activity.connection).toBe(
      'connecting',
    );
    await emit('runtime-2', {
      type: 'snapshot',
      running: true,
      tools: [{ id: 'patch-1', name: 'patch' }],
    });
    await expect
      .poll(() => overlay.evaluate(async () => (await window.guild!.state()).activity.kind))
      .toBe('editing');
    expect((await overlay.evaluate(() => window.guild!.state())).activity.source?.label).toContain(
      'runtime-2',
    );

    // Identical stable identities with two live producers require a fresh explicit choice.
    await emit('runtime-3');
    expect((await overlay.evaluate(() => window.guild!.state())).activity).toMatchObject({
      connection: 'disconnected',
      kind: 'unknown',
      label: 'Multiple matching runtimes · choose a source in Settings',
    });
    panel = await panelWindow(app);
    await panel.getByRole('button', { name: 'Settings', exact: true }).click();
    await panel.getByRole('button', { name: 'Find local sessions' }).click();
    await panel
      .getByLabel('Choose a session')
      .selectOption({ label: '● Remembered fixture · fixture · opencode plugin · runtime-2' });
    await panel.getByRole('button', { name: 'Follow this session' }).click();
    await emit('runtime-3', { type: 'tool-start', toolId: 'shell-3', toolName: 'shell' });
    expect((await overlay.evaluate(() => window.guild!.state())).activity.source?.label).toContain(
      'runtime-2',
    );
    await emit('runtime-2', { type: 'session-end' });
    await expect
      .poll(() =>
        overlay.evaluate(async () => (await window.guild!.state()).activity.source?.label),
      )
      .toContain('runtime-3');
    const state = await overlay.evaluate(() => window.guild!.state());
    expect(state.activity).toMatchObject({ connection: 'connected', kind: 'command' });
    expect(state.profile).toMatchObject({ xp: 0, completed: [], adventure: null });
    await panel.getByRole('button', { name: 'Use demo activity' }).click();
    await expect
      .poll(() => overlay.evaluate(async () => (await window.guild!.state()).activity.mode))
      .toBe('demo');
    expect(JSON.parse(await readFile(join(directory, 'connection.json'), 'utf8'))).toEqual({
      schema: 1,
      selection: null,
    });
    await emit('runtime-3');
    expect((await overlay.evaluate(() => window.guild!.state())).activity.mode).toBe('demo');
    await app.close();
    app = undefined;
    app = await launchGuild({ AGENT_GUILD_DATA_DIR: directory });
    overlay = await overlayWindow(app);
    expect((await overlay.evaluate(() => window.guild!.state())).activity.mode).toBe('demo');
  } finally {
    if (app) await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('a missing remembered service session stays disconnected and retains its preference for retry', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'guild-service-'));
  const selection: ConnectionSelection = {
    transport: 'service',
    harness: 'opencode',
    sessionId: 'ses_nonexistent_guild_fixture',
    title: 'Unavailable saved session',
  };
  const path = join(directory, 'connection.json');
  await writeFile(path, JSON.stringify({ schema: 1, selection }));
  const app = await launchGuild({ AGENT_GUILD_DATA_DIR: directory });
  try {
    const overlay = await overlayWindow(app);
    await expect
      .poll(() => overlay.evaluate(async () => (await window.guild!.state()).activity.connection), {
        timeout: 20000,
      })
      .toBe('disconnected');
    const state = await overlay.evaluate(() => window.guild!.state());
    expect(state.activity).toMatchObject({
      mode: 'live',
      kind: 'unknown',
      sessionId: selection.sessionId,
    });
    expect(state.savedConnection).toEqual(selection);
    expect(JSON.parse(await readFile(path, 'utf8')).selection).toEqual(selection);
    const panel = await panelWindow(app);
    await panel.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(panel.getByText('Disconnected · OpenCode')).toBeVisible();
    await expect(panel.getByText('Remembered: Unavailable saved session')).toBeVisible();
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('native overlay is transparent, unfocusable, movable, and can be hidden and restored', async () => {
  const app = await launchGuild();
  try {
    const panel = await panelWindow(app);
    await expect(
      panel.getByRole('heading', { name: 'Little Wanderer', exact: true }),
    ).toBeVisible();
    await expect.poll(() => app.windows().length).toBe(2);
    const native = await app.evaluate(({ BrowserWindow }) => {
      const overlay = BrowserWindow.getAllWindows().find((window) =>
        window.webContents.getURL().includes('surface=overlay'),
      )!;
      return {
        alwaysOnTop: overlay.isAlwaysOnTop(),
        focusable: overlay.isFocusable(),
        background: overlay.getBackgroundColor(),
        bounds: overlay.getBounds(),
      };
    });
    expect(native.alwaysOnTop).toBe(true);
    expect(native.focusable).toBe(false);
    // Electron's background-color getter drops alpha; verify the actual rendered pixel.
    const alpha = await app.evaluate(async ({ BrowserWindow }) => {
      const overlay = BrowserWindow.getAllWindows().find((window) =>
        window.webContents.getURL().includes('surface=overlay'),
      )!;
      const image = await overlay.webContents.capturePage({ x: 0, y: 0, width: 1, height: 1 });
      return image.toBitmap()[3];
    });
    expect(alpha).toBe(0);
    await panel.getByRole('button', { name: 'Settings', exact: true }).click();
    await panel.getByRole('button', { name: 'Hide companion', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Show companion', exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Show companion', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Hide companion', exact: true })).toBeVisible();
    const overlay = app.windows().find((window) => window.url().includes('surface=overlay'))!;
    await overlay.evaluate(() => window.guild!.moveOverlay(-100, -20));
    await expect
      .poll(async () => {
        const bounds = await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((window) => window.webContents.getURL().includes('surface=overlay'))!
            .getBounds(),
        );
        return bounds.x;
      })
      .toBe(native.bounds.x - 100);
    await panel.getByRole('button', { name: 'Reset desktop position' }).click();
    await expect
      .poll(async () =>
        app.evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()
              .find((window) => window.webContents.getURL().includes('surface=overlay'))!
              .getBounds().x,
        ),
      )
      .toBe(native.bounds.x);
    await overlay.screenshot({
      path: join('test-results', 'guild-overlay.png'),
      omitBackground: true,
    });
  } finally {
    await app.close();
  }
});
