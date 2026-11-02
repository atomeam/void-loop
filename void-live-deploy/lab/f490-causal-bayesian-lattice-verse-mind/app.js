const COLS = 6, ROWS = 6, N = COLS * ROWS;
const BINS = 4;
const BIN_HUES = [0, 120, 210, 45]; // red, green, blue, yellow-ish
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const cards = [];
let beliefs = []; // Float32Array per card
let positions = []; // {x,y}
let pointer = { x: window.innerWidth/2, y: window.innerHeight/2, active: false };
let dragging = null;
let dragOffset = {x:0,y:0};
let lastSeal = null;

function initLattice() {
  stage.innerHTML = '';
  cards.length = 0;
  beliefs = [];
  positions = [];
  const w = window.innerWidth, h = window.innerHeight;
  const margin = 100;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.i = i;
      const label = document.createElement('div');
      label.className = 'label';
      card.appendChild(label);
      stage.appendChild(card);
      cards.push(card);
      // uniform prior
      const b = new Float32Array(BINS);
      b.fill(1 / BINS);
      beliefs.push(b);
      positions.push({
        x: margin + (c / (COLS-1)) * (w - 2*margin),
        y: margin + (r / (ROWS-1)) * (h - 2*margin)
      });
    }
  }
  layout();
}

function layout() {
  cards.forEach((card, i) => {
    const p = positions[i];
    card.style.left = (p.x - 36) + 'px';
    card.style.top = (p.y - 36) + 'px';
  });
}

function entropy(b) {
  let e = 0;
  for (let k = 0; k < BINS; k++) {
    if (b[k] > 1e-8) e -= b[k] * Math.log(b[k]);
  }
  return e / Math.log(BINS); // normalized 0-1
}

function argmax(b) {
  let m = 0, mi = 0;
  for (let k = 0; k < BINS; k++) if (b[k] > m) { m = b[k]; mi = k; }
  return mi;
}

function updateVisuals() {
  cards.forEach((card, i) => {
    const b = beliefs[i];
    const ent = entropy(b);
    const conf = 1 - ent;
    const bin = argmax(b);
    const hue = BIN_HUES[bin];
    card.style.background = `hsla(${hue}, 70%, ${30 + conf*20}%, 0.9)`;
    card.style.transform = `scale(${0.85 + conf*0.3}) rotate(${(bin-1.5)*4}deg)`;
    card.style.boxShadow = `0 0 ${8 + conf*20}px hsla(${hue}, 80%, 60%, ${0.3+conf*0.4})`;
    card.querySelector('.label').textContent = ['R','G','B','Y'][bin] + ' ' + conf.toFixed(2);
  });
}

function injectEvidence() {
  if (!pointer.active && !dragging) return;
  const px = pointer.x, py = pointer.y;
  const sigma = 140;
  for (let i = 0; i < N; i++) {
    const p = positions[i];
    const dx = p.x - px, dy = p.y - py;
    const dist2 = dx*dx + dy*dy;
    const w = Math.exp(-dist2 / (2*sigma*sigma));
    if (w < 0.05) continue;
    // preferred bin from angle or motion proxy
    const ang = Math.atan2(dy, dx);
    const pref = Math.floor(((ang + Math.PI) / (2*Math.PI)) * BINS) % BINS;
    const b = beliefs[i];
    const like = new Float32Array(BINS);
    like[pref] = 0.7 + 0.3*w;
    for (let k = 0; k < BINS; k++) if (k !== pref) like[k] = 0.1;
    // normalize like
    let s = 0; for (let k=0;k<BINS;k++) s+=like[k];
    for (let k=0;k<BINS;k++) like[k]/=s;
    // Bayesian: posterior ∝ prior * like
    let sum = 0;
    for (let k=0;k<BINS;k++) {
      b[k] *= like[k];
      sum += b[k];
    }
    if (sum > 0) for (let k=0;k<BINS;k++) b[k] /= sum;
  }
}

