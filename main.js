// Global work-in-progress kill-switch; derived from /data/etc/wip
let workInProgress = false;

function hasAdminCookie() {
    try {
        return document.cookie.split(';').some((cookie) => cookie.trim().startsWith('is_admin=1'));
    } catch (_) {
        return false;
    }
}

async function fetchAdminStatus() {
    try {
        const res = await fetch('/api/account/is-admin', { credentials: 'include' });
        if (!res.ok) return false;
        const data = await res.json();
        return data && data.isAdmin === true;
    } catch (_) {
        return false;
    }
}

function enableWipEnforcement() {
    const isAllowedPath = (pathname) => {
        // Remove trailing slash for consistent comparison
        const normalizedPath = pathname.replace(/\/$/, '') || '/';
        return normalizedPath === '/error/wip' || normalizedPath === '/account/login';
    };
    let intervalId = null;

    const cleanupIfAdmin = () => {
        if (!hasAdminCookie()) return false;
        if (intervalId !== null) clearInterval(intervalId);
        window.removeEventListener('popstate', enforceWip);
        document.removeEventListener('click', handleClick, true);
        return true;
    };

    const enforceWip = () => {
        if (cleanupIfAdmin()) return;
        const currentPath = window.location.pathname;
        // Only redirect if not on an allowed path
        if (!isAllowedPath(currentPath)) {
            window.location.replace('/error/wip');
        }
    };

    const handleClick = (event) => {
        if (cleanupIfAdmin()) return;
        if (event.defaultPrevented) return;
        if (event.button !== 0) return; // only left clicks
        const anchor = event.target.closest('a');
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (!href) return;
        const targetUrl = new URL(href, window.location.href);
        if (isAllowedPath(targetUrl.pathname)) return;
        event.preventDefault();
        enforceWip();
    };

    enforceWip();

    // If already on an allowed path, don't set up enforcement
    if (isAllowedPath(window.location.pathname)) {
        return;
    }

    // Prevent navigation away while WIP is active
    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', enforceWip);

    // Re-check periodically in case navigation slips through; stop if admin detected mid-session
    intervalId = setInterval(enforceWip, 1000);
}

function initWorkInProgressGuard() {
    if (workInProgress !== true) {
        if (window.location.pathname === '/error/wip') {
            window.location.replace('/');
        }
        return;
    }

    if (hasAdminCookie()) return;

    fetchAdminStatus().then((isAdmin) => {
        if (isAdmin) return;
        enableWipEnforcement();
    }).catch(() => {
        enableWipEnforcement();
    });
}

async function loadWorkInProgressFlag() {
    try {
        const res = await fetch('/data/etc/wip', { cache: 'no-store' });
        if (!res.ok) return;
        const raw = await res.text();
        const text = (raw || '').trim().toLowerCase();
        const truthy = new Set(['1', 'true', 'yes', 'y', 'on', 'wip']);
        workInProgress = truthy.has(text);
    } catch (_) {
        workInProgress = false;
    } finally {
        initWorkInProgressGuard();
        toggleMaintenanceBanner();
    }
}

loadWorkInProgressFlag();

function toggleMaintenanceBanner() {
    try {
        const banner = document.getElementById('maintenance-banner');
        if (!banner) return;
        banner.style.display = workInProgress === true ? 'inline' : 'none';
    } catch (_) {
        /* no-op */
    }
}

window.addEventListener('DOMContentLoaded', toggleMaintenanceBanner);

// Dynamically scale #ascii font size to fit container
function autoScaleAsciiFont() {
    const asciiBlocks = document.querySelectorAll('#ascii');
    let scaled = false;
    asciiBlocks.forEach(ascii => {
        const parent = ascii.parentElement;
        if (!parent) return;
        const containerWidth = parent.offsetWidth;
        const defaultFontSize = 12;
        const minFontSize = 9.5;
        // Always reset to default before measuring
        ascii.style.fontSize = defaultFontSize + 'px';
        // Measure natural width at default font size
        const naturalWidth = ascii.scrollWidth;
        if (naturalWidth > containerWidth) {
            // Calculate proportional scale factor
            const scale = containerWidth / naturalWidth;
            const newFontSize = Math.max(minFontSize, defaultFontSize * scale);
            ascii.style.fontSize = newFontSize + 'px';
            if (newFontSize < defaultFontSize) scaled = true;
        } else {
            ascii.style.fontSize = defaultFontSize + 'px';
        }
    });

    // Tooltip logic for #hide-sidebar
    let tooltip = document.getElementById('ascii-scale-tooltip');
    const hideSidebarBtn = document.getElementById('hide-sidebar');
    const TOOLTIP_KEY = 'asciiScaleTooltipDismissed';
    if (localStorage.getItem(TOOLTIP_KEY) === '1') {
        if (tooltip) { tooltip.style.display = 'none'; tooltip.style.opacity = '0'; }
        return;
    }
    if (scaled && hideSidebarBtn) {
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'ascii-scale-tooltip';
            tooltip.className = 'ascii-scale-tooltip-bubble';
            tooltip.innerHTML = 'screen too small? click the <i class="fa-solid fa-square-caret-left" style="font-size:10px;vertical-align:middle;color:rgba(250, 250, 250, 0.43)"></i> button to hide this sidebar';
            hideSidebarBtn.parentElement.style.position = 'relative';
            hideSidebarBtn.after(tooltip);
            // Inject style for speech bubble if not already present
            if (!document.getElementById('ascii-scale-tooltip-style')) {
                const style = document.createElement('style');
                style.id = 'ascii-scale-tooltip-style';
                style.textContent = `
                .ascii-scale-tooltip-bubble {
                    position: absolute;
                    left: 50%;
                    top: 100%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.95);
                    color: white;
                    padding: 8px 16px;
                    border: 1px solid #305aad;
                    border-radius: 8px;
                    font-size: 13px;
                    white-space: pre-line;
                    z-index: 100;
                    margin-top: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    min-width: 220px;
                    max-width: 320px;
                    text-align: left;
                    opacity: 1;
                    transition: opacity 0.5s;
                }
                .ascii-scale-tooltip-bubble::after {
                    content: '';
                    position: absolute;
                    top: -12px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 0;
                    height: 0;
                    border-left: 10px solid transparent;
                    border-right: 10px solid transparent;
                    border-bottom: 12px solid rgba(0,0,0,0.95);
                    filter: drop-shadow(0 -1px 0 #305aad);
                }
                @media (max-width: 500px) {
                  .ascii-scale-tooltip-bubble {
                    min-width: 120px;
                    font-size: 12px;
                    padding: 6px 8px;
                  }
                }
                `;
                document.head.appendChild(style);
            }
        }
        tooltip.style.display = 'block';
        tooltip.style.opacity = '1';
        // Fade out after 5 seconds
        if (tooltip.fadeTimeout) clearTimeout(tooltip.fadeTimeout);
        tooltip.fadeTimeout = setTimeout(() => {
            tooltip.style.opacity = '0';
            setTimeout(() => { tooltip.style.display = 'none'; }, 500);
        }, 5000);

        // Only bind once
        if (!hideSidebarBtn.dataset.asciiTooltipBound) {
            hideSidebarBtn.addEventListener('click', function() {
                localStorage.setItem(TOOLTIP_KEY, '1');
                if (tooltip) { tooltip.style.display = 'none'; tooltip.style.opacity = '0'; }
            });
            hideSidebarBtn.dataset.asciiTooltipBound = '1';
        }
    } else if (tooltip) {
        tooltip.style.display = 'none';
        tooltip.style.opacity = '0';
        if (tooltip.fadeTimeout) clearTimeout(tooltip.fadeTimeout);
    }
}

window.addEventListener('DOMContentLoaded', autoScaleAsciiFont);
window.addEventListener('resize', autoScaleAsciiFont);
window.addEventListener('DOMContentLoaded', initAsciiTime);
window.addEventListener('DOMContentLoaded', initAsciiUsage);

// ASCII time initializer (safe for SPA reloads)
function initAsciiTime() {
    try {
        const el = document.getElementById('ascii-time');
        const labelEl = document.getElementById('ascii-time-label');
        if (!el || el.dataset.asciiTimeBound === '1') return;
        el.dataset.asciiTimeBound = '1';

        let fontMap = {};
        let maxLines = 0;
        let glyphWidth = 8;
        const charGap = 1;

        const pad = (str, width) => (typeof str === 'string' ? str : '').padEnd(width, ' ');

        const glyphWidthFor = (glyph) => {
            if (!Array.isArray(glyph) || !glyph.length) return glyphWidth;
            return glyph.reduce((m, l) => Math.max(m, l.length), 0);
        };

        const buildMap = (entries) => {
            const map = {};
            if (!Array.isArray(entries)) return map;
            entries.forEach((item) => {
                if (item && typeof item === 'object') {
                    if (typeof item.number === 'string' && typeof item.font === 'string') {
                        map[item.number] = item.font.split(/\r?\n/);
                    } else if (Object.prototype.hasOwnProperty.call(item, 'colon') && typeof item.colon === 'string') {
                        map[':'] = item.colon.split(/\r?\n/);
                    }
                }
            });
            const lineHeights = Object.values(map).map((lines) => lines.length || 0);
            const widths = Object.values(map).map((lines) => lines.reduce((m, l) => Math.max(m, l.length), 0));
            maxLines = lineHeights.length ? Math.max(...lineHeights) : 0;
            glyphWidth = widths.length ? Math.max(...widths) : glyphWidth;
            return map;
        };

        const londonTzAbbrev = (date) => {
            try {
                const parts = new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Europe/London',
                    timeZoneName: 'short'
                }).formatToParts(date);
                const tzPart = parts.find((p) => p.type === 'timeZoneName');
                return tzPart && tzPart.value ? tzPart.value.toUpperCase() : 'GMT';
            } catch (_) {
                return 'GMT';
            }
        };

        const render = () => {
            if (!maxLines || !Object.keys(fontMap).length) return;
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-GB', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Europe/London'
            });
            if (labelEl) {
                const tz = londonTzAbbrev(now);
                labelEl.textContent = `fridg3.org Server Time (${tz})`;
            }
            const rows = Array.from({ length: maxLines }, () => '');
            timeStr.split('').forEach((ch) => {
                const glyph = fontMap[ch] || [];
                const width = ch === ':' ? glyphWidthFor(glyph) : glyphWidth;
                const gap = ch === ':' ? 0 : charGap;
                for (let i = 0; i < maxLines; i += 1) {
                    rows[i] += pad(glyph[i] || '', width + gap);
                }
            });
            el.textContent = rows.join('\n');
        };

        const loadFonts = async () => {
            const fallbackTimeGlyphs = [
                { number: '0', font: " .d88b. \n d8P  Y8b\n d8P  Y8b\n 88    88\n 88    88\n Y8b  d8P\n  `Y88P' " },
                { number: '1', font: "  d8  \n d88  \n  888 \n  888 \n  888 \n  888 \n888888" },
                { number: '2', font: " .d888b. \nd8P  Y8b\n    .d88P\n .od88P\"  \n d88P\"    \n888\"      \n888888888\"" },
                { number: '3', font: " .d888b. \nd8P  Y8b\n    .d88P\n    8888\" \n    \"Y8b.\nY88b  d88\n \"Y8888P\"\"" },
                { number: '4', font: "   d888  \n  d8P88  \n d8P 88  \nd88  88  \n888888888\n     88  \n     88  " },
                { number: '5', font: "888888888\n888      \n888      \n8888888b.\n     \"Y88b\nY88b  d88\n \"Y8888P\"\"" },
                { number: '6', font: " .d888b. \nd88P  Y8b\n888      \n888d888b.\n888P  Y88\n888    888\n \"Y8888P\"\"" },
                { number: '7', font: "888888888\n      d88\n     d88P\n    d88P \n   d88P  \n  d88P   \n d88P    " },
                { number: '8', font: " .d888b. \nd88P  Y8b\nY88b. d88\n \"Y88888\"\n.d8P\"\"Y8b.\nY88b  d88\n \"Y8888P\"\"" },
                { number: '9', font: " .d888b. \nd88P  Y88\n888    88\nY88b. d88\n \"Y888P88\n       88\nY88b d88P\"" },
                { colon: "   \n ..\n ''\n   \n ..\n ''\n   " }
            ];

            try {
                let data = fallbackTimeGlyphs;
                const res = await fetch('/data/etc/ascii-time.json', { cache: 'no-store' });
                const text = await res.text();
                if (res.ok && text && text.trim()) {
                    try {
                        data = JSON.parse(text);
                    } catch (parseErr) {
                        console.error('Invalid ascii-time JSON, using fallback', parseErr);
                    }
                } else {
                    console.warn('ascii-time fetch returned non-OK or empty payload, using fallback');
                }

                fontMap = buildMap(data);
                if (!maxLines) throw new Error('No glyphs loaded');
                render();
                el._asciiTimeInterval = window.setInterval(render, 1000);
            } catch (err) {
                console.error('Failed to load ASCII time:', err);
                el.textContent = 'time unavailable';
            }
        };

        loadFonts();
    } catch (_) { /* no-op */ }
}

