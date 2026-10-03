import { test, expect } from '@playwright/test';
import { selectMapUnit } from './unit-selection.js';
import { SCENARIOS } from '../../src/game/scenarios.js';

async function moveScout(page) {
  const point = await page.evaluate(async () => {
    const { createState } = await import('/src/game/engine.js');
    const { createView, project } = await import('/src/rendering/projection.js');
    const r = document.querySelector('#map').getBoundingClientRect();
    return project(createView(createState(), r.width, r.height), 16.5, 3.5);
  });
  await page.locator('#map').click({ position: point });
}

async function victoryFixture(page, defeat = false) {
  await page.route('**/src/game/engine.js*', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/updateMission\(s\);\s*return s;/, `  updateMission(s);
  if (s.id === 'mountain-pass') {
    s.mission = null;
    const enemy = s.units.find(u => u.team === 'red');
    s.units = s.units.filter(u => u.team === 'blue' || u.id === enemy.id);
    Object.assign(enemy, { x: 16, y: 3, hp: 1 });
    if (${defeat}) {
      s.units = [s.units[0], enemy];
      s.units[0].hp = 1;
      enemy.hp = enemy.maxHp;
    }
    updateFog(s);
  }
  return s;`);
    await route.fulfill({ response, body });
  });
}

test('audio unlocks on interaction, obeys mute, and remembers volume after reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.soundStarts = [];
    window.soundContexts = [];
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor() { super(); window.soundContexts.push(this); }
      createOscillator() {
        const oscillator = super.createOscillator(), start = oscillator.start.bind(oscillator);
        oscillator.start = time => { window.soundStarts.push(time); start(time); };
        return oscillator;
      }
    };
  });
  await page.goto('/battle/mountain-pass');
  expect(await page.evaluate(() => window.soundContexts.length)).toBe(0);
  await page.locator('#battle-settings').click();
  await expect.poll(() => page.evaluate(() => window.soundContexts[0]?.state)).toBe('running');
  await page.locator('#sound-volume').focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('.sound-settings output')).toHaveText('30%');
  await page.getByRole('switch', { name: '战场音效' }).click();
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  const mutedCount = await page.evaluate(() => window.soundStarts.length);
  await page.getByRole('button', { name: '继续战斗' }).click();
  await page.locator('#attack-mode').click();
  expect(await page.evaluate(() => window.soundStarts.length)).toBe(mutedCount);
  await page.reload();
  await expect(page.getByRole('button', { name: '开启音效', exact: true })).toBeVisible();
  await page.keyboard.press('m');
  await expect(page.getByRole('button', { name: '静音', exact: true })).toBeVisible();
  await page.locator('#attack-mode').click();
  await expect.poll(() => page.evaluate(() => window.soundStarts.length)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#sound-volume')).toHaveValue('30');
  await page.screenshot({ path: 'test-results/sound-settings.png' });
  expect(errors).toEqual([]);
});

test('action feedback and undo remain readable with reduced motion and compact layouts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/battle/mountain-pass');
    await expect(page.locator('.battle-feedback')).toContainText('部队已就位');
    await moveScout(page);
    await expect(page.locator('.battle-feedback')).toContainText('移动完成');
    await expect(page.locator('.feedback-message')).toHaveCSS('animation-name', 'none');
    await page.locator('#undo').click();
    await expect(page.locator('.battle-feedback')).toContainText('已撤回上一步');
    await expect(page.locator('#move-mode')).toContainText('移动');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/feedback-${width}.png` });
  }
});

test('guide pauses enemy commands until it closes', async ({ page }) => {
  await page.goto('/battle/mountain-pass');
  await page.locator('#end-turn').click();
  await page.locator('#battle-settings').click();
  await page.locator('#help').click();
  const phase = await page.locator('.turn-phase').textContent();
  await page.waitForTimeout(1300);
  await expect(page.locator('.turn-phase')).toHaveText(phase);
  await page.keyboard.press('Escape');
  await expect(page.locator('#round')).toHaveText('02', { timeout: 15000 });
});

test('victory records persist by difficulty, result supports undo and the next battle', async ({ page }) => {
  await victoryFixture(page);
  await page.goto('/battle/mountain-pass?difficulty=hard');
  await selectMapUnit(page, 10, { x: 16, y: 3 });
  const result = page.getByRole('dialog', { name: '战区已肃清' });
  await expect(result).toBeVisible();
  await expect(result.getByLabel('本场战报')).toContainText('存活车辆');
  await result.getByRole('button', { name: '撤回最后一步', exact: false }).click();
  await expect(result).toHaveCount(0);
  await expect(page.locator('#attack-mode')).toBeEnabled();
  await selectMapUnit(page, 10, { x: 16, y: 3 });
  await expect(result).toBeVisible();
  await page.screenshot({ path: 'test-results/victory-desktop.png' });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.screenshot({ path: 'test-results/victory-mobile.png' });
  const dialogBox = await result.boundingBox();
  expect(dialogBox.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(320);
  const next = SCENARIOS[SCENARIOS.findIndex(s => s.id === 'mountain-pass') + 1];
  await result.getByRole('button', { name: `下一关：${next.name}`, exact: false }).click();
  await expect(page).toHaveURL(new RegExp(`battle/${next.id}\\?difficulty=hard`));
  await expect(page.locator('.mission-head')).toContainText('困难');
  await expect(page.locator('#round')).toHaveText('01');
  await page.goto('/operations');
  const node = page.getByTestId('deploy-mountain-pass');
  await expect(node).not.toHaveClass(/is-completed/);
  await page.getByRole('combobox', { name: '作战难度' }).selectOption('hard');
  await expect(node).toHaveClass(/is-completed/);
  await expect(page.locator('.campaign-record')).toContainText('最佳 1 回合');
  await page.reload();
  await page.getByRole('combobox', { name: '作战难度' }).selectOption('hard');
  await expect(node).toHaveClass(/is-completed/);
});

test('defeat opens a mobile result modal with redeploy and exit to the main menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await victoryFixture(page, true);
  await page.goto('/battle/mountain-pass');
  await page.locator('#end-turn').click();
  const result = page.getByRole('dialog', { name: '行动失败' });
  await expect(result).toBeVisible();
  await expect(result.getByRole('button', { name: /下一关/ })).toHaveCount(0);
  await expect(result.getByRole('button', { name: '退出游戏', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'test-results/defeat-mobile.png' });
  await result.getByRole('button', { name: '重新部署', exact: true }).click();
  await expect(result).toHaveCount(0);
  await expect(page.locator('#round')).toHaveText('01');
  await expect(page.locator('#end-turn')).toBeEnabled();
  await page.locator('#end-turn').click();
  await expect(result).toBeVisible();
  await result.getByRole('button', { name: '退出游戏', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5173/');
  await expect(page.getByRole('button', { name: '开始游戏' })).toBeVisible();
  await page.getByRole('button', { name: '开始游戏' }).click();
  await expect(page.getByRole('button', { name: '返回当前战场' })).toHaveCount(0);
});

test('unavailable audio and storage do not prevent deployment or commands', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage disabled'); } });
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
  });
  await page.goto('/operations');
  await page.getByTestId('deploy-mountain-pass').click();
  await moveScout(page);
  await expect(page.locator('#move-mode')).toContainText('已移动');
  await page.locator('#undo').click();
  await expect(page.locator('#move-mode')).toBeEnabled();
  expect(errors).toEqual([]);
});
