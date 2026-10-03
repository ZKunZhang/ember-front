import { test, expect } from '@playwright/test';
import { selectMapUnit } from './unit-selection.js';

for(const width of [1440,390])test(`six neighboring hexes accept one-step movement and undo at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/src/game/engine.js*',async route=>{
    const response=await route.fetch();
    const body=(await response.text()).replace(/updateMission\(s\);\s*return s;/,`updateMission(s);
      s.mission=null;
      s.terrain=s.terrain.map(row=>row.map(()=>0));
      s.units=[s.units[0],s.units[1],s.units.find(u=>u.team==='red')];
      Object.assign(s.units[0],{x:10,y:8,move:1,vision:3});
      Object.assign(s.units[1],{x:10,y:12});
      Object.assign(s.units[2],{x:20,y:15});
      updateFog(s);return s;`);
    await route.fulfill({response,body});
  });
  await page.goto('/battle/mountain-pass');
  for(const [dx,dy] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
    const target={x:10+dx,y:8+dy};
    const point=await page.evaluate(async target=>{
      const {createState}=await import('/src/game/engine.js');
      const {createView,project}=await import('/src/rendering/projection.js');
      const rect=document.querySelector('#map').getBoundingClientRect();
      return project(createView(createState(),rect.width,rect.height),target.x+.5,target.y+.5);
    },target);
    await page.locator('#map').hover({position:point});
    await expect(page.locator('.coordinates')).toHaveText(`GRID ${target.x+1} : ${target.y+1}`);
    await page.locator('#map').click({position:point});
    await expect(page.locator('#move-mode')).toContainText('已移动');
    await selectMapUnit(page,1,target);
    await expect(page.locator('.coordinates')).toContainText('我方 01');
    await page.locator('#undo').click();
    await expect(page.locator('#move-mode')).toBeEnabled();
    await expect(page.locator('.battle-feedback')).toContainText('已撤回');
  }
  expect(errors).toEqual([]);
});
