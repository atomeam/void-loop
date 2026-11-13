const N = 160;
const PORTALS = 10;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// Boids state
const pos = new Float32Array(N * 2);
const vel = new Float32Array(N * 2);
for (let i = 0; i < N; i++) {
  pos[i*2] = Math.random() * W; pos[i*2+1] = Math.random() * H;
  vel[i*2] = (Math.random()-0.5)*2; vel[i*2+1] = (Math.random()-0.5)*2;
}

// Policy MLP: 6 → 8 → 4
const IN = 6, HID = 8, OUT = 4;
let w1 = Float32Array.from({length: IN*HID}, () => (Math.random()-0.5)*0.4);
let b1 = new Float32Array(HID);
let w2 = Float32Array.from({length: HID*OUT}, () => (Math.random()-0.5)*0.4);
let b2 = new Float32Array(OUT);
let params = { sep: 1.2, ali: 0.8, coh: 0.6, maxSpeed: 2.4 };
let fitness = 0;

function mlp(x) {
  const h = new Float32Array(HID);
  for (let j = 0; j < HID; j++) {
    let s = b1[j];
    for (let i = 0; i < IN; i++) s += x[i] * w1[i*HID + j];
    h[j] = Math.max(0, s);
  }
  const o = new Float32Array(OUT);
  for (let k = 0; k < OUT; k++) {
    let s = b2[k];
    for (let j = 0; j < HID; j++) s += h[j] * w2[j*OUT + k];
    o[k] = Math.tanh(s) * 0.15; // small deltas
  }
  return o;
}

// Portals
const portals = [];
for (let p = 0; p < PORTALS; p++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.innerHTML = `<strong>Probe ${p+1}</strong><span class="info">—</span>`;
  document.body.appendChild(el);
  portals.push({ el, idx: p * Math.floor(N / PORTALS) });
}

// Pointer
let pointer = { x: W/2, y: H/2, down: false };
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
addEventListener('pointerdown', e => { pointer.down = true; reward(); });
addEventListener('pointerup', () => pointer.down = false);

// Orientation
let tilt = { x: 0, y: 0 };
document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => { if (p === 'granted') listenOrient(); });
  } else listenOrient();
};
function listenOrient() {
  addEventListener('deviceorientation', e => {
    tilt.x = (e.gamma || 0) / 45;
    tilt.y = (e.beta || 0) / 45;
  });
  statusEl.textContent += '\ntilt on';
}

function reward() {
  fitness += 1;
  // simple reinforce: nudge weights a bit toward current good params
  for (let i = 0; i < w1.length; i++) w1[i] += (Math.random()-0.5)*0.02;
  for (let i = 0; i < w2.length; i++) w2[i] += (Math.random()-0.5)*0.02;
}

// Persistence
const DB = 'verse-f740-boids';
const BC = new BroadcastChannel('f740-genomes');
async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({
      w1: Array.from(w1), w2: Array.from(w2), b1: Array.from(b1), b2: Array.from(b2),
      params, fitness, t: Date.now()
    }, 'best');
    await new Promise(r => tx.oncomplete = r);
    BC.postMessage({ type: 'genome', w1: Array.from(w1), w2: Array.from(w2), fitness });
    statusEl.textContent = `sealed fitness=${fitness.toFixed(1)}`;
  } catch (e) { statusEl.textContent = 'IDB blocked'; }
}
BC.onmessage = e => {
  if (e.data.type === 'genome' && e.data.fitness > fitness + 2) {
    w1.set(e.data.w1); w2.set(e.data.w2);
    fitness = e.data.fitness;
    statusEl.textContent = 'adopted better genome';
  }
};
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => location.reload();

