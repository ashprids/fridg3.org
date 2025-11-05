document.addEventListener('DOMContentLoaded', function() {
    const themeButton = document.getElementById('change-theme');
    const rssImage = document.querySelector('.rss img');
    const currentTheme = localStorage.getItem('theme') || 'dark'; // dark default
    const popupClicked = localStorage.getItem('popup1') === 'true';

    const themeTooltip = document.createElement('div');
    themeTooltip.id = 'themeTooltip';
    themeTooltip.className = 'speech-bubble';
    themeTooltip.innerHTML = '<img src="/resources/popup.png">';
    document.body.appendChild(themeTooltip);

    if (currentTheme === 'light') {
        document.body.classList.add('light');
        document.querySelector('.container').classList.add('light');
        themeButton.classList.add('light');
        themeButton.querySelector('i').classList.remove('fa-sun');
        themeButton.querySelector('i').classList.add('fa-moon');
        if (rssImage) {
            document.querySelector('.rss').classList.add('light');
            rssImage.src = '/resources/rss_light.png';
        }
        document.querySelectorAll('.post').forEach(post => post.classList.add('light'));
        document.querySelectorAll('#date').forEach(post => post.classList.add('light'));
    } else {
        themeButton.classList.add('dark');
    }

    themeButton.addEventListener('click', function() {
        document.body.classList.toggle('light');
        document.querySelector('.container').classList.toggle('light');
        document.querySelectorAll('.post').forEach(post => post.classList.toggle('light'));
        document.querySelectorAll('#date').forEach(post => post.classList.toggle('light'));
        themeButton.classList.toggle('light');
        themeButton.classList.toggle('dark');

        const icon = themeButton.querySelector('i');
        if (document.body.classList.contains('light')) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            localStorage.setItem('theme', 'light');
            if (rssImage) {
                document.querySelector('.rss').classList.add('light');
                rssImage.src = '/resources/rss_light.png';
            }
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            localStorage.setItem('theme', 'dark');
            if (rssImage) {
                document.querySelector('.rss').classList.remove('light');
                rssImage.src = '/resources/rss_dark.png';
            }
        }
    });

    // confetti generator
    function createConfetti() {
        const colors = ['#fff'];
        const shapes = ["<i class='fa-solid fa-ghost'></i>"];
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.innerHTML = shapes[Math.floor(Math.random() * shapes.length)];
        confetti.style.left = Math.random() * window.innerWidth + 'px';
        confetti.style.top = '-20px';
        confetti.style.fontSize = Math.random() * 15 + 10 + 'px';
        confetti.style.opacity = Math.random() * 0.5 + 0.5;
        confetti.style.color = colors[Math.floor(Math.random() * colors.length)];
        const duration = Math.random() * 1 + 7;
        confetti.style.animationDuration = duration + 's, ' + (Math.random() * 0.1 + 1) + 's';
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), duration * 1000);
    }

    // setInterval(createConfetti,160);
});

/* ========================= ASCII FIREWORKS =========================
   drop-in api:
     window.startAsciiFireworks(options?)  // begin animation
     window.stopAsciiFireworks()           // stop + remove
     window.toggleAsciiFireworks()         // toggle state

   options (all optional):
     {
       fps: 20,                 // target frames per second
       fontSize: 12,            // px size for ASCII grid
       palette: ["*", "o", ".", "+"], // characters used
       maxBursts: 5,            // max simultaneous bursts
       burstInterval: [250, 900], // ms range between spawns
       opacity: 0.55,           // overlay text opacity
       color: "currentColor"    // CSS color, or "rainbow"
     }
   ================================================================== */
