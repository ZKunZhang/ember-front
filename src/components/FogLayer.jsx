import { memo, useEffect, useRef } from 'react';
import { createFogRenderer, FOG_FRAME_INTERVAL } from '../rendering/fog.js';
import { renderPixelRatio } from '../rendering/cache.js';

// A separate, low-resolution surface keeps ambient fog out of the battle loop.
export default memo(function FogLayer({ game, view }) {
  const canvasRef=useRef(null),rendererRef=useRef(null);
  if(!rendererRef.current)rendererRef.current=createFogRenderer();
  useEffect(()=>()=>rendererRef.current.clear(),[]);
  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas.getContext('2d'),renderer=rendererRef.current;
    const ratio=renderPixelRatio(view.width,view.height,1,900_000);
    const width=Math.round(view.width*ratio),height=Math.round(view.height*ratio);
    if(canvas.width!==width)canvas.width=width;
    if(canvas.height!==height)canvas.height=height;
    const hasFog=renderer.prepare(game,view);
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer,frame;
    const stop=()=>{clearTimeout(timer);cancelAnimationFrame(frame);};
    const draw=()=>{
      if(document.hidden)return;
      ctx.setTransform(ratio,0,0,ratio,0,0);
      renderer.draw(ctx,view,media.matches?0:performance.now());
      if(hasFog&&!media.matches&&!game.winner)timer=setTimeout(()=>{frame=requestAnimationFrame(draw);},FOG_FRAME_INTERVAL);
    };
    const restart=()=>{stop();if(!document.hidden)frame=requestAnimationFrame(draw);};
    restart();
    document.addEventListener('visibilitychange',restart);
    media.addEventListener('change',restart);
    return()=>{stop();document.removeEventListener('visibilitychange',restart);media.removeEventListener('change',restart);};
  },[game.terrain,game.fog,game.winner,view]);
  return <canvas ref={canvasRef} className="fog-layer" aria-hidden="true"/>;
});
