import { worldToGround, groundToWorld } from './projection.js';

// Opaque molded plastic: faction hues stay in the body, with cream highlights.
const PALETTES = {
  blue: { hull: '#73bccc', roof: '#d4e9df', slope: '#66a4b5', side: '#568d9e', shade: '#527b8a', edge: '#fff3d9', stripe: '#80d6e5', glass: '#548caa' },
  red: { hull: '#ee9a84', roof: '#ffcfad', slope: '#d98372', side: '#bd756b', shade: '#a76c68', edge: '#fff0d5', stripe: '#ec7964', glass: '#687f9e' },
};
const BODY_FINISHES = {
  blue: {
    scout: { hull: '#8dd3d7', roof: '#e2f1df' },
    tank: { hull: '#70bbcb', roof: '#e7e9cd' },
    heavyTank: { hull: '#5aa7bd', roof: '#b9dbdc' },
    artillery: { hull: '#8ac9c4', roof: '#f3e7c9' },
    rocket: { hull: '#73b9d4', roof: '#deebdf' },
    engineer: { hull: '#82bdc5', roof: '#f2cf7a' },
  },
  red: {
    scout: { hull: '#f5ac92', roof: '#ffe0bd' },
    tank: { hull: '#eb9986', roof: '#f9d2af' },
    heavyTank: { hull: '#dc887b', roof: '#f4b79d' },
    artillery: { hull: '#efa68f', roof: '#ffe4bc' },
    rocket: { hull: '#e99485', roof: '#ffdab6' },
    engineer: { hull: '#eea08a', roof: '#f2cf7a' },
  },
};

// The base is centered on the tactical position and stays still during recoil.
export function drawVehicleBase(painter,unit) {
  const {ctx,p,polygon,scale}=painter;
  const center=p(unit.x+.5,unit.y+.5),ground=worldToGround({x:unit.x+.5,y:unit.y+.5});
  const ring=z=>Array.from({length:32},(_,i)=>{
    const angle=i*Math.PI/16,world=groundToWorld({x:ground.x+Math.cos(angle)*.61,y:ground.y+Math.sin(angle)*.61});
    return p(world.x,world.y,z);
  });
  const bottom=ring(.1),top=ring(1.7);
  ctx.save();
  ctx.shadowColor='#59667b38';ctx.shadowBlur=4*scale;ctx.shadowOffsetX=3*scale;ctx.shadowOffsetY=4*scale;
  polygon(bottom,'#a6af9c');ctx.restore();
  for(let i=0;i<32;i++) {
    const j=(i+1)%32;
    if((bottom[i].y+bottom[j].y)/2>=center.y)polygon([bottom[i],bottom[j],top[j],top[i]],'#b0bba6');
  }
  const xs=top.map(a=>a.x),ys=top.map(a=>a.y);
  const finish=ctx.createLinearGradient(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys));
  finish.addColorStop(0,'#f1edcf');finish.addColorStop(.4,'#d5ddba');finish.addColorStop(1,'#bbc9a3');
  polygon(top,finish,'#e4e7ce',.45);
  // A restrained faction mark occupies only the near section of the rim.
  const near=top.map((point,i)=>({point,i})).sort((a,b)=>b.point.y-a.point.y)[0].i;
  polygon([top[(near+31)%32],top[near],top[(near+1)%32],bottom[(near+1)%32],bottom[near],bottom[(near+31)%32]],unit.team==='blue'?'#8ccbd5':'#eea48d');
}

