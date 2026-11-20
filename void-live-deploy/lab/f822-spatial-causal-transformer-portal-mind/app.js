const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
const statusEl = document.getElementById('status');

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

// Simple multi-head attention on spatial tokens
const SEQ = 12;
const D = 8;
const HEADS = 2;
const NPORT = 4;

let tokens = []; // {x,y,vx,vy,t}
let lastPos = {x: 0, y: 0, t: 0};

// Weights: Q, K, V projections (simplified shared) + output
let Wq = Array.from({length: HEADS}, () => Array.from({length: D}, () => Array(4).fill(0).map(() => (Math.random()-0.5)*0.3)));
let Wk = Array.from({length: HEADS}, () => Array.from({length: D}, () => Array(4).fill(0).map(() => (Math.random()-0.5)*0.3)));
let Wo = Array.from({length: 2 + NPORT}, () => Array(HEADS * D).fill(0).map(() => (Math.random()-0.5)*0.2));

const portals = [];
for (let i = 0; i < NPORT; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.contentEditable = true;
  el.innerHTML = `<strong>Portal ${i+1}</strong><br>Edit me. Click to reward current pattern.`;
  el.style.left = (20 + i * 25) + '%';
  el.style.top = (20 + (i % 2) * 40) + '%';
  portalsEl.appendChild(el);
  portals.push({ el, x: 100 + i*150, y: 100 + (i%2)*200, vx: 0, vy: 0, affinity: 0.5 });
}

function embed(tok) {
  // 4-dim raw → pad to D
  const e = [tok.x, tok.y, tok.vx, tok.vy, 0, 0, 0, 0];
  return e;
}

function softmax(arr) {
  const m = Math.max(...arr);
  const ex = arr.map(v => Math.exp(v - m));
  const s = ex.reduce((a,b)=>a+b, 0);
  return ex.map(v => v / s);
}

function attentionStep() {
  if (tokens.length < 2) return { focus: [0.5, 0.5], aff: [0.5,0.5,0.5,0.5] };
  const embs = tokens.map(embed);
  let headsOut = [];
  for (let h = 0; h < HEADS; h++) {
    const Q = embs.map(e => Wq[h].map(row => row.reduce((s,w,i)=>s + w*e[i], 0)));
    const K = embs.map(e => Wk[h].map(row => row.reduce((s,w,i)=>s + w*e[i], 0)));
    const scores = Q.map(q => K.map(k => q.reduce((s,qv,i)=>s + qv*k[i], 0) / Math.sqrt(D)));
    const attn = scores.map(softmax);
    const V = embs; // identity value
    const out = attn.map((a, i) => {
      const o = Array(D).fill(0);
      a.forEach((aw, j) => {
        for (let d = 0; d < D; d++) o[d] += aw * V[j][d];
      });
      return o;
    });
    // mean pool
    const pooled = Array(D).fill(0);
    out.forEach(o => o.forEach((v,d) => pooled[d] += v / out.length));
    headsOut.push(pooled);
  }
  const concat = headsOut.flat();
  const raw = Wo.map(row => row.reduce((s,w,i)=>s + w*(concat[i]||0), 0));
  const focus = [Math.tanh(raw[0])*0.5+0.5, Math.tanh(raw[1])*0.5+0.5];
  const aff = raw.slice(2).map(v => Math.tanh(v)*0.5+0.5);
  return { focus, aff };
}

let focus = [0.5, 0.5];
let affs = [0.5,0.5,0.5,0.5];

function onPointer(e) {
  const x = (e.clientX || 0) / innerWidth;
  const y = (e.clientY || 0) / innerHeight;
  const t = performance.now();
  const dt = Math.max(1, t - lastPos.t);
  const vx = (x - lastPos.x) / dt * 1000;
  const vy = (y - lastPos.y) / dt * 1000;
  tokens.push({x, y, vx, vy, t});
  if (tokens.length > SEQ) tokens.shift();
  lastPos = {x, y, t};
  const res = attentionStep();
  focus = res.focus;
  affs = res.aff;
  statusEl.textContent = `focus ${(focus[0]*100)|0},${(focus[1]*100)|0} · tokens ${tokens.length}`;
}
addEventListener('pointermove', onPointer);
addEventListener('pointerdown', onPointer);

