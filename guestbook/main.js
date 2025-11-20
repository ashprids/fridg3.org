// Warning -- this code sucks but it works so who cares ;)
// #FuckJavascript

// Guestbook client: fetch and post messages to /guestbook/api.php
let _gb_last_id = 0;
let _gb_polling = false;
let _gb_server_colors = {};
let _gb_colors_snapshot = '';
let _gb_last_event_ts = 0;
let _gb_system_restore_timer = null;
let _gb_system_original_inner = null;
let _gb_bc = null;
// when true the current client has been banned and UI should be disabled
let _gb_banned = false;
// reserved name (kept in-memory only; do not persist in localStorage)
let _gb_reserved_name = '';
// grace period timestamp (ms) to avoid race where immediate poll clears a
// freshly-created reservation. During this time, an empty remoteReserved will
// not erase the local reservation.
let _gb_local_reserved_grace_until = 0;
// timestamp (ms) of last successful post by this client; used to avoid
// clearing reservations shortly after a successful post when server state
// may briefly appear inconsistent.
let _gb_last_post_time = 0;
// when true we postpone applying server-driven reservation changes (and
// associated feed re-renders) until the user makes a post. This avoids
// confusing UI flips for users who are actively posting while server state
// is propagating.
let _gb_defer_update_until_post = false;
// whether to include the original system-message template on re-renders
let _gb_preserve_system_template = true;

// BroadcastChannel for immediate same-browser/tab notifications (falls back silently if not supported)
if (typeof window.BroadcastChannel === 'function') {
    try {
        _gb_bc = new BroadcastChannel('guestbook-events');
        _gb_bc.onmessage = function(e) {
            try {
                const d = e.data;
                if (d && d.type === 'system' && d.msg) displaySystemMessage(d.msg);
            } catch (err) { /* ignore */ }
        };
    } catch (err) {
        _gb_bc = null;
    }
}

// audio alert for new messages (lazy-initialized)
let _gb_alert_audio = null;
function _gb_play_alert() {
    try {
        if (!_gb_alert_audio) {
            _gb_alert_audio = new Audio('/guestbook/alert.ogg');
            // try to load early
            _gb_alert_audio.preload = 'auto';
        }
        // reset and play; ignore any play() promise rejection (autoplay policies)
        _gb_alert_audio.currentTime = 0;
        const p = _gb_alert_audio.play();
        if (p && typeof p.then === 'function') p.catch(() => {});
    } catch (e) { /* ignore */ }
}

function displaySystemMessage(msg, duration = 10000) {
    const container = document.querySelector('.guestbook-messages');
    if (!container) return;
    const el = container.querySelector('.system-message');
    if (!el) return;
    // Create or reuse a transient element that displays the temporary message
    let tmp = el.querySelector('.gb-temp-system');
    if (!tmp) {
        tmp = document.createElement('div');
        tmp.className = 'gb-temp-system';
        tmp.style.marginBottom = '0.5em';
        tmp.style.fontWeight = '600';
        // insert at the top of the system message container so the existing
        // "Your current name: <span id=guestbook-current-name>" remains visible
        el.insertBefore(tmp, el.firstChild);
    }
    tmp.textContent = msg;
    tmp.style.display = '';
    // clear any existing timer
    if (_gb_system_restore_timer) { clearTimeout(_gb_system_restore_timer); _gb_system_restore_timer = null; }
    // If duration is falsy (0 or null), keep message persistent (do not auto-hide)
    if (duration && duration > 0) {
        _gb_system_restore_timer = setTimeout(() => {
            try { tmp.style.display = 'none'; } catch (e) {}
            _gb_system_restore_timer = null;
        }, duration);
    }
}
async function loadGuestbook(limit = 100) {
    try {
    const res = await fetch('/guestbook/api.php?limit=' + encodeURIComponent(limit), { cache: 'no-store', credentials: 'include' });
        const data = await res.json();
        if (data && data.banned) {
            // banned clients should not see messages
            displaySystemMessage("You've been banned from using the guestbook. Contact me@fridg3.org if you believe this was in error.", 0);
            _gb_banned = true;
            try { document.getElementById('guestbook-type').disabled = true; } catch (e) {}
            try { document.getElementById('guestbook-send').disabled = true; } catch (e) {}
            return;
        }
        if (!data.ok) return;
    // set reserved name (server-side) into in-memory variable (no grace)
    setGuestbookName(data.reserved_name || '', false);
    updateCurrentNameDisplay();
        // ensure we capture a stable system-message template (without transient
        // gb-temp-system children) so subsequent renderMessages calls don't
        // inadvertently re-insert the 'choose username' text.
        try {
            const container = document.querySelector('.guestbook-messages');
            if (container) {
                const sysEl = container.querySelector('.system-message');
                if (sysEl) {
                    const clone = sysEl.cloneNode(true);
                    const tmp = clone.querySelector('.gb-temp-system'); if (tmp) tmp.remove();
                    _gb_system_original_inner = clone.outerHTML;
                } else {
                    // fallback: synthesize appropriate template based on reserved state
                    // we intentionally do NOT inject a dedicated `#guestbook-current-name` span
                    // to avoid duplicate placement of the current-name UI.
                    if (_gb_reserved_name) {
                        _gb_system_original_inner = '<div class="system-message"></div>';
                    } else {
                        _gb_system_original_inner = '<div class="system-message">Choose a username to reserve for 30 days.</div>';
                    }
                }
            }
            const inputEl = document.getElementById('guestbook-type');
            if (inputEl) {
                if (_gb_reserved_name) inputEl.placeholder = 'Type a message...';
                else inputEl.placeholder = 'Type a username to reserve for 30 days';
            }
        } catch (e) {}
        renderMessages(data.messages);
        // compute snapshot of id->color for quick change detection
        const snap = {};
        if (data.messages && data.messages.length) {
            for (const m of data.messages) snap[m.id] = m.color || '';
        }
        _gb_colors_snapshot = JSON.stringify(snap);
        // events removed: server no longer returns system events
        
        if (data.messages && data.messages.length) _gb_last_id = data.messages[0].id || 0;
        return data;
    } catch (e) {
        console.error('Failed to load guestbook', e);
    }
}

