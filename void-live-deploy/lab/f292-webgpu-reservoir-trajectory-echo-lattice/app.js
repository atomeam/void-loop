const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const GRID = 48;
const cellW = () => W / GRID, cellH = () => H / GRID;
let field = new Float32Array(GRID * GRID);
let nextField = new Float32Array(GRID * GRID);

// Reservoir (ESN-like)
const RES = 16;
let resState = new Float32Array(RES);
const W_in = Float32Array.from({length: RES*2}, () => (Math.random()-0.5)*0.5); // input dim 2 (dx,dy)
const W_res = Float32Array.from({length: RES*RES}, () => Math.random() < 0.2 ? (Math.random()-0.5)*0.8 : 0);
let W_out = Float32Array.from({length: 4*RES}, () => (Math.random()-0.5)*0.3); // readout to 4 params
let generation = 0;
let championOut = null;

function hashWeights(w) {
  let h = 0;
  for (let v of w) h = (h * 31 + Math.round(v*1000)) | 0;
  return (h >>> 0).toString(16).slice(0,6);
}

// Trajectory buffer
const TRAJ = 16;
let traj = new Float32Array(TRAJ*2);
let trajIdx = 0;
let lastX = W/2, lastY = H/2;
let pointer = {x: W/2, y: H/2};

addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

// DOM probes
const probes = [];
for (let i = 0; i < 2; i++) {
  const el = document.createElement('div');
  el.className = 'probe';
  el.textContent = 'probe';
  document.body.appendChild(el);
  probes.push({ el, dragging: false, ox:0, oy:0 });
  el.addEventListener('pointerdown', e => {
    probes[i].dragging = true;
    probes[i].ox = e.clientX - el.offsetLeft;
    probes[i].oy = e.clientY - el.offsetTop;
    e.preventDefault();
  });
}
addEventListener('pointerup', e => {
  probes.forEach(p => {
    if (p.dragging) {
      p.dragging = false;
      // inject into reservoir
      for (let k = 0; k < RES; k++) resState[k] += (Math.random()-0.5)*0.4;
    }
  });
});
addEventListener('pointermove', e => {
  probes.forEach(p => {
    if (p.dragging) {
      p.el.style.left = (e.clientX - p.ox) + 'px';
      p.el.style.top = (e.clientY - p.oy) + 'px';
    }
  });
});

// IndexedDB
let db;
const req = indexedDB.open('F292echo', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('champ', { keyPath: 'id' });
req.onsuccess = e => { db = e.target.result; loadChamp(); };
function sealChamp() {
  if (!db) return;
  const tx = db.transaction('champ', 'readwrite');
  tx.objectStore('champ').put({ id:1, weights: Array.from(W_out), gen: generation });
  document.getElementById('status').textContent = 'Sealed readout gen ' + generation + ' hash ' + hashWeights(W_out);
}
function loadChamp() {
  if (!db) return;
  const tx = db.transaction('champ', 'readonly');
  const g = tx.objectStore('champ').get(1);
  g.onsuccess = () => {
    if (g.result) {
      W_out = Float32Array.from(g.result.weights);
      generation = g.result.gen || 0;
      document.getElementById('status').textContent = 'Loaded champion gen ' + generation;
    }
  };
}
document.getElementById('seal').onclick = () => { generation++; sealChamp(); };
document.getElementById('load').onclick = loadChamp;
document.getElementById('reset').onclick = () => {
  generation = 0;
  W_out = Float32Array.from({length: 4*RES}, () => (Math.random()-0.5)*0.3);
  field.fill(0);
  resState.fill(0);
  document.getElementById('status').textContent = 'Reset';
};

// Optional WebGPU prepare
async function tryWebGPU() {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    const module = device.createShaderModule({
      code: `
        @group(0) @binding(0) var<storage, read_write> field: array<f32>;
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) gid: vec3u) {
          let i = gid.x;
          if (i < arrayLength(&field)) { field[i] = field[i] * 0.98; }
        }`
    });
    console.log('WebGPU diffusion path ready');
    document.getElementById('status').textContent += ' | WebGPU ready';
  } catch(e) {}
}
tryWebGPU();

function reservoirStep(dx, dy) {
  const input = [dx * 0.01, dy * 0.01];
  const newState = new Float32Array(RES);
  for (let i = 0; i < RES; i++) {
    let s = 0;
    for (let j = 0; j < RES; j++) s += W_res[i*RES + j] * resState[j];
    s += W_in[i*2] * input[0] + W_in[i*2+1] * input[1];
    newState[i] = Math.tanh(s);
  }
  resState.set(newState);
  // readout
  const out = new Float32Array(4);
  for (let o = 0; o < 4; o++) {
    let s = 0;
    for (let i = 0; i < RES; i++) s += W_out[o*RES + i] * resState[i];
    out[o] = s;
  }
  return out;
}

function step() {
  const dx = pointer.x - lastX, dy = pointer.y - lastY;
  lastX = pointer.x; lastY = pointer.y;
  traj[trajIdx*2] = dx; traj[trajIdx*2+1] = dy;
  trajIdx = (trajIdx + 1) % TRAJ;

  const params = reservoirStep(dx, dy);
  const seedStr = 0.3 + Math.tanh(params[0]) * 0.4;
  const diffRate = 0.15 + Math.tanh(params[1]) * 0.1;
  const decay = 0.96 + Math.tanh(params[2]) * 0.02;
  const bias = Math.tanh(params[3]) * 0.1;

  // seed near pointer
  const gx = Math.floor(pointer.x / cellW());
  const gy = Math.floor(pointer.y / cellH());
  if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
    field[gy*GRID + gx] += seedStr;
  }

  // diffuse
  for (let y = 1; y < GRID-1; y++) {
    for (let x = 1; x < GRID-1; x++) {
      const i = y*GRID + x;
      const avg = (field[i-1] + field[i+1] + field[i-GRID] + field[i+GRID]) * 0.25;
      nextField[i] = field[i] * decay + (avg - field[i]) * diffRate + bias * 0.01;
    }
  }
  field.set(nextField);

  // draw
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const cw = cellW(), ch = cellH();
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const v = Math.min(1, Math.max(0, field[y*GRID + x]));
      if (v > 0.05) {
        ctx.fillStyle = `hsla(${200 + v*60}, 70%, ${30 + v*40}%, ${0.4 + v*0.6})`;
        ctx.fillRect(x*cw, y*ch, cw+1, ch+1);
      }
    }
  }
  // pointer marker
  ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 6, 0, Math.PI*2);
  ctx.fillStyle = '#ffaa33'; ctx.fill();

  // probes track hotspots
  let hotspots = [];
  for (let y = 0; y < GRID; y+=4) for (let x = 0; x < GRID; x+=4) {
    const v = field[y*GRID + x];
    if (v > 0.2) hotspots.push({x: x*cw + cw/2, y: y*ch + ch/2, v});
  }
  hotspots.sort((a,b)=>b.v - a.v);
  probes.forEach((p, i) => {
    if (!p.dragging && hotspots[i]) {
      const t = hotspots[i];
      p.el.style.left = (t.x + 8) + 'px';
      p.el.style.top = (t.y - 16) + 'px';
      p.el.textContent = 'echo ' + t.v.toFixed(2) + '\n' + hashWeights(W_out).slice(0,4);
    }
  });

  requestAnimationFrame(step);
}
requestAnimationFrame(step);
