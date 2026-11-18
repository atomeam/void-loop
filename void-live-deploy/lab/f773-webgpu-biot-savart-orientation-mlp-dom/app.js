const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const probesEl = document.getElementById('probes');

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// Wires: {x1,y1,x2,y2, current}
let wires = [
  {x1: 0.2, y1: 0.3, x2: 0.8, y2: 0.3, current: 1},
  {x1: 0.2, y1: 0.7, x2: 0.8, y2: 0.7, current: -0.8},
  {x1: 0.3, y1: 0.2, x2: 0.3, y2: 0.8, current: 0.6},
  {x1: 0.7, y1: 0.2, x2: 0.7, y2: 0.8, current: -0.5}
];

// MLP: inputs [oriX, oriY, oriZ, ptrVX, ptrVY, timeSin] -> 4 currents
let mlp = {
  w1: Array(12).fill(0).map(() => Array(6).fill(0).map(() => (Math.random()-0.5)*0.5)),
  b1: Array(12).fill(0).map(() => (Math.random()-0.5)*0.2),
  w2: Array(4).fill(0).map(() => Array(12).fill(0).map(() => (Math.random()-0.5)*0.4)),
  b2: Array(4).fill(0).map(() => (Math.random()-0.5)*0.1)
};

function tanh(x) { return Math.tanh(x); }
function mlpForward(inp) {
  const h = mlp.b1.map((b,i) => {
    let s = b;
    for (let j=0; j<6; j++) s += mlp.w1[i][j] * inp[j];
    return tanh(s);
  });
  return mlp.b2.map((b,i) => {
    let s = b;
    for (let j=0; j<12; j++) s += mlp.w2[i][j] * h[j];
    return Math.tanh(s) * 2; // currents ~[-2,2]
  });
}

// Probes
const probes = [];
for (let i=0; i<6; i++) {
  const el = document.createElement('div');
  el.className = 'probe';
  el.textContent = 'M' + i;
  probesEl.appendChild(el);
  probes.push({
    x: 0.3 + Math.random()*0.4,
    y: 0.3 + Math.random()*0.4,
    vx: 0, vy: 0,
    q: (Math.random()-0.5)*2,
    el
  });
}

let orientation = {x:0, y:0, z:0};
let pointer = {x:0.5, y:0.5, vx:0, vy:0};
let lastPtr = {x:0.5, y:0.5};

addEventListener('pointermove', e => {
  pointer.x = e.clientX / innerWidth;
  pointer.y = e.clientY / innerHeight;
  pointer.vx = pointer.x - lastPtr.x;
  pointer.vy = pointer.y - lastPtr.y;
  lastPtr.x = pointer.x; lastPtr.y = pointer.y;
});

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orientation.x = (e.beta || 0) / 90;
    orientation.y = (e.gamma || 0) / 90;
    orientation.z = (e.alpha || 0) / 180;
  });
}

// Biot-Savart for a wire segment at point p (normalized coords)
function biotSavart(wire, px, py) {
  const dx = wire.x2 - wire.x1;
  const dy = wire.y2 - wire.y1;
  const len = Math.hypot(dx, dy) || 0.001;
  // Approximate: treat as many points or simple perpendicular field
  // Simple: B ~ I * cross(dl, r) / r^2 , sample midpoint
  const mx = (wire.x1 + wire.x2)/2;
  const my = (wire.y1 + wire.y2)/2;
  const rx = px - mx;
  const ry = py - my;
  const r2 = rx*rx + ry*ry + 0.01;
  // dl x r (out of plane for 2D)
  const cross = dx * ry - dy * rx;
  const Bmag = wire.current * cross / (r2 * Math.sqrt(r2));
  // Direction perpendicular to r for visualization; for force use Bz
  return { bz: Bmag * 0.05, // scaled
           bx: -ry * Bmag * 0.01, by: rx * Bmag * 0.01 }; // for arrows
}