// ASCII percentage renderer for system usage
function initAsciiUsage() {
    try {
        const cpuEl = document.getElementById('usage-cpu-ascii');
        const memEl = document.getElementById('usage-mem-ascii');
        const diskEl = document.getElementById('usage-disk-ascii');
        const diskAvailEl = document.getElementById('usage-disk-free-ascii');
        const targets = [cpuEl, memEl, diskEl, diskAvailEl];
        if (!targets.some(Boolean)) return;
        if (cpuEl && cpuEl.dataset.asciiUsageBound === '1') return;
        if (cpuEl) cpuEl.dataset.asciiUsageBound = '1';
        if (memEl) memEl.dataset.asciiUsageBound = '1';
        if (diskEl) diskEl.dataset.asciiUsageBound = '1';
        if (diskAvailEl) diskAvailEl.dataset.asciiUsageBound = '1';

        let fontMap = {};
        let maxLines = 0;
        let glyphWidth = 8;
        const charGap = 1;

        const fallbackPercentageGlyphs = [
            { number: '1', font: "SsSSs.     \n  SSSSs    \n  S SSS    \n  S  SS    \n  S..SS    \n  S:::S    \n  S;;;S    \n  S%%%S    \nSsSSSSSsS  " },
            { number: '2', font: ".sSSSSs.   \n`SSSS SSSs.\n      SSSSS\n.sSSSsSSSS'\nS..SS      \nS:::S SSSs.\nS;;;S SSSSS\nS%%%S SSSSS\nSSSSSsSSSSS" },
            { number: '3', font: ".sSSSSSSs. \n`SSSS SSSSs\n      S SSS\n  .sS S  SS\n SSSSsS..SS\n  `:; S:::S\n      S;;;S\n.SSSS S%%%S\n`:;SSsSSSSS" },
            { number: '4', font: ".sSSS s.   \nSSSSS SSSs.\nS SSS SSSSS\nS  SS SSSSS\nS..SSsSSSSS\n      SSSSS\n      SSSSS\n      SSSSS\n      SSSSS" },
            { number: '5', font: "SSSSSSSSSs.\nSSSSS SSSS'\nS SSS      \nSSSSSsSSSs.\n      SSSSS\n.sSSS SSSSS\nS;;;S SSSSS\nS%%%S SSSSS\n`:;SSsSS;:'" },
            { number: '6', font: ".sSSSSs.   \nSSSSSSSSSs.\nS SSS SSSS'\nS  SS      \nS...SsSSSa.\nS:::S SSSSS\nS;;;S SSSSS\nS%%%S SSSSS\n`:;SSsSS;:'" },
            { number: '7', font: "SSSSSSSSSs.\nSSSSSSSSSSS\n     S SSS \n    S  SS  \n   S..SS   \n  S:::S    \n S;;;S     \nS%%%S      \nSSSSS      " },
            { number: '8', font: ".sSSSSs.   \nSSSSS SSSs.\nS SSS SSSSS\nS  SS SSSSS\n`..SSsSSSs'\ns:::S SSSSs\nS;;;S SSSSS\nS%%%S SSSSS\n`:;SSsSS;:'" },
            { number: '9', font: ".sSSSSs.   \nSSSSS SSSs.\nS SSS SSSSS\nS  SS SSSSS\n`..SSsSSSSS\n      SSSSS\n.sSSS SSSSS\nS%%%S SSSSS\n`:;SSsSS;:'" },
            { number: '0', font: ".sSSSSs.   \nSSSSSSSSSs.\nS SSS SSSSS\nS  SS SSSSS\nS..SS\\SSSSS\nS:::S SSSSS\nS;;;S SSSSS\nS%%%S SSSSS\n`:;SSsSS;:'" },
            { question: " .sSSs.   \nS%%%%%S   \n    S%%   \n   S%%    \n  S%%     \n  S       \n          \n  S%%     \n  `:;'    " },
            { percent: " \n.sSs. \nS%%%S \n`:;:' \n      \n.sSs. \nS%%%S \n`:;:' " }
        ];

        const pad = (str, width) => (typeof str === 'string' ? str : '').padEnd(width, ' ');

        const buildMap = (entries) => {
            const map = {};
            if (!Array.isArray(entries)) return map;
            entries.forEach((item) => {
                if (item && typeof item === 'object') {
                    if (typeof item.number === 'string' && typeof item.font === 'string') {
                        map[item.number] = item.font.split(/\r?\n/);
                    } else if (Object.prototype.hasOwnProperty.call(item, 'percent') && typeof item.percent === 'string') {
                        map['%'] = item.percent.split(/\r?\n/);
                    } else if (Object.prototype.hasOwnProperty.call(item, 'question') && typeof item.question === 'string') {
                        map['?'] = item.question.split(/\r?\n/);
                    }
                }
            });
            const lineHeights = Object.values(map).map((lines) => lines.length || 0);
            const widths = Object.values(map).map((lines) => lines.reduce((m, l) => Math.max(m, l.length), 0));
            maxLines = lineHeights.length ? Math.max(...lineHeights) : 0;
            glyphWidth = widths.length ? Math.max(...widths) : glyphWidth;
            return map;
        };

        const renderValue = (value) => {
            if (!maxLines || !Object.keys(fontMap).length) return null;
            const safeVal = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null;
            const numStr = safeVal === null ? '??' : String(safeVal).padStart(2, '0');
            const str = `${numStr}%`;
            const rows = Array.from({ length: maxLines }, () => '');
            str.split('').forEach((ch) => {
                const glyph = fontMap[ch] || [];
                const width = glyphWidth;
                for (let i = 0; i < maxLines; i += 1) {
                    rows[i] += pad(glyph[i] || '', width + charGap);
                }
            });
            return rows.join('\n');
        };

        const applyReadings = (data) => {
            const cpu = renderValue(data.cpu);
            const mem = renderValue(data.memory);
            const disk = renderValue(data.disk);
            const diskAvail = renderValue(data.diskAvailable);
            if (cpuEl) cpuEl.textContent = cpu || '??%';
            if (memEl) memEl.textContent = mem || '??%';
            if (diskEl) diskEl.textContent = disk || '??%';
            if (diskAvailEl) diskAvailEl.textContent = diskAvail || '??%';
        };

        const loadFonts = async () => {
            let data = fallbackPercentageGlyphs;
            try {
                const res = await fetch('/data/etc/ascii-percentage.json', { cache: 'no-store' });
                const text = await res.text();
                if (text && text.trim()) {
                    try {
                        data = JSON.parse(text);
                    } catch (err) {
                        console.error('Invalid ascii-percentage JSON', err, text);
                    }
                } else {
                    console.warn('Empty ascii-percentage payload, using fallback');
                }
            } catch (err) {
                console.warn('Failed to fetch ascii-percentage, using fallback', err);
            }

            fontMap = buildMap(data);
            if (!maxLines) throw new Error('No glyphs loaded');
        };

        const fetchUsage = async () => {
            const tryFetch = async (url) => {
                const res = await fetch(url, { cache: 'no-store' });
                const text = await res.text();
                if (!text || !text.trim()) return {};
                try {
                    return JSON.parse(text) || {};
                } catch (parseErr) {
                    console.error('Invalid usage JSON from', url, parseErr, text);
                    return {};
                }
            };

            try {
                const primary = await tryFetch('/api/system/usage/');
                const ua = (navigator.userAgent || '').toLowerCase();
                const isWinUa = ua.includes('windows');

                // If we're on Windows and any metric is missing, attempt a Windows-targeted retry and merge missing fields
                if (isWinUa && ([primary.cpu, primary.memory, primary.disk].some((v) => v == null))) {
                    try {
                        const winData = await tryFetch('/api/system/usage/?os=windows');
                        const merged = {
                            cpu: primary.cpu ?? winData.cpu,
                            memory: primary.memory ?? winData.memory,
                            disk: primary.disk ?? winData.disk,
                            os: winData.os || primary.os,
                            timestamp: winData.timestamp || primary.timestamp
                        };
                        applyReadings(merged);
                        return;
                    } catch (_) {
                        /* fall through to primary */
                    }
                }

                // derive disk available if we have used
                const derived = { ...primary };
                if (Number.isFinite(primary.disk)) {
                    derived.diskAvailable = Math.max(0, Math.min(100, 100 - primary.disk));
                }

                applyReadings(derived);
            } catch (err) {
                console.error('Failed to load system usage:', err);
                if (cpuEl) cpuEl.textContent = 'usage unavailable';
                if (memEl) memEl.textContent = 'usage unavailable';
                if (diskEl) diskEl.textContent = 'usage unavailable';
                if (diskAvailEl) diskAvailEl.textContent = 'usage unavailable';
            }
        };

        (async () => {
            try {
                await loadFonts();
                await fetchUsage();
                const interval = window.setInterval(fetchUsage, 5000);
                if (cpuEl) cpuEl._usageInterval = interval;
            } catch (err) {
                console.error('Failed to init ASCII usage:', err);
                if (cpuEl) cpuEl.textContent = 'usage unavailable';
                if (memEl) memEl.textContent = 'usage unavailable';
                if (diskEl) diskEl.textContent = 'usage unavailable';
                if (diskAvailEl) diskAvailEl.textContent = 'usage unavailable';
            }
        })();
    } catch (_) { /* no-op */ }
}

// Responsive ASCII art scaling
function scaleAsciiBlocks() {
    document.querySelectorAll('.ascii-scale-container').forEach(container => {
        const inner = container.querySelector('.ascii-scale-inner');
        // Support both #ascii and #ascii-gradient
        const ascii = inner ? (inner.querySelector('#ascii') || inner.querySelector('#ascii-gradient')) : null;
        if (!ascii) return;
        // Reset any previous scaling
        ascii.style.transform = '';
        ascii.style.transformOrigin = 'left top';
        ascii.style.width = '';
        // Measure actual width
        const containerWidth = container.offsetWidth;
        const asciiWidth = ascii.scrollWidth;
        if (asciiWidth > containerWidth) {
            const scale = containerWidth / asciiWidth;
            ascii.style.transform = `scale(${scale})`;
            ascii.style.width = asciiWidth + 'px'; // preserve layout height
        }
    });
}

window.addEventListener('DOMContentLoaded', scaleAsciiBlocks);
window.addEventListener('resize', scaleAsciiBlocks);
// If SPA navigation or content loads, re-run scaling
function rerunAsciiScalingAfterContent() {
    setTimeout(scaleAsciiBlocks, 0);
}

// this script contains a shit ton of functionality for fridg3.org
// it sucks and i refuse to touch it without the guiding hand of AI
// no code for a website should need to span over 2000 lines of code
// but it works and thats what matters, right?

// Highlight.js initialization
if (typeof hljs !== 'undefined') {
    hljs.highlightAll();
}


function isMobileDevice() {
    return (
        typeof window.orientation !== 'undefined' ||
        navigator.userAgent.indexOf('Mobi') !== -1 ||
        window.innerWidth <= 700
    );
}

const tooltips = document.querySelectorAll('[data-tooltip]');
let activeTooltip = null;

function clearTooltips() {
    document.querySelectorAll('.tooltip').forEach(el => el.remove());
    activeTooltip = null;
}

function applyResponsiveScale() {
    try {
        // Remove any inline scaling so the layout uses pure CSS
        // sizing and behaves like a normal static page.
        const wrapper = document.getElementById('page-wrapper');
        if (wrapper) {
            wrapper.style.transform = '';
            wrapper.style.width = '';
            wrapper.style.height = '';
        }

        const container = document.getElementById('container');
        if (container) {
            container.style.width = '';
            container.style.height = '';
        }
    } catch (_) { /* no-op */ }
}

window.addEventListener('resize', applyResponsiveScale);
window.addEventListener('DOMContentLoaded', applyResponsiveScale);

// Simple SPA-style navigation: load internal pages into #content
// so the sidebar and mini player stay mounted (continuous audio).
function getSpaLoadingEl() {
    let el = document.getElementById('spa-loading');
    if (!el) {
        el = document.createElement('div');
        el.id = 'spa-loading';
        el.textContent = 'loading...';
        document.body.appendChild(el);
    }
    return el;
}

function showSpaLoading() {
    try {
        getSpaLoadingEl().classList.add('visible');
    } catch (_) { /* no-op */ }
}

function hideSpaLoading() {
    try {
        const el = document.getElementById('spa-loading');
        if (el) el.classList.remove('visible');
    } catch (_) { /* no-op */ }
}

function isSpaEligibleLink(anchor) {
    if (!anchor) return false;
    const href = anchor.getAttribute('href') || '';
    if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    if (anchor.target && anchor.target === '_blank') return false;
    if (!href.startsWith('/')) return false; // same-origin path only
    // login should always be a full navigation so session cookies + redirects work
    if (href.startsWith('/account/login')) return false;
    // Always perform a full navigation for logout so that
    // server redirects (e.g. ?logged_out=1) are reflected in
    // the browser URL immediately.
    if (href.startsWith('/account/logout')) return false;
    if (href.startsWith('/api/')) return false; // API endpoints are not pages
    return true;
}

function loadPageIntoContent(url, addToHistory = true) {
    try {
        const contentEl = document.getElementById('content');
        if (!contentEl || !window.fetch || !window.DOMParser) {
            window.location.href = url;
            return;
        }

        // Remove any currently visible tooltips when navigating
        clearTooltips();

        showSpaLoading();

        fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            .then(resp => {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.text();
            })
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const newContent = doc.getElementById('content');
                if (!newContent) {
                    window.location.href = url;
                    return;
                }

                contentEl.innerHTML = newContent.innerHTML;

                const newTitle = doc.querySelector('title');
                if (newTitle) {
                    document.title = newTitle.textContent;
                }

                // Keep sidebar user greeting and footer buttons in sync
                // when navigating (e.g., after login/logout redirects).
                try {
                    const newGreeting = doc.getElementById('user-greeting');
                    const sidebarEl = document.getElementById('sidebar');
                    if (sidebarEl) {
                        const existingGreeting = sidebarEl.querySelector('#user-greeting');
                        const spacer = sidebarEl.querySelector('#sidebar-spacer');
                        if (newGreeting) {
                            const clonedGreeting = newGreeting.cloneNode(true);
                            if (existingGreeting) {
                                existingGreeting.replaceWith(clonedGreeting);
                            } else if (spacer && spacer.parentNode) {
                                spacer.parentNode.insertBefore(clonedGreeting, spacer);
                            }
                        } else if (existingGreeting) {
                            existingGreeting.remove();
                        }
                    }
                } catch (_) { /* no-op */ }

                try {
                    const newFooterButtons = doc.getElementById('footer-buttons');
                    const currentFooterButtons = document.getElementById('footer-buttons');
                    if (newFooterButtons && currentFooterButtons) {
                        currentFooterButtons.innerHTML = newFooterButtons.innerHTML;
                    }
                } catch (_) { /* no-op */ }

                if (addToHistory && window.history && window.history.pushState) {
                    window.history.pushState({ spa: true, url: url }, '', url);
                }

                // Re-run per-page initializers for the new content.
                applyResponsiveScale();
                initSidebarAndBBCode();
                initFooterActiveState();
                initSidebarActiveState();
                initScrollAndBookmarkIcons();
                enhanceBookmarksPage();
                initMiniPlayer();
                initToastDiscordBotPage();
                initBBCodeEditor();
                initAsciiUsage();
                setupSpaForms();
                initEmailForm();
                initOffTopicArchive();
                initSettingsPage();
                initAsciiTime();
                autoScaleAsciiFont();
                rerunAsciiScalingAfterContent();
                initTooltips();

                // Re-run syntax highlighting on newly loaded content
                if (typeof hljs !== 'undefined') {
                    contentEl.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                }
            })
            .catch(() => {
                window.location.href = url;
            })
            .finally(() => {
                hideSpaLoading();
            });
    } catch (_) {
        hideSpaLoading();
        window.location.href = url;
    }
}

function setupSpaNavigation() {
    document.addEventListener('click', function(e) {
        // Let dedicated handlers take over for feed edit icons
        if (e.target.closest('#post-edit-feed')) return;

        const anchor = e.target.closest('a');
        if (!anchor) return;
        if (!isSpaEligibleLink(anchor)) return;
        // Allow default for modifier keys (open in new tab/window)
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        const href = anchor.getAttribute('href');
        if (!href) return;

        e.preventDefault();
        loadPageIntoContent(href, true);
    });

    window.addEventListener('popstate', function(ev) {
        try {
            const state = ev.state || {};
            const url = state.url || (window.location.pathname + window.location.search);
            loadPageIntoContent(url, false);
        } catch (_) { /* no-op */ }
    });
}

window.addEventListener('DOMContentLoaded', setupSpaNavigation);

// Dedicated handler for feed edit icons so clicking the pencil goes
// to the edit view without breaking SPA navigation or bubbling to the
// outer feed-post link.
document.addEventListener('click', function(e) {
    const editEl = e.target.closest('#post-edit-feed');
    if (!editEl) return;
    const href = editEl.getAttribute('data-edit-href');
    if (!href) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof loadPageIntoContent === 'function') {
        loadPageIntoContent(href, true);
    } else {
        window.location.href = href;
    }
});

// Intercept specific forms (login, create post) and submit via fetch
// so the page content updates without a full reload, keeping the
// mini player and sidebar alive.
function bindSpaForm(form) {
    if (!form || form.dataset.spaBound === '1') return;
    form.dataset.spaBound = '1';

    form.addEventListener('submit', function(e) {
        if (e.defaultPrevented) return;

        const method = (form.getAttribute('method') || 'GET').toUpperCase();
        const action = form.getAttribute('action') || (window.location.pathname + window.location.search);

        // Let the browser handle non-POST/GET or external actions.
        if ((method !== 'POST' && method !== 'GET') || !action.startsWith('/')) {
            return;
        }

        e.preventDefault();

        const contentEl = document.getElementById('content');
        if (!contentEl || !window.fetch || !window.DOMParser) {
            form.submit();
            return;
        }

        const formData = new FormData(form);

        // Ensure the clicked submit button's name/value (e.g., delete=1)
        // are included in the payload so multi-action forms work.
        if (e.submitter && e.submitter.name) {
            formData.append(e.submitter.name, e.submitter.value != null ? e.submitter.value : '');
        }

        fetch(action, {
            method,
            body: method === 'GET' ? null : formData,
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
        })
            .then(resp => {
                if (!resp.ok) {
                    // Fallback to normal navigation on error
                    window.location.href = action;
                    return null;
                }
                return resp.text().then(html => ({ html, finalUrl: resp.url || action }));
            })
            .then(payload => {
                if (!payload) return;
                const { html, finalUrl } = payload;

                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const newContent = doc.getElementById('content');
                if (!newContent) {
                    window.location.href = finalUrl;
                    return;
                }

                contentEl.innerHTML = newContent.innerHTML;

                const newTitle = doc.querySelector('title');
                if (newTitle) {
                    document.title = newTitle.textContent;
                }

                // Update user greeting based on new HTML (for login/logout).
                try {
                    const newGreeting = doc.getElementById('user-greeting');
                    const sidebarEl = document.getElementById('sidebar');
                    if (sidebarEl) {
                        const existingGreeting = sidebarEl.querySelector('#user-greeting');
                        const spacer = sidebarEl.querySelector('#sidebar-spacer');
                        if (newGreeting) {
                            const clonedGreeting = newGreeting.cloneNode(true);
                            if (existingGreeting) {
                                existingGreeting.replaceWith(clonedGreeting);
                            } else if (spacer && spacer.parentNode) {
                                spacer.parentNode.insertBefore(clonedGreeting, spacer);
                            }
                        } else if (existingGreeting) {
                            existingGreeting.remove();
                        }
                    }
                } catch (_) { /* no-op */ }

                // Update footer buttons (Account → Logout, etc.).
                try {
                    const newFooterButtons = doc.getElementById('footer-buttons');
                    const currentFooterButtons = document.getElementById('footer-buttons');
                    if (newFooterButtons && currentFooterButtons) {
                        currentFooterButtons.innerHTML = newFooterButtons.innerHTML;
                    }
                } catch (_) { /* no-op */ }

                if (window.history && window.history.pushState) {
                    window.history.pushState({ spa: true, url: finalUrl }, '', finalUrl);
                }

                // Re-run initializers for new content
                applyResponsiveScale();
                initSidebarAndBBCode();
                initFooterActiveState();
                initSidebarActiveState();
                initScrollAndBookmarkIcons();
                enhanceBookmarksPage();
                setupSpaForms();
                initMiniPlayer();
                ensureToastLiveControlsOnLoad();
                initBBCodeEditor();
                initAsciiUsage();
                initAsciiTime();
                initEmailForm();
                initOffTopicArchive();
                rerunAsciiScalingAfterContent();
                initTooltips();

                // Re-run syntax highlighting on newly loaded content
                if (typeof hljs !== 'undefined') {
                    contentEl.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                }
            })
            .catch(() => {
                window.location.href = action;
            });
    });
}

function setupSpaForms() {
    try {
        const loginForm = document.getElementById('login-form');
        // Login should perform a full POST + redirect so that
        // session cookies and redirects behave exactly as the
        // server expects. Forms marked with data-no-spa are
        // intentionally excluded from SPA interception.
        if (loginForm && !loginForm.dataset.noSpa) bindSpaForm(loginForm);

        const createPostForm = document.getElementById('create-post-form');
        if (createPostForm) bindSpaForm(createPostForm);
    } catch (_) { /* no-op */ }
}

window.addEventListener('DOMContentLoaded', setupSpaForms);

