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
  await expect(page.locator('#repair-mode')).toHaveText('取消维修');
  await page.locator('#repair-mode').click();
  await expect(page.locator('.map-command-hint')).toContainText('移动模式');
  await page.locator('[data-unit="1"]').click();
  await expect(page.locator('.unit-name')).toContainText('侦察车');
  await expect(page.locator('#attack-mode')).toHaveClass('active');
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

test('visible enemy click shows intel without firing, attack mode still fires at that target',async({page})=>{
  // Place one enemy in initial sight so this test does not depend on AI movement.
  await page.route('**/src/game/scenarios.js',async route=>{
    const response=await route.fetch();
    const body=(await response.text()).replace(/const RED_SOUTH\s*=\s*\[\s*\[\s*7\s*,\s*14\s*\]/,'const RED_SOUTH = [[16,3]');
    await route.fulfill({response,body});
  });
  await page.goto('/');await page.getByTestId('deploy-mountain-pass').click();
  const point=await page.evaluate(async()=>{
    const {createState}=await import('/src/game/engine.js');
    const {createView,project}=await import('/src/rendering/projection.js');
    const s=createState(),enemy=s.units.find(u=>u.team==='red');
    if(enemy.x!==16||enemy.y!==3)throw new Error('Enemy inspection fixture was not applied');
    const r=document.querySelector('#map').getBoundingClientRect();
    const p=project(createView(s,r.width,r.height),enemy.x+.5,enemy.y+.5,17);
    return {x:r.left+p.x,y:r.top+p.y,hp:enemy.hp};
  });
  await page.mouse.click(point.x,point.y);
  const intel=page.locator('#enemy-intel');
  await expect(intel).toBeVisible();
  await expect(intel).toContainText('敌方');
  await expect(intel).toContainText(`${point.hp} / ${point.hp}`);
  await expect(intel.locator('.unit-stats>div')).toHaveCount(5);
  await expect(intel.locator('button')).toHaveCount(0);
  await expect(page.locator('[data-unit="1"]')).toHaveClass(/active/);
  await expect(page.locator('#attack-mode')).toBeEnabled();
  await expect(page.locator('#move-mode')).toHaveClass('active');
  await page.locator('#attack-mode').click();
  await page.mouse.click(point.x,point.y);
  await expect(page.locator('#attack-mode')).toBeDisabled();
  await expect(intel).toContainText(`${point.hp-3} / ${point.hp}`);
  await page.locator('[data-unit="2"]').click();
  await expect(intel).toHaveCount(0);
});
