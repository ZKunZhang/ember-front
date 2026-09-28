import { test, expect } from '@playwright/test';

async function moveScout(page) {
  const point=await page.evaluate(async()=>{
    const {createState}=await import('/src/game/engine.js');
    const {createView,project}=await import('/src/rendering/projection.js');
    const r=document.querySelector('#map').getBoundingClientRect();
    const p=project(createView(createState(),r.width,r.height),16.5,3.5);
    return {x:r.left+p.x,y:r.top+p.y};
  });
  await page.mouse.click(point.x,point.y);
}

test('moving vehicles animate, settle, and can be resumed after leaving the battle',async({page})=>{
  await page.goto('/battle/mountain-pass');
  await expect(page.locator('#map')).toBeVisible();
  await moveScout(page);
  await expect(page.locator('#move-mode')).toHaveText('✓ 已移动');
  const frames=await page.evaluate(async()=>{
    const canvas=document.querySelector('#map'),frames=[];
    for(let i=0;i<6;i++){
      await new Promise(requestAnimationFrame);
      frames.push(canvas.toDataURL());
    }
    return new Set(frames).size;
  });
  expect(frames).toBeGreaterThan(1);
  await page.waitForTimeout(1000);
  const settled=await page.locator('#map').evaluate(async canvas=>{
    const first=canvas.toDataURL();
    await new Promise(resolve=>setTimeout(resolve,80));
    return first===canvas.toDataURL();
  });
  expect(settled).toBe(true);
  await page.getByRole('button',{name:'退出关卡',exact:true}).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button',{name:'返回当前战场 →'}).click();
  await expect(page.locator('#move-mode')).toHaveText('✓ 已移动');
  await page.locator('#undo').click();
  await expect(page.locator('#move-mode')).toHaveText('◇ 移动');
});

test('navigation, title and selected-unit information occupy the requested corners',async({page})=>{
  await page.goto('/battle/mountain-pass');
  const exit=await page.locator('#choose-map').boundingBox();
  const title=await page.locator('.mission-head').boundingBox();
  const info=await page.locator('.command-hud').boundingBox();
  expect(exit.x).toBeLessThan(50);expect(exit.y).toBeLessThan(50);
  expect(Math.abs(title.x+title.width/2-720)).toBeLessThan(5);
  expect(title.y).toBeLessThan(50);
  expect(info.x).toBeGreaterThan(1000);expect(info.y).toBeLessThan(120);
});

test('cached terrain keeps the reference appearance while panning',async({page})=>{
  await page.goto('/battle/mountain-pass');
  const differences=await page.evaluate(async()=>{
    const {initialGame}=await import('/src/game/reducer.js');
    const {createView}=await import('/src/rendering/projection.js');
    const {drawBattlefield}=await import('/src/rendering/battlefield.js');
    const {createTerrainCache}=await import('/src/rendering/cache.js');
    const game=initialGame(),cache=createTerrainCache(),results=[];
    const raw=document.createElement('canvas'),cached=document.createElement('canvas');
    raw.width=cached.width=1000;raw.height=cached.height=720;
    const a=raw.getContext('2d'),b=cached.getContext('2d');
    for(const pan of [{x:0,y:0},{x:45,y:-24},{x:-300,y:100}]){
      const view=createView(game,1000,720,1.15,pan);
      drawBattlefield(a,view,game,{now:0});
      drawBattlefield(b,view,game,{cache,now:0});
      const first=a.getImageData(0,0,1000,720).data,second=b.getImageData(0,0,1000,720).data;
      let total=0;for(let i=0;i<first.length;i++)total+=Math.abs(first[i]-second[i]);
      results.push(total/first.length);
    }
    cache.clear();return results;
  });
  for(const mean of differences)expect(mean).toBeLessThan(5);
});