// Security question handling for /email form (random math and validation)
function initEmailForm() {
    try {
        const rawPath = (window.location && window.location.pathname) ? window.location.pathname : '/';
        const path = rawPath.replace(/\/+$/, '') || '/';
        if (!path.startsWith('/email')) return;

        const form = document.querySelector('form[action^="https://formsubmit.co"]');
        if (!form || form.dataset.securityBound === '1') return;
        form.dataset.securityBound = '1';

        const questionEl = form.querySelector('#security-question');
        const answerInput = form.querySelector('input[name="security_answer"]');
        const errorEl = form.querySelector('#security-error');
        if (!questionEl || !answerInput) return;

        let correctAnswer = null;

        function generateQuestion() {
            const ops = ['+', '-', '*'];
            const op = ops[Math.floor(Math.random() * ops.length)];

            let a = Math.floor(Math.random() * 10);
            let b = Math.floor(Math.random() * 10);

            // Keep subtraction answers non-negative for simplicity
            if (op === '-' && b > a) {
                [a, b] = [b, a];
            }

            switch (op) {
                case '+':
                    correctAnswer = a + b;
                    break;
                case '-':
                    correctAnswer = a - b;
                    break;
                case '*':
                default:
                    correctAnswer = a * b;
                    break;
            }

            questionEl.textContent = `what is ${a} ${op} ${b}?`;
            if (errorEl) {
                errorEl.style.display = 'none';
            }
            if (answerInput) {
                answerInput.value = '';
            }
        }

        // Initialize first question
        generateQuestion();

        form.addEventListener('submit', function(e) {
            if (e.defaultPrevented) return;
            const raw = (answerInput.value || '').trim();
            const userVal = raw === '' ? NaN : parseInt(raw, 10);
            if (!Number.isFinite(userVal) || userVal !== correctAnswer) {
                e.preventDefault();
                generateQuestion();
                if (errorEl) {
                    errorEl.style.display = 'block';
                }
                return;
            }
            if (errorEl) {
                errorEl.style.display = 'none';
            }
        });

        if (answerInput && errorEl) {
            answerInput.addEventListener('input', function() {
                errorEl.style.display = 'none';
            });
        }
    } catch (_) { /* no-op */ }
}

window.addEventListener('DOMContentLoaded', initEmailForm);

// Render the #off-topic archive in a Discord-like view
function initOffTopicArchive() {
    try {
        const rawPath = (window.location && window.location.pathname) ? window.location.pathname : '/';
        const path = rawPath.replace(/\/+$/, '') || '/';
        if (!path.startsWith('/others/off-topic-archive')) return;

        const root = document.getElementById('offtopic-archive');
        const messagesEl = document.getElementById('offtopic-messages');
        const searchInput = document.getElementById('offtopic-search');
        const statusEl = document.getElementById('offtopic-status');
        const sortBtn = document.getElementById('offtopic-sort');
        const loadMoreBtn = document.getElementById('offtopic-load-more');
        const errorEl = document.getElementById('offtopic-error');

        if (!root || !messagesEl || !searchInput || !statusEl || !sortBtn || !loadMoreBtn || !errorEl) return;
        if (root.dataset.bound === '1') return;
        root.dataset.bound = '1';

        const ARCHIVE_URL = '/data/etc/off-topic-archive.json';
        const PAGE_SIZE = 120;
        const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

        let rawMessages = [];
        let allMessages = [];
        let filteredMessages = [];
        let renderedCount = 0;
        let sortOrder = 'desc'; // 'desc' newest → oldest, 'asc' oldest → newest

        // Lazy-load Twemoji once and parse the archive container
        let twemojiLoaded = typeof window.twemoji !== 'undefined';
        function ensureTwemoji(callback) {
            if (typeof window.twemoji !== 'undefined') {
                twemojiLoaded = true;
                if (callback) callback();
                return;
            }
            if (twemojiLoaded === 'loading') {
                if (callback) {
                    document.addEventListener('twemoji-ready', callback, { once: true });
                }
                return;
            }
            twemojiLoaded = 'loading';
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/twemoji.min.js';
            script.async = true;
            script.onload = function() {
                twemojiLoaded = true;
                document.dispatchEvent(new Event('twemoji-ready'));
                if (callback) callback();
            };
            script.onerror = function() {
                twemojiLoaded = false;
            };
            document.head.appendChild(script);
        }

        function applyTwemoji() {
            if (typeof window.twemoji === 'undefined') {
                ensureTwemoji(applyTwemoji);
                return;
            }
            try {
                window.twemoji.parse(document.getElementById('offtopic-archive'));
            } catch (_) { /* no-op */ }
        }

        function sortMessages(list, order) {
            return (list || []).slice().sort(function(a, b) {
                const ta = a && a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const tb = b && b.timestamp ? new Date(b.timestamp).getTime() : 0;
                if (isNaN(tb) && isNaN(ta)) return 0;
                if (isNaN(tb)) return -1;
                if (isNaN(ta)) return 1;
                return order === 'asc' ? ta - tb : tb - ta;
            });
        }

        function safeText(value) {
            return typeof value === 'string' ? value : '';
        }

        function escapeHtml(str) {
            return (str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function formatInlineMarkdown(str) {
            let out = escapeHtml(str);
            out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            out = out.replace(/(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)/g, function(_, prefix, content) {
                return prefix + '<em>' + content + '</em>';
            });
            return out;
        }

        function extractTenorIds(text) {
            const out = [];
            const re = /(https?:\/\/(?:www\.)?tenor\.com\/[^\s]*?-)(\d+)(?=[^\d]|$)/gi;
            let m;
            while ((m = re.exec(text || '')) !== null) {
                const id = m[2];
                if (id && out.indexOf(id) === -1) out.push(id);
            }
            return out;
        }

        function stripTenorLinks(text) {
            if (!text) return '';
            return text.replace(/https?:\/\/(?:www\.)?tenor\.com\/\S+/gi, '').trim();
        }

        function extractGifLinks(text) {
            const out = [];
            const re = /(https?:\/\/\S+?\.gif)(?=\s|$)/gi;
            let m;
            while ((m = re.exec(text || '')) !== null) {
                const url = m[1];
                if (url && out.indexOf(url) === -1) out.push(url);
            }
            return out;
        }

        function stripGifLinks(text) {
            if (!text) return '';
            return text.replace(/https?:\/\/\S+?\.gif(?=\s|$)/gi, '').trim();
        }

        function isImageAttachment(att) {
            const url = safeText(att && (att.url || att.proxyUrl));
            const name = safeText(att && (att.fileName || att.filename || ''));
            const stripQuery = (v) => v.split('?')[0].split('#')[0];
            const candidates = [stripQuery(url), stripQuery(name)].filter(Boolean);
            return candidates.some(function(val) {
                return /\.(png|jpe?g|gif|webp|bmp|tiff)$/i.test(val);
            });
        }

        function isVideoAttachment(att) {
            const url = safeText(att && (att.url || att.proxyUrl));
            const name = safeText(att && (att.fileName || att.filename || ''));
            const stripQuery = (v) => v.split('?')[0].split('#')[0];
            const candidates = [stripQuery(url), stripQuery(name)].filter(Boolean);
            return candidates.some(function(val) {
                return /\.(mp4|mov|webm)$/i.test(val);
            });
        }

        function formatTimestamp(ts) {
            try {
                const d = new Date(ts);
                if (isNaN(d.getTime())) return '';
                return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
            } catch (_) {
                return safeText(ts);
            }
        }

        function makeContentNode(msg) {
            const content = document.createElement('div');
            content.className = 'discord-message-content';
            const lines = safeText(msg && msg.content).split('\n');
            const formattedLines = [];
            lines.forEach(function(line, idx) {
                let cleaned = stripTenorLinks(line);
                cleaned = stripGifLinks(cleaned);
                if (cleaned === '') return; // skip lines that were only Tenor URLs
                formattedLines.push(formatInlineMarkdown(cleaned));
            });
            content.innerHTML = formattedLines.join('<br>');
            return content;
        }

        function appendGifEmbeds(msg, bodyEl) {
            const links = extractGifLinks(safeText(msg && msg.content));
            if (!links.length) return;
            const wrap = document.createElement('div');
            wrap.className = 'discord-attachments';
            links.forEach(function(url) {
                const img = document.createElement('img');
                img.className = 'discord-attachment-image';
                img.src = url;
                img.alt = 'gif';
                img.loading = 'lazy';
                img.referrerPolicy = 'no-referrer';
                img.onerror = function() {
                    img.onerror = null;
                    img.remove();
                };
                wrap.appendChild(img);
            });
            if (wrap.children.length) {
                bodyEl.appendChild(wrap);
            }
        }

        function appendTenorEmbeds(msg, bodyEl) {
            const ids = extractTenorIds(safeText(msg && msg.content));
            if (!ids.length) return;
            const wrap = document.createElement('div');
            wrap.className = 'discord-tenor-wrap';
            ids.forEach(function(id) {
                const outer = document.createElement('div');
                outer.className = 'discord-tenor';
                const iframe = document.createElement('iframe');
                iframe.src = 'https://tenor.com/embed/' + id;
                iframe.allowFullscreen = true;
                iframe.loading = 'lazy';
                iframe.referrerPolicy = 'no-referrer';
                outer.appendChild(iframe);
                wrap.appendChild(outer);
            });
            bodyEl.appendChild(wrap);
        }

        function renderAttachments(msg, bodyEl) {
            if (!msg || !Array.isArray(msg.attachments) || msg.attachments.length === 0) return;
            const wrap = document.createElement('div');
            wrap.className = 'discord-attachments';
            msg.attachments.forEach(function(att) {
                const url = safeText(att && (att.url || att.proxyUrl));
                if (!url) return;
                const displayName = safeText(att && (att.fileName || att.filename)) || url;
                if (isImageAttachment(att)) {
                    const img = document.createElement('img');
                    img.className = 'discord-attachment-image';
                    img.src = url;
                    img.alt = displayName || 'attachment';
                    img.loading = 'lazy';
                    img.referrerPolicy = 'no-referrer';
                    img.onerror = function() {
                        img.onerror = null;
                        img.remove();
                    };
                    wrap.appendChild(img);
                } else if (isVideoAttachment(att)) {
                    const vid = document.createElement('video');
                    vid.className = 'discord-attachment-video';
                    vid.src = url;
                    vid.controls = true;
                    vid.preload = 'metadata';
                    vid.playsInline = true;
                    vid.referrerPolicy = 'no-referrer';
                    vid.onerror = function() {
                        vid.onerror = null;
                        vid.remove();
                    };
                    wrap.appendChild(vid);
                } else {
                    const link = document.createElement('a');
                    link.href = url;
                    link.textContent = displayName;
                    link.target = '_blank';
                    link.rel = 'noreferrer noopener';
                    wrap.appendChild(link);
                }
            });
            if (wrap.children.length) {
                bodyEl.appendChild(wrap);
            }
        }

        function getAuthorName(msg) {
            const author = msg && msg.author ? msg.author : {};
            return safeText(author.nickname || author.name || 'Unknown');
        }

        function normalizeColorValue(val) {
            if (typeof val !== 'string') return null;
            const raw = val.trim();
            if (!raw) return null;
            const lower = raw.toLowerCase();

            // Hex formats
            if (/^#?[0-9a-f]{6}$/.test(lower)) {
                return lower.startsWith('#') ? lower : '#' + lower;
            }

            // rgb(...) formats
            const rgbMatch = lower.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
            if (rgbMatch) {
                const r = parseInt(rgbMatch[1], 10);
                const g = parseInt(rgbMatch[2], 10);
                const b = parseInt(rgbMatch[3], 10);
                if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
                    const clamp = (n) => Math.max(0, Math.min(255, n));
                    return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
                }
            }
            return lower;
        }

        function getAuthorColor(msg) {
            try {
                const roles = (msg && msg.author && Array.isArray(msg.author.roles)) ? msg.author.roles : [];
                const firstColoredRole = roles.find(function(r) {
                    return r && typeof r.color === 'string' && r.color.trim() !== '' && r.color.toLowerCase() !== 'null';
                });
                const color = normalizeColorValue(firstColoredRole ? firstColoredRole.color : null);
                if (!color) return null;
                // Remap the specific blue-gray to neutral gray for readability
                if (color === '#8799ae' || color === 'rgb(135, 153, 174)') {
                    return '#cacaca';
                }
                return color;
            } catch (_) {
                return null;
            }
        }

        function createMessageEl(msg) {
            const row = document.createElement('div');
            row.className = 'discord-message';
            row.dataset.id = msg && msg.id ? msg.id : '';

            const avatar = document.createElement('img');
            avatar.className = 'discord-avatar';
            avatar.src = (msg && msg.author && msg.author.avatarUrl) ? msg.author.avatarUrl : DEFAULT_AVATAR;
            avatar.alt = getAuthorName(msg);
            avatar.loading = 'lazy';
            avatar.referrerPolicy = 'no-referrer';
            avatar.onerror = function() {
                avatar.onerror = null;
                avatar.src = DEFAULT_AVATAR;
            };

            const body = document.createElement('div');
            body.className = 'discord-body';

            const header = document.createElement('div');
            header.className = 'discord-header';

            const authorEl = document.createElement('span');
            authorEl.className = 'discord-author';
            authorEl.textContent = getAuthorName(msg);
            const authorColor = getAuthorColor(msg);
            if (authorColor) {
                authorEl.style.color = authorColor;
            }

            const ts = document.createElement('span');
            ts.className = 'discord-timestamp';
            ts.textContent = formatTimestamp(msg && msg.timestamp);

            header.appendChild(authorEl);
            header.appendChild(ts);
            body.appendChild(header);
            body.appendChild(makeContentNode(msg));
            appendTenorEmbeds(msg, body);
            appendGifEmbeds(msg, body);
            renderAttachments(msg, body);

            row.appendChild(avatar);
            row.appendChild(body);

            return row;
        }

        function updateStatus() {
            if (!filteredMessages.length) {
                statusEl.textContent = 'No messages found';
                return;
            }
            statusEl.textContent = renderedCount + ' of ' + filteredMessages.length + ' messages';
        }

        function renderChunk(reset) {
            if (reset) {
                messagesEl.innerHTML = '';
                renderedCount = 0;
            }
            const slice = filteredMessages.slice(renderedCount, renderedCount + PAGE_SIZE);
            slice.forEach(function(msg) {
                messagesEl.appendChild(createMessageEl(msg));
            });
            renderedCount += slice.length;
            loadMoreBtn.style.display = renderedCount < filteredMessages.length ? 'block' : 'none';
            updateStatus();
            applyTwemoji();
        }

        function applyFilter(term) {
            const needle = safeText(term).trim().toLowerCase();
            const base = (!needle ? rawMessages : rawMessages.filter(function(msg) {
                const content = safeText(msg && msg.content).toLowerCase();
                const authorName = getAuthorName(msg).toLowerCase();
                return content.indexOf(needle) !== -1 || authorName.indexOf(needle) !== -1;
            }));
            filteredMessages = sortMessages(base, sortOrder);
            renderChunk(true);
        }

        const debouncedFilter = (function() {
            let timer = null;
            return function(val) {
                if (timer) clearTimeout(timer);
                timer = setTimeout(function() {
                    applyFilter(val);
                }, 200);
            };
        })();

        searchInput.addEventListener('input', function(e) {
            debouncedFilter((e.target && e.target.value) || '');
        });

        loadMoreBtn.addEventListener('click', function() {
            renderChunk(false);
        });

        sortBtn.addEventListener('click', function() {
            sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
            sortBtn.textContent = sortOrder === 'desc' ? 'Sort: Newest → Oldest' : 'Sort: Oldest → Newest';
            applyFilter(searchInput.value || '');
        });

        statusEl.textContent = 'Loading archive...';

        fetch(ARCHIVE_URL, { cache: 'default' })
            .then(function(res) {
                if (!res.ok) throw new Error('failed to load archive');
                return res.json();
            })
            .then(function(data) {
                rawMessages = (data && Array.isArray(data.messages)) ? data.messages : [];
                filteredMessages = sortMessages(rawMessages, sortOrder);
                renderChunk(true);
                applyTwemoji();
            })
            .catch(function() {
                errorEl.style.display = 'block';
                errorEl.textContent = 'Could not load archive right now. Please try again later.';
                statusEl.textContent = '';
                loadMoreBtn.style.display = 'none';
            });
    } catch (_) { /* no-op */ }
}

window.addEventListener('DOMContentLoaded', initOffTopicArchive);

// Toggleable glow settings
const GLOW_DEFAULT_INTENSITY = 'none';
const GLOW_INTENSITY_KEY = 'glowIntensity';
const GLOW_RADIUS_DEFAULT = '8px';
const GLOW_CLASS = 'glow-enabled';
const GLOW_STYLE_ID = 'glow-style-tag';
const COLOR_PREFS_KEY = 'colorPrefs';
const COLOR_FIELDS = ['bg', 'fg', 'border', 'subtle', 'links'];
const COLOR_DEFAULTS = {
    bg: '#000000',
    fg: '#EEEEEE',
    border: '#3C7895',
    subtle: '#917DAA',
    links: '#415FAD',
};

// Apply saved color prefs early on page load so refreshes keep the scheme
(() => {
    const localColors = loadLocalColorPrefs();
    const merged = Object.assign({}, COLOR_DEFAULTS, localColors || {});
    applyColorVars(merged);
})();

function applyColorVars(colors) {
    if (!colors) return;
    const root = document.documentElement;
    COLOR_FIELDS.forEach(key => {
        if (colors[key]) {
            root.style.setProperty(`--${key}`, colors[key]);
        }
    });
}

function normalizeColor(hex) {
    if (typeof hex !== 'string') return null;
    const v = hex.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toUpperCase();
    return null;
}

function loadLocalColorPrefs() {
    try {
        const raw = localStorage.getItem(COLOR_PREFS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const out = {};
        COLOR_FIELDS.forEach(k => {
            const n = normalizeColor(parsed[k]);
            if (n) out[k] = n;
        });
        return Object.keys(out).length ? out : null;
    } catch (_) {
        return null;
    }
}

function saveLocalColorPrefs(colors) {
    try {
        localStorage.setItem(COLOR_PREFS_KEY, JSON.stringify(colors));
    } catch (_) { /* ignore */ }
}

function ensureGlowStyle() {
    if (document.getElementById(GLOW_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = GLOW_STYLE_ID;
    style.textContent = `
:root.${GLOW_CLASS} *:not(html):not(body):not(style):not(script) {
    text-shadow: 0 0 var(--glow-radius, ${GLOW_RADIUS_DEFAULT}) currentColor !important;
}

/* Do not glow footer button icons */
:root.${GLOW_CLASS} #footer-buttons i {
    text-shadow: none !important;
}

/* Do not glow search button icon */
:root.${GLOW_CLASS} #search-button i {
    text-shadow: none !important;
}

/* Special handling for gradient text (#ascii-gradient) so glow matches gradient */
:root.${GLOW_CLASS} #ascii-gradient {
    position: relative;
}
:root.${GLOW_CLASS} #ascii-gradient::before {
    content: attr(data-text);
    position: absolute;
    inset: 0;
    display: block;
    white-space: pre;
    font: inherit;
    line-height: inherit;
    color: transparent;
    background: inherit;
    -webkit-background-clip: text;
    background-clip: text;
    filter: blur(var(--glow-radius, ${GLOW_RADIUS_DEFAULT}));
    opacity: 0.9;
    pointer-events: none;
}
`;
    document.head.appendChild(style);
}

function getGlowRadiusForIntensity(intensity) {
    switch (intensity) {
        case 'none':
            return '0px';
        case 'low':
            return '4px';
        case 'high':
            return '16px';
        case 'medium':
        default:
            return GLOW_RADIUS_DEFAULT;
    }
}

function applyGlowIntensity(intensity) {
    const root = document.documentElement;
    ensureGlowStyle();
    const radius = getGlowRadiusForIntensity(intensity);
    root.style.setProperty('--glow-radius', radius);
    const enabled = intensity !== 'none';
    setGlow(enabled);
}

function setGlow(enabled) {
    const root = document.documentElement;
    ensureGlowStyle();
    if (enabled) {
        root.classList.add(GLOW_CLASS);
    } else {
        root.classList.remove(GLOW_CLASS);
    }
    // Ensure any previous border glow classes are removed
    document.querySelectorAll('.glow-border').forEach(n => n.classList.remove('glow-border'));

    // Sync gradient text glow content
    const asciiGradient = document.getElementById('ascii-gradient');
    if (asciiGradient) {
        if (enabled) {
            asciiGradient.setAttribute('data-text', asciiGradient.textContent);
        } else {
            asciiGradient.removeAttribute('data-text');
        }
    }
}

// Smoother gradient rotation via requestAnimationFrame
const GRADIENT_RAF_ENABLED = true;
const GRADIENT_ROTATION_MS = 12000; // adjust for speed/smoothness

function startGradientRotation(el, durationMs) {
    try {
        let start;
        // disable CSS animation to avoid double updates
        el.style.animation = 'none';
        const tick = (ts) => {
            if (!start) start = ts;
            const elapsed = ts - start;
            const angle = (elapsed % durationMs) / durationMs * 360;
            el.style.setProperty('--angle', angle + 'deg');
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    } catch (_) { /* no-op */ }
}


function initTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(element => {
        // Remove previous listeners to avoid duplicates
        element.removeEventListener('mouseenter', element._tooltipMouseEnter);
        element.removeEventListener('mousemove', element._tooltipMouseMove);
        element.removeEventListener('mouseleave', element._tooltipMouseLeave);
        // Define handlers
        element._tooltipMouseEnter = function(e) {
            if (typeof isMobileDevice === 'function' && isMobileDevice()) return;
            let rawText = this.getAttribute('data-tooltip') || '';
            rawText = rawText.replace(/\\n/g, '<br>');
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerHTML = rawText;
            document.body.appendChild(tooltip);
            activeTooltip = { element: tooltip, trigger: this };
            const updateTooltipPosition = (event) => {
                const rect = tooltip.getBoundingClientRect();
                const tooltipWidth = rect.width;
                const tooltipHeight = rect.height;
                const offset = 10;
                let x = event.clientX + offset;
                let y = event.clientY + offset;
                if (x + tooltipWidth > window.innerWidth) {
                    x = event.clientX - tooltipWidth - offset;
                }
                if (y + tooltipHeight > window.innerHeight) {
                    y = event.clientY - tooltipHeight - offset;
                }
                tooltip.style.left = x + 'px';
                tooltip.style.top = y + 'px';
            };
            updateTooltipPosition(e);
            element._tooltipMouseMove = updateTooltipPosition;
            this.addEventListener('mousemove', updateTooltipPosition);
        };
        element._tooltipMouseLeave = function() {
            if (activeTooltip && activeTooltip.element) {
                activeTooltip.element.remove();
                activeTooltip = null;
            }
            this.removeEventListener('mousemove', element._tooltipMouseMove);
        };
        element.addEventListener('mouseenter', element._tooltipMouseEnter);
        element.addEventListener('mouseleave', element._tooltipMouseLeave);
    });
}

window.addEventListener('DOMContentLoaded', initTooltips);

// Settings page: glow intensity control
function initSettingsPage() {
    try {
        const rawPath = (window.location && window.location.pathname) ? window.location.pathname : '/';
        const path = rawPath.replace(/\/+$/, '') || '/';
        if (!path.startsWith('/settings')) return;

        const glowGroup = document.getElementById('glow-intensity-group');
        const maintenanceGroup = document.getElementById('maintenance-mode-group');
        const adminSection = document.getElementById('admin-settings');
        const colorGroup = document.getElementById('color-scheme-group');
        const colorResetBtn = document.getElementById('color-reset');
        const saveBtn = document.getElementById('settings-save');
        const sitemapBtn = document.querySelector('[data-action="generate-sitemap"]');
        if (!glowGroup || !saveBtn) return;
        if (glowGroup.dataset.bound === '1') return;
        glowGroup.dataset.bound = '1';

        const glowRadios = glowGroup.querySelectorAll('input[type="radio"][name="glow-intensity"]');
        const maintenanceRadios = maintenanceGroup ? maintenanceGroup.querySelectorAll('input[type="radio"][name="maintenance-mode"]') : [];
        const colorInputs = colorGroup ? colorGroup.querySelectorAll('input.color-input[data-color-key]') : [];
        if (!glowRadios.length) return;

        let isAdmin = false;
        const isLoggedIn = !!document.getElementById('user-greeting');

        const selectMaintenance = (state) => {
            if (!maintenanceRadios.length) return;
            maintenanceRadios.forEach(r => {
                r.checked = (r.value === state);
            });
        };

        const loadMaintenanceState = async () => {
            if (!maintenanceRadios.length) return;
            try {
                const res = await fetch('/data/etc/wip', { cache: 'no-store' });
                if (!res.ok) return;
                const txt = (await res.text()).trim().toLowerCase();
                const truthy = new Set(['1', 'true', 'yes', 'y', 'on', 'enabled', 'wip']);
                selectMaintenance(truthy.has(txt) ? 'on' : 'off');
            } catch (_) {
                /* ignore */
            }
        };

        const getMaintenanceSelection = () => {
            if (!maintenanceRadios.length) return null;
            let val = null;
            maintenanceRadios.forEach(r => { if (r.checked) val = r.value; });
            return val;
        };

        const getColorValuesFromInputs = () => {
            const result = {};
            colorInputs.forEach(inp => {
                const key = inp.dataset.colorKey;
                const n = normalizeColor(inp.value);
                if (key && n) result[key] = n;
            });
            return result;
        };

        const setColorInputs = (colors) => {
            if (!colors) return;
            colorInputs.forEach(inp => {
                const key = inp.dataset.colorKey;
                if (colors[key]) {
                    inp.value = colors[key];
                }
            });
        };

        const postColorsToServer = (colors) => {
            if (!isLoggedIn || !window.fetch) return Promise.resolve();
            const params = new URLSearchParams();
            Object.entries(colors).forEach(([k, v]) => {
                params.append('color' + k.charAt(0).toUpperCase() + k.slice(1), v);
            });
            return fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: params.toString(),
            }).catch(() => {});
        };

        const persistColors = (colors, opts = {}) => {
            const merged = Object.assign({}, COLOR_DEFAULTS, colors || {});
            saveLocalColorPrefs(merged);
            applyColorVars(merged);
            if (!opts.skipServer) {
                return postColorsToServer(merged);
            }
            return Promise.resolve();
        };

        const resetColorsToDefault = () => {
            setColorInputs(COLOR_DEFAULTS);
            persistColors(COLOR_DEFAULTS);
        };

        const bindSitemapButton = () => {
            if (!sitemapBtn || sitemapBtn.dataset.bound === '1') return;
            sitemapBtn.dataset.bound = '1';
            sitemapBtn.addEventListener('click', async () => {
                if (!isAdmin) return;
                const originalText = sitemapBtn.textContent;
                sitemapBtn.disabled = true;
                sitemapBtn.textContent = 'generating...';
                try {
                    const res = await fetch('/api/sitemap', {
                        method: 'POST',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    });
                    if (!res.ok) throw new Error('http');
                    const data = await res.json().catch(() => ({}));
                    sitemapBtn.textContent = data && data.ok ? 'sitemap generated' : 'failed';
                } catch (_) {
                    sitemapBtn.textContent = 'error';
                } finally {
                    setTimeout(() => {
                        sitemapBtn.textContent = originalText;
                        sitemapBtn.disabled = false;
                    }, 1200);
                }
            });
        };

        // Pre-select glow from localStorage if available
        let stored = null;
        try {
            stored = localStorage.getItem(GLOW_INTENSITY_KEY);
        } catch (_) { stored = null; }
        const initial = stored || GLOW_DEFAULT_INTENSITY;
        let anyChecked = false;
        glowRadios.forEach(r => {
            if (r.value === initial) {
                r.checked = true;
                anyChecked = true;
            }
        });
        if (!anyChecked) {
            glowRadios[0].checked = true;
        }

        // Load color prefs: local first, then server if logged in
        const initialColors = Object.assign({}, COLOR_DEFAULTS, loadLocalColorPrefs() || {});
        setColorInputs(initialColors);
        applyColorVars(initialColors);

        if (isLoggedIn && window.fetch) {
            fetch('/api/settings', {
                method: 'GET',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            }).then(r => r.ok ? r.json() : null).then(data => {
                if (!data || !data.ok || !data.settings || !data.settings.colors) return;
                const serverColors = {};
                COLOR_FIELDS.forEach(k => {
                    const n = normalizeColor(data.settings.colors[k] ?? '');
                    if (n) serverColors[k] = n;
                });
                if (Object.keys(serverColors).length) {
                    const merged = Object.assign({}, COLOR_DEFAULTS, serverColors);
                    setColorInputs(merged);
                    applyColorVars(merged);
                    saveLocalColorPrefs(merged);
                }
            }).catch(() => {});
        }

        // Persist colors immediately when changed
        colorInputs.forEach(inp => {
            inp.addEventListener('input', () => {
                const chosen = getColorValuesFromInputs();
                persistColors(chosen);
            });
        });

        saveBtn.addEventListener('click', function() {
            let selected = null;
            glowRadios.forEach(r => {
                if (r.checked) selected = r.value;
            });
            if (!selected) return;

            // Persist to localStorage for all users
            try {
                localStorage.setItem(GLOW_INTENSITY_KEY, selected);
            } catch (_) { /* ignore */ }

            // Apply immediately
            applyGlowIntensity(selected);

            // Colors: collect, persist locally, apply immediately
            const chosenColors = getColorValuesFromInputs();
            const mergedColors = Object.assign({}, COLOR_DEFAULTS, chosenColors);
            persistColors(mergedColors, { skipServer: isLoggedIn });

            if (isLoggedIn && window.fetch) {
                const params = new URLSearchParams();
                params.append('glowIntensity', selected);

                if (Object.keys(mergedColors).length) {
                    // flatten colors into separate fields (merged so defaults persist server-side)
                    Object.entries(mergedColors).forEach(([k, v]) => {
                        params.append('color' + k.charAt(0).toUpperCase() + k.slice(1), v);
                    });
                }

                if (isAdmin) {
                    const maintenanceSelection = getMaintenanceSelection();
                    if (maintenanceSelection !== null) {
                        params.append('maintenanceMode', maintenanceSelection);
                    }
                }

                fetch('/api/settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: params.toString(),
                }).catch(() => {}).finally(() => {
                    window.location.reload();
                });
            } else {
                window.location.reload();
            }
        });

        if (colorResetBtn) {
            colorResetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                resetColorsToDefault();
            });
        }

        // Determine admin status to show/hide admin controls and load state
        fetchAdminStatus().then(flag => {
            isAdmin = flag === true;
            if (adminSection) {
                adminSection.style.display = isAdmin ? 'block' : 'none';
            }
            if (isAdmin) {
                loadMaintenanceState();
                bindSitemapButton();
            }
        }).catch(() => {
            if (adminSection) adminSection.style.display = 'none';
        });
    } catch (_) { /* no-op */ }
}