// Simulation loop
function step() {
  // stats
  let dens = 0, spd = 0, ali = 0;
  const neighR = 40;
  // simple O(N^2) for prototype clarity (optimize later)
  for (let i = 0; i < N; i++) {
    let fx = 0, fy = 0, cnt = 0, ax = 0, ay = 0, cx = 0, cy = 0;
    for (let j = 0; j < N; j++) if (i !== j) {
      const dx = pos[j*2] - pos[i*2], dy = pos[j*2+1] - pos[i*2+1];
      const d2 = dx*dx + dy*dy;
      if (d2 < neighR*neighR && d2 > 0) {
        const d = Math.sqrt(d2);
        // sep
        fx -= dx / d / d * params.sep;
        fy -= dy / d / d * params.sep;
        // ali
        ax += vel[j*2]; ay += vel[j*2+1];
        // coh
        cx += pos[j*2]; cy += pos[j*2+1];
        cnt++;
      }
    }
    if (cnt) {
      ax /= cnt; ay /= cnt;
      cx /= cnt; cy /= cnt;
      fx += (ax - vel[i*2]) * params.ali;
      fy += (ay - vel[i*2+1]) * params.ali;
      fx += (cx - pos[i*2]) * params.coh * 0.01;
      fy += (cy - pos[i*2+1]) * params.coh * 0.01;
      dens += cnt;
    }
    // predator / attractor
    const pdx = pointer.x - pos[i*2], pdy = pointer.y - pos[i*2+1];
    const pd = Math.hypot(pdx, pdy) + 1;
    if (pointer.down) {
      fx += pdx / pd * 1.5; fy += pdy / pd * 1.5; // attract
    } else if (pd < 80) {
      fx -= pdx / pd * 2; fy -= pdy / pd * 2; // repel
    }
    // tilt bias
    fx += tilt.x * 0.3; fy += tilt.y * 0.3;

    vel[i*2] = (vel[i*2] + fx * 0.1) * 0.98;
    vel[i*2+1] = (vel[i*2+1] + fy * 0.1) * 0.98;
    const sp = Math.hypot(vel[i*2], vel[i*2+1]);
    if (sp > params.maxSpeed) {
      vel[i*2] = vel[i*2] / sp * params.maxSpeed;
      vel[i*2+1] = vel[i*2+1] / sp * params.maxSpeed;
    }
    pos[i*2] = (pos[i*2] + vel[i*2] + W) % W;
    pos[i*2+1] = (pos[i*2+1] + vel[i*2+1] + H) % H;
    spd += sp;
    ali += Math.abs(vel[i*2]) + Math.abs(vel[i*2+1]);
  }
  dens /= N; spd /= N; ali /= N;

  // MLP update params
  const inp = [
    Math.min(1, dens / 8),
    Math.min(1, spd / 3),
    Math.min(1, ali / 2),
    Math.min(1, Math.hypot(pointer.x - W/2, pointer.y - H/2) / (W/2)),
    Math.max(-1, Math.min(1, tilt.x)),
    Math.max(-1, Math.min(1, tilt.y))
  ];
  const d = mlp(inp);
  params.sep = Math.max(0.2, Math.min(3, params.sep + d[0]));
  params.ali = Math.max(0.1, Math.min(2, params.ali + d[1]));
  params.coh = Math.max(0.1, Math.min(2, params.coh + d[2]));
  params.maxSpeed = Math.max(1, Math.min(4, params.maxSpeed + d[3]));

  // draw
  ctx.fillStyle = 'rgba(10,12,16,0.25)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#5ce1e6';
  for (let i = 0; i < N; i++) {
    ctx.beginPath();
    ctx.arc(pos[i*2], pos[i*2+1], 1.8, 0, 6.28);
    ctx.fill();
  }

  // portals
  for (const p of portals) {
    const i = p.idx;
    const x = pos[i*2], y = pos[i*2+1];
    const ang = Math.atan2(vel[i*2+1], vel[i*2]);
    const sp = Math.hypot(vel[i*2], vel[i*2+1]);
    p.el.style.left = (x - 70) + 'px';
    p.el.style.top = (y - 35) + 'px';
    p.el.style.transform = `rotate(${ang}rad) scale(${0.7 + Math.min(0.6, sp/3)})`;
    const hue = (180 + ang * 57 + dens * 40) % 360;
    p.el.style.borderColor = `hsl(${hue},70%,60%)`;
    p.el.querySelector('.info').textContent = `spd ${sp.toFixed(1)} dens~${dens.toFixed(1)}`;
  }

  statusEl.textContent = `fit ${fitness.toFixed(0)} | sep ${params.sep.toFixed(2)} ali ${params.ali.toFixed(2)} coh ${params.coh.toFixed(2)} spd ${params.maxSpeed.toFixed(2)}\nagents ${N} portals ${PORTALS}`;
  requestAnimationFrame(step);
}
requestAnimationFrame(step);
