import { test, expect } from '@playwright/test';

const scenarios = [
  ['bog-rescue', '泥沼救援'], ['ford-crossing', '浅滩争渡'],
  ['last-bridge', '独桥封锁'], ['airfield-defense', '机场防卫'],
];

async function installFixture(page, fixture) {
  await page.route('**/src/game/engine.js*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = /updateMission\(s\);\s*return s;/;
    expect(source).toMatch(marker);
    await route.fulfill({ response, body: source.replace(marker, `updateMission(s);\n${fixture}\nupdateFog(s);return s;`) });
  });
  await page.route('**/src/game/reducer.js*', async route => {
    const response = await route.fetch();
    const source = (await response.text())
      .replace('export function initialGame(', 'function fixtureInitialGame(')
      .replace('export function gameReducer(', 'function fixtureGameReducer(');
    await route.fulfill({ response, body: `${source}
      export function initialGame(...args) { return window.__varietyState=fixtureInitialGame(...args); }
      export function gameReducer(...args) { return window.__varietyState=fixtureGameReducer(...args); }
    ` });
  });
}

async function mapPoint(page, x, y) {
  return page.evaluate(async ({ x, y }) => {
    const { createState } = await import('/src/game/engine.js');
    const { readRoute } = await import('/src/game/routes.js');
    const { createView, project } = await import('/src/rendering/projection.js');
    const route = readRoute(new URL(location.href));
    const state = createState(route.scenarioId, route.difficulty, route.formationId);
    const rect = document.querySelector('#map').getBoundingClientRect();
    const point = project(createView(state, rect.width, rect.height), x + .5, y + .5);
    return { x: rect.left + point.x, y: rect.top + point.y };
  }, { x, y });
}

