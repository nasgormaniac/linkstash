/* ============================================================
   LinkStash — app.js
   ============================================================ */

const API = 'http://localhost:8765/api/links';

let links     = [];
let editingId = null;


/* ── THEME ───────────────────────────────────────────────── */

function setTheme(t) {
  document.body.setAttribute('data-theme', t);
  localStorage.setItem('ls_theme', t);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.t === t);
  });
}

// Apply saved theme immediately on load
setTheme(localStorage.getItem('ls_theme') || 'nightfall');


/* ── API CALLS ───────────────────────────────────────────── */

async function fetchLinks() {
  try {
    const res = await fetch(API);
    links = await res.json();
    setStatus(true, `${links.length} link${links.length !== 1 ? 's' : ''}`);
    renderTable();
  } catch {
    setStatus(false, 'server offline');
    document.getElementById('tableBody').innerHTML = `
      <tr>
        <td colspan="4">
          <div class="loading" style="color:var(--danger)">
            Cannot connect — run: <strong>python server.py</strong>
          </div>
        </td>
      </tr>`;
  }
}

async function addLink() {
  const urlEl   = document.getElementById('inputUrl');
  const labelEl = document.getElementById('inputLabel');
  const addBtn  = document.getElementById('addBtn');

  let url       = urlEl.value.trim();
  const label   = labelEl.value.trim();

  if (!url) { urlEl.focus(); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const link = { id: Date.now(), url, label, added: new Date().toISOString() };

  addBtn.disabled = true;
  try {
    await fetch(API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(link),
    });
    urlEl.value   = '';
    labelEl.value = '';
    urlEl.focus();
    await fetchLinks();
    toast('Link saved ✓');
  } catch {
    toast('Save failed — is the server running?');
  }
  addBtn.disabled = false;
}

async function deleteLink(id) {
  try {
    await fetch(`${API}/${id}`, { method: 'DELETE' });
    await fetchLinks();
    toast('Deleted');
  } catch {
    toast('Delete failed');
  }
}

async function saveEdit(id) {
  const link = links.find(l => l.id === id);
  if (!link) return;

  let url      = document.getElementById(`edit-url-${id}`).value.trim();
  const label  = document.getElementById(`edit-label-${id}`).value.trim();

  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const updated = { ...link, url, label };

  try {
    await fetch(`${API}/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(updated),
    });
    editingId = null;
    await fetchLinks();
    toast('Saved ✓');
  } catch {
    toast('Save failed');
  }
}


/* ── EDIT HELPERS ────────────────────────────────────────── */

function startEdit(id) {
  editingId = id;
  renderTable();
  setTimeout(() => {
    const el = document.getElementById(`edit-url-${id}`);
    if (el) el.focus();
  }, 0);
}

function cancelEdit() {
  editingId = null;
  renderTable();
}


/* ── CLIPBOARD ───────────────────────────────────────────── */

function copyUrl(url) {
  navigator.clipboard.writeText(url)
    .then(() => toast('Copied ✓'))
    .catch(() => {
      // Fallback for browsers without clipboard API
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Copied ✓');
    });
}


/* ── STATUS ──────────────────────────────────────────────── */

function setStatus(ok, text) {
  document.getElementById('statusDot').className = 'status-dot ' + (ok ? 'ok' : 'err');
  document.getElementById('statusText').textContent = text;
}


/* ── RENDER ──────────────────────────────────────────────── */

function formatDate(iso) {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = now - d;

  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return Math.floor(diff / 60_000) + 'm ago';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'h ago';
  if (diff < 604_800_000) return Math.floor(diff / 86_400_000) + 'd ago';

  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function getDisplayUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return url;
  }
}

function renderTable() {
  const q        = document.getElementById('searchInput').value.toLowerCase();
  const filtered = links.filter(l =>
    l.url.toLowerCase().includes(q) ||
    (l.label && l.label.toLowerCase().includes(q))
  );

  const body  = document.getElementById('tableBody');
  const empty = document.getElementById('emptyState');

  if (filtered.length === 0) {
    body.innerHTML = '';
    empty.style.display = 'block';
    empty.querySelector('.empty-title').textContent = q ? 'No matches'           : 'No links yet';
    empty.querySelector('.empty-sub').textContent   = q ? 'Try a different keyword' : 'Paste a URL above to stash it';
    return;
  }

  empty.style.display = 'none';
  body.innerHTML = filtered.map(link => {
    if (editingId === link.id) {
      return `
        <tr class="editing">
          <td class="td-label">
            <input class="inline-input label-input"
              id="edit-label-${link.id}"
              value="${esc(link.label)}"
              placeholder="Label" />
          </td>
          <td class="td-url" colspan="2">
            <input class="inline-input"
              id="edit-url-${link.id}"
              value="${esc(link.url)}"
              placeholder="https://"
              onkeydown="if(event.key==='Enter') saveEdit(${link.id}); if(event.key==='Escape') cancelEdit();" />
          </td>
          <td class="td-actions">
            <button class="icon-btn edit"   onclick="saveEdit(${link.id})">save</button>
            <button class="icon-btn delete" onclick="cancelEdit()">cancel</button>
          </td>
        </tr>`;
    }

    return `
      <tr>
        <td class="td-label">
          ${link.label
            ? `<div class="label-text" title="${esc(link.label)}">${esc(link.label)}</div>`
            : `<span class="no-label">—</span>`}
        </td>
        <td class="td-url">
          <a class="url-link"
            href="${esc(link.url)}"
            target="_blank"
            rel="noopener"
            title="${esc(link.url)}">${esc(getDisplayUrl(link.url))}</a>
        </td>
        <td class="td-date">${formatDate(link.added)}</td>
        <td class="td-actions">
          <button class="icon-btn copy"   onclick="copyUrl('${escJs(link.url)}')">copy</button>
          <button class="icon-btn edit"   onclick="startEdit(${link.id})">edit</button>
          <button class="icon-btn delete" onclick="deleteLink(${link.id})">del</button>
        </td>
      </tr>`;
  }).join('');
}


/* ── TOAST ───────────────────────────────────────────────── */

let toastTimer;

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}


/* ── UTILS ───────────────────────────────────────────────── */

// Escape for HTML attributes and text content
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Escape for inline JS string literals (single-quoted)
function escJs(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}


/* ── KEYBOARD SHORTCUTS ──────────────────────────────────── */

document.getElementById('inputUrl').addEventListener('keydown', e => {
  if (e.key === 'Enter') addLink();
});

document.getElementById('inputLabel').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('inputUrl').focus();
});


/* ── INIT ────────────────────────────────────────────────── */

fetchLinks();
