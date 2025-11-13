let OPT = {
    selector: "#sparks",
      amount: 5000,
       speed: 0.05, // pixels per frame
    lifetime: 200,
   direction: {x: -0.5, y: 1},
        size: [3, 3],
  maxopacity: 1,
       color: "150, 150, 150",
   randColor: true,
acceleration: [5, 40]
}

if (window.innerWidth < 520) {
  OPT.speed = 0.05;
  OPT.color = "150, 150, 150";
}

(function spark() {
  // find or create a full-viewport transparent canvas at z-index 0
  let canvas = document.querySelector(OPT.selector);
  // prevent double-initialize, but allow re-init if the exported API functions
  // are missing (for example a loader removed them when disabling the effect).
  // This prevents the script from silently returning when it was previously
  // injected but later cleaned up by the page loader.
  if (window.__fridge_meteor_injected && typeof window.startMeteors === 'function' && typeof window.destroyMeteors === 'function') {
    return;
  }
  // mark as injected while runtime is active
  try { window.__fridge_meteor_injected = true; } catch (e) {}
  
  // runtime handles
  let _addInterval = null;
  let _rafId = null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = (OPT.selector && OPT.selector.startsWith('#')) ? OPT.selector.slice(1) : OPT.selector.replace(/[^a-z0-9_-]/ig,'sparks');
    // make it full-viewport and transparent, below UI (z-index 0)
    Object.assign(canvas.style, {
      position: 'fixed', left: '0', top: '0', width: '100%', height: '100%',
      zIndex: '0', pointerEvents: 'none', background: 'transparent'
    });
    document.body.appendChild(canvas);
  } else {
    // ensure existing canvas is positioned and transparent
    try {
      canvas.style.position = canvas.style.position || 'fixed';
      canvas.style.left = canvas.style.left || '0';
      canvas.style.top = canvas.style.top || '0';
      canvas.style.width = canvas.style.width || '100%';
      canvas.style.height = canvas.style.height || '100%';
      canvas.style.zIndex = canvas.style.zIndex || '0';
      canvas.style.pointerEvents = canvas.style.pointerEvents || 'none';
      canvas.style.background = canvas.style.background || 'transparent';
    } catch (e) {}
  }
  const ctx = canvas.getContext("2d");

  let sparks = [];
  
  window.addEventListener('resize', () => {
    setCanvasWidth()
  });
  
  function setCanvasWidth() {
    ctx.canvas.width  = window.innerWidth;
    ctx.canvas.height = window.innerHeight;
  }
  
  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }  

  // Init animation
  function init() {
    setCanvasWidth();
    // spawn interval (store handle so we can clear it later)
    _addInterval = window.setInterval(() => {
      if (sparks.length < OPT.amount) addSpark();
    }, 1000 / OPT.amount);

    // start RAF loop and keep handle
    _rafId = window.requestAnimationFrame(draw);
  }

  function draw() {
    // fade previous frame without darkening the page by reducing alpha of
    // existing pixels on the canvas using destination-out. This creates a
    // transparent trail that decays over time while keeping the page below
    // visible.
    try {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      // small alpha to slowly erase previous frame (tweak 0.04 as desired)
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    } catch (e) {
      // fallback to clearing if composite operations fail
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    
    sparks.forEach( (spark, i, array) => {
  
      if (spark.opacity <= 0) {
        array.splice(i, 1);
      } else {
        drawSpark(spark);
      }
      
    });
  
    _rafId = window.requestAnimationFrame(draw);
  }
  
  function Spark(x, y) {
    this.x = x;
    this.y = y;
    this.age = 0;
    this.acceleration = rand(OPT.acceleration[0], OPT.acceleration[1]);
    
    this.color = OPT.randColor
      ? rand(0,255) + "," + rand(0,255) + "," + rand(0, 255)
      : OPT.color
    
    this.opacity = OPT.maxopacity - this.age / (OPT.lifetime * rand(1, 10));
    
    this.go = function() {
      this.x += OPT.speed * OPT.direction.x * this.acceleration / 2
      this.y += OPT.speed * OPT.direction.y * this.acceleration / 2
      
      this.opacity = OPT.maxopacity - ++this.age / OPT.lifetime;
    }
  }
  
  function addSpark() {
    let x = rand(-200, window.innerWidth + 200);
    let y = rand(-200, window.innerHeight + 200);
    sparks.push(new Spark(x, y));
  }
  
  function drawSpark(spark) {
    let x = spark.x, y = spark.y;
    
    spark.go();
    
    ctx.beginPath();
    ctx.fillStyle = `rgba(${spark.color}, ${spark.opacity})`;
    ctx.rect(x, y, OPT.size[0], OPT.size[1], 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // expose lifecycle API so callers can stop/destroy the effect
  function start() { if (!_rafId) init(); }
  function stop() {
    try { if (_addInterval) { clearInterval(_addInterval); _addInterval = null; } } catch (e) {}
    try { if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; } } catch (e) {}
  }
  function destroy() {
    stop();
    try { window.removeEventListener('resize', setCanvasWidth); } catch (e) {}
    try { if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); } catch (e) {}
    sparks = [];
    // Clear the injected marker so the script can be re-run later. Try to
    // set it to false first (safer) then delete the property.
    try { window.__fridge_meteor_injected = false; } catch (e) {}
    try { delete window.__fridge_meteor_injected; } catch (e) {}
  }

  // export simple API names
  window.startMeteors = start;
  window.stopMeteors = stop;
  window.destroyMeteors = destroy;

  // Defensive re-init helper: attempts a full teardown then reloads this script
  // so the effect can be started again even if the loader removed globals.
  window.recreateMeteors = function() {
    try { if (typeof window.destroyMeteors === 'function') window.destroyMeteors(); } catch (e) {}
    try { window.startMeteors = undefined; window.stopMeteors = undefined; window.destroyMeteors = undefined; } catch (e) {}
    try { window.__fridge_meteor_injected = false; } catch (e) {}
    try { delete window.__fridge_meteor_injected; } catch (e) {}

    // Try to find the currently-loaded script element that contains "meteor.js"
    // and re-insert a cache-busted copy to force a fresh initialization.
    try {
      const scripts = Array.from(document.getElementsByTagName('script'));
      const curr = scripts.find(s => s.src && s.src.indexOf('meteor.js') !== -1);
      if (curr && curr.src) {
        const s = document.createElement('script');
        s.src = curr.src + (curr.src.indexOf('?') === -1 ? '?' : '&') + 'r=' + Date.now();
        s.async = true;
        document.head.appendChild(s);
        return;
      }
    } catch (e) {}

    // If we couldn't reload the script via src (inline case), try starting
    // the runtime again after a tick. This will do nothing if no init code is
    // available, but is a best-effort fallback.
    setTimeout(() => {
      try { if (typeof window.startMeteors === 'function') window.startMeteors(); } catch (e) {}
    }, 0);
  };

  // auto-init
  init();
})();