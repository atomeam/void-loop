const N = 32, RES = 64;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W, H, phases = new Float32Array(N*N), omegas = new Float32Array(N*N), K = 0.8;
let reservoir = new Float32Array(RES), Win = new Float32Array(RES*3), Wrec = new Float32Array(RES*RES);
let readout = [0.5, 0.8]; // ω_mean, K
let portals = [];
let lastT = 0, order = 0;
let useWebGPU = false, device, pipeline, phaseBuf;

function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize); resize();

// Init reservoir (sparse random)
function initReservoir() {
  for (let i = 0; i < RES*3; i++) Win[i] = (Math.random()-0.5)*0.5;
  for (let i = 0; i < RES; i++) for (let j = 0; j < RES; j++)
    if (Math.random() < 0.1) Wrec[i*RES+j] = (Math.random()-0.5)*0.8;
  // spectral radius rough scale
  for (let i = 0; i < RES*RES; i++) Wrec[i] *= 0.9;
  reservoir.fill(0);
}
initReservoir();

function initLattice() {
  for (let i = 0; i < N*N; i++) {
    phases[i] = Math.random()*Math.PI*2;
    omegas[i] = (Math.random()-0.5)*0.4;
  }
}
initLattice();

// Portals
const portalEl = document.getElementById('portals');
for (let i = 0; i < 4; i++) {
  const d = document.createElement('div');
  d.className = 'portal';
  d.textContent = 'Portal '+(i+1);
  portalEl.appendChild(d);
  portals.push({el:d, qx: (i%2)*0.6+0.2, qy: Math.floor(i/2)*0.6+0.2, r:0, genome: readout.slice()});
}

function stepReservoir(input) { // input [dx, dy, tilt]
  const x = new Float32Array(RES);
  for (let i = 0; i < RES; i++) {
    let s = Win[i*3]*input[0] + Win[i*3+1]*input[1] + Win[i*3+2]*input[2];
    for (let j = 0; j < RES; j++) s += Wrec[i*RES+j] * reservoir[j];
    x[i] = Math.tanh(s);
  }
  for (let i = 0; i < RES; i++) reservoir[i] = 0.85*reservoir[i] + 0.15*x[i];
  // readout (simple linear on first 8 units)
  let o0=0, o1=0;
  for (let i = 0; i < 8; i++) { o0 += reservoir[i]*0.3; o1 += reservoir[i+8]*0.2; }
  readout[0] = Math.max(0.1, Math.min(1.5, 0.6 + o0));
  readout[1] = Math.max(0.2, Math.min(2.0, 0.8 + o1));
}

function kuramotoStep(dt) {
  const next = new Float32Array(phases.length);
  const dx = 1/N;
  for (let y=0; y<N; y++) for (let x=0; x<N; x++) {
    const i = y*N+x;
    let sumSin = 0, cnt=0;
    for (let dy=-1; dy<=1; dy++) for (let dx_=-1; dx_<=1; dx_++) {
      if (dx_===0 && dy===0) continue;
      const nx = (x+dx_+N)%N, ny=(y+dy+N)%N;
      sumSin += Math.sin(phases[ny*N+nx] - phases[i]);
      cnt++;
    }
    next[i] = phases[i] + dt * (omegas[i]*readout[0] + (K*readout[1]/cnt)*sumSin);
  }
  phases.set(next);
}

function computeOrder() {
  let sx=0, sy=0;
  for (let i=0; i<phases.length; i++) { sx += Math.cos(phases[i]); sy += Math.sin(phases[i]); }
  order = Math.hypot(sx, sy)/phases.length;
  document.documentElement.style.setProperty('--order', order.toFixed(3));
  document.documentElement.style.setProperty('--hue', (200 + order*160)|0);
}

function localOrder(qx, qy) {
  const cx = (qx*N)|0, cy = (qy*N)|0, rad=4;
  let sx=0, sy=0, n=0;
  for (let y=Math.max(0,cy-rad); y<Math.min(N,cy+rad); y++)
    for (let x=Math.max(0,cx-rad); x<Math.min(N,cx+rad); x++) {
      const p = phases[y*N+x]; sx += Math.cos(p); sy += Math.sin(p); n++;
    }
  return n ? Math.hypot(sx,sy)/n : 0;
}

