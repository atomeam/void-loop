const $ = id => document.getElementById(id);
const KEY = 'verse-f633-raffle';

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.names) $('names').value = d.names;
    if (d.count) $('count').value = d.count;
    if (d.seed) $('seed').value = d.seed;
  } catch (e) { console.debug("lab f633-raffle-name-draw:", e); }
}

function save() {
  const d = {
    names: $('names').value,
    count: $('count').value,
    seed: $('seed').value
  };
  localStorage.setItem(KEY, JSON.stringify(d));
}

function parseNames(text) {
  return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

let currentPool = [];
let lastWinners = [];
let lastSeed = '';
let lastWhen = '';

function draw() {
  const names = parseNames($('names').value);
  if (!names.length) {
    alert('Add at least one name.');
    return;
  }
  const n = Math.max(1, parseInt($('count').value, 10) || 1);
  if (n > names.length) {
    alert('Cannot draw more winners than names.');
    return;
  }
  let seedStr = $('seed').value.trim();
  if (!seedStr) {
    seedStr = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    $('seed').value = seedStr;
  }
  const rng = mulberry32(hashSeed(seedStr));
  const pool = names.slice();
  // Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  lastWinners = pool.slice(0, n);
  currentPool = pool.slice(n);
  lastSeed = seedStr;
  lastWhen = new Date().toISOString();

  $('winners').innerHTML = lastWinners.map((w, i) => `<div class="winner">${i + 1}. ${escapeHtml(w)}</div>`).join('');
  $('showSeed').textContent = lastSeed;
  $('when').textContent = new Date(lastWhen).toLocaleString();
  $('remaining').textContent = currentPool.length ? currentPool.join(', ') : '(none)';
  $('result').hidden = false;
  $('copy').disabled = false;
  $('csv').disabled = false;
  save();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function resetPool() {
  currentPool = [];
  lastWinners = [];
  $('result').hidden = true;
  $('copy').disabled = true;
  $('csv').disabled = true;
  // keep names and seed
}

function copyResults() {
  const text = `Raffle winners (${lastWhen})\nSeed: ${lastSeed}\n\n${lastWinners.map((w,i)=>`${i+1}. ${w}`).join('\n')}\n\nRemaining: ${currentPool.join(', ') || 'none'}`;
  navigator.clipboard.writeText(text).then(() => {
    const b = $('copy');
    const old = b.textContent;
    b.textContent = 'Copied';
    setTimeout(() => b.textContent = old, 1500);
  }).catch(() => alert('Could not copy. Select the text manually.'));
}

function downloadCSV() {
  const lines = [
    'position,name,seed,drawn_at',
    ...lastWinners.map((w, i) => `${i+1},"${w.replace(/"/g,'""')}",${lastSeed},${lastWhen}`)
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `raffle-${lastSeed}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('draw').onclick = draw;
$('reset').onclick = resetPool;
$('copy').onclick = copyResults;
$('csv').onclick = downloadCSV;
['names','count','seed'].forEach(id => $(id).addEventListener('input', save));

load();
// initial pool display if wanted
