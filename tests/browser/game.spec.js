import { test, expect } from '@playwright/test';

test('three maps, nine vehicles, canvas movement, engine info and turn lifecycle', async ({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.scenario-card')).toHaveCount(3);
  await expect(page.locator('.vehicle-catalog>div')).toHaveCount(6);
  await page.screenshot({path:'test-results/library.png',fullPage:true});
  await page.getByTestId('deploy-mountain-pass').click();
  await expect(page.locator('.squad-row')).toHaveCount(9);
  await expect(page.locator('#kill-count')).toHaveText('00 / 14');
  await expect(page.locator('.unit-name')).toContainText('侦察车');
  const coords=await page.evaluate(async()=>{
    const {createState}=await import('/src/game/engine.js');
    const {createView,project}=await import('/src/rendering/projection.js');
    const r=document.querySelector('#map').getBoundingClientRect();
    const v=createView(createState('mountain-pass'),r.width,r.height);
    const p=project(v,16.5,3.5);
    return {x:r.left+p.x,y:r.top+p.y};
  });
  await page.mouse.click(coords.x,coords.y);
  await expect(page.locator('#move-mode')).toHaveText('✓ 已移动');
  await page.locator('[data-unit="6"]').click();
  await expect(page.locator('#repair-mode')).toBeVisible();
  await page.locator('#repair-mode').click();
  await expect(page.locator('.map-command-hint')).toContainText('维修模式');
  await page.screenshot({path:'test-results/battle-desktop.png',fullPage:true});
  await page.locator('#end-turn').click();
  await expect(page.locator('#end-turn')).toBeDisabled();
  await expect(page.locator('#round')).toHaveText('02',{timeout:15000});
  await expect(page.locator('#end-turn')).toBeEnabled();
  await page.locator('#end-turn').click();
  await page.locator('#choose-map').click();
  await page.getByTestId('deploy-twin-bridges').click();
  await expect(page.locator('#kill-count')).toHaveText('00 / 18');
  await page.waitForTimeout(4500);
  await expect(page.locator('#round')).toHaveText('01');
  await expect(page.locator('#end-turn')).toBeEnabled();
  await page.locator('#choose-map').click();
  await page.getByTestId('deploy-diagonal-valley').click();
  await expect(page.locator('#kill-count')).toHaveText('00 / 16');
  await page.locator('#help').click();
  await expect(page.locator('#help-dialog')).toBeVisible();
  await expect(page.locator('.manual-units>div')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile library and battlefield remain within viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/library-mobile.png',fullPage:true});
  await page.getByTestId('deploy-twin-bridges').click();
  await expect(page.locator('.squad-row')).toHaveCount(9);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/battle-mobile.png',fullPage:true});
});