function update() {
  const t = performance.now() / 1000;
  const inp = [
    orientation.x, orientation.y, orientation.z,
    pointer.vx * 10, pointer.vy * 10,
    Math.sin(t * 0.5)
  ];
  const currents = mlpForward(inp);
  wires.forEach((w, i) => w.current = currents[i] || 0);

  // Update probes
  probes.forEach(p => {
    let Bx=0, By=0, Bz=0;
    wires.forEach(w => {
      const b = biotSavart(w, p.x, p.y);
      Bx += b.bx; By += b.by; Bz += b.bz;
    });
    // Simple force: F = q * v x B  (approx B mostly z)
    const fx = p.q * (p.vy * Bz);
    const fy = p.q * (-p.vx * Bz);
    p.vx += fx * 0.05;
    p.vy += fy * 0.05;
    p.vx *= 0.98; p.vy *= 0.98;
    p.x += p.vx * 0.01;
    p.y += p.vy * 0.01;
    p.x = Math.max(0.05, Math.min(0.95, p.x));
    p.y = Math.max(0.05, Math.min(0.95, p.y));
    p.el.style.left = (p.x * 100) + '%';
    p.el.style.top = (p.y * 100) + '%';
    p.el.style.transform = `translate(-50%,-50%) rotate(${Math.atan2(p.vy,p.vx)*30}deg)`;
    const hue = 200 + Bz * 100;
    p.el.style.background = `hsla(${hue},70%,50%,0.35)`;
  });

  // Draw
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // Wires
  ctx.strokeStyle = '#66aaff';
  ctx.lineWidth = 3;
  wires.forEach(w => {
    ctx.beginPath();
    ctx.moveTo(w.x1*canvas.width, w.y1*canvas.height);
    ctx.lineTo(w.x2*canvas.width, w.y2*canvas.height);
    ctx.stroke();
    ctx.fillStyle = w.current > 0 ? '#0f0' : '#f44';
    ctx.font = '12px monospace';
    ctx.fillText(w.current.toFixed(2), ((w.x1+w.x2)/2)*canvas.width, ((w.y1+w.y2)/2)*canvas.height);
  });
  // Field arrows on grid
  ctx.strokeStyle = 'rgba(150,180,255,0.4)';
  ctx.lineWidth = 1;
  for (let gx=0.1; gx<0.9; gx+=0.1) {
    for (let gy=0.1; gy<0.9; gy+=0.1) {
      let bx=0, by=0;
      wires.forEach(w => {
        const b = biotSavart(w, gx, gy);
        bx += b.bx; by += b.by;
      });
      const mag = Math.hypot(bx, by) * 30;
      const ang = Math.atan2(by, bx);
      const sx = gx * canvas.width, sy = gy * canvas.height;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang)*mag, sy + Math.sin(ang)*mag);
      ctx.stroke();
    }
  }

  status.textContent = `Currents: ${currents.map(c=>c.toFixed(1)).join(', ')} | Ori: ${orientation.x.toFixed(2)},${orientation.y.toFixed(2)}`;
  requestAnimationFrame(update);
}
update();

// Seal / Reset
document.getElementById('seal').onclick = async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f773', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('mind');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mind','readwrite');
    tx.objectStore('mind').put({mlp, wires: wires.map(w=>({...w})), t:Date.now()}, 'best');
    status.textContent = 'Sealed to IndexedDB';
  } catch(e) { status.textContent = 'Seal failed (IDB)'; }
};

document.getElementById('reset').onclick = () => location.reload();

// Drag probes
probes.forEach(p => {
  let dragging = false;
  p.el.addEventListener('pointerdown', e => { dragging=true; p.el.setPointerCapture(e.pointerId); });
  p.el.addEventListener('pointermove', e => {
    if (!dragging) return;
    p.x = e.clientX / innerWidth;
    p.y = e.clientY / innerHeight;
  });
  p.el.addEventListener('pointerup', () => dragging=false);
});

status.textContent = 'Running — tilt or move pointer';
