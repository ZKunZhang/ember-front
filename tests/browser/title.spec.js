import {test,expect} from '@playwright/test';
import { SCENARIOS } from '../../src/game/scenarios.js';

test('title leads to operations then battle, with reload and history support',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'烬土前线',exact:true})).toBeVisible();
  await expect(page.locator('.campaign-node')).toHaveCount(0);
  const start=page.getByRole('button',{name:'开始游戏'});
  await expect(start).toBeVisible();
  const bounds=await start.boundingBox();
  expect(bounds.y).toBeGreaterThan(1080*.6);
  expect(Math.abs(bounds.x+bounds.width/2-720)).toBeLessThan(2);
  await start.click();
  await expect(page).toHaveURL(/\/operations$/);
  await expect(page.locator('.campaign-node')).toHaveCount(SCENARIOS.length);
  await page.reload();
  await expect(page.locator('.campaign-node')).toHaveCount(SCENARIOS.length);
  await page.getByTestId('deploy-iron-gorge').click();
  await expect(page).toHaveURL(/\/battle\/iron-gorge\?/);
  await expect(page.locator('.mission-head h1')).toContainText('铁壁峡口');
  await page.locator('#battle-settings').click();await page.locator('#choose-map').click();
  await page.getByRole('button',{name:'主菜单'}).click();
  await expect(start).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/operations$/);
  expect(errors).toEqual([]);
});

test('title background loads and the menu fits desktop and mobile screens',async({page})=>{
  for(const [width,height] of [[1440,900],[390,844],[320,568],[844,390]]){
    await page.setViewportSize({width,height});await page.goto('/');
    await expect(page.getByRole('button',{name:'开始游戏'})).toBeInViewport();
    const size=await page.locator('.title-screen').boundingBox();
    expect(size).toEqual({x:0,y:0,width,height});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    expect(await page.evaluate(async()=>{const image=new Image();image.src='/images/ember-front-title.png';await image.decode();return image.naturalWidth>0;})).toBe(true);
    await page.screenshot({path:`test-results/title-${width}.png`});
  }
});
