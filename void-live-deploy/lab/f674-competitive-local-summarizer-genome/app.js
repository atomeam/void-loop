const $ = id => document.getElementById(id);
const status = $('status');
const cands = $('cands');
let agents = [];
let bestSummary = '';
let bestGenome = null;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('verse-summarizer-genome') : null;

function randWeights() {
  return [Math.random()*0.5+0.2, Math.random()*0.3-0.15, Math.random()*0.4+0.1]; // len, pos, rarity
}

function initAgents(genome) {
  agents = [];
  for (let i = 0; i < 4; i++) {
    agents.push({ id: i, w: genome && i === 0 ? [...genome] : randWeights() });
  }
}

function scoreSentence(s, idx, total, w) {
  const len = Math.min(s.length / 100, 1);
  const pos = 1 - idx / Math.max(total, 1);
  const rarity = (s.split(/\s+/).filter(w => w.length > 6).length) / Math.max(s.split(/\s+/).length, 1);
  return w[0]*len + w[1]*pos + w[2]*rarity;
}

function extract(text, w) {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  if (sentences.length === 0) return text.slice(0, 200);
  const scored = sentences.map((s, i) => ({ s, sc: scoreSentence(s, i, sentences.length, w) }));
  scored.sort((a, b) => b.sc - a.sc);
  const n = Math.max(1, Math.ceil(sentences.length * 0.3));
  return scored.slice(0, n).map(x => x.s).join('. ') + '.';
}

function run() {
  const text = $('src').value.trim();
  if (!text) { status.textContent = 'Paste some text first.'; return; }
  cands.innerHTML = '';
  agents.forEach(ag => {
    const sum = extract(text, ag.w);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>Agent ${ag.id}</h3><div class="summary">${sum}</div><button data-id="${ag.id}">Prefer this</button>`;
    cands.appendChild(card);
  });
  status.textContent = 'Competition complete. Prefer the best summary to seal its genome.';
}

function prefer(id) {
  const ag = agents.find(a => a.id === id);
  if (!ag) return;
  bestGenome = [...ag.w];
  bestSummary = extract($('src').value.trim(), bestGenome);
  status.textContent = `Sealed genome from Agent ${id}. Broadcasting...`;
  if (channel) channel.postMessage({ type: 'genome', w: bestGenome, ts: Date.now() });
  save();
}

function save() {
  try {
    const dbReq = indexedDB.open('verse-summarizer', 1);
    dbReq.onupgradeneeded = e => e.target.result.createObjectStore('state');
    dbReq.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put({ text: $('src').value, genome: bestGenome }, 'last');
    };
  } catch (e) { console.warn(e); }
}

function load() {
  try {
    const dbReq = indexedDB.open('verse-summarizer', 1);
    dbReq.onupgradeneeded = e => e.target.result.createObjectStore('state');
    dbReq.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('state', 'readonly');
      const req = tx.objectStore('state').get('last');
      req.onsuccess = () => {
        if (req.result) {
          if (req.result.text) $('src').value = req.result.text;
          if (req.result.genome) bestGenome = req.result.genome;
        }
        initAgents(bestGenome);
      };
    };
  } catch (e) { initAgents(); }
}

if (channel) {
  channel.onmessage = ev => {
    if (ev.data && ev.data.type === 'genome') {
      bestGenome = ev.data.w;
      initAgents(bestGenome);
      status.textContent = 'Adopted sealed genome from another tab.';
    }
  };
}

$('run').onclick = run;
cands.onclick = e => { if (e.target.dataset.id) prefer(+e.target.dataset.id); };
$('dl').onclick = () => {
  if (!bestSummary) { status.textContent = 'Prefer a summary first.'; return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bestSummary], { type: 'text/plain' }));
  a.download = 'summary.txt';
  a.click();
};
$('copy').onclick = () => {
  if (!bestSummary) return;
  navigator.clipboard.writeText(bestSummary).then(() => status.textContent = 'Copied.');
};

load();
status.textContent = 'Ready. Paste text and run competition.';
