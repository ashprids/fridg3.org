document.addEventListener('DOMContentLoaded', function() {
  // New theme selector behavior: clicking #change-theme expands 5 icons horizontally.
  // Each option injects CSS (appended via a <style id="appended-theme-css">) and the
  // chosen option is saved as a cookie named `themeChoice`.
  const themeButton = document.getElementById('change-theme');
  if (!themeButton) return;

  // helper cookie functions
  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const d = new Date();
      d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + d.toUTCString();
    }

    // set the cookie; swallow errors in restrictive environments
    try {
      document.cookie = name + "=" + (encodeURIComponent(value) || "") + expires + "; path=/";
    } catch (e) {
      /* ignore cookie write failures */
    }
  }
  function getCookie(name) {
    const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? decodeURIComponent(v.pop()) : null;
  }

  // theme definitions (id, title, emoji, filename)
  // The CSS files live under /themes/ (e.g. /themes/cyberpunk.css)
  const THEMES = [
    { id: 'default', title: 'Default', icon: 'fa-circle', file: null },
    { id: 'light', title: 'Light', icon: 'fa-sun', file: 'light.css' },
    { id: 'cyberpunk', title: 'Cyberpunk', icon: 'fa-robot', file: 'cyberpunk.css' },
    { id: 'nord', title: 'Nord', icon: 'fa-mountain', file: 'nord.css' },
    { id: 'gruvbox', title: 'Gruvbox', icon: 'fa-mug-saucer', file: 'gruvbox.css' },
    { id: 'catppuccin', title: 'Catppuccin', icon: 'fa-cat', file: 'catppuccin.css' },
    { id: 'dracula', title: 'Dracula', icon: 'fa-ghost', file: 'dracula.css' },
    { id: 'partyattack', title: 'Disco Panic', icon: 'fa-star', file: 'discopanic.css' },
    { id: 'kumo', title: 'Kumo', icon: 'fa-cloud', file: 'kumo.css' },
    { id: 'prettyodd', title: 'Pretty Odd', icon: 'fa-fan', file: 'prettyodd.css' },
  ];

  // glow colors per theme for hover effect
  const GLOW = {
    default: '#272727ff',
    light: '#cbcbcbff',
    cyberpunk: '#7ff6ff',
    nord: '#81a1c1ff',
    gruvbox: '#d4a373',
    catppuccin: '#b4befe',
    partyattack: '#7a2424ff',
    kumo: '#923878ff',
    prettyodd: '#977D63ff',
  };

  // create / locate appended style element
  async function applyThemeById(id) {
    const theme = THEMES.find(t => t.id === id) || THEMES[0];
    
    // remove any previous injected style or link
    const existingStyle = document.getElementById('appended-theme-css');
    if (existingStyle) existingStyle.remove();
    const existingLink = document.getElementById('appended-theme-link');
    if (existingLink) existingLink.remove();

    if (theme.file) {
      const path = '/themes/' + theme.file;
      // Prefer adding a <link rel="stylesheet"> so the browser can cache the file
      // and the theme persists across navigations. Fall back to fetch+style if link fails.
      try {
        const head = document.head || document.getElementsByTagName('head')[0];
        const link = document.createElement('link');
        link.id = 'appended-theme-link';
        link.rel = 'stylesheet';
        link.href = path;
        link.crossOrigin = 'anonymous';
        link.onload = () => {/* loaded */};
        link.onerror = () => {
          console.warn('Theme link failed to load, falling back to fetch:', path);
          // fallback: fetch and inject
          fetch(path, { cache: 'no-cache' }).then(r => {
            if (!r.ok) throw new Error('status=' + r.status);
            return r.text();
          }).then(cssText => {
            const style = document.createElement('style');
            style.id = 'appended-theme-css';
            style.textContent = '\n/* Appended theme file (fallback): ' + theme.file + ' */\n' + cssText + '\n';
            const links = head.querySelectorAll('link[rel="stylesheet"]');
            if (links.length) links[links.length - 1].after(style);
            else head.appendChild(style);
          }).catch(err => console.warn('Could not fetch theme file', theme.file, err));
        };
        const links = head.querySelectorAll('link[rel="stylesheet"]');
        if (links.length) links[links.length - 1].after(link);
        else head.appendChild(link);
      } catch (err) {
        console.warn('Could not apply theme file', theme.file, err);
      }
    }

    // visually mark selected button if visible
    const opts = document.querySelectorAll('.theme-option');
    opts.forEach(el => {
      if (el.dataset && el.dataset.themeId === theme.id) el.classList.add('selected');
      else el.classList.remove('selected');
    });

    // persist choice as cookie (365 days)
    try { setCookie('themeChoice', theme.id, 365); } catch (e) { /* ignore */ }
  }

  // build the options overlay (hidden by default)
  let overlay = null;
  function makeOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'theme-options-overlay';
    // basic inline styles so no external CSS edits required
    // Make overlay visually inline with the button: transparent background,
    // no padding or border so the emojis read like text. Still positioned
    // absolutely to sit next to the palette button.
    Object.assign(overlay.style, {
      position: 'absolute',
      display: 'none',
      gap: '6px',
      padding: '0',
      background: 'transparent',
      borderRadius: '0',
      alignItems: 'center',
      zIndex: 2147483647,
      pointerEvents: 'auto',
      color: 'inherit',
      boxShadow: 'none',
      opacity: '1',
      transformOrigin: 'right center'
    });

    THEMES.forEach(t => {
      // Use a span so the emoji appears inline (no button border/box)
      const btn = document.createElement('span');
      btn.className = 'theme-option';
      btn.dataset.themeId = t.id;
      btn.title = t.title;
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      Object.assign(btn.style, {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 6px',
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '18px',
        lineHeight: '1'
      });

            // use Font Awesome icons for each theme (icon classes defined in THEMES)
            const iconEl = document.createElement('i');
            iconEl.className = 'fa-solid ' + (t.icon || 'fa-circle');
            iconEl.style.fontSize = '0.9rem';
            iconEl.style.pointerEvents = 'none';
            iconEl.style.transition = 'text-shadow 180ms ease, color 180ms ease, filter 180ms ease';
            btn.appendChild(iconEl);

            // hover glow: different color per theme
            const glow = GLOW[t.id] || GLOW.default;
            btn.addEventListener('mouseenter', () => {
              iconEl.style.textShadow = `0 0 10px ${glow}, 0 0 18px ${glow}`;
              iconEl.style.color = glow;
            });
            btn.addEventListener('mouseleave', () => {
              iconEl.style.textShadow = '';
              iconEl.style.color = '';
            });

            // initial hidden/shifted state for animation
            btn.style.transform = 'translateX(10px) rotate(-20deg) scale(0.95)';
            btn.style.opacity = '0';
            btn.style.transition = 'none';

            // activation via click or keyboard (Enter/Space)
            function activate(e) {
              if (e) e.stopPropagation();
              applyThemeById(t.id);
            }
            btn.addEventListener('click', activate);
            btn.addEventListener('keydown', (ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(ev); }
            });

      overlay.appendChild(btn);
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function showOverlay() {
    // when opening the theme overlay, ensure the script overlay is closed
    try { if (typeof hideScriptOverlay === 'function') hideScriptOverlay(true); } catch (e) {}
    const ov = makeOverlay();
    // make visible so we can measure, but keep children hidden initially
    ov.style.display = 'flex';
    ov.style.visibility = 'hidden';
    // force layout
    ov.getBoundingClientRect();

    const rect = themeButton.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
  // vertically center overlay with the button
  const top = rect.top + scrollY + (rect.height / 2) - (ov.offsetHeight / 2);
  // position overlay entirely to the left of the button with a small gap
  // so it doesn't overlap the button in the top-right corner.
  const left = (rect.left + scrollX) - ov.offsetWidth - 8; // 8px gap
  const clampedLeft = Math.max(6 + (window.scrollX || 0), left);
  ov.style.left = clampedLeft + 'px';
    ov.style.top = Math.max(6 + (window.scrollY || 0), top) + 'px';
    ov.style.visibility = '';

    // animate children rolling out from the button (right->left)
    const buttons = Array.from(ov.querySelectorAll('.theme-option'));
    buttons.forEach((btn, i) => {
      const stagger = i * 70; // ms
      btn.style.transition = `transform 360ms cubic-bezier(.2,.9,.2,1) ${stagger}ms, opacity 260ms ease ${stagger}ms`;
      // schedule the visible state
      setTimeout(() => {
        btn.style.transform = 'translateX(0px) rotate(0deg) scale(1)';
        btn.style.opacity = '1';
      }, 10);
    });
  }

  function hideOverlay(suppressOther) {
    // suppressOther: when true, do not attempt to hide the other overlay (avoids recursion)
    suppressOther = !!suppressOther;
    if (!overlay) return;
    const ov = overlay;
    const buttons = Array.from(ov.querySelectorAll('.theme-option'));
    // animate out in reverse order
    buttons.forEach((btn, idx) => {
      const stagger = idx * 50; // ms
      btn.style.transition = `transform 260ms cubic-bezier(.3,.8,.3,1) ${stagger}ms, opacity 200ms ease ${stagger}ms`;
      setTimeout(() => {
        btn.style.transform = 'translateX(10px) rotate(-20deg) scale(0.9)';
        btn.style.opacity = '0';
      }, stagger);
    });
    // hide the container after animations
    const total = buttons.length * 70 + 400;
    setTimeout(() => { ov.style.display = 'none'; }, total);
    // close the script overlay too unless explicitly suppressed
    try { if (!suppressOther && typeof hideScriptOverlay === 'function') hideScriptOverlay(true); } catch (e) {}
  }

  // toggle on button click
  themeButton.addEventListener('click', function (e) {
    e.stopPropagation();
    makeOverlay();
    if (overlay.style.display === 'flex') hideOverlay();
    else showOverlay();
  });

  // close on outside click or Esc
  window.addEventListener('click', function (e) {
    const ov = overlay; // capture current overlay reference
    if (ov && ov.style.display === 'flex' && !ov.contains(e.target) && e.target !== themeButton && !themeButton.contains(e.target)) {
      hideOverlay();
    }
  });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideOverlay(); });

  // on load, see if cookie exists and apply
  const saved = getCookie('themeChoice');
  if (saved) applyThemeById(saved);
  else applyThemeById('default');

  // clean up: if user navigates/resizes ensure overlay repositions if visible
  window.addEventListener('resize', function () { if (overlay && overlay.style.display === 'flex') showOverlay(); });

  // end replacement of theme toggle behavior
});

