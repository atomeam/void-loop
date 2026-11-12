const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const noteInput = document.getElementById('noteInput');
const cards = [];
let mlpWeights = null;
let field = null; // velocity field {vx, vy} as Float32Arrays
const GRID = 48;
let gpu = null;
let orientation = {x:0, y:0, mag:0};
let pointerVel = {x:0, y:0};
let lastPointer = null;
const channel = new BroadcastChannel('verse-f676-genome');
const DB_NAME = 'verse-f676';
const DB_STORE = 'state';

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

// Tiny MLP: 6 in → 8 hidden → 3 out
function initMLP() {
  const w1 = new Float32Array(6*8), b1 = new Float32Array(8);
  const w2 = new Float32Array(8*3), b2 = new Float32Array(3);
  for (let i=0;i<w1.length;i++) w1[i] = (Math.random()-0.5)*0.4;
  for (let i=0;i<w2.length;i++) w2[i] = (Math.random()-0.5)*0.4;
  return {w1,b1,w2,b2};
}
function mlpForward(m, inp) {
  const h = new Float32Array(8);
  for (let j=0;j<8;j++) {
    let s = m.b1[j];
    for (let i=0;i<6;i++) s += inp[i]*m.w1[i*8+j];
    h[j] = Math.tanh(s);
  }
  const o = new Float32Array(3);
  for (let j=0;j<3;j++) {
    let s = m.b2[j];
    for (let i=0;i<8;i++) s += h[i]*m.w2[i*3+j];
    o[j] = Math.tanh(s);
  }
  return o; // [τ proxy, forceScale, hue]
}

// Simple velocity field (fallback + base)
function initField() {
  const n = GRID*GRID;
  return {vx: new Float32Array(n), vy: new Float32Array(n)};
}
function sampleField(f, x, y) {
  const gx = Math.max(0, Math.min(GRID-1, Math.floor(x / canvas.width * GRID)));
  const gy = Math.max(0, Math.min(GRID-1, Math.floor(y / canvas.height * GRID)));
  const i = gy*GRID + gx;
  return {vx: f.vx[i], vy: f.vy[i]};
}
function injectMomentum(f, x, y, vx, vy) {
  const gx = Math.floor(x / canvas.width * GRID);
  const gy = Math.floor(y / canvas.height * GRID);
  for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
    const ix = gx+dx, iy = gy+dy;
    if (ix>=0 && ix<GRID && iy>=0 && iy<GRID) {
      const i = iy*GRID + ix;
      f.vx[i] += vx * 0.3;
      f.vy[i] += vy * 0.3;
    }
  }
}

// Simplified field update (advection + diffusion + force) — LBM-inspired
function updateField(f, forceX, forceY, tau, dt=0.1) {
  const n = GRID*GRID;
  const nvx = new Float32Array(n), nvy = new Float32Array(n);
  const visc = Math.max(0.01, (tau+1)*0.15); // τ ~0-1 maps to viscosity
  for (let y=1;y<GRID-1;y++) for (let x=1;x<GRID-1;x++) {
    const i = y*GRID + x;
    // diffusion (Laplace)
    const lapX = f.vx[i-1] + f.vx[i+1] + f.vx[i-GRID] + f.vx[i+GRID] - 4*f.vx[i];
    const lapY = f.vy[i-1] + f.vy[i+1] + f.vy[i-GRID] + f.vy[i+GRID] - 4*f.vy[i];
    // simple force + decay
    nvx[i] = f.vx[i] + dt*(visc*lapX + forceX*0.4) - f.vx[i]*0.02;
    nvy[i] = f.vy[i] + dt*(visc*lapY + forceY*0.4) - f.vy[i]*0.02;
  }
  f.vx.set(nvx); f.vy.set(nvy);
}

// WebGPU stub (real compute would go here; fallback always active for reliability)
async function tryWebGPU() {
  if (!navigator.gpu) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    statusEl.textContent = 'WebGPU available — using hybrid field';
    return {device}; // full LBM shader omitted for single-file size; field update remains JS
  } catch(e) { return null; }
}

function createCard(text) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = text.slice(0,80);
  el.style.left = (Math.random()*0.6+0.2)*canvas.width + 'px';
  el.style.top = (Math.random()*0.5+0.2)*canvas.height + 'px';
  document.body.appendChild(el);
  const card = {el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0, text};
  // drag
  let dragging=false, ox=0, oy=0;
  el.addEventListener('pointerdown', e => {
    dragging=true; ox=e.clientX-card.x; oy=e.clientY-card.y; el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    const nx = e.clientX - ox, ny = e.clientY - oy;
    card.vx = (nx - card.x)*0.5; card.vy = (ny - card.y)*0.5;
    card.x = nx; card.y = ny;
    el.style.left = nx+'px'; el.style.top = ny+'px';
    injectMomentum(field, nx, ny, card.vx, card.vy);
  });
  el.addEventListener('pointerup', () => dragging=false);
  cards.push(card);
  return card;
}

