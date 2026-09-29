import { test, expect } from '@playwright/test';

test('campaign filters and search preserve deployment choices', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/operations');
  await page.getByRole('combobox',{name:'作战难度'}).selectOption('hard');
  await page.getByRole('combobox',{name:'我方组合'}).selectOption('artillery');
  await page.getByRole('button',{name:'战史行动',exact:true}).click();
  await expect(page.locator('.campaign-node')).toHaveCount(3);
  await expect(page.getByRole('button',{name:'战史行动',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('searchbox',{name:'搜索战区'}).fill('不存在的战区');
  await expect(page.getByRole('status')).toContainText('未找到匹配的战区');
  await page.getByRole('button',{name:'重置筛选'}).click();
  await expect(page.locator('.campaign-node')).toHaveCount(12);
  await expect(page.getByRole('combobox',{name:'作战难度'})).toHaveValue('hard');
  await page.getByRole('searchbox',{name:'搜索战区'}).fill('断脊');
  await expect(page.locator('.campaign-node')).toHaveCount(1);
  await page.getByTestId('deploy-mountain-pass').focus();
  await expect(page.locator('.campaign-intel h2')).toHaveText('断脊山隘');
  await page.keyboard.press('Enter');
  await expect(page.locator('.mission-head h1')).toContainText('困难 · 炮击编组');
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
  await expect(page.locator('.phase-readiness b')).toHaveText(['09','09']);
  expect(errors).toEqual([]);
});

test('manual keeps content clicks open and supports keyboard dismissal', async ({ page }) => {
  await page.goto('/battle/mountain-pass');
  await page.locator('#battle-settings').click();await page.getByRole('button', { name: '作战指南', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '装甲联合作战' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('heading', { name: '选择车辆' }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.locator('#battle-settings').click();await page.getByRole('button', { name: '作战指南', exact: true }).click();
  await page.getByRole('button', { name: '关闭作战手册' }).click();
  await expect(dialog).not.toBeVisible();
});

test('updated pages render without horizontal overflow at compact widths', async ({ page }) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/operations');
    await expect(page.locator('canvas.scenario-preview')).toHaveCount(1);
    await page.screenshot({ path: `test-results/archive-review-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByTestId('deploy-mountain-pass').click();
    await expect(page.locator('#map')).toBeVisible();
    const canvas = await page.locator('#map').boundingBox();
    expect(canvas).toEqual({ x: 0, y: 0, width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    if (width <= 760) {
      await page.locator('.command-toggle').click();
      await expect(page.locator('#end-turn')).toBeVisible();
      await page.locator('.command-toggle').click();
      await expect(page.locator('#end-turn')).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/battle-review-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#battle-settings').click();await page.getByRole('button', { name: '作战指南', exact: true }).click();
  await page.screenshot({ path: 'test-results/manual-review.png' });
});
