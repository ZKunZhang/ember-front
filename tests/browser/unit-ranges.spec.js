import { test, expect } from '@playwright/test';
import { UNIT_TYPES } from '../../src/game/catalog.js';
import { selectMapUnit } from './unit-selection.js';

test('every unit draws blue solid movement and orange dashed fire after real selection',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.__rangeStrokes=[];
    const stroke=CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke=function(...args){
      if(this.canvas.id==='map'&&['#2468c9','#e68b36'].includes(this.strokeStyle))
        window.__rangeStrokes.push({color:this.strokeStyle,dash:this.getLineDash(),width:this.lineWidth});
      return stroke.apply(this,args);
    };
  });
  await page.route('**/src/game/engine.js*',async route=>{
    const response=await route.fetch();
    const body=(await response.text()).replace(/updateMission\(s\);\s*return s;/,`updateMission(s);
      if(s.id==='long-road-contact') {
        const blue=s.units.filter(u=>u.team==='blue');
        Object.keys(UNIT_TYPES).forEach((type,i)=>Object.assign(blue[i],UNIT_TYPES[type],{type,hp:UNIT_TYPES[type].maxHp}));
        updateFog(s);
      }
      return s;`);
    await route.fulfill({response,body});
  });
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1080});
    await page.goto('/battle/long-road-contact?formation=fireSupport');
    await selectMapUnit(page,2);
    let id=0;
    for(const unit of Object.values(UNIT_TYPES)){
      await page.evaluate(()=>{window.__rangeStrokes=[];});
      await selectMapUnit(page,++id);
      await expect(page.locator('.unit-panel')).toHaveAttribute('data-unit',String(id));
      await expect(page.locator('.unit-name')).toContainText(unit.name);
      // Canvas implementations can quantize a stored 1.9px stroke slightly below 1.9.
      await expect.poll(()=>page.evaluate(()=>window.__rangeStrokes.some(s=>s.color==='#2468c9'&&s.dash.length===0&&s.width>=1.89))).toBe(true);
      await expect.poll(()=>page.evaluate(()=>window.__rangeStrokes.some(s=>s.color==='#e68b36'&&s.dash.length===2&&s.dash.every(n=>n>0)&&s.width>=1.89))).toBe(true);
    }
    const legend=await page.evaluate(()=>{
      const move=getComputedStyle(document.querySelector('.swatch.move'));
      const fire=getComputedStyle(document.querySelector('.swatch.attack'));
      return {move:[move.borderTopColor,move.borderTopStyle],fire:[fire.borderTopColor,fire.borderTopStyle]};
    });
    expect(legend).toEqual({move:['rgb(36, 104, 201)','solid'],fire:['rgb(230, 139, 54)','dashed']});
    await page.screenshot({path:`test-results/unit-ranges-${width}.png`});
  }
  expect(errors).toEqual([]);
});

test('all nine rendered range diagrams contain the expected blue and orange pixels',async({page})=>{
  await page.goto('/battle/long-road-contact');
  const results=await page.evaluate(async()=>{
    const {UNIT_TYPES}=await import('/src/game/catalog.js');
    const {updateFog}=await import('/src/game/engine.js');
    const {createView}=await import('/src/rendering/projection.js');
    const {drawBattlefield}=await import('/src/rendering/battlefield.js');
    const {createTerrainCache}=await import('/src/rendering/cache.js');
    const gallery=document.createElement('div');gallery.id='range-audit-gallery';
    gallery.style.cssText='position:relative;z-index:100;background:#17251f;display:grid;grid-template-columns:repeat(3,420px);gap:12px;padding:16px;width:max-content';
    document.body.append(gallery);
    const results=[];
    for(const [type,spec] of Object.entries(UNIT_TYPES)){
      const card=document.createElement('div'),title=document.createElement('div'),canvas=document.createElement('canvas');
      title.style.cssText='color:#fff0d1;padding:8px;font:16px sans-serif';
      title.textContent=`${spec.name} · 移动 ${spec.move} · 射程 ${spec.minRange}–${spec.range}`;
      canvas.width=420;canvas.height=340;card.append(title,canvas);gallery.append(card);
      const state={cols:21,rows:21,advance:'right',units:[{...spec,type,id:1,team:'blue',x:10,y:10,hp:spec.maxHp}],
        selectedId:1,turn:'blue',mode:'move',winner:null,landmarks:[],terrain:Array.from({length:21},()=>Array(21).fill(0))};
      state.terrain[10][13]=1;state.terrain[11][13]=2;state.terrain[12][13]=2;
      updateFog(state);
      const ctx=canvas.getContext('2d'),view=createView(state,420,340,1.1);
      for(const cached of [false,true]){
        const cache=cached?createTerrainCache():null;
        drawBattlefield(ctx,view,state,{reducedMotion:true,cache});
        const pixels=ctx.getImageData(0,0,420,340).data;
        let blue=0,orange=0;
        for(let p=0;p<pixels.length;p+=4){
          if(Math.abs(pixels[p]-36)<24&&Math.abs(pixels[p+1]-104)<24&&Math.abs(pixels[p+2]-201)<24)blue++;
          if(Math.abs(pixels[p]-230)<24&&Math.abs(pixels[p+1]-139)<24&&Math.abs(pixels[p+2]-54)<24)orange++;
        }
        results.push({type,cached,blue,orange});cache?.clear();
      }
    }
    return results;
  });
  await page.locator('#range-audit-gallery').screenshot({path:'test-results/all-nine-unit-ranges.png'});
  for(const result of results){
    expect(result.blue,`${result.type}: visible blue movement pixels`).toBeGreaterThan(15);
    expect(result.orange,`${result.type}: visible orange firing pixels`).toBeGreaterThan(15);
  }
});
