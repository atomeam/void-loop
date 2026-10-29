const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const GRID = 64;
const dx = 1;
let grid = new Float32Array(GRID * GRID);
let vel = new Float32Array(GRID * GRID);
const damping = 0.995;
const c2 = 0.15;

let micOn = false, analyser, dataArray, audioCtx;
let demo = true;
let portals = [];
let lastSeal = null;

function idx(x, y) { return y * GRID + x; }

function stepWave(srcEnergy = 0, srcX = GRID/2, srcY = GRID/2) {
  const next = new Float32Array(grid.length);
  for (let y = 1; y < GRID-1; y++) {
    for (let x = 1; x < GRID-1; x++) {
      const i = idx(x,y);
      const lap = grid[idx(x-1,y)] + grid[idx(x+1,y)] + grid[idx(x,y-1)] + grid[idx(x,y+1)] - 4 * grid[i];
      vel[i] = (vel[i] + c2 * lap) * damping;
      next[i] = grid[i] + vel[i];
    }
  }
  // inject source
  const sx = Math.floor(srcX), sy = Math.floor(srcY);
  if (sx > 0 && sx < GRID-1 && sy > 0 && sy < GRID-1) {
    next[idx(sx,sy)] += srcEnergy * 0.8;
  }
  grid = next;
}

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const cellW = W / GRID, cellH = H / GRID;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const v = Math.abs(grid[idx(x,y)]);
      const hue = 200 + v * 80;
      const alpha = Math.min(0.8, v * 2);
      ctx.fillStyle = `hsla(${hue}, 70%, 55%, ${alpha})`;
      ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
    }
  }
  // spawn portals on high energy
  if (Math.random() < 0.02) {
    let maxV = 0, mx = 0, my = 0;
    for (let y = 2; y < GRID-2; y++) for (let x = 2; x < GRID-2; x++) {
      const v = Math.abs(grid[idx(x,y)]);
      if (v > maxV) { maxV = v; mx = x; my = y; }
    }
    if (maxV > 0.4 && portals.length < 6) {
      spawnPortal(mx / GRID * W, my / GRID * H, maxV);
    }
  }
}

function spawnPortal(px, py, energy) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.style.left = (px - 60) + 'px';
  el.style.top = (py - 40) + 'px';
  el.innerHTML = `<div>Wave ${energy.toFixed(2)}</div><canvas width="100" height="36"></canvas>`;
  const pcanvas = el.querySelector('canvas');
  const pctx = pcanvas.getContext('2d');
  document.body.appendChild(el);
  const portal = { el, x: px, y: py, pctx, energy };
  portals.push(portal);
  makeDraggable(portal);
  drawPortalSpec(portal);
}

function drawPortalSpec(portal) {
  const pctx = portal.pctx;
  pctx.fillStyle = '#111';
  pctx.fillRect(0,0,100,36);
  for (let i = 0; i < 32; i++) {
    const h = Math.random() * 30 * (portal.energy || 0.5);
    pctx.fillStyle = `hsl(${200 + i*4}, 80%, 60%)`;
    pctx.fillRect(i * 3, 36 - h, 2, h);
  }
}

function makeDraggable(portal) {
  let dragging = false, ox = 0, oy = 0;
  portal.el.addEventListener('pointerdown', e => {
    dragging = true;
    portal.el.classList.add('dragging');
    ox = e.clientX - parseFloat(portal.el.style.left);
    oy = e.clientY - parseFloat(portal.el.style.top);
    e.preventDefault();
  });
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    const lx = e.clientX - ox, ly = e.clientY - oy;
    portal.el.style.left = lx + 'px';
    portal.el.style.top = ly + 'px';
    portal.x = lx + 60; portal.y = ly + 40;
  });
  window.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    portal.el.classList.remove('dragging');
    // inject impulse
    const gx = Math.floor((portal.x / W) * GRID);
    const gy = Math.floor((portal.y / H) * GRID);
    if (gx > 1 && gx < GRID-2 && gy > 1 && gy < GRID-2) {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const ii = idx(gx+dx, gy+dy);
        if (ii >= 0 && ii < grid.length) vel[ii] += 0.6 * Math.exp(-(dx*dx+dy*dy));
      }
    }
    drawPortalSpec(portal);
  });
}

async function enableMic() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    micOn = true;
    demo = false;
    status.textContent = 'Mic active · spectral drive';
  } catch (e) {
    status.textContent = 'Mic denied · demo mode';
  }
}

function getSpectralEnergy() {
  if (!micOn || !analyser) return demo ? (0.3 + 0.4 * Math.sin(Date.now() / 800)) : 0;
  analyser.getByteFrequencyData(dataArray);
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
  return (sum / dataArray.length) / 255 * 1.5;
}

async function sealState() {
  const data = {
    grid: Array.from(grid),
    vel: Array.from(vel),
    portals: portals.map(p => ({ x: p.x, y: p.y, energy: p.energy })),
    ts: Date.now()
  };
  lastSeal = data;
  try {
    const db = await openDB();
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put(data, 'latest');
    status.textContent = 'Sealed to IndexedDB';
  } catch (e) {
    status.textContent = 'Seal failed (IDB)';
  }
}

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('F300-wave', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seals');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}

async function loadState() {
  try {
    const db = await openDB();
    const tx = db.transaction('seals', 'readonly');
    const req = tx.objectStore('seals').get('latest');
    req.onsuccess = () => {
      const data = req.result;
      if (!data) { status.textContent = 'No seal found'; return; }
      grid = new Float32Array(data.grid);
      vel = new Float32Array(data.vel);
      portals.forEach(p => p.el.remove());
      portals = [];
      (data.portals || []).forEach(p => spawnPortal(p.x, p.y, p.energy));
      status.textContent = 'Loaded sealed state';
    };
  } catch (e) {
    status.textContent = 'Load failed';
  }
}

document.getElementById('mic').onclick = enableMic;
document.getElementById('seal').onclick = sealState;
document.getElementById('load').onclick = loadState;
document.getElementById('demo').onclick = () => { demo = true; micOn = false; status.textContent = 'Demo mode'; };

function loop() {
  const energy = getSpectralEnergy();
  const sx = GRID/2 + 8 * Math.sin(Date.now() / 1200);
  const sy = GRID/2 + 6 * Math.cos(Date.now() / 1500);
  stepWave(energy * 0.6, sx, sy);
  render();
  requestAnimationFrame(loop);
}
loop();

// WebGPU stub note in console
if (navigator.gpu) {
  console.log('WebGPU available — compute kernel path can be attached for wave update');
  status.textContent += ' · WebGPU detected';
}