(function () {
  if (window.__asciiFireworksInstalled) return;
  window.__asciiFireworksInstalled = true;

  const DEFAULTS = {
    fps: 20,
    fontSize: 12,
    palette: ["*", "o", ".", "+"],
    maxBursts: 5,
    burstInterval: [250, 900],
    opacity: 0.55,
    color: "currentColor"
  };

  let state = {
    running: false,
    raf: null,
    timer: null,
    opts: { ...DEFAULTS },
    grid: [],
    cols: 0,
    rows: 0,
    bursts: [],
    lastFrame: 0
  };

  function makeOverlay() {
    let el = document.getElementById("ascii-fireworks-overlay");
    if (el) return el;

    const wrapper = document.createElement("div");
    wrapper.id = "ascii-fireworks-overlay";
    Object.assign(wrapper.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "0", // behind most UI but above background
      mixBlendMode: "screen"
    });

    const pre = document.createElement("pre");
    pre.id = "ascii-fireworks-pre";
    Object.assign(pre.style, {
      position: "absolute",
      inset: "0",
      margin: "0",
      whiteSpace: "pre",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      lineHeight: "1",
      letterSpacing: "0",
      userSelect: "none",
      color: state.opts.color === "rainbow" ? "white" : state.opts.color,
      opacity: state.opts.opacity.toString(),
      background: "transparent"
    });

    wrapper.appendChild(pre);
    document.documentElement.appendChild(wrapper);
    return wrapper;
  }

  function removeOverlay() {
    const el = document.getElementById("ascii-fireworks-overlay");
    if (el) el.remove();
  }

  function resizeGrid() {
    const pre = document.getElementById("ascii-fireworks-pre");
    if (!pre) return;
    pre.style.fontSize = state.opts.fontSize + "px";

    // approximate character cell size
    const approxCharW = state.opts.fontSize * 0.6;
    const approxCharH = state.opts.fontSize * 1.6;

    const cols = Math.max(20, Math.floor(window.innerWidth / approxCharW));
    const rows = Math.max(10, Math.floor(window.innerHeight / approxCharH));
    if (cols === state.cols && rows === state.rows) return;

    state.cols = cols;
    state.rows = rows;
    state.grid = Array.from({ length: rows }, () => Array(cols).fill(" "));
  }

  function clearGrid() {
    for (let r = 0; r < state.rows; r++) {
      state.grid[r].fill(" ");
    }
  }

  function rnd(min, max) {
    return Math.random() * (max - min) + min;
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function spawnBurst() {
    if (state.bursts.length >= state.opts.maxBursts) return;

    const cx = Math.floor(rnd(state.cols * 0.1, state.cols * 0.9));
    const cy = Math.floor(rnd(state.rows * 0.2, state.rows * 0.6));
    const count = 25 + (Math.random() * 40) | 0;

    const parts = [];
    for (let i = 0; i < count; i++) {
      const ang = rnd(0, Math.PI * 2);
      const speed = rnd(0.5, 1.8);
      parts.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed * 0.6 - rnd(0.2, 0.6),
        life: rnd(20, 45),
        char: pick(state.opts.palette),
        hue: (Math.random() * 360) | 0
      });
    }

    state.bursts.push({ particles: parts, age: 0 });
  }

  function update() {
    resizeGrid();
    clearGrid();

    // occasionally spawn
    if (!state.timer) {
      const [a, b] = state.opts.burstInterval;
      state.timer = setTimeout(() => {
        spawnBurst();
        state.timer = null;
      }, (rnd(a, b)) | 0);
    }

    // physics
    for (let i = state.bursts.length - 1; i >= 0; i--) {
      const b = state.bursts[i];
      b.age++;

      for (let j = b.particles.length - 1; j >= 0; j--) {
        const p = b.particles[j];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03; // gravity
        p.life -= 1;

        // fade out by mapping to palette index?
        if (p.life <= 0 ||
            p.x < 0 || p.x >= state.cols ||
            p.y < 0 || p.y >= state.rows) {
          b.particles.splice(j, 1);
          continue;
        }

        const rr = p.y | 0;
        const cc = p.x | 0;
        if (rr >= 0 && rr < state.rows && cc >= 0 && cc < state.cols) {
          state.grid[rr][cc] = p.char;
        }
      }

      if (b.particles.length === 0) {
        state.bursts.splice(i, 1);
      }
    }

    // render
    const pre = document.getElementById("ascii-fireworks-pre");
    if (pre) {
      // rainbow mode via gradient text: not trivial for pre; instead, flash hue by shadow
      if (state.opts.color === "rainbow") {
        const hue = (performance.now() / 40) % 360;
        pre.style.textShadow = `0 0 6px hsl(${hue}, 90%, 60%)`;
      }

      // join rows
      let out = "";
      for (let r = 0; r < state.rows; r++) {
        out += state.grid[r].join("") + (r < state.rows - 1 ? "\n" : "");
      }
      pre.textContent = out;
    }
  }

  function loop(ts) {
    if (!state.running) return;
    const frameInterval = 1000 / state.opts.fps;
    if (!state.lastFrame || ts - state.lastFrame >= frameInterval) {
      update();
      state.lastFrame = ts;
    }
    state.raf = requestAnimationFrame(loop);
  }

  function startAsciiFireworks(options = {}) {
    if (state.running) return;
    state.opts = { ...DEFAULTS, ...options };
    makeOverlay();
    resizeGrid();
    state.running = true;
    state.lastFrame = 0;
    state.bursts.length = 0;
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    state.raf = requestAnimationFrame(loop);
    window.addEventListener("resize", resizeGrid);
  }

  function stopAsciiFireworks() {
    if (!state.running) return;
    state.running = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    if (state.timer) clearTimeout(state.timer);
    state.raf = null;
    state.timer = null;
    state.bursts.length = 0;
    window.removeEventListener("resize", resizeGrid);
    removeOverlay();
  }

  function toggleAsciiFireworks(options = {}) {
    if (state.running) stopAsciiFireworks();
    else startAsciiFireworks(options);
  }

  // expose
  window.startAsciiFireworks = startAsciiFireworks;
  window.stopAsciiFireworks = stopAsciiFireworks;
  window.toggleAsciiFireworks = toggleAsciiFireworks;
})();
/* ======================= /ASCII FIREWORKS ======================= */

