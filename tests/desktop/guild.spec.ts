import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

async function panelWindow(app: ElectronApplication) {
  await expect
    .poll(() => app.windows().some((window) => window.url().includes('surface=panel')))
    .toBe(true);
  return app.windows().find((window) => window.url().includes('surface=panel'))!;
}

test('overlay controls open the requested page and support an actual pointer drag', async () => {
  const app = await electron.launch({
    executablePath: process.env.AGENT_GUILD_EXECUTABLE,
    args: process.env.AGENT_GUILD_EXECUTABLE ? [] : ['.'],
    env: { ...process.env, AGENT_GUILD_SMOKE: '1' },
  });
  try {
    const panel = await panelWindow(app);
    await expect(
      panel.getByRole('heading', { name: 'A little company while you create.' }),
    ).toBeVisible();
    await expect
      .poll(() => app.windows().some((window) => window.url().includes('surface=overlay')))
      .toBe(true);
    const overlay = app.windows().find((window) => window.url().includes('surface=overlay'))!;
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
      panel.getByRole('heading', { name: 'A little company while you create.' }),
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
  const app = await electron.launch({
    executablePath: process.env.AGENT_GUILD_EXECUTABLE,
    args: process.env.AGENT_GUILD_EXECUTABLE ? [] : ['.'],
    env: { ...process.env, AGENT_GUILD_SMOKE: '1' },
  });
  try {
    const panel = await panelWindow(app);
    await expect(
      panel.getByRole('heading', { name: 'A little company while you create.' }),
    ).toBeVisible();
    await panel.getByRole('button', { name: 'Adventures', exact: true }).click();
    await panel.getByRole('button', { name: /The lantern meadow/ }).click();
    await panel.getByRole('button', { name: 'I remember the trail' }).click();
    await panel.getByRole('button', { name: 'leaf', exact: true }).click();
    await panel.reload();
    await panel.getByRole('button', { name: 'Adventures', exact: true }).click();
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
    await panel.screenshot({ path: join('test-results', 'guild-desktop.png'), fullPage: true });
  } finally {
    await app.close();
  }
});

test('native overlay is transparent, unfocusable, movable, and can be hidden and restored', async () => {
  const app = await electron.launch({
    executablePath: process.env.AGENT_GUILD_EXECUTABLE,
    args: process.env.AGENT_GUILD_EXECUTABLE ? [] : ['.'],
    env: { ...process.env, AGENT_GUILD_SMOKE: '1' },
  });
  try {
    const panel = await panelWindow(app);
    await expect(
      panel.getByRole('heading', { name: 'A little company while you create.' }),
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
