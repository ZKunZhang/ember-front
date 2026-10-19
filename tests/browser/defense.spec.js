import { test, expect } from '@playwright/test';

// Keep real movement, combat, fog, AI and mission resolution. Only deployments
// and terrain are fixed; the reducer wrapper exposes observations, not dispatch.
const deployment = `
  if(s.mission?.kind==='defend') {
    delete s.gridLayout;
    s.cols=12;s.rows=10;s.terrain=Array.from({length:10},()=>Array(12).fill(0));
    s.landmarks=[];s.features=[];s.aiSeed=123;
    s.mission={...s.mission,point:{x:8,y:4},points:[
      {x:8,y:4,label:'跑道一'},{x:9,y:4,label:'跑道二'},
      {x:8,y:5,label:'跑道三'},{x:9,y:5,label:'跑道四'},
      {x:8,y:6,label:'跑道五'},{x:9,y:6,label:'跑道六'}]};
    const blue=s.units.find(u=>u.team==='blue'),red=s.units.find(u=>u.team==='red');
    s.units=[{...blue,id:1,x:3,y:4,vision:4,move:3},
      {...blue,id:5,x:2,y:6,vision:3,move:3},
      {...red,id:9,x:11,y:9,move:0,attack:0,minRange:99,repair:0},
      {...red,id:10,x:11,y:8,move:0,attack:0,minRange:99,repair:0}];
    s.selectedId=1;
  }
`;

async function installFixture(page, extra = '') {
  let currentExtra = extra;
  await page.route('**/src/game/engine.js*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = /updateMission\(s\);\s*return s;/;
    expect(source).toMatch(marker);
    await route.fulfill({ response, body: source.replace(marker,
      `updateMission(s);\n${deployment}\n${currentExtra}\ns.deployments=s.units.map(u=>({...u}));updateFog(s);return s;`) });
  });
  await page.route('**/src/game/reducer.js*', async route => {
    const response = await route.fetch();
    const source = (await response.text())
      .replace('export function initialGame(', 'function fixtureInitialGame(')
      .replace('export function gameReducer(', 'function fixtureGameReducer(');
    await route.fulfill({ response, body: `${source}
      export function initialGame(...args) { return window.__defenseState=fixtureInitialGame(...args); }
      export function gameReducer(...args) { return window.__defenseState=fixtureGameReducer(...args); }
    ` });
  });
  return extra => { currentExtra = extra; };
}

const guide = page => page.locator('.defense-guide');
const meter = page => page.getByRole('progressbar', { name: '已完成的机场守备回合' });
const state = page => page.evaluate(() => {
  const s = window.__defenseState;
  return { selectedId:s.selectedId, mode:s.mode, units:s.units, turn:s.turn,
    winner:s.winner, defendedTurns:s.missionProgress.defendedTurns, undo:s.undoHistory.length };
});
const camera = page => page.locator('#map').evaluate(map => ({
  x:Number(map.dataset.cameraPanX),y:Number(map.dataset.cameraPanY),
  zoom:Number(map.dataset.cameraZoom),rotation:Number(map.dataset.cameraRotation),tilt:Number(map.dataset.cameraTilt),
}));

async function clickCell(page, x, y) {
  const point = await page.evaluate(async ({x,y}) => {
    const {createView,project}=await import('/src/rendering/projection.js');
    const map=document.querySelector('#map'),rect=map.getBoundingClientRect(),d=map.dataset;
    const view=createView(window.__defenseState,rect.width,rect.height,Number(d.cameraZoom),
      {x:Number(d.cameraPanX),y:Number(d.cameraPanY)},
      {rotation:Number(d.cameraRotation),tilt:Number(d.cameraTilt)});
    const p=project(view,x+.5,y+.5);
    return {x:rect.left+p.x,y:rect.top+p.y};
  }, {x,y});
  // A normal pointer click also detects a panel intercepting the battlefield.
  await page.mouse.click(point.x, point.y);
}

async function closeGuide(page) {
  await page.getByRole('button', {name:'开始守备 →',exact:true}).click();
  await expect(guide(page)).not.toHaveAttribute('open');
}

async function completeRound(page, completed) {
  await page.locator('#end-turn').click();
  await expect(meter(page)).toHaveAttribute('aria-valuenow',String(completed),{timeout:10000});
  if(completed<5) await expect(page.locator('#end-turn')).toBeEnabled();
}

