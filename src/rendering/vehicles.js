import { hexToPlane, planeToHex } from '../game/hex.js';

const PALETTES = {
  blue: { hull: '#657c84', roof: '#a0adb0', slope: '#495e66', side: '#34464e', shade: '#243039', edge: '#d4d6cc', stripe: '#80d6e5', glass: '#15333d' },
  red: { hull: '#a4826b', roof: '#d3b292', slope: '#896951', side: '#674c40', shade: '#42332e', edge: '#f3dfba', stripe: '#ec7964', glass: '#2b3334' },
};

// Vehicle coordinates use a positive longitudinal axis toward the muzzle.
// Projection places increasing world x lower on screen, so blue faces -x.
export function drawVehicleModel(painter, unit, motion = null) {
  const { ctx, scale, p, polygon, line } = painter;
  const colors = PALETTES[unit.team] || PALETTES.blue;
  const direction = unit.team === 'blue' ? -1 : 1;
  const heading=motion?.heading||unit.heading||{x:direction,y:0};
  const forward=hexToPlane(heading),length=Math.hypot(forward.x,forward.y)||1;
  forward.x/=length;forward.y/=length;
  const q = (a, b, z = 0) => {
    // Running gear stays grounded while the sprung hull heaves and pitches.
    const suspension=motion?.active&&z>6.5?motion.bob+a*motion.pitch+b*motion.roll:0;
    const offset=planeToHex({x:a*forward.x-b*forward.y*direction,y:a*forward.y+b*forward.x*direction});
    return p(unit.x+.5+offset.x,unit.y+.5+offset.y,z+suspension);
  };
  const plate = (points, fill, stroke, width) => polygon(points.map(point => q(...point)), fill, stroke, width);
  const seam = (a, b, color = colors.shade, width = .65) => line(q(...a), q(...b), color, width);
  const ring = (a, b, length, width, cut = .05) => [
    [a + cut, b], [a + length - cut, b], [a + length, b + cut], [a + length, b + width - cut],
    [a + length - cut, b + width], [a + cut, b + width], [a, b + width - cut], [a, b + cut],
  ];
  function armor(a, b, length, width, bottom, height, inset = .04, top = colors.hull, cut = .05) {
    const lower = ring(a, b, length, width, cut);
    const upper = ring(a + inset, b + inset, length - 2 * inset, width - 2 * inset, Math.max(.01, cut - inset * .4));
    const base = lower.map(point => q(...point, bottom));
    const roof = upper.map(point => q(...point, bottom + height));
    const faces = base.map((point, i) => {
      const next = (i + 1) % base.length;
      return { points: [point, base[next], roof[next], roof[i]], depth: (point.y + base[next].y) / 2,
        color: i === 0 ? colors.slope : i === 4 ? colors.side : (i < 4 ? colors.shade : colors.slope) };
    });
    faces.sort((a, b) => a.depth - b.depth).forEach(face => polygon(face.points, face.color, colors.shade, .55));
    const xs=roof.map(point=>point.x), ys=roof.map(point=>point.y);
    const finish=ctx.createLinearGradient(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys));
    finish.addColorStop(0,colors.edge);finish.addColorStop(.18,top);finish.addColorStop(.7,top);finish.addColorStop(1,colors.slope);
    polygon(roof, finish, colors.side, .65);
    for(const i of [5,6]) {
      const next=(i+1)%upper.length;
      seam([...upper[i],bottom+height],[...upper[next],bottom+height],colors.edge,.7);
    }
    seam([...upper[0], bottom + height], [...upper[1], bottom + height], colors.edge, .65);
  }
  function hatch(a, b, z, size = .1) {
    armor(a - size, b - size, size * 2, size * 2, z, 1.7, .008, colors.slope, .04);
    seam([a - .04, b, z + 2], [a + .04, b, z + 2], colors.edge, .85);
  }
  function vents(a, b, z, length = .18, width = .22) {
    plate([[a, b, z], [a + length, b, z], [a + length, b + width, z], [a, b + width, z]], colors.shade);
    for (let i = 1; i < 5; i++) seam([a + length * i / 5, b + .025, z + .3], [a + length * i / 5, b + width - .025, z + .3], colors.slope, .8);
  }
  function mark(a, b, z, length = .13) {
    plate([[a, b, z], [a + length, b, z], [a + length, b + .045, z], [a, b + .045, z]], colors.stripe);
    plate([[a, b + .075, z], [a + length, b + .075, z], [a + length, b + .12, z], [a, b + .12, z]], colors.stripe);
  }
  function wheel(a, b, z, radius = 2.2) {
    const center = q(a, b, z);
    ctx.fillStyle = '#1b2923';ctx.beginPath();ctx.ellipse(center.x, center.y, radius * .6 * scale, radius * scale, 0, 0, Math.PI * 2);ctx.fill();
    ctx.fillStyle = '#6f7765';ctx.beginPath();ctx.ellipse(center.x, center.y, radius * .26 * scale, radius * .52 * scale, 0, 0, Math.PI * 2);ctx.fill();
    if(motion?.active){
      const angle=motion.trackPhase*Math.PI*2;
      line({x:center.x-Math.cos(angle)*radius*.4*scale,y:center.y-Math.sin(angle)*radius*.75*scale},
        {x:center.x+Math.cos(angle)*radius*.4*scale,y:center.y+Math.sin(angle)*radius*.75*scale},'#a1a995',.65);
    }
  }
  function tracks(length = .88, width = .72) {
    for (const side of [-1, 1]) {
      const b = side < 0 ? -width / 2 : width / 2 - .13;
      const tread = ring(-length / 2, b, length, .13, .045);
      plate(tread.map(([a, y]) => [a, y, 2]), '#1e2924');
      plate(tread.map(([a, y]) => [a, y, 6]), '#39463b', '#202d25', .6);
      for (let i = 0; i < 7; i++) {
        const a = -length / 2 + .07 + ((i + (motion?.trackPhase || 0)) % 7) * (length - .14) / 7;
        seam([a, b + .015, 6.3], [a, b + .12, 6.3], '#85907a', .65);
        wheel(-length/2+.07+i*(length-.14)/6, side * width / 2, 3.1, 1.75);
      }
      seam([-length / 2 + .06, side * width / 2, 1], [length / 2 - .06, side * width / 2, 1], '#18251e', 1.1);
    }
  }
  function gun(from, to, width = 2.7) {
    seam(from, to, colors.shade, width + 1.1);
    const a = q(...from), b = q(...to);
    line({ x: a.x - .45 * scale, y: a.y - .45 * scale }, { x: b.x - .45 * scale, y: b.y - .45 * scale }, colors.roof, width * .56);
    const angle = Math.atan2(b.y - a.y, b.x - a.x), normal = { x: -Math.sin(angle), y: Math.cos(angle) };
    line({ x: b.x - normal.x * width * scale * .62, y: b.y - normal.y * width * scale * .62 },
      { x: b.x + normal.x * width * scale * .62, y: b.y + normal.y * width * scale * .62 }, '#26352c', 1.5);
  }
  function headlights(front, width, z) {
    for (const b of [-width, width]) seam([front, b - .025, z], [front, b + .025, z], '#d7c49a', 1.4);
  }
  const center = q(0, 0);
  ctx.fillStyle = '#07100c55';ctx.beginPath();ctx.ellipse(center.x + 2 * scale, center.y + 4 * scale, 17 * scale, 8 * scale, 0, 0, Math.PI * 2);ctx.fill();

  if (unit.type === 'scout') {
    for (const a of [-.27, 0, .27]) for (const b of [-.24, .24]) wheel(a, b, 3, 3.3);
    armor(-.39, -.23, .78, .46, 3, 7, .055);
    armor(-.21, -.19, .4, .38, 10, 6, .05, colors.roof);
    plate([[.14, -.135, 16], [.2, -.17, 12], [.2, .17, 12], [.14, .135, 16]], colors.glass);
    seam([.155, 0, 15.4], [.195, 0, 12.5], colors.edge, .65);
    vents(-.34, -.115, 10.1, .11, .23);
    hatch(-.07, 0, 16, .065);
    gun([.015, 0, 18], [.37, 0, 19], 1.2);
    seam([-.25, -.16, 14], [-.34, -.18, 27], colors.shade, 1.2);
    seam([-.25, -.16, 14], [-.34, -.18, 27], colors.edge, .45);
    mark(-.12, .055, 17.9, .095);headlights(.33, .15, 8);
  } else if (unit.type === 'heavyTank') {
    tracks(.99, .85);
    armor(-.47, -.34, .94, .68, 4, 9, .065);
    armor(-.32, -.29, .66, .58, 13, 4, .035, colors.roof);
    vents(-.41, -.14, 13.2, .14, .28);
    armor(-.23, -.255, .51, .51, 17, 9, .065, colors.hull, .085);
    for (const b of [-.32, .26]) for (let i = 0; i < 3; i++) armor(-.26 + i * .18, b, .145, .065, 11.5, 3.5, .008, colors.slope, .01);
    hatch(-.065, -.06, 26, .08);mark(-.095, .075, 26.1, .16);
    armor(.18, -.095, .16, .19, 20, 5, .02, colors.slope, .03);
    gun([.28, 0, 23], [.73, 0, 24], 4);
    seam([.4, -.27, 12.5], [.4, .27, 12.5], colors.edge, .85);headlights(.42, .25, 10);
  } else if (unit.type === 'artillery') {
    tracks(.94, .74);
    armor(-.46, -.29, .92, .58, 4, 7, .05);
    armor(-.34, -.255, .54, .51, 11, 8, .055, colors.roof);
    vents(.25, -.2, 11.2, .12, .2);
    hatch(-.2, -.08, 19, .07);mark(-.25, .08, 19.2);
    armor(.02, -.13, .23, .26, 15, 6, .025, colors.slope);
    gun([.12, 0, 19], [.8, 0, 31], 3.2);
    seam([.22, -.065, 16], [.55, -.065, 25], colors.side, 2.1);
    seam([.37, -.065, 20], [.56, -.065, 25], colors.edge, .9);
    for (const b of [-.2, .2]) seam([-.4, b, 7], [-.53, b, 1], colors.side, 2.4);
    headlights(.39, .21, 8);
  } else if (unit.type === 'rocket') {
    tracks(.96, .7);
    armor(-.46, -.27, .94, .54, 4, 6, .04);
    armor(.22, -.24, .25, .48, 10, 9, .035, colors.roof, .025);
    plate([[.435, -.17, 17], [.47, -.19, 12], [.47, .19, 12], [.435, .17, 17]], colors.glass);
    seam([.45, 0, 16], [.47, 0, 12.5], colors.edge, .7);
    armor(-.19, -.17, .26, .34, 10, 5, .035, colors.side);
    // Two rows of four square launch tubes, elevated along the same forward axis.
    for (let row = 0; row < 2; row++) for (let tube = 0; tube < 4; tube++) {
      const b = -.21 + tube * .11, back = 12 + row * 4.1, front = 22 + row * 4.1;
      plate([[-.45, b, back], [.18, b, front], [.18, b + .085, front], [-.45, b + .085, back]], row ? colors.hull : colors.side, colors.shade, .5);
      plate([[.18, b, front], [.18, b + .085, front], [.18, b + .085, front + 3.5], [.18, b, front + 3.5]], colors.edge);
      plate([[.18, b + .018, front + .7], [.18, b + .067, front + .7], [.18, b + .067, front + 2.8], [.18, b + .018, front + 2.8]], '#253229');
      seam([-.45, b, back + 3.5], [.18, b, front + 3.5], colors.roof, 1.05);
      seam([-.42, b + .085, back + 3.5], [.18, b + .085, front + 3.5], colors.slope, .9);
    }
    mark(.28, -.11, 19.2, .09);headlights(.43, .19, 9);
  } else if (unit.type === 'engineer') {
    tracks(.88, .74);
    armor(-.43, -.28, .86, .56, 4, 7, .045);
    armor(.025, -.25, .35, .5, 11, 9, .035, colors.roof, .03);
    plate([[.34, -.175, 18], [.375, -.205, 12], [.375, .205, 12], [.34, .175, 18]], colors.glass);
    armor(-.37, -.23, .28, .46, 11, 4, .02, colors.slope, .02);
    vents(-.32, -.18, 15.1, .15, .2);
    armor(-.2, -.055, .18, .13, 14, 4, .015, colors.side, .02);
    seam([-.12, 0, 16], [-.3, 0, 27], '#af9970', 3.6);
    seam([-.3, 0, 27], [.14, 0, 27], '#d6ba7c', 3.1);
    seam([-.13, .03, 17], [-.28, .03, 25], colors.edge, .9);
    seam([.14, 0, 27], [.14, 0, 22], '#263a2e', .85);
    seam([.14, 0, 22], [.11, .04, 21], '#d6ba7c', 1.3);
    plate([[.37, -.34, 3], [.53, -.34, 2], [.53, .34, 2], [.37, .34, 3]], colors.side);
    plate([[.37, -.34, 3], [.4, -.34, 8], [.4, .34, 8], [.37, .34, 3]], '#a9a48a', colors.shade, .6);
    seam([.4, -.32, 8], [.4, .32, 8], colors.edge, 1.1);
    seam([.15, -.115, 20.2], [.25, -.115, 20.2], '#e1c689', 1.7);
    seam([.2, -.18, 20.2], [.2, -.05, 20.2], '#e1c689', 1.7);
    mark(.1, .065, 20.2, .16);
  } else {
    tracks();
    armor(-.44, -.29, .88, .58, 4, 8, .055);
    vents(-.36, -.15, 12.2, .16, .3);
    armor(-.19, -.21, .44, .42, 12, 8, .055, colors.roof, .075);
    hatch(-.045, -.055, 20, .075);mark(-.085, .075, 20.2);
    armor(.15, -.08, .15, .16, 15, 4.5, .018, colors.hull, .025);
    gun([.25, 0, 18], [.66, 0, 19], 2.7);
    seam([.31, -.2, 12.2], [.31, .2, 12.2], colors.edge, .8);headlights(.38, .2, 9);
  }
}
