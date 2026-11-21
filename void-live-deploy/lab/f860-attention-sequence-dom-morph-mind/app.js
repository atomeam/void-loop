const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
const fitEl = document.getElementById('fit');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 6;
const portals = [];
const HISTORY = 12;
const D = 8;
let history = [];
let fitness = 0;
let orient = {x:0, y:0};
let pointer = {x: W/2, y: H/2, vx:0, vy:0};

// Tiny attention weights (random init)
let Wq = Array.from({length:D}, () => Array.from({length:D}, () => (Math.random()-0.5)*0.2));
let Wk = Array.from({length:D}, () => Array.from({length:D}, () => (Math.random()-0.5)*0.2));
let Wv = Array.from({length:D}, () => Array.from({length:D}, () => (Math.random()-0.5)*0.2));

function matMul(A, v) {
  return A.map(row => row.reduce((s, a, i) => s + a * v[i], 0));
}
function softmax(xs) {
  const m = Math.max(...xs);
  const ex = xs.map(x => Math.exp(x - m));
  const s = ex.reduce((a,b)=>a+b,0);
  return ex.map(e => e/s);
}

function makePortal(i) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.innerHTML = `<h3>Portal ${i+1}</h3><div class="energy">energy 0.0</div>`;
  el.dataset.i = i;
  portalsEl.appendChild(el);
  return {
    el, i,
    x: Math.random()*W, y: Math.random()*H,
    energy: 0,
    morph: 0.5
  };
}
for (let i=0; i<N; i++) portals.push(makePortal(i));

function pushHistory() {
  const nx = pointer.x / W, ny = pointer.y / H;
  history.push([nx, ny, pointer.vx/20, pointer.vy/20, orient.x, orient.y, Math.sin(Date.now()/1000), Math.cos(Date.now()/800)]);
  if (history.length > HISTORY) history.shift();
  while (history.length < HISTORY) history.push(new Array(8).fill(0));
}

function attentionStep() {
  if (history.length < 2) return;
  const tokens = history.map(h => {
    const t = h.slice(0,D);
    while (t.length < D) t.push(0);
    return t;
  });
  // Compute Q,K,V for last token primarily, but average influence
  const last = tokens[tokens.length-1];
  const Q = matMul(Wq, last);
  const scores = tokens.map(tok => {
    const K = matMul(Wk, tok);
    return Q.reduce((s,q,i) => s + q*K[i], 0) / Math.sqrt(D);
  });
  const attn = softmax(scores);
  // Aggregate value
  const Vagg = new Array(D).fill(0);
  tokens.forEach((tok, i) => {
    const V = matMul(Wv, tok);
    V.forEach((v,j) => Vagg[j] += attn[i] * v);
  });
  // Apply to portals
  portals.forEach((p, pi) => {
    const phase = (pi / N) * Math.PI * 2;
    const dx = Math.cos(phase + Vagg[0]*2) * 40 + (Vagg[1]||0)*30;
    const dy = Math.sin(phase + Vagg[2]*2) * 40 + (Vagg[3]||0)*30;
    p.x = Math.max(20, Math.min(W-140, p.x + dx * 0.05));
    p.y = Math.max(20, Math.min(H-110, p.y + dy * 0.05));
    p.energy = Math.abs(attn.reduce((s,a,i)=>s+a*(i/HISTORY),0));
    p.morph = 0.3 + 0.7 * Math.tanh(Vagg[4]||0);
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
    const r = 8 + p.morph*20;
    p.el.style.borderRadius = r + 'px';
    const hue = (p.energy * 360 + pi*40) % 360;
    p.el.style.filter = `hue-rotate(${hue}deg) brightness(${0.8+p.energy})`;
    p.el.style.transform = `scale(${0.85 + p.energy*0.3})`;
    // Dynamic clip-path morph
    const m = p.morph;
    const cp = `polygon(${10+m*5}% ${m*10}%, ${90-m*5}% ${m*5}%, ${100-m*10}% 30%, 100% ${70-m*5}%, ${90-m*8}% ${100-m*10}%, ${10+m*8}% 100%, ${m*5}% 70%, 0% 30%)`;
    p.el.style.clipPath = cp;
    p.el.querySelector('.energy').textContent = `energy ${p.energy.toFixed(2)}`;
  });
  fitness += portals.reduce((s,p)=>s+p.energy,0) * 0.01;
  fitEl.textContent = fitness.toFixed(1);
}

function drawField() {
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0,0,W,H);
  portals.forEach(p => {
    const g = ctx.createRadialGradient(p.x+60, p.y+45, 0, p.x+60, p.y+45, 80+p.energy*60);
    g.addColorStop(0, `rgba(88,166,255,${0.15+p.energy*0.3})`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);
  });
}

let dragging = null, dragOff = {x:0,y:0};
portalsEl.addEventListener('pointerdown', e => {
  const el = e.target.closest('.portal');
  if (!el) return;
  dragging = portals[el.dataset.i];
  dragOff.x = e.clientX - dragging.x;
  dragOff.y = e.clientY - dragging.y;
  el.setPointerCapture(e.pointerId);
});
addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.x;
  pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (dragging) {
    const tx = e.clientX - dragOff.x;
    const ty = e.clientY - dragOff.y;
    // Supervised update toward drag target
    const errX = (tx - dragging.x) / W;
    const errY = (ty - dragging.y) / H;
    const lr = 0.008;
    // Simple gradient-like update on last row of weights
    for (let i=0; i<D; i++) {
      Wq[0][i] += lr * errX * (history.at(-1)?.[i]||0);
      Wk[1][i] += lr * errY * (history.at(-1)?.[i]||0);
    }
    dragging.x = tx; dragging.y = ty;
    fitness += 0.5;
  }
});
addEventListener('pointerup', () => { dragging = null; });

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orient.x = (e.gamma||0)/90;
    orient.y = (e.beta||0)/90;
  });
}

document.getElementById('seal').onclick = async () => {
  const genome = { Wq, Wk, Wv, fitness, portals: portals.map(p=>({x:p.x,y:p.y,morph:p.morph})) };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f860-attn-morph', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(genome, 'current');
    await new Promise(r => tx.oncomplete = r);
    if (window.BroadcastChannel) {
      new BroadcastChannel('f860-genome').postMessage(genome);
    }
    alert('Genome sealed');
  } catch(e) { console.warn(e); alert('Sealed in memory only'); }
};

document.getElementById('reset').onclick = () => location.reload();

async function restore() {
  try {
    const db = await new Promise(res => {
      const r = indexedDB.open('verse-f860-attn-morph', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    });
    if (!db) return;
    const tx = db.transaction('genomes');
    const g = await new Promise(res => {
      const req = tx.objectStore('genomes').get('current');
      req.onsuccess = () => res(req.result);
    });
    if (g) {
      Wq = g.Wq; Wk = g.Wk; Wv = g.Wv; fitness = g.fitness||0;
      g.portals?.forEach((st,i) => { if (portals[i]) { portals[i].x=st.x; portals[i].y=st.y; portals[i].morph=st.morph; } });
    }
  } catch (e) { console.debug("lab f860-attention-sequence-dom-morph-mind:", e); }
  if (window.BroadcastChannel) {
    new BroadcastChannel('f860-genome').onmessage = ev => {
      if (ev.data.fitness > fitness) {
        Wq = ev.data.Wq; Wk = ev.data.Wk; Wv = ev.data.Wv; fitness = ev.data.fitness;
      }
    };
  }
}
restore();

function loop() {
  pushHistory();
  attentionStep();
  drawField();
  requestAnimationFrame(loop);
}
loop();