window.addEventListener('DOMContentLoaded', initSettingsPage);

// Sidebar toggle functionality
const hideSidebarBtn = document.getElementById('hide-sidebar');
const showSidebarBtn = document.getElementById('show-sidebar');
const sidebar = document.getElementById('sidebar');
const SIDEBAR_KEY = 'sidebarVisible';

// Load sidebar state, apply glow/gradient, and BBCode formatting
function initSidebarAndBBCode() {
    const isSidebarVisible = localStorage.getItem(SIDEBAR_KEY);
    if (isSidebarVisible === null) {
        // Default to visible if not set
        localStorage.setItem(SIDEBAR_KEY, 'true');
    } else if (isSidebarVisible === 'false') {
        sidebar.style.display = 'none';
        showSidebarBtn.style.display = 'inline-block';
    }

    // Apply global glow effect based on saved intensity
    try {
        const storedIntensity = localStorage.getItem(GLOW_INTENSITY_KEY);
        const intensity = storedIntensity || GLOW_DEFAULT_INTENSITY;
        applyGlowIntensity(intensity);
    } catch (_) {
        applyGlowIntensity(GLOW_DEFAULT_INTENSITY);
    }

    // Start smooth gradient rotation for #ascii-gradient if present
    if (GRADIENT_RAF_ENABLED) {
        const asciiGradientEl = document.getElementById('ascii-gradient');
        if (asciiGradientEl) startGradientRotation(asciiGradientEl, GRADIENT_ROTATION_MS);
    }

    // Apply BBCode formatting to any post-content elements on the page
    try {
        const targets = document.querySelectorAll('#post-content, .post-content');
        targets.forEach(el => {
            const raw = el.textContent || '';
            const html = parseBBCode(raw);
            el.innerHTML = html;

            // Highlight any code blocks in formatted content
            if (typeof hljs !== 'undefined') {
                el.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }

            // Attach tooltip listeners for any newly rendered elements
            el.querySelectorAll('[data-tooltip]').forEach(element => {
                element.addEventListener('mouseenter', function(e) {
                    const rawText = this.getAttribute('data-tooltip') || '';
                    const text = rawText.replace(/\\n/g, '<br>');
                    const tooltip = document.createElement('div');
                    tooltip.className = 'tooltip';
                    tooltip.innerHTML = text;
                    document.body.appendChild(tooltip);

                    const updateTooltipPosition = (event) => {
                        const rect = tooltip.getBoundingClientRect();
                        const tooltipWidth = rect.width;
                        const tooltipHeight = rect.height;
                        const offset = 10;
                        let x = event.clientX + offset;
                        let y = event.clientY + offset;
                        if (x + tooltipWidth > window.innerWidth) {
                            x = event.clientX - tooltipWidth - offset;
                        }
                        if (y + tooltipHeight > window.innerHeight) {
                            y = event.clientY - tooltipHeight - offset;
                        }
                        tooltip.style.left = x + 'px';
                        tooltip.style.top = y + 'px';
                    };
                    updateTooltipPosition(e);
                    this.addEventListener('mousemove', updateTooltipPosition);
                    this.addEventListener('mouseleave', () => {
                        tooltip.remove();
                    });
                });
            });
        });
    } catch (_) { /* no-op */ }
}

// Run once on initial load
window.addEventListener('DOMContentLoaded', initSidebarAndBBCode);

// Global mini player track library for autoplay logic
const MINI_PLAYER_LIBRARY = {
    tracks: [],
    autoPlayedIds: new Set()
};

