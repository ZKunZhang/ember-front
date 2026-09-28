// Select an initially deployed vehicle through its visible model, not a roster.
export async function selectMapUnit(page, id, position) {
  const point = await page.evaluate(async ({ id, position }) => {
    const { createState } = await import('/src/game/engine.js');
    const { readRoute } = await import('/src/game/routes.js');
    const { createView, project, VEHICLE_SCALE } = await import('/src/rendering/projection.js');
    const route = readRoute(new URL(location.href));
    const state = createState(route.scenarioId, route.difficulty, route.formationId);
    const unit = state.units.find(unit => unit.id === id);
    const { x, y } = position || unit;
    const rect = document.querySelector('#map').getBoundingClientRect();
    const height = unit.type === 'scout' ? 10 : unit.type === 'heavyTank' ? 24 : 17;
    const point = project(createView(state, rect.width, rect.height), x + .5, y + .5, height * VEHICLE_SCALE);
    return { x: rect.left + point.x, y: rect.top + point.y };
  }, { id, position });
  await page.mouse.click(point.x, point.y);
}
