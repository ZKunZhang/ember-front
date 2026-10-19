import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  createView,
  project,
  unproject,
  DEFAULT_ZOOM,
  initialRotation,
} from '../rendering/projection.js';
import { pickUnit } from '../rendering/picking.js';
import {
  drawBattlefield,
  getBattlefieldData,
} from '../rendering/battlefield.js';
import { createTerrainCache, renderPixelRatio } from '../rendering/cache.js';
import { movementDuration } from '../game/movement.js';
import { EFFECT_DURATION } from '../rendering/combat.js';
import { onMap } from '../game/engine.js';

const initialCamera=game=>({zoom:DEFAULT_ZOOM,pan:{x:0,y:0},rotation:initialRotation(game),tilt:1});
const clampZoom=zoom=>Math.max(.65,Math.min(2.8,zoom));
const clampTilt=tilt=>Math.max(.65,Math.min(1.35,tilt));
const normalizeAngle=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const touchGesture=points=>{
  const [a,b]=[...points.values()];
  return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),angle:Math.atan2(b.y-a.y,b.x-a.x)};
};

export function useBattlefield(game, onCell, focusTarget) {
  const canvasRef = useRef(null),
    drag = useRef(null),
    effectRef = useRef([]),
    previousEffect = useRef(null),
    movementRef = useRef([]),
    previousMovement = useRef(null),
    touches=useRef(new Map()),
    pinch=useRef(null);
  const [size, setSize] = useState({ width: 800, height: 620 }),
    [camera, setCamera] = useState(()=>initialCamera(game)),
    [hover, setHover] = useState(null),
    [dragging, setDragging] = useState(false),
    [interacting,setInteracting]=useState(false);
  const cacheRef = useRef(null),
    cameraFrame = useRef(null),
    interactionTimer=useRef(null),
    cameraUpdates = useRef([]);
  if (!cacheRef.current) cacheRef.current = createTerrainCache();
  // Panning changes only the origin; fitting all map vertices is a zoom/resize task.
  const baseView = useMemo(
    () => createView(game, size.width, size.height, camera.zoom,undefined,camera),
    [game.terrain, size, camera.zoom,camera.rotation,camera.tilt],
  );
  const view = useMemo(
    () => ({
      ...baseView,
      ox: baseView.ox + camera.pan.x,
      oy: baseView.oy + camera.pan.y,
      interactive:interacting,
    }),
    [baseView, camera.pan,interacting],
  );
  const destinations = useMemo(() => getBattlefieldData(game).moves, [game]);
  const queueCamera = (update,orbit=false) => {
    if(orbit){
      clearTimeout(interactionTimer.current);
      setInteracting(true);
      interactionTimer.current=setTimeout(()=>setInteracting(false),180);
    }
    cameraUpdates.current.push(update);
    if (cameraFrame.current !== null) return;
    cameraFrame.current = requestAnimationFrame(() => {
      cameraFrame.current = null;
      const updates = cameraUpdates.current;
      cameraUpdates.current = [];
      setCamera((current) =>
        updates.reduce((next, apply) => apply(next), current),
      );
    });
  };
  const resetCamera = () => {
    cancelAnimationFrame(cameraFrame.current);
    cameraFrame.current = null;
    cameraUpdates.current = [];
    clearTimeout(interactionTimer.current);
    setInteracting(false);
    touches.current.clear();
    pinch.current=null;
    drag.current=null;
    setDragging(false);
    setCamera(initialCamera(game));
  };
  const endInteraction=()=>{
    clearTimeout(interactionTimer.current);
    setInteracting(false);
  };
  useEffect(
    () => () => {
      cancelAnimationFrame(cameraFrame.current);
      clearTimeout(interactionTimer.current);
      cameraUpdates.current = [];
      cacheRef.current.clear();
    },
    [],
  );
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width > 0 && r.height > 0)
        setSize((current) =>
          current.width === r.width && current.height === r.height
            ? current
            : { width: r.width, height: r.height },
        );
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    resetCamera();
    cacheRef.current.clear();
    setHover(null);
    effectRef.current = [];
    previousEffect.current = null;
    movementRef.current = [];
    previousMovement.current = game.movement
      ? `${game.session}:${game.movement.id}`
      : null;
  }, [game.session]);
  useEffect(()=>{
    const target=focusTarget?.point;
    if(!target||!onMap(game,target.x,target.y))return;
    setHover(null);
    queueCamera(current=>{
      const cameraView={...baseView,ox:baseView.ox+current.pan.x,oy:baseView.oy+current.pan.y};
      const point=project(cameraView,target.x+.5,target.y+.5);
      return {...current,pan:{x:current.pan.x+size.width/2-point.x,y:current.pan.y+size.height/2-point.y}};
    });
  },[focusTarget]);
  useEffect(() => {
    const canvas = canvasRef.current,
      ctx = canvas.getContext('2d'),
      dpr = renderPixelRatio(
        size.width,
        size.height,
        window.devicePixelRatio || 1,
      );
    const width = Math.round(size.width * dpr),
      height = Math.round(size.height * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const started = performance.now();
    if (
      game.movement &&
      previousMovement.current !== `${game.session}:${game.movement.id}`
    ) {
      previousMovement.current = `${game.session}:${game.movement.id}`;
      movementRef.current = movementRef.current.filter(
        (item) => item.unitId !== game.movement.unitId,
      );
      movementRef.current.push({ ...game.movement, started });
    }
    if (
      game.effect &&
      previousEffect.current !== `${game.session}:${game.effect.id}`
    ) {
      previousEffect.current = `${game.session}:${game.effect.id}`;
      const moving = movementRef.current.find(
        (item) => item.unitId === game.effect.source?.id,
      );
      const launch =
        moving && !reducedMotion
          ? Math.max(started, moving.started + movementDuration(moving))
          : started;
      effectRef.current.push({ ...game.effect, started: launch });
    }
    let frame;
    const draw = () => {
      const now = performance.now();
      movementRef.current = movementRef.current.filter(
        (item) => !reducedMotion && now - item.started < movementDuration(item),
      );
      effectRef.current = effectRef.current.filter(
        (effect) => now - effect.started < EFFECT_DURATION,
      );
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBattlefield(ctx, view, game, {
        hover,
        effects: effectRef.current,
        now,
        reducedMotion,
        movements: movementRef.current,
        cache: view.interactive?null:cacheRef.current,
        dpr,
      });
      if (effectRef.current.length || movementRef.current.length)
        frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [game, size, camera, hover,view]);
  const local = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const cell = (e) => {
    const v = local(e),
      p = unproject(view, v.x, v.y);
    return onMap(game, p.x, p.y) ? p : null;
  };
  const unitHit = (e) => {
    const point = local(e),
      ground = cell(e);
    const destination = ground && destinations.has(`${ground.x},${ground.y}`);
    return pickUnit(
      game,
      view,
      point,
      destination,
      movementRef.current,
      performance.now(),
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  };
  const click = (e) => {
    const p = cell(e),
      hit = unitHit(e);
    if (hit) onCell(hit.x, hit.y);
    else if (p) onCell(p.x, p.y);
  };
  const zoom = (delta) =>
    queueCamera((c) => ({
      ...c,
      zoom: clampZoom(c.zoom + delta),
    }),true);
  const rotate=delta=>queueCamera(c=>({...c,rotation:normalizeAngle(c.rotation+delta)}),true);
  const tilt=value=>queueCamera(c=>({...c,tilt:clampTilt(value)}),true);
  const pan = (dx) => {
    setHover(null);
    queueCamera((c) => ({ ...c, pan: { x: c.pan.x + dx, y: c.pan.y } }));
  };
  useEffect(() => {
    const el = canvasRef.current;
    const wheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta =
          e.deltaY *
          (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
        queueCamera((c) => ({
          ...c,
          zoom: Math.max(
            0.65,
            Math.min(2.8, c.zoom * Math.exp(-delta * 0.006)),
          ),
        }),true);
      } else if (
        e.deltaMode === 0 ||
        e.shiftKey ||
        Math.abs(e.deltaX) > Math.abs(e.deltaY)
      ) {
        const unit =
          e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
        const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * unit;
        const dy = e.shiftKey ? 0 : e.deltaY * unit;
        setHover(null);
        queueCamera((c) => ({
          ...c,
          pan: { x: c.pan.x - dx, y: c.pan.y - dy },
        }));
      } else if (e.deltaY) zoom(e.deltaY < 0 ? 0.1 : -0.1);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  const hoveredUnit = game.units.find(
    (u) =>
      u.id === hover?.unitId &&
      u.hp > 0 &&
      (u.team === 'blue' || !game.fog[u.y][u.x]),
  );
  const pointerHandlers = {
    onContextMenu:e=>e.preventDefault(),
    onPointerDown: (e) => {
      if(e.pointerType==='touch'){
        touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
        e.currentTarget.setPointerCapture(e.pointerId);
        if(touches.current.size>=2){
          pinch.current={...touchGesture(touches.current),camera};
          drag.current=null;
          setDragging(true);setHover(null);
          return;
        }
      }
      if ((!e.isPrimary&&e.pointerType!=='touch') || ![0,2].includes(e.button)) return;
      drag.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        pan: camera.pan,
        rotation:camera.rotation,
        tilt:camera.tilt,
        orbit:e.button===2||e.shiftKey,
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      if(touches.current.has(e.pointerId))touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pinch.current&&touches.current.size>=2){
        const current=touchGesture(touches.current),start=pinch.current;
        queueCamera(c=>({...c,zoom:clampZoom(start.camera.zoom*current.distance/start.distance),
          rotation:normalizeAngle(start.camera.rotation+normalizeAngle(current.angle-start.angle)),
          pan:{x:start.camera.pan.x+current.x-start.x,y:start.camera.pan.y+current.y-start.y}}),true);
        return;
      }
      const d = drag.current;
      if (d) {
        if (d.id !== e.pointerId) return;
        const dx = e.clientX - d.x,
          dy = e.clientY - d.y;
        if (Math.hypot(dx, dy) > 5) d.moved = true;
        if (d.moved) {
          setDragging(true);
          setHover(null);
          queueCamera((c) => d.orbit
            ? {...c,rotation:normalizeAngle(d.rotation+dx*.008),tilt:clampTilt(d.tilt+dy*.003)}
            : {...c,pan:{x:d.pan.x+dx,y:d.pan.y+dy}},d.orbit);
          return;
        }
      }
      const hit = unitHit(e),
        next = hit ? { x: hit.x, y: hit.y, unitId: hit.id } : cell(e);
      setHover((current) =>
        current?.x === next?.x &&
        current?.y === next?.y &&
        current?.unitId === next?.unitId
          ? current
          : next,
      );
    },
    onPointerUp: (e) => {
      endInteraction();
      touches.current.delete(e.pointerId);
      if(pinch.current){
        if(touches.current.size<2)pinch.current=null;
        drag.current=null;
        setDragging(false);
        if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
        return;
      }
      if (drag.current?.id !== e.pointerId) return;
      if (!drag.current.moved&&!drag.current.orbit) click(e);
      drag.current = null;
      setDragging(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
    },
    onPointerCancel: (e) => {
      endInteraction();
      touches.current.delete(e.pointerId);
      pinch.current=null;
      drag.current = null;
      setDragging(false);
    },
    onLostPointerCapture: (e) => {
      endInteraction();
      touches.current.delete(e.pointerId);
      pinch.current=null;
      drag.current = null;
      setDragging(false);
    },
    onPointerLeave: () => setHover(null),
  };
  return {
    canvasRef,
    view,
    camera,
    hover,
    hoveredUnit,
    dragging,
    pan,
    zoom,
    rotate,
    tilt,
    resetCamera,
    destinations,
    pointerHandlers,
  };
}
