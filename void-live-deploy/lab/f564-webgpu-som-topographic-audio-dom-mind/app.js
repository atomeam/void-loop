const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const W = 16, H = 12, DIM = 8;
let weights = new Float32Array(W * H * DIM);
let nodes = [];
let pointerHist = [0,0,0,0];
let audioBins = [0,0,0,0];
let learningRate = 0.08;
let radius = 4;
let lastBMU = {x:0,y:0};
let qError = 0;
let audioCtx, analyser, osc;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

function initWeights() {
  for (let i = 0; i < weights.length; i++) weights[i] = Math.random() * 2 - 1;
}

function dist(a, b) {
  let s = 0;
  for (let i = 0; i < DIM; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

function findBMU(input) {
  let best = 0, bestD = Infinity;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * DIM;
      const d = dist(input, weights.subarray(idx, idx + DIM));
      if (d < bestD) { bestD = d; best = y * W + x; }
    }
  }
  return { idx: best, x: best % W, y: Math.floor(best / W), d: bestD };
}

function updateSOM(input, bmu) {
  const sigma = radius;
  const lr = learningRate;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - bmu.x, dy = y - bmu.y;
      const d2 = dx*dx + dy*dy;
      if (d2 > sigma*sigma) continue;
      const h = Math.exp(-d2 / (2 * sigma * sigma));
      const idx = (y * W + x) * DIM;
      for (let d = 0; d < DIM; d++) {
        weights[idx + d] += lr * h * (input[d] - weights[idx + d]);
      }
    }
  }
  learningRate *= 0.9995;
  radius *= 0.9997;
}

function buildInput() {
  const input = new Float32Array(DIM);
  input.set(pointerHist);
  input.set(audioBins, 4);
  return input;
}

function spawnOrMoveNode(bmu, input) {
  const sx = (bmu.x + 0.5) / W * canvas.width;
  const sy = (bmu.y + 0.5) / H * canvas.height;
  let node = nodes.find(n => n.bmu === bmu.idx);
  if (!node) {
    const el = document.createElement('div');
    el.className = 'node';
    el.textContent = `v:${pointerHist[0].toFixed(2)} f:${audioBins[0].toFixed(2)}`;
    document.body.appendChild(el);
    node = { el, bmu: bmu.idx, x: sx, y: sy };
    nodes.push(node);
    if (nodes.length > 12) {
      const old = nodes.shift();
      old.el.remove();
    }
  }
  node.el.style.left = (sx - 45) + 'px';
  node.el.style.top = (sy - 20) + 'px';
  node.el.style.borderColor = `hsl(${(audioBins[0]*180+180)|0},70%,60%)`;
  node.el.textContent = `Δv ${pointerHist[0].toFixed(2)} / c ${audioBins[0].toFixed(2)}`;
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cellW = canvas.width / W, cellH = canvas.height / H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * DIM;
      const act = Math.min(1, Math.abs(weights[idx]) * 0.5 + 0.2);
      const isBMU = (x === lastBMU.x && y === lastBMU.y);
      ctx.fillStyle = isBMU ? `rgba(100,200,255,${0.4+act*0.6})` : `rgba(40,40,80,${0.3+act*0.4})`;
      ctx.fillRect(x*cellW, y*cellH, cellW-1, cellH-1);
    }
  }
  status.textContent = `BMU (${lastBMU.x},${lastBMU.y})  QE ${qError.toFixed(3)}  nodes ${nodes.length}  lr ${learningRate.toFixed(4)}`;
}

let mouseX = 0, mouseY = 0, lastX = 0, lastY = 0;
canvas.addEventListener('pointermove', e => {
  mouseX = e.clientX; mouseY = e.clientY;
  const dx = (mouseX - lastX) / 100;
  const dy = (mouseY - lastY) / 100;
  pointerHist = [dx, dy, pointerHist[0], pointerHist[1]];
  lastX = mouseX; lastY = mouseY;
});

function setupAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  gain.gain.value = 0.05;
  osc.type = 'sawtooth';
  osc.frequency.value = 220;
  osc.connect(gain).connect(analyser);
  analyser.connect(audioCtx.destination);
  osc.start();
  audioCtx.resume();
}

document.getElementById('tone').onclick = () => {
  setupAudio();
  if (osc) osc.frequency.setValueAtTime(180 + Math.random()*400, audioCtx.currentTime);
};
document.getElementById('noise').onclick = () => {
  for (let i = 0; i < weights.length; i++) weights[i] += (Math.random()-0.5)*0.1;
};
document.getElementById('reset').onclick = () => {
  initWeights();
  nodes.forEach(n => n.el.remove());
  nodes = [];
  learningRate = 0.08; radius = 4;
};

const DB = 'f564-som-mind';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({ weights: Array.from(weights), nodes: nodes.map(n => ({bmu:n.bmu, x:n.x, y:n.y})) }, 'main');
    status.textContent = 'Sealed to IndexedDB';
  } catch(e) { status.textContent = 'Seal failed (in-memory)'; }
}
document.getElementById('seal').onclick = seal;

async function load() {
  try {
    const db = await openDB();
    const req = db.transaction('state').objectStore('state').get('main');
    req.onsuccess = () => {
      if (req.result && req.result.weights) {
        weights = new Float32Array(req.result.weights);
        status.textContent = 'Loaded sealed map';
      } else initWeights();
    };
    req.onerror = initWeights;
  } catch { initWeights(); }
}
load();

function loop() {
  if (analyser) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    audioBins = [data[2]/255, data[6]/255, data[12]/255, data[20]/255];
  } else {
    audioBins = audioBins.map(v => v * 0.95);
  }
  const input = buildInput();
  const bmu = findBMU(input);
  lastBMU = bmu;
  qError = bmu.d;
  updateSOM(input, bmu);
  spawnOrMoveNode(bmu, input);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Drag support for nodes
let dragging = null, dragOffX=0, dragOffY=0;
document.addEventListener('pointerdown', e => {
  if (e.target.classList.contains('node')) {
    dragging = e.target;
    dragOffX = e.clientX - parseFloat(dragging.style.left);
    dragOffY = e.clientY - parseFloat(dragging.style.top);
  }
});
document.addEventListener('pointermove', e => {
  if (dragging) {
    dragging.style.left = (e.clientX - dragOffX) + 'px';
    dragging.style.top = (e.clientY - dragOffY) + 'px';
  }
});
document.addEventListener('pointerup', () => { dragging = null; });
