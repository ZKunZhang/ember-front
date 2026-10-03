import { test, expect } from '@playwright/test';
import { selectMapUnit } from './unit-selection.js';

test('revised operations deploy different force sizes and corners with an extraction goal',async({page})=>{
  for(const [id,total,required,direction] of [
    ['mountain-pass',9,5,'左下'],['diagonal-valley',7,4,'左上'],
    ['twin-bridges',9,6,'右下'],['forest-corridor',6,4,'右上'],
  ]) {
    await page.goto(`/battle/${id}`);
    await expect(page.locator('#ally-count')).toHaveText(`${String(total).padStart(2,'0')} / ${String(total).padStart(2,'0')}`);
    await expect(page.locator('.crossing-readiness')).toContainText(direction);
    await expect(page.locator('.crossing-readiness')).toContainText(`至少保住 ${required} 辆`);
    await expect(page.locator('.objective-progress')).toContainText(`0 / ${required}`);
    await selectMapUnit(page,2);
    await expect(page.locator('.unit-panel')).toHaveAttribute('data-unit','2');
    await page.screenshot({path:`test-results/operation-${id}.png`});
  }
});

test('new contacts stop movement, announce the encounter and can be undone',async({page})=>{
  await page.goto('/battle/mountain-pass');
  const target=await page.evaluate(async()=>{
    const {initialGame,gameReducer}=await import('/src/game/reducer.js');
    const {reachable}=await import('/src/game/engine.js');
    const {createView,project}=await import('/src/rendering/projection.js');
    const s=initialGame(),r=document.querySelector('#map').getBoundingClientRect();
    for(const path of reachable(s,s.units[0]).values()) {
      const end=path.at(-1),next=gameReducer(s,{type:'CELL',...end});
      if(next.notice.message.includes('发现'))return project(createView(s,r.width,r.height),end.x+.5,end.y+.5);
    }
    throw new Error('No first-turn scouting contact found');
  });
  await page.locator('#map').click({position:target});
  await expect(page.locator('.battle-feedback')).toContainText('行军已暂停');
  await expect(page.locator('#attack-mode')).toBeEnabled();
  await expect(page.locator('#end-turn')).toBeEnabled();
  await page.screenshot({path:'test-results/scouting-contact.png'});
  await page.locator('#undo').click();
  await expect(page.locator('#move-mode')).toBeEnabled();
  await expect(page.locator('.battle-feedback')).toContainText('已撤回');
});

test('crossing wins through extraction while enemies survive and result undo restores progress',async({page})=>{
  await page.route('**/src/game/engine.js*',async route=>{
    const response=await route.fetch();
    const body=(await response.text()).replace(/updateMission\(s\);\s*return s;/,`updateMission(s);
      if(s.id==='mountain-pass') {
        for(let i=0;i<4;i++)Object.assign(s.units[i],s.mission.points[i]);
        const point=s.mission.points[4];
        Object.assign(s.units[4],{x:point.x+1,y:point.y});
        s.selectedId=s.units[4].id;
        updateFog(s);
      }
      return s;`);
    await route.fulfill({response,body});
  });
  await page.goto('/battle/mountain-pass');
  await expect(page.locator('.objective-progress')).toContainText('4 / 5');
  const point=await page.evaluate(async()=>{
    const {createState}=await import('/src/game/engine.js');
    const {createView,project}=await import('/src/rendering/projection.js');
    const s=createState(),target=s.mission.points[4],r=document.querySelector('#map').getBoundingClientRect();
    return project(createView(s,r.width,r.height),target.x+.5,target.y+.5);
  });
  await page.locator('#map').click({position:point});
  const result=page.getByRole('dialog',{name:'任务目标达成'});
  await expect(result).toBeVisible();
  await expect(page.locator('#kill-count')).toHaveText('00 / 7');
  await result.getByRole('button',{name:/撤回最后一步/}).click();
  await expect(page.locator('.objective-progress')).toContainText('4 / 5');
  await expect(page.locator('#move-mode')).toBeEnabled();
});

test('connected mountain and forest scenery renders in the cached and overview paths',async({page})=>{
  await page.goto('/battle/mountain-pass');
  await page.evaluate(async()=>{
    const {initialGame}=await import('/src/game/reducer.js');
    const {drawBattlefield}=await import('/src/rendering/battlefield.js');
    const {createView}=await import('/src/rendering/projection.js');
    for(const id of ['mountain-pass','forest-corridor']) {
      const s=initialGame(id);s.fog=s.fog.map(row=>row.map(()=>false));
      const canvas=document.createElement('canvas');canvas.id=`terrain-${id}`;
      canvas.width=1100;canvas.height=720;
      canvas.style.cssText='position:relative;display:block;z-index:50';document.body.append(canvas);
      drawBattlefield(canvas.getContext('2d'),createView(s,1100,720,1),s,{preview:true,reducedMotion:true});
    }
  });
  for(const id of ['mountain-pass','forest-corridor'])await page.locator(`#terrain-${id}`).screenshot({path:`test-results/terrain-${id}.png`});
});
