import { project, VEHICLE_SCALE } from './projection.js';

export function pickUnit(game,view,point,overDestination=false) {
  let best=null,bestDistance=Infinity;
  for(const u of game.units){
    if(u.hp<=0||(u.team==='red'&&game.fog[u.y][u.x]))continue;
    const height=u.type==='scout'?10:u.type==='heavyTank'?24:17;
    const center=project(view,u.x+.5,u.y+.5,height*VEHICLE_SCALE);
    const narrow=overDestination&&u.team==='blue';
    const distance=((point.x-center.x)/((narrow?12:15)*view.scale*VEHICLE_SCALE))**2+((point.y-center.y)/((narrow?4:12)*view.scale*VEHICLE_SCALE))**2;
    if(distance>1)continue;
    // Match the nearest model, using painter depth only for exact ties.
    if(distance<bestDistance||(distance===bestDistance&&u.x>best.x)){
      best=u;bestDistance=distance;
    }
  }
  return best;
}
