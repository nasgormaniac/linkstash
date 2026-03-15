/* ============================================================
   LinkStash — app.js
   ============================================================ */

const API          = '/api/links';
const PAGE_SIZE    = 10;

let links     = [];
let editingId = null;
let currentPage = 1;


/* ── THEME ───────────────────────────────────────────────── */

function setTheme(t) {
  document.body.setAttribute('data-theme', t);
  localStorage.setItem('ls_theme', t);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.t === t);
  });
}

setTheme(localStorage.getItem('ls_theme') || 'nightfall');


/* ── API CALLS ───────────────────────────────────────────── */

async function fetchLinks() {
  if (editingId) return; // don't refresh while editing
  try {
    const res = await fetch(API);
    links = await res.json();
    if (editingId && !links.find(l => l.id === editingId)) {
      editingId = null;
    }
    setStatus(true, `${links.length} link${links.length !== 1 ? 's' : ''}`);
    renderAll();
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
    document.getElementById('cardList').innerHTML = `
      <div style="text-align:center;padding:40px;font-family:var(--mono);font-size:12px;color:var(--danger)">
        Cannot connect — run: <strong>python server.py</strong>
      </div>`;
    document.getElementById('pagination').innerHTML = '';
  }
}

async function addLink() {
  const urlEl   = document.getElementById('inputUrl');
  const labelEl = document.getElementById('inputLabel');
  const addBtn  = document.getElementById('addBtn');

  let url     = urlEl.value.trim();
  const label = labelEl.value.trim();

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
    currentPage = 1;   // jump to first page on new add
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
    // if we deleted the last item on a page, go back one
    const q        = document.getElementById('searchInput').value.toLowerCase();
    const filtered = getFiltered(q);
    const total    = Math.ceil((filtered.length - 1) / PAGE_SIZE);
    if (currentPage > total && total > 0) currentPage = total;
    await fetchLinks();
    toast('Deleted');
  } catch {
    toast('Delete failed');
  }
}

async function saveEdit(id) {
  const link = links.find(l => l.id === id);
  if (!link) return;

  let url     = document.getElementById(`edit-url-${id}`).value.trim();
  const label = document.getElementById(`edit-label-${id}`).value.trim();

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
  renderAll();
  setTimeout(() => {
    const el = document.getElementById(`edit-url-${id}`);
    if (el) el.focus();
  }, 0);
}

function cancelEdit() {
  editingId = null;
  renderAll();
}


/* ── PAGINATION ──────────────────────────────────────────── */

function goToPage(p) {
  currentPage = p;
  renderAll();
  // scroll to top of list smoothly
  document.querySelector('.table-wrap, #cardList').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPagination(totalItems) {
  const el         = document.getElementById('pagination');
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);

  if (totalPages <= 1) {
    el.innerHTML = '';
    return;
  }

  const p = currentPage;

  // Build page number list: always show first, last, current ±1, with ... gaps
  const pages = new Set([1, totalPages, p, p - 1, p + 1].filter(n => n >= 1 && n <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);

  let btns = '';

  // Prev button
  btns += `<button class="page-btn page-nav" onclick="goToPage(${p - 1})" ${p === 1 ? 'disabled' : ''}>&#8592;</button>`;

  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) btns += `<span class="page-ellipsis">…</span>`;
    btns += `<button class="page-btn ${n === p ? 'active' : ''}" onclick="goToPage(${n})">${n}</button>`;
    prev = n;
  }

  // Next button
  btns += `<button class="page-btn page-nav" onclick="goToPage(${p + 1})" ${p === totalPages ? 'disabled' : ''}>&#8594;</button>`;

  // Page info
  const from = (p - 1) * PAGE_SIZE + 1;
  const to   = Math.min(p * PAGE_SIZE, totalItems);
  const info = `<span class="page-info">${from}–${to} of ${totalItems}</span>`;

  el.innerHTML = `<div class="pagination-inner">${btns}${info}</div>`;
}


/* ── CLIPBOARD ───────────────────────────────────────────── */

function copyUrl(url) {
  navigator.clipboard.writeText(url)
    .then(() => toast('Copied ✓'))
    .catch(() => {
      toast('Long-press the link to copy');
    });
}


/* ── STATUS ──────────────────────────────────────────────── */

function setStatus(ok, text) {
  document.getElementById('statusDot').className = 'status-dot ' + (ok ? 'ok' : 'err');
  document.getElementById('statusText').textContent = text;
}