test('direct and campaign entries explain the six-cell defense without promising safety', async ({page}) => {
  for(const entry of ['direct','campaign']) {
    if(entry==='direct') await page.goto('/battle/airfield-defense');
    else {
      await page.goto('/operations');
      await page.getByRole('button',{name:'地形与守备',exact:true}).click();
      await page.getByTestId('deploy-airfield-defense').click();
    }
    await expect(page.locator('.objective-progress')).toHaveText('机场守备 0 / 5 回合');
    await expect(guide(page)).toHaveAttribute('open','');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.locator('.defense-critical-rule')).toContainText('6 格跑道保护区');
    await expect(page.locator('.defense-critical-rule')).toContainText('任一敌车进入即失败；我方全灭也会失败');
    await expect(guide(page)).toContainText('歼灭全部敌军可提前获胜');
    await expect(page.locator('.defense-threat')).toContainText(/发现.*敌车|当前视野内未发现敌军/);
    await expect(page.locator('.defense-threat')).not.toContainText(/安全|无威胁/);
    await expect(page.locator('.defense-visibility')).toContainText('仅报告可见敌情');
    await closeGuide(page);
    await guide(page).locator('summary').click();
    await expect(guide(page)).toHaveAttribute('open','');
    // The onboarding is nonmodal: an actual command is usable while it is open.
    await page.locator('#attack-mode').click();
    await expect(page.locator('#attack-mode')).toHaveAttribute('aria-pressed','true');
    await expect(guide(page)).toHaveAttribute('open','');
  }
});

test('quick selection and rejected commands preserve onboarding; action, undo, reset and resume have distinct lifecycles', async ({page}) => {
  await installFixture(page);
  await page.goto('/battle/airfield-defense');
  const initial=await state(page);
  await page.locator('.unit-roster summary').click();
  await page.getByRole('button',{name:/选择我方05号/}).click();
  expect(await state(page)).toEqual({...initial,selectedId:5});
  await expect(page.locator('.unit-panel')).toHaveAttribute('data-unit','5');
  await expect(guide(page)).toHaveAttribute('open','');
  await page.locator('#attack-mode').click();
  await clickCell(page,3,6); // An empty cell is not an attack target.
  await expect(page.locator('.battle-feedback')).toContainText('请选择射程内可见的敌军');
  await expect(guide(page)).toHaveAttribute('open','');
  expect((await state(page)).undo).toBe(0);
  await page.locator('#move-mode').click();
  await clickCell(page,3,6);
  await expect(page.locator('.battle-feedback')).toContainText('移动完成');
  await expect(guide(page)).not.toHaveAttribute('open');
  expect((await state(page)).undo).toBe(1);
  await page.locator('#undo').click();
  await expect(guide(page)).not.toHaveAttribute('open');
  expect((await state(page)).units).toEqual(initial.units);
  await page.locator('#battle-settings').click();
  await page.getByRole('button',{name:'重新部署',exact:true}).click();
  await expect(guide(page)).toHaveAttribute('open','');
  await closeGuide(page);
  await page.locator('#battle-settings').click();
  await page.getByRole('button',{name:'退出关卡',exact:true}).click();
  await page.getByRole('button',{name:'返回当前战场 →',exact:true}).click();
  await expect(guide(page)).not.toHaveAttribute('open');
  await expect(meter(page)).toHaveAttribute('aria-valuenow','0');
});

test('runway and selected-unit location change only camera pan', async ({page}) => {
  await installFixture(page);
  await page.goto('/battle/airfield-defense');
  await closeGuide(page);
  const before=await state(page),start=await camera(page);
  await page.getByRole('button',{name:'定位跑道保护区'}).click();
  await expect.poll(async()=>({x:(await camera(page)).x,y:(await camera(page)).y})).not.toEqual({x:start.x,y:start.y});
  const runway=await camera(page);
  expect(await state(page)).toEqual(before);
  expect({...runway,x:start.x,y:start.y}).toEqual(start);
  await page.getByRole('button',{name:'⌖ 定位本车',exact:true}).click();
  await expect.poll(async()=>({x:(await camera(page)).x,y:(await camera(page)).y})).not.toEqual({x:runway.x,y:runway.y});
  const unit=await camera(page);
  expect({...unit,x:start.x,y:start.y}).toEqual(start);
  expect(await state(page)).toEqual(before);
});

test('only a complete enemy turn counts, undo restores it, and five complete rounds win', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await installFixture(page);
  await page.goto('/battle/airfield-defense');
  const initial=await state(page);
  await page.locator('#end-turn').click();
  await expect(guide(page)).not.toHaveAttribute('open');
  await expect(page.locator('#end-turn')).toBeDisabled();
  await expect(meter(page)).toHaveAttribute('aria-valuenow','0');
  await expect(meter(page)).toHaveAttribute('aria-valuenow','1',{timeout:10000});
  await expect(page.locator('#end-turn')).toBeEnabled();
  await page.locator('#undo').click();
  expect(await state(page)).toEqual(initial);
  await expect(guide(page)).not.toHaveAttribute('open');
  for(let round=1;round<=5;round++) await completeRound(page,round);
  const result=page.getByRole('dialog',{name:'任务目标达成'});
  await expect(result).toBeVisible();
  await expect(result).toContainText('已守过全部完整敌方回合');
  await expect(result).toContainText('实际守备 5 / 5 个完整敌方回合');
  expect((await state(page)).winner).toBe('blue');
  await expect(page.locator('.defense-segments .completed')).toHaveCount(5);
});

