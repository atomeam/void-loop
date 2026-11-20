const N = 8; // 8x8 lattice
const UNITS = N * N;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const energyEl = document.getElementById('energy');

let weights = new Float32Array(UNITS * UNITS);
let state = new Float32Array(UNITS); // ±1
let cue = new Uint8Array(UNITS);
let energy = 0;
let xrSession = null;
let handPose = null;

function idx(x, y) { return y * N + x; }

function initWeights() {
  for (let i = 0; i < UNITS; i++) {
    for (let j = 0; j < UNITS; j++) {
      weights[i * UNITS + j] = (i === j) ? 0 : (Math.random() * 0.2 - 0.1);
    }
  }
  // Make symmetric
  for (let i = 0; i < UNITS; i++) {
    for (let j = i + 1; j < UNITS; j++) {
      const avg = (weights[i * UNITS + j] + weights[j * UNITS + i]) * 0.5;
      weights[i * UNITS + j] = weights[j * UNITS + i] = avg;
    }
  }
}

function randomState() {
  for (let i = 0; i < UNITS; i++) state[i] = Math.random() > 0.5 ? 1 : -1;
}

function computeEnergy() {
  let e = 0;
  for (let i = 0; i < UNITS; i++) {
    for (let j = i + 1; j < UNITS; j++) {
      e -= weights[i * UNITS + j] * state[i] * state[j];
    }
  }
  return e;
}

function recall(maxSteps = 24) {
  const temp = new Float32Array(state);
  for (let step = 0; step < maxSteps; step++) {
    let changed = false;
    for (let i = 0; i < UNITS; i++) {
      if (cue[i]) continue; // clamped
      let sum = 0;
      for (let j = 0; j < UNITS; j++) {
        if (i !== j) sum += weights[i * UNITS + j] * temp[j];
      }
      const newS = sum >= 0 ? 1 : -1;
      if (newS !== temp[i]) { temp[i] = newS; changed = true; }
    }
    if (!changed) break;
  }
  state.set(temp);
  energy = computeEnergy();
}

function hebbianUpdate(pattern) {
  const scale = 1 / UNITS;
  for (let i = 0; i < UNITS; i++) {
    for (let j = i + 1; j < UNITS; j++) {
      const dw = scale * pattern[i] * pattern[j];
      weights[i * UNITS + j] += dw;
      weights[j * UNITS + i] += dw;
      // clamp
      weights[i * UNITS + j] = Math.max(-1, Math.min(1, weights[i * UNITS + j]));
      weights[j * UNITS + i] = weights[i * UNITS + j];
    }
  }
}

function setCueFromPoint(px, py) {
  cue.fill(0);
  const rect = canvas.getBoundingClientRect();
  const cellW = rect.width / N;
  const cellH = rect.height / N;
  const cx = Math.floor(px / cellW);
  const cy = Math.floor(py / cellH);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && x < N && y >= 0 && y < N) {
        const i = idx(x, y);
        cue[i] = 1;
        state[i] = 1; // force on for cue
      }
    }
  }
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function render() {
  const w = canvas.width, h = canvas.height;
  const cellW = w / N, cellH = h / N;
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = idx(x, y);
      const on = state[i] > 0;
      const cued = cue[i];
      ctx.fillStyle = on ? (cued ? '#ff6b9d' : '#7cf7ff') : '#1a1a2e';
      ctx.globalAlpha = on ? 0.85 : 0.4;
      ctx.fillRect(x * cellW + 1, y * cellH + 1, cellW - 2, cellH - 2);
    }
  }
  ctx.globalAlpha = 1;
  energyEl.textContent = `E: ${energy.toFixed(1)}`;
}

function loop() {
  if (handPose) {
    setCueFromPoint(handPose.x * canvas.width, handPose.y * canvas.height);
  }
  recall();
  render();
  requestAnimationFrame(loop);
}

// Pointer
canvas.addEventListener('pointermove', e => {
  if (!xrSession) {
    setCueFromPoint(e.clientX, e.clientY);
    statusEl.textContent = 'Pointer cue → recalling';
  }
});
canvas.addEventListener('pointerdown', e => {
  setCueFromPoint(e.clientX, e.clientY);
});

// Buttons
document.getElementById('train').onclick = () => {
  hebbianUpdate(state);
  statusEl.textContent = 'Pattern stored via Hebbian';
};
document.getElementById('reset').onclick = () => {
  initWeights();
  randomState();
  statusEl.textContent = 'Weights reset';
};
document.getElementById('seal').onclick = async () => {
  const data = { weights: Array.from(weights), ts: Date.now() };
  try {
    const db = await openDB();
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(data, 'f811');
    await tx.complete;
    statusEl.textContent = 'Genome sealed to IndexedDB';
    const bc = new BroadcastChannel('f811-genome');
    bc.postMessage({ type: 'genome', data });
  } catch (err) {
    statusEl.textContent = 'Seal failed (private mode?)';
  }
};

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('verse-f811', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function loadGenome() {
  try {
    const db = await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('f811');
    return new Promise(r => { req.onsuccess = () => r(req.result); });
  } catch { return null; }
}

// Broadcast receive
const bc = new BroadcastChannel('f811-genome');
bc.onmessage = ev => {
  if (ev.data?.type === 'genome' && ev.data.data?.weights) {
    weights.set(ev.data.data.weights);
    statusEl.textContent = 'Received genome via BroadcastChannel';
  }
};

// WebXR hand tracking (optional)
document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { statusEl.textContent = 'WebXR not available'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    statusEl.textContent = 'WebXR session started (hand tracking if supported)';
    xrSession.addEventListener('end', () => { xrSession = null; handPose = null; statusEl.textContent = 'WebXR ended'; });
    const refSpace = await xrSession.requestReferenceSpace('local');
    function onXRFrame(t, frame) {
      if (!xrSession) return;
      for (const src of xrSession.inputSources) {
        if (src.hand) {
          const joint = src.hand.get('index-finger-tip') || src.hand.get('wrist');
          if (joint) {
            const jp = frame.getJointPose(joint, refSpace);
            if (jp) {
              handPose = { x: 0.5 + jp.transform.position.x * 0.3, y: 0.5 - jp.transform.position.y * 0.3 };
            }
          }
        }
      }
      xrSession.requestAnimationFrame(onXRFrame);
    }
    xrSession.requestAnimationFrame(onXRFrame);
  } catch (e) {
    statusEl.textContent = 'WebXR failed: ' + e.message;
  }
};

// Init
(async () => {
  const saved = await loadGenome();
  if (saved?.weights) {
    weights.set(saved.weights);
    statusEl.textContent = 'Restored sealed genome';
  } else {
    initWeights();
  }
  randomState();
  loop();
})();