function propagate() {
  const next = beliefs.map(b => new Float32Array(b));
  for (let i = 0; i < N; i++) {
    const r = Math.floor(i / COLS), c = i % COLS;
    const neighbors = [];
    if (c>0) neighbors.push(i-1);
    if (c<COLS-1) neighbors.push(i+1);
    if (r>0) neighbors.push(i-COLS);
    if (r<ROWS-1) neighbors.push(i+COLS);
    if (neighbors.length === 0) continue;
    const msg = new Float32Array(BINS);
    neighbors.forEach(j => {
      for (let k=0;k<BINS;k++) msg[k] += beliefs[j][k];
    });
    for (let k=0;k<BINS;k++) msg[k] /= neighbors.length;
    // mix
    const mix = 0.15;
    let sum = 0;
    for (let k=0;k<BINS;k++) {
      next[i][k] = (1-mix)*beliefs[i][k] + mix*msg[k];
      sum += next[i][k];
    }
    if (sum>0) for (let k=0;k<BINS;k++) next[i][k] /= sum;
  }
  beliefs = next;
}

function mildAttraction() {
  // gentle pull toward similar-belief neighbors
  const forces = positions.map(() => ({x:0,y:0}));
  for (let i = 0; i < N; i++) {
    const r = Math.floor(i / COLS), c = i % COLS;
    const bi = argmax(beliefs[i]);
    const neigh = [];
    if (c>0) neigh.push(i-1);
    if (c<COLS-1) neigh.push(i+1);
    if (r>0) neigh.push(i-COLS);
    if (r<ROWS-1) neigh.push(i+COLS);
    neigh.forEach(j => {
      if (argmax(beliefs[j]) === bi) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        forces[i].x += dx * 0.002;
        forces[i].y += dy * 0.002;
      }
    });
  }
  for (let i = 0; i < N; i++) {
    if (dragging && parseInt(cards[i].dataset.i) === dragging) continue;
    positions[i].x += forces[i].x;
    positions[i].y += forces[i].y;
    // soft bounds
    positions[i].x = Math.max(50, Math.min(window.innerWidth-50, positions[i].x));
    positions[i].y = Math.max(50, Math.min(window.innerHeight-50, positions[i].y));
  }
}

function tick() {
  injectEvidence();
  propagate();
  mildAttraction();
  layout();
  updateVisuals();
  requestAnimationFrame(tick);
}

// Pointer
stage.addEventListener('pointermove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.active = true;
  if (dragging !== null) {
    const i = dragging;
    positions[i].x = e.clientX - dragOffset.x;
    positions[i].y = e.clientY - dragOffset.y;
  }
});
stage.addEventListener('pointerdown', e => {
  const t = e.target.closest('.card');
  if (t) {
    dragging = parseInt(t.dataset.i);
    const rect = t.getBoundingClientRect();
    dragOffset.x = e.clientX - (positions[dragging].x);
    dragOffset.y = e.clientY - (positions[dragging].y);
    t.setPointerCapture(e.pointerId);
  }
});
stage.addEventListener('pointerup', () => { dragging = null; pointer.active = false; });
stage.addEventListener('pointerleave', () => { pointer.active = false; });

// Synthetic fallback motion
setInterval(() => {
  if (!pointer.active && !dragging) {
    pointer.x += (Math.random()-0.5)*40;
    pointer.y += (Math.random()-0.5)*40;
    pointer.x = Math.max(0, Math.min(window.innerWidth, pointer.x));
    pointer.y = Math.max(0, Math.min(window.innerHeight, pointer.y));
  }
}, 80);

// Seal / Restore
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function seal() {
  const state = {
    beliefs: beliefs.map(b => Array.from(b)),
    positions: positions.map(p => ({...p}))
  };
  const json = JSON.stringify(state);
  const hash = await sha256(json);
  try {
    const db = await openDB();
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({ id: 'latest', hash, state, ts: Date.now() });
    await tx.complete;
    lastSeal = hash.slice(0,8);
    statusEl.textContent = `Sealed · ${lastSeal}`;
  } catch(e) {
    statusEl.textContent = 'Seal failed (IDB)';
  }
}

async function restore() {
  try {
    const db = await openDB();
    const tx = db.transaction('seals', 'readonly');
    const req = tx.objectStore('seals').get('latest');
    req.onsuccess = () => {
      const rec = req.result;
      if (!rec) { statusEl.textContent = 'No seal'; return; }
      beliefs = rec.state.beliefs.map(a => new Float32Array(a));
      positions = rec.state.positions;
      layout();
      updateVisuals();
      statusEl.textContent = `Restored · ${rec.hash.slice(0,8)}`;
    };
  } catch(e) {
    statusEl.textContent = 'Restore failed';
  }
}

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f490-bayesian-lattice', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seals', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('reset').onclick = () => { initLattice(); statusEl.textContent = 'Reset'; };

window.addEventListener('resize', () => { /* keep relative */ });

initLattice();
requestAnimationFrame(tick);