function step() {
  // spring portals to focus, modulated by affinity
  const fx = focus[0] * innerWidth;
  const fy = focus[1] * innerHeight;
  portals.forEach((p, i) => {
    const a = affs[i] || 0.5;
    const tx = fx + (i - 1.5) * 40 * (1 - a);
    const ty = fy + (i % 2 ? 30 : -30) * (1 - a);
    const dx = tx - p.x, dy = ty - p.y;
    p.vx += dx * 0.008 * a;
    p.vy += dy * 0.008 * a;
    p.vx *= 0.92; p.vy *= 0.92;
    p.x += p.vx; p.y += p.vy;
    p.el.style.left = (p.x - 90) + 'px';
    p.el.style.top = (p.y - 50) + 'px';
    const s = 0.8 + a * 0.5;
    p.el.style.transform = `scale(${s})`;
    p.el.style.filter = `hue-rotate(${a * 80}deg) brightness(${0.8 + a * 0.4})`;
    p.el.style.boxShadow = `0 0 ${10 + a*30}px rgba(100,180,255,${a*0.6})`;
  });

  // draw
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (tokens.length > 1) {
    ctx.beginPath();
    tokens.forEach((tok, i) => {
      const px = tok.x * canvas.width, py = tok.y * canvas.height;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = 'rgba(100,180,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // focus
    ctx.beginPath();
    ctx.arc(focus[0]*canvas.width, focus[1]*canvas.height, 18, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,200,80,0.5)';
    ctx.fill();
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Reward: click portal → Hebbian nudge on weights
portals.forEach((p, i) => {
  p.el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (tokens.length < 2) return;
    const last = embed(tokens[tokens.length-1]);
    // simple positive update
    for (let h = 0; h < HEADS; h++) {
      for (let d = 0; d < D; d++) {
        for (let k = 0; k < 4; k++) {
          Wq[h][d][k] += 0.002 * last[k] * (affs[i] || 0.5);
          Wk[h][d][k] += 0.001 * last[k];
        }
      }
    }
    statusEl.textContent = `rewarded portal ${i+1}`;
  });
});

// Persistence
const DB = 'f822-transformer';
function save() {
  const data = { Wq, Wk, Wo, portals: portals.map(p => ({html: p.el.innerHTML, x: p.x, y: p.y})) };
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore('state');
  req.onsuccess = () => {
    const tx = req.result.transaction('state', 'readwrite');
    tx.objectStore('state').put(data, 'main');
  };
}
function load() {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore('state');
  req.onsuccess = () => {
    const tx = req.result.transaction('state');
    const g = tx.objectStore('state').get('main');
    g.onsuccess = () => {
      if (g.result) {
        const d = g.result;
        if (d.Wq) { Wq = d.Wq; Wk = d.Wk; Wo = d.Wo; }
        if (d.portals) d.portals.forEach((pd, i) => {
          if (portals[i]) {
            portals[i].el.innerHTML = pd.html;
            portals[i].x = pd.x; portals[i].y = pd.y;
          }
        });
        statusEl.textContent = 'restored';
      }
    };
  };
}
load();
document.getElementById('seal').onclick = () => { save(); statusEl.textContent = 'sealed'; };
document.getElementById('reset').onclick = () => {
  tokens = [];
  Wq = Array.from({length: HEADS}, () => Array.from({length: D}, () => Array(4).fill(0).map(() => (Math.random()-0.5)*0.3)));
  Wk = Array.from({length: HEADS}, () => Array.from({length: D}, () => Array(4).fill(0).map(() => (Math.random()-0.5)*0.3)));
  Wo = Array.from({length: 2 + NPORT}, () => Array(HEADS * D).fill(0).map(() => (Math.random()-0.5)*0.2));
  statusEl.textContent = 'reset';
};
setInterval(save, 15000);