// ========= Script toggle menu (vertical) =========
document.addEventListener('DOMContentLoaded', function () {
  // local glow mapping for script overlay (duplicate of theme glow for safe scoping)
  const GLOW = {
    default: '#a6a6a6ff'
  };

  // saved overflow values so we can restore the page's horizontal scroll state
  let __saved_overflow_x = { html: null, body: null };

  // reuse cookie helpers from above by redefining (safe if this file is included once)
  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const d = new Date(); d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + d.toUTCString();
    }
    document.cookie = name + "=" + (encodeURIComponent(value) || "") + expires + "; path=/";
  }
  function getCookie(name) {
    const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? decodeURIComponent(v.pop()) : null;
  }

  // script menu definitions (id, title, filename). first id 'none' disables.
  const SCRIPTS = [
    { id: 'none', title: 'Disable', icon: 'fa-xmark', file: null },
    { id: 'rain', title: 'Rain', icon: 'fa-umbrella', file: 'rain.js' },
    { id: 'snow', title: 'Snow', icon: 'fa-snowflake', file: 'snow.js' },
    { id: 'meteor', title: 'Meteor', icon: 'fa-meteor', file: 'meteor.js' },
    { id: 'confetti', title: 'Confetti', icon: 'fa-gift', file: 'confetti.js' },
    { id: 'fireworks', title: 'Fireworks', icon: 'fa-bomb', file: 'fireworks.js' }
  ];

  // track the polling interval for snow script loading to prevent memory leaks
  let snowLoadPollInterval = null;

  // use the existing theme button as the trigger for the script overlay
  // so the script menu appears when the theme button is pressed
  let scriptButton = document.getElementById('script-menu-button');
  if (!scriptButton) {
    scriptButton = document.getElementById('change-theme');
  }

  // overlay for scripts (vertical)
  let scriptOverlay = null;
  function makeScriptOverlay() {
    if (scriptOverlay) return scriptOverlay;
    scriptOverlay = document.createElement('div');
    scriptOverlay.className = 'script-options-overlay';
    // Styled like the theme overlay but vertical and icon-only
    Object.assign(scriptOverlay.style, {
      position: 'absolute',
      display: 'none',
      flexDirection: 'column',
      gap: '22px', // match theme overlay gap
      padding: '0',
      background: 'transparent',
      borderRadius: '0',
      alignItems: 'center',
      zIndex: 2147483647,
      pointerEvents: 'auto',
      color: 'inherit'
    });

    SCRIPTS.forEach(s => {
      const el = document.createElement('span');
      el.className = 'script-option';
      el.dataset.scriptId = s.id;
      el.title = s.title;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      // icon-only button styled like theme icons
      Object.assign(el.style, {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px', // match theme buttons' horizontal padding
        color: 'inherit',
        cursor: 'pointer',
        background: 'transparent',
        border: 'none',
        borderRadius: '4px'
      });
      const ic = document.createElement('i');
      ic.className = 'fa-solid ' + (s.icon || 'fa-square');
      ic.style.fontSize = '0.9rem';
      ic.style.pointerEvents = 'none';
      ic.style.transition = 'text-shadow 180ms ease, color 180ms ease, filter 180ms ease';
      el.appendChild(ic);
    // hover glow similar to theme icons
      const glowColor = GLOW[s.id] || GLOW.default;
      el.addEventListener('mouseenter', () => { ic.style.textShadow = `0 0 10px ${glowColor}, 0 0 18px ${glowColor}`; ic.style.color = glowColor; });
      el.addEventListener('mouseleave', () => { ic.style.textShadow = ''; ic.style.color = ''; });
    // ensure initial hidden state so first reveal animates
    el.style.transform = 'translateY(-8px)';
    el.style.opacity = '0';
    el.style.transition = 'none';

    el.addEventListener('click', (ev) => { ev.stopPropagation(); applyScriptById(s.id); });
      el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); applyScriptById(s.id); } });

      scriptOverlay.appendChild(el);
    });

    document.body.appendChild(scriptOverlay);
    return scriptOverlay;
  }

  function showScriptOverlay() {
    // when opening the script overlay, ensure the theme overlay is closed
    try { if (typeof hideOverlay === 'function') hideOverlay(true); } catch (e) {}
    const ov = makeScriptOverlay();
    ov.style.display = 'flex';
    // make invisible but present so we can measure its size reliably
    ov.style.visibility = 'hidden';
    // force layout so offsetWidth/offsetHeight reflect content
    ov.getBoundingClientRect();
    const rect = scriptButton.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    // position below the button, aligning the right edge of the overlay to the button
    let left = rect.left + scrollX + (rect.width / 2) - (ov.offsetWidth / 2);
    // fall back to right-align if centering produces NaN or unusable value
    if (!isFinite(left) || isNaN(left)) left = rect.right + scrollX - ov.offsetWidth - 8;
  // add a slightly larger gap so the first script icon isn't flush against the button
  const top = rect.bottom + scrollY + 14;
    ov.style.left = Math.max(6 + (window.scrollX || 0), left) + 'px';
    ov.style.top = Math.max(6 + (window.scrollY || 0), top) + 'px';
    // now make visible
    ov.style.visibility = '';
    // prevent the overlay from causing horizontal scrollbars by temporarily
    // disabling horizontal overflow on html/body. Save previous values so we
    // can restore them when the overlay is hidden.
    try {
      if (__saved_overflow_x.html === null) __saved_overflow_x.html = document.documentElement.style.overflowX || '';
      if (__saved_overflow_x.body === null) __saved_overflow_x.body = document.body.style.overflowX || '';
      document.documentElement.style.overflowX = 'hidden';
      document.body.style.overflowX = 'hidden';
    } catch (e) {}
    // animate entries (simple fade/slide down)
    const items = Array.from(ov.querySelectorAll('.script-option'));
    items.forEach((it, i) => {
      // ensure there's a small stagger and enable transitions for first reveal
      // (we previously set transform/opacity/transition on creation)
      // force reflow to ensure the browser picks up the starting state
      it.getBoundingClientRect();
      it.style.transition = `transform 240ms ease ${i*40}ms, opacity 200ms ease ${i*40}ms`;
      setTimeout(() => { it.style.transform = 'translateY(0)'; it.style.opacity = '1'; }, 10 + i*40);
    });
  }

  function hideScriptOverlay(suppressOther) {
    // suppressOther: when true, do not attempt to hide the other overlay (avoids recursion)
    suppressOther = !!suppressOther;
    if (!scriptOverlay) return;
    const items = Array.from(scriptOverlay.querySelectorAll('.script-option'));
    // animate out with the same timing/stagger as the theme overlay
    items.forEach((it, idx) => {
      const stagger = idx * 50; // ms (match theme hide stagger)
      it.style.transition = `transform 260ms cubic-bezier(.3,.8,.3,1) ${stagger}ms, opacity 200ms ease ${stagger}ms`;
      setTimeout(() => { it.style.transform = 'translateY(-6px)'; it.style.opacity = '0'; }, stagger);
    });
    // hide the container after animations (match theme total)
    const total = items.length * 70 + 400;
    setTimeout(() => {
      scriptOverlay.style.display = 'none';
      // restore any overflow-x we changed when opening the overlay
      try {
        if (__saved_overflow_x.html !== null) { document.documentElement.style.overflowX = __saved_overflow_x.html; __saved_overflow_x.html = null; }
        if (__saved_overflow_x.body !== null) { document.body.style.overflowX = __saved_overflow_x.body; __saved_overflow_x.body = null; }
      } catch (e) {}
    }, total);
    // close theme overlay too unless explicitly suppressed
    try { if (!suppressOther && typeof hideOverlay === 'function') hideOverlay(true); } catch (e) {}
  }

  // add click handler to button
  // also toggle when the theme button is clicked (keeps them in sync)
  scriptButton.addEventListener('click', function (e) { e.stopPropagation(); makeScriptOverlay(); if (scriptOverlay.style.display === 'flex') hideScriptOverlay(); else showScriptOverlay(); });

  // apply script: remove existing, then add new <script> if file provided
  function applyScriptById(id) {
    const script = SCRIPTS.find(s => s.id === id) || SCRIPTS[0];

  // clear any pending snow load polling interval to prevent memory leaks
  if (snowLoadPollInterval) {
    clearInterval(snowLoadPollInterval);
    snowLoadPollInterval = null;
  }
  // attempt to stop any running effects from previously loaded scripts
  try { if (window.__frdg3_snow && window.__frdg3_snow.stop) window.__frdg3_snow.stop(); } catch (e) {}
  // rain API (vanilla rain script)
  try { if (window.__frdg3_rain && window.__frdg3_rain.stop) window.__frdg3_rain.stop(); } catch (e) {}
    // remove previous appended script element
    const existing = document.getElementById('appended-script');
    if (existing) existing.remove();
    // also remove snow global so re-inject creates clean state
    try { if (window.__frdg3_snow) { try { window.__frdg3_snow.stop(); } catch (e) {} ; delete window.__frdg3_snow; } } catch (e) {}
    // attempt to stop/destroy any fireworks- or confetti-like effects and remove their DOM
    try { if (typeof window.stopFireworks === 'function') { try { window.stopFireworks(); } catch (e) {} } } catch (e) {}
    try { if (typeof window.destroyFireworks === 'function') { try { window.destroyFireworks(); } catch (e) {} } } catch (e) {}
    // also support alternate API names used in other versions
    try { if (typeof window.stopAsciiFireworks === 'function') { try { window.stopAsciiFireworks(); } catch (e) {} } } catch (e) {}
    try { if (typeof window.disableAsciiFireworks === 'function') { try { window.disableAsciiFireworks(); } catch (e) {} } } catch (e) {}
    // confetti API
    try { if (typeof window.stopConfetti === 'function') { try { window.stopConfetti(); } catch (e) {} } } catch (e) {}
    try { if (typeof window.destroyConfetti === 'function') { try { window.destroyConfetti(); } catch (e) {} } } catch (e) {}
  // meteor API
  try { if (typeof window.stopMeteors === 'function') { try { window.stopMeteors(); } catch (e) {} } } catch (e) {}
  try { if (typeof window.destroyMeteors === 'function') { try { window.destroyMeteors(); } catch (e) {} } } catch (e) {}
    // compatibility/shim names
    try { if (typeof window.stopSnow === 'function') { try { window.stopSnow(); } catch (e) {} } } catch (e) {}
    // delete exported globals/guards so re-injection is clean
    try { delete window.startFireworks; delete window.stopFireworks; delete window.destroyFireworks; } catch (e) {}
    try { delete window.startAsciiFireworks; delete window.stopAsciiFireworks; delete window.toggleAsciiFireworks; delete window.disableAsciiFireworks; } catch (e) {}
    try { delete window.startConfetti; delete window.stopConfetti; delete window.destroyConfetti; delete window.confettiBurst; } catch (e) {}
    try { delete window.startMeteors; delete window.stopMeteors; delete window.destroyMeteors; } catch (e) {}
  try { if (window.__fridge_ascii_fw_injected) delete window.__fridge_ascii_fw_injected; } catch (e) {}
  try { if (window.__fridge_confetti_injected) delete window.__fridge_confetti_injected; } catch (e) {}
  try { if (window.__frdg3_rain) delete window.__frdg3_rain; } catch (e) {}
    // forced DOM cleanup: remove known overlays/elements left behind by scripts
    try {
  const sel = ['.confetti', '#fridge-ascii-fireworks', '#ascii-fireworks-overlay', '#ascii-fireworks-pre', '#fridge-confetti-canvas', '#sparks', '.rain', '.drop', '.rain.front-row', '.rain.back-row'];
      sel.forEach(s => { document.querySelectorAll && document.querySelectorAll(s).forEach(el => { try { el.remove(); } catch (e) {} }); });
    } catch (e) {}
    if (script.file) {
      const head = document.head || document.getElementsByTagName('head')[0];
      const el = document.createElement('script');
      el.id = 'appended-script';
      el.src = '/themes/' + script.file + '?_=' + Date.now();
      el.defer = true;
      head.appendChild(el);
      try { console.debug && console.debug('script-loader: injected', script.id, el.src); } catch (e) {}
      // if this is the snow script, poll for its start API and call start when ready
      if (script.id === 'snow') {
        (function waitAndStart() {
          const max = 1500; // ms
          const interval = 80;
          let waited = 0;
          snowLoadPollInterval = setInterval(() => {
            try {
              if (window.__frdg3_snow && window.__frdg3_snow.start) {
                window.__frdg3_snow.start();
                clearInterval(snowLoadPollInterval);
                snowLoadPollInterval = null;
                return;
              }
            } catch (e) {}
            waited += interval;
            if (waited >= max) {
              clearInterval(snowLoadPollInterval);
              snowLoadPollInterval = null;
              try { console.warn('script-loader: timed out waiting for', script.id); } catch (e) {}
            }
          }, interval);
        })();
      }
    }
    // persist choice
    try { setCookie('scriptChoice', script.id, 365); } catch (e) {}
    // visually mark
    const opts = document.querySelectorAll('.script-option');
    opts.forEach(o => { o.classList.remove('selected'); if (o.dataset.scriptId === script.id) o.classList.add('selected'); });
  }

  // init from cookie
  const savedScript = getCookie('scriptChoice');
  if (savedScript) applyScriptById(savedScript);

  // hide on outside click / esc
  window.addEventListener('click', (e) => {
    if (scriptOverlay && scriptOverlay.style.display === 'flex' && !scriptOverlay.contains(e.target) && e.target !== scriptButton && !scriptButton.contains(e.target)) {
      hideScriptOverlay();
    }
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideScriptOverlay(); });

  // reposition on resize
  window.addEventListener('resize', () => { if (scriptOverlay && scriptOverlay.style.display === 'flex') showScriptOverlay(); });
});