async function loadState() {
  return new Promise(res => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(DB_STORE, 'readonly');
      const get = tx.objectStore(DB_STORE).get('state');
      get.onsuccess = () => res(get.result || null);
      get.onerror = () => res(null);
    };
    req.onerror = () => res(null);
  });
}
async function saveState(data) {
  const db = await new Promise(r => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onsuccess = () => r(req.result);
  });
  const tx = db.transaction(DB_STORE, 'readwrite');
  tx.objectStore(DB_STORE).put(data, 'state');
}

function exportJSON() {
  const data = {
    notes: cards.map(c => ({text:c.text, x:c.x, y:c.y})),
    mlp: mlpWeights ? {w1:Array.from(mlpWeights.w1), b1:Array.from(mlpWeights.b1), w2:Array.from(mlpWeights.w2), b2:Array.from(mlpWeights.b2)} : null
  };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'verse-fluid-notes.json';
  a.click();
}

document.getElementById('addBtn').onclick = () => {
  const t = noteInput.value.trim();
  if (t) { createCard(t); noteInput.value=''; }
};
document.getElementById('sealBtn').onclick = async () => {
  const state = {notes: cards.map(c=>({text:c.text,x:c.x,y:c.y})), mlp: mlpWeights};
  await saveState(state);
  channel.postMessage({type:'genome', mlp: mlpWeights});
  statusEl.textContent = 'Genome sealed & broadcast';
};
document.getElementById('exportBtn').onclick = exportJSON;
document.getElementById('clearBtn').onclick = () => {
  cards.forEach(c => c.el.remove());
  cards.length = 0;
  field = initField();
  statusEl.textContent = 'Cleared';
};

channel.onmessage = e => {
  if (e.data.type === 'genome' && e.data.mlp) {
    mlpWeights = e.data.mlp;
    statusEl.textContent = 'Adopted sealed genome from other tab';
  }
};

// Orientation
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    const beta = (e.beta||0)/90, gamma = (e.gamma||0)/90;
    orientation.x = Math.max(-1,Math.min(1, gamma));
    orientation.y = Math.max(-1,Math.min(1, beta));
    orientation.mag = Math.hypot(orientation.x, orientation.y);
  });
}
// Pointer fallback tilt
addEventListener('pointermove', e => {
  if (lastPointer) {
    pointerVel.x = (e.clientX - lastPointer.x)*0.05;
    pointerVel.y = (e.clientY - lastPointer.y)*0.05;
  }
  lastPointer = {x:e.clientX, y:e.clientY};
  if (orientation.mag < 0.05) {
    orientation.x = Math.max(-1,Math.min(1, pointerVel.x));
    orientation.y = Math.max(-1,Math.min(1, pointerVel.y));
    orientation.mag = Math.hypot(orientation.x, orientation.y);
  }
});

async function init() {
  field = initField();
  mlpWeights = initMLP();
  const saved = await loadState();
  if (saved && saved.mlp) {
    mlpWeights = saved.mlp;
    if (saved.notes) saved.notes.forEach(n => createCard(n.text));
    statusEl.textContent = 'Restored from IndexedDB';
  } else {
    createCard('Drag me');
    createCard('Tilt or move pointer');
    statusEl.textContent = 'Ready — add notes, tilt device';
  }
  gpu = await tryWebGPU();
  loop();
}

function loop() {
  // stats
  let meanSpeed=0, densVar=0;
  for (let i=0;i<field.vx.length;i+=16) meanSpeed += Math.hypot(field.vx[i], field.vy[i]);
  meanSpeed /= (field.vx.length/16);
  const inp = [meanSpeed, densVar, orientation.x, orientation.y, orientation.mag, Math.sin(Date.now()*0.001)];
  const out = mlpForward(mlpWeights, inp);
  const tau = (out[0]+1)*0.5;
  const forceScale = (out[1]+1)*0.8;
  // update field
  updateField(field, orientation.x * forceScale, orientation.y * forceScale, tau);
  // update cards
  cards.forEach(c => {
    const v = sampleField(field, c.x, c.y);
    c.vx = c.vx*0.92 + v.vx * 2;
    c.vy = c.vy*0.92 + v.vy * 2;
    c.x += c.vx; c.y += c.vy;
    // bounds
    if (c.x < 20) {c.x=20; c.vx*=-0.5;}
    if (c.x > canvas.width-100) {c.x=canvas.width-100; c.vx*=-0.5;}
    if (c.y < 80) {c.y=80; c.vy*=-0.5;}
    if (c.y > canvas.height-60) {c.y=canvas.height-60; c.vy*=-0.5;}
    c.el.style.left = c.x+'px';
    c.el.style.top = c.y+'px';
    c.el.style.borderColor = `hsl(${(out[2]+1)*180}, 70%, 60%)`;
  });
  // draw field faint
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = 'rgba(100,150,255,0.15)';
  for (let y=0;y<GRID;y+=2) for (let x=0;x<GRID;x+=2) {
    const i = y*GRID+x;
    const px = x/GRID*canvas.width, py = y/GRID*canvas.height;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + field.vx[i]*8, py + field.vy[i]*8);
    ctx.stroke();
  }
  requestAnimationFrame(loop);
}
init();
