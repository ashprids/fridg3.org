// ascii-fireworks.js (clean build)
// Pure-ASCII fireworks background, auto-start, no canvas.
// Small bursts + full-viewport spawn. z-index: 1.

(function () {
  'use strict';
  if (window.__fridge_ascii_fw_injected) return;
  window.__fridge_ascii_fw_injected = true;

  const CONFIG = {
    zIndex: 0,
    gravity: 0.01,
    friction: 0.980,
    spawnEveryMs: 1000,
    particlesPerBurst: 300,
    maxBursts: 8,
    fadePerFrame: 0.10,
    charset: [' ', '.', ':', '-', '+', '*', 'o', 'O', '#', '@'],
    fontSizePx: 8,
    lineHeightPx: 10,
    color: 'currentColor',
    pointerEvents: 'none'
  };

  let el = null;
  let rafId = null;
  let running = false;
  let cols = 0;
  let rows = 0;
  let field = null;   // char buffer [rows][cols]
  let intens = null;  // intensity buffer [rows][cols]
  let bursts = [];
  let lastSpawn = 0;
  let lastFrame = 0;

  function ensureHost() {
    el = document.createElement('pre');
    el.id = 'fridge-ascii-fireworks';
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      margin: '0',
      padding: '0',
      zIndex: String(CONFIG.zIndex),
      whiteSpace: 'pre',
      overflow: 'hidden',
      pointerEvents: CONFIG.pointerEvents,
      background: 'transparent',
      color: CONFIG.color,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: CONFIG.fontSizePx + 'px',
      lineHeight: CONFIG.lineHeightPx + 'px',
      letterSpacing: '0px',
      userSelect: 'none'
    });
    document.body.appendChild(el);
    recomputeGrid();
    window.addEventListener('resize', recomputeGrid);
  }

  function recomputeGrid() {
    // measure actual char cell for accurate full-width grid
    const meas = document.createElement('span');
    meas.textContent = 'MMMMMMMMMM';
    Object.assign(meas.style, {
      position: 'absolute',
      visibility: 'hidden',
      whiteSpace: 'pre',
      fontFamily: el.style.fontFamily,
      fontSize: el.style.fontSize,
      lineHeight: el.style.lineHeight,
      letterSpacing: el.style.letterSpacing
    });
    document.body.appendChild(meas);
    const rect = meas.getBoundingClientRect();
    const charW = rect.width / 10;
    const charH = rect.height;
    document.body.removeChild(meas);

    const w = window.innerWidth;
    const h = window.innerHeight;
    cols = Math.max(10, Math.floor(w / charW));
    rows = Math.max(6, Math.floor(h / charH));

    field = new Array(rows);
    intens = new Array(rows);
    for (let r = 0; r < rows; r++) {
      field[r] = new Array(cols);
      for (let c = 0; c < cols; c++) field[r][c] = ' ';
      intens[r] = new Float32Array(cols);
    }
  }

  function rand(a, b) { return Math.random() * (b - a) + a; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function Particle(x, y, vx, vy) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = rand(35, 90);
    this.age = 0;
  }
  Particle.prototype.step = function () {
    this.vx *= CONFIG.friction;
    this.vy = this.vy * CONFIG.friction + CONFIG.gravity * 0.25;
    this.x += this.vx;
    this.y += this.vy;
    this.age++;
    return this.age < this.life;
  };

  function Burst(cx, cy) {
    this.parts = [];
    const n = Math.floor(rand(CONFIG.particlesPerBurst * 0.7, CONFIG.particlesPerBurst));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.cos(rand(0, Math.PI / 2)) * rand(0.4, 1.8); // smaller
      this.parts.push(new Particle(cx, cy, Math.cos(a) * s, Math.sin(a) * s));
    }
  }
  Burst.prototype.step = function () {
    let alive = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      if (p.step()) { alive++; } else { this.parts.splice(i, 1); }
      const gx = p.x | 0;
      const gy = p.y | 0;
      if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
        intens[gy][gx] = clamp(intens[gy][gx] + 0.9, 0, 1);
      }
    }
    return alive > 0;
  };

  function fadeField() {
    for (let r = 0; r < rows; r++) {
      const row = intens[r];
      for (let c = 0; c < cols; c++) {
        const v = row[c] - CONFIG.fadePerFrame;
        row[c] = v > 0 ? v : 0;
      }
    }
  }

function drawField() {
  const shades = CONFIG.charset;
  const steps = shades.length - 1;
  for (let r = 0; r < rows; r++) {
    const rowChars = field[r];
    const rowI = intens[r];
    for (let c = 0; c < cols; c++) {
      const idx = Math.round(rowI[c] * steps);
      rowChars[c] = shades[idx];
    }
  }
  let out = '';
  for (let r = 0; r < rows; r++) {
    out += field[r].join('');
    if (r < rows - 1) out += "\n";
  }
  el.textContent = out;
}

  function spawnBurst() {
    // anywhere across the grid, with a slight top bias
    const cx = Math.floor(rand(0, cols));
    const cy = Math.floor(rand(0, rows * 0.6));
    bursts.push(new Burst(cx, cy));
    if (bursts.length > CONFIG.maxBursts) bursts.shift();
  }

  function tick(ts) {
    if (!running) return;
    if (!lastFrame) lastFrame = ts;

    if ((ts - lastSpawn) > CONFIG.spawnEveryMs) {
      spawnBurst();
      lastSpawn = ts;
    }

    fadeField();
    for (let i = bursts.length - 1; i >= 0; i--) {
      if (!bursts[i].step()) bursts.splice(i, 1);
    }
    drawField();

    lastFrame = ts;
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    if (!el) ensureHost();
    running = true;
    lastSpawn = performance.now();
    lastFrame = 0;
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function destroy() {
    stop();
    try {
      window.removeEventListener('resize', recomputeGrid);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    } catch (e) {}
    el = null; field = null; intens = null; bursts = [];
    window.__fridge_ascii_fw_injected = false;
  }

  window.startFireworks = start;
  window.stopFireworks = stop;
  window.destroyFireworks = destroy;

  function autoInit() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      ensureHost();
      start();
    } else {
      document.addEventListener('DOMContentLoaded', autoInit);
    }
  }
  autoInit();
})();
