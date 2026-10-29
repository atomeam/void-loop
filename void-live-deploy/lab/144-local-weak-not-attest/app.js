const form = document.getElementById('form');
const ledgerEl = document.getElementById('ledger');
const KEY = 'void-weak-ledger-v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function save(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
  render(items);
}
function render(items) {
  ledgerEl.innerHTML = items.length ? '' : '<p>No items. Ledger empty (default-deny).</p>';
  items.forEach((it, i) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `<div><strong>Obs:</strong> ${escape(it.obs)}</div>
      <div><strong>Hyp:</strong> ${escape(it.hyp)}</div>
      <div class="unattested">Unattested (flag in hash)</div>
      <div class="hash">SHA-256: ${it.hash}</div>
      <button data-i="${i}">Discard</button>`;
    ledgerEl.appendChild(div);
  });
  ledgerEl.querySelectorAll('button[data-i]').forEach(btn => {
    btn.onclick = () => {
      const items = load();
      items.splice(+btn.dataset.i, 1);
      save(items);
    };
  });
}
function escape(s) { return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

form.onsubmit = async (e) => {
  e.preventDefault();
  const obs = document.getElementById('obs').value.trim();
  const hyp = document.getElementById('hyp').value.trim();
  if (!obs || !hyp) return;
  const payload = `unattested|${obs}|${hyp}|${Date.now()}`;
  const hash = await sha256(payload);
  const items = load();
  items.unshift({ obs, hyp, hash, ts: Date.now() });
  save(items);
  form.reset();
  document.getElementById('unatt').checked = true;
};

document.getElementById('clear').onclick = () => {
  if (confirm('Discard all local weak-signal entries?')) save([]);
};

render(load());