/* ========================= ASCII FIREWORKS AUTO-INIT =========================
   Behavior:
   - Respects prefers-reduced-motion (does nothing if reduce is set)
   - Defaults to ON in dark mode only
   - URL override: ?fireworks=1 forces ON for this load
   - Persistent toggle with Ctrl+Alt+F (stores in localStorage)
   - Page opt-out via <html data-no-fireworks>
   Exposed helpers:
     window.enableAsciiFireworks()
     window.disableAsciiFireworks()
   ============================================================================ */
(function () {
  const PREF_KEY = "asciiFwPref";
  const DEFAULT_OPTS = { color: "rainbow", opacity: 0.4, fontSize: 12 };

  function shouldStart() {
    try {
      if (window.__asciiFireworksAutoDisabled) return false;
      if (document.documentElement.hasAttribute("data-no-fireworks")) return false;
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;

      const url = new URL(window.location.href);
      if (url.searchParams.get("fireworks") === "1") return true;

      const saved = localStorage.getItem(PREF_KEY);
      if (saved === "on") return true;
      if (saved === "off") return false;

      // default: start in dark color scheme only
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) {
      return false;
    }
  }

  function startIfNeeded() {
    if (shouldStart()) {
      window.startAsciiFireworks(DEFAULT_OPTS);
    }
  }

  function toggleAndPersist() {
    const running = !!document.getElementById("ascii-fireworks-overlay");
    if (running) {
      window.stopAsciiFireworks();
      try { localStorage.setItem(PREF_KEY, "off"); } catch (e) {}
    } else {
      window.startAsciiFireworks(DEFAULT_OPTS);
      try { localStorage.setItem(PREF_KEY, "on"); } catch (e) {}
    }
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startIfNeeded, { once: true });
  } else {
    startIfNeeded();
  }

  // Hotkey: Ctrl+Alt+F (or Cmd+Alt+F on mac) to toggle + persist
  window.addEventListener("keydown", (e) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const ctrlOrMeta = isMac ? e.metaKey : e.ctrlKey;
    if (ctrlOrMeta && e.altKey && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      toggleAndPersist();
    }
  });

  // Public helpers
  window.enableAsciiFireworks = function () {
    try { localStorage.setItem(PREF_KEY, "on"); } catch (e) {}
    if (!document.getElementById("ascii-fireworks-overlay")) {
      window.startAsciiFireworks(DEFAULT_OPTS);
    }
  };
  window.disableAsciiFireworks = function () {
    try { localStorage.setItem(PREF_KEY, "off"); } catch (e) {}
    window.stopAsciiFireworks();
  };
})();
/* ======================= /ASCII FIREWORKS AUTO-INIT ======================= */
