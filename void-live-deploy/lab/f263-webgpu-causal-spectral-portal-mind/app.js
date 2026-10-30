const status = document.getElementById('status');
const canvas = document.getElementById('c');
const portalsEl = document.getElementById('portals');
let gpu = null, device = null, context = null, pipeline = null, bindGroup = null;
let fieldBuffer = null, paramsBuffer = null, readBuffer = null;
let useWebGPU = false;
let ctx2d = null;
let field = null; // fallback 2D array
const W = 64, H = 64;
let portals = [];
const NUM_PORTALS = 5;
let attentionWorker = null;
let attentionWeights = null; // current genome
let audioCtx = null, oscs = [];
let lastPointer = {x:0.5, y:0.5, vx:0, vy:0, t:0};
let ring = []; // recent events for attention

function setStatus(msg) { status.textContent = msg; }

// --- Portals ---
function createPortals() {
  portalsEl.innerHTML = '';
  portals = [];
  for (let i = 0; i < NUM_PORTALS; i++) {
    const p = document.createElement('div');
    p.className = 'portal';
    p.textContent = `P${i+1}`;
    p.style.left = (20 + i * 15) + '%';
    p.style.top = (30 + (i%3)*15) + '%';
    p.dataset.idx = i;
    p.addEventListener('pointerdown', onPortalDown);
    portalsEl.appendChild(p);
    portals.push(p);
  }
}

function onPortalDown(e) {
  e.preventDefault();
  const p = e.target;
  const idx = +p.dataset.idx;
  const rect = canvas.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  injectEnergy(nx, ny, 1.5);
  pushEvent({type:'portal', idx, x:nx, y:ny, t:performance.now()});
  // simple drag
  const move = (ev) => {
    const nx2 = (ev.clientX - rect.left) / rect.width;
    const ny2 = (ev.clientY - rect.top) / rect.height;
    p.style.left = (nx2*100 - 5) + '%';
    p.style.top = (ny2*100 - 4) + '%';
    injectEnergy(nx2, ny2, 0.4);
  };
  const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

function injectEnergy(nx, ny, amp) {
  if (useWebGPU && fieldBuffer) {
    // write a small injection via mapped or compute param; for simplicity update params and let shader sample
    // in this prototype we set a one-shot inject via params
  }
  // always update fallback or visual
  if (field) {
    const ix = Math.floor(nx * W) % W, iy = Math.floor(ny * H) % H;
    field[iy][ix] += amp;
  }
  pushEvent({type:'inject', x:nx, y:ny, amp, t:performance.now()});
}

function pushEvent(ev) {
  ring.push(ev);
  if (ring.length > 32) ring.shift();
  if (attentionWorker) attentionWorker.postMessage({cmd:'event', event:ev, stats: lastStats});
}

// --- Attention Worker (inline blob) ---
function startAttentionWorker() {
  const code = `
    let weights = new Float32Array(64); // simple genome: random init
    for (let i=0;i<weights.length;i++) weights[i] = (Math.random()-0.5)*0.2;
    let buffer = [];
    self.onmessage = (e) => {
      const m = e.data;
      if (m.cmd === 'event') {
        buffer.push(m.event);
        if (buffer.length > 16) buffer.shift();
        // tiny causal attention proxy: weighted sum of recent velocities and energy
        let bias = {inj: 0.5, damp: 0.05, freq: 0.5};
        let sum = 0;
        for (let i=0;i<buffer.length;i++) {
          const ev = buffer[i];
          const w = weights[i % weights.length];
          bias.inj += (ev.x||0.5) * w * 0.1;
          bias.damp += (ev.y||0.5) * w * 0.05;
          sum += w;
        }
        bias.inj = Math.max(0.1, Math.min(2, bias.inj));
        bias.damp = Math.max(0.01, Math.min(0.3, bias.damp));
        self.postMessage({cmd:'bias', bias, weights: Array.from(weights)});
      } else if (m.cmd === 'setWeights') {
        weights = new Float32Array(m.weights);
      } else if (m.cmd === 'getWeights') {
        self.postMessage({cmd:'weights', weights: Array.from(weights)});
      }
    };
  `;
  const blob = new Blob([code], {type:'application/javascript'});
  attentionWorker = new Worker(URL.createObjectURL(blob));
  attentionWorker.onmessage = (e) => {
    if (e.data.cmd === 'bias') {
      currentBias = e.data.bias;
      attentionWeights = e.data.weights;
    }
  };
}

let currentBias = {inj:0.8, damp:0.08, freq:0.5};
let lastStats = {energy:0.2, var:0.1, dom:0.5};

// --- WebGPU setup (simplified) ---
async function initWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    device = await adapter.requestDevice();
    context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({device, format, alphaMode:'opaque'});
    // Minimal compute + render pipeline omitted for brevity in this draft; we fall back to Canvas2D
    // but mark available so future can expand. For runnable now use 2D.
    useWebGPU = false; // set true when full shader is wired; prototype prioritizes runnable
    return false;
  } catch(e) { return false; }
}