// Mini music player wiring
function initMiniPlayer() {
    try {
        const audio = document.getElementById('mini-player-audio');
        const miniPlayerEl = document.getElementById('mini-player');
        const playBtn = document.getElementById('mini-player-play');
        const muteBtn = document.getElementById('mini-player-mute');
        const titleContainerEl = document.getElementById('mini-player-title');
        const titleEl = document.getElementById('mini-player-title-inner');
        const tracklistEl = document.getElementById('mini-player-tracks');
        const downloadBtn = document.getElementById('mini-player-download');
        const artEl = document.getElementById('mini-player-art');
        const seekEl = document.getElementById('mini-player-seek');
        const volumeEl = document.getElementById('mini-player-volume');

        const setLiveMode = (isLive) => {
            if (!miniPlayerEl) return;
            if (isLive) {
                miniPlayerEl.classList.add('live-stream');
                if (seekEl) seekEl.style.display = 'none';
                if (downloadBtn) downloadBtn.style.display = 'none';
            } else {
                miniPlayerEl.classList.remove('live-stream');
                if (seekEl) seekEl.style.display = '';
                if (downloadBtn) downloadBtn.style.display = '';
            }
        };

        if (!audio || !playBtn || !muteBtn || !titleContainerEl || !titleEl) return;

        const trackLibrary = MINI_PLAYER_LIBRARY;

        // If the mini player has already been wired once, avoid
        // re-attaching all audio/control listeners. Instead, just
        // (re)bind album links so new /music content can control the
        // existing, already-playing audio element.
        if (audio.dataset.initialized === '1') {
            // Ensure toast listen-along bindings still exist
            initToastListenAlong();
            if (window.bindMiniPlayerAlbumLinks) {
                window.bindMiniPlayerAlbumLinks();
            }
            return;
        }

        const PLAYER_STATE_KEY = 'miniPlayerStateV1';
        // Default volume if no saved state
        const DEFAULT_VOLUME = 0.3;
        setLiveMode(false);

        // Optional initial state from body data attributes
        const body = document.body;
        const initialSrc = body.getAttribute('data-mini-player-src');
        const initialTitle = body.getAttribute('data-mini-player-title');
        const initialArt = body.getAttribute('data-mini-player-art');
        if (initialSrc) audio.src = initialSrc;
        if (initialTitle) {
            setNowPlayingTitle(initialTitle);
        }
        if (artEl && initialArt) artEl.src = initialArt;

        // Apply default volume unless we restore a saved state later
        audio.volume = DEFAULT_VOLUME;

        // Restore saved state if present (overrides default volume)
        try {
            const savedRaw = window.localStorage.getItem(PLAYER_STATE_KEY);
            if (savedRaw) {
                const saved = JSON.parse(savedRaw);
                if (saved && typeof saved === 'object') {
                    if (saved.src) audio.src = saved.src;
                    if (typeof saved.currentTime === 'number' && !Number.isNaN(saved.currentTime)) {
                        audio.currentTime = saved.currentTime;
                    }
                    if (typeof saved.volume === 'number' && saved.volume >= 0 && saved.volume <= 1) {
                        audio.volume = saved.volume;
                    }
                    if (typeof saved.muted === 'boolean') {
                        audio.muted = saved.muted;
                    }
                    if (saved.title && titleEl) {
                        setNowPlayingTitle(saved.title);
                    }
                    if (saved.art && artEl) {
                        artEl.src = saved.art;
                    }
                }
            }
        } catch (_) { /* no-op */ }

        const setPlayIcon = (isPlaying) => {
            const icon = playBtn.querySelector('i');
            if (!icon) return;
            if (isPlaying) {
                icon.classList.remove('fa-play');
                icon.classList.add('fa-pause');
            } else {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            }
        };

        const clearActiveTracks = () => {
            if (!tracklistEl) return;
            tracklistEl.querySelectorAll('.mini-track.active').forEach(el => el.classList.remove('active'));
        };

        const savePlayerState = () => {
            try {
                if (!audio || !audio.src) return;
                const state = {
                    src: audio.src,
                    currentTime: audio.currentTime || 0,
                    paused: audio.paused,
                    volume: audio.volume,
                    muted: audio.muted,
                    title: titleEl ? titleEl.textContent : '',
                    art: artEl ? artEl.src : ''
                };
                window.localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state));
            } catch (_) { /* no-op */ }
        };

        // Capture the latest state right before a full page refresh/close
        window.addEventListener('beforeunload', savePlayerState);

        const updateTitleScroll = () => {
            if (!titleContainerEl || !titleEl) return;
            const containerWidth = titleContainerEl.clientWidth || 0;
            const contentWidth = titleEl.scrollWidth || 0;
            const overflow = contentWidth - containerWidth;
            if (overflow > 4) {
                titleEl.classList.add('scrolling');
                titleEl.style.setProperty('--scroll-distance', overflow + 'px');
            } else {
                titleEl.classList.remove('scrolling');
                titleEl.style.removeProperty('--scroll-distance');
                titleEl.style.transform = '';
            }
        };

        const setNowPlayingTitle = (label) => {
            if (!titleEl) return;
            titleEl.textContent = label;
            lastTrackLabel = label || '';
            // wait a frame so layout is updated
            requestAnimationFrame(updateTitleScroll);
        };

        const normalizeArtUrl = (art) => {
            if (!art) return null;
            try {
                return new URL(art, window.location.href).toString();
            } catch (_) {
                return null;
            }
        };

        const setMediaSessionMetadata = (meta) => {
            if (!('mediaSession' in navigator) || !meta) return;
            const artworkUrl = normalizeArtUrl(meta.albumArt || meta.art || '');
            const artwork = artworkUrl ? [
                { src: artworkUrl, sizes: '512x512', type: 'image/png' }
            ] : [];
            try {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: meta.name || meta.title || 'Unknown',
                    artist: meta.albumArtist || meta.artist || '',
                    album: meta.albumName || meta.album || '',
                    artwork
                });
            } catch (_) { /* no-op */ }
        };

        const bindMediaSessionActions = () => {
            if (!('mediaSession' in navigator)) return;
            try {
                navigator.mediaSession.setActionHandler('play', () => audio.play().catch(() => {}));
                navigator.mediaSession.setActionHandler('pause', () => audio.pause());
                navigator.mediaSession.setActionHandler('previoustrack', () => {/* not implemented */});
                navigator.mediaSession.setActionHandler('nexttrack', () => {
                    // trigger autoplay chain if available
                    handleAutoplayOnEnded();
                });
            } catch (_) { /* no-op */ }
        };

        let isSeeking = false;
        let lastVolume = 1;
        let lastTrackLabel = '';

        const updatePlayingClass = () => {
            if (!miniPlayerEl) return;
            if (audio && !audio.paused && audio.src) {
                miniPlayerEl.classList.add('is-playing');
            } else {
                miniPlayerEl.classList.remove('is-playing');
            }
        };

        const updateVisibility = () => {
            if (!miniPlayerEl) return;
            if (audio && audio.src) {
                miniPlayerEl.classList.remove('mini-inactive');
            } else {
                miniPlayerEl.classList.add('mini-inactive');
            }
        };

        // --- Autoplay helpers ---

        // Current album run state for sequential album playback
        let albumRunState = null; // { albumId, nextIndex }

        const normalizeTrackSrc = (src) => {
            try {
                const u = new URL(src, window.location.origin);
                return u.pathname || src;
            } catch (_) {
                return src || '';
            }
        };

        const startAlbumRunFromIndex = (albumId, startingIndex) => {
            if (!albumId || startingIndex == null) {
                albumRunState = null;
                return;
            }
            const nextIndex = startingIndex + 1;
            const hasNext = trackLibrary.tracks.some(t => t.albumId === albumId && t.index === nextIndex && t.albumType === 'album');
            albumRunState = hasNext ? { albumId, nextIndex } : null;
        };

        const getRandomAutoplayTrack = () => {
            if (!trackLibrary.tracks.length) return null;
            const candidates = trackLibrary.tracks.filter(t => !trackLibrary.autoPlayedIds.has(t.id));
            if (!candidates.length) return null;
            const idx = Math.floor(Math.random() * candidates.length);
            return candidates[idx] || null;
        };

        const autoplayTrack = (track) => {
            if (!track || !track.src) return;
            const labelName = track.name || 'Untitled';
            const labelArtist = track.albumArtist ? ' - ' + track.albumArtist : '';

            trackLibrary.autoPlayedIds.add(track.id);

            audio.src = track.src;
            audio.play().catch(() => {});
            setLiveMode(false);
            setPlayIcon(true);
            if (artEl && track.albumArt) {
                artEl.src = track.albumArt;
            }
            setNowPlayingTitle(labelName + labelArtist);
            setMediaSessionMetadata({
                name: track.name,
                albumArtist: track.albumArtist,
                albumName: track.albumName,
                albumArt: track.albumArt
            });
            if (seekEl) {
                seekEl.value = '0';
            }
            savePlayerState();
            updateVisibility();
            updatePlayingClass();
        };

        const handleAutoplayOnEnded = () => {
            try {
                const currentId = normalizeTrackSrc(audio.src || '');
                if (!currentId) return;

                const currentTrack = trackLibrary.tracks.find(t => t.id === currentId) || null;
                if (!currentTrack) return;

                // If we are in an album run, try to play the next track
                if (albumRunState && albumRunState.albumId === currentTrack.albumId) {
                    const nextTrack = trackLibrary.tracks.find(t => t.albumId === albumRunState.albumId && t.index === albumRunState.nextIndex && t.albumType === 'album') || null;
                    if (nextTrack) {
                        albumRunState.nextIndex += 1;
                        autoplayTrack(nextTrack);
                        return;
                    }
                    // No more tracks in this album; fall through to random
                    albumRunState = null;
                }

                // Otherwise, or after finishing an album, play a random track
                const randomTrack = getRandomAutoplayTrack();
                if (randomTrack) {
                    autoplayTrack(randomTrack);
                }
            } catch (_) { /* no-op */ }
        };
        // Download current track with filename based on "song name - artist"
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                try {
                    if (!audio || !audio.src) return;
                    const src = audio.src;
                    // Derive a safe filename from the last track label
                    let baseName = lastTrackLabel || 'track';
                    // Strip any leading "now playing:" prefix
                    baseName = baseName.replace(/^now playing:\s*/i, '');
                    // Replace problematic filename characters
                    baseName = baseName.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'track';

                    // Try to keep the original file extension, if any
                    let ext = '';
                    const srcPath = src.split('?')[0].split('#')[0];
                    const lastDot = srcPath.lastIndexOf('.');
                    if (lastDot > srcPath.lastIndexOf('/')) {
                        ext = srcPath.substring(lastDot);
                    }
                    const filename = ext ? baseName + ext : baseName;

                    const a = document.createElement('a');
                    a.href = src;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                } catch (_) { /* no-op */ }
            });
        }

        playBtn.addEventListener('click', () => {
            if (!audio.src) return;
            if (audio.paused) {
                audio.play().catch(() => {});
                setPlayIcon(true);
                savePlayerState();
            } else {
                audio.pause();
                setPlayIcon(false);
                savePlayerState();
            }
            updatePlayingClass();
        });

        muteBtn.addEventListener('click', () => {
            audio.muted = !audio.muted;
            const icon = muteBtn.querySelector('i');
            if (!icon) return;
            if (audio.muted) {
                icon.classList.remove('fa-volume-high');
                icon.classList.add('fa-volume-xmark');
                if (volumeEl) {
                    lastVolume = parseFloat(volumeEl.value || '1') || 1;
                    volumeEl.value = '0';
                }
            } else {
                icon.classList.remove('fa-volume-xmark');
                icon.classList.add('fa-volume-high');
                if (volumeEl) {
                    volumeEl.value = String(lastVolume || 1);
                }
            }
            savePlayerState();
        });

        audio.addEventListener('ended', () => {
            setPlayIcon(false);
            clearActiveTracks();
            savePlayerState();
            updatePlayingClass();
            // Trigger autoplay chain after a track finishes
            handleAutoplayOnEnded();
        });

        audio.addEventListener('play', updatePlayingClass);
        audio.addEventListener('pause', updatePlayingClass);

        // Seek bar wiring
        if (seekEl) {
            audio.addEventListener('loadedmetadata', () => {
                if (!isNaN(audio.duration) && audio.duration > 0) {
                    seekEl.max = String(audio.duration);
                    seekEl.value = '0';
                }
            });

            audio.addEventListener('timeupdate', () => {
                if (isSeeking) return;
                if (!isNaN(audio.currentTime)) {
                    seekEl.value = String(audio.currentTime);
                    // periodically persist playback position
                    savePlayerState();
                }
            });

            seekEl.addEventListener('input', () => {
                if (isNaN(audio.duration) || audio.duration <= 0) return;
                isSeeking = true;
                const val = parseFloat(seekEl.value || '0') || 0;
                audio.currentTime = Math.max(0, Math.min(val, audio.duration));
                isSeeking = false;
            });
        }

        // Volume slider wiring
        if (volumeEl) {
            audio.volume = 1;
            volumeEl.value = '1';
            volumeEl.addEventListener('input', () => {
                let vol = parseFloat(volumeEl.value || '1');
                if (isNaN(vol)) vol = 1;
                vol = Math.max(0, Math.min(vol, 1));
                audio.volume = vol;
                if (vol === 0) {
                    audio.muted = true;
                } else {
                    audio.muted = false;
                    lastVolume = vol;
                }
                const icon = muteBtn.querySelector('i');
                if (icon) {
                    if (audio.muted || vol === 0) {
                        icon.classList.remove('fa-volume-high');
                        icon.classList.add('fa-volume-xmark');
                    } else {
                        icon.classList.remove('fa-volume-xmark');
                        icon.classList.add('fa-volume-high');
                    }
                }
                savePlayerState();
            });
        }

        // Album grid integration: clicking entries controls the mini player.
        const bindAlbumLinks = () => {
            const albumLinks = document.querySelectorAll('.album-link:not([data-no-viewer])');
            if (!albumLinks.length || !tracklistEl) return;

            // Rebuild track library from current album definitions
            trackLibrary.tracks = [];

            albumLinks.forEach(link => {
                // Avoid double-binding if called multiple times
                if (link.dataset.miniPlayerBound === '1') return;
                link.dataset.miniPlayerBound = '1';

                const albumType = (link.getAttribute('data-album-type') || '').toLowerCase();
                const albumName = link.getAttribute('data-album-name') || '';
                const albumArt = link.getAttribute('data-album-art') || '';
                const albumArtist = link.getAttribute('data-album-artist') || '';
                const tracksRaw = link.getAttribute('data-album-tracks') || '[]';

                let tracks;
                try {
                    tracks = JSON.parse(tracksRaw) || [];
                } catch (_) {
                    tracks = [];
                }

                const albumId = albumName + '|' + albumArtist + '|' + albumType;

                // Populate global track library with all tracks from this album
                if (tracks && tracks.length) {
                    tracks.forEach((track, idx) => {
                        const src = track.directory || track.file_directory || '';
                        if (!src) return;
                        const id = normalizeTrackSrc(src);
                        const name = track.name || `Track ${idx + 1}`;
                        trackLibrary.tracks.push({
                            id,
                            src,
                            name,
                            albumName,
                            albumArtist,
                            albumType,
                            albumId,
                            index: idx,
                            albumArt
                        });
                    });
                }

                link.addEventListener('click', (e) => {
                    e.preventDefault();

                    // For Singles and Remixes: play the first defined track
                    // directly in the mini player without showing a track list.
                    if (albumType !== 'album') {
                        if (!tracks.length) return;

                        const first = tracks.find(t => t && (t.directory || t.file_directory));
                        if (!first) return;

                        const src = first.directory || first.file_directory;
                        const name = first.name || albumName || 'Untitled';
                        if (artEl) {
                            artEl.src = albumArt || '';
                        }
                        audio.src = src;
                        audio.play().catch(() => {});
                        setLiveMode(false);
                        setPlayIcon(true);
                        clearActiveTracks();
                        if (tracklistEl) {
                            tracklistEl.innerHTML = '';
                            tracklistEl.style.display = 'none';
                        }
                        const artistLabelSingle = albumArtist ? ' - ' + albumArtist : '';
                        setNowPlayingTitle(name + artistLabelSingle);
                        setMediaSessionMetadata({
                            name,
                            albumArtist,
                            albumName,
                            albumArt
                        });
                        if (seekEl) {
                            seekEl.value = '0';
                        }
                        savePlayerState();
                        updateVisibility();
                        updatePlayingClass();
                        // Singles/Remixes do not start an album run; next autoplay is random
                        albumRunState = null;
                        return;
                    }

                    // For full Albums: populate the track list above the player.
                    tracklistEl.innerHTML = '';
                    clearActiveTracks();
                    tracklistEl.style.display = 'none';

                    if (!tracks.length) {
                        const empty = document.createElement('div');
                        empty.className = 'mini-track';
                        empty.textContent = 'no tracks defined';
                        tracklistEl.appendChild(empty);
                        tracklistEl.style.display = 'flex';
                        return;
                    }

                    tracks.forEach((track, idx) => {
                        const name = track.name || `Track ${idx + 1}`;
                        const src = track.directory || track.file_directory || '';
                        if (!src) return;

                        const row = document.createElement('div');
                        row.className = 'mini-track';
                        row.textContent = `${idx + 1}. ${name}`;
                        row.dataset.src = src;

                        row.addEventListener('click', () => {
                            if (!row.dataset.src) return;
                            audio.src = row.dataset.src;
                            audio.play().catch(() => {});
                            setLiveMode(false);
                            setPlayIcon(true);
                            clearActiveTracks();
                            row.classList.add('active');
                            if (artEl) {
                                artEl.src = albumArt || '';
                            }
                            const artistLabel = albumArtist ? ' - ' + albumArtist : '';
                            setNowPlayingTitle(name + artistLabel);
                            setMediaSessionMetadata({
                                name,
                                albumArtist,
                                albumName,
                                albumArt
                            });
                            if (seekEl) {
                                seekEl.value = '0';
                            }
                            savePlayerState();
                            updateVisibility();
                            updatePlayingClass();

                            // When the user selects an album track, start an album run
                            const trackId = normalizeTrackSrc(row.dataset.src);
                            startAlbumRunFromIndex(albumId, idx);
                        });

                        tracklistEl.appendChild(row);
                        if (tracklistEl.style.display !== 'flex') {
                            tracklistEl.style.display = 'flex';
                        }
                    });
                });
            });
        };

        // Bind immediately for the current page and expose a global
        // hook so SPA navigation can re-bind after content changes.
        bindAlbumLinks();
        window.bindMiniPlayerAlbumLinks = bindAlbumLinks;

        // Enable media session actions for hardware/notification controls
        bindMediaSessionActions();

        // Mark audio element as initialized so subsequent calls to
        // initMiniPlayer from SPA navigation only re-bind album
        // links instead of duplicating listeners.
        audio.dataset.initialized = '1';

        // Restore previous playback state (cross-page continuity)
        try {
            const rawState = window.localStorage.getItem(PLAYER_STATE_KEY);
            if (rawState) {
                const state = JSON.parse(rawState);
                if (state && state.src) {
                    audio.src = state.src;
                    if (typeof state.volume === 'number' && volumeEl) {
                        audio.volume = Math.max(0, Math.min(1, state.volume));
                        volumeEl.value = String(audio.volume);
                    }
                    audio.muted = !!state.muted;
                    if (muteBtn) {
                        const icon = muteBtn.querySelector('i');
                        if (icon) {
                            if (audio.muted || audio.volume === 0) {
                                icon.classList.remove('fa-volume-high');
                                icon.classList.add('fa-volume-xmark');
                            } else {
                                icon.classList.remove('fa-volume-xmark');
                                icon.classList.add('fa-volume-high');
                            }
                        }
                    }
                    if (artEl && state.art) {
                        artEl.src = state.art;
                    }
                    if (state.title) {
                        setNowPlayingTitle(state.title);
                    }
                    if (typeof state.currentTime === 'number' && state.currentTime > 0) {
                        audio.addEventListener('loadedmetadata', function restoreTimeOnce() {
                            audio.removeEventListener('loadedmetadata', restoreTimeOnce);
                            if (!isNaN(audio.duration) && state.currentTime <= audio.duration) {
                                audio.currentTime = state.currentTime;
                            }
                        });
                    }
                    // After a full page refresh, always start paused
                    // at the last known position instead of auto-playing.
                    audio.pause();
                    setPlayIcon(false);
                    updateVisibility();
                    updatePlayingClass();
                }
            }
        } catch (_) { /* no-op */ }

        // Ensure correct initial visibility when no track is loaded
        updateVisibility();
    } catch (_) { /* no-op */ }
}

