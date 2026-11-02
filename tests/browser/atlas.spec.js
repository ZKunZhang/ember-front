import { test, expect } from '@playwright/test';

test('mission briefing keeps its toggle reachable across repeated open and close',async({page})=>{
  for(const viewport of [{width:1440,height:960},{width:390,height:844},{width:667,height:375}]){
    await page.setViewportSize(viewport);
    await page.goto('/battle/long-road-contact');
    const details=page.locator('.mission-intel'),summary=details.locator(':scope > summary');
    const initial=await summary.boundingBox();
    for(let attempt=0;attempt<3;attempt++){
      await summary.click();
      await expect(details).toHaveAttribute('open','');
      const expanded=await summary.boundingBox();
      expect(expanded.x).toBeCloseTo(initial.x,1);
      expect(expanded.y).toBeCloseTo(initial.y,1);
      // Click the left part too: this previously landed on the camera control.
      await summary.click({position:{x:12,y:expanded.height/2}});
      await expect(details).not.toHaveAttribute('open','');
    }
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open','');
    await page.keyboard.press('Enter');
    await expect(details).not.toHaveAttribute('open','');
  }
});

async function battleSnapshot(page) {
  return page.evaluate(() => ({
    unit: document.querySelector('.unit-panel').textContent,
    selected: document.querySelector('.unit-panel').dataset.unit,
    round: document.querySelector('#round').textContent,
    log: document.querySelector('#log').textContent,
    undo: document.querySelector('#undo').disabled,
    mode: document.querySelector('.unit-action-buttons').textContent,
  }));
}

test('settings occupy the top right and remain separate from audio', async ({ page }) => {
  for (const viewport of [{width:1440,height:960},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await page.goto('/battle/mountain-pass');
    const settings=await page.locator('#battle-settings').boundingBox();
    const audio=await page.locator('.sound-toggle').boundingBox();
    expect(settings.x+settings.width).toBeGreaterThan(viewport.width-30);
    expect(settings.y).toBeLessThan(30);
    expect(audio.x+audio.width).toBeLessThan(settings.x);
    const stats=await page.locator('.battle-status').boundingBox();
    expect(stats.x).toBeGreaterThanOrEqual(0);
    expect(stats.x+stats.width).toBeLessThanOrEqual(viewport.width);
    await page.locator('#battle-settings').click();
    await expect(page.getByRole('dialog',{name:'战斗设置'})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog',{name:'战斗设置'})).not.toBeVisible();
  }
});

test('grid and tactical-map navigation only change the view', async ({ page }) => {
  await page.goto('/battle/mountain-pass');
  const map=page.locator('#map'),before=await battleSnapshot(page);
  await page.locator('.sandtable-controls summary').click();
  const grid=page.getByRole('button',{name:'显示六角网格'});
  await grid.click();
  await expect(map).toHaveAttribute('data-grid-visible','true');
  await page.getByRole('button',{name:'向右旋转沙盘',exact:true}).click();
  await expect.poll(()=>map.getAttribute('data-camera-rotation')).not.toBe('0');
  await page.getByRole('button',{name:'放大沙盘',exact:true}).click();
  await expect(map).toHaveAttribute('data-camera-zoom','1.15');
  await expect(map).toHaveAttribute('data-grid-visible','true');
  const target=await page.evaluate(async()=>{
    const {createState}=await import('/src/game/engine.js');
    const {createTacticalView}=await import('/src/rendering/tactical-map.js');
    const {project}=await import('/src/rendering/projection.js');
    const game=createState('mountain-pass');
    const point=game.mission.points.at(-1);
    return project(createTacticalView(game),point.x+.5,point.y+.5);
  });
  const mini=page.getByLabel('战术地图，点击地格定位');
  const box=await mini.boundingBox();
  await mini.click({position:{x:target.x*box.width/208,y:target.y*box.height/128}});
  await expect.poll(()=>map.getAttribute('data-camera-pan-x')).not.toBe('0');
  expect(await battleSnapshot(page)).toEqual(before);
  await page.getByRole('button',{name:'定位选中单位'}).click();
  expect(await battleSnapshot(page)).toEqual(before);
  await page.getByRole('button',{name:'隐藏六角网格'}).click();
  await expect(map).toHaveAttribute('data-grid-visible','false');
});

test('ordinary missions expose roster, readiness and camera-only unit location', async ({ page }) => {
  await page.goto('/battle/mountain-pass');
  await page.locator('.unit-roster summary').click();
  const button=page.getByRole('button',{name:/选择我方02号/});
  await button.click();
  await expect(page.locator('.unit-panel')).toHaveAttribute('data-unit','2');
  await expect(page.getByLabel('本车行动机会')).toContainText('可移动 1 次');
  const before=await battleSnapshot(page);
  await page.getByRole('button',{name:'⌖ 定位本车'}).click();
  await expect.poll(()=>page.locator('#map').getAttribute('data-camera-pan-x')).not.toBe('0');
  expect(await battleSnapshot(page)).toEqual(before);
});

test('phone map and unit panels expand with accessible turn controls',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/battle/mountain-pass');
  await expect(page.locator('.tactical-map')).not.toHaveAttribute('open','');
  await page.locator('.tactical-map summary').click();
  await expect(page.getByLabel('战术地图，点击地格定位')).toBeInViewport();
  await page.locator('.command-toggle').click();
  await expect(page.locator('.tactical-map')).not.toHaveAttribute('open','');
  await expect(page.getByRole('button',{name:'⌖ 定位本车'})).toBeVisible();
  await page.getByRole('button',{name:'⌖ 定位本车'}).click({trial:true});
  await page.locator('.tactical-map summary').click();
  await expect(page.locator('.command-toggle')).toHaveAttribute('aria-expanded','false');
  await page.getByRole('button',{name:'定位选中单位'}).click({trial:true});
  for(const selector of ['#end-turn','#undo','#battle-settings']){
    await expect(page.locator(selector)).toBeInViewport();
    await page.locator(selector).click({trial:true,force:selector==='#undo'});
  }
  await page.screenshot({path:'/tmp/ember-mobile-panels.png'});
});
