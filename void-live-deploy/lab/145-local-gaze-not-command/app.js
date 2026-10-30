const form = document.getElementById('form');
const ledgerEl = document.getElementById('ledger');
const KEY = 'void-gaze-not-command-v1';

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
    div.innerHTML = `<div><strong>Class:</strong> ${escape(it.kind)}</div>
      <div><strong>Desc:</strong> ${escape(it.desc)}</div>
      <div class="unattested">Unattested (flag in hash)</div>
      <div class="refusal">Command-refusal id: ${it.refusal}</div>
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
  const kind = document.getElementById('kind').value;
  const desc = document.getElementById('desc').value.trim();
  if (!kind || !desc) return;
  const payload = `unattested|command-refusal|${kind}|${desc}|${Date.now()}`;
  const hash = await sha256(payload);
  const refusal = hash.slice(0, 12); // short refusal id derived from hash
  const items = load();
  items.unshift({ kind, desc, hash, refusal, ts: Date.now() });
  save(items);
  form.reset();
  document.getElementById('unatt').checked = true;
};

document.getElementById('clear').onclick = () => {
  if (confirm('Discard all local gaze/gesture entries?')) save([]);
};

render(load());
