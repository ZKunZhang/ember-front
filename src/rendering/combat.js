import { project } from './projection.js';

export const EFFECT_DURATION = 1100;
export const IMPACT_DELAY = 170;
const clamp = value => Math.max(0,Math.min(1,value));

export function combatMotion(effects,now,reducedMotion=false) {
  if(reducedMotion)return {x:0,y:0};
  let strength=0;
  for(const effect of effects){
    const age=now-effect.started-IMPACT_DELAY;
    if(effect.amount<0&&age>=0&&age<220)strength=Math.max(strength,(effect.destroyed?4:2.5)*(1-age/220));
  }
  return strength?{x:Math.sin(now*.11)*strength,y:Math.cos(now*.14)*strength*.6}:{x:0,y:0};
}

export function vehicleKick(unit,effects,view,now,reducedMotion=false) {
  if(reducedMotion)return {x:0,y:0};
  let x=0,y=0;
  for(const effect of effects){
    const age=now-effect.started;
    if(effect.amount>=0||age<0)continue;
    if(effect.source?.id===unit.id&&age<170){
      const a=project(view,unit.x+.5,unit.y+.5),b=project(view,effect.x+.5,effect.y+.5);
      const length=Math.hypot(b.x-a.x,b.y-a.y)||1,kick=Math.sin(age/170*Math.PI)*4*view.scale;
      x-=(b.x-a.x)/length*kick;y-=(b.y-a.y)/length*kick;
    }
    if(effect.targetId===unit.id&&age>=IMPACT_DELAY&&age<IMPACT_DELAY+180){
      x+=Math.sin((age-IMPACT_DELAY)*.09)*3*view.scale*(1-(age-IMPACT_DELAY)/180);
    }
  }
  return {x,y};
}

export function drawCombat(ctx,view,effects,now,reducedMotion=false) {
  const scale=view.scale;
  const orb=(x,y,r,color,alpha=1)=>{
    ctx.globalAlpha=clamp(alpha);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,Math.PI*2);ctx.fill();
  };
  for(const effect of effects){
    const age=now-effect.started;
    if(age<0||age>=EFFECT_DURATION)continue;
    const target=project(view,effect.x+.5,effect.y+.5,14);
    const healing=effect.amount>0,color=healing?'#bcecd0':'#ffe5ae';
    ctx.save();
    if(!healing&&!reducedMotion&&effect.source&&age<IMPACT_DELAY){
      const source=project(view,effect.source.x+.5,effect.source.y+.5,19);
      const t=clamp(age/IMPACT_DELAY),arc=['artillery','rocket'].includes(effect.source.type)?Math.sin(t*Math.PI)*36*scale:0;
      const x=source.x+(target.x-source.x)*t,y=source.y+(target.y-source.y)*t-arc;
      ctx.shadowColor='#ffbb59';ctx.shadowBlur=12*scale;
      orb(source.x,source.y,(3+Math.sin(t*Math.PI)*8)*scale,'#fff3c7',1-t);
      ctx.globalAlpha=1;ctx.strokeStyle='#ffd17e';ctx.lineWidth=2.3*scale;
      ctx.beginPath();ctx.moveTo(x-(target.x-source.x)*.12,y-(target.y-source.y)*.12);ctx.lineTo(x,y);ctx.stroke();
      orb(x,y,2.8*scale,'#fff8df');
    }
    const impactAge=age-(healing?0:IMPACT_DELAY);
    if(impactAge>=0){
      const t=clamp(impactAge/(EFFECT_DURATION-IMPACT_DELAY));
      ctx.shadowBlur=0;
      if(!reducedMotion){
        if(!healing){
          // Drifting smoke and radial fragments outlive the brief white-hot impact.
          for(let i=0;i<9;i++){
            const angle=i*2.399+effect.id,spread=(8+t*32)*scale;
            orb(target.x+Math.cos(angle)*spread*.65,target.y+Math.sin(angle)*spread*.3-t*27*scale,
              (5+t*11)*scale,i%2?'#736e5c':'#42483e',Math.sin(t*Math.PI)*.32);
          }
          const flash=clamp(1-impactAge/150);
          if(flash>0){
            ctx.shadowColor='#ffbc65';ctx.shadowBlur=25*scale;
            orb(target.x,target.y,(8+(1-flash)*15)*scale,'#f5a34e',flash*.8);
            orb(target.x,target.y,(4+flash*7)*scale,'#fff6dc',flash);
            ctx.shadowBlur=0;
          }
          for(let i=0;i<12;i++){
            const angle=i*Math.PI/6+effect.id,r=(7+t*47)*scale;
            ctx.globalAlpha=(1-t)**2;ctx.strokeStyle=i%3?'#efbb72':'#e5dfc2';ctx.lineWidth=1.5*scale;
            const x=target.x+Math.cos(angle)*r,y=target.y+Math.sin(angle)*r*.65+t*t*18*scale;
            ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(angle)*5*scale,y-Math.sin(angle)*3*scale);ctx.stroke();
          }
        }
        ctx.globalAlpha=(1-t)*.65;ctx.strokeStyle=color;ctx.lineWidth=(2-t)*scale;
        ctx.beginPath();ctx.ellipse(target.x,target.y+8*scale,(8+t*39)*scale,(4+t*16)*scale,0,0,Math.PI*2);ctx.stroke();
      }
      ctx.globalAlpha=clamp((1-t)*3);ctx.textAlign='center';ctx.font=`bold ${Math.max(14,20*scale)}px monospace`;
      ctx.lineWidth=4*scale;ctx.strokeStyle='#17221c';ctx.fillStyle=color;
      const label=`${healing?'+':''}${effect.amount}`,y=target.y-22*scale-(reducedMotion?0:t*26*scale);
      ctx.strokeText(label,target.x,y);ctx.fillText(label,target.x,y);
      if(effect.destroyed){ctx.font=`600 ${Math.max(10,11*scale)}px sans-serif`;ctx.fillText('击毁',target.x,y+17*scale);}
    }
    ctx.restore();
  }
}
