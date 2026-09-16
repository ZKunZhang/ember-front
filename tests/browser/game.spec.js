import { test, expect } from '@playwright/test';

test('three maps, nine vehicles, canvas movement, engine info and turn lifecycle', async ({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.scenario-card')).toHaveCount(3);
  await expect(page.locator('.vehicle-catalog>div')).toHaveCount(6);
  await page.screenshot({path:'test-results/library.png',fullPage:true});
  await page.getByTestId('deploy-mountain-pass').click();
  await expect(page.locator('.squad-row')).toHaveCount(9);
  await expect(page.locator('#kill-count')).toHaveText('00 / 7');
  await expect(page.locator('.unit-name')).toContainText('侦察车');
  await page.screenshot({path:'test-results/range-contours.png',fullPage:true});
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
  await expect(page.locator('.map-command-hint')).toContainText('点击蓝格移动');
  await page.locator('[data-unit="1"]').click();
  await expect(page.locator('.unit-name')).toContainText('侦察车');
  await expect(page.locator('#attack-mode')).toHaveCount(0);
  await page.screenshot({path:'test-results/battle-desktop.png',fullPage:true});
  await page.locator('#end-turn').click();
  await expect(page.locator('#end-turn')).toBeDisabled();
  await expect(page.locator('#round')).toHaveText('02',{timeout:15000});
  await expect(page.locator('#end-turn')).toBeEnabled();
  await page.locator('#end-turn').click();
  await page.locator('#choose-map').click();
  await page.getByTestId('deploy-twin-bridges').click();
  await expect(page.locator('#kill-count')).toHaveText('00 / 9');
  await page.waitForTimeout(4500);
  await expect(page.locator('#round')).toHaveText('01');
  await expect(page.locator('#end-turn')).toBeEnabled();
  await page.locator('#choose-map').click();
  await page.getByTestId('deploy-diagonal-valley').click();
  await expect(page.locator('#kill-count')).toHaveText('00 / 8');
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

test('visible enemy click fires directly and shows intel without a mode switch',async({page})=>{
  // Place one enemy in initial sight so this test does not depend on AI movement.
  await page.route('**/src/game/scenarios.js*',async route=>{
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
  await expect(intel).toContainText(`${point.hp-3} / ${point.hp}`);
  await expect(intel.locator('.unit-stats>div')).toHaveCount(5);
  await expect(intel.locator('button')).toHaveCount(0);
  await expect(page.locator('[data-unit="1"]')).toHaveClass(/active/);
  await expect(page.locator('#attack-mode')).toHaveCount(0);
  await expect(page.locator('#attack-status')).toHaveText('✓ 已行动');
  await page.mouse.click(point.x,point.y);
  await expect(intel).toContainText(`${point.hp-3} / ${point.hp}`);
  await page.screenshot({path:'test-results/ranges-and-intel.png',fullPage:true});
  await page.locator('[data-unit="2"]').click();
  await expect(intel).toHaveCount(0);
});

test('each mission offers three difficulties and redeployment keeps the chosen level',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('combobox')).toHaveCount(3);
  const level=page.getByRole('combobox',{name:'断脊山隘难度'});
  await expect(level).toHaveValue('simple');
  await expect(level.locator('option')).toHaveText(['简单','容易','困难']);
  await level.selectOption('easy');
  await page.getByTestId('deploy-mountain-pass').click();
  await expect(page.locator('#kill-count')).toHaveText('00 / 11');
  await expect(page.locator('.mission-head h1')).toContainText('容易');
  await page.locator('#reset').click();
  await expect(page.locator('#kill-count')).toHaveText('00 / 11');
  await page.locator('#choose-map').click();
  await page.getByRole('combobox',{name:'断脊山隘难度'}).selectOption('hard');
  await page.getByTestId('deploy-mountain-pass').click();
  await expect(page.locator('#kill-count')).toHaveText('00 / 14');
  await expect(page.locator('.mission-head h1')).toContainText('困难');
});

for(const gesture of ['drag','trackpad','buttons','touch'])test(`map pans with ${gesture} and preserves cell hit testing`,async({page})=>{
  await page.goto('/');await page.getByTestId('deploy-mountain-pass').click();
  const map=page.locator('#map'),r=await map.boundingBox();
  const start={x:r.x+r.width/2,y:r.y+100};
  let dx=100;
  if(gesture==='drag'){
    await page.mouse.move(start.x,start.y);await page.mouse.down();
    await page.mouse.move(start.x+dx,start.y,{steps:8});await page.mouse.up();
  }else if(gesture==='trackpad'){
    await page.mouse.move(start.x,start.y);await page.mouse.wheel(-dx,0);
  }else if(gesture==='buttons'){
    dx=120;await page.getByRole('button',{name:'向右平移',exact:true}).click();
  }else{
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
    for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+dx*i/8,y:start.y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  }
  await expect(page.locator('#move-mode')).toHaveText('◇ 移动');
  const destination=await page.evaluate(async dx=>{
    const {createState}=await import('/src/game/engine.js');
    const {createView,project}=await import('/src/rendering/projection.js');
    const r=document.querySelector('#map').getBoundingClientRect();
    const p=project(createView(createState(),r.width,r.height,1,{x:dx,y:0}),16.5,3.5);
    return{x:r.left+p.x,y:r.top+p.y};
  },dx);
  await page.mouse.move(destination.x,destination.y);
  await expect(page.locator('.coordinates')).toHaveText('GRID 17 : 4');
  await page.mouse.click(destination.x,destination.y);
  await expect(page.locator('#move-mode')).toHaveText('✓ 已移动');
  await page.getByTitle('重置视图').click();
});