test('early elimination at zero or one round keeps real HUD and story progress', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  const changeFixture=await installFixture(page);
  for(const rounds of [0,1]) {
    changeFixture(`
      s.units=s.units.filter(u=>u.id!==10);
      Object.assign(s.units[0],{vision:20,attack:999,range:20,minRange:0,indirect:true});
      Object.assign(s.units.find(u=>u.team==='red'),{x:4,y:4,hp:1});
    `);
    await page.goto('/battle/airfield-defense');
    await closeGuide(page);
    if(rounds) {
      await completeRound(page,1);
      // Turn handoff clears selection; the player chooses a gun before firing.
      await page.locator('.unit-roster summary').click();
      await page.getByRole('button',{name:/选择我方01号/}).click();
    }
    await page.locator('.mission-intel > summary').click();
    const story=page.locator('.story-brief');
    await expect(story.getByRole('progressbar')).toHaveAttribute('aria-valuenow',String(rounds));
    // Collapse the story panel before firing so the real map click is exposed.
    await page.locator('.mission-intel > summary').click();
    await clickCell(page,4,4);
    const result=page.getByRole('dialog',{name:'任务目标达成'});
    await expect(result).toBeVisible();
    await expect(result).toContainText('敌军已全歼，机场提前守备成功');
    await expect(result).toContainText(`实际守备 ${rounds} / 5 个完整敌方回合`);
    await expect(meter(page)).toHaveAttribute('aria-valuenow',String(rounds));
    await expect(page.locator('.defense-segments .completed')).toHaveCount(rounds);
    // DOM assertions also inspect the mounted, collapsed StoryBrief under modal.
    await expect(story.getByRole('progressbar',{includeHidden:true})).toHaveAttribute('aria-valuenow',String(rounds));
    await expect(story).toContainText(`机场守备 ${rounds} / 5 回合 · 全歼敌军，提前完成`);
    expect((await state(page)).winner).toBe('blue');
  }
});

test('runway breach and loss of all defenders report different real defeat causes', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  const changeFixture=await installFixture(page);
  for(const cause of ['breach','loss']) {
    changeFixture(cause==='breach'?`
      s.units=s.units.filter(u=>u.id!==10);
      Object.assign(s.units.find(u=>u.team==='red'),{x:7,y:4,move:1});
    `:`
      s.units=s.units.filter(u=>u.id!==5&&u.id!==10);
      Object.assign(s.units[0],{hp:1,vision:20});
      Object.assign(s.units.find(u=>u.team==='red'),{x:4,y:4,attack:999,minRange:0,range:20,indirect:true});
    `);
    await page.goto('/battle/airfield-defense');
    const before=await state(page);
    await page.locator('#end-turn').click();
    const result=page.getByRole('dialog',{name:'行动失败'});
    await expect(result).toBeVisible();
    await expect(result).toContainText(cause==='breach'?'敌军进入跑道保护区，机场失守':'我方守军全部损失，守备行动失败');
    await expect(result).not.toContainText(cause==='breach'?'我方守军全部损失':'敌军进入跑道保护区');
    await expect(meter(page)).toHaveAttribute('aria-valuenow','0');
    const after=await state(page);
    expect(after.winner).toBe('red');
    if(cause==='loss') expect(after.units.filter(u=>u.team==='blue'&&u.hp>0)).toHaveLength(0);
    else expect(after.units.some(u=>u.team==='red'&&u.x===8&&u.y===4)).toBe(true);
    await result.getByRole('button',{name:/撤回最后一步/}).click();
    expect(await state(page)).toEqual(before);
    await expect(guide(page)).not.toHaveAttribute('open');
  }
});

