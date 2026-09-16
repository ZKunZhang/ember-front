import { createScenario } from '../game/scenarios.js';
const colors={'0':'#60764e','1':'#909178','2':'#385a39','3':'#b9a475','4':'#437477'};
export default function ScenarioPreview({id,difficulty}) {
  const s=createScenario(id,difficulty),p=(x,y)=>[250+(y-x)*11,18+(x+y)*5.5];
  return <svg className="scenario-preview" viewBox="0 0 450 225" aria-label={`${s.name}地形与部署预览`}>
    <defs><radialGradient id={`glow-${id}`}><stop stopColor="#475938" stopOpacity=".5"/><stop offset="1" stopColor="#19241c" stopOpacity="0"/></radialGradient></defs>
    <ellipse cx="230" cy="132" rx="220" ry="110" fill={`url(#glow-${id})`}/>
    {s.terrain.flatMap((row,y)=>row.map((t,x)=>t<0?null:<polygon key={`${x},${y}`} points={[p(x,y),p(x+1,y),p(x+1,y+1),p(x,y+1)].map(a=>a.join(',')).join(' ')} fill={colors[t]} stroke="#192b20" strokeWidth=".4"/>))}
    {s.terrain.flatMap((row,y)=>row.map((t,x)=>t!==1?null:<path key={`mountain-${x},${y}`} d={`M ${p(x+.05,y+.95).join(' ')} L ${p(x+.5,y+.5)[0]} ${p(x+.5,y+.5)[1]-9} L ${p(x+.95,y+.95).join(' ')} Z`} fill="#b0ab89" opacity=".8"/>))}
    {s.deployments.map((u,i)=>{const [x,y]=p(u.x+.5,u.y+.5);return <circle key={i} cx={x} cy={y} r="2.2" fill={u.team==='blue'?'#d0efe1':'#f4a07d'}/>;})}
  </svg>;
}
