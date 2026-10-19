import { test, expect } from '@playwright/test';

async function camera(page) {
  return page.locator('#map').evaluate(canvas=>({
    rotation:Number(canvas.dataset.cameraRotation),
    tilt:Number(canvas.dataset.cameraTilt),
    zoom:Number(canvas.dataset.cameraZoom),
  }));
}

async function pointInView(page, {unitId, cell, destination=false}) {
  return page.evaluate(async ({unitId,cell,destination})=>{
    const {createState,reachable}=await import('/src/game/engine.js');
    const {createView,project,VEHICLE_SCALE}=await import('/src/rendering/projection.js');
    const state=createState('mountain-pass');
    const canvas=document.querySelector('#map'),rect=canvas.getBoundingClientRect();
    const view=createView(state,rect.width,rect.height,Number(canvas.dataset.cameraZoom),undefined,{
      rotation:Number(canvas.dataset.cameraRotation),tilt:Number(canvas.dataset.cameraTilt),
    });
    const unit=state.units.find(u=>u.id===unitId);
    const position=destination?[...reachable(state,unit).keys()].map(key=>{
      const [x,y]=key.split(',').map(Number);return {x,y};
    }).find(p=>!state.units.some(u=>u.hp>0&&u.x===p.x&&u.y===p.y)):cell||unit;
    const height=destination||cell?0:(unit.type==='scout'?10:unit.type==='heavyTank'?24:17)*VEHICLE_SCALE;
    const p=project(view,position.x+.5,position.y+.5,height);
    return {x:p.x,y:p.y,cell:position};
  },{unitId,cell,destination});
}

async function battleSnapshot(page) {
  return page.evaluate(()=>({
    selected:document.querySelector('.unit-panel').dataset.unit,
    unit:document.querySelector('.unit-panel').textContent,
    log:document.querySelector('#log').textContent,
    round:document.querySelector('#round').textContent,
    move:document.querySelector('#move-mode').textContent,
    undo:document.querySelector('#undo').disabled,
  }));
}

test('right-drag rotates and tilts without acting; rotated picking moves and undo restores a unit',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/battle/mountain-pass');
  const map=page.locator('#map');
  await expect(map).toBeVisible();
  const before=await battleSnapshot(page),initialCamera=await camera(page);
  const target=await pointInView(page,{cell:{x:16,y:3}});
  await map.click({position:{x:target.x,y:target.y},button:'right'});
  expect(await battleSnapshot(page)).toEqual(before);
  const box=await map.boundingBox();
  await page.mouse.move(box.x+target.x,box.y+target.y);
  await page.mouse.down({button:'right'});
  await page.mouse.move(box.x+target.x+95,box.y+target.y+45,{steps:8});
  await expect(map).toHaveAttribute('data-camera-detail','interactive');
  await page.mouse.up({button:'right'});
  await expect(map).toHaveAttribute('data-camera-detail','full');
  const rotated=Math.atan2(Math.sin(initialCamera.rotation+.76),Math.cos(initialCamera.rotation+.76));
  await expect.poll(async()=> (await camera(page)).rotation).toBeCloseTo(rotated,4);
  expect((await camera(page)).tilt).toBeCloseTo(1.135,4);
  expect(await battleSnapshot(page)).toEqual(before);

  const unit=await pointInView(page,{unitId:2});
  await map.click({position:{x:unit.x,y:unit.y}});
  await expect(page.locator('.unit-panel')).toHaveAttribute('data-unit','2');
  const selected=await battleSnapshot(page);
  const move=await pointInView(page,{unitId:2,destination:true});
  await map.click({position:{x:move.x,y:move.y}});
  await expect(page.locator('#move-mode')).toContainText('已移动');
  await expect(page.locator('#undo')).toBeEnabled();
  // Resetting only the camera must retain selection, health, actions and history.
  const moved=await battleSnapshot(page);
  await page.locator('.sandtable-controls summary').click();
  await page.getByRole('button',{name:'复位沙盘视角',exact:true}).click();
  await expect.poll(()=>camera(page)).toEqual(initialCamera);
  expect(await battleSnapshot(page)).toEqual(moved);
  await page.locator('#undo').click();
  await expect(page.locator('#undo')).toBeDisabled();
  const restored=await battleSnapshot(page);
  expect(restored.selected).toEqual(selected.selected);
  expect(restored.unit).toEqual(selected.unit);
  expect(restored.move).toEqual(selected.move);
  const original=await pointInView(page,{unitId:2});
  await map.hover({position:{x:original.x,y:original.y}});
  await expect(page.locator('.coordinates')).toContainText('我方 02');
});

test('sandtable controls rotate, zoom and set tilt while preserving battle data',async({page})=>{
  await page.goto('/battle/mountain-pass');
  const before=await battleSnapshot(page),initialCamera=await camera(page);
  await page.locator('.sandtable-controls summary').click();
  await page.getByRole('button',{name:'向右旋转沙盘',exact:true}).click();
  const rotated=Math.atan2(Math.sin(initialCamera.rotation+Math.PI/6),Math.cos(initialCamera.rotation+Math.PI/6));
  await expect.poll(async()=> (await camera(page)).rotation).toBeCloseTo(rotated,5);
  await page.getByRole('button',{name:'向左旋转沙盘',exact:true}).click();
  await page.getByRole('button',{name:'放大沙盘',exact:true}).click();
  await expect.poll(async()=> (await camera(page)).zoom).toBeCloseTo(initialCamera.zoom+.15,5);
  await page.getByRole('button',{name:'缩小沙盘',exact:true}).click();
  await page.getByRole('slider',{name:'沙盘俯视角度',exact:true}).fill('0.75');
  await expect.poll(async()=> (await camera(page)).tilt).toBe(.75);
  await page.getByRole('button',{name:'复位沙盘视角',exact:true}).click();
  await expect.poll(()=>camera(page)).toEqual(initialCamera);
  expect(await battleSnapshot(page)).toEqual(before);
});

test('mobile two-finger pinch rotates and zooms without a unit action',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  try {
    await page.goto('/battle/mountain-pass');
    const map=page.locator('#map');
    await map.scrollIntoViewIfNeeded();
    const box=await map.boundingBox(),before=await battleSnapshot(page),initialCamera=await camera(page);
    const x=box.x+box.width/2,y=box.y+box.height/2;
    const session=await context.newCDPSession(page);
    const touches=(a,b)=>[{id:1,x:x+a[0],y:y+a[1]},{id:2,x:x+b[0],y:y+b[1]}];
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches([-45,0],[45,0])});
    for(let i=1;i<=8;i++) {
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches([-45-i*2,-i*4],[45+i*2,i*4])});
    }
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(map).toHaveAttribute('data-camera-detail','full');
    await expect.poll(async()=> (await camera(page)).zoom).toBeGreaterThan(1.4);
    const finalCamera=await camera(page);
    const angleChange=Math.atan2(Math.sin(finalCamera.rotation-initialCamera.rotation),Math.cos(finalCamera.rotation-initialCamera.rotation));
    expect(angleChange).toBeGreaterThan(.3);
    expect(await battleSnapshot(page)).toEqual(before);
    await page.locator('.sandtable-controls summary').click();
    await page.getByRole('button',{name:'复位沙盘视角',exact:true}).click();
    await expect.poll(()=>camera(page)).toEqual(initialCamera);
    expect(await battleSnapshot(page)).toEqual(before);
    await session.detach();
  } finally {
    await context.close();
  }
});
