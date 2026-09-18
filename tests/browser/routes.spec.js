import {test,expect} from '@playwright/test';

test('deployment has a reloadable URL with difficulty and formation',async({page})=>{
  await page.goto('/');
  await page.getByRole('combobox',{name:'林海走廊难度'}).selectOption('hard');
  await page.getByRole('combobox',{name:'林海走廊我方组合'}).selectOption('artillery');
  await page.getByTestId('deploy-forest-corridor').click();
  await expect(page).toHaveURL(/\/battle\/forest-corridor\?difficulty=hard&formation=artillery$/);
  await page.locator('#end-turn').click();
  await expect(page.locator('#round')).toHaveText('02');
  await page.reload();
  await expect(page.locator('#round')).toHaveText('01');
  await expect(page.locator('#undo')).toBeDisabled();
  await expect(page.locator('.mission-head h1')).toContainText('林海走廊');
  await expect(page.locator('.mission-head h1')).toContainText('困难 · 炮击编组');
  await page.locator('#choose-map').click();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page.locator('.mission-head h1')).toContainText('林海走廊');
  await page.goForward();
  await expect(page.locator('.scenario-card')).toHaveCount(9);
  await page.getByRole('button',{name:'返回当前战场 →'}).click();
  await expect(page).toHaveURL(/\/battle\/forest-corridor\?difficulty=hard&formation=artillery$/);
});

test('direct routes apply defaults and invalid routes recover to the library',async({page})=>{
  await page.goto('/battle/lake-crossroads?difficulty=bad&formation=toString');
  await expect(page.locator('.mission-head h1')).toContainText('环湖交锋');
  await expect(page.locator('.mission-head h1')).toContainText('简单 · 炮击编组');
  await expect(page).toHaveURL(/difficulty=simple&formation=artillery$/);
  await page.goto('/battle/unknown');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.scenario-card')).toHaveCount(9);
});
