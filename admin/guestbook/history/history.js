// Minimal client-side history viewer that mirrors guestbook formatting
// without loading the full guestbook client (avoids polling and side-effects).

function escapeHtml(s) {
    return (s||'').toString().replace(/[&<>\"]/g, function (c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
}

function _loadColorMap() {
    try {
        const raw = localStorage.getItem('guestbook_name_colors');
        if (!raw) return {};
        const obj = JSON.parse(raw);
        return (obj && typeof obj === 'object') ? obj : {};
    } catch (e) { return {}; }
}

function _hashNameToColorIndex(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) | 0;
    return (Math.abs(h) % 8) + 1;
}

function getColorForName(name) {
    name = (name || 'anon').toString();
    const map = _loadColorMap();
    if (map[name]) return parseInt(map[name], 10) || _hashNameToColorIndex(name);
    const idx = _hashNameToColorIndex(name);
    // do not persist new mapping in history view
    return idx;
}

function formatMessageHTML(m) {
    const time = (m && typeof m.time !== 'undefined' && !isNaN(new Date(m.time).getTime())) ? '[' + new Date(m.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + ']' : '';
    const name = escapeHtml(m.name || 'anon');
    const raw = m.message || '';
    const msgEsc = escapeHtml(raw);
    // determine color index (1..8). Prefer server-supplied m.color but clamp it
    // to the valid range; fall back to deterministic name hashing.
    let idx = getColorForName(m.name || 'anon');
    if (m && typeof m.color !== 'undefined' && m.color !== null && m.color !== '') {
        const parsed = parseInt(m.color, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) idx = parsed;
    }
    // render a delete button at the start of the post (before any time or text)
    const btnHtml = `<button class="gb-trash" data-id="${m.id}" title="Delete post"><i class="fa-solid fa-trash"></i></button>`;
    if (m && m.is_announce) {
        const rest = escapeHtml(raw);
        const timeHtml = time ? `<span id="gb-time">${time}</span> ` : '';
    return `<div class="guestbook-message"> ${btnHtml} ${timeHtml}<span class="gb-name-${idx}">${name}</span> ${rest}</div>\n`;
    }
    if ((m && m.is_action) || (typeof raw === 'string' && raw.match(/^\/me\s+/i))) {
        const rest = (m && m.is_action) ? escapeHtml(raw) : escapeHtml(raw.replace(/^\/me\s+/i, ''));
        return `<div class="guestbook-message guestbook-me"> ${btnHtml} * ${name} ${rest}</div>\n`;
    }
    return `<div class="guestbook-message"> ${btnHtml} <span id="gb-time">${time}</span> <span class="gb-name-${idx}">${name}</span> &gt; ${msgEsc}</div>\n`;
}

function createMessageElement(m) {
    const tmp = document.createElement('div');
    tmp.innerHTML = formatMessageHTML(m);
    return tmp.firstElementChild;
}

function renderMessages(messages) {
    const container = document.querySelector('.guestbook-messages');
    if (!container) return;
    const system = container.querySelector('.system-message')?.outerHTML || '';
    const start = container.querySelector('.start-message')?.outerHTML || '';
    let html = system + '\n';
    for (const m of messages) {
        html += formatMessageHTML(m);
    }
    html += '<br>' + start;
    container.innerHTML = html;
}

let allMessages = [];

function loadHistory() {
    fetch('/guestbook/api.php?limit=2000', {cache:'no-store', credentials:'include'})
    .then(r => r.json())
    .then(data => {
        if (!data || !data.ok) return;
        allMessages = data.messages || [];
        renderMessages(allMessages);
    }).catch(err => console.error('Failed to load history', err));
}

document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('guestbook-type');
    const btn = document.getElementById('guestbook-send');
    // repurpose send button to trigger search (prevent default handlers)
    btn.type = 'button';
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        const q = input.value.trim().toLowerCase();
        if (!q) { renderMessages(allMessages); return; }
        const filtered = allMessages.filter(m => {
            const name = (m.name || '').toString().toLowerCase();
            const msg = (m.message || '').toString().toLowerCase();
            return name.includes(q) || msg.includes(q);
        });
        renderMessages(filtered);
    });
    // Enter key triggers same as click
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } });
    input.placeholder = 'Search history by name or message';
    loadHistory();

    // Delegate delete (trash) button clicks
    const container = document.querySelector('.guestbook-messages');
    container.addEventListener('click', function(e) {
        const btnEl = e.target.closest('.gb-trash');
        if (!btnEl) return;
        const id = btnEl.getAttribute('data-id');
        if (!id) return;
        if (!confirm('Delete this post?')) return;
        // send delete request to server
        fetch('/admin/guestbook/history/delete.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        }).then(r => r.json()).then(resp => {
            if (resp && resp.ok) {
                // remove from allMessages and re-render filtered view
                allMessages = allMessages.filter(m => String(m.id) !== String(id));
                // if input has a filter, trigger search, else render full
                const q = input.value.trim().toLowerCase();
                if (!q) renderMessages(allMessages);
                else btn.click();
            } else {
                alert('Failed to delete post');
            }
        }).catch(err => { console.error('Delete failed', err); alert('Delete failed'); });
    });
});