import { test, expect } from '@playwright/test';

test('fog drifts on its own layer without redrawing the idle battlefield',async({page})=>{
  await page.goto('/battle/mountain-pass');
  await expect(page.locator('.fog-layer')).toBeVisible();
  await page.waitForTimeout(250);
  const before=await page.evaluate(()=>({map:document.querySelector('#map').toDataURL(),fog:document.querySelector('.fog-layer').toDataURL()}));
  await page.waitForTimeout(350);
  const after=await page.evaluate(()=>({map:document.querySelector('#map').toDataURL(),fog:document.querySelector('.fog-layer').toDataURL()}));
  expect(before.map).toBe(after.map);
  expect(before.fog).not.toBe(after.fog);
  expect(await page.locator('.fog-layer').evaluate(canvas=>getComputedStyle(canvas).pointerEvents)).toBe('none');
  await page.screenshot({path:'test-results/fog-desktop.png'});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForTimeout(100);
  const frozen=await page.locator('.fog-layer').evaluate(canvas=>canvas.toDataURL());
  await page.waitForTimeout(250);
  expect(await page.locator('.fog-layer').evaluate(canvas=>canvas.toDataURL())).toBe(frozen);
});

test('fog mask follows panning, leaves visible units clear and invalidates on visibility changes',async({page})=>{
  await page.goto('/battle/mountain-pass');
  const result=await page.evaluate(async()=>{
    const {initialGame}=await import('/src/game/reducer.js');
    const {createView,project}=await import('/src/rendering/projection.js');
    const {createFogRenderer}=await import('/src/rendering/fog.js');
    const game=initialGame(),canvases=[];
    const renderer=createFogRenderer(()=>{const c=document.createElement('canvas');canvases.push(c);return c;});
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=720;
    const ctx=canvas.getContext('2d');
    const blue=game.units.find(u=>u.team==='blue'),red=game.units.find(u=>u.team==='red');
    const samples=[];
    for(const pan of [{x:0,y:0},{x:60,y:30}]){
      const view=createView(game,1000,720,1,pan);
      renderer.prepare(game,view);renderer.draw(ctx,view,0);
      const alpha=unit=>{const p=project(view,unit.x+.5,unit.y+.5);return ctx.getImageData(Math.round(p.x),Math.round(p.y),1,1).data[3];};
      samples.push({blue:alpha(blue),red:alpha(red)});
    }
    const allocationCount=canvases.length;
    const clear={...game,fog:game.fog.map(row=>row.map(()=>false))};
    const view=createView(clear,1000,720);
    const hasFog=renderer.prepare(clear,view);renderer.draw(ctx,view,0);
    const empty=ctx.getImageData(0,0,1000,720).data.every(value=>value===0);
    renderer.clear();
    return {samples,allocationCount,hasFog,empty,released:canvases.every(c=>c.width===0&&c.height===0)};
  });
  expect(result.allocationCount).toBe(2);
  for(const sample of result.samples){expect(sample.blue).toBeLessThan(10);expect(sample.red).toBeGreaterThan(100);}
  expect(result.hasFog).toBe(false);expect(result.empty).toBe(true);expect(result.released).toBe(true);
});
