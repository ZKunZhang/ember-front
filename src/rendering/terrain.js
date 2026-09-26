export function createTerrainRenderer(painter, state) {
  const { ctx, scale, p, polygon, line, tile } = painter;
  const terrainAt = (x, y) => state.terrain[y]?.[x];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const paint = (points, color, stroke, width) => polygon(points.map(point => p(...point)), color, stroke, width);

  function bridgeAxis(x, y) {
    if (terrainAt(x, y - 1) === 4 && terrainAt(x, y + 1) === 4) return 'x';
    if (terrainAt(x - 1, y) === 4 && terrainAt(x + 1, y) === 4) return 'y';
    return null;
  }
  function road(x, y, hidden) {
    const connected = directions.filter(([dx, dy]) => terrainAt(x + dx, y + dy) === 3);
    const axis = bridgeAxis(x, y);
    if (axis) {
      const q = (a, b, z = 1.5) => axis === 'x' ? p(x + a, y + b, z) : p(x + b, y + a, z);
      polygon([q(0, .11), q(1, .11), q(1, .89), q(0, .89)], hidden ? '#6a6952' : '#a99b77');
      for (let i = 0; i < 7; i++) line(q(i / 6, .12), q(i / 6, .88), hidden ? '#424d3d' : '#786d55', .8);
      for (const b of [.2, .8]) line(q(0, b, 1.7), q(1, b, 1.7), hidden ? '#888268' : '#d0b891', 1.25);
      return;
    }
    const surface = hidden ? '#69725d' : '#b6b69a';
    const shoulder = hidden ? '#505d48' : '#818b68';
    tile(x, y, shoulder, null, .15, .02);
    tile(x, y, surface, null, .22, .04);
    for (const [dx, dy] of connected) {
      const across = dx !== 0;
      const q = (a, b) => across ? p(x + .5 + dx * a, y + b, .04) : p(x + b, y + .5 + dy * a, .04);
      polygon([q(0, .15), q(.5, .15), q(.5, .85), q(0, .85)], shoulder);
      polygon([q(0, .22), q(.5, .22), q(.5, .78), q(0, .78)], surface);
    }
    for (const [dx, dy] of connected) {
      const across = dx !== 0;
      const q = (a, b) => across ? p(x + .5 + dx * a, y + b, .07) : p(x + b, y + .5 + dy * a, .07);
      for (const offset of [.34, .66]) line(q(.12, offset), q(.5, offset), hidden ? '#78775a' : '#857b59', .7);
      line(q(.34, .49), q(.41, .5), hidden ? '#8d8767' : '#c1b08a', .65);
    }
  }

  function water(x, y, hidden) {
    const shift = ((x * 11 + y * 7) % 6) / 100;
    for (let i = 0; i < 3; i++) {
      const a = x + .18 + i * .28;
      line(p(a, y + .16 + shift, .1), p(a + .012, y + .45 + shift, .1), hidden ? '#496561' : '#709a90', .65);
      line(p(a + .09, y + .56 - shift, .1), p(a + .1, y + .76 - shift, .1), hidden ? '#37534f' : '#4d7d73', .65);
    }
    // A narrow irregular bank joins each water tile to dry land without closing bridges.
    for (const [dx, dy] of directions) {
      const neighbor = terrainAt(x + dx, y + dy);
      if (neighbor === undefined || neighbor < 0 || neighbor === 4 || (neighbor === 3 && bridgeAxis(x + dx, y + dy))) continue;
      const q = (along, inset, z = .3) => dx ? p(x + (dx > 0 ? 1 - inset : inset), y + along, z) : p(x + along, y + (dy > 0 ? 1 - inset : inset), z);
      polygon([q(0, 0), q(1, 0), q(1, .05), q(.7, .095 + shift), q(.32, .07), q(0, .055)], hidden ? '#62664e' : '#a8a07a');
      line(q(.08, .075), q(.32, .09), hidden ? '#728373' : '#a3b4a0', .65);
      line(q(.68, .115), q(.91, .07), hidden ? '#728373' : '#a3b4a0', .65);
    }
  }

  function ground(x, y, hidden) {
    const type = terrainAt(x, y), variation = (x * 13 + y * 7) % 4;
    const grass = hidden ? ['#35483d', '#394c40', '#33473b', '#3b4e41'] : ['#799a61', '#829f66', '#7b985e', '#73925b'];
    tile(x, y, type === 4 ? (hidden ? '#293f3c' : '#398e9c') : grass[variation], hidden ? '#7b886519' : '#273d302c');
    if (type === 4) water(x, y, hidden);
    else if (type === 3) road(x, y, hidden);
    else {
      // Broken tufts and soft patches retain a natural field beneath the tactical grid.
      for (let i = 0; i < 4; i++) {
        const a = x + .12 + ((x * 19 + y * 7 + i * 23) % 69) / 100;
        const b = y + .14 + ((y * 17 + x * 5 + i * 29) % 67) / 100;
        const root = p(a,b,.1);
        line(root,p(a-.015,b,2),hidden?'#596b4e':'#bdd18a',.7);
        line(root,p(a+.04,b+.025,1.2),hidden?'#465d42':'#4e7044',.8);
      }

    }
  }

  function rock(x, y, size, height, seed, hidden) {
    const q = (a, b, z = 0) => [x + a * size, y + b * size, z];
    const colors = hidden ? ['#59685f', '#6a786d', '#424f49', '#879084', '#36433e'] : ['#8c9b90', '#b4beb0', '#63796f', '#d8deca', '#455d55'];
    const a = q(.02, .22), b = q(.09, .78), c = q(.5, .99), d = q(.94, .72), e = q(.99, .27), f = q(.6, .01);
    const ridge = .42 + (seed % 4) * .045;
    const g = q(.28, .35, height * .75), h = q(ridge, .62, height), i = q(.73, .52, height * .56), j = q(.48, .16, height * .63);
    paint([a, b, g], colors[2]);paint([b, c, h, g], colors[0]);
    paint([a, g, j, f], colors[1]);paint([g, h, i, j], colors[3]);
    paint([c, d, i, h], colors[2]);paint([f, j, i, e], colors[0]);paint([d, e, i], colors[4]);
    line(p(...g), p(...h), hidden ? '#83806a' : '#dbccb0', .7);
    line(p(...i), p(...d), hidden ? '#3c4838' : '#68715a', .7);
    line(p(...q(.45, .81, height * .34)), p(...q(.54, .87, height * .16)), colors[4], .65);
  }
  function mountain(x, y, hidden) {
    const seed = x * 7 + y * 13;
    const center = p(x + .56, y + .55);
    ctx.fillStyle = '#0e1d1650';ctx.beginPath();ctx.ellipse(center.x + 4 * scale, center.y + 4 * scale, 21 * scale, 10 * scale, 0, 0, Math.PI * 2);ctx.fill();
    rock(x + .015, y + .08, .85, 26 + seed % 17, seed, hidden);
    rock(x + .65, y + .52, .3, 10 + seed % 6, seed + 2, hidden);
    rock(x + .75, y + .13, .17, 5 + seed % 4, seed + 1, hidden);
  }

  function tree(x, y, height, hidden, seed) {
    const center = p(x, y);
    ctx.fillStyle = '#11291c4d';ctx.beginPath();ctx.ellipse(center.x + 4 * scale, center.y + 2 * scale, height * .28 * scale, height * .11 * scale, 0, 0, Math.PI * 2);ctx.fill();
    line(center, p(x, y, height * .82), hidden ? '#544a38' : '#795033', 3.4);
    for (const side of [-1, 1]) line(p(x, y, height * .35), { x: center.x + side * height * .19 * scale, y: center.y - height * .74 * scale }, hidden ? '#665741' : '#9c7141', 1.8);
    const colors = hidden ? ['#2d4837', '#395840', '#50684a'] : ['#315b3e', '#477d49', '#6a9b55', '#a0bc6a'];
    // Overlapping rounded foliage masses give the trees a sculpted, painted silhouette.
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.4 + seed, radius = height * (i < 6 ? .24 : .17) * scale;
      const cx = center.x + Math.cos(angle) * height * .2 * scale;
      const cy = center.y - height * (.66 + Math.sin(angle) * .19) * scale;
      ctx.beginPath();ctx.ellipse(cx, cy, radius, radius * .85, angle, 0, Math.PI * 2);
      const foliage=ctx.createRadialGradient(cx-radius*.35,cy-radius*.4,radius*.08,cx,cy,radius);
      foliage.addColorStop(0,colors[(i+1)%colors.length]);foliage.addColorStop(1,colors[i%colors.length]);
      ctx.fillStyle = foliage;ctx.fill();
      if (!hidden) {
        ctx.beginPath();ctx.ellipse(cx - radius * .2, cy - radius * .28, radius * .46, radius * .22, -.3, 0, Math.PI * 2);
        ctx.fillStyle = '#e6f4bd38';ctx.fill();
      }
    }
    for (let i = 0; i < 5; i++) {
      const leaf = p(x + Math.sin(seed + i * 3) * .28, y + Math.cos(seed + i * 2) * .3, .3);
      ctx.fillStyle = colors[(i + 1) % colors.length];
      ctx.beginPath();ctx.ellipse(leaf.x, leaf.y, 2.4 * scale, 1.1 * scale, i, 0, Math.PI * 2);ctx.fill();
    }
  }

  function bridge(x, y, hidden) {
    const axis = bridgeAxis(x, y);
    if (!axis) return;
    const q = (a, b, z = 0) => axis === 'x' ? p(x + a, y + b, z) : p(x + b, y + a, z);
    for (const b of [.12, .88]) {
      line(q(0, b, 4.5), q(1, b, 4.5), hidden ? '#858069' : '#c6b390', 1.6);
      for (const a of [.06, .5, .94]) line(q(a, b, .4), q(a, b, 5), hidden ? '#565e48' : '#827a5c', 1.4);
    }
  }
  function details(x, y, hidden) {
    const type = terrainAt(x, y);
    if (type === 1) mountain(x, y, hidden);
    if (type === 2) {
      tree(x + .27, y + .3, 27, hidden, x + y);
      tree(x + .38, y + .74, 31, hidden, x + y + 1);
      tree(x + .72, y + .46, 24, hidden, x + y + 2);
    }
    if (type === 3) bridge(x, y, hidden);
  }
  return { ground, details };
}
