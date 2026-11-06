const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const sites = [];
const MAX_SITES = 48;
let mlp = initMLP();
let pointer = {x: W/2, y: H/2, vx: 0, vy: 0};
let lastToken = '…';
let speechActive = false;
let recognition = null;

function initMLP() {
  // 5 → 8 → 3 (vx, vy, fitness)
  const w1 = Array.from({length: 8}, () => Array.from({length: 5}, () => (Math.random()-0.5)*0.4));
  const b1 = Array(8).fill(0);
  const w2 = Array.from({length: 3}, () => Array.from({length: 8}, () => (Math.random()-0.5)*0.4));
  const b2 = Array(3).fill(0);
  return {w1, b1, w2, b2};
}

function forward(mlp, x) {
  const h = mlp.w1.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w * x[j], mlp.b1[i])));
  return mlp.w2.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w * h[j], mlp.b2[i])));
}

function hebbianUpdate(mlp, x, reward) {
  if (Math.abs(reward) < 0.05) return;
  const lr = 0.02 * reward;
  // crude Hebbian on last layer
  const h = mlp.w1.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w * x[j], mlp.b1[i])));
  for (let o = 0; o < 3; o++) {
    for (let j = 0; j < 8; j++) mlp.w2[o][j] += lr * h[j] * (o < 2 ? 0.5 : 1);
  }
}

function addSite(x, y, token = lastToken) {
  if (sites.length >= MAX_SITES) sites.shift();
  sites.push({
    x, y, vx: 0, vy: 0, age: 0, fitness: 0.5,
    token: token.slice(0, 16), hue: Math.random() * 360, energy: 0.6
  });
}

// seed a few
for (let i = 0; i < 8; i++) addSite(Math.random()*W, Math.random()*H, 'seed');

// pointer
addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.x;
  pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

// speech
document.getElementById('mic').onclick = () => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('SpeechRecognition not supported');
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = ev => {
    const res = ev.results[ev.results.length - 1];
    if (res.isFinal) {
      lastToken = res[0].transcript.trim();
      const conf = res[0].confidence || 0.7;
      addSite(pointer.x + (Math.random()-0.5)*80, pointer.y + (Math.random()-0.5)*80, lastToken);
      speechActive = true;
      document.documentElement.style.setProperty('--speech', Math.min(1, conf));
    }
  };
  recognition.onerror = () => speechActive = false;
  recognition.start();
  document.getElementById('status').textContent = 'speech active';
};

// portals
const portals = [];
for (let i = 0; i < 5; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = '·';
  document.body.appendChild(el);
  portals.push({el, siteIdx: -1});
  el.onclick = () => {
    if (portals[i].siteIdx >= 0) {
      const s = sites[portals[i].siteIdx];
      s.fitness = Math.min(1, s.fitness + 0.3);
      s.energy = 1;
      el.classList.add('reward');
      setTimeout(() => el.classList.remove('reward'), 400);
      // reward the MLP with current features
      const feat = [pointer.vx/100, pointer.vy/100, s.energy, lastToken.length/20, speechActive ? 1 : 0];
      hebbianUpdate(mlp, feat, 0.8);
    }
  };
}

function entropy() {
  if (sites.length < 2) return 0;
  let e = 0;
  const bins = 8;
  const counts = Array(bins).fill(0);
  sites.forEach(s => counts[Math.floor(s.hue / 360 * bins) % bins]++);
  counts.forEach(c => { const p = c / sites.length; if (p > 0) e -= p * Math.log2(p); });
  return e / Math.log2(bins);
}

function step() {
  const ent = entropy();
  document.documentElement.style.setProperty('--entropy', ent.toFixed(2));
  document.documentElement.style.setProperty('--hue', (ent * 180 + (speechActive ? 40 : 0)).toFixed(0));
  document.getElementById('nsites').textContent = sites.length;
  document.getElementById('ent').textContent = ent.toFixed(2);

  // update sites with MLP
  sites.forEach(s => {
    s.age++;
    const feat = [
      (s.x - pointer.x) / W,
      (s.y - pointer.y) / H,
      s.energy,
      lastToken.length / 24,
      speechActive ? 1 : 0
    ];
    const out = forward(mlp, feat);
    s.vx = s.vx * 0.85 + out[0] * 1.8;
    s.vy = s.vy * 0.85 + out[1] * 1.8;
    s.x = (s.x + s.vx + W) % W;
    s.y = (s.y + s.vy + H) % H;
    s.fitness = Math.max(0, Math.min(1, s.fitness * 0.995 + out[2] * 0.05));
    s.energy *= 0.98;
  });

  // render approximate Voronoi (grid for speed)
  const res = 6;
  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let gy = 0; gy < H; gy += res) {
    for (let gx = 0; gx < W; gx += res) {
      let best = 1e9, bestS = sites[0], best2 = 1e9;
      for (const s of sites) {
        const dx = s.x - gx, dy = s.y - gy;
        const d = dx*dx + dy*dy;
        if (d < best) { best2 = best; best = d; bestS = s; }
        else if (d < best2) best2 = d;
      }
      const edge = Math.sqrt(best2) - Math.sqrt(best) < 8;
      const col = hslToRgb(bestS.hue, 0.6, edge ? 0.15 : 0.25 + bestS.fitness * 0.3);
      for (let dy = 0; dy < res && gy+dy < H; dy++) {
        for (let dx = 0; dx < res && gx+dx < W; dx++) {
          const i = ((gy+dy) * W + (gx+dx)) * 4;
          data[i] = col[0]; data[i+1] = col[1]; data[i+2] = col[2]; data[i+3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  // bind portals to high-fitness sites
  const ranked = sites.map((s,i) => ({s,i})).sort((a,b) => b.s.fitness - a.s.fitness);
  portals.forEach((p, pi) => {
    if (pi < ranked.length) {
      const {s, i} = ranked[pi];
      p.siteIdx = i;
      p.el.style.left = s.x + 'px';
      p.el.style.top = s.y + 'px';
      p.el.style.opacity = 0.4 + s.fitness * 0.6;
      p.el.style.transform = `translate(-50%,-50%) scale(${0.7 + s.fitness * 0.6})`;
      p.el.textContent = s.token || '·';
      p.el.style.borderColor = `hsl(${s.hue},70%,60%)`;
    } else {
      p.el.style.opacity = 0;
    }
  });

  requestAnimationFrame(step);
}
requestAnimationFrame(step);

function hslToRgb(h, s, l) {
  h /= 360;
  const a = s * Math.min(l, 1-l);
  const f = n => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k-3, 9-k, 1), -1);
  };
  return [f(0)*255|0, f(8)*255|0, f(4)*255|0];
}

// seal / restore
const DB = 'verse-f601';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function seal() {
  const db = await openDB();
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({
    mlp, sites: sites.map(s => ({...s})), t: Date.now()
  }, 'current');
  await new Promise(r => tx.oncomplete = r);
  document.getElementById('status').textContent = 'sealed';
}
async function restore() {
  const db = await openDB();
  const tx = db.transaction('genomes', 'readonly');
  const req = tx.objectStore('genomes').get('current');
  req.onsuccess = () => {
    if (req.result) {
      mlp = req.result.mlp;
      sites.length = 0;
      req.result.sites.forEach(s => sites.push(s));
      document.getElementById('status').textContent = 'restored';
    }
  };
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') seal();
  if (e.key === 'r' || e.key === 'R') restore();
});
