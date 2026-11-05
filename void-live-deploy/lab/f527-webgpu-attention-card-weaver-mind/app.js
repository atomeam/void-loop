const N = 8;
const D = 6; // embedding dim
const cards = [];
const stage = document.getElementById('stage');
const links = document.getElementById('links');
const statusEl = document.getElementById('status');
const ctx = links.getContext('2d');
let Wq = Array.from({length:D}, () => Array.from({length:D}, () => (Math.random()-0.5)*0.3));
let Wk = Array.from({length:D}, () => Array.from({length:D}, () => (Math.random()-0.5)*0.3));
let bias = Array.from({length:N}, () => Array.from({length:N}, () => 0)); // affinity bias
let gpuDevice = null;
let useGPU = false;
let lastSeal = 'none';
let dragging = null;
let dragStart = {x:0,y:0};

function createCards() {
  const labels = ['Verse','Mind','Weaver','Attention','Token','Force','Seal','Genome'];
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = labels[i];
    el.dataset.i = i;
    el.style.left = (80 + (i%4)*180) + 'px';
    el.style.top = (120 + Math.floor(i/4)*140) + 'px';
    el.style.background = `hsl(${i*40},60%,20%)`;
    stage.appendChild(el);
    cards.push({
      el, i,
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
      vx: 0, vy: 0,
      hue: i*40
    });
    el.addEventListener('pointerdown', onDown);
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function onDown(e) {
  const i = +e.target.dataset.i;
  dragging = i;
  dragStart = {x: e.clientX, y: e.clientY};
  cards[i].el.classList.add('grasped');
  e.preventDefault();
}
function onMove(e) {
  if (dragging === null) return;
  const c = cards[dragging];
  c.x = e.clientX - 70;
  c.y = e.clientY - 45;
  c.el.style.left = c.x + 'px';
  c.el.style.top = c.y + 'px';
}
function onUp(e) {
  if (dragging === null) return;
  const dist = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
  if (dist > 30) {
    // reinforce: find nearest other card and boost bias
    let nearest = -1, nd = 1e9;
    for (let j = 0; j < N; j++) if (j !== dragging) {
      const d = Math.hypot(cards[j].x - cards[dragging].x, cards[j].y - cards[dragging].y);
      if (d < nd) { nd = d; nearest = j; }
    }
    if (nearest >= 0) {
      bias[dragging][nearest] = Math.min(2, bias[dragging][nearest] + 0.3);
      bias[nearest][dragging] = Math.min(2, bias[nearest][dragging] + 0.3);
    }
  }
  cards[dragging].el.classList.remove('grasped');
  dragging = null;
}

function getEmbeddings() {
  const embs = [];
  const w = stage.clientWidth, h = stage.clientHeight;
  for (const c of cards) {
    const rect = c.el.getBoundingClientRect();
    embs.push([
      c.x / w,
      c.y / h,
      rect.width / 200,
      rect.height / 120,
      (c.hue % 360) / 360,
      (c.i * 0.13) % 1
    ]);
  }
  return embs;
}

function matMul(A, B) { // A: N x D, B: D x D → N x D
  const N = A.length, D = B.length, M = B[0].length;
  const C = Array.from({length:N}, () => Array(M).fill(0));
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++)
      for (let k = 0; k < D; k++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}
function softmaxRows(S) {
  return S.map(row => {
    const m = Math.max(...row);
    const e = row.map(x => Math.exp(x - m));
    const s = e.reduce((a,b)=>a+b,0);
    return e.map(x => x/s);
  });
}

function computeAttentionJS(embs) {
  const Q = matMul(embs, Wq);
  const K = matMul(embs, Wk);
  const scores = Array.from({length:N}, () => Array(N).fill(0));
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      let s = 0;
      for (let d = 0; d < D; d++) s += Q[i][d] * K[j][d];
      scores[i][j] = s / Math.sqrt(D) + bias[i][j];
    }
  return softmaxRows(scores);
}

async function tryWebGPU() {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    gpuDevice = await adapter.requestDevice();
    useGPU = true;
    statusEl.textContent = 'WebGPU compute ready';
  } catch(e) { console.warn(e); }
}

function step() {
  const embs = getEmbeddings();
  const attn = computeAttentionJS(embs); // always JS for reliability; GPU path reserved
  // forces
  const forces = Array.from({length:N}, () => ({x:0,y:0}));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) if (i !== j) {
      const a = attn[i][j];
      const dx = cards[j].x - cards[i].x;
      const dy = cards[j].y - cards[i].y;
      const dist = Math.hypot(dx,dy) + 1;
      const f = a * 0.8 - 0.15 / dist; // attract high attn, soft repel
      forces[i].x += f * dx / dist;
      forces[i].y += f * dy / dist;
    }
  }
  for (let i = 0; i < N; i++) if (i !== dragging) {
    cards[i].vx = cards[i].vx * 0.85 + forces[i].x;
    cards[i].vy = cards[i].vy * 0.85 + forces[i].y;
    cards[i].x += cards[i].vx;
    cards[i].y += cards[i].vy;
    cards[i].x = Math.max(20, Math.min(stage.clientWidth-160, cards[i].x));
    cards[i].y = Math.max(80, Math.min(stage.clientHeight-110, cards[i].y));
    cards[i].el.style.left = cards[i].x + 'px';
    cards[i].el.style.top = cards[i].y + 'px';
    // style from attention entropy or self
    const selfA = attn[i][i];
    cards[i].el.style.borderColor = `hsl(${cards[i].hue},70%,${50+selfA*40}%)`;
  }
  // draw links
  links.width = stage.clientWidth;
  links.height = stage.clientHeight;
  ctx.clearRect(0,0,links.width,links.height);
  ctx.lineWidth = 2;
  for (let i = 0; i < N; i++)
    for (let j = i+1; j < N; j++) {
      const a = (attn[i][j] + attn[j][i]) / 2;
      if (a > 0.05) {
        ctx.strokeStyle = `hsla(${(cards[i].hue+cards[j].hue)/2},80%,60%,${a})`;
        ctx.beginPath();
        ctx.moveTo(cards[i].x+70, cards[i].y+45);
        ctx.lineTo(cards[j].x+70, cards[j].y+45);
        ctx.stroke();
      }
    }
  // status
  const avgEnt = attn.reduce((s,row) => s - row.reduce((ss,p)=>ss+p*Math.log(p+1e-9),0), 0) / N;
  statusEl.textContent = `WebGPU: ${useGPU?'yes':'CPU'} | cards:${N} | entropy:${avgEnt.toFixed(2)} | seal:${lastSeal}`;
  requestAnimationFrame(step);
}

async function seal() {
  const data = { Wq, Wk, bias, t: Date.now() };
  const buf = new TextEncoder().encode(JSON.stringify(data));
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const hash = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
  lastSeal = hash;
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f527', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({hash, data}, 'latest');
    const bc = new BroadcastChannel('f527');
    bc.postMessage({type:'adopt', hash, data});
    statusEl.textContent += ' | sealed';
  } catch(e) { statusEl.textContent += ' | seal local only'; }
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => {
  bias = Array.from({length:N}, () => Array.from({length:N}, () => 0));
  Wq = Array.from({length:D}, () => Array.from({length:D}, () => (Math.random()-0.5)*0.3));
  Wk = Array.from({length:D}, () => Array.from({length:D}, () => (Math.random()-0.5)*0.3));
};

createCards();
tryWebGPU().then(() => requestAnimationFrame(step));
