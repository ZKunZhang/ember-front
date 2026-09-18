import { test, expect } from '@playwright/test';

test('combat renders launch, impact and recovery, with reduced motion supported',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/battle/mountain-pass?difficulty=simple&formation=balanced');
  await expect(page.locator('#map')).toBeVisible();
  const frames=await page.evaluate(async()=>{
    const {initialGame,gameReducer}=await import('/src/game/reducer.js');
    const {createView}=await import('/src/rendering/projection.js');
    const {drawBattlefield}=await import('/src/rendering/battlefield.js');
    const state=initialGame(),enemy=state.units.find(u=>u.team==='red');
    enemy.x=16;enemy.y=3;state.fog[3][16]=false;
    const shot=gameReducer(state,{type:'CELL',x:16,y:3});
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=720;
    canvas.id='combat-preview';canvas.style.cssText='position:relative;display:block;width:1000px;height:720px;background:#172019';document.body.append(canvas);
    const ctx=canvas.getContext('2d'),view=createView(shot,1000,720),effects=[{...shot.effect,started:0}];
    const frames=[];
    for(const now of [60,230,700,1200]){drawBattlefield(ctx,view,shot,{effects,now});frames.push(canvas.toDataURL());}
    drawBattlefield(ctx,view,shot,{effects,now:230,reducedMotion:true});frames.push(canvas.toDataURL());
    drawBattlefield(ctx,view,shot,{effects,now:230});
    return frames;
  });
  expect(new Set(frames).size).toBe(5);
  await page.locator('#combat-preview').screenshot({path:'test-results/combat-impact.png'});
  expect(errors).toEqual([]);
});