// Vehicle coordinates use a positive longitudinal axis toward the muzzle.
// Projection places increasing world x lower on screen, so blue faces -x.
export function drawVehicleModel(painter, unit, motion = null) {
  const { ctx, scale, p, polygon, line } = painter;
  const faction = unit.team === 'red' ? 'red' : 'blue';
  const colors = {...PALETTES[faction],...BODY_FINISHES[faction][unit.type]};
  const direction = unit.team === 'blue' ? -1 : 1;
  const heading=motion?.heading||unit.heading||{x:direction,y:0};
  const forward=worldToGround(heading),length=Math.hypot(forward.x,forward.y)||1;
  forward.x/=length;forward.y/=length;
  const q = (a, b, z = 0) => {
    // Running gear stays grounded while the sprung hull heaves and pitches.
    const suspension=motion?.active&&z>6.5?motion.bob+a*motion.pitch+b*motion.roll:0;
    const offset=groundToWorld({x:a*forward.x-b*forward.y*direction,y:a*forward.y+b*forward.x*direction});
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
    faces.sort((a, b) => a.depth - b.depth).forEach(face => polygon(face.points, face.color, colors.side, .35));
    const xs=roof.map(point=>point.x), ys=roof.map(point=>point.y);
    const finish=ctx.createLinearGradient(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys));
    finish.addColorStop(0,top);finish.addColorStop(.22,colors.edge);finish.addColorStop(.43,colors.edge);finish.addColorStop(.72,top);finish.addColorStop(1,colors.slope);
    polygon(roof, finish, colors.side, .4);
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
    ctx.fillStyle = '#53636c';ctx.beginPath();ctx.ellipse(center.x, center.y, radius * .6 * scale, radius * scale, 0, 0, Math.PI * 2);ctx.fill();
    ctx.fillStyle = '#bac8c6';ctx.beginPath();ctx.ellipse(center.x, center.y, radius * .26 * scale, radius * .52 * scale, 0, 0, Math.PI * 2);ctx.fill();
    if(motion?.active){
      const angle=motion.trackPhase*Math.PI*2;
      line({x:center.x-Math.cos(angle)*radius*.4*scale,y:center.y-Math.sin(angle)*radius*.75*scale},
        {x:center.x+Math.cos(angle)*radius*.4*scale,y:center.y+Math.sin(angle)*radius*.75*scale},'#e1e3ce',.65);
    }
  }
  function tracks(length = .88, width = .72) {
    for (const side of [-1, 1]) {
      const b = side < 0 ? -width / 2 : width / 2 - .13;
      const tread = ring(-length / 2, b, length, .13, .045);
      plate(tread.map(([a, y]) => [a, y, 2]), '#56646c');
      plate(tread.map(([a, y]) => [a, y, 6]), '#73868b', '#60737c', .6);
      for (let i = 0; i < 7; i++) {
        const a = -length / 2 + .07 + ((i + (motion?.trackPhase || 0)) % 7) * (length - .14) / 7;
        seam([a, b + .015, 6.3], [a, b + .12, 6.3], '#c3d4cc', .65);
        wheel(-length/2+.07+i*(length-.14)/6, side * width / 2, 3.1, 1.75);
      }
      seam([-length / 2 + .06, side * width / 2, 1], [length / 2 - .06, side * width / 2, 1], '#53646e', 1.1);
    }
  }
  function gun(from, to, width = 2.7) {
    seam(from, to, colors.side, width + .7);
    const a = q(...from), b = q(...to);
    line({ x: a.x - .45 * scale, y: a.y - .45 * scale }, { x: b.x - .45 * scale, y: b.y - .45 * scale }, colors.roof, width * .74);
    const angle = Math.atan2(b.y - a.y, b.x - a.x), normal = { x: -Math.sin(angle), y: Math.cos(angle) };
    line({ x: b.x - normal.x * width * scale * .62, y: b.y - normal.y * width * scale * .62 },
      { x: b.x + normal.x * width * scale * .62, y: b.y + normal.y * width * scale * .62 }, '#637784', 1.5);
  }
  function headlights(front, width, z) {
    for (const b of [-width, width]) seam([front, b - .025, z], [front, b + .025, z], '#fff3c8', 1.4);
  }

  // Box beams retain thickness when the camera or the unit heading changes.
  function beam(from, to, width, depth, color, edge = colors.edge) {
    const [a,b,z]=from,[c,d,h]=to;
    plate([[a,b-width/2,z-depth/2],[c,d-width/2,h-depth/2],[c,d-width/2,h+depth/2],[a,b-width/2,z+depth/2]],colors.side,colors.shade,.5);
    plate([[a,b+width/2,z-depth/2],[c,d+width/2,h-depth/2],[c,d+width/2,h+depth/2],[a,b+width/2,z+depth/2]],color,colors.shade,.5);
    plate([[a,b-width/2,z+depth/2],[c,d-width/2,h+depth/2],[c,d+width/2,h+depth/2],[a,b+width/2,z+depth/2]],color,edge,.55);
  }
  function stowage(a,b,z,length=.15,width=.1) {
    armor(a,b,length,width,z,3,.008,colors.slope,.012);
    for(const t of [.3,.7])seam([a+length*t,b,z+3.2],[a+length*t,b+width,z+3.2],colors.edge,.6);
  }
  function skirt(length,width,z,segments) {
    for(const side of [-1,1])for(let i=0;i<segments;i++){
      const a=-length/2+i*length/segments,b=side*width/2;
      // Broad hanging slabs, with bevelled lower corners and visible panel gaps.
      plate([[a+.012,b,z],[a+length/segments-.012,b,z],[a+length/segments-.025,b,z-4],[a+.025,b,z-4]],colors.slope,colors.shade,.7);
      seam([a+.025,b,z+.2],[a+length/segments-.025,b,z+.2],colors.edge,.8);
    }
  }

  if (unit.type === 'scout') {
    // The narrow boat-shaped body leaves all three axles exposed.
    for (const a of [-.28, 0, .28]) for (const b of [-.255, .255]) wheel(a, b, 3.4, 3.6);
    armor(-.4,-.205,.8,.41,4,5.8,.035,colors.hull,.085);
    for(const side of [-1,1])beam([-.35,side*.23,7],[.34,side*.23,7],.065,1.5,colors.roof);
    armor(-.23,-.18,.43,.36,9.8,6.2,.045,colors.roof,.065);
    plate([[.155,-.13,16],[.215,-.16,11],[.215,.16,11],[.155,.13,16]],colors.glass,colors.edge,.55);
    seam([.168,0,15.6],[.21,0,11.4],colors.roof,.9);
    for(const side of [-1,1]) {
      plate([[-.18,side*.15,15.4],[.09,side*.15,15.4],[.14,side*.18,11.4],[-.2,side*.18,11.4]],colors.glass,colors.roof,.6);
      seam([-.04,side*.16,15.4],[-.04,side*.18,11.4],colors.roof,.8);
    }
    // Small remote weapon and twin whip antennas, rather than a tank turret.
    armor(-.08,-.065,.13,.13,16,2.5,.012,colors.side,.02);
    gun([-.015,0,19],[.31,0,19.5],1.15);
    for(const b of [-.16,.13]){
      seam([-.27,b,11],[-.32,b,26+(b<0?1:-3)],colors.shade,1.05);
      seam([-.27,b,11],[-.32,b,26+(b<0?1:-3)],colors.edge,.4);
    }
    stowage(-.36,-.12,10,.12,.22);
    mark(-.14,.055,16.2,.09);headlights(.35,.15,8);
    seam([.38,-.16,5],[.38,.16,5],colors.shade,1.4);
  } else if (unit.type === 'heavyTank') {
    tracks(.99,.85);
    armor(-.48,-.35,.96,.7,4,9,.055,colors.hull,.075);
    skirt(.92,.84,12,5);
    vents(-.41,-.18,13.2,.17,.36);
    // A wide, squat turret and massive cheek blocks distinguish the heavy hull.
    armor(-.27,-.285,.59,.57,13,10,.035,colors.roof,.09);
    for(const b of [-.285,.15]) {
      armor(.015,b,.3,.135,17,7,.015,colors.hull,.035);
      seam([.09,b+.025,24.2],[.27,b+.025,24.2],colors.edge,.9);
    }
    for(const side of [-1,1])for(let i=0;i<3;i++)
      armor(-.28+i*.18,side<0?-.36:.285,.155,.075,12,3.5,.008,colors.slope,.018);
    stowage(-.31,-.2,23,.14,.4);
    hatch(-.075,-.075,23,.075);mark(-.08,.08,23.2,.16);
    armor(.21,-.105,.15,.21,17,6,.02,colors.side,.03);
    gun([.31,0,20.8],[.74,0,21.5],4.5);
    // Thermal sleeve and a thick muzzle collar read at tabletop scale.
    gun([.42,0,21],[.58,0,21.2],5.2);
    gun([.68,0,21.4],[.74,0,21.5],5.4);
    seam([-.17,-.17,25],[-.2,-.18,29],colors.shade,.75);
    headlights(.43,.27,10);
  } else if (unit.type === 'artillery') {
    tracks(1,.73);
    armor(-.49,-.285,.98,.57,4,6,.035,colors.hull,.045);
    vents(.28,-.2,10.2,.14,.23);
    // Open fighting compartment: raised side shields surround a dark well.
    armor(-.42,-.25,.53,.5,10,2,.018,colors.side,.025);
    plate([[-.37,-.19,12.3],[.08,-.19,12.3],[.08,.19,12.3],[-.37,.19,12.3]],'#6b8a92');
    for(const b of [-.255,.205])armor(-.43,b,.5,.05,11,8,.008,colors.roof,.012);
    armor(-.43,-.21,.055,.42,11,6,.008,colors.slope,.012);
    // Exposed breech, trunnions, recoil rails, and an elevated long barrel.
    armor(-.15,-.105,.33,.21,12,5,.02,colors.slope,.025);
    for(const b of [-.14,.14])beam([-.16,b,15],[.28,b,21],.045,2.1,colors.roof);
    gun([.05,0,17],[.81,0,31],3.1);
    gun([.04,0,17],[.32,0,22.2],4.5);
    gun([.75,0,29.8],[.81,0,31],4);
    for(const b of [-.23,.23]) {
      beam([-.4,b,7],[-.56,b,2.2],.065,2.3,colors.slope);
      plate([[-.56,b-.09,1],[-.56,b+.09,1],[-.56,b+.09,6],[-.56,b-.09,6]],colors.side,colors.edge,.6);
    }
    stowage(-.39,-.17,12.5,.13,.1);mark(-.32,.207,19.2,.16);
    headlights(.43,.21,8);
  } else if (unit.type === 'rocket') {
    tracks(.97,.7);
    armor(-.48,-.27,.96,.54,4,6,.035,colors.hull,.035);
    // An isolated truck-like cab sits ahead of the rotating launcher bed.
    armor(.245,-.245,.24,.49,10,9,.025,colors.roof,.025);
    plate([[.46,-.175,17.7],[.485,-.195,12.5],[.485,.195,12.5],[.46,.175,17.7]],colors.glass,colors.edge,.55);
    seam([.472,0,17.3],[.485,0,12.8],colors.roof,.8);
    for(const b of [-.23,.23])plate([[.28,b,17.8],[.42,b,17.8],[.45,b,13],[.28,b,13]],colors.glass,colors.side,.55);
    armor(-.23,-.18,.32,.36,10,4,.025,colors.side,.035);
    // A solid rectangular pod, with eight deep square launch cells.
    const back=-.46,front=.18;
    for(const b of [-.255,.255])plate([[back,b,13],[front,b,22],[front,b,30],[back,b,21]],colors.hull,colors.shade,.7);
    plate([[back,-.255,21],[front,-.255,30],[front,.255,30],[back,.255,21]],colors.roof,colors.edge,.7);
    plate([[front,-.255,22],[front,.255,22],[front,.255,30],[front,-.255,30]],colors.slope,colors.edge,.75);
    for(let row=0;row<2;row++)for(let tube=0;tube<4;tube++){
      const b=-.225+tube*.118,z=22.5+row*3.65;
      plate([[front+.003,b,z],[front+.003,b+.096,z],[front+.003,b+.096,z+2.9],[front+.003,b,z+2.9]],'#536773',colors.edge,.65);
      seam([front+.006,b+.014,z+.4],[front+.006,b+.082,z+.4],'#9ab5ba',.7);
    }
    for(const a of [-.33,-.03])seam([a,-.255,21+(a-back)*9/.64],[a,.255,21+(a-back)*9/.64],colors.side,.85);
    mark(.29,-.11,19.2,.09);headlights(.455,.19,9);
  } else if (unit.type === 'engineer') {
    const yellow='#efbf54',lightYellow='#fff0bd';
    tracks(.88,.74);
    armor(-.43,-.28,.86,.56,4,7,.035,colors.hull,.04);
    armor(.015,-.25,.34,.5,11,9,.025,yellow,.035);
    plate([[.325,-.175,18],[.355,-.205,12],[.355,.205,12],[.325,.175,18]],colors.glass,lightYellow,.6);
    for(const b of [-.235,.235])plate([[.07,b,18.5],[.27,b,18.5],[.3,b,13],[.07,b,13]],colors.glass,lightYellow,.6);
    armor(-.4,-.23,.29,.46,11,4,.018,colors.slope,.025);
    vents(-.36,-.18,15.2,.17,.22);
    stowage(-.32,.18,12,.19,.12);
    // Heavy folded knuckle boom with an exposed hydraulic piston and hook.
    armor(-.21,-.09,.18,.18,14,3,.015,yellow,.025);
    beam([-.12,0,16],[-.3,0,27],.095,3.5,yellow,lightYellow);
    beam([-.3,0,27],[.17,0,25.5],.075,2.8,yellow,lightYellow);
    seam([-.11,.055,17],[-.27,.055,25],colors.shade,2.1);
    seam([-.11,.055,17],[-.22,.055,22],lightYellow,1.1);
    seam([.17,0,25.5],[.17,0,20],colors.shade,.85);
    seam([.17,0,20],[.13,.04,19],yellow,1.5);
    // Wide curved blade with raised end plates, braced back to the chassis.
    for(const b of [-.23,.23])beam([.15,b,6],[.46,b,4],.05,2,colors.side);
    plate([[.43,-.39,2],[.53,-.39,3],[.53,.39,3],[.43,.39,2]],colors.shade);
    plate([[.53,-.39,3],[.46,-.39,10],[.46,.39,10],[.53,.39,3]],yellow,colors.side,.7);
    for(const b of [-.39,.39])plate([[.39,b,3],[.53,b,3],[.46,b,10],[.39,b,9]],colors.slope,lightYellow,.6);
    seam([.53,-.39,3],[.53,.39,3],lightYellow,1.4);
    seam([.46,-.39,10],[.46,.39,10],lightYellow,1);
    mark(.08,.065,20.2,.17);headlights(.31,.2,11);
  } else {
    // Main battle tank: compact wedge hull and low turret with a slender gun.
    tracks(.88,.72);
    armor(-.44,-.29,.88,.58,4,7.5,.05,colors.hull,.065);
    skirt(.76,.7,10,3);
    vents(-.36,-.15,11.8,.17,.3);
    armor(-.18,-.205,.44,.41,11.5,6.5,.055,colors.roof,.08);
    hatch(-.055,-.065,18,.065);mark(-.08,.065,18.2,.13);
    armor(.17,-.075,.13,.15,14,4,.018,colors.hull,.025);
    gun([.25,0,16.8],[.67,0,17.6],2.6);
    gun([.35,0,17],[.44,0,17.2],3.2);
    stowage(-.22,-.145,18,.09,.27);
    seam([-.1,-.13,20],[-.15,-.14,25],colors.shade,.7);
    seam([.32,-.2,11.7],[.32,.2,11.7],colors.edge,.8);headlights(.38,.2,9);
  }
}
