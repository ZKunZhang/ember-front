import {test,expect} from '@playwright/test';
import { FORMATIONS, SCENARIOS } from '../../src/game/scenarios.js';
import { UNIT_TYPES } from '../../src/game/catalog.js';
import { selectMapUnit } from './unit-selection.js';

test('expanded campaign nodes stay separate and deploy all new battlefields',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1080});
    await page.goto('/operations');
    await expect(page.locator('.campaign-node')).toHaveCount(SCENARIOS.length);
    const boxes=await page.locator('.campaign-node').evaluateAll(nodes=>nodes.map(node=>{
      const {left,right,top,bottom}=node.getBoundingClientRect();return {left,right,top,bottom};
    }));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];
      expect(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top).toBe(true);
    }
    for(const scenario of SCENARIOS.slice(12)){
      await page.getByTestId(`deploy-${scenario.id}`).click();
      await expect(page.locator('.mission-head h1')).toContainText(scenario.name);
      await expect(page.locator('#ally-count')).toHaveText('09 / 09');
      await page.reload();
      await expect(page.locator('.mission-head h1')).toContainText(scenario.name);
      await page.goto('/operations');
    }
  }
  expect(errors).toEqual([]);
});

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

test('original crossing and escort stories expose their own objectives and target status',async({page})=>{
  await page.goto('/operations');
  await page.getByRole('button',{name:'穿越与护送',exact:true}).click();
  await expect(page.locator('.campaign-node')).toHaveCount(5);
  for(const meta of SCENARIOS.filter(s=>s.story&&!s.story.sourceUrl)){
    await page.goto(`/battle/${meta.id}`);
    const crossing=meta.mission.kind==='breakthrough';
    await expect(page.locator('.objective-progress')).toContainText(crossing?'抵达撤离区 0 / 3':'护送目标：工程车');
    await page.getByText('任务简报与战术路线',{exact:true}).click();
    const story=page.getByRole('region',{name:'剧情任务'});
    await expect(story).toContainText('原创虚构剧情');
    await story.getByText('行动背景',{exact:true}).click();
    await expect(story).toContainText(meta.story.intro);
    await expect(story.getByRole('link')).toHaveCount(0);
    await expect(story.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0');
  }
});
