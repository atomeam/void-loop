const N = 14;
const stage = document.getElementById('stage');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const DB_NAME = 'verse-f856-chain';
const BC = new BroadcastChannel('f856-genome');

let portals = [];
let restLengths = [];
let stiffness = 0.8;
let damping = 0.92;
let orient = { beta:0, gamma:0 };
let pointers = new Map(); // id -> {x,y, portalIdx}

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

function makePortals() {
  stage.innerHTML = '';
  portals = [];
  restLengths = [];
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = 'V' + i;
    el.dataset.i = i;
    stage.appendChild(el);
    const x = innerWidth * 0.5 + (i - N/2) * 40;
    const y = innerHeight * 0.5 + Math.sin(i * 0.6) * 30;
    portals.push({ el, x, y, px:x, py:y, pinned:false, reward:0 });
    if (i) restLengths.push(42);
  }
}
makePortals();

function verletStep() {
  for (const p of portals) {
    if (p.pinned) continue;
    const vx = (p.x - p.px) * damping;
    const vy = (p.y - p.py) * damping;
    p.px = p.x; p.py = p.y;
    p.x += vx; p.y += vy;
    // soft bounds
    p.x = Math.max(40, Math.min(innerWidth-40, p.x));
    p.y = Math.max(40, Math.min(innerHeight-40, p.y));
  }
  // distance constraints
  for (let iter = 0; iter < 4; iter++) {
    for (let i = 0; i < N-1; i++) {
      const a = portals[i], b = portals[i+1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const diff = (dist - restLengths[i]) / dist * stiffness * 0.5;
      if (!a.pinned) { a.x += dx * diff; a.y += dy * diff; }
      if (!b.pinned) { b.x -= dx * diff; b.y -= dy * diff; }
    }
  }
  for (const p of portals) {
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
  }
}

function drawLinks() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = 'rgba(88,166,255,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < N-1; i++) {
    const a = portals[i], b = portals[i+1];
    if (i===0) ctx.moveTo(a.x, a.y); else ctx.lineTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}

function loop() {
  verletStep();
  drawLinks();
  requestAnimationFrame(loop);
}
loop();

// orientation residual → stiffness
addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
  const mag = Math.hypot(orient.beta, orient.gamma) / 90;
  stiffness = 0.4 + Math.min(1.2, mag * 1.1);
  statusEl.textContent = `stiff ${stiffness.toFixed(2)}`;
});

// pointer control
function onDown(e) {
  const id = e.pointerId ?? 'p';
  const x = e.clientX ?? e.touches?.[0]?.clientX;
  const y = e.clientY ?? e.touches?.[0]?.clientY;
  let best = -1, bestD = 60;
  portals.forEach((p,i) => {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) { bestD = d; best = i; }
  });
  if (best >= 0) {
    portals[best].pinned = true;
    portals[best].el.classList.add('pinned');
    pointers.set(id, { x, y, idx: best });
  }
}
function onMove(e) {
  const id = e.pointerId ?? 'p';
  const ptr = pointers.get(id);
  if (!ptr) return;
  const x = e.clientX ?? e.touches?.[0]?.clientX;
  const y = e.clientY ?? e.touches?.[0]?.clientY;
  const p = portals[ptr.idx];
  p.x = x; p.y = y;
  p.px = x; p.py = y;
}
function onUp(e) {
  const id = e.pointerId ?? 'p';
  const ptr = pointers.get(id);
  if (ptr) {
    portals[ptr.idx].pinned = false;
    portals[ptr.idx].el.classList.remove('pinned');
    pointers.delete(id);
  }
}
stage.addEventListener('pointerdown', onDown);
addEventListener('pointermove', onMove);
addEventListener('pointerup', onUp);
addEventListener('pointercancel', onUp);

// WebXR hand fallback sketch (progressive)
if (navigator.xr) {
  statusEl.textContent += ' · XR available';
  // Full hand tracking would require session request; pointer path remains primary for this single-file prototype
}

// reward mutation on click
stage.addEventListener('click', e => {
  if (e.target.classList.contains('portal')) {
    const i = +e.target.dataset.i;
    if (i < N-1) {
      restLengths[i] += (Math.random()-0.5)*8;
      restLengths[i] = Math.max(28, Math.min(70, restLengths[i]));
      portals[i].reward += 1;
    }
  }
});

// seal
document.getElementById('seal').onclick = async () => {
  const genome = { restLengths: [...restLengths], stiffness, ts: Date.now() };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes', { keyPath: 'ts' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(genome);
    BC.postMessage({ type:'genome', genome });
    statusEl.textContent = 'sealed';
  } catch(err) {
    statusEl.textContent = 'seal failed (memory only)';
  }
};

BC.onmessage = e => {
  if (e.data?.type === 'genome' && e.data.genome?.restLengths) {
    restLengths = e.data.genome.restLengths.slice();
    stiffness = e.data.genome.stiffness || stiffness;
    statusEl.textContent = 'adopted genome';
  }
};

// restore
(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej();
    });
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').getAll();
    req.onsuccess = () => {
      const all = req.result;
      if (all.length) {
        const best = all.sort((a,b)=>b.ts-a.ts)[0];
        restLengths = best.restLengths;
        stiffness = best.stiffness || stiffness;
        statusEl.textContent = 'restored';
      }
    };
  } catch (e) { console.debug("lab f856-webxr-hand-verlet-portal-chain-mind:", e); }
})();