test('hidden enemy count and position never inflate visible runway intelligence', async ({page}) => {
  const changeFixture=await installFixture(page);
  let baseline;
  for(const variant of ['one-hidden','two-hidden','hidden-near-runway']) {
    changeFixture(`
      s.units.filter(u=>u.team==='blue').forEach(u=>u.vision=1);
      s.units=s.units.filter(u=>u.id!==10);
      ${variant==='two-hidden'?"s.units.push({...s.units.find(u=>u.team==='red'),id:10,x:10,y:9});":''}
      ${variant==='hidden-near-runway'?"Object.assign(s.units.find(u=>u.team==='red'),{x:8,y:7});":''}
    `);
    await page.goto('/battle/airfield-defense');
    await closeGuide(page);
    await expect(page.locator('.defense-threat')).toHaveText('当前视野内未发现敌军，留意迷雾');
    expect(await page.evaluate(()=>window.__defenseState.units.filter(u=>u.team==='red').every(u=>window.__defenseState.fog[u.y][u.x]))).toBe(true);
    await page.locator('.mission-intel > summary').click();
    const story=page.getByRole('region',{name:'剧情任务'});
    await expect(story.locator('.mission-points p')).toHaveCount(6);
    for(const point of await story.locator('.mission-points p').allTextContents()) expect(point).toContain('未观察');
    const intel={threat:await page.locator('.defense-threat').textContent(),visibility:await page.locator('.defense-visibility').textContent(),points:await story.locator('.mission-points').textContent()};
    if(baseline) expect(intel).toEqual(baseline);
    else baseline=intel;
  }
});

test('390px mobile controls are reachable and collapsed panels leave the map clear', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await installFixture(page);
  await page.goto('/battle/airfield-defense');
  await expect(guide(page)).toHaveAttribute('open','');
  await closeGuide(page);
  const before=await state(page);
  await page.getByRole('button',{name:'定位跑道保护区'}).click();
  await page.locator('.command-toggle').click();
  await page.locator('.unit-roster summary').click();
  await page.getByRole('button',{name:/选择我方05号/}).click();
  await expect(page.locator('.unit-panel')).toHaveAttribute('data-unit','5');
  for(const selector of ['.unit-panel','.unit-roster','.unit-roster-list button']) {
    for(const card of await page.locator(selector).all()) {
      const bounds=await card.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x+bounds.width).toBeLessThanOrEqual(391);
    }
  }
  await page.getByRole('button',{name:'⌖ 定位本车',exact:true}).click();
  expect(await state(page)).toEqual({...before,selectedId:5});
  await page.locator('.command-toggle').click();
  await page.locator('#attack-mode').click();
  await expect(page.locator('#attack-mode')).toHaveAttribute('aria-pressed','true');
  await page.locator('#move-mode').click();
  for(const selector of ['#map','.defense-objective','.command-hud','.unit-actions','#end-turn','#undo','#battle-settings']) {
    await expect(page.locator(selector)).toBeInViewport();
    const bounds=await page.locator(selector).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x+bounds.width).toBeLessThanOrEqual(391);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const overlaps=await page.evaluate(()=>{
    const rect=selector=>document.querySelector(selector).getBoundingClientRect();
    const map=rect('#map');
    return ['.defense-objective','.command-hud','.unit-actions','#end-turn'].filter(selector=>{
      const panel=rect(selector);
      return Math.min(map.right,panel.right)>Math.max(map.left,panel.left)+1&&Math.min(map.bottom,panel.bottom)>Math.max(map.top,panel.top)+1;
    });
  });
  expect(overlaps).toEqual([]);
  // Location centers the selected vehicle, leaving its adjacent destination tappable.
  await clickCell(page,3,6);
  await expect(page.locator('.battle-feedback')).toContainText('移动完成');
  await page.locator('#undo').click();
  expect((await state(page)).units).toEqual(before.units);
  await page.locator('#battle-settings').click();
  await expect(page.getByRole('dialog',{name:'战斗设置'})).toBeVisible();
  await page.getByRole('button',{name:'关闭设置'}).click();
  await completeRound(page,1);
});

test('667px narrow landscape retains a usable map and real movement after onboarding', async ({page}) => {
  await page.setViewportSize({width:667,height:375});
  await installFixture(page);
  await page.goto('/battle/airfield-defense');
  await closeGuide(page);
  const map=await page.locator('#map').boundingBox();
  expect(map.height).toBeGreaterThan(150);
  expect(map.width).toBeGreaterThan(300);
  for(const selector of ['.defense-objective','.command-hud','.unit-actions','#end-turn','#undo','#battle-settings']) {
    await expect(page.locator(selector)).toBeInViewport();
    const panel=await page.locator(selector).boundingBox();
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x+panel.width).toBeLessThanOrEqual(668);
    expect(Math.min(map.x+map.width,panel.x+panel.width)<=Math.max(map.x,panel.x)+1||
      Math.min(map.y+map.height,panel.y+panel.height)<=Math.max(map.y,panel.y)+1).toBe(true);
  }
  await page.locator('.command-toggle').click();
  await page.getByRole('button',{name:'⌖ 定位本车',exact:true}).click();
  await page.locator('.command-toggle').click();
  await clickCell(page,4,4);
  await expect(page.locator('.battle-feedback')).toContainText('移动完成');
  await page.locator('#undo').click();
  await expect(guide(page)).not.toHaveAttribute('open');
  await page.locator('#end-turn').click();
  await expect(meter(page)).toHaveAttribute('aria-valuenow','1',{timeout:10000});
});