// --- Canvas2D fallback wave simulation ---
function init2D() {
  ctx2d = canvas.getContext('2d');
  field = Array.from({length:H}, () => new Float32Array(W).fill(0));
  // seed some energy
  for (let i=0;i<20;i++) field[Math.floor(Math.random()*H)][Math.floor(Math.random()*W)] = 1;
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function step2D() {
  const next = Array.from({length:H}, () => new Float32Array(W));
  const damp = currentBias.damp;
  const inj = currentBias.inj;
  for (let y=1;y<H-1;y++) {
    for (let x=1;x<W-1;x++) {
      const lap = field[y-1][x] + field[y+1][x] + field[y][x-1] + field[y][x+1] - 4*field[y][x];
      next[y][x] = field[y][x] + 0.15 * lap - damp * field[y][x];
      next[y][x] = Math.max(-2, Math.min(2, next[y][x]));
    }
  }
  // continuous injection from last pointer
  const ix = Math.floor(lastPointer.x * W) % W;
  const iy = Math.floor(lastPointer.y * H) % H;
  if (ix>0 && iy>0) next[iy][ix] += inj * 0.3;
  field = next;
  // stats
  let e=0, s=0;
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) { e += Math.abs(field[y][x]); s += field[y][x]*field[y][x]; }
  lastStats.energy = e / (W*H);
  lastStats.var = s / (W*H) - lastStats.energy*lastStats.energy;
  lastStats.dom = Math.min(1, lastStats.energy * 2);
}

function draw2D() {
  const img = ctx2d.createImageData(canvas.width, canvas.height);
  const data = img.data;
  const sx = canvas.width / W, sy = canvas.height / H;
  for (let y=0;y<H;y++) {
    for (let x=0;x<W;x++) {
      const v = (field[y][x] + 2) / 4; // 0..1
      const r = Math.floor(v * 80);
      const g = Math.floor(v * 120 + lastStats.dom*50);
      const b = Math.floor(v * 180);
      // simple nearest fill
      for (let dy=0; dy<sy; dy+=2) for (let dx=0; dx<sx; dx+=2) {
        const px = Math.floor(x*sx + dx), py = Math.floor(y*sy + dy);
        if (px<canvas.width && py<canvas.height) {
          const i = (py*canvas.width + px)*4;
          data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255;
        }
      }
    }
  }
  ctx2d.putImageData(img, 0, 0);
}

function morphPortals() {
  const e = lastStats.energy;
  const d = lastStats.dom;
  portals.forEach((p, i) => {
    const scale = 0.8 + e * 0.6 + Math.sin(performance.now()/1000 + i)*0.1;
    const rot = (d * 40 + i*15) * Math.sin(performance.now()/800);
    const hue = 200 + d * 60;
    p.style.transform = `scale(${scale}) rotate(${rot}deg)`;
    p.style.filter = `hue-rotate(${hue}deg) saturate(${1+e*2}) brightness(${0.8 + e})`;
    p.style.opacity = 0.6 + e * 0.4;
  });
}

// --- Audio ---
function startAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i=0;i<3;i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = 220 + i*110;
    g.gain.value = 0.05;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    oscs.push({o,g});
  }
}

function updateAudio() {
  if (!audioCtx) return;
  oscs.forEach((os, i) => {
    os.o.frequency.value = 180 + lastStats.dom * 400 + i*80;
    os.g.gain.value = Math.min(0.15, lastStats.energy * 0.4);
  });
}

// --- Seal / Load ---
async function seal() {
  if (!attentionWeights) {
    setStatus('No weights yet');
    return;
  }
  const str = JSON.stringify({w: attentionWeights, t: Date.now()});
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const hash = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const rec = {hash, weights: attentionWeights, t: Date.now()};
  try {
    const db = await idbOpen();
    const tx = db.transaction('seals','readwrite');
    tx.objectStore('seals').put(rec, 'latest');
    setStatus('Sealed ' + hash.slice(0,8));
  } catch(e) { setStatus('Seal failed (IDB)'); }
}

async function loadSealed() {
  try {
    const db = await idbOpen();
    const tx = db.transaction('seals','readonly');
    const req = tx.objectStore('seals').get('latest');
    req.onsuccess = () => {
      const rec = req.result;
      if (rec && rec.weights) {
        if (attentionWorker) attentionWorker.postMessage({cmd:'setWeights', weights:rec.weights});
        attentionWeights = rec.weights;
        setStatus('Loaded sealed ' + (rec.hash||'').slice(0,8));
      } else setStatus('No sealed genome');
    };
  } catch(e) { setStatus('Load failed'); }
}

function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f263-seals', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seals');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// --- Main loop ---
let raf;
function loop() {
  step2D();
  draw2D();
  morphPortals();
  updateAudio();
  raf = requestAnimationFrame(loop);
}

// --- Events ---
canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  const t = performance.now();
  const vx = (nx - lastPointer.x) / Math.max(0.001, (t - lastPointer.t)/1000);
  const vy = (ny - lastPointer.y) / Math.max(0.001, (t - lastPointer.t)/1000);
  lastPointer = {x:nx, y:ny, vx, vy, t};
  pushEvent({type:'move', x:nx, y:ny, vx, vy, t});
  injectEnergy(nx, ny, 0.2);
});
canvas.addEventListener('pointerdown', () => { startAudio(); });

document.getElementById('seal').onclick = seal;
document.getElementById('load').onclick = loadSealed;
document.getElementById('reset').onclick = () => {
  for (let y=0;y<H;y++) field[y].fill(0);
  for (let i=0;i<10;i++) field[Math.floor(Math.random()*H)][Math.floor(Math.random()*W)] = 1;
  setStatus('Field reset');
};

// --- Boot ---
(async () => {
  createPortals();
  startAttentionWorker();
  await initWebGPU();
  init2D();
  setStatus(useWebGPU ? 'WebGPU active' : 'Canvas2D spectral field (WebGPU stub ready)');
  loop();
})();