window.addEventListener('DOMContentLoaded', initMiniPlayer);

// Footer active state based on current path
function initFooterActiveState() {
    try {
        const rawPath = (window.location && window.location.pathname) ? window.location.pathname : '/';
        const path = rawPath.replace(/\/+$/, '') || '/'; // normalize trailing slash
        const footerButtons = document.getElementById('footer-buttons');
        if (!footerButtons) return;

        // Determine which footer link should be active
        let activeHref = null;
        if (path === '/') activeHref = '/';
        else if (path.startsWith('/discord')) activeHref = '/discord';
        else if (path.startsWith('/account')) activeHref = '/account'; // covers /account and /account/login
        else if (path.startsWith('/settings')) activeHref = '/settings';

        // Clear any existing active classes
        footerButtons.querySelectorAll('#footer-button.active').forEach(btn => btn.classList.remove('active'));

        // Apply active to the matching footer button
        if (activeHref) {
            const link = Array.from(footerButtons.querySelectorAll('a')).find(a => a.getAttribute('href') === activeHref);
            if (link) {
                const btn = link.querySelector('#footer-button');
                if (btn) btn.classList.add('active');
            }
        }

        // Mark mini player initialized
        audio.dataset.initialized = '1';

        // Ensure toast listen-along bindings exist
        initToastListenAlong();
    } catch (_) { /* no-op */ }
}

// Toast listen-along support (works with SPA navigation)
function initToastListenAlong() {
    if (window.__toastListenAlongBound) return;
    window.__toastListenAlongBound = true;

    document.addEventListener('click', (event) => {
        const btn = event.target && event.target.closest ? event.target.closest('#listen-along-button') : null;
        if (!btn) return;
        event.preventDefault();
        playToastStreamInMiniPlayer();
    });

    const audio = document.getElementById('mini-player-audio');
    if (audio && !audio.dataset.toastBound) {
        audio.dataset.toastBound = '1';
        audio.addEventListener('play', () => {
            const src = audio.currentSrc || audio.src || '';
            const candidates = (window.__toastStreamCandidates || []).map((c) => {
                try {
                    return new URL(c, window.location.origin).toString().split('?')[0];
                } catch (_) {
                    return (c || '').split('?')[0];
                }
            });
            const isToast = candidates.some(c => c && src.startsWith(c));
            setToastLiveControls(isToast);
            audio.dataset.toastLive = isToast ? '1' : '';
        });
    }
}

async function playToastStreamInMiniPlayer() {
    try {
        const response = await fetch('/api/discord-bot-status/');
        const data = await response.json();

        const streamUrlRaw = data && data.stream ? data.stream.url : '';
        const streamName = (data && data.stream && data.stream.name) ? data.stream.name : 'live stream';

        if (!streamUrlRaw) return;

        const audio = document.getElementById('mini-player-audio');
        if (!audio) {
            window.location.href = '/music';
            return;
        }

        const resolved = await resolveToastStreamUrl(streamUrlRaw);
        if (!resolved) return;

        const rawCandidates = buildToastStreamCandidates(resolved);
        if (!rawCandidates.length) return;

        // If a candidate is already https, play it directly; otherwise proxy to avoid mixed content
        const candidates = rawCandidates
            .map((u) => {
                try {
                    const parsed = new URL(u, window.location.href);
                    if (parsed.protocol === 'https:') return parsed.toString();
                    return buildToastProxyUrl(parsed.toString());
                } catch (_) {
                    return buildToastProxyUrl(u);
                }
            })
            .filter(Boolean);
        if (!candidates.length) return;

        window.__toastStreamCandidates = candidates.slice();

        const titleEl = document.getElementById('mini-player-title-inner');
        if (titleEl) {
            titleEl.textContent = streamName;
        }

        const artEl = document.getElementById('mini-player-art');
        const streamArt = 'https://images-ext-1.discordapp.net/external/S3f2i3R92rowfL9Uq5RmPFJtaqtluL-J7lVley9Ps7I/%3Fsize%3D4096/https/cdn.discordapp.com/avatars/1408177993284587794/2fd48df24ed679f3450b2532fce3f80b.png';
        if (artEl) {
            artEl.src = streamArt;
        }

        setToastLiveControls(true);

        let currentIndex = 0;
        const tryPlay = (idx) => {
            if (idx >= candidates.length) return;
            audio.src = candidates[idx];
            audio.play().catch(() => {});
        };

        const onError = () => {
            currentIndex += 1;
            if (currentIndex < candidates.length) {
                tryPlay(currentIndex);
            }
        };

        audio.addEventListener('error', onError, { once: true });
        tryPlay(0);

        const playIcon = document.querySelector('#mini-player-play i');
        if (playIcon) {
            playIcon.classList.remove('fa-play');
            playIcon.classList.add('fa-pause');
        }

        try {
            const state = {
                src: audio.src,
                currentTime: 0,
                paused: false,
                volume: audio.volume,
                muted: audio.muted,
                title: titleEl ? titleEl.textContent : '',
                art: streamArt
            };
            window.localStorage.setItem('miniPlayerStateV1', JSON.stringify(state));
        } catch (_) { /* no-op */ }
    } catch (err) {
        console.error('Failed to start listen-along:', err);
    }
}

function setToastLiveControls(isLive) {
    const miniPlayerEl = document.getElementById('mini-player');
    const seekEl = document.getElementById('mini-player-seek');
    const downloadBtn = document.getElementById('mini-player-download');
    if (miniPlayerEl) miniPlayerEl.classList.toggle('live-stream', !!isLive);
    if (seekEl) seekEl.style.display = isLive ? 'none' : '';
    if (downloadBtn) downloadBtn.style.display = isLive ? 'none' : '';
}

function buildToastProxyUrl(targetUrl) {
    if (!targetUrl) return null;
    try {
        const parsed = new URL(targetUrl, window.location.href);
        if (!/^https?:$/.test(parsed.protocol)) return null;
        return '/api/stream-proxy/?u=' + encodeURIComponent(parsed.toString());
    } catch (_) {
        return null;
    }
}

// If a toast stream is already loaded (e.g., after refresh), keep live controls hidden
async function ensureToastLiveControlsOnLoad() {
    try {
        const audio = document.getElementById('mini-player-audio');
        if (!audio) return;

        const src = audio.currentSrc || audio.src || '';
        if (!src) return;

        const statusResp = await fetch('/api/discord-bot-status/');
        if (!statusResp.ok) return;
        const data = await statusResp.json();
        const streamUrlRaw = data && data.stream ? data.stream.url : '';
        if (!streamUrlRaw) return;

        const resolved = await resolveToastStreamUrl(streamUrlRaw);
        if (!resolved) return;

        const rawCandidates = buildToastStreamCandidates(resolved);
        if (!rawCandidates.length) return;

        const candidates = rawCandidates
            .map((u) => {
                try {
                    const parsed = new URL(u, window.location.href);
                    if (parsed.protocol === 'https:') return parsed.toString();
                    return buildToastProxyUrl(parsed.toString());
                } catch (_) {
                    return buildToastProxyUrl(u);
                }
            })
            .filter(Boolean)
            .map((u) => {
                try {
                    return new URL(u, window.location.origin).toString().split('?')[0];
                } catch (_) {
                    return (u || '').split('?')[0];
                }
            });

        const audioSrc = (() => {
            try { return new URL(src, window.location.origin).toString().split('?')[0]; }
            catch (_) { return (src || '').split('?')[0]; }
        })();

        const isToast = candidates.some(c => c && audioSrc.startsWith(c));
        if (isToast) {
            window.__toastStreamCandidates = candidates.slice();
            setToastLiveControls(true);
            audio.dataset.toastLive = '1';
        }
    } catch (_) { /* no-op */ }
}

async function resolveToastStreamUrl(url) {
    if (!url) return null;
    const normalize = (u) => {
        if (!u) return u;
        const trimmed = u.trim();
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) return trimmed;
        if (trimmed.startsWith('//')) return 'http:' + trimmed;
        return 'http://' + trimmed.replace(/\/$/, '');
    };

    const base = normalize(url);

    if (!/\.m3u8?$|\.pls$/i.test(base)) {
        return base;
    }

    try {
        const resp = await fetch(base);
        const text = await resp.text();

        if (/\.pls$/i.test(base)) {
            const match = text.match(/File\d+\s*=\s*(.+)/i);
            if (match && match[1]) {
                return normalize(match[1]);
            }
        }

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            if (line.startsWith('#')) continue;
            return normalize(line);
        }
    } catch (_) { /* no-op */ }

    return base;
}

function buildToastStreamCandidates(resolvedUrl) {
    if (!resolvedUrl) return [];
    try {
        const urlObj = new URL(resolvedUrl, window.location.href);
        const path = urlObj.pathname || '/';
        const hasPath = path && path !== '/' && path !== '';
        if (hasPath) return [urlObj.toString()];

        const origins = urlObj.origin;
        return [
            origins + '/;stream.nsv',
            origins + '/;?icy=http',
            origins + '/;stream.mp3',
            origins + '/;',
            origins + '/stream',
            origins + '/stream/',
            origins + '/live',
            origins + '/radio',
            origins + '/'
        ];
    } catch (_) {
        return [resolvedUrl];
    }
}

window.addEventListener('DOMContentLoaded', initFooterActiveState);
window.addEventListener('DOMContentLoaded', ensureToastLiveControlsOnLoad);

// Sidebar active state based on current path
function initSidebarActiveState() {
    try {
        const rawPath = (window.location && window.location.pathname) ? window.location.pathname : '/';
        const path = rawPath.replace(/\/+$/, '') || '/'; // normalize trailing slash
        const sidebarEl = document.getElementById('sidebar');
        if (!sidebarEl) return;

        // Map of sidebar routes
        const routes = [
            '/feed',
            '/journal',
            '/email',
            '/guestbook',
            '/music',
            '/gallery',
            '/projects',
            '/merch',
            '/bookmarks',
            '/saves',
            '/others',
        ];

        // Determine active href based on prefix match
        const activeHref = routes.find(r => path.startsWith(r)) || null;

        // Clear any existing active classes in sidebar tabs
        sidebarEl.querySelectorAll('#tab.active').forEach(tab => tab.classList.remove('active'));

        // Apply active to matching sidebar tab
        if (activeHref) {
            const link = Array.from(sidebarEl.querySelectorAll('a')).find(a => a.getAttribute('href') === activeHref);
            if (link) {
                const tab = link.querySelector('#tab');
                if (tab) tab.classList.add('active');
            }
        }
    } catch (_) { /* no-op */ }
}

window.addEventListener('DOMContentLoaded', initSidebarActiveState);

if (hideSidebarBtn) {
    hideSidebarBtn.addEventListener('click', function() {
        sidebar.style.display = 'none';
        showSidebarBtn.style.display = 'inline-block';
        localStorage.setItem(SIDEBAR_KEY, 'false');
    });
}

if (showSidebarBtn) {
    showSidebarBtn.addEventListener('click', function() {
        sidebar.style.display = 'flex';
        showSidebarBtn.style.display = 'none';
        localStorage.setItem(SIDEBAR_KEY, 'true');
    });
}

// Detect logged-in state based on presence of the Logout footer link
function isLoggedIn() {
    try {
        return !!document.querySelector('a[href="/account/logout"]');
    } catch (_) {
        return false;
    }
}

// Bookmark helpers: localStorage-backed list of post IDs (for anonymous users only)
function getStoredBookmarks() {
    try {
        if (isLoggedIn()) return [];
        const raw = localStorage.getItem('bookmarkedPosts');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function setStoredBookmarks(list) {
    try {
        if (isLoggedIn()) return; // keep logged-in users server-side only
        const unique = Array.from(new Set(list.map(String)));
        localStorage.setItem('bookmarkedPosts', JSON.stringify(unique));
    } catch (_) {
        // ignore storage errors
    }
}

function syncBookmarkIcons() {
    if (isLoggedIn()) return; // logged-in users rely on server state, not localStorage
    const bookmarks = getStoredBookmarks();
    const postBookmarks = document.querySelectorAll('#post-bookmark, #post-bookmark-feed');
    postBookmarks.forEach(bookmark => {
        const icon = bookmark.querySelector('i');
        if (!icon) return;
        const id = bookmark.dataset.postId;
        if (id && bookmarks.includes(id)) {
            icon.classList.add('fa-solid');
            icon.classList.remove('fa-regular');
        } else {
            icon.classList.add('fa-regular');
            icon.classList.remove('fa-solid');
        }
    });
}

function attachBookmarkBehavior(bookmark) {
    const icon = bookmark.querySelector('i');
    if (!icon) return;

    const postId = bookmark.dataset.postId || null;

    // Track the canonical bookmarked state on the element so that
    // hover effects can temporarily change the icon without losing
    // whether this post is actually bookmarked.
    if (!bookmark.dataset.bookmarked) {
        bookmark.dataset.bookmarked = icon.classList.contains('fa-solid') ? '1' : '0';
    }

    // Hover: always show solid while hovering
    bookmark.addEventListener('mouseenter', function() {
        icon.classList.add('fa-solid');
        icon.classList.remove('fa-regular');
    });

    bookmark.addEventListener('mouseleave', function() {
        // For logged-in users, revert to the element's own
        // bookmarked flag rather than localStorage.
        if (isLoggedIn()) {
            const isMarked = bookmark.dataset.bookmarked === '1';
            if (isMarked) {
                icon.classList.add('fa-solid');
                icon.classList.remove('fa-regular');
            } else {
                icon.classList.add('fa-regular');
                icon.classList.remove('fa-solid');
            }
            return;
        }

        // Anonymous users: derive state from localStorage
        const bookmarks = getStoredBookmarks();
        const isMarked = postId && bookmarks.includes(postId);
        bookmark.dataset.bookmarked = isMarked ? '1' : '0';
        if (isMarked) {
            icon.classList.add('fa-solid');
            icon.classList.remove('fa-regular');
        } else {
            icon.classList.add('fa-regular');
            icon.classList.remove('fa-solid');
        }
    });

    // Click: toggle bookmark, persist locally, sync to server, and reload preserving scroll
    bookmark.addEventListener('click', function(e) {
        if (!postId) return; // no-op for demo icons without an ID
        e.stopPropagation();
        if (typeof e.preventDefault === 'function') e.preventDefault();

        // Logged-in users: toggle server-side bookmark and reflect
        // the new state on this element.
        if (isLoggedIn()) {
            const currentlyMarked = bookmark.dataset.bookmarked === '1';
            const nextMarked = !currentlyMarked;
            bookmark.dataset.bookmarked = nextMarked ? '1' : '0';
            if (nextMarked) {
                icon.classList.add('fa-solid');
                icon.classList.remove('fa-regular');
            } else {
                icon.classList.add('fa-regular');
                icon.classList.remove('fa-solid');
            }

            // Fire-and-forget server toggle
            try {
                fetch('/api/bookmark/index.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ postId })
                })
                    .then(resp => {
                        if (!resp.ok) throw new Error('bookmark failed');
                    })
                    .catch(() => {
                        // Revert on failure so UI stays truthful
                        bookmark.dataset.bookmarked = currentlyMarked ? '1' : '0';
                        if (currentlyMarked) {
                            icon.classList.add('fa-solid');
                            icon.classList.remove('fa-regular');
                        } else {
                            icon.classList.add('fa-regular');
                            icon.classList.remove('fa-solid');
                        }
                        alert('Could not update bookmark.');
                    });
                return; // no page reload needed
            } catch (_) {
                // If fetch setup fails, revert state
                bookmark.dataset.bookmarked = currentlyMarked ? '1' : '0';
                if (currentlyMarked) {
                    icon.classList.add('fa-solid');
                    icon.classList.remove('fa-regular');
                } else {
                    icon.classList.add('fa-regular');
                    icon.classList.remove('fa-solid');
                }
                alert('Could not update bookmark.');
                return;
            }
        } else {
            // Anonymous users: maintain bookmarks in localStorage
            let bookmarks = getStoredBookmarks();
            const idx = bookmarks.indexOf(postId);
            if (idx === -1) {
                bookmarks.push(postId);
            } else {
                bookmarks.splice(idx, 1);
            }
            setStoredBookmarks(bookmarks);
            syncBookmarkIcons();

            // Fire-and-forget server sync (will 401 when not logged in, which is fine)
            try {
                fetch('/api/bookmark/index.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ bookmarks })
                }).catch(() => {});
            } catch (_) { /* ignore */ }
        }
    });
}

