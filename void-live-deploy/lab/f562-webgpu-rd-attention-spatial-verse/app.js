const LEXICON = [
  "void becomes verse", "chemistry writes", "attention blooms", "density sings",
  "patterns remember", "feed the silence", "kill the noise", "spatial poem",
  "living text", "emergent grammar", "mind chemistry", "pointer steers",
  "organic verse", "wave of meaning", "local attention", "sealed thought",
  "diffusion of ideas", "reaction of form", "canvas mind", "verse everywhere"
];

const GRID = 128; // balance quality/perf
const DT = 1.0;
const DU = 0.16, DV = 0.08;
const BASE_F = 0.037, BASE_K = 0.06;

let canvas, ctx, imageData;
let U, V; // Float32Array GRID*GRID
let feedMap, killMap;
let attentionEnergy = 0;
let verseNodes = [];
let usingWebGPU = false;
let gpuDevice, gpuPipeline, gpuBindGroup, gpuTextures;
let frame = 0;
let pointer = { x: 0.5, y: 0.5, vx: 0, vy: 0 };

function idx(x, y) { return y * GRID + x; }

function initArrays() {
  U = new Float32Array(GRID * GRID);
  V = new Float32Array(GRID * GRID);
  feedMap = new Float32Array(GRID * GRID);
  killMap = new Float32Array(GRID * GRID);
  for (let i = 0; i < GRID * GRID; i++) {
    U[i] = 1.0;
    V[i] = 0.0;
    feedMap[i] = BASE_F;
    killMap[i] = BASE_K;
  }
  // seed center
  const c = GRID >> 1;
  for (let y = c-6; y < c+6; y++) for (let x = c-6; x < c+6; x++) {
    if (x>=0 && x<GRID && y>=0 && y<GRID) V[idx(x,y)] = 0.5 + Math.random()*0.5;
  }
}

async function tryWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    gpuDevice = await adapter.requestDevice();
    // Minimal compute pipeline for one RD step would go here.
    // For reliability in this prototype we fall back to JS; WebGPU path sketched.
    // Full shader omitted for size; structure ready.
    usingWebGPU = false; // set true only if full pipeline built
    return false;
  } catch (e) {
    console.warn("WebGPU unavailable", e);
    return false;
  }
}

function setupCanvas() {
  canvas = document.getElementById("canvas");
  canvas.width = GRID;
  canvas.height = GRID;
  ctx = canvas.getContext("2d", { willReadFrequently: true });
  imageData = ctx.createImageData(GRID, GRID);
}

function rdStep() {
  const nextU = new Float32Array(U);
  const nextV = new Float32Array(V);
  for (let y = 1; y < GRID-1; y++) {
    for (let x = 1; x < GRID-1; x++) {
      const i = idx(x,y);
      const u = U[i], v = V[i];
      const lapU = U[idx(x+1,y)] + U[idx(x-1,y)] + U[idx(x,y+1)] + U[idx(x,y-1)] - 4*u;
      const lapV = V[idx(x+1,y)] + V[idx(x-1,y)] + V[idx(x,y+1)] + V[idx(x,y-1)] - 4*v;
      const uvv = u * v * v;
      const f = feedMap[i], k = killMap[i];
      nextU[i] = u + DT * (DU * lapU - uvv + f * (1 - u));
      nextV[i] = v + DT * (DV * lapV + uvv - (f + k) * v);
      nextU[i] = Math.max(0, Math.min(1, nextU[i]));
      nextV[i] = Math.max(0, Math.min(1, nextV[i]));
    }
  }
  U = nextU;
  V = nextV;
}

function updateAttention() {
  // Simple attention: bias rates toward pointer and high-variance regions
  attentionEnergy = Math.hypot(pointer.vx, pointer.vy);
  const px = Math.floor(pointer.x * GRID);
  const py = Math.floor(pointer.y * GRID);
  const radius = 18;
  for (let y = Math.max(1, py-radius); y < Math.min(GRID-1, py+radius); y++) {
    for (let x = Math.max(1, px-radius); x < Math.min(GRID-1, px+radius); x++) {
      const d = Math.hypot(x-px, y-py);
      if (d < radius) {
        const w = 1 - d/radius;
        const i = idx(x,y);
        feedMap[i] = BASE_F + 0.012 * w * (1 + attentionEnergy);
        killMap[i] = BASE_K - 0.008 * w;
      }
    }
  }
  // gentle global decay back to base
  for (let i = 0; i < feedMap.length; i++) {
    feedMap[i] = feedMap[i] * 0.98 + BASE_F * 0.02;
    killMap[i] = killMap[i] * 0.98 + BASE_K * 0.02;
  }
}

