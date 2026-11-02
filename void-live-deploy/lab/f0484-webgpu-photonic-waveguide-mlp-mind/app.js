const N = 64;
const DT = 0.18;
const DX = 1;
const cards = [
  { id: 'NW', x: 8, y: 8, el: null },
  { id: 'NE', x: 55, y: 8, el: null },
  { id: 'SW', x: 8, y: 55, el: null },
  { id: 'SE', x: 55, y: 55, el: null }
];
let u = new Float32Array(N*N), uPrev = new Float32Array(N*N), cMap = new Float32Array(N*N).fill(0.8);
let agents = [];
let pointer = { x: N/2, y: N/2, down: false };
let idb = null;
const statusEl = document.getElementById('status');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
const receivers = document.getElementById('receivers');

function idx(x,y){ return y*N + x; }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

// Tiny MLP: 4 -> 8 -> 4
function makeMLP() {
  const w1 = Array.from({length: 4*8}, () => (Math.random()-0.5)*0.4);
  const b1 = Array.from({length: 8}, () => 0);
  const w2 = Array.from({length: 8*4}, () => (Math.random()-0.5)*0.4);
  const b2 = Array.from({length: 4}, () => 0);
  return { w1, b1, w2, b2, fitness: 0, cx: 0, cy: 0 };
}
function mlpForward(m, inp) {
  const h = new Array(8).fill(0);
  for (let i=0;i<8;i++) {
    let s = m.b1[i];
    for (let j=0;j<4;j++) s += inp[j] * m.w1[j*8 + i];
    h[i] = Math.tanh(s);
  }
  const o = new Array(4).fill(0);
  for (let i=0;i<4;i++) {
    let s = m.b2[i];
    for (let j=0;j<8;j++) s += h[j] * m.w2[j*4 + i];
    o[i] = Math.tanh(s) * 0.15;
  }
  return o;
}
function mutate(m, rate=0.08) {
  const nm = JSON.parse(JSON.stringify(m));
  for (let k of ['w1','b1','w2','b2']) {
    nm[k] = nm[k].map(v => v + (Math.random()-0.5)*rate);
  }
  nm.fitness = 0;
  return nm;
}

function initAgents() {
  agents = [makeMLP(), makeMLP(), makeMLP(), makeMLP()];
  agents.forEach((a,i) => {
    a.cx = [N*0.25, N*0.75, N*0.25, N*0.75][i];
    a.cy = [N*0.25, N*0.25, N*0.75, N*0.75][i];
  });
}
initAgents();

function updateDielectric() {
  const stats = [0,0,0,0];
  let tot = 0;
  for (let i=0;i<N*N;i++) { const v=Math.abs(u[i]); tot+=v; stats[Math.floor(i/(N*N/4))]+=v; }
  const base = [pointer.x/N, pointer.y/N, tot/(N*N), 0.5];
  agents.forEach((a, qi) => {
    const inp = [base[0], base[1], base[2], qi/4];
    const delta = mlpForward(a, inp);
    const qx = (qi%2)*N/2, qy = Math.floor(qi/2)*N/2;
    for (let dy=0; dy<N/2; dy++) for (let dx=0; dx<N/2; dx++) {
      const x = Math.floor(qx+dx), y = Math.floor(qy+dy);
      const i = idx(x,y);
      cMap[i] = clamp(0.4 + delta[0]*0.6 + Math.sin(x*0.2+delta[1])*0.1, 0.25, 1.4);
    }
    a.fitness = stats[qi] * 0.01 + (1 / (1 + Math.hypot(a.cx-pointer.x, a.cy-pointer.y)));
  });
  // genome transfer on proximity
  for (let i=0;i<agents.length;i++) for (let j=i+1;j<agents.length;j++) {
    if (Math.hypot(agents[i].cx-agents[j].cx, agents[i].cy-agents[j].cy) < 12) {
      const stronger = agents[i].fitness > agents[j].fitness ? agents[i] : agents[j];
      const weaker = stronger === agents[i] ? agents[j] : agents[i];
      Object.assign(weaker, mutate(stronger, 0.06));
      weaker.cx = stronger.cx + (Math.random()-0.5)*4;
      weaker.cy = stronger.cy + (Math.random()-0.5)*4;
    }
  }
}