function initScrollAndBookmarkIcons() {
    // Restore scroll position if set
    try {
        const scrollKey = 'scroll:' + window.location.pathname + window.location.search;
        const saved = sessionStorage.getItem(scrollKey);
        if (saved !== null) {
            const y = parseInt(saved, 10);
            if (!isNaN(y)) {
                window.scrollTo(0, y);
            }
            sessionStorage.removeItem(scrollKey);
        }
    } catch (_) { /* no-op */ }

    // Attach bookmark behaviors
    try {
        const postBookmarks = document.querySelectorAll('#post-bookmark, #post-bookmark-feed');
        postBookmarks.forEach(attachBookmarkBehavior);

        // Ensure icons reflect stored state on initial load
        syncBookmarkIcons();
    } catch (_) { /* no-op */ }
}

window.addEventListener('DOMContentLoaded', initScrollAndBookmarkIcons);

// Image lightbox functionality
const imageModal = document.createElement('div');
imageModal.className = 'image-modal';
document.body.appendChild(imageModal);

document.addEventListener('click', function(e) {
    // Support inline post images everywhere; grid lightbox only on /gallery
    if (e.target && e.target.closest && e.target.closest('.grid-delete-form')) {
        return; // allow delete buttons to use their own handlers
    }
    const rawPath = (window.location && window.location.pathname) ? window.location.pathname : '/';
    const path = rawPath.replace(/\/+$/, '') || '/';
    const allowGridLightbox = path === '/gallery' || path.startsWith('/gallery/');

    let targetImg = null;
    const clickedImg = e.target && e.target.closest ? e.target.closest('img') : null;

    // If toast stream is playing, clicking cover art should navigate to the toast page
    if (clickedImg && clickedImg.id === 'mini-player-art') {
        const miniPlayerEl = document.getElementById('mini-player');
        const isLive = miniPlayerEl && miniPlayerEl.classList.contains('live-stream');
        if (isLive) {
            e.preventDefault();
            e.stopPropagation();
            const targetUrl = '/others/toast-discord-bot';
            if (typeof loadPageIntoContent === 'function') {
                loadPageIntoContent(targetUrl);
            } else {
                window.location.href = targetUrl;
            }
            return;
        }
    }

    if (clickedImg && clickedImg.closest('.image-modal')) {
        return; // ignore clicks inside the modal itself
    }

    if (clickedImg && clickedImg.id === 'post-image') {
        targetImg = clickedImg;
    } else if (allowGridLightbox && clickedImg) {
        const fromGrid = clickedImg.closest('.grid-item');
        if (fromGrid) {
            targetImg = fromGrid.querySelector('.grid-image');
        }
    } else if (clickedImg) {
        targetImg = clickedImg; // fallback: any image opens in viewer
    }

    if (targetImg) {
        const imageSrc = targetImg.src;
        const filename = targetImg.alt || imageSrc.split('/').pop();
        const content = document.createElement('div');
        content.className = 'image-modal-content';
        
        const filenameSpan = document.createElement('span');
        filenameSpan.className = 'image-modal-filename';
        filenameSpan.textContent = filename;
        
        const modalImg = document.createElement('img');
        modalImg.src = imageSrc;
        
        const expandLink = document.createElement('a');
        expandLink.className = 'image-modal-expand';
        expandLink.textContent = 'click to expand';
        expandLink.href = imageSrc;
        expandLink.target = '_blank';
        
        content.appendChild(filenameSpan);
        content.appendChild(modalImg);
        content.appendChild(expandLink);
        
        imageModal.innerHTML = '';
        imageModal.appendChild(content);
        imageModal.classList.add('active');
    }
});

imageModal.addEventListener('click', function(e) {
    if (e.target === imageModal) {
        imageModal.classList.remove('active');
    }
});

// Admin-only gallery delete handler
async function submitGalleryDelete(form) {
    const filenameInput = form.querySelector('input[name="filename"]');
    const deleteButton = form.querySelector('.grid-delete-button');
    const filename = filenameInput ? filenameInput.value.trim() : '';
    if (!filename) return;

    const confirmed = window.confirm('Delete ' + filename + '?');
    if (!confirmed) return;

    const originalLabel = deleteButton ? deleteButton.innerHTML : '';
    if (deleteButton) {
        deleteButton.disabled = true;
        deleteButton.innerHTML = '<i class="fa-solid fa-hourglass" aria-hidden="true"></i> deleting...';
    }

    try {
        const resp = await fetch('/api/gallery/delete/index.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ filename })
        });

        let payload = {};
        try {
            payload = await resp.json();
        } catch (_) {
            payload = {};
        }

        if (!resp.ok || payload.ok !== true) {
            const message = payload.error || 'failed to delete image';
            throw new Error(message);
        }

        const card = form.closest('.grid-item');
        if (card) {
            card.remove();
        }
    } catch (err) {
        alert('Delete failed: ' + err.message);
    } finally {
        if (deleteButton) {
            deleteButton.disabled = false;
            deleteButton.innerHTML = originalLabel || 'delete';
        }
    }
}

document.addEventListener('submit', function(e) {
    const form = e.target && e.target.closest ? e.target.closest('.grid-delete-form') : null;
    if (!form) return;
    if (!window.fetch) return; // fall back to normal submission when fetch isn't available
    e.preventDefault();
    submitGalleryDelete(form);
});

// Note: /bookmarks is rendered server-side from the user's bookmark JSON.

// Enhance /bookmarks with localStorage bookmarks for non-logged-in users
function enhanceBookmarksPage() {
    try {
        const rawPath = (window.location && window.location.pathname) ? window.location.pathname : '/';
        const path = rawPath.replace(/\/+$/, '') || '/';
        if (!(path.startsWith('/bookmarks') || path.startsWith('/saves'))) return;

        const container = document.getElementById('bookmarks-list');
        if (!container) return;

        const localIds = getStoredBookmarks();
        if (!localIds.length) return;

        const existingIds = new Set();
        container.querySelectorAll('#post-bookmark-feed[data-post-id]').forEach(el => {
            if (el.dataset.postId) existingIds.add(el.dataset.postId);
        });

        const idsToAdd = localIds.filter(id => !existingIds.has(id));
        if (!idsToAdd.length) return;

        // If container only has placeholder text, clear it before adding posts
        if (!container.querySelector('#post')) {
            container.innerHTML = '';
        }

        idsToAdd.forEach(id => {
            fetch('/api/feed-post/index.php?id=' + encodeURIComponent(id))
                .then(resp => resp.ok ? resp.json() : null)
                .then(data => {
                    if (!data) return;

                    const postLink = document.createElement('a');
                    postLink.href = '/feed/posts/?=' + encodeURIComponent(id);
                    postLink.className = 'feed-post-link';
                    postLink.style.textDecoration = 'none';
                    postLink.style.color = 'inherit';

                    const post = document.createElement('div');
                    post.id = 'post';
                    post.style.cursor = 'pointer';

                    const header = document.createElement('div');
                    header.id = 'post-header';

                    const userSpan = document.createElement('span');
                    userSpan.id = 'post-username';
                    userSpan.textContent = '@' + data.username;

                    const dateSpan = document.createElement('span');
                    dateSpan.id = 'post-date-feed';

                    const bookmarkSpan = document.createElement('span');
                    bookmarkSpan.id = 'post-bookmark-feed';
                    bookmarkSpan.dataset.tooltip = 'add to bookmarks';
                    bookmarkSpan.dataset.postId = id;
                    const icon = document.createElement('i');
                    icon.className = 'fa-regular fa-bookmark';
                    bookmarkSpan.appendChild(icon);

                    dateSpan.textContent = data.date_human + ' • ';
                    dateSpan.appendChild(bookmarkSpan);

                    header.appendChild(userSpan);
                    header.appendChild(dateSpan);

                    const bodySpan = document.createElement('span');
                    bodySpan.id = 'post-content';
                    bodySpan.textContent = data.body || '';

                    post.appendChild(header);
                    post.appendChild(bodySpan);
                    postLink.appendChild(post);
                    container.appendChild(postLink);

                    // Attach bookmark behavior and sync icon state for the new bookmark icon
                    attachBookmarkBehavior(bookmarkSpan);
                    syncBookmarkIcons();

                    // Apply BBCode formatting to this post body
                    try {
                        const raw = bodySpan.textContent || '';
                        const html = parseBBCode(raw);
                        bodySpan.innerHTML = html;

                        if (typeof hljs !== 'undefined') {
                            bodySpan.querySelectorAll('pre code').forEach((block) => {
                                hljs.highlightElement(block);
                            });
                        }
                    } catch (_) { /* no-op */ }
                })
                .catch(() => { /* ignore */ });
        });
    } catch (_) { /* no-op */ }
}

window.addEventListener('DOMContentLoaded', enhanceBookmarksPage);

// BBCode formatting state (images + file list) is global so that
// it can be reused when the editor is loaded via SPA navigation.
const bbcodeImages = new Map();
const imageFileStore = new DataTransfer();
let isPreviewMode = false;

// Compress images client-side to JPEG under 1MB (also converts PNG/GIF/WEBP to JPEG)
async function compressImageToJpegUnder1MB(file, maxBytes = 1000000) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = async function() {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas not supported'));
                return;
            }

            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;
            canvas.width = width;
            canvas.height = height;

            const drawWhite = () => {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };

            const toBlobPromise = (quality) => new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));

            let quality = 0.9;
            let blob = null;

            const tryCompress = async () => {
                drawWhite();
                blob = await toBlobPromise(quality);
                return blob && blob.size <= maxBytes;
            };

            // First pass: reduce quality
            while (quality >= 0.4) {
                const ok = await tryCompress();
                if (ok) break;
                quality -= 0.1;
            }

            // If still too big, scale down dimensions gradually and retry quality ladder
            let scale = 0.9;
            while (blob && blob.size > maxBytes && scale > 0.3) {
                width = Math.max(1, Math.floor(width * scale));
                height = Math.max(1, Math.floor(height * scale));
                canvas.width = width;
                canvas.height = height;
                quality = 0.9;
                while (quality >= 0.4) {
                    const ok = await tryCompress();
                    if (ok) break;
                    quality -= 0.1;
                }
                scale -= 0.1;
            }

            if (!blob) {
                reject(new Error('Compression failed'));
                return;
            }

            const baseName = (file.name || 'image').replace(/\.[^.]+$/, '') || 'image';
            const compressedFile = new File([blob], baseName + '.jpg', { type: 'image/jpeg' });
            resolve(compressedFile);
        };
        img.onerror = function() {
            URL.revokeObjectURL(url);
            reject(new Error('Image load failed'));
        };
        img.src = url;
    });
}

