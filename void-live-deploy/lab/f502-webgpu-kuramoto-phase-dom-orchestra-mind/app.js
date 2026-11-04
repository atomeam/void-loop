const N = 10;
const stage = document.getElementById('stage');
const canvas = document.createElement('canvas');
stage.appendChild(canvas);
const ctx = canvas.getContext('2d');
let W, H, cx, cy, R = 180;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; cx = W/2; cy = H/2; }
addEventListener('resize', resize); resize();

let osc = [];
let K = [];
let mode = 'sync'; // or 'desync'
let order = 0;
const cards = [];

function init() {
  osc = []; K = [];
  cards.forEach(c => c.remove()); cards.length = 0;
  for (let i = 0; i < N; i++) {
    const ω = (Math.random()-0.5)*0.8;
    osc.push({ θ: Math.random()*Math.PI*2, ω, x:0, y:0 });
    K.push(Array(N).fill(0).map(() => (Math.random()-0.5)*0.4));
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = i;
    card.dataset.i = i;
    stage.appendChild(card);
    cards.push(card);
    makeDraggable(card, i);
  }
  layout();
}
function layout() {
  osc.forEach((o, i) => {
    const a = (i / N) * Math.PI * 2;
    o.x = cx + Math.cos(a) * R;
    o.y = cy + Math.sin(a) * R;
    const c = cards[i];
    c.style.left = (o.x - 36) + 'px';
    c.style.top = (o.y - 36) + 'px';
  });
}
function makeDraggable(card, i) {
  let dragging = false, lx, ly;
  card.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; card.setPointerCapture(e.pointerId); });
  card.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    const kick = Math.hypot(dx, dy) * 0.02;
    osc[i].θ += kick * (dx > 0 ? 1 : -1);
    lx = e.clientX; ly = e.clientY;
  });
  card.addEventListener('pointerup', () => dragging = false);
}

function step(dt = 0.016) {
  const next = osc.map(o => ({...o}));
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let j = 0; j < N; j++) if (i !== j) sum += K[i][j] * Math.sin(osc[j].θ - osc[i].θ);
    next[i].θ = (osc[i].θ + (osc[i].ω + sum) * dt) % (Math.PI*2);
  }
  osc = next;
  // order parameter
  let re = 0, im = 0;
  osc.forEach(o => { re += Math.cos(o.θ); im += Math.sin(o.θ); });
  order = Math.hypot(re, im) / N;
  document.documentElement.style.setProperty('--order', order.toFixed(3));
  document.documentElement.style.setProperty('--hue', (order * 120).toFixed(0));
  document.getElementById('status').textContent = `order: ${order.toFixed(2)} | mode: ${mode}`;
  // embody
  osc.forEach((o, i) => {
    const c = cards[i];
    const sc = 1 + 0.25 * Math.sin(o.θ);
    c.style.transform = `rotate(${o.θ}rad) scale(${sc})`;
    c.style.setProperty('--h', ((o.θ / (Math.PI*2)) * 360).toFixed(0));
  });
  draw();
}
function draw() {
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle = `hsla(${order*120},60%,60%,0.3)`;
  ctx.lineWidth = 1;
  for (let i = 0; i < N; i++) for (let j = i+1; j < N; j++) {
    if (Math.abs(K[i][j]) > 0.15) {
      ctx.beginPath();
      ctx.moveTo(osc[i].x, osc[i].y);
      ctx.lineTo(osc[j].x, osc[j].y);
      ctx.stroke();
    }
  }
  // order ring
  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, Math.PI*2*order);
  ctx.strokeStyle = `hsl(${order*120},80%,60%)`;
  ctx.lineWidth = 4;
  ctx.stroke();
}

// simple evolutionary coupling (main thread for reliability)
let pop = [];
function evolve() {
  if (pop.length < 4) {
    pop = Array(6).fill(0).map(() => K.map(row => row.map(v => v + (Math.random()-0.5)*0.1)));
  }
  // fitness: mode sync wants high order, desync wants low
  const fitness = (k) => {
    // quick sim of order under this K (approx current)
    return mode === 'sync' ? order : 1 - order;
  };
  pop.sort((a,b) => fitness(b) - fitness(a));
  // keep top, mutate
  const next = pop.slice(0, 3);
  while (next.length < 6) {
    const parent = next[Math.floor(Math.random()*3)];
    const child = parent.map(row => row.map(v => v + (Math.random()-0.5)*0.08));
    next.push(child);
  }
  pop = next;
  K = pop[0].map(row => [...row]); // apply best
}

async function seal() {
  const data = { osc: osc.map(o => ({θ:o.θ, ω:o.ω})), K, mode, order };
  const str = JSON.stringify(data);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(b => Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join(''));
  const db = await new Promise((res,rej) => {
    const r = indexedDB.open('kuramoto-mind', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seals');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('seals', 'readwrite');
  tx.objectStore('seals').put({ data, hash, t: Date.now() }, 'last');
  document.getElementById('status').textContent += ' | sealed';
}
async function restore() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('kuramoto-mind', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readonly');
    const req = tx.objectStore('seals').get('last');
    req.onsuccess = () => {
      if (req.result) {
        const d = req.result.data;
        osc.forEach((o,i) => { o.θ = d.osc[i].θ; o.ω = d.osc[i].ω; });
        K = d.K;
        mode = d.mode;
        document.getElementById('status').textContent = 'restored';
      }
    };
  } catch (e) { console.warn(e); }
}

document.getElementById('nucleate').onclick = init;
document.getElementById('sync').onclick = () => mode = 'sync';
document.getElementById('desync').onclick = () => mode = 'desync';
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('clear').onclick = () => { cards.forEach(c=>c.remove()); cards.length=0; osc=[]; };

init();
setInterval(() => step(), 16);
setInterval(evolve, 800);
