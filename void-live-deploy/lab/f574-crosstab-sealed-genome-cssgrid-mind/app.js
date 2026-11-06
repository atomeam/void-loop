const N = 12;
const CHANNEL = 'verse-f574-genome';
const DB_NAME = 'verse-f574';
const STORE = 'genomes';
let tiles = [];
let qTable = {};
let epsilon = 0.25;
let fitness = 0;
let gen = 0;
let recentRewards = [];
let channel;
let peers = new Set();

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

function getState() {
  const positions = tiles.map(t => [parseInt(t.style.gridColumn, 10) || 1, parseInt(t.style.gridRow, 10) || 1]);
  const avg = positions.reduce((a, p) => [a[0]+p[0], a[1]+p[1]], [0,0]).map(x => x/N);
  const varX = positions.reduce((s, p) => s + (p[0]-avg[0])**2, 0)/N;
  if (varX < 0.8) return 'cluster';
  if (varX < 2.5) return 'mid';
  return 'spread';
}

const ACTIONS = ['shuffle', 'cluster', 'spread', 'hue', 'scale'];
function chooseAction(state) {
  if (Math.random() < epsilon) return ACTIONS[Math.floor(Math.random()*ACTIONS.length)];
  const qs = qTable[state] || {};
  let best = ACTIONS[0], bv = -Infinity;
  for (const a of ACTIONS) {
    const v = qs[a] || 0;
    if (v > bv) { bv = v; best = a; }
  }
  return best;
}

function applyAction(a) {
  if (a === 'shuffle') {
    const cols = [1,2,3,4], rows = [1,2,3];
    tiles.forEach(t => {
      t.style.gridColumn = cols[Math.floor(Math.random()*4)];
      t.style.gridRow = rows[Math.floor(Math.random()*3)];
    });
  } else if (a === 'cluster') {
    tiles.forEach(t => {
      t.style.gridColumn = 2 + Math.floor(Math.random()*2);
      t.style.gridRow = 2;
    });
  } else if (a === 'spread') {
    tiles.forEach((t,i) => {
      t.style.gridColumn = (i % 4) + 1;
      t.style.gridRow = Math.floor(i / 4) + 1;
    });
  } else if (a === 'hue') {
    tiles.forEach(t => {
      let h = parseFloat(t.style.getPropertyValue('--h') || 200);
      h = (h + 30 + Math.random()*40) % 360;
      t.style.setProperty('--h', h);
    });
  } else if (a === 'scale') {
    tiles.forEach(t => {
      const s = 0.8 + Math.random()*0.6;
      t.style.transform = `scale(${s})`;
    });
  }
}

function updateQ(s, a, r, s2) {
  if (!qTable[s]) qTable[s] = {};
  if (!qTable[s][a]) qTable[s][a] = 0;
  const maxNext = Math.max(...ACTIONS.map(aa => (qTable[s2] && qTable[s2][aa]) || 0), 0);
  qTable[s][a] += 0.1 * (r + 0.9 * maxNext - qTable[s][a]);
}

function createTiles() {
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '';
  tiles = [];
  for (let i = 0; i < N; i++) {
    const t = document.createElement('div');
    t.className = 'tile';
    t.textContent = i + 1;
    t.style.setProperty('--h', 180 + Math.random()*180);
    t.style.gridColumn = (i % 4) + 1;
    t.style.gridRow = Math.floor(i / 4) + 1;
    t.onclick = () => {
      fitness += 1;
      recentRewards.push(1);
      if (recentRewards.length > 20) recentRewards.shift();
      t.style.filter = 'brightness(1.8)';
      setTimeout(() => t.style.filter = '', 200);
    };
    canvas.appendChild(t);
    tiles.push(t);
  }
}

function step() {
  const s = getState();
  const a = chooseAction(s);
  applyAction(a);
  const r = recentRewards.reduce((x,y)=>x+y,0) / 10;
  fitness = r;
  const s2 = getState();
  updateQ(s, a, r, s2);
  epsilon = Math.max(0.05, epsilon * 0.995);
  document.getElementById('fit').textContent = fitness.toFixed(2);
  document.getElementById('eps').textContent = epsilon.toFixed(2);
  document.getElementById('gen').textContent = gen;
  document.getElementById('status').textContent = `state:${s} act:${a}`;
  recentRewards = recentRewards.map(x => x * 0.95);
}

function sealGenome() {
  const genome = { q: qTable, eps: epsilon, fit: fitness, gen };
  const str = JSON.stringify(genome);
  const h = hashStr(str);
  return { ...genome, hash: h, id: Date.now() };
}

function broadcast() {
  if (!channel) return;
  const g = sealGenome();
  channel.postMessage({ type: 'genome', data: g });
  peers.add('self');
  document.getElementById('peers').textContent = peers.size;
}

function adopt(g) {
  if (!g || !g.q) return;
  const str = JSON.stringify({ q: g.q, eps: g.eps, fit: g.fit, gen: g.gen });
  if (hashStr(str) !== g.hash) return; // seal fail
  if (g.fit > fitness * 0.9) {
    qTable = JSON.parse(JSON.stringify(g.q));
    // mutate a bit
    for (const s of Object.keys(qTable)) for (const a of Object.keys(qTable[s])) qTable[s][a] += (Math.random()-0.5)*0.05;
    epsilon = Math.min(0.4, g.eps + 0.05);
    gen = (g.gen || 0) + 1;
    fitness = g.fit * 0.8;
  }
}

async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function persist() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(sealGenome(), 'current');
    await new Promise(r => tx.oncomplete = r);
  } catch (e) { console.warn('f574-crosstab-sealed-genome-cssgrid-mind:', e); }
}

async function restore() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('current');
    return new Promise(res => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
    });
  } catch(e) { return null; }
}

async function init() {
  createTiles();
  const saved = await restore();
  if (saved && saved.q) { qTable = saved.q; epsilon = saved.eps || 0.25; fitness = saved.fit || 0; gen = saved.gen || 0; }
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (ev) => {
    if (ev.data.type === 'genome') {
      peers.add(ev.data.data.id);
      document.getElementById('peers').textContent = peers.size;
      adopt(ev.data.data);
    }
  };
  setInterval(step, 1800);
  setInterval(broadcast, 8000);
  document.getElementById('seal').onclick = persist;
  document.getElementById('reset').onclick = () => { qTable = {}; epsilon = 0.3; fitness = 0; gen = 0; createTiles(); };
  document.getElementById('mutate').onclick = () => { for (const s of Object.keys(qTable)) for (const a of Object.keys(qTable[s])) qTable[s][a] += (Math.random()-0.5)*0.2; };
  document.getElementById('status').textContent = 'ready · open more tabs to migrate genomes';
}

init();
