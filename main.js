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
function isSpaEligibleLink(anchor) {
    if (!anchor) return false;
    const href = anchor.getAttribute('href') || '';
    if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    if (anchor.target && anchor.target === '_blank') return false;
    if (!href.startsWith('/')) return false; // same-origin path only
    // Always perform a full navigation for logout so that
    // server redirects (e.g. ?logged_out=1) are reflected in
    // the browser URL immediately.
    if (href.startsWith('/account/logout')) return false;
    if (href.startsWith('/api/')) return false; // API endpoints are not pages
        // Force full reload for /bookmarks so localStorage bookmarks are always up to date
        if (href === '/bookmarks' || href === '/bookmarks/') return false;
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
                initBBCodeEditor();
                setupSpaForms();
                initEmailForm();
                initSettingsPage();
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
            });
    } catch (_) {
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
                initBBCodeEditor();
                initEmailForm();
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
            const a = Math.floor(Math.random() * 13);
            const b = Math.floor(Math.random() * 13);
            const ops = ['+', '-', '*'];
            const op = ops[Math.floor(Math.random() * ops.length)];

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
    fg: '#ffffff',
    border: '#ffffff',
    subtle: '#808080',
    links: '#305aad',
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

        if (!audio || !playBtn || !muteBtn || !titleContainerEl || !titleEl) return;

        const trackLibrary = MINI_PLAYER_LIBRARY;

        // If the mini player has already been wired once, avoid
        // re-attaching all audio/control listeners. Instead, just
        // (re)bind album links so new /music content can control the
        // existing, already-playing audio element.
        if (audio.dataset.initialized === '1') {
            if (window.bindMiniPlayerAlbumLinks) {
                window.bindMiniPlayerAlbumLinks();
            }
            return;
        }

        const PLAYER_STATE_KEY = 'miniPlayerStateV1';

        // Optional initial state from body data attributes
        const body = document.body;
        const initialSrc = body.getAttribute('data-mini-player-src');
        const initialTitle = body.getAttribute('data-mini-player-title');
        const initialArt = body.getAttribute('data-mini-player-art');
        if (initialSrc) audio.src = initialSrc;
        if (initialTitle) {
            setNowPlayingTitle('now playing: ' + initialTitle);
        }
        if (artEl && initialArt) artEl.src = initialArt;

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
            setPlayIcon(true);
            if (artEl && track.albumArt) {
                artEl.src = track.albumArt;
            }
            setNowPlayingTitle(labelName + labelArtist);
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
                        setPlayIcon(true);
                        clearActiveTracks();
                        if (tracklistEl) {
                            tracklistEl.innerHTML = '';
                            tracklistEl.style.display = 'none';
                        }
                        const artistLabelSingle = albumArtist ? ' - ' + albumArtist : '';
                        setNowPlayingTitle(name + artistLabelSingle);
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
                            setPlayIcon(true);
                            clearActiveTracks();
                            row.classList.add('active');
                            if (artEl) {
                                artEl.src = albumArt || '';
                            }
                            const artistLabel = albumArtist ? ' - ' + albumArtist : '';
                            setNowPlayingTitle(name + artistLabel);
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
    } catch (_) { /* no-op */ }
}

window.addEventListener('DOMContentLoaded', initFooterActiveState);

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
            '/projects',
            '/merch',
            '/bookmarks',
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

        const reloadWithScroll = () => {
            try {
                const scrollKey = 'scroll:' + window.location.pathname + window.location.search;
                const y = window.scrollY || window.pageYOffset || 0;
                sessionStorage.setItem(scrollKey, String(y));
            } catch (_) { /* no-op */ }
            window.location.reload();
        };

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
                    .then(() => { reloadWithScroll(); })
                    .catch(() => { reloadWithScroll(); });
                return; // avoid immediate reload below; wait for fetch
            } catch (_) {
                // If fetch setup fails, fall back to immediate reload
                reloadWithScroll();
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
        // For anonymous users we can reload immediately because
        // the effective state is stored locally and not dependent
        // on the server toggle completing.
        reloadWithScroll();
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
    const rawPath = (window.location && window.location.pathname) ? window.location.pathname : '/';
    const path = rawPath.replace(/\/+$/, '') || '/';
    const allowGridLightbox = path === '/gallery' || path.startsWith('/gallery/');

    let targetImg = null;
    if (e.target && e.target.id === 'post-image') {
        targetImg = e.target;
    } else if (allowGridLightbox && e.target) {
        const fromGrid = e.target.closest && e.target.closest('.grid-item');
        if (fromGrid) {
            targetImg = fromGrid.querySelector('.grid-image');
        }
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

// Note: /bookmarks is rendered server-side from the user's bookmark JSON.

// Enhance /bookmarks with localStorage bookmarks for non-logged-in users
function enhanceBookmarksPage() {
    try {
        const rawPath = (window.location && window.location.pathname) ? window.location.pathname : '/';
        const path = rawPath.replace(/\/+$/, '') || '/';
        if (!path.startsWith('/bookmarks')) return;

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