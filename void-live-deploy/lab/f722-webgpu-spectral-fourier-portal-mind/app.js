const canvas = document.getElementById('wave');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 48;
const grid = new Float32Array(N*N);
const prev = new Float32Array(N*N);
const signal = new Float32Array(64);
let sigIdx = 0;
let portals = [];
let ori = {beta:0, gamma:0};
let pointer = {x:W/2, y:H/2, vx:0, vy:0};
let spectralEnergy = 0.3;
let dominantPhase = 0;

function requestOri() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') window.addEventListener('deviceorientation', onOri);
    }).catch(()=>{});
  } else {
    window.addEventListener('deviceorientation', onOri);
  }
}
function onOri(e) {
  ori.beta = (e.beta||0)/90;
  ori.gamma = (e.gamma||0)/90;
}
document.getElementById('oriBtn').onclick = requestOri;

window.addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.x;
  pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

function addPortal(x = W*Math.random(), y = H*Math.random(), text = 'Spectral note') {
  const el = document.createElement('div');
  el.className = 'portal';
  el.contentEditable = true;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  portalsEl.appendChild(el);
  const p = {el, x, y, vx:0, vy:0};
  portals.push(p);
  makeDraggable(p);
  return p;
}
function makeDraggable(p) {
  let dragging = false, ox, oy;
  p.el.addEventListener('pointerdown', e => {
    dragging = true;
    ox = e.clientX - p.x; oy = e.clientY - p.y;
    e.stopPropagation();
  });
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    p.x = e.clientX - ox;
    p.y = e.clientY - oy;
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
  });
  window.addEventListener('pointerup', () => {
    if (dragging) {
      // inject spectral impulse
      signal[sigIdx] += 0.5;
      dragging = false;
    }
  });
}

function dft() {
  const M = 64;
  let maxAmp = 0, phase = 0;
  for (let k = 1; k < M/4; k++) {
    let re=0, im=0;
    for (let n=0; n<M; n++) {
      const ang = -2*Math.PI*k*n/M;
      re += signal[n] * Math.cos(ang);
      im += signal[n] * Math.sin(ang);
    }
    const amp = Math.sqrt(re*re + im*im)/M;
    if (amp > maxAmp) { maxAmp = amp; phase = Math.atan2(im, re); }
  }
  spectralEnergy = Math.min(1, maxAmp * 8);
  dominantPhase = phase;
}

function stepWave() {
  const c2 = 0.15;
  const damp = 0.992;
  for (let y=1; y<N-1; y++) {
    for (let x=1; x<N-1; x++) {
      const i = y*N + x;
      const lap = grid[i-1] + grid[i+1] + grid[i-N] + grid[i+N] - 4*grid[i];
      prev[i] = grid[i];
      grid[i] = damp * (2*grid[i] - prev[i] + c2 * lap);
    }
  }
  // source from spectral
  const cx = Math.floor(N/2 + Math.sin(dominantPhase)*4);
  const cy = Math.floor(N/2);
  const si = cy*N + cx;
  grid[si] += spectralEnergy * 0.4 * Math.sin(performance.now()*0.005 + dominantPhase);
  // pointer source
  const px = Math.floor(pointer.x / W * N);
  const py = Math.floor(pointer.y / H * N);
  if (px>1 && px<N-1 && py>1 && py<N-1) grid[py*N+px] += 0.1;
}

function render() {
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y=0; y<H; y+=2) {
    for (let x=0; x<W; x+=2) {
      const gx = Math.floor(x / W * N);
      const gy = Math.floor(y / H * N);
      const v = Math.max(-1, Math.min(1, grid[gy*N+gx]));
      const r = Math.floor((v+1)*60);
      const g = Math.floor((1-Math.abs(v))*40 + 20);
      const b = Math.floor((1-v)*100 + 30);
      const i = (y*W + x)*4;
      d[i]=r; d[i+1]=g; d[i+2]=b; d[i+3]=255;
      if (x+1<W) { d[i+4]=r; d[i+5]=g; d[i+6]=b; d[i+7]=255; }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function updatePortals() {
  for (const p of portals) {
    const gx = Math.floor(p.x / W * N);
    const gy = Math.floor(p.y / H * N);
    if (gx<1||gx>=N-1||gy<1||gy>=N-1) continue;
    const h = grid[gy*N + gx];
    const dx = grid[gy*N + gx+1] - grid[gy*N + gx-1];
    const dy = grid[(gy+1)*N + gx] - grid[(gy-1)*N + gx];
    p.vx += dx * 0.4;
    p.vy += dy * 0.4;
    p.vx *= 0.92; p.vy *= 0.92;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(20, Math.min(W-160, p.x));
    p.y = Math.max(20, Math.min(H-80, p.y));
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
    p.el.style.transform = `rotate(${dx*20}deg) scale(${1+Math.abs(h)*0.15})`;
  }
}

function loop() {
  // sample signal
  const sample = ori.beta * 0.6 + ori.gamma * 0.4 + (pointer.vx + pointer.vy)*0.01;
  signal[sigIdx] = sample;
  sigIdx = (sigIdx + 1) % 64;
  if (sigIdx % 4 === 0) dft();
  stepWave();
  render();
  updatePortals();
  statusEl.textContent = `Energy ${spectralEnergy.toFixed(2)} · Phase ${(dominantPhase*57.3).toFixed(0)}° · Portals ${portals.length}`;
  requestAnimationFrame(loop);
}

// persistence
const DB = 'verse-f722';
function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seal');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction('seal','readwrite');
    const data = {
      energy: spectralEnergy,
      phase: dominantPhase,
      portals: portals.map(p => ({x:p.x,y:p.y,text:p.el.textContent})),
      t: Date.now()
    };
    tx.objectStore('seal').put(data, 'best');
    statusEl.textContent = 'Sealed to IndexedDB';
  } catch(e) { statusEl.textContent = 'Seal failed (IDB blocked)'; }
}
async function loadSeal() {
  try {
    const db = await openDB();
    const tx = db.transaction('seal');
    const req = tx.objectStore('seal').get('best');
    req.onsuccess = () => {
      const d = req.result;
      if (!d) return;
      spectralEnergy = d.energy || 0.3;
      dominantPhase = d.phase || 0;
      portals.forEach(p => p.el.remove());
      portals = [];
      (d.portals||[]).forEach(pp => addPortal(pp.x, pp.y, pp.text));
      statusEl.textContent = 'Restored sealed spectrum';
    };
  } catch (e) { console.debug("lab f722-webgpu-spectral-fourier-portal-mind:", e); }
}

document.getElementById('addBtn').onclick = () => addPortal();
document.getElementById('sealBtn').onclick = seal;
document.getElementById('resetBtn').onclick = () => {
  grid.fill(0); prev.fill(0); signal.fill(0);
  portals.forEach(p => p.el.remove()); portals = [];
  addPortal(); addPortal();
};
document.getElementById('dlBtn').onclick = () => {
  const data = {spectralEnergy, dominantPhase, portals: portals.map(p=>({x:p.x,y:p.y,text:p.el.textContent}))};
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], {type:'application/json'}));
  a.download = 'f722-spectral.json';
  a.click();
};

addPortal(W*0.3, H*0.4, 'Frequency portal');
addPortal(W*0.6, H*0.5, 'Phase portal');
loadSeal();
loop();