function stepWave() {
  const uNext = new Float32Array(N*N);
  for (let y=1; y<N-1; y++) for (let x=1; x<N-1; x++) {
    const i = idx(x,y);
    const c2 = cMap[i]*cMap[i];
    const lap = u[idx(x-1,y)] + u[idx(x+1,y)] + u[idx(x,y-1)] + u[idx(x,y+1)] - 4*u[i];
    uNext[i] = 2*u[i] - uPrev[i] + c2 * DT*DT * lap / (DX*DX);
    uNext[i] *= 0.995; // mild damping
  }
  if (pointer.down) {
    const ix = clamp(Math.floor(pointer.x), 2, N-3);
    const iy = clamp(Math.floor(pointer.y), 2, N-3);
    uNext[idx(ix,iy)] += 0.8;
  }
  uPrev.set(u); u.set(uNext);
}

function draw() {
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const sx = w / N, sy = h / N;
  for (let y=0; y<N; y++) for (let x=0; x<N; x++) {
    const v = u[idx(x,y)];
    const mag = Math.min(1, Math.abs(v)*3);
    const r = mag * 80, g = mag * 160 + cMap[idx(x,y)]*40, b = mag * 255;
    for (let dy=0; dy<sy; dy++) for (let dx=0; dx<sx; dx++) {
      const px = Math.floor(x*sx + dx), py = Math.floor(y*sy + dy);
      if (px>=w || py>=h) continue;
      const p = (py*w + px)*4;
      data[p]=r; data[p+1]=g; data[p+2]=b; data[p+3]=255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // update cards
  cards.forEach(cd => {
    const intensity = Math.abs(u[idx(cd.x, cd.y)]);
    cd.el.style.setProperty('--glow', Math.min(1, intensity*2.5).toFixed(3));
    cd.el.querySelector('span').textContent = cd.id + ' ' + intensity.toFixed(2);
  });
}

function loop() {
  updateDielectric();
  stepWave();
  draw();
  requestAnimationFrame(loop);
}

function resize() {
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width; canvas.height = r.height;
}
window.addEventListener('resize', resize);
resize();

// cards
cards.forEach(cd => {
  const el = document.createElement('div');
  el.className = 'card';
  el.style.left = (cd.x / N * 100) + '%';
  el.style.top = (cd.y / N * 100) + '%';
  el.innerHTML = `<span>${cd.id}</span>`;
  receivers.appendChild(el);
  cd.el = el;
});

// pointer
function setPtr(e) {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * N;
  pointer.y = ((e.clientY - r.top) / r.height) * N;
}
canvas.addEventListener('pointerdown', e => { pointer.down = true; setPtr(e); canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', setPtr);
canvas.addEventListener('pointerup', () => pointer.down = false);
canvas.addEventListener('pointercancel', () => pointer.down = false);

// IDB
function openIDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('f0484-photonic', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('seal');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function seal() {
  if (!idb) idb = await openIDB();
  const tx = idb.transaction('seal', 'readwrite');
  tx.objectStore('seal').put({
    cMap: Array.from(cMap),
    u: Array.from(u),
    agents: agents.map(a => ({...a, w1:[...a.w1], b1:[...a.b1], w2:[...a.w2], b2:[...a.b2]})),
    t: Date.now()
  }, 'main');
  statusEl.textContent = 'Sealed to IDB';
}
async function restore() {
  if (!idb) idb = await openIDB();
  const tx = idb.transaction('seal', 'readonly');
  const req = tx.objectStore('seal').get('main');
  req.onsuccess = () => {
    const d = req.result;
    if (!d) { statusEl.textContent = 'No seal'; return; }
    cMap.set(d.cMap); u.set(d.u); uPrev.set(d.u);
    agents = d.agents;
    statusEl.textContent = 'Restored from IDB';
  };
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('reset').onclick = () => { u.fill(0); uPrev.fill(0); statusEl.textContent = 'Field reset'; };
document.addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') seal();
  if (e.key === 'r' || e.key === 'R') restore();
});

// WebGPU probe (optional enhancement path; falls back silently)
if (navigator.gpu) {
  navigator.gpu.requestAdapter().then(a => {
    if (a) statusEl.textContent = 'WebGPU available · Canvas2D active (compute path reserved)';
  }).catch(()=>{});
}

loop();
