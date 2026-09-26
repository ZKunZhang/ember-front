import { test, expect } from '@playwright/test';

test('archive filters and search preserve deployment choices', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('combobox', { name: '断脊山隘难度' }).selectOption('hard');
  await page.getByRole('combobox', { name: '断脊山隘我方组合' }).selectOption('artillery');
  await page.getByRole('button', { name: '战史行动' }).click();
  await expect(page.locator('.scenario-card')).toHaveCount(3);
  await expect(page.getByRole('button', { name: '战史行动' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('searchbox', { name: '搜索战区' }).fill('不存在的战区');
  await expect(page.getByRole('status')).toContainText('未找到匹配的战区');
  await page.getByRole('button', { name: '重置筛选' }).click();
  await expect(page.locator('.scenario-card')).toHaveCount(9);
  await expect(page.getByRole('combobox', { name: '断脊山隘难度' })).toHaveValue('hard');
  await page.getByRole('searchbox', { name: '搜索战区' }).fill('断脊');
  await expect(page.locator('.scenario-card')).toHaveCount(1);
  await page.getByText('编队配置与战术情报').click();
  await expect(page.locator('.formation-summary')).toBeVisible();
  await page.getByTestId('deploy-mountain-pass').click();
  await expect(page.locator('.mission-head h1')).toContainText('困难 · 炮击编组');
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
  await expect(page.locator('.phase-readiness b')).toHaveText(['09', '09']);
  await expect(page.locator('button[data-unit="1"]')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('manual keeps content clicks open and supports keyboard dismissal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '作战指南', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '装甲联合作战' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('heading', { name: '选择车辆' }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: '作战指南', exact: true }).click();
  await page.getByRole('button', { name: '关闭作战手册' }).click();
  await expect(dialog).not.toBeVisible();
});

test('updated pages render without horizontal overflow at compact widths', async ({ page }) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('canvas.scenario-preview')).toHaveCount(10);
    await page.screenshot({ path: `test-results/archive-review-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByTestId('deploy-mountain-pass').click();
    await expect(page.locator('#map')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/battle-review-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '作战指南', exact: true }).click();
  await page.screenshot({ path: 'test-results/manual-review.png' });
});