/* ── HELPERS ─────────────────────────────────────────────── */

function formatDate(iso) {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = now - d;

  if (diff < 60_000)      return 'just now';
  if (diff < 3_600_000)   return Math.floor(diff / 60_000) + 'm ago';
  if (diff < 86_400_000)  return Math.floor(diff / 3_600_000) + 'h ago';
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

function getFiltered(q) {
  return links.filter(l =>
    l.url.toLowerCase().includes(q) ||
    (l.label && l.label.toLowerCase().includes(q))
  );
}

function getPage(filtered) {
  const total = Math.ceil(filtered.length / PAGE_SIZE);
  // clamp currentPage in case items were deleted
  if (currentPage > total) currentPage = Math.max(1, total);
  const start = (currentPage - 1) * PAGE_SIZE;
  return filtered.slice(start, start + PAGE_SIZE);
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escJs(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}


/* ── RENDER ──────────────────────────────────────────────── */

function renderAll() {
  const q        = document.getElementById('searchInput').value.toLowerCase();
  const filtered = getFiltered(q);
  const paged    = getPage(filtered);

  renderTable(paged, filtered.length, q);
  renderCards(paged, filtered.length, q);
  renderPagination(filtered.length);
}


/* ── TABLE VIEW (desktop) ────────────────────────────────── */

function renderTable(paged, total, q) {
  const body  = document.getElementById('tableBody');
  const empty = document.getElementById('emptyState');

  if (paged.length === 0) {
    body.innerHTML = '';
    empty.style.display = 'block';
    empty.querySelector('.empty-title').textContent = q ? 'No matches'              : 'No links yet';
    empty.querySelector('.empty-sub').textContent   = q ? 'Try a different keyword' : 'Paste a URL above to stash it';
    return;
  }

  empty.style.display = 'none';
  body.innerHTML = paged.map(link => {
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


/* ── CARD VIEW (mobile) ──────────────────────────────────── */

function renderCards(paged, total, q) {
  const cardList = document.getElementById('cardList');

  if (paged.length === 0) {
    cardList.innerHTML = `
      <div id="cardEmpty">
        <div class="empty-icon">🔗</div>
        <div class="empty-title">${q ? 'No matches' : 'No links yet'}</div>
        <div class="empty-sub">${q ? 'Try a different keyword' : 'Paste a URL above to stash it'}</div>
      </div>`;
    return;
  }

  cardList.innerHTML = paged.map(link => {
    if (editingId === link.id) {
      return `
        <div class="link-card editing">
          <div class="card-edit-form">
            <input class="inline-input label-input"
              id="edit-label-${link.id}"
              value="${esc(link.label)}"
              placeholder="Label (optional)" />
            <input class="inline-input"
              id="edit-url-${link.id}"
              value="${esc(link.url)}"
              placeholder="https://"
              onkeydown="if(event.key==='Enter') saveEdit(${link.id}); if(event.key==='Escape') cancelEdit();" />
            <div class="card-edit-actions">
              <button class="icon-btn edit"   onclick="saveEdit(${link.id})">save</button>
              <button class="icon-btn delete" onclick="cancelEdit()">cancel</button>
            </div>
          </div>
        </div>`;
    }

    return `
      <div class="link-card">
        ${link.label
          ? `<div class="card-label">${esc(link.label)}</div>`
          : `<div class="card-no-label">no label</div>`}
        <a class="card-url"
          href="${esc(link.url)}"
          target="_blank"
          rel="noopener"
          title="${esc(link.url)}">${esc(getDisplayUrl(link.url))}</a>
        <div class="card-meta">${formatDate(link.added)}</div>
        <div class="card-actions">
          <button class="icon-btn copy" onclick="copyUrl('${escJs(link.url)}')">copy</button>
          <button class="icon-btn trash" onclick="deleteLink(${link.id})" title="Delete">🗑</button>
        </div>
      </div>`;
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


/* ── KEYBOARD SHORTCUTS ──────────────────────────────────── */

document.getElementById('inputUrl').addEventListener('keydown', e => {
  if (e.key === 'Enter') addLink();
});

document.getElementById('inputLabel').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('inputUrl').focus();
});

// Reset to page 1 whenever search changes
document.getElementById('searchInput').addEventListener('input', () => {
  currentPage = 1;
  renderAll();
});


/* ── INIT ────────────────────────────────────────────────── */

fetchLinks();
setInterval(fetchLinks, 1000);