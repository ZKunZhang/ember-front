import {test,expect} from '@playwright/test';

test('undo restores movement and an enemy round, and redeployment clears history',async({page})=>{
  await page.goto('/');await page.getByTestId('deploy-mountain-pass').click();
  const undo=page.getByRole('button',{name:'↶ 撤回',exact:true});
  await expect(undo).toBeDisabled();
  const point=await page.evaluate(async()=>{
    const {createState}=await import('/src/game/engine.js');
    const {createView,project}=await import('/src/rendering/projection.js');
    const r=document.querySelector('#map').getBoundingClientRect();
    const p=project(createView(createState(),r.width,r.height),16.5,3.5);
    return{x:r.left+p.x,y:r.top+p.y};
  });
  await page.mouse.click(point.x,point.y);
  await expect(page.locator('#move-mode')).toHaveText('✓ 已移动');
  await undo.click();
  await expect(page.locator('#move-mode')).toHaveText('◇ 移动');
  await expect(undo).toBeDisabled();
  await page.locator('#end-turn').click();
  await expect(page.locator('#round')).toHaveText('02');
  await undo.click();
  await expect(page.locator('#round')).toHaveText('01');
  await expect(page.locator('#end-turn')).toBeEnabled();
  await page.locator('#end-turn').click();
  await undo.click();
  await page.waitForTimeout(600);
  await expect(page.locator('#round')).toHaveText('01');
  await expect(page.locator('#end-turn')).toBeEnabled();
  await page.mouse.click(point.x,point.y);
  await expect(undo).toBeEnabled();
  await page.locator('#reset').click();
  await expect(undo).toBeDisabled();
});