function updatePortals() {
  portals.forEach(p => {
    p.r = localOrder(p.qx, p.qy);
    const scale = 0.7 + p.r*0.8;
    const hue = 200 + p.r*160;
    p.el.style.transform = `translate(${p.qx*W-45}px, ${p.qy*H-35}px) scale(${scale})`;
    p.el.style.borderColor = `hsl(${hue},70%,60%)`;
    p.el.style.boxShadow = `0 0 ${10+p.r*30}px hsl(${hue},80%,50%)`;
  });
  // coherence transfer
  for (let i=0; i<portals.length; i++) for (let j=i+1; j<portals.length; j++) {
    if (portals[i].r > 0.75 && portals[j].r < 0.5) {
      portals[j].genome = portals[i].genome.map(v => v + (Math.random()-0.5)*0.1);
      portals[j].r = portals[i].r * 0.8;
    }
  }
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const cell = Math.min(W,H)/N * 0.9;
  const ox = (W - cell*N)/2, oy = (H - cell*N)/2;
  for (let y=0; y<N; y++) for (let x=0; x<N; x++) {
    const p = phases[y*N+x];
    const hue = ((p*180/Math.PI)+360)%360;
    ctx.fillStyle = `hsl(${hue},70%,${40+order*30}%)`;
    ctx.fillRect(ox+x*cell, oy+y*cell, cell-1, cell-1);
  }
}

// Input
let px=0, py=0, tilt=0, lastX=0, lastY=0;
function onMove(e) {
  const x = e.clientX||e.touches?.[0]?.clientX||0;
  const y = e.clientY||e.touches?.[0]?.clientY||0;
  const dx = (x-lastX)/W, dy = (y-lastY)/H;
  lastX=x; lastY=y;
  stepReservoir([dx*10, dy*10, tilt]);
}
addEventListener('pointermove', onMove);
addEventListener('touchmove', onMove, {passive:true});
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => { tilt = (e.gamma||0)/90; });
}

// WebXR hand stub (permissioned; fallback always works)
let xrSession = null;
async function tryXR() {
  if (!navigator.xr) return;
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-vr');
    if (!ok) return;
    // In a real session we would request hands; here we note availability
    document.getElementById('status').textContent += ' | WebXR available (hand pose stub)';
  } catch(e) {}
}
tryXR();

// Loop
function loop(t) {
  const dt = Math.min(0.05, (t-lastT)/1000 || 0.016);
  lastT = t;
  kuramotoStep(dt);
  computeOrder();
  updatePortals();
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Seal / Restore
const DB = 'verse-f0485';
async function seal() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open(DB,1);
      r.onupgradeneeded = () => r.result.createObjectStore('state');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('state','readwrite');
    tx.objectStore('state').put({phases:Array.from(phases), reservoir:Array.from(reservoir), readout, portals:portals.map(p=>({qx:p.qx,qy:p.qy,genome:p.genome}))}, 'main');
    document.getElementById('status').textContent = 'Sealed to IndexedDB';
  } catch(e) { document.getElementById('status').textContent = 'Seal failed (IDB)'; }
}
async function restore() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open(DB,1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('state','readonly');
    const req = tx.objectStore('state').get('main');
    req.onsuccess = () => {
      const d = req.result;
      if (!d) return;
      phases.set(d.phases);
      reservoir.set(d.reservoir);
      readout = d.readout;
      d.portals.forEach((p,i) => { if (portals[i]) { portals[i].qx=p.qx; portals[i].qy=p.qy; portals[i].genome=p.genome; } });
      document.getElementById('status').textContent = 'Restored from IndexedDB';
    };
  } catch(e) {}
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('reset').onclick = () => { initLattice(); initReservoir(); };
document.getElementById('kick').onclick = () => { for (let i=0;i<20;i++) phases[(Math.random()*N*N)|0] += Math.PI; };
addEventListener('keydown', e => { if (e.key==='s'||e.key==='S') seal(); if (e.key==='r'||e.key==='R') restore(); });

document.getElementById('status').textContent = 'Move pointer or tilt. Order parameter drives portals. S/R seal.';