for (const viewport of [{ width: 1440, height: 1080 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width}px campaign`, () => {
    test.use({ viewport, hasTouch: viewport.width === 390, isMobile: viewport.width === 390 });
    test('terrain campaign deploys four operations and airport objectives', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize(viewport);
      for (const [id, name] of scenarios) {
        await page.goto('/operations');
        await page.getByRole('button', { name: '地形与守备', exact: true }).click();
        await expect(page.locator('.campaign-node')).toHaveCount(4);
        await expect(page.getByRole('button', { name: '地形与守备', exact: true })).toHaveAttribute('aria-pressed', 'true');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        // Clicking scrolls the horizontally pannable campaign map to each node on mobile.
        const deploy = page.getByTestId(`deploy-${id}`);
        if (viewport.width === 390) await deploy.tap();
        else await deploy.click();
        await expect(page).toHaveURL(new RegExp(`/battle/${id}`));
        await expect(page.locator('.mission-head h1')).toContainText(name);
        await expect(page.locator('#map')).toBeVisible();
        await expect(page.locator('#map')).toHaveAttribute('data-camera-rotation', '0');
        await expect(page.locator('#end-turn')).toBeEnabled();
        await page.locator('#end-turn').click({ trial: true });
        await page.locator('#battle-settings').click({ trial: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (id === 'airfield-defense') {
          await expect(page.locator('.objective-progress')).toContainText('机场守备 0 / 5 回合');
          await expect(page.locator('.objective-progress')).not.toContainText('护送');
          await page.getByText('任务简报与战术路线', { exact: true }).click();
          const story = page.getByRole('region', { name: '剧情任务' });
          await expect(story).toContainText('任何敌军踏入保护格立即失败');
          await expect(story).toContainText('歼灭全部敌军可提前获胜');
          await expect(story.locator('.mission-points p')).toHaveCount(6);
          await expect(story.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '5');
        }
      }
      expect(errors).toEqual([]);
    });
  });
}

test('map terrain costs, blocked deep water, shallow-water movement and undo agree', async ({ page }) => {
  await installFixture(page, `
    delete s.gridLayout;
      s.cols=9;s.rows=9;s.terrain=Array.from({length:9},()=>Array(9).fill(0));
    s.terrain[3][4]=5;s.terrain[4][3]=6;s.terrain[4][4]=4;
    const blues=s.units.filter(u=>u.team==='blue').slice(0,2),red=s.units.find(u=>u.team==='red');
    Object.assign(blues[0],{id:1,x:3,y:3,move:4,vision:8});
    Object.assign(blues[1],{id:2,x:0,y:0});Object.assign(red,{id:3,x:8,y:8});
    s.units=[...blues,red];s.deployments=s.units.map(u=>({...u}));
    s.landmarks=[];s.features=[];s.mission=null;s.story=null;s.selectedId=1;
  `);
  await page.goto('/battle/ford-crossing');
  await expect(page.locator('.unit-terrain')).toContainText('平地 · 每格消耗 1 移动点');
  for (const [x, y, label] of [[4, 3, '泥地'], [3, 4, '浅水']]) {
    const point = await mapPoint(page, x, y);
    await page.mouse.move(point.x, point.y);
    await expect(page.locator('.coordinates')).toHaveText(`GRID ${x + 1} : ${y + 1}`);
    await expect(page.locator('.terrain-status')).toHaveText(`${label} · 每格 2 移动点 · 此路线 2 点`);
  }
  const deep = await mapPoint(page, 4, 4);
  await page.mouse.move(deep.x, deep.y);
  await expect(page.locator('.terrain-status')).toHaveText('深水 · 不可通行');
  await page.mouse.click(deep.x, deep.y);
  await expect(page.locator('.battle-feedback')).toContainText('无法到达');
  await expect(page.locator('#undo')).toBeDisabled();
  expect(await page.evaluate(() => window.__varietyState.units[0].moved)).toBe(false);
  const shallow = await mapPoint(page, 3, 4);
  await page.mouse.click(shallow.x, shallow.y);
  await expect(page.locator('.unit-terrain')).toHaveText('浅水 · 每格消耗 2 移动点');
  await expect(page.locator('.battle-feedback')).toContainText('移动完成');
  await expect(page.locator('#move-mode')).toContainText('已移动');
  await page.locator('#undo').click();
  await expect(page.locator('.unit-terrain')).toHaveText('平地 · 每格消耗 1 移动点');
  expect(await page.evaluate(() => {
    const unit = window.__varietyState.units[0];
    return { x: unit.x, y: unit.y, moved: unit.moved };
  })).toEqual({ x: 3, y: 3, moved: false });
});

test('enemy runway breach fails immediately and result undo restores the complete battle', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installFixture(page, `
    s.terrain=s.terrain.map(row=>row.map(()=>0));
    const blue=s.units.find(u=>u.team==='blue'),red=s.units.find(u=>u.team==='red');
    Object.assign(blue,{id:1,x:20,y:16,vision:22});
    const runway=s.mission.points[0];
    Object.assign(red,{id:2,x:runway.x-1,y:runway.y,move:1});
    s.units=[blue,red];s.deployments=s.units.map(u=>({...u}));s.selectedId=1;s.aiSeed=123;
  `);
  await page.goto('/battle/airfield-defense');
  await expect(page.locator('.objective-progress')).toContainText('机场守备 0 / 5');
  const battleSnapshot = () => page.evaluate(() => {
    const { session, notice, noticeSequence, effect, movement, undoHistory, ...battle } = window.__varietyState;
    return battle;
  });
  const before = await battleSnapshot();
  await page.locator('#end-turn').click();
  const result = page.getByRole('dialog', { name: '行动失败' });
  await expect(result).toBeVisible();
  expect(await page.evaluate(() => {
    const state = window.__varietyState, red = state.units.find(u => u.team === 'red');
    return { winner: state.winner, defendedTurns: state.missionProgress.defendedTurns,
      breached: state.mission.points.some(p => p.x === red.x && p.y === red.y) };
  })).toEqual({ winner: 'red', defendedTurns: 0, breached: true });
  await result.getByRole('button', { name: /撤回最后一步/ }).click();
  await expect(result).toHaveCount(0);
  await expect(page.locator('.objective-progress')).toContainText('机场守备 0 / 5');
  await expect(page.locator('#end-turn')).toBeEnabled();
  await expect(page.locator('#undo')).toBeDisabled();
  expect(await battleSnapshot()).toEqual(before);
});
