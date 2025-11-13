// confetti.js — layered confetti: falling background (z‑index 0) + click bursts (z‑index 2)
(function(){
  'use strict';
  if(window.__fridge_confetti_injected) return;
  window.__fridge_confetti_injected = true;

  const CONFIG = {
    fallZ: 0,
    burstZ: 500,
    density: 140,
    spawnPerFrame: 1,
    gravity: 0.15,
    airDrag: 0.995,
    windMax: 0,
    spinMin: -0.2,
    spinMax: 0.25,
    sizeMin: 4,
    sizeMax: 10,
    opacityMin: 0.65,
    opacityMax: 1,
    shapes: ['rect','confetto','circle','tri'],
    palette: ['#ff6b6b','#ffd166','#06d6a0','#118ab2','#f72585','#f77f00','#4cc9f0','#b5179e'],
    pointerEvents: 'none'
  };

  let fallCanvas, fallCtx, burstCanvas, burstCtx;
  let width,height,rafId=null,running=false;
  let fallPieces=[],burstPieces=[];
  let windT=Math.random()*1000;

  function createCanvas(z){
    const c=document.createElement('canvas');
    Object.assign(c.style,{
      position:'fixed',left:'0',top:'0',width:'100%',height:'100%',
      zIndex:z,pointerEvents:CONFIG.pointerEvents
    });
    document.body.appendChild(c);
    const ctx=c.getContext('2d');
    return [c,ctx];
  }

  function onResize(){
    const ratio=window.devicePixelRatio||1;
    width=window.innerWidth; height=window.innerHeight;
    for(const c of [fallCanvas,burstCanvas]){
      if(!c) continue;
      c.width=Math.floor(width*ratio);
      c.height=Math.floor(height*ratio);
      c.style.width=width+'px';
      c.style.height=height+'px';
      const ctx=c.getContext('2d');
      ctx.setTransform(ratio,0,0,ratio,0,0);
    }
  }

  function rand(a,b){return Math.random()*(b-a)+a;}
  function pick(a){return a[(Math.random()*a.length)|0];}

  function newPiece(x){
    const w=rand(CONFIG.sizeMin,CONFIG.sizeMax);
    const h=rand(CONFIG.sizeMin*0.6,CONFIG.sizeMax*1.2);
    return{ x:x!==undefined?x:rand(0,width), y:-20, vx:rand(-0.5,0.5), vy:rand(0.2,1), ax:0, rot:rand(0,Math.PI*2), spin:rand(CONFIG.spinMin,CONFIG.spinMax), w,h, color:pick(CONFIG.palette), opacity:rand(CONFIG.opacityMin,CONFIG.opacityMax), shape:pick(CONFIG.shapes), life:rand(4,10)*60 };
  }

  function confettiBurst(cx,cy,n){
    for(let i=0;i<(n||60);i++){
      const p=newPiece(cx+rand(-30,30));
      p.y=cy+rand(-10,10);
      const speed=rand(2,6),ang=rand(-Math.PI,Math.PI);
      p.vx=Math.cos(ang)*speed;
      p.vy=Math.sin(ang)*speed*0.6;
      p.spin=rand(CONFIG.spinMin*3,CONFIG.spinMax*3);
      burstPieces.push(p);
    }
  }

  function updatePieces(list,wind){
    for(let i=list.length-1;i>=0;i--){
      const p=list[i];
      p.ax=wind*(0.5+(p.w/CONFIG.sizeMax));
      p.vx=(p.vx+p.ax)*CONFIG.airDrag;
      p.vy=(p.vy+CONFIG.gravity)*CONFIG.airDrag;
      p.x+=p.vx; p.y+=p.vy; p.rot+=p.spin; p.life--;
      if(p.x<-20) p.x=width+20; if(p.x>width+20) p.x=-20;
      if(p.y>height+40||p.life<=0) list.splice(i,1);
    }
  }

  function drawPieces(ctx,list){
    for(const p of list){
      ctx.save(); ctx.globalAlpha=p.opacity; ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.color;
      switch(p.shape){
        case'rect':ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);break;
        case'confetto':ctx.beginPath();ctx.moveTo(-p.w/2,-p.h/2);ctx.lineTo(p.w/2,-p.h/2+p.h*0.15);ctx.lineTo(p.w/2,p.h/2);ctx.lineTo(-p.w/2,p.h/2-p.h*0.15);ctx.closePath();ctx.fill();break;
        case'circle':ctx.beginPath();ctx.arc(0,0,Math.min(p.w,p.h)/2,0,Math.PI*2);ctx.fill();break;
        case'tri':ctx.beginPath();ctx.moveTo(0,-p.h/2);ctx.lineTo(p.w/2,p.h/2);ctx.lineTo(-p.w/2,p.h/2);ctx.closePath();ctx.fill();break;
      }
      ctx.restore();
    }
  }

  function loop(){ if(!running) return; windT+=0.005; const wind=Math.sin(windT)*CONFIG.windMax;
    if(fallPieces.length<CONFIG.density){ for(let i=0;i<CONFIG.spawnPerFrame;i++) fallPieces.push(newPiece()); }
    updatePieces(fallPieces,wind); updatePieces(burstPieces,wind*0.5);
    fallCtx.clearRect(0,0,width,height); burstCtx.clearRect(0,0,width,height);
    drawPieces(fallCtx,fallPieces); drawPieces(burstCtx,burstPieces);
    rafId=requestAnimationFrame(loop);
  }

  function start(){ if(running) return; [fallCanvas,fallCtx]=createCanvas(CONFIG.fallZ); [burstCanvas,burstCtx]=createCanvas(CONFIG.burstZ); onResize(); running=true; loop(); }
  function stop(){ running=false; if(rafId) cancelAnimationFrame(rafId),rafId=null; }
  function destroy(){
    stop();
    try{
      window.removeEventListener('resize',onResize);
  window.removeEventListener('pointerdown', onPointerDown);
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  window.removeEventListener('touchstart', onPointerDown);
  window.removeEventListener('touchmove', onPointerMove);
  window.removeEventListener('touchend', onPointerUp);
  window.removeEventListener('touchcancel', onPointerUp);
  window.removeEventListener('mousedown', onPointerDown);
  window.removeEventListener('mousemove', onPointerMove);
  window.removeEventListener('mouseup', onPointerUp);
      fallCanvas?.remove(); burstCanvas?.remove();
    }catch(_){ }
    fallPieces=[]; burstPieces=[]; window.__fridge_confetti_injected=false;
  }

  // pointer trail: emit bursts while pointer is down and moving
  let __pointerActive = false;
  let __pointerX = 0, __pointerY = 0;
  let __emitterRaf = null;
  let __lastEmit = 0;
  const __EMIT_INTERVAL = 60; // ms between trail bursts

  function emitLoop(ts) {
    if (!__pointerActive) { __emitterRaf = null; return; }
    if (!__lastEmit) __lastEmit = ts;
    const elapsed = ts - __lastEmit;
    if (elapsed >= __EMIT_INTERVAL) {
      try { confettiBurst(__pointerX, __pointerY, 20); } catch (e) {}
      __lastEmit = ts;
    }
    __emitterRaf = requestAnimationFrame(emitLoop);
  }

  function startEmitter() {
    if (__emitterRaf) return;
    __lastEmit = 0;
    __emitterRaf = requestAnimationFrame(emitLoop);
  }
  function stopEmitter() {
    if (__emitterRaf) cancelAnimationFrame(__emitterRaf);
    __emitterRaf = null; __lastEmit = 0;
  }

  function onPointerDown(e){
    try {
      const pt = e.touches ? e.touches[0] : e;
      __pointerActive = true;
      __pointerX = pt.clientX; __pointerY = pt.clientY;
      if (!running) start();
      // initial large burst
      try { confettiBurst(__pointerX, __pointerY, 140); } catch (e) {}
      startEmitter();
    } catch (err) { try { console && console.warn && console.warn('confetti onPointerDown error', err); } catch (e) {} }
  }
  function onPointerMove(e){
    try {
      if (!__pointerActive) return;
      const pt = e.touches ? e.touches[0] : e;
      __pointerX = pt.clientX; __pointerY = pt.clientY;
    } catch (err) { }
  }
  function onPointerUp(e){
    try { __pointerActive = false; stopEmitter(); } catch (err) {}
  }

  window.startConfetti=start; window.stopConfetti=stop; window.destroyConfetti=destroy; window.confettiBurst=confettiBurst;

  function autoInit(){
    if(document.readyState==='complete'||document.readyState==='interactive'){
      start();
      window.addEventListener('resize',onResize);
      // pointer events (preferred)
      window.addEventListener('pointerdown',onPointerDown,{passive:true});
      window.addEventListener('pointermove',onPointerMove,{passive:true});
      window.addEventListener('pointerup',onPointerUp,{passive:true});
      window.addEventListener('pointercancel',onPointerUp,{passive:true});
      // touch fallback for browsers without pointer events
      window.addEventListener('touchstart', onPointerDown, {passive:true});
      window.addEventListener('touchmove', onPointerMove, {passive:true});
      window.addEventListener('touchend', onPointerUp, {passive:true});
      window.addEventListener('touchcancel', onPointerUp, {passive:true});
      // mouse fallbacks for devices that synthesize mouse events (some touchscreen laptops)
      window.addEventListener('mousedown', onPointerDown, {passive:true});
      window.addEventListener('mousemove', onPointerMove, {passive:true});
      window.addEventListener('mouseup', onPointerUp, {passive:true});
    } else document.addEventListener('DOMContentLoaded',autoInit);
  }
  autoInit();
})();
