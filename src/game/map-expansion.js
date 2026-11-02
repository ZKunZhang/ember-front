// Scale in axial space, then return to the authored offset grid. Odd rows
// acquire an extra column so every coarse hex keeps all six neighbors.
export function expandMapPoint(point,scale=2) {
  const q=point.x-Math.floor(point.y/2),y=point.y*scale;
  return {...point,x:q*scale+Math.floor(y/2),y};
}

const chineseNumber=value=>value<10?'零一二三四五六七八九'[value]:value<20?`十${value%10?'零一二三四五六七八九'[value%10]:''}`:value<100?`${'零一二三四五六七八九'[Math.floor(value/10)]}十${value%10?'零一二三四五六七八九'[value%10]:''}`:String(value);

// Selection cards use the same wording as the battlefield without allocating
// or transforming any geometry. The input metadata remains untouched.
export function describeHardScenario(meta,difficultyId) {
  if(difficultyId!=='hard'||meta.mapScale===2)return meta;
  const deadline=meta.mission?.deadline;
  const updateAreas=text=>{
    if(typeof text!=='string')return text;
    const {kind,points=[],exits=[]}=meta.mission??{};
    if(exits.length)text=text.replace(new RegExp(`(?:${chineseNumber(exits.length)}|${exits.length})格出口`,'g'),`${exits.length*4}格出口`);
    if(kind==='defend')text=text.replace(/六个|六格/g,match=>`${points.length*4}${match==='六个'?'个':'格'}`);
    if(kind==='rearguard')text=text.replace(/三处通道/g,`${points.length*4}格通道`)
      .replace(/三格(?=山口|后撤通道)/g,`${points.length*4}格`);
    return text;
  };
  const updateText=text=>{
    text=updateAreas(text);
    if(typeof text!=='string'||!Number.isFinite(deadline))return text;
    const oldChinese=chineseNumber(deadline),nextChinese=chineseNumber(deadline*2);
    return text.replace(new RegExp(`(^|[^\\d零一二三四五六七八九十百千万])(${deadline}|${oldChinese})(?=[轮輪])`,'g'),(match,prefix,value,offset)=>{
      const clause=text.slice(0,offset+prefix.length).split(/[，。；！？]/).at(-1);
      // A hold duration may happen to equal the operation deadline. Only
      // deadline wording changes; required rounds of control stay fixed.
      if(/(?:坚守|坚持|保持|持续|守住|争取)[^，。；！？]*$/.test(clause)&&!/(?:限|只有)[^，。；！？]*$/.test(clause))return match;
      return `${prefix}${value===String(deadline)?deadline*2:nextChinese}`;
    });
  };
  const result={...meta};
  for(const key of ['objective','briefing'])if(key in meta)result[key]=updateText(meta[key]);
  if(meta.routes)result.routes=meta.routes.map(updateText);
  if(meta.landmarks)result.landmarks=meta.landmarks.map(point=>({...point,label:updateText(point.label)}));
  if(meta.story){
    result.story={...meta.story};
    for(const key of ['intro','success','failure'])if(key in meta.story)result.story[key]=updateText(meta.story[key]);
  }
  if(Number.isFinite(deadline))result.mission={...meta.mission,deadline:deadline*2};
  return result;
}

const footprint=point=>{
  const anchor=expandMapPoint(point);
  return Array.from({length:4},(_,i)=>({...anchor,x:anchor.x+i%2,y:anchor.y+Math.floor(i/2),...(point.label!==undefined?{label:`${point.label} ${i+1}`}:{})}));
};

function expandFeature(value) {
  if(Array.isArray(value))return value.map(expandFeature);
  if(!value||typeof value!=='object')return value;
  const result=Number.isFinite(value.x)&&Number.isFinite(value.y)?expandMapPoint(value):{...value};
  for(const [key,nested] of Object.entries(value))if(key!=='heading'&&nested&&typeof nested==='object')result[key]=expandFeature(nested);
  return result;
}

export function enlargeHardMap(source) {
  if(source.difficultyId!=='hard'||source.mapScale===2)return source;
  const described=describeHardScenario(source,source.difficultyId);
  const cols=source.cols*2+1,rows=source.rows*2;
  const terrain=Array.from({length:rows},()=>Array(cols).fill(-1));
  for(let y=0;y<source.rows;y++)for(let x=0;x<source.cols;x++){
    const anchor=expandMapPoint({x,y});
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)terrain[anchor.y+dy][anchor.x+dx]=source.terrain[y][x];
  }
  let mission=described.mission;
  if(mission){
    const area=['defend','rearguard','breakthrough'].includes(mission.kind);
    mission={...mission,...(mission.point?{point:expandMapPoint(mission.point)}:{}),
      ...(mission.points?{points:area?mission.points.flatMap(footprint):mission.points.map(point=>expandMapPoint(point))}:{}),
      ...(mission.exits?{exits:mission.exits.flatMap(footprint)}:{})};
  }
  return {...described,cols,rows,terrain,mission,mapScale:2,authoredSize:{cols:source.cols,rows:source.rows},
    deployments:source.deployments.map(point=>expandMapPoint(point)),landmarks:described.landmarks.map(point=>expandMapPoint(point)),features:(source.features??[]).map(expandFeature)};
}