function render() {
  const data = imageData.data;
  for (let i = 0; i < U.length; i++) {
    const v = V[i];
    const u = U[i];
    const mag = Math.min(1, v * 2.2);
    const r = Math.floor(20 + mag * 40);
    const g = Math.floor(40 + mag * 180);
    const b = Math.floor(80 + mag * 175);
    const p = i * 4;
    data[p] = r; data[p+1] = g; data[p+2] = b; data[p+3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  // stretch to full viewport via CSS
}

function updateVerse() {
  // Find local maxima and spawn/update fragments
  const peaks = [];
  for (let y = 8; y < GRID-8; y += 12) {
    for (let x = 8; x < GRID-8; x += 12) {
      const v = V[idx(x,y)];
      if (v > 0.35) peaks.push({ x, y, v });
    }
  }
  // manage nodes
  while (verseNodes.length < Math.min(peaks.length, 28) && verseNodes.length < 36) {
    const el = document.createElement("div");
    el.className = "verse";
    el.textContent = LEXICON[Math.floor(Math.random() * LEXICON.length)];
    document.body.appendChild(el);
    verseNodes.push({ el, life: 0, tx: 0, ty: 0 });
  }
  for (let i = 0; i < verseNodes.length; i++) {
    const node = verseNodes[i];
    if (i < peaks.length) {
      const p = peaks[i];
      const sx = (p.x / GRID) * window.innerWidth;
      const sy = (p.y / GRID) * window.innerHeight;
      node.tx = sx + (Math.random()-0.5)*40;
      node.ty = sy + (Math.random()-0.5)*40;
      node.life = Math.min(1, node.life + 0.08);
      const scale = 0.6 + p.v * 1.4;
      node.el.style.left = node.tx + "px";
      node.el.style.top = node.ty + "px";
      node.el.style.opacity = node.life.toFixed(2);
      node.el.style.transform = `translate(-50%,-50%) scale(${scale.toFixed(2)})`;
      node.el.style.color = `hsl(${200 + p.v*80}, 80%, ${60 + p.v*30}%)`;
    } else {
      node.life *= 0.92;
      node.el.style.opacity = node.life.toFixed(2);
      if (node.life < 0.05) {
        node.el.remove();
        verseNodes.splice(i, 1);
        i--;
      }
    }
  }
}

function loop() {
  updateAttention();
  for (let s = 0; s < 3; s++) rdStep(); // multiple substeps
  render();
  if (frame % 2 === 0) updateVerse();
  document.getElementById("stats").textContent =
    `grid: ${GRID}² | attention: ${attentionEnergy.toFixed(2)} | verse: ${verseNodes.length}`;
  frame++;
  requestAnimationFrame(loop);
}

// Pointer
window.addEventListener("pointermove", e => {
  const nx = e.clientX / window.innerWidth;
  const ny = e.clientY / window.innerHeight;
  pointer.vx = nx - pointer.x;
  pointer.vy = ny - pointer.y;
  pointer.x = nx;
  pointer.y = ny;
});

// Controls
document.getElementById("reset").onclick = () => { initArrays(); };
document.getElementById("seed").onclick = () => {
  const c = GRID >> 1;
  for (let y = c-8; y < c+8; y++) for (let x = c-8; x < c+8; x++) {
    if (x>0 && x<GRID-1 && y>0 && y<GRID-1) V[idx(x,y)] = Math.min(1, V[idx(x,y)] + 0.4);
  }
};
document.getElementById("silence").onclick = () => {
  verseNodes.forEach(n => n.el.remove());
  verseNodes = [];
};

// IndexedDB seal
const DB_NAME = "f562-rd-verse-mind";
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction("state", "readwrite");
    const store = tx.objectStore("state");
    // downsample for size
    const down = 4;
    const su = [], sv = [];
    for (let y = 0; y < GRID; y += down) for (let x = 0; x < GRID; x += down) {
      su.push(U[idx(x,y)]); sv.push(V[idx(x,y)]);
    }
    store.put({ u: su, v: sv, ts: Date.now() }, "chem");
    document.getElementById("status").textContent = "sealed · " + new Date().toLocaleTimeString();
  } catch (e) {
    document.getElementById("status").textContent = "seal failed (in-memory)";
  }
}
async function loadSeal() {
  try {
    const db = await openDB();
    const tx = db.transaction("state", "readonly");
    const store = tx.objectStore("state");
    const req = store.get("chem");
    req.onsuccess = () => {
      const data = req.result;
      if (data && data.u && data.v) {
        const down = 4;
        let k = 0;
        for (let y = 0; y < GRID; y += down) for (let x = 0; x < GRID; x += down) {
          const uu = data.u[k], vv = data.v[k];
          for (let dy = 0; dy < down; dy++) for (let dx = 0; dx < down; dx++) {
            const xx = x+dx, yy = y+dy;
            if (xx < GRID && yy < GRID) {
              U[idx(xx,yy)] = uu;
              V[idx(xx,yy)] = vv;
            }
          }
          k++;
        }
        document.getElementById("status").textContent = "restored from seal";
      }
    };
  } catch (e) { console.debug("lab f562-webgpu-rd-attention-spatial-verse:", e); }
}

document.getElementById("seal").onclick = seal;

// Boot
(async () => {
  initArrays();
  setupCanvas();
  await tryWebGPU();
  await loadSeal();
  document.getElementById("status").textContent += usingWebGPU ? " · WebGPU" : " · Canvas2D";
  loop();
})();
