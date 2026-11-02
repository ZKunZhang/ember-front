import { test, expect } from '@playwright/test';
import { selectMapUnit } from './unit-selection.js';

test('march deploys from the crossing filter with all three new guns and guide entries',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/operations');
  await page.getByRole('button',{name:'穿越与护送',exact:true}).click();
  await page.getByRole('searchbox',{name:'搜索战区'}).fill('长路接敌');
  const node=page.getByTestId('deploy-long-road-contact');
  await expect(node).toBeVisible();
  await node.hover();
  await expect(page.locator('.campaign-brief')).toContainText('山区与连片树林');
  await node.click();
  await expect(page).toHaveURL(/\/battle\/long-road-contact\?difficulty=simple&formation=fireSupport$/);
  await expect(page.locator('.mission-head')).toContainText('长路接敌');
  await expect(page.locator('.mission-head')).toContainText('向右推进');
  await expect(page.locator('.objective-progress')).toContainText('0 / 5');
  await expect(page.locator('#ally-count')).toHaveText('09 / 09');
  for (const [id,name,range] of [[4,'加农炮','2–7'],[5,'榴弹炮','3–8'],[7,'加榴炮','2–7']]) {
    await selectMapUnit(page,id);
    await expect(page.locator('.unit-panel')).toHaveAttribute('data-unit',String(id));
    await expect(page.locator('.unit-name')).toContainText(name);
    await expect(page.locator('.unit-panel')).toContainText(range);
  }
  await page.screenshot({path:'test-results/long-road-contact.png'});
  await page.locator('#battle-settings').click();
  await page.locator('#help').click();
  const manual=page.getByRole('dialog',{name:'装甲联合作战'});
  for (const name of ['加农炮','榴弹炮','加榴炮']) await expect(manual.getByText(name,{exact:true})).toBeVisible();
  await manual.locator('#close-help').click();
  await page.reload();
  await expect(page.locator('.mission-head')).toContainText('火力协同编组');
  expect(errors).toEqual([]);
});

test('march and new gun icons render on a narrow screen without page overflow',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/battle/long-road-contact?difficulty=hard&formation=fireSupport');
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('.objective-progress')).toContainText('0 / 5');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.sandtable-controls summary').click();
  for (let i=0;i<17;i++) await page.getByRole('button',{name:'放大沙盘',exact:true}).click();
  await expect.poll(async()=>Number(await page.locator('#map').getAttribute('data-camera-zoom'))).toBeGreaterThan(3);
  await page.locator('.sandtable-controls summary').click();
  // Bring the expanded deployment into view using the same pan control players use.
  const pan=await page.evaluate(async()=>{
    const {createState}=await import('/src/game/engine.js');
    const {createView,project}=await import('/src/rendering/projection.js');
    const s=createState('long-road-contact','hard','fireSupport'),unit=s.units[4];
    const map=document.querySelector('#map'),rect=map.getBoundingClientRect();
    const p=project(createView(s,rect.width,rect.height,Number(map.dataset.cameraZoom)),unit.x+.5,unit.y+.5);
    return {x:rect.width/2-p.x,y:rect.height/2-p.y};
  });
  await page.locator('#map').dispatchEvent('wheel',{deltaX:-pan.x,deltaY:-pan.y,deltaMode:0});
  await expect.poll(async()=>Number(await page.locator('#map').getAttribute('data-camera-pan-x'))).toBeCloseTo(pan.x);
  for (const [id,name] of [[4,'加农炮'],[5,'榴弹炮'],[7,'加榴炮']]) {
    const point=await page.evaluate(async id=>{
      const {createState}=await import('/src/game/engine.js');
      const {createView,project,VEHICLE_SCALE}=await import('/src/rendering/projection.js');
      const s=createState('long-road-contact','hard','fireSupport'),unit=s.units.find(u=>u.id===id);
      const map=document.querySelector('#map'),rect=map.getBoundingClientRect(),d=map.dataset;
      const view=createView(s,rect.width,rect.height,Number(d.cameraZoom),{x:Number(d.cameraPanX),y:Number(d.cameraPanY)},
        {rotation:Number(d.cameraRotation),tilt:Number(d.cameraTilt)});
      return project(view,unit.x+.5,unit.y+.5,17*VEHICLE_SCALE);
    },id);
    await page.locator('#map').click({position:point});
    await page.locator('.command-toggle').click();
    await expect(page.locator('.unit-name')).toContainText(name);
    await page.locator('.command-toggle').click();
  }
  const destination=await page.evaluate(async()=>{
    const {createState,reachable}=await import('/src/game/engine.js');
    const {createView,project}=await import('/src/rendering/projection.js');
    const s=createState('long-road-contact','hard','fireSupport'),unit=s.units[6];
    const cell=[...reachable(s,unit).values()].find(path=>path.length===1&&path[0].x<unit.x)[0];
    const map=document.querySelector('#map'),r=map.getBoundingClientRect(),d=map.dataset;
    return project(createView(s,r.width,r.height,Number(d.cameraZoom),{x:Number(d.cameraPanX),y:Number(d.cameraPanY)},
      {rotation:Number(d.cameraRotation),tilt:Number(d.cameraTilt)}),cell.x+.5,cell.y+.5);
  });
  await page.locator('#map').click({position:destination});
  await expect(page.locator('.battle-feedback')).toContainText('移动完成');
  await page.locator('#undo').click();
  await expect(page.locator('.battle-feedback')).toContainText('已撤回');
  await page.screenshot({path:'test-results/long-road-contact-mobile.png'});
  expect(errors).toEqual([]);
});

test('hard selection and battle show enlarged protection and updated time limits',async({page})=>{
  await page.goto('/operations');
  await page.getByRole('combobox',{name:'作战难度'}).selectOption('hard');
  await page.getByRole('searchbox',{name:'搜索战区'}).fill('余烬断后');
  await page.getByTestId('deploy-ember-rearguard').hover();
  await expect(page.locator('.campaign-brief')).toContainText('限14轮');
  await expect(page.locator('.campaign-brief')).toContainText('12格通道');
  await expect(page.locator('.campaign-brief')).toContainText('可用面积 ×4');
  await page.goto('/battle/airfield-defense?difficulty=hard');
  await expect(page.locator('.defense-critical-rule')).toContainText('24 格跑道保护区');
  await page.locator('.defense-guide summary').click();
  await page.screenshot({path:'test-results/hard-expanded-airfield.png'});
});
