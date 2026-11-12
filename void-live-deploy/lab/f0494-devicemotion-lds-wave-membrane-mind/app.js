const cv = document.getElementById('cv');
const statusEl = document.getElementById('status');
let W = 64, H = 64;
cv.width = W; cv.height = H;
cv.style.width = '100vw'; cv.style.height = '100vh';

// LDS: state dim 4, input 3
let state = [0,0,0,0];
let A = Array.from({length:4}, () => Array.from({length:4}, () => (Math.random()-0.5)*0.3));
let B = Array.from({length:4}, () => Array.from({length:3}, () => (Math.random()-0.5)*0.2));
let fitness = 0;

function updateLDS(u) {
  const next = [0,0,0,0];
  for (let i=0; i<4; i++) {
    for (let j=0; j<4; j++) next[i] += A[i][j] * state[j];
    for (let k=0; k<3; k++) next[i] += B[i][k] * u[k];
  }
  state = next.map(v => Math.tanh(v));
}

function rewardUpdate(u, r) {
  // light outer-product style adaptation
  for (let i=0; i<4; i++) {
    for (let j=0; j<4; j++) A[i][j] += r * 0.001 * state[i] * state[j];
    for (let k=0; k<3; k++) B[i][k] += r * 0.001 * state[i] * u[k];
  }
  fitness += r;
}

// Wave fields (fallback canvas)
let disp = new Float32Array(W*H);
let vel = new Float32Array(W*H);
function waveStep(speed, damp, sourceAmp, sourceX, sourceY, membranes) {
  const nd = new Float32Array(W*H);
  for (let y=1; y<H-1; y++) for (let x=1; x<W-1; x++) {
    const i = y*W + x;
    const lap = disp[i-1] + disp[i+1] + disp[i-W] + disp[i+W] - 4*disp[i];
    let d = damp;
    for (const m of membranes) {
      const mx = (m.x / window.innerWidth) * W;
      const my = (m.y / window.innerHeight) * H;
      if (Math.abs(x - mx) < 4 && Math.abs(y - my) < 3) d += 0.15;
    }
    vel[i] = (vel[i] + speed * lap) * (1 - d);
    nd[i] = disp[i] + vel[i];
  }
  // source
  const si = Math.floor(sourceY)*W + Math.floor(sourceX);
  if (si >=0 && si < W*H) nd[si] += sourceAmp * Math.sin(performance.now()*0.01);
  disp.set(nd);
}

function sampleEnergy(m) {
  const mx = Math.floor((m.x / window.innerWidth) * W);
  const my = Math.floor((m.y / window.innerHeight) * H);
  let e = 0, c=0;
  for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
    const x=mx+dx, y=my+dy;
    if (x>0 && x<W-1 && y>0 && y<H-1) { e += Math.abs(disp[y*W+x]); c++; }
  }
  return c ? e/c : 0;
}

// Membranes
const membranes = [];
function createMembrane(id, x, y) {
  const el = document.createElement('div');
  el.className = 'membrane';
  el.textContent = 'Membrane ' + id;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  let drag = false, ox=0, oy=0;
  el.addEventListener('pointerdown', e => { drag=true; ox=e.clientX - parseFloat(el.style.left); oy=e.clientY - parseFloat(el.style.top); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!drag) return; el.style.left = (e.clientX - ox) + 'px'; el.style.top = (e.clientY - oy) + 'px'; });
  el.addEventListener('pointerup', () => drag=false);
  const m = {el, get x(){return parseFloat(el.style.left)||0;}, get y(){return parseFloat(el.style.top)||0;}};
  membranes.push(m);
  return m;
}
createMembrane(1, 100, 150);
createMembrane(2, 300, 250);
createMembrane(3, 500, 180);

// Sensors
let acc = [0,0,0];
let useMotion = false;
if (window.DeviceMotionEvent) {
  window.addEventListener('devicemotion', e => {
    if (e.accelerationIncludingGravity) {
      acc = [e.accelerationIncludingGravity.x||0, e.accelerationIncludingGravity.y||0, e.accelerationIncludingGravity.z||0];
      useMotion = true;
    }
  });
}
let px=0, py=0, pvx=0, pvy=0;
window.addEventListener('pointermove', e => {
  pvx = (e.clientX - px)*0.05; pvy = (e.clientY - py)*0.05;
  px = e.clientX; py = e.clientY;
  if (!useMotion) acc = [pvx, pvy, 0];
});

// Persistence
const dbName = 'f0494';
let db;
const req = indexedDB.open(dbName, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genome');
req.onsuccess = e => { db = e.target.result; loadGenome(); };
function loadGenome() {
  if (!db) return;
  const tx = db.transaction('genome','readonly');
  const g = tx.objectStore('genome').get('lds');
  g.onsuccess = () => {
    if (g.result) {
      A = g.result.A; B = g.result.B; fitness = g.result.fitness || 0;
      statusEl.textContent += '\nLoaded genome fitness ' + fitness.toFixed(2);
    }
  };
}
function seal() {
  if (!db) return;
  const data = {A, B, fitness, ts: Date.now()};
  const tx = db.transaction('genome','readwrite');
  tx.objectStore('genome').put(data, 'lds');
  bc.postMessage(data);
  statusEl.textContent = 'Sealed fitness ' + fitness.toFixed(2);
}
const bc = new BroadcastChannel('f0494-genome');
bc.onmessage = e => {
  if (e.data.fitness > fitness) {
    A = e.data.A; B = e.data.B; fitness = e.data.fitness;
    statusEl.textContent = 'Adopted better genome ' + fitness.toFixed(2);
  }
};
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { state=[0,0,0,0]; fitness=0; disp.fill(0); vel.fill(0); };

// Render
const ctx = cv.getContext('2d');
function render() {
  const img = ctx.createImageData(W, H);
  for (let i=0; i<W*H; i++) {
    const v = Math.max(-1, Math.min(1, disp[i]*2));
    const c = v > 0 ? [100+v*155, 150, 255-v*100] : [50, 100+Math.abs(v)*155, 200];
    img.data[i*4] = c[0]; img.data[i*4+1] = c[1]; img.data[i*4+2] = c[2]; img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// Main loop
function loop() {
  const u = acc.map(v => Math.tanh(v * 0.1));
  updateLDS(u);
  const speed = 0.15 + Math.abs(state[0])*0.1;
  const damp = 0.02 + Math.abs(state[1])*0.03;
  const amp = 0.5 + Math.abs(state[2])*0.5;
  const sx = W/2 + state[3]*10;
  const sy = H/2;
  waveStep(speed, damp, amp, sx, sy, membranes);
  let totalR = 0;
  membranes.forEach(m => {
    const e = sampleEnergy(m);
    totalR += e;
    m.el.style.opacity = 0.3 + Math.min(0.7, e*2);
    m.el.style.borderColor = e > 0.3 ? '#ff80ff' : '#80c0ff';
  });
  if (totalR > 0.1) rewardUpdate(u, totalR * 0.1);
  statusEl.textContent = `State: ${state.map(s=>s.toFixed(2)).join(' ')}\nAcc: ${acc.map(a=>a.toFixed(1)).join(' ')}\nFitness: ${fitness.toFixed(2)}\nMotion: ${useMotion?'yes':'pointer proxy'}`;
  render();
  requestAnimationFrame(loop);
}
loop();
