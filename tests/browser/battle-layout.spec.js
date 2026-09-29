import {test,expect} from '@playwright/test';

test('corner commands, centered progress and settings manage the battle',async({page})=>{
  await page.goto('/battle/twin-bridges?difficulty=simple&formation=armored');
  await expect(page.locator('.map-controls')).toHaveCount(0);
  const stats=await page.locator('.battle-status').boundingBox();
  const info=await page.locator('.command-hud').boundingBox();
  const undo=await page.locator('#undo').boundingBox();
  const end=await page.locator('#end-turn').boundingBox();
  expect(Math.abs(stats.x+stats.width/2-720)).toBeLessThan(2);
  expect(stats.y).toBeLessThan(250);
  expect(info.x).toBeGreaterThan(1100);expect(info.y).toBeLessThan(40);
  expect(undo.x).toBeLessThan(40);expect(undo.y).toBeGreaterThan(900);
  expect(end.x).toBeGreaterThan(undo.x+undo.width);expect(end.x).toBeLessThan(220);expect(end.y).toBeGreaterThan(900);
  expect(undo.width).toBe(undo.height);expect(end.width).toBe(end.height);
  await expect(page.locator('#undo')).toBeDisabled();
  await page.locator('#battle-settings').click();
  const dialog=page.getByRole('dialog',{name:'战斗设置'});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('heading').click();await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  await page.locator('#end-turn').click();
  await expect(page.locator('#round')).toHaveText('02',{timeout:15000});
  await page.locator('#battle-settings').click();
  await dialog.getByRole('button',{name:'重新部署'}).click();
  await expect(dialog).not.toBeVisible();await expect(page.locator('#round')).toHaveText('01');
  await expect(page.locator('.mission-head')).toContainText('简单 · 装甲编组');
  await page.locator('#battle-settings').click();
  await dialog.getByRole('button',{name:'退出关卡'}).click();
  await expect(page).toHaveURL(/\/operations$/);
});

test('mobile keeps turn and undo commands visible outside unit details',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/battle/twin-bridges');
  for(const expanded of [true,false]){
    await page.locator('.command-toggle').click();
    await expect(page.locator('.command-toggle')).toHaveAttribute('aria-expanded',String(expanded));
    await expect(page.locator('#end-turn')).toBeInViewport();
    await expect(page.locator('#undo')).toBeInViewport();
  }
});

test('unit actions stay at bottom right and expose engineer repair and attack modes',async({page})=>{
  await page.goto('/battle/twin-bridges?formation=armored');
  const {selectMapUnit}=await import('./unit-selection.js');
  await selectMapUnit(page,5);
  const actions=page.getByRole('region',{name:'选中单位操作'});
  const bounds=await actions.boundingBox();
  expect(bounds.x).toBeGreaterThan(1100);expect(bounds.y).toBeGreaterThan(900);
  await expect(page.locator('.command-panels #repair-mode')).toHaveCount(0);
  await page.locator('#repair-mode').click();
  await expect(page.locator('#repair-mode')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.map-command-hint')).toContainText('维修模式');
  await page.locator('#attack-mode').click();
  await expect(page.locator('#attack-mode')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#repair-mode')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.map-command-hint')).toContainText('攻击模式');
  await selectMapUnit(page,1);
  await expect(page.locator('#repair-mode')).toHaveCount(0);
});
