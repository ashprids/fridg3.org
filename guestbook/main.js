// Guestbook client: fetch and post messages to /guestbook/api.php
let _gb_last_id = 0;
let _gb_polling = false;
let _gb_server_colors = {};
let _gb_colors_snapshot = '';
let _gb_last_event_ts = 0;
let _gb_system_restore_timer = null;
let _gb_system_original_inner = null;
let _gb_bc = null;
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
                    if (_gb_reserved_name) {
                        // when reserved we no longer display the "Type a message" + label;
                        // keep only the name span so the name can be shown without the prefix
                        _gb_system_original_inner = '<div class="system-message"><span id="guestbook-current-name"></span></div>';
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
                        if (data && data.ok && data.messages) {
                    const top = data.messages[0];
                    const topId = top ? (top.id || 0) : 0;
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
                                            if (_gb_reserved_name) {
                                                _gb_system_original_inner = '<div class="system-message"><span id="guestbook-current-name"></span></div>';
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
                    } else if (topId && topId !== _gb_last_id) {
                        renderMessages(data.messages);
                        _gb_last_id = topId;
                        _gb_colors_snapshot = newSnapJson;
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

function updateCurrentNameDisplay() {
    const el = document.getElementById('guestbook-current-name');
    if (!el) return;
    const name = _gb_reserved_name || '';
    el.textContent = name || '';
    // apply color class only when name exists
    for (let i = 1; i <= 8; i++) el.classList.remove('gb-name-' + i);
    if (name) {
        const idx = getColorForName(name);
        el.classList.add('gb-name-' + idx);
    }
}

// Format a message object into HTML. Kept at top-level so it can be used
// when rendering lists and when inserting a single posted message.
function formatMessageHTML(m) {
    const time = '[' + new Date(m.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + ']';
    const name = escapeHtml(m.name || 'anon');
    const raw = m.message || '';
    const msgEsc = escapeHtml(raw);
    const idx = (m && m.color) ? (parseInt(m.color, 10) || getColorForName(m.name || 'anon')) : getColorForName(m.name || 'anon');
        // Action messages: either server may have normalized them to include
        // an `is_action` flag (message without the leading '/me '), or legacy
        // clients may still send raw '/me ' text. Handle both:
        if ((m && m.is_action) || (typeof raw === 'string' && raw.match(/^\/me\s+/i))) {
            const rest = (m && m.is_action) ? escapeHtml(raw) : escapeHtml(raw.replace(/^\/me\s+/i, ''));
            // Action messages intentionally omit the timestamp and render as
            // a plain action line: "* username does something"
            return `<div class="guestbook-message guestbook-me">* ${name} ${rest}</div>\n`;
    }
    return `<div class="guestbook-message"> <span id="gb-time">${time}</span> <span class="gb-name gb-name-${idx}">${name}</span> &gt; ${msgEsc}</div>\n`;
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
        // Action messages: either server provided an is_action flag (message
        // already stored without the leading '/me '), or the message contains
        // a legacy '/me ' prefix. In either case omit the timestamp.
        if ((m && m.is_action) || (typeof raw === 'string' && raw.match(/^\/me\s+/i))) {
            const rest = (m && m.is_action) ? escapeHtml(raw) : escapeHtml(raw.replace(/^\/me\s+/i, ''));
            return `<div class="guestbook-message guestbook-me">* ${name} ${rest}</div>\n`;
        }
        // Non-action messages: render a time only when it's a valid timestamp
        let time = '';
        if (m && typeof m.time !== 'undefined') {
            const d = new Date(m.time);
            if (!isNaN(d.getTime())) time = '[' + d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + ']';
        }
        const timeHtml = time ? `<span id="gb-time">${time}</span> ` : '';
        return `<div class="guestbook-message"> ${timeHtml}<span class="gb-name gb-name-${idx}">${name}</span> &gt; ${msgEsc}</div>\n`;
    }

    let html = system + '\n';
    for (const m of messages) {
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
    // ensure system message shows current name
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

        const myName = getGuestbookName();
        // If the visitor has no username yet, the first input is their desired username.
        if (!myName) {
            const desired = text;
            // basic sanity
            if (desired.length < 3 || desired.length > 15) { displaySystemMessage('Username must be 3-15 characters'); input.value = ''; return; }
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
                        _gb_system_original_inner = '<div class="system-message"><span id="guestbook-current-name"></span></div>';
                    } catch (e) {}
                    // make success message persist so the user notices the reservation
                    displaySystemMessage('You have reserved the username "' + (data.name||desired) + '" until ' + new Date((data.expires||0)*1000).toLocaleString(), 0);
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
        if (text.toLowerCase().startsWith('/color')) {
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
                    displaySystemMessage('Your username reservation has been cleared. Choose a new username.', 5000);
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

        btn.disabled = true;
        // helper to actually POST the message body
        function doPost(body) {
            return fetch('/guestbook/api.php', { cache: 'no-store', credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }).then(r => r.json());
        }

    // enforce message length on client-side as well
    if (text.length > 100) { displaySystemMessage('Message must be 100 characters or less'); input.value = ''; btn.disabled = false; return; }
    const postBody = { name: getGuestbookName(), message: text };
        doPost(postBody).then(data => {
                if (data.ok && data.message) {
                // prepend message to UI
                const container = document.querySelector('.guestbook-messages');
                const time = '[' + new Date(data.message.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + ']';
                const name = escapeHtml(data.message.name || 'anon');
                const msg = escapeHtml(data.message.message || '');
                // create element from message object (handles /me formatting)
                const el = createMessageElement(data.message);
                // insert after system-message
                const system = container.querySelector('.system-message');
                if (system && system.nextSibling) container.insertBefore(el, system.nextSibling);
                else container.insertBefore(el, container.firstChild);
                // remove the system message after the user posts so it disappears for them
                if (system) system.remove();
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
                                    if (second && second.ok && second.message) {
                                    // successful on retry: prepend message
                                    const container = document.querySelector('.guestbook-messages');
                                    const time = '[' + new Date(second.message.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + ']';
                                    const name = escapeHtml(second.message.name || 'anon');
                                    const msg = escapeHtml(second.message.message || '');
                                    const el = createMessageElement(second.message);
                                    const system = container.querySelector('.system-message');
                                    if (system && system.nextSibling) container.insertBefore(el, system.nextSibling);
                                    else container.insertBefore(el, container.firstChild);
                                    if (second.message && second.message.id) _gb_last_id = second.message.id;
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
});