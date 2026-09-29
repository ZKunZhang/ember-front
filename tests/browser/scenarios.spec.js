import {test,expect} from '@playwright/test';
import { FORMATIONS } from '../../src/game/scenarios.js';
import { UNIT_TYPES } from '../../src/game/catalog.js';
import { selectMapUnit } from './unit-selection.js';

test('new battlefields deploy their chosen difficulty and allied combination',async({page})=>{
  await page.goto('/operations');
  for(const [id,name,formation] of [['forest-corridor','林海走廊','mobile'],['broken-basin','碎岩盆地','armored'],['lake-crossroads','环湖交锋','artillery']]){
    const select=page.getByRole('combobox',{name:'我方组合'});
    await expect(select).toHaveValue('recommended');
    await page.getByRole('combobox',{name:'作战难度'}).selectOption('hard');
    await select.selectOption('artillery');
    const labels=Object.entries(UNIT_TYPES).map(([type,u])=>`${u.name} × ${FORMATIONS.artillery.types.filter(t=>t===type).length}`);
    await page.getByTestId(`deploy-${id}`).click();
    await expect(page.locator('.mission-head h1')).toContainText(name);
    await expect(page.locator('.mission-head h1')).toContainText('困难');
    await expect(page.locator('#ally-count')).toHaveText('09 / 09');
    await expect(page.locator('.squad-row')).toHaveCount(0);
    const checkFormation = async () => {
      const names = [];
      for(let unitId=1;unitId<=9;unitId++) {
        await selectMapUnit(page,unitId);
        await expect(page.locator('.unit-panel')).toHaveAttribute('data-unit',String(unitId));
        names.push(await page.locator('.unit-name').innerText());
      }
      for(const label of labels){
        const [unit,count]=label.split(' × ');
        expect(names.filter(name=>name.includes(unit))).toHaveLength(Number(count));
      }
    };
    await checkFormation();
    await page.screenshot({path:`test-results/${id}.png`,fullPage:true});
    await page.locator('#battle-settings').click();await page.locator('#reset').click();
    await checkFormation();
    await page.locator('#battle-settings').click();await page.locator('#choose-map').click();
  }
});

test('historical missions show narrative, objectives and source references',async({page})=>{
  for(const [id,title,progress] of [
    ['alamein-breakthrough','夺取两处集结点','接应进度 0 / 2'],
    ['bridge-relief','护送工程车抵达桥头','护送工程车抵达金色地格'],
    ['ardennes-watch','坚守观察点4个敌方回合','坚守 0 / 4'],
  ]){
    await page.goto(`/battle/${id}`);
    await page.getByText('任务简报与战术路线',{exact:true}).click();
    const story=page.getByRole('region',{name:'剧情任务'});
    await expect(story.getByRole('heading',{name:title})).toBeVisible();
    await expect(story).toContainText(progress);
    await story.getByText('历史背景与参考').click();
    await expect(story.getByRole('link',{name:'阅读史料 ↗'})).toHaveAttribute('href',/^https:\/\/(www.nam.ac.uk|www.nps.gov)\//);
  }
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
