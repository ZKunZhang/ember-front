import test from 'node:test';
import assert from 'node:assert/strict';
import { drawVehicleModel } from '../src/rendering/vehicles.js';
import { worldToGround } from '../src/rendering/projection.js';

const TYPES=['scout','tank','heavyTank','artillery','rocket','engineer'];
const unitFor=(type,team='blue')=>({type,team,x:4,y:3,heading:{x:1,y:-.5}});

// Keep altitude alongside ground coordinates so these checks are independent of
// camera zoom, orbit, faction colors, and the canvas implementation.
function record(unit,motion=null) {
  const polygons=[],lines=[],ellipses=[];
  const center=worldToGround({x:unit.x+.5,y:unit.y+.5});
  const ctx={
    beginPath(){},fill(){},
    ellipse(...args){ellipses.push(args);},
    createLinearGradient(){return {stops:[],addColorStop(offset,color){this.stops.push([offset,color]);}};},
  };
  drawVehicleModel({ctx,scale:1,
    p(x,y,z=0){const ground=worldToGround({x,y});return {x:ground.x-center.x,y:ground.y-center.y,z};},
    polygon(points,fill){polygons.push({points,fill:typeof fill==='object'?fill.stops:fill});},
    line(a,b,color,width){lines.push({a,b,color,width});},
  },unit,motion);
  return {polygons,lines,ellipses};
}
function extent(model,axis) {
  const values=model.polygons.flatMap(p=>p.points.map(p=>p[axis]));
  return Math.max(...values)-Math.min(...values);
}

test('vehicle classes have distinct functional silhouettes at the same scale',()=>{
  const models=Object.fromEntries(TYPES.map(type=>[type,record(unitFor(type))]));
  // Six exposed tires (outer rubber + hub), versus fourteen tracked road wheels.
  assert.equal(models.scout.ellipses.length,12);
  for(const type of TYPES.filter(type=>type!=='scout'))assert.equal(models[type].ellipses.length,28);
  assert.ok(extent(models.scout,'y')<extent(models.tank,'y'));
  assert.ok(extent(models.heavyTank,'y')>extent(models.tank,'y')*1.15);
  const highest=model=>Math.max(...model.polygons.flatMap(p=>p.points.map(p=>p.z)),...model.lines.flatMap(l=>[l.a.z??0,l.b.z??0]));
  assert.ok(highest(models.artillery)>highest(models.tank)+4);
  assert.equal(models.rocket.polygons.filter(p=>p.fill==='#536773').length,8,'launcher retains eight open square cells');
  assert.ok(models.engineer.polygons.some(p=>p.fill==='#efbf54'),'industrial equipment remains visibly yellow');
  assert.ok(extent(models.engineer,'y')>extent(models.tank,'y'),'dozer blade exceeds the tank hull width');
});

test('all vehicle geometry stays finite and inside its tabletop footprint for both factions',()=>{
  for(const type of TYPES)for(const team of ['blue','red']) {
    const model=record(unitFor(type,team));
    for(const {points} of model.polygons)for(const point of points) {
      assert.ok(Object.values(point).every(Number.isFinite),`${type}/${team}: finite geometry`);
      assert.ok(Math.abs(point.x)<=.82&&Math.abs(point.y)<=.44,`${type}/${team}: stable ground footprint`);
      assert.ok(point.z>=1&&point.z<=32,`${type}/${team}: stable model height`);
    }
    const faction=team==='blue'?'#80d6e5':'#ec7964';
    assert.ok(model.polygons.some(p=>p.fill===faction),`${type}/${team}: faction marks remain visible`);
  }
});

test('motion steers the whole vehicle and heaves its hull without moving grounded running gear',()=>{
  for(const type of TYPES) {
    const unit=unitFor(type);
    const still=record(unit);
    const moving=record(unit,{active:true,bob:2,pitch:0,roll:0,trackPhase:.3});
    assert.equal(moving.polygons.length,still.polygons.length);
    still.polygons.forEach((polygon,i)=>polygon.points.forEach((point,j)=>{
      const actual=moving.polygons[i].points[j];
      assert.ok(Math.abs(actual.x-point.x)<1e-12&&Math.abs(actual.y-point.y)<1e-12);
      assert.equal(actual.z,point.z+(point.z>6.5?2:0),`${type}: suspension preserves the running gear`);
    }));
    assert.notDeepEqual(moving.lines,still.lines,`${type}: moving running gear and hull produce new drawing commands`);
    const heading={x:0,y:1};
    assert.deepEqual(record(unit,{heading}),record({...unit,heading}),`${type}: animation heading steers the model`);
  }
});

test('models render deterministically without mutating tactical unit data',()=>{
  for(const type of TYPES) {
    const unit=Object.freeze({...unitFor(type),heading:Object.freeze({x:1,y:0})});
    assert.deepEqual(record(unit),record(unit));
    // Unrelated tactical fields, including concealed information, cannot affect art.
    assert.deepEqual(record(unit),record({...unit,hiddenEnemy:{x:20,y:8},hp:1,selected:true}));
  }
});