function initBBCodeEditor() {
    const bbcodeTextbox = document.getElementById('bbcode-textbox');
    const bbcodePreview = document.getElementById('bbcode-preview');
    const bbcodePreviewToggle = document.getElementById('bbcode-preview-toggle');
    const bbcodeHeaderDropdown = document.getElementById('bbcode-header-dropdown');
    const bbcodeButtons = document.querySelectorAll('.bbcode-btn');

    // Avoid rebinding if this editor instance is already initialized
    if (!bbcodeTextbox || bbcodeTextbox.dataset.bbcodeInitialized === '1') return;
    bbcodeTextbox.dataset.bbcodeInitialized = '1';

    bbcodeButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.id === 'bbcode-preview-toggle' || this.id === 'bbcode-image-btn' || this.id === 'bbcode-color-btn' || this.id === 'bbcode-tooltip-btn' || this.id === 'bbcode-link-btn' || this.id === 'bbcode-spoiler-btn') return;
            
            const tag = this.getAttribute('data-tag');
            const start = bbcodeTextbox.selectionStart;
            const end = bbcodeTextbox.selectionEnd;
            const selectedText = bbcodeTextbox.value.substring(start, end);
            const beforeText = bbcodeTextbox.value.substring(0, start);
            const afterText = bbcodeTextbox.value.substring(end);
            
            // Use base tag for closing when tag contains an assignment (e.g., code=python)
            const closingTag = tag.includes('=') ? tag.split('=')[0] : tag;
            const newText = `[${tag}]${selectedText}[/${closingTag}]`;
            bbcodeTextbox.value = beforeText + newText + afterText;
            
            // Set cursor position after the inserted tags
            const newCursorPos = start + tag.length + 2 + selectedText.length;
            bbcodeTextbox.focus();
            bbcodeTextbox.setSelectionRange(newCursorPos, newCursorPos);
        });
    });
    
    // Header dropdown
    if (bbcodeHeaderDropdown) {
        bbcodeHeaderDropdown.addEventListener('change', function() {
            const tag = this.value;
            if (!tag) return;
            
            const start = bbcodeTextbox.selectionStart;
            const end = bbcodeTextbox.selectionEnd;
            const selectedText = bbcodeTextbox.value.substring(start, end);
            const beforeText = bbcodeTextbox.value.substring(0, start);
            const afterText = bbcodeTextbox.value.substring(end);
            
            const newText = `[${tag}]${selectedText}[/${tag}]`;
            bbcodeTextbox.value = beforeText + newText + afterText;
            
            // Set cursor position after the inserted tags
            const newCursorPos = start + tag.length + 2 + selectedText.length;
            bbcodeTextbox.focus();
            bbcodeTextbox.setSelectionRange(newCursorPos, newCursorPos);
            
            // Reset dropdown
            this.value = '';
        });
    }
        // Link insertion
        const bbcodeLinkBtn = document.getElementById('bbcode-link-btn');
        if (bbcodeLinkBtn) {
            bbcodeLinkBtn.addEventListener('click', function() {
                const defaultUrl = 'https://example.com';
                const start = bbcodeTextbox.selectionStart;
                const end = bbcodeTextbox.selectionEnd;
                const selectedText = bbcodeTextbox.value.substring(start, end);
                const beforeText = bbcodeTextbox.value.substring(0, start);
                const afterText = bbcodeTextbox.value.substring(end);

                const isLikelyUrl = (txt) => {
                    const t = (txt || '').trim();
                    return /^https?:\/\/\S+$/i.test(t) || /^www\..+/i.test(t);
                };

                let url = defaultUrl;
                let linkText = '';

                if (selectedText && isLikelyUrl(selectedText)) {
                    url = selectedText.trim();
                    if (/^www\./i.test(url)) {
                        url = 'https://' + url;
                    }
                    linkText = '';
                } else if (selectedText && selectedText.trim().length) {
                    url = defaultUrl;
                    linkText = selectedText;
                } else {
                    url = defaultUrl;
                    linkText = '';
                }

                const newText = `[link=${url}]${linkText}[/link]`;
                bbcodeTextbox.value = beforeText + newText + afterText;
                const newCursorPos = start + newText.length;
                bbcodeTextbox.focus();
                bbcodeTextbox.setSelectionRange(newCursorPos, newCursorPos);
            });
        }
    
    // Tooltip insertion
    const bbcodeTooltipBtn = document.getElementById('bbcode-tooltip-btn');
    if (bbcodeTooltipBtn) {
        bbcodeTooltipBtn.addEventListener('click', function() {
            const tipText = 'text here';
            const start = bbcodeTextbox.selectionStart;
            const end = bbcodeTextbox.selectionEnd;
            const selectedText = bbcodeTextbox.value.substring(start, end);
            const beforeText = bbcodeTextbox.value.substring(0, start);
            const afterText = bbcodeTextbox.value.substring(end);
            const openTag = `tooltip="${tipText}"`;
            const newText = `[${openTag}]${selectedText}[/tooltip]`;
            bbcodeTextbox.value = beforeText + newText + afterText;
            const newCursorPos = start + newText.length;
            bbcodeTextbox.focus();
            bbcodeTextbox.setSelectionRange(newCursorPos, newCursorPos);
        });
    }

    // Color picker
    const bbcodeColorBtn = document.getElementById('bbcode-color-btn');
    const bbcodeColorInput = document.getElementById('bbcode-color-input');
    
    if (bbcodeColorBtn && bbcodeColorInput) {
        bbcodeColorBtn.addEventListener('click', function() {
            bbcodeColorInput.click();
        });
        
        bbcodeColorInput.addEventListener('change', function() {
            const color = this.value.toUpperCase();
            const start = bbcodeTextbox.selectionStart;
            const end = bbcodeTextbox.selectionEnd;
            const selectedText = bbcodeTextbox.value.substring(start, end);
            const beforeText = bbcodeTextbox.value.substring(0, start);
            const afterText = bbcodeTextbox.value.substring(end);
            
            const newText = `[color:${color}]${selectedText}[/color]`;
            bbcodeTextbox.value = beforeText + newText + afterText;
            
            // Set cursor position after the inserted tags
            const newCursorPos = start + color.length + 9 + selectedText.length;
            bbcodeTextbox.focus();
            bbcodeTextbox.setSelectionRange(newCursorPos, newCursorPos);
        });
    }
    
    // Spoiler button
    const bbcodeSpoilerBtn = document.getElementById('bbcode-spoiler-btn');
    if (bbcodeSpoilerBtn) {
        bbcodeSpoilerBtn.addEventListener('click', function() {
            const start = bbcodeTextbox.selectionStart;
            const end = bbcodeTextbox.selectionEnd;
            const selectedText = bbcodeTextbox.value.substring(start, end);
            const beforeText = bbcodeTextbox.value.substring(0, start);
            const afterText = bbcodeTextbox.value.substring(end);
            
            const newText = `[spoiler]${selectedText}[/spoiler]`;
            bbcodeTextbox.value = beforeText + newText + afterText;
            bbcodeTextbox.focus();
            bbcodeTextbox.setSelectionRange(start + 9, start + 9 + selectedText.length);
        });
    }
    
    // Image attachment
    const bbcodeImageBtn = document.getElementById('bbcode-image-btn');
    const bbcodeImageInput = document.getElementById('bbcode-image-input');
    
    if (bbcodeImageBtn && bbcodeImageInput) {
        bbcodeImageBtn.addEventListener('click', function() {
            const imageUrl = prompt('Enter image URL (or leave blank to select a file)', '');
            if (imageUrl === null) return; // cancelled
            
            if (imageUrl.trim()) {
                // URL provided - use [img=URL][name:filename] format
                const start = bbcodeTextbox.selectionStart;
                const end = bbcodeTextbox.selectionEnd;
                const beforeText = bbcodeTextbox.value.substring(0, start);
                const afterText = bbcodeTextbox.value.substring(end);
                
                const url = imageUrl.trim();
                const fileName = url.split('/').pop() || 'image';
                const newText = `[img=${url}][name:${fileName}]`;
                bbcodeTextbox.value = beforeText + newText + afterText;
                bbcodeTextbox.focus();
                bbcodeTextbox.setSelectionRange(start + newText.length, start + newText.length);
            } else {
                // Open file picker
                bbcodeImageInput.click();
            }
        });
        
        bbcodeImageInput.addEventListener('change', async function(e) {
            const files = Array.from(e.target.files || []);
            for (const file of files) {
                let processedFile = file;
                try {
                    processedFile = await compressImageToJpegUnder1MB(file, 1000000);
                } catch (err) {
                    // If compression fails, fall back to original file (may still exceed limit)
                    processedFile = file;
                }

                const fileIndex = imageFileStore.files.length;
                imageFileStore.items.add(processedFile);

                const reader = new FileReader();
                reader.onload = function(event) {
                    const imageData = event.target.result;
                    bbcodeImages.set(fileIndex, { data: imageData, name: processedFile.name });

                    const start = bbcodeTextbox.selectionStart;
                    const end = bbcodeTextbox.selectionEnd;
                    const beforeText = bbcodeTextbox.value.substring(0, start);
                    const afterText = bbcodeTextbox.value.substring(end);

                    const newText = `[img:${fileIndex}][name:${processedFile.name}]`;
                    bbcodeTextbox.value = beforeText + newText + afterText;
                    const newCursorPos = start + newText.length;
                    bbcodeTextbox.focus();
                    bbcodeTextbox.setSelectionRange(newCursorPos, newCursorPos);
                };
                reader.readAsDataURL(processedFile);
            }

            // Persist accumulated files so multiple selections don't replace earlier ones
            bbcodeImageInput.files = imageFileStore.files;
        });
    }
    
    // Journal drafts: clicking a draft loads it into the form fields
    try {
        const titleInput = document.querySelector('input[name="title"]');
        const descriptionInput = document.querySelector('textarea[name="description"]');
        if (titleInput && descriptionInput && bbcodeTextbox) {
            document.querySelectorAll('.journal-draft-link').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const t = this.dataset.draftTitle || '';
                    const d = this.dataset.draftDescription || '';
                    const body = this.dataset.draftContent || '';
                    titleInput.value = t;
                    descriptionInput.value = d;
                    bbcodeTextbox.value = body;
                });
            });

            // Delete draft buttons (styled like feed edit icon)
            document.querySelectorAll('#post-edit-feed[data-draft-id]').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = this.getAttribute('data-draft-id');
                    if (!id) return;
                    if (!window.confirm('delete this draft?')) return;

                    const form = document.getElementById('create-post-form');
                    if (!form) return;

                    let hidden = form.querySelector('input[name="delete_draft"]');
                    if (!hidden) {
                        hidden = document.createElement('input');
                        hidden.type = 'hidden';
                        hidden.name = 'delete_draft';
                        form.appendChild(hidden);
                    }
                    hidden.value = id;
                    form.submit();
                });
            });
        }
    } catch (_) { /* no-op */ }

    // Preview toggle
    if (bbcodePreviewToggle && bbcodePreview) {
        bbcodePreviewToggle.addEventListener('click', function() {
            isPreviewMode = !isPreviewMode;
            
            if (isPreviewMode) {
                // Show preview
                const bbcodeText = bbcodeTextbox.value;
                const htmlText = parseBBCode(bbcodeText);
                bbcodePreview.innerHTML = htmlText;
                bbcodeTextbox.style.display = 'none';
                bbcodePreview.style.display = 'block';
                
                // Highlight code blocks
                if (typeof hljs !== 'undefined') {
                    bbcodePreview.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                }
                
                // Attach tooltip listeners for newly rendered preview content
                bbcodePreview.querySelectorAll('[data-tooltip]').forEach(element => {
                    element.addEventListener('mouseenter', function(e) {
                        const rawText = this.getAttribute('data-tooltip') || '';
                        const text = rawText.replace(/\\n/g, '<br>');
                        const tooltip = document.createElement('div');
                        tooltip.className = 'tooltip';
                        tooltip.innerHTML = text;
                        document.body.appendChild(tooltip);
                        
                        const updateTooltipPosition = (event) => {
                            const rect = tooltip.getBoundingClientRect();
                            const tooltipWidth = rect.width;
                            const tooltipHeight = rect.height;
                            const offset = 10;
                            let x = event.clientX + offset;
                            let y = event.clientY + offset;
                            if (x + tooltipWidth > window.innerWidth) {
                                x = event.clientX - tooltipWidth - offset;
                            }
                            if (y + tooltipHeight > window.innerHeight) {
                                y = event.clientY - tooltipHeight - offset;
                            }
                            tooltip.style.left = x + 'px';
                            tooltip.style.top = y + 'px';
                        };
                        updateTooltipPosition(e);
                        this.addEventListener('mousemove', updateTooltipPosition);
                        this.addEventListener('mouseleave', () => {
                            tooltip.remove();
                        });
                    });
                });
                
                // Disable toolbar buttons
                bbcodeButtons.forEach(button => {
                    if (button.id !== 'bbcode-preview-toggle') {
                        button.classList.add('disabled');
                    }
                });
                if (bbcodeHeaderDropdown) bbcodeHeaderDropdown.classList.add('disabled');
                const bbcodeLinkBtn = document.getElementById('bbcode-link-btn');
                if (bbcodeLinkBtn) bbcodeLinkBtn.classList.add('disabled');
            } else {
                // Show editor
                bbcodeTextbox.style.display = 'block';
                bbcodePreview.style.display = 'none';
                
                // Enable toolbar buttons
                bbcodeButtons.forEach(button => {
                    button.classList.remove('disabled');
                });
                if (bbcodeHeaderDropdown) bbcodeHeaderDropdown.classList.remove('disabled');
                const bbcodeLinkBtn = document.getElementById('bbcode-link-btn');
                if (bbcodeLinkBtn) bbcodeLinkBtn.classList.remove('disabled');
            }
        });
    }
}

// Ensure the BBCode editor is wired on initial page load
window.addEventListener('DOMContentLoaded', initBBCodeEditor);

// BBCode parser
function parseBBCode(text) {
    // Extract and temporarily store URLs from [img=URL] and [link=URL] before HTML sanitization
    const imgUrlMap = new Map();
    const linkUrlMap = new Map();
    const codeBlockMap = new Map();
    const tooltipMap = new Map();
    let imgCounter = 0;
    let linkCounter = 0;
    let codeCounter = 0;
    let tooltipCounter = 0;
    
    // Replace [code=lang]...[/code] with placeholder to preserve newlines
    text = text.replace(/\[code=(\w+)\](.*?)\[\/code\]/gis, function(match, lang, code) {
        const id = codeCounter++;
        codeBlockMap.set(id, { lang, code });
        return `[code-placeholder:${id}]`;
    });
    
    // Replace [tooltip="text"]content[/tooltip] with placeholder
    text = text.replace(/\[tooltip="(.*?)"\](.*?)\[\/tooltip\]/gis, function(match, tip, content) {
        const id = tooltipCounter++;
        tooltipMap.set(id, { tip, content });
        return `[tooltip-placeholder:${id}]`;
    });
    
    // Replace [img=URL][name:filename] or [img=URL] with placeholder
    // Accept http(s) URLs, root-relative paths (/data/images/...), or simple filenames
    text = text.replace(/\[img=([^\]\s]+)\](?:\[name:(.*?)\])?/gi, function(match, url, customName) {
        const id = imgCounter++;
        imgUrlMap.set(id, { url, name: customName });
        return `[img-placeholder:${id}]`;
    });
    
    // Replace [link=URL]text[/link] with placeholder
    text = text.replace(/\[link=(https?:\/\/[^\]]+)\](.*?)\[\/link\]/gis, function(match, url, text) {
        const id = linkCounter++;
        linkUrlMap.set(id, { url, text });
        return `[link-placeholder:${id}]`;
    });
    
    // Escape HTML to prevent raw HTML injection
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    // Allow explicit <br> tags that users include by unescaping them from the escaped text
    html = html.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    
    html = html.replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>');
    html = html.replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>');
    html = html.replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>');
    html = html.replace(/\[s\](.*?)\[\/s\]/gi, '<s>$1</s>');
    // Simple markdown-style bold/italic using asterisks
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)/g, function(_, prefix, content) {
        return prefix + '<em>' + content + '</em>';
    });
    html = html.replace(/\[h3\](.*?)\[\/h3\]/gi, '<h3>$1</h3>');
    html = html.replace(/\[h4\](.*?)\[\/h4\]/gi, '<h4>$1</h4>');
    html = html.replace(/\[h5\](.*?)\[\/h5\]/gi, '<h5>$1</h5>');
    html = html.replace(/\[spoiler\](.*?)\[\/spoiler\]/gi, '<span class="spoiler">$1</span>');
    html = html.replace(/\[color:(#[0-9A-F]{6})\](.*?)\[\/color\]/gi, '<span style="color: $1;">$2</span>');
    // Lists: [list]line1\nline2[/list] -> <ul><li>line1</li><li>line2</li></ul>
    html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, function(match, inner) {
        const lines = inner.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (!lines.length) return '';
        const items = lines.map(l => `<li>${l}</li>`).join('');
        return `<ul>${items}</ul>`;
    });
    // Remove newlines immediately after heading closing tags
    html = html.replace(/<\/h3>\n/g, '<\/h3>');
    html = html.replace(/<\/h4>\n/g, '<\/h4>');
    html = html.replace(/<\/h5>\n/g, '<\/h5>');
    // Restore [tooltip] placeholders
    html = html.replace(/\[tooltip-placeholder:(\d+)\]/gi, function(match, id) {
        const tooltipData = tooltipMap.get(parseInt(id));
        if (tooltipData) {
            return `<span data-tooltip="${tooltipData.tip}">${tooltipData.content}</span>`;
        }
        return match;
    });
    // Restore [link=URL] placeholders
    html = html.replace(/\[link-placeholder:(\d+)\]/gi, function(match, id) {
        const linkData = linkUrlMap.get(parseInt(id));
        if (linkData) {
            const trimmedText = (linkData.text || '').trim();
            const linkText = trimmedText.length ? trimmedText : linkData.url;
            return `<a href="${linkData.url}" data-tooltip="${linkData.url}" target="_blank">${linkText}</a>`;
        }
        return match;
    });
    // Restore [img=URL] placeholders
    html = html.replace(/\[img-placeholder:(\d+)\]/gi, function(match, id) {
        const imgData = imgUrlMap.get(parseInt(id));
        if (imgData) {
            const fileName = imgData.name || imgData.url.split('/').pop() || 'image';
            return `<img id="post-image" src="${imgData.url}" alt="${fileName}" style="max-width: 100%; height: auto;">`;
        }
        return match;
    });
    // [img:ID][name:...] -> <img src="data URL">
    html = html.replace(/\[img:(\d+)\](?:\[name:(.*?)\])?/gi, function(match, id, customName) {
        const imageObj = bbcodeImages.get(parseInt(id));
        if (imageObj) {
            const fileName = customName || imageObj.name || 'image';
            return `<img id="post-image" src="${imageObj.data}" alt="${fileName}" style="max-width: 100%; height: auto;">`;
        }
        return match;
    });
    // Convert newlines to <br> for regular content
    html = html.replace(/\n/g, '<br>'); // actual newline characters
    html = html.replace(/\\n/g, '<br>'); // literal "\n" sequences
    // Restore code blocks with preserved newlines (after <br> conversion)
    html = html.replace(/\[code-placeholder:(\d+)\]/gi, function(match, id) {
        const codeData = codeBlockMap.get(parseInt(id));
        if (codeData) {
            return `<pre><code class="language-${codeData.lang}">${codeData.code}</code></pre>`;
        }
        return match;
    });
    // Remove any <br> immediately following a code block; CSS margins provide spacing
    html = html.replace(/<\/pre>(<br\s*\/?\s*>)+/gi, '</pre>');

    // Do not allow <br> directly after h3 or h4 headings
    html = html.replace(/(<\/h3>)(<br\s*\/?\s*>)+/gi, '</h3>');
    html = html.replace(/(<\/h4>)(<br\s*\/?\s*>)+/gi, '</h4>');

    // Remove a single <br> directly after each h5 heading (leave any additional spacing)
    html = html.replace(/<\/h5><br\s*\/?\s*>/gi, '</h5>');

    // Remove a single <br> immediately before any h3 heading (collapse extra blank line)
    html = html.replace(/<br\s*\/?\s*>\s*(<h3[^>]*>)/gi, '$1');
    return html;
}

function initToastDiscordBotPage() {
    try {
        const hasToastPage = document.getElementById('control-panel-container') || document.getElementById('listen-along-button');
        if (!hasToastPage) return;

        ensureToastCardStyles();
        toastCheckAdminStatus();
        toastUpdateNowPlaying();

        if (window.__toastStatusInterval) {
            clearInterval(window.__toastStatusInterval);
        }
        window.__toastStatusInterval = setInterval(toastUpdateNowPlaying, 5000);
    } catch (_) { /* no-op */ }
}

function ensureToastCardStyles() {
    if (document.getElementById('toast-discord-card-style')) return;
    const style = document.createElement('style');
    style.id = 'toast-discord-card-style';
    style.textContent = `
@font-face { font-family: 'GG Sans'; src: url('/others/toast-discord-bot/gg-sans-regular.ttf') format('truetype'); font-weight: normal; font-style: normal; }
@font-face { font-family: 'GG Sans'; src: url('/others/toast-discord-bot/gg-sans-bold.ttf') format('truetype'); font-weight: bold; font-style: normal; }
.profile-card { font-family: 'GG Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.profile-name { font-size: 15px; font-family: 'GG Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: bold; line-height: 1.2; }
.profile-username { font-size: 12px; line-height: 1.2; }
.status-line { font-size: 12px; }
.now-playing { font-size: 12px; }
`;
    document.head.appendChild(style);
}

async function toastCheckAdminStatus() {
    try {
        const response = await fetch('/api/account/is-admin/');
        const data = await response.json();
        const isAdmin = data && data.isAdmin === true;

        const controlPanel = document.getElementById('control-panel-container');
        if (controlPanel) {
            controlPanel.style.display = isAdmin ? 'block' : 'none';
        }

        const updateBtn = document.getElementById('update-stream-button');
        if (updateBtn) {
            updateBtn.disabled = !isAdmin;
            if (!isAdmin) {
                updateBtn.style.opacity = '0.5';
                updateBtn.style.cursor = 'not-allowed';
            }
        }
    } catch (_) {
        const controlPanel = document.getElementById('control-panel-container');
        if (controlPanel) {
            controlPanel.style.display = 'none';
        }
    }
}

async function toastUpdateNowPlaying() {
    try {
        const response = await fetch('/api/discord-bot-status/');
        const data = await response.json();

        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-line .muted');
        const nowPlayingEl = document.querySelector('.now-playing');

        if (data && data.bot && data.bot.status) {
            const isOnline = String(data.bot.status).toLowerCase() === 'online';
            if (statusDot) statusDot.style.background = isOnline ? '#6ccf6c' : '#cf6c6c';
            if (statusText) statusText.textContent = isOnline ? 'Online' : 'Offline';
            if (nowPlayingEl) nowPlayingEl.style.display = isOnline ? 'block' : 'none';
        }

        if (data && data.stream && data.stream.name) {
            const nameEl = document.getElementById('now-playing-name');
            if (nameEl) nameEl.textContent = data.stream.name;
        }

    } catch (_) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-line .muted');
        const nowPlayingEl = document.querySelector('.now-playing');
        if (statusDot) statusDot.style.background = '#cf6c6c';
        if (statusText) statusText.textContent = 'Offline';
        if (nowPlayingEl) nowPlayingEl.style.display = 'none';
        const nameEl = document.getElementById('now-playing-name');
        if (nameEl) nameEl.textContent = 'Unknown';
    }
}