// Poll for new messages every `intervalMs` milliseconds.
// This keeps clients in sync without requiring WebSockets.
async function pollGuestbook(intervalMs = 5000) {
    if (_gb_polling) return;
    _gb_polling = true;
    try {
        while (true) {
            try {
                        const res = await fetch('/guestbook/api.php?limit=20', { cache: 'no-store', credentials: 'include' });
                        const data = await res.json();
                        if (data && data.banned) {
                            displaySystemMessage("You've been banned from using the guestbook. Contact me@fridg3.org if you believe this was in error.", 0);
                            _gb_banned = true;
                            try { document.getElementById('guestbook-type').disabled = true; } catch (e) {}
                            try { document.getElementById('guestbook-send').disabled = true; } catch (e) {}
                            return; // stop polling
                        }
                        if (data && data.ok && data.messages) {
                    const top = data.messages[0];
                    const topId = top ? (top.id || 0) : 0;
                    // determine whether these messages include new arrivals
                    const shouldPlayAlert = (_gb_last_id && topId && topId !== _gb_last_id);
                    // compute incoming snapshot and compare with cached snapshot
                    const snap = {};
                    for (const m of data.messages) snap[m.id] = m.color || '';
                    const newSnapJson = JSON.stringify(snap);

                    // events removed: server no longer returns system events

                        // update reserved name state if it changed on the server
                    const remoteReserved = data.reserved_name || '';
                            if (remoteReserved !== _gb_reserved_name) {
                            // If the server reports no reservation but we recently set one
                            // or posted, ignore the empty remote value for a short grace
                            // window to avoid races where the POST write hasn't been
                            // observed yet or the server state is briefly inconsistent.
                            const now = Date.now();
                            const recentPostGrace = (_gb_last_post_time || 0) + 5000; // 5s after a post
                            const effectiveGrace = Math.max(_gb_local_reserved_grace_until || 0, recentPostGrace || 0);
                            if (remoteReserved === '' && now < effectiveGrace) {
                                // ignore this transient empty value
                            } else {
                                // If the server indicates the reservation disappeared,
                                // postpone applying that change until the user actively
                                // posts. This prevents UI flip-flops while the user is
                                // interacting. Mark defer and skip the update.
                                if (remoteReserved === '') {
                                    _gb_defer_update_until_post = true;
                                    // do not update _gb_reserved_name or re-render yet
                                    // (the feed will be refreshed after the next post)
                                    continue;
                                }
                                // reservation lost or gained; update display
                                if (remoteReserved === '') {
                                    // reservation lost (non-deferred path)
                                    displaySystemMessage('Your username reservation appears to have expired or been taken. Please choose a username again.', 0);
                                }
                                // update reservation state from server (no grace)
                                setGuestbookName(remoteReserved || '', false);
                                // refresh the stable system-message template to match new state
                                try {
                                    const container = document.querySelector('.guestbook-messages');
                                    if (container) {
                                        const sysEl = container.querySelector('.system-message');
                                        if (sysEl) {
                                            const clone = sysEl.cloneNode(true);
                                            const tmp = clone.querySelector('.gb-temp-system'); if (tmp) tmp.remove();
                                            _gb_system_original_inner = clone.outerHTML;
                                        } else {
                                            // do not include a #guestbook-current-name span to avoid duplicate
                                            // placement; keep system-message empty when reserved.
                                            if (_gb_reserved_name) {
                                                _gb_system_original_inner = '<div class="system-message"></div>';
                                            } else {
                                                _gb_system_original_inner = '<div class="system-message">Choose a username to reserve for 30 days.</div>';
                                            }
                                        }
                                    }
                                } catch (e) {}
                            }
                        }

                    if (newSnapJson !== _gb_colors_snapshot) {
                        // colors changed for some messages (or new messages) -> re-render
                        renderMessages(data.messages);
                        _gb_colors_snapshot = newSnapJson;
                        if (topId) _gb_last_id = topId;
                        // Play alert only if these include new messages (avoid playing on pure color updates)
                        if (shouldPlayAlert) _gb_play_alert();
                    } else if (topId && topId !== _gb_last_id) {
                        renderMessages(data.messages);
                        _gb_last_id = topId;
                        _gb_colors_snapshot = newSnapJson;
                        _gb_play_alert();
                    }
                }
            } catch (err) {
                console.debug('guestbook poll error', err);
            }
            await new Promise(r => setTimeout(r, intervalMs));
        }
    } finally {
        _gb_polling = false;
    }
}

