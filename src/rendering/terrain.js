import { mountainMesh } from './landforms.js';

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
    const grass = hidden ? ['#343d3c', '#39413f', '#333c39', '#3d4340'] : ['#817b60', '#898066', '#77765c', '#82785f'];
    tile(x, y, type === 4 ? (hidden ? '#293f3c' : '#426c76') : grass[variation], hidden ? null : '#273d3012');
    if (type === 4) water(x, y, hidden);
    else if (type === 3) road(x, y, hidden);
    else {
      // Deterministic surface scars are decoration, never obstacles or unit intel.
      const scar = (x * 37 + y * 19) % 23;
      if (type === 0 && scar < 3) {
        const center = p(x + .48, y + .52, .15);
        ctx.save();
        const radius = (9 + scar * 3) * scale;
        const soil = ctx.createRadialGradient(center.x, center.y, radius * .1, center.x, center.y, radius);
        soil.addColorStop(0, hidden ? '#171f2090' : '#24211de0');
        soil.addColorStop(.58, hidden ? '#29302e80' : '#4b4130b0');
        soil.addColorStop(1, '#5e513500');
        ctx.translate(center.x, center.y);ctx.scale(1, .52);
        ctx.fillStyle = soil;ctx.translate(-center.x, -center.y);
        ctx.beginPath();ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);ctx.fill();
        ctx.restore();
        line(p(x + .65, y + .27, .2), p(x + .7, y + .65, .2), hidden ? '#73705b33' : '#c0a17a70', 1.2);
      }
      if (type === 0 && scar > 18) {
        for (const offset of [.32, .64]) {
          line(p(x, y + offset, .12), p(x + 1, y + offset + .08, .12), hidden ? '#20292338' : '#39362b60', 2.2);
          for (let i = 0; i < 6; i++) line(p(x + i / 6, y + offset - .035, .14), p(x + i / 6, y + offset + .05, .14), '#292c2440', .8);
        }
      }
      // Broken tufts and soft patches retain a natural field beneath the tactical grid.
      for (let i = 0; i < 4; i++) {
        const a = x + .12 + ((x * 19 + y * 7 + i * 23) % 69) / 100;
        const b = y + .14 + ((y * 17 + x * 5 + i * 29) % 67) / 100;
        const root = p(a,b,.1);
        line(root,p(a-.015,b,2),hidden?'#596b4e':'#a5a07a',.7);
        line(root,p(a+.04,b+.025,1.2),hidden?'#465d42':'#626449',.8);
      }

    }
  }

  function mountain(x, y, hidden) {
    const facets=mountainMesh(state.terrain,x,y);
    for(const [a,b,c] of facets) {
      const slope=(a[2]-c[2])*.55+(b[2]-c[2])*.25;
      const light=Math.max(22,Math.min(65,(hidden?29:49)+slope*.45));
      paint([a,b,c],`hsl(95 10% ${light}%)`);
    }
    // Texture stays on the shared surface; no cell outlines split the massif.
    const peak=facets[0][2];
    if((x+y)%3===0) {
      const shoulder=facets[5][0];
      line(p(...peak),p(...shoulder),hidden?'#68746566':'#d0c6a866',.7);
    }
  }

  function tree(x, y, height, hidden, seed) {
    const center = p(x, y);
    ctx.fillStyle = '#11291c4d';ctx.beginPath();ctx.ellipse(center.x + 4 * scale, center.y + 2 * scale, height * .28 * scale, height * .11 * scale, 0, 0, Math.PI * 2);ctx.fill();
    line(center, p(x, y, height * .82), hidden ? '#544a38' : '#795033', 3.4);
    for (const side of [-1, 1]) line(p(x, y, height * .35), { x: center.x + side * height * .19 * scale, y: center.y - height * .74 * scale }, hidden ? '#665741' : '#9c7141', 1.8);
    const colors = hidden ? ['#2d4837', '#395840', '#50684a'] : ['#303e35', '#4b5940', '#707652', '#93946b'];
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
        ctx.fillStyle = '#dfcfab24';ctx.fill();
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
      const left=terrainAt(x,y-1)===2?0:.12,right=terrainAt(x,y+1)===2?1:.88;
      const back=terrainAt(x-1,y)===2?0:.12,front=terrainAt(x+1,y)===2?1:.88;
      paint([[x+back,y+left,18],[x+front,y+left,18],[x+front,y+right,18],[x+back,y+right,18]],hidden?'#304436':'#475940');
      for(const [a,b,i] of [[.2,.2,0],[.18,.72,1],[.64,.12,2],[.66,.62,3]])
        tree(x+a,y+b,29+(x*3+y+i*7)%8,hidden,x+y+i);
    }
    if (type === 3) bridge(x, y, hidden);
  }
  return { ground, details };
}
