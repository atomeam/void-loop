const N = 12;
const points = [];
const constraints = [];
let mlp = { w1: [], b1: [], w2: [], b2: [] }; // 8-12-4
let energy = 0;
let xrSession = null;
const channel = new BroadcastChannel('f876-genome');

function initMLP() {
  mlp.w1 = Array(12*8).fill(0).map(() => (Math.random()-0.5)*0.2);
  mlp.b1 = Array(12).fill(0);
  mlp.w2 = Array(4*12).fill(0).map(() => (Math.random()-0.5)*0.2);
  mlp.b2 = Array(4).fill(0);
}
function forward(inputs) {
  const h = [];
  for (let i=0; i<12; i++) {
    let s = mlp.b1[i];
    for (let j=0; j<8; j++) s += inputs[j] * mlp.w1[i*8+j];
    h[i] = Math.tanh(s);
  }
  const o = [];
  for (let i=0; i<4; i++) {
    let s = mlp.b2[i];
    for (let j=0; j<12; j++) s += h[j] * mlp.w2[i*12+j];
    o[i] = Math.tanh(s)*0.02;
  }
  return o;
}

function initLinkage() {
  points.length = 0; constraints.length = 0;
  const svg = document.getElementById('svg');
  svg.innerHTML = '';
  for (let i=0; i<N; i++) {
    const p = { x: 200 + (i%4)*120, y: 150 + Math.floor(i/4)*100, px:0, py:0, pinned:false };
    p.px = p.x; p.py = p.y;
    points.push(p);
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('r','8'); c.setAttribute('class','node');
    c.addEventListener('pointerdown', e => { p.pinned = !p.pinned; e.stopPropagation(); });
    svg.appendChild(c);
    p.el = c;
  }
  for (let i=0; i<N-1; i++) {
    if (i%4 !== 3) constraints.push({ a:i, b:i+1, rest:120 });
    if (i+4 < N) constraints.push({ a:i, b:i+4, rest:100 });
  }
  for (let c of constraints) {
    const l = document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('class','rod');
    svg.appendChild(l);
    c.el = l;
  }
}
function verlet() {
  const g = window.orient ? window.orient.beta/90 : 0;
  energy = 0;
  for (let p of points) {
    if (p.pinned) continue;
    const vx = p.x - p.px, vy = p.y - p.py;
    p.px = p.x; p.py = p.y;
    p.x += vx * 0.98;
    p.y += vy * 0.98 + 0.3 + g*0.5;
  }
  for (let iter=0; iter<4; iter++) {
    for (let c of constraints) {
      const a = points[c.a], b = points[c.b];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx,dy) || 1;
      const diff = (d - c.rest) / d * 0.5;
      if (!a.pinned) { a.x += dx*diff; a.y += dy*diff; }
      if (!b.pinned) { b.x -= dx*diff; b.y -= dy*diff; }
      energy += Math.abs(d - c.rest);
    }
  }
  // render
  for (let p of points) {
    p.el.setAttribute('cx', p.x); p.el.setAttribute('cy', p.y);
    p.el.setAttribute('fill', p.pinned ? '#f84' : '#4af');
  }
  for (let c of constraints) {
    const a = points[c.a], b = points[c.b];
    c.el.setAttribute('x1', a.x); c.el.setAttribute('y1', a.y);
    c.el.setAttribute('x2', b.x); c.el.setAttribute('y2', b.y);
  }
  document.getElementById('score').textContent = energy.toFixed(1);
}

let handTargets = [];
function applyHands() {
  if (!handTargets.length) return;
  for (let t of handTargets) {
    let best = 0, bd = 1e9;
    for (let i=0; i<points.length; i++) {
      const d = Math.hypot(points[i].x - t.x, points[i].y - t.y);
      if (d < bd) { bd = d; best = i; }
    }
    const p = points[best];
    p.x += (t.x - p.x)*0.15; p.y += (t.y - p.y)*0.15;
  }
}

async function startXR() {
  if (!navigator.xr) { document.getElementById('status').textContent = 'WebXR not available'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    document.getElementById('status').textContent = 'XR active (hand tracking if supported)';
    xrSession.addEventListener('end', () => { xrSession = null; document.getElementById('status').textContent = 'XR ended'; });
    // simplified loop; real would use XRFrame
    const loop = () => {
      if (!xrSession) return;
      // mock hand positions from pointer for demo if no real hands
      requestAnimationFrame(loop);
    };
    loop();
  } catch(e) { document.getElementById('status').textContent = 'XR failed: ' + e.message; }
}

document.getElementById('xrBtn').onclick = startXR;
document.getElementById('sealBtn').onclick = async () => {
  const genome = { mlp, rests: constraints.map(c=>c.rest), energy };
  const db = await indexedDB.open('verse-f876',1);
  db.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
  db.onsuccess = e => {
    const tx = e.target.result.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(genome, 'current');
    channel.postMessage(genome);
    document.getElementById('status').textContent = 'Sealed & broadcast';
  };
};
document.getElementById('resetBtn').onclick = () => { initMLP(); initLinkage(); };

channel.onmessage = e => {
  if (e.data.energy < energy) {
    mlp = e.data.mlp;
    e.data.rests.forEach((r,i) => { if (constraints[i]) constraints[i].rest = r; });
    document.getElementById('status').textContent = 'Better genome received';
  }
};

window.addEventListener('deviceorientation', e => { window.orient = e; });

// pointer as hand fallback
let drag = null;
document.addEventListener('pointermove', e => {
  if (drag) { drag.x = e.clientX; drag.y = e.clientY; }
  handTargets = [{x:e.clientX, y:e.clientY}];
});
document.addEventListener('pointerup', () => drag=null);
document.querySelectorAll('.node').forEach(n => n.addEventListener('pointerdown', e => { drag = points.find(p=>p.el===n); }));

initMLP();
initLinkage();
function loop() {
  applyHands();
  const inputs = [0,0,0,0, window.orient?.beta||0, window.orient?.gamma||0, energy/100, Math.random()*0.1];
  const deltas = forward(inputs);
  for (let i=0; i<Math.min(4,constraints.length); i++) constraints[i].rest = Math.max(40, constraints[i].rest + deltas[i]*50);
  verlet();
  requestAnimationFrame(loop);
}
loop();