// event-only poller removed (server no longer provides system events)

function escapeHtml(s) {
    return s.replace(/[&<>\"]/g, function (c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
}

// --- color mapping per-name stored in localStorage ---
function _loadColorMap() {
    try {
        const raw = localStorage.getItem('guestbook_name_colors');
        if (!raw) return {};
        const obj = JSON.parse(raw);
        return (obj && typeof obj === 'object') ? obj : {};
    } catch (e) { return {}; }
}

function _saveColorMap(map) {
    try {
        localStorage.setItem('guestbook_name_colors', JSON.stringify(map));
    } catch (e) { /* ignore */ }
}

function _hashNameToColorIndex(name) {
    // deterministic fallback: sum char codes mod 8 + 1 => 1..8
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) | 0;
    return (Math.abs(h) % 8) + 1;
}

function getColorForName(name) {
    name = (name || 'anon').toString();
    const map = _loadColorMap();
    if (map[name]) return parseInt(map[name], 10) || _hashNameToColorIndex(name);
    const idx = _hashNameToColorIndex(name);
    map[name] = idx;
    _saveColorMap(map);
    return idx;
}

function setColorForName(name, idx) {
    name = (name || 'anon').toString();
    idx = parseInt(idx, 10) || 1;
    if (idx < 1) idx = 1; if (idx > 8) idx = 8;
    const map = _loadColorMap();
    map[name] = idx;
    _saveColorMap(map);
}

// --- ignore list (client-side only, expires after 15 days) ---
// Stored shape in localStorage: JSON object mapping lowercased name -> expiry_ms
function _loadIgnoreMap() {
    try {
        const raw = localStorage.getItem('guestbook_ignored_users');
        if (!raw) return {};
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return {};
        // prune expired entries
        const now = Date.now();
        let changed = false;
        for (const k of Object.keys(obj)) {
            const v = parseInt(obj[k], 10) || 0;
            if (v <= now) { delete obj[k]; changed = true; }
        }
        if (changed) {
            try { localStorage.setItem('guestbook_ignored_users', JSON.stringify(obj)); } catch (e) {}
        }
        return obj;
    } catch (e) { return {}; }
}

function _saveIgnoreMap(map) {
    try { localStorage.setItem('guestbook_ignored_users', JSON.stringify(map)); } catch (e) {}
}

function isIgnored(name) {
    if (!name) return false;
    const low = name.toString().toLowerCase();
    const map = _loadIgnoreMap();
    if (!map[low]) return false;
    return (parseInt(map[low], 10) || 0) > Date.now();
}

function addIgnore(name) {
    if (!name) return false;
    const low = name.toString().toLowerCase();
    const map = _loadIgnoreMap();
    if (map[low] && (parseInt(map[low], 10) || 0) > Date.now()) return false;
    const expires = Date.now() + 15 * 24 * 3600 * 1000; // 15 days
    map[low] = expires;
    _saveIgnoreMap(map);
    return true;
}

function removeIgnore(name) {
    if (!name) return false;
    const low = name.toString().toLowerCase();
    const map = _loadIgnoreMap();
    if (!map[low]) return false;
    delete map[low];
    _saveIgnoreMap(map);
    return true;
}

function updateCurrentNameDisplay() {
    // intentionally no-op: we no longer show the current name inside the
    // message pane. Reserved-name UI is handled elsewhere (system messages)
    // or omitted entirely to avoid duplicate placement.
    return;
}

// Format a message object into HTML. Kept at top-level so it can be used
// when rendering lists and when inserting a single posted message.
function formatMessageHTML(m) {
    const time = (m && typeof m.time !== 'undefined' && !isNaN(new Date(m.time).getTime())) ? '[' + new Date(m.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + ']' : '';
    const name = escapeHtml(m.name || 'anon');
    const raw = m.message || '';
    const msgEsc = escapeHtml(raw);
    const idx = (m && m.color) ? (parseInt(m.color, 10) || getColorForName(m.name || 'anon')) : getColorForName(m.name || 'anon');
    const btnHtml = '';
        // Announcements (server-side flag) -> render as: "username message"
        if (m && m.is_announce) {
            const rest = escapeHtml(raw);
            const timeHtml = (m && m.is_cmd) ? '' : (time ? `<span id="gb-time">${time}</span> ` : '');
    const nameHtml = (m && m.admin_post) ? `<span class="gb-name-admin">${name}</span>` : `<span class="gb-name gb-name-${idx}">${name}</span>`;
        const cmdClass = (m && m.is_cmd) ? ' guestbook-cmd' : '';
        return `<div class="guestbook-message${cmdClass}"> ${btnHtml} ${timeHtml}${nameHtml} ${rest}</div>\n`;
        }
        // Action messages: either server may have normalized them to include
        // an `is_action` flag (message without the leading '/me '), or legacy
        // clients may still send raw '/me ' text. Handle both:
        if ((m && m.is_action) || (typeof raw === 'string' && raw.match(/^\/me\s+/i))) {
            const rest = (m && m.is_action) ? escapeHtml(raw) : escapeHtml(raw.replace(/^\/me\s+/i, ''));
            const nameHtml = (m && m.admin_post) ? `<span class="gb-name-admin">${name}</span>` : `<span class="gb-name gb-name-${idx}">${name}</span>`;
            // Action messages intentionally omit the timestamp and render as
            // a plain action line: "* username does something"
            const cmdClass = (m && m.is_cmd) ? ' guestbook-cmd' : '';
            return `<div class="guestbook-message guestbook-me${cmdClass}"> ${btnHtml}* ${nameHtml} ${rest}</div>\n`;
        }
    const timeHtml = (m && m.is_cmd) ? '' : (time ? `<span id="gb-time">${time}</span> ` : '');
    const nameHtml = (m && m.admin_post) ? `<span class="gb-name-admin">${name}</span>` : `<span class="gb-name gb-name-${idx}">${name}</span>`;
    const cmdClass = (m && m.is_cmd) ? ' guestbook-cmd' : '';
    return `<div class="guestbook-message${cmdClass}"> ${btnHtml} ${timeHtml}${nameHtml} &gt; ${msgEsc}</div>\n`;
}

function createMessageElement(m) {
    const tmp = document.createElement('div');
    tmp.innerHTML = formatMessageHTML(m);
    return tmp.firstElementChild;
}

function renderMessages(messages) {
    const container = document.querySelector('.guestbook-messages');
    if (!container) return;
    // preserve system-message and start-message markers
    // Use the original system message template when available so temporary
    // system messages (e.g. from /nick) are not persisted across re-renders.
    const system = (_gb_system_original_inner !== null)
        ? _gb_system_original_inner
        : (container.querySelector('.system-message')?.outerHTML || '');
    const start = container.querySelector('.start-message')?.outerHTML || '';

    // helper to format a single message as HTML (handles /me actions)
    function formatMessageHTML(m) {
        const name = escapeHtml(m.name || 'anon');
        const raw = m.message || '';
        const msgEsc = escapeHtml(raw);
        const idx = (m && m.color) ? (parseInt(m.color, 10) || getColorForName(m.name || 'anon')) : getColorForName(m.name || 'anon');
        const btnHtml = '';
        // compute time early so branches can reference it
        let time = '';
        if (m && typeof m.time !== 'undefined') {
            const d = new Date(m.time);
            if (!isNaN(d.getTime())) time = '[' + d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + ']';
        }
        // Announcements: render as "username message" (no '*')
        if (m && m.is_announce) {
            const rest = escapeHtml(raw);
            const nameHtml = (m && m.admin_post) ? `<span class="gb-name-admin">${name}</span>` : `<span class="gb-name gb-name-${idx}">${name}</span>`;
            const timeHtml = (m && m.is_cmd) ? '' : (time ? `<span id="gb-time">${time}</span> ` : '');
            const cmdClass = (m && m.is_cmd) ? ' guestbook-cmd' : '';
            return `<div class="guestbook-message${cmdClass}"> ${btnHtml} ${timeHtml}${nameHtml} ${rest}</div>\n`;
        }
        // Action messages: either server provided an is_action flag (message
        // already stored without the leading '/me '), or the message contains
        // a legacy '/me ' prefix. In either case omit the timestamp.
        if ((m && m.is_action) || (typeof raw === 'string' && raw.match(/^\/me\s+/i))) {
            const rest = (m && m.is_action) ? escapeHtml(raw) : escapeHtml(raw.replace(/^\/me\s+/i, ''));
            const nameHtml = (m && m.admin_post) ? `<span class="gb-name-admin">${name}</span>` : `<span class="gb-name gb-name-${idx}">${name}</span>`;
            const cmdClass = (m && m.is_cmd) ? ' guestbook-cmd' : '';
            return `<div class="guestbook-message guestbook-me${cmdClass}"> ${btnHtml}* ${nameHtml} ${rest}</div>\n`;
        }
        // Non-action messages: time has already been computed above
        const timeHtml = (m && m.is_cmd) ? '' : (time ? `<span id="gb-time">${time}</span> ` : '');
        const nameHtml = (m && m.admin_post) ? `<span class="gb-name-admin">${name}</span>` : `<span class="gb-name gb-name-${idx}">${name}</span>`;
        const cmdClass = (m && m.is_cmd) ? ' guestbook-cmd' : '';
        return `<div class="guestbook-message${cmdClass}"> ${btnHtml} ${timeHtml}${nameHtml} &gt; ${msgEsc}</div>\n`;
    }

    let html = system + '\n';
    for (const m of messages) {
        // skip messages from ignored users (client-side only)
        if (m && m.name && isIgnored(m.name)) continue;
        html += formatMessageHTML(m);
    }
    html += '<br>' + start;
    container.innerHTML = html;
}
// previously names were stored in localStorage; we now keep the reserved
// name server-side and only hold it in memory for this page load.
function getGuestbookName() {
    return _gb_reserved_name || '';
}

function setGuestbookName(n, withGrace = true) {
    _gb_reserved_name = (n || '').toString().trim().substring(0, 15);
    updateCurrentNameDisplay();
    // optionally set a small grace window so the poller doesn't race and clear this
    if (withGrace) _gb_local_reserved_grace_until = Date.now() + 3000; // 3s
}

document.addEventListener('DOMContentLoaded', function() {
    // initialize display with stored name (or empty)
    // initial load will populate the reserved name via loadGuestbook
    // If no name stored, prompt the user to choose a username (first submit will reserve it)
    // (input element is initialized below)
    loadGuestbook(100);
    // start background poller to keep everyone in sync
    pollGuestbook(5000).catch(() => {});
    // No SSE/event poller: keep periodic polling for messages only

    const input = document.getElementById('guestbook-type');
    const btn = document.getElementById('guestbook-send');
    // placeholder and system-message will be set after loadGuestbook returns
    function send() {
        const text = input.value.trim();
    if (!text) return;

    if (_gb_banned) { displaySystemMessage("You've been banned from using the guestbook. Contact me@fridg3.org if you believe this was in error.", 0); input.value = ''; return; }
        const myName = getGuestbookName();
    // If the visitor has no username yet, the first input is their desired username.
        if (!myName) {
            const desired = text;
            // basic sanity
            if (desired.length < 3 || desired.length > 15) { displaySystemMessage('Username must be 3-15 characters'); input.value = ''; return; }
            // allowed characters: letters and numbers only, allow at most one underscore
            // enforce same rule client-side so user gets immediate feedback
            const nameOk = /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)?$/u.test(desired);
            if (!nameOk) { displaySystemMessage('Username may only contain letters and numbers, with at most one underscore', 4000); input.value = ''; return; }
            // follow normal reservation flow (server will set the reservation)
            // request server to reserve the name for 30 days
            fetch('/guestbook/api.php', { cache: 'no-store', credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'set_name', new_name: desired })
            }).then(r => r.json()).then(data => {
                if (data && data.ok) {
                    // store only in-memory; server is authoritative
                    setGuestbookName(data.name || desired);
                    // update the stable system template now that we have a reserved name
                    try {
                        _gb_system_original_inner = '<div class="system-message"></div>';
                    } catch (e) {}
                    // make success message persist so the user notices the reservation
                    displaySystemMessage('You have reserved the username "' + (data.name||desired) + '" until ' + new Date((data.expires||0)*1000).toLocaleString() + '.\nPlease read the rules before posting.', 0);
                    // now ready to post messages
                    input.placeholder = 'Type a message...';
                } else if (data && data.error === 'name_taken') {
                    // make "taken" error persistent so the user can act on it
                    displaySystemMessage('That username is already reserved until ' + (data.expires ? new Date(data.expires*1000).toLocaleString() : 'later'), 0 );
                } else {
                    displaySystemMessage('Failed to reserve username. Does it contain inappropriate language?');
                }
            }).catch(err => {
                console.warn('set_name failed', err);
                displaySystemMessage('Failed to reserve username (network error)');
            }).finally(() => { input.value = ''; });
            return;
        }

        // /nick command removed: nickname changes are no longer supported.

    // handle /color command locally: /color <name> or /color N where N is 1-8
        if (text.toLowerCase().startsWith('/color') || text.toLowerCase().startsWith('/colour')) {
            const parts = text.split(/\s+/);
            const arg = parts[1] ? parts[1].toLowerCase() : '';
            const nameMap = { red:1, orange:2, yellow:3, green:4, teal:5, blue:6, purple:7, pink:8 };
            let n = NaN;
            if (/^\d+$/.test(arg)) n = parseInt(arg, 10);
            else if (arg && nameMap[arg] !== undefined) n = nameMap[arg];
            if (!isNaN(n) && n >= 1 && n <= 8) {
                const myName = getGuestbookName();
                if (!myName) { displaySystemMessage('Set a username first before changing color', 0); input.value = ''; return; }
                // update local map immediately
                setColorForName(myName, n);
                updateCurrentNameDisplay();
                // also request server-side global change (send name or index)
                fetch('/guestbook/api.php', { cache: 'no-store', credentials: 'include',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'set_color', name: myName, color: arg || n })
                }).then(r => r.json()).then(resp => {
                    if (resp && resp.ok) {
                        displaySystemMessage('Your chat color has been set.');
                    } else {
                        console.warn('Failed to set global color', resp);
                        alert('Local color set, but failed to set global color');
                    }
                }).catch(err => {
                    console.warn('Failed to set global color', err);
                    alert('Local color set, but failed to set global color');
                });
            } 
            input.value = '';
            return;
        }

        // handle /unreserve: clear our username reservation so the user must pick a new one
        if (text.toLowerCase().trim() === '/unreserve') {
            const myName = getGuestbookName();
            if (!myName) { displaySystemMessage('You have no username reserved', 3000); input.value = ''; return; }
            fetch('/guestbook/api.php', { cache: 'no-store', credentials: 'include',
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unreserve' })
            }).then(r => r.json()).then(resp => {
                if (resp && resp.ok) {
                    displaySystemMessage('Your username reservation has expired. Choose a username.', 5000);
                    setGuestbookName('');
                    input.placeholder = 'Type a username to reserve for 30 days';
                } else if (resp && resp.error === 'no_reservation') {
                    displaySystemMessage('You have no active reservation to clear', 3000);
                } else {
                    displaySystemMessage('Failed to clear reservation', 3000);
                }
            }).catch(err => {
                console.warn('unreserve failed', err);
                displaySystemMessage('Failed to clear reservation (network error)', 3000);
            }).finally(() => { input.value = ''; });
            return;
        }

    // handle /report <user> <reason>
        if (text.toLowerCase().startsWith('/report')) {
            const parts = text.split(/\s+/);
            if (parts.length < 3) { displaySystemMessage('Usage: /report <username> <reason>'); input.value = ''; return; }
            const target = parts[1];
            const idx = text.indexOf(target);
            const reason = text.substring(idx + target.length).trim();
            if (!reason) { displaySystemMessage('Please provide a reason for the report'); input.value = ''; return; }
            if (reason.length > 1000) { alert('Reason must be 1000 characters or less'); input.value = ''; return; }
            const myName = getGuestbookName();
            if (!myName) { displaySystemMessage('You must reserve a username before filing reports', 4000); input.value = ''; return; }
            if (myName.toLowerCase() === target.toLowerCase()) { displaySystemMessage('You cannot report yourself', 4000); input.value = ''; return; }
            // send report
            fetch('/guestbook/api.php', { cache: 'no-store', credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'report', target: target, reason: reason }) })
            .then(r => r.json()).then(resp => {
                if (resp && resp.ok) {
                    displaySystemMessage('Report submitted - thank you', 5000);
                } else if (resp && resp.error) {
                    displaySystemMessage('Failed to submit report: ' + resp.error, 5000);
                } else {
                    displaySystemMessage('Failed to submit report', 5000);
                }
            }).catch(err => {
                console.warn('report failed', err);
                displaySystemMessage('Failed to submit report (network error)', 5000);
            }).finally(() => { input.value = ''; });
            return;
        }

        // handle /help: navigate to the guestbook help page
        if (text.toLowerCase().trim() === '/help' || text.toLowerCase().trim() === '/?') {
            // redirect to the guestbook index/help page
            try { window.location.href = '/guestbook/'; } catch (e) { window.location = '/guestbook/'; }
            input.value = '';
            return;
        }

        // handle /roll <N> - roll a random number between 1 and N and announce
        if (text.toLowerCase().startsWith('/roll')) {
            const parts = text.split(/\s+/);
            const n = parts[1] ? parseInt(parts[1], 10) : NaN;
            if (!n || n <= 0) { displaySystemMessage('Usage: /roll <positive number>'); input.value = ''; return; }
            if (n > 1000000) { displaySystemMessage('Max roll is 1,000,000'); input.value = ''; return; }
            const myName = getGuestbookName();
            if (!myName) { displaySystemMessage('Reserve a username first', 3000); input.value = ''; return; }
            const val = Math.floor(Math.random() * n) + 1;
                doPost({ name: myName, message: 'rolled ' + val + '!', announce: true, cmd: true }).then(res => {
                    if (res && res.banned) {
                        displaySystemMessage("You've been banned from using the guestbook. Contact me@fridg3.org if you believe this was in error.", 0);
                        _gb_banned = true;
                        try { document.getElementById('guestbook-type').disabled = true; } catch (e) {}
                        try { document.getElementById('guestbook-send').disabled = true; } catch (e) {}
                    }
                }).catch(() => {});
            input.value = '';
            return;
        }

        // handle /coin - flip a coin and announce
        if (text.toLowerCase().trim() === '/coin') {
            const myName = getGuestbookName();
            if (!myName) { displaySystemMessage('Reserve a username first', 3000); input.value = ''; return; }
            const flip = (Math.random() < 0.5) ? 'heads' : 'tails';
                doPost({ name: myName, message: 'flipped a coin and got ' + flip + '!', announce: true, cmd: true }).then(res => {
                    if (res && res.banned) {
                        displaySystemMessage("You've been banned from using the guestbook. Contact me@fridg3.org if you believe this was in error.", 0);
                        _gb_banned = true;
                        try { document.getElementById('guestbook-type').disabled = true; } catch (e) {}
                        try { document.getElementById('guestbook-send').disabled = true; } catch (e) {}
                    }
                }).catch(() => {});
            input.value = '';
            return;
        }

        // handle /time - show current UTC time to the user only
        if (text.toLowerCase().trim() === '/time') {
            const nowUtc = new Date().toUTCString();
            displaySystemMessage('Current time: ' + nowUtc, 8000);
            input.value = '';
            return;
        }

        // handle /ping - ping server and show round-trip in ms
        if (text.toLowerCase().trim() === '/ping') {
            const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            // lightweight GET; server will respond quickly. Measure with Date.now fallback.
            fetch('/guestbook/ping.php?ts=' + Date.now(), { cache: 'no-store', credentials: 'include' })
            .then(response => {
                try {
                    const end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    const ms = Math.round(end - start);
                    if (response && response.ok === false) {
                        displaySystemMessage('Pong! ' + ms + 'ms (server error ' + (response.status || '') + ')', 4000);
                    } else {
                        displaySystemMessage('Pong! ' + ms + 'ms', 4000);
                    }
                } catch (err) {
                    const end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    const ms = Math.round(end - start);
                    displaySystemMessage('Pong! ' + ms + 'ms (error)', 4000);
                    console.warn('ping handler error', err);
                }
            }).catch(err => {
                const end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                const ms = Math.round(end - start);
                displaySystemMessage('Pong! ' + ms + 'ms (network error)', 4000);
                console.warn('ping network error', err);
            }).finally(() => { input.value = ''; });
            return;
        }

        // If the message starts with '/' and wasn't handled by any known
        // command above, show an 'Unknown command' system message. Allow
        // the special '/me ' action to pass through as a normal message.
        if (myName && text.startsWith('/')) {
            const lower = text.toLowerCase();
            const isMe = /^\/me\s+/i.test(text);
            // list of known command prefixes or exact commands
            const knownCmds = ['/color','/colour','/unreserve','/report','/ignore','/unignore','/me','/block','/unblock','/roll','/coin','/time','/ping','/help','/?'];
            const isKnown = knownCmds.some(k => lower.startsWith(k));
            if (!isMe && !isKnown) {
                displaySystemMessage('Unknown command', 3000);
                input.value = '';
                return;
            }
        }

        // handle /ignore <username> and /unignore <username>
        if (text.toLowerCase().startsWith('/ignore') || text.toLowerCase().startsWith('/unignore') || text.toLowerCase().startsWith('/block') || text.toLowerCase().startsWith('/unblock')) {
            const parts = text.split(/\s+/);
            if (parts.length < 2) { displaySystemMessage('Usage: /ignore <username> or /unignore <username>'); input.value = ''; return; }
            const cmd = parts[0].toLowerCase();
            const target = parts.slice(1).join(' ').trim();
            if (!target) { displaySystemMessage('Specify a username'); input.value = ''; return; }
            if (cmd === '/ignore' || cmd === '/block') {
                if (addIgnore(target)) {
                    displaySystemMessage('Ignoring ' + target + ' (messages hidden locally)');
                    // refresh feed to hide existing messages
                    loadGuestbook(100).catch(() => {});
                } else {
                    displaySystemMessage('Already ignoring ' + target);
                }
            } else {
                if (removeIgnore(target)) {
                    displaySystemMessage('Stopped ignoring ' + target);
                    loadGuestbook(100).catch(() => {});
                } else {
                    displaySystemMessage('You were not ignoring ' + target);
                }
            }
            input.value = '';
            return;
        }

        btn.disabled = true;
        // helper to actually POST the message body
        function doPost(body) {
            return fetch('/guestbook/api.php', { cache: 'no-store', credentials: 'include',
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            }).then(r => r.json());
        }

    // enforce message length on client-side as well
    if (text.length > 100) { displaySystemMessage('Message must be 100 characters or less'); input.value = ''; btn.disabled = false; return; }
    const postBody = { name: getGuestbookName(), message: text };
    doPost(postBody).then(data => {
        if (data && data.banned) {
            displaySystemMessage("You've been banned from using the guestbook. Contact me@fridg3.org if you believe this was in error.", 0);
            _gb_banned = true;
            try { document.getElementById('guestbook-type').disabled = true; } catch (e) {}
            try { document.getElementById('guestbook-send').disabled = true; } catch (e) {}
            btn.disabled = false;
            input.value = '';
            return;
        }
        if (data.ok && data.message) {
                // prepend message to UI
                const container = document.querySelector('.guestbook-messages');
                const time = '[' + new Date(data.message.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + ']';
                const name = escapeHtml(data.message.name || 'anon');
                const msg = escapeHtml(data.message.message || '');
                // create element from message object (handles /me formatting)
                // if the posted message is from someone the user ignores, do not insert it
                if (isIgnored(data.message.name)) {
                    // record last id and skip DOM insertion
                    if (data.message && data.message.id) _gb_last_id = data.message.id;
                } else {
                    const el = createMessageElement(data.message);
                    // insert after system-message
                    const system = container.querySelector('.system-message');
                    if (system && system.nextSibling) container.insertBefore(el, system.nextSibling);
                    else container.insertBefore(el, container.firstChild);
                    // remove the system message after the user posts so it disappears for them
                    if (system) system.remove();
                }
                // update last seen id so the poller doesn't immediately re-fetch the same message
                if (data.message && data.message.id) _gb_last_id = data.message.id;
                // record the successful post time so the poller won't clear
                // our reservation immediately due to a transient read race.
                _gb_last_post_time = Date.now();
                input.value = '';
                // if we deferred applying server-driven reservation changes,
                // apply them now by refreshing the feed
                if (_gb_defer_update_until_post) {
                    _gb_defer_update_until_post = false;
                    loadGuestbook(100).catch(() => {});
                }
            } else {
                if (data && data.error === 'name_not_reserved') {
                    // our username reservation is gone — attempt a quick refresh and retry
                    const attemptedName = postBody.name || '';
                    loadGuestbook(20).then(ref => {
                        const remote = (ref && ref.reserved_name) ? ref.reserved_name : '';
                        if (remote && attemptedName && remote.toLowerCase() === attemptedName.toLowerCase()) {
                            // server now reports the reservation; retry once
                displaySystemMessage('Reservation confirmed on server — retrying post...', 3000);
                doPost(postBody).then(second => {
                    if (second && second.banned) {
                    displaySystemMessage("You've been banned from using the guestbook. Contact me@fridg3.org if you believe this was in error.", 0);
                    _gb_banned = true;
                    try { document.getElementById('guestbook-type').disabled = true; } catch (e) {}
                    try { document.getElementById('guestbook-send').disabled = true; } catch (e) {}
                    return;
                    }
                    if (second && second.ok && second.message) {
                                    // successful on retry: prepend message
                                    const container = document.querySelector('.guestbook-messages');
                                    const time = '[' + new Date(second.message.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + ']';
                                    const name = escapeHtml(second.message.name || 'anon');
                                    const msg = escapeHtml(second.message.message || '');
                                    // if we ignore this user, don't insert their message locally
                                    if (isIgnored(second.message.name)) {
                                        if (second.message && second.message.id) _gb_last_id = second.message.id;
                                    } else {
                                        const el = createMessageElement(second.message);
                                        const system = container.querySelector('.system-message');
                                        if (system && system.nextSibling) container.insertBefore(el, system.nextSibling);
                                        else container.insertBefore(el, container.firstChild);
                                        if (second.message && second.message.id) _gb_last_id = second.message.id;
                                    }
                                    // also note this successful post time
                                    _gb_last_post_time = Date.now();
                                    input.value = '';
                                    if (_gb_defer_update_until_post) {
                                        _gb_defer_update_until_post = false;
                                        loadGuestbook(100).catch(() => {});
                                    }
                                    return;
                                }
                                // fallback to showing reservation-lost message
                                displaySystemMessage('Your username is no longer reserved. Please choose a username again.', 0);
                                setGuestbookName('');
                                input.placeholder = 'Type a username to reserve for 30 days';
                            }).catch(() => {
                                displaySystemMessage('Your username is no longer reserved. Please choose a username again.', 0);
                                setGuestbookName('');
                                input.placeholder = 'Type a username to reserve for 30 days';
                            });
                        } else {
                            displaySystemMessage('Your username is no longer reserved. Please choose a username again.', 0);
                            setGuestbookName('');
                            input.placeholder = 'Type a username to reserve for 30 days';
                        }
                    }).catch(() => {
                        displaySystemMessage('Your username is no longer reserved. Please choose a username again.', 0);
                        setGuestbookName('');
                        input.placeholder = 'Type a username to reserve for 30 days';
                    });
                } else {
                    if (data.error === 'message_forbidden') {
                        displaySystemMessage('Your message contains inappropriate language.', 0);
                    }
                    else {
                    displaySystemMessage('Failed to post: ' + (data.error || 'unknown'));
                    }
                }
            }
        }).catch(err => {
            console.error(err);
            alert('Failed to post message');
        }).finally(() => { btn.disabled = false; });
    }
    btn.addEventListener('click', send);
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') send(); });

    // Deletion is not supported in the public client.
});