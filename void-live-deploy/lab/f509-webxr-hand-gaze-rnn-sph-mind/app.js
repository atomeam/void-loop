const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 72;
const particles = [];
const h = 28; // smoothing length
const mass = 1;
let viscosity = 0.08, pressureK = 0.4, gravity = {x:0, y:0.02};
let rnn = null, agents = [], active = 0;

function rand(a,b){ return a + Math.random()*(b-a); }

class Particle {
  constructor() {
    this.x = rand(50, W-50); this.y = rand(50, H-50);
    this.vx = 0; this.vy = 0;
    this.density = 0; this.pressure = 0;
  }
}

for (let i=0; i<N; i++) particles.push(new Particle());

// Tiny causal RNN: inputs [handX, handY, gazeX, gazeY, tiltX, tiltY, densAvg, time]
function makeRNN() {
  const inS=8, hid=12, out=3;
  const w = new Float32Array(inS*hid + hid*hid + hid*out);
  for (let i=0; i<w.length; i++) w[i] = (Math.random()-0.5)*0.3;
  let h = new Float32Array(hid);
  return {
    w, h,
    forward(inp) {
      // simple RNN step
      const Wh = w.slice(0, inS*hid);
      const Uh = w.slice(inS*hid, inS*hid + hid*hid);
      const Wo = w.slice(inS*hid + hid*hid);
      let nh = new Float32Array(hid);
      for (let j=0; j<hid; j++) {
        let s = 0;
        for (let i=0; i<inS; i++) s += inp[i] * Wh[i*hid + j];
        for (let k=0; k<hid; k++) s += h[k] * Uh[k*hid + j];
        nh[j] = Math.tanh(s);
      }
      h = nh;
      const out = [0,0,0];
      for (let o=0; o<out.length; o++) {
        let s = 0;
        for (let j=0; j<hid; j++) s += h[j] * Wo[j*out.length + o];
        out[o] = Math.tanh(s);
      }
      return out;
    },
    clone() { const r = makeRNN(); r.w.set(this.w); return r; }
  };
}

function sealGenome(r) {
  const arr = Array.from(r.w);
  const str = JSON.stringify(arr);
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(buf => {
    const hash = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    return { hash, weights: arr, visc: viscosity, press: pressureK };
  });
}

agents = [ { rnn: makeRNN(), fitness: 0, name: 'A' }, { rnn: makeRNN(), fitness: 0, name: 'B' } ];
rnn = agents[0].rnn;

// IndexedDB
let db;
const req = indexedDB.open('F509SPH', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', { keyPath: 'id' });
req.onsuccess = e => { db = e.target.result; restore(); };

function saveState() {
  if (!db) return;
  sealGenome(rnn).then(g => {
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({ id: 'current', ...g, agents: agents.map(a=>({w:Array.from(a.rnn.w), f:a.fitness})) });
  });
}
function restore() {
  if (!db) return;
  const tx = db.transaction('genomes','readonly');
  const g = tx.objectStore('genomes').get('current');
  g.onsuccess = e => {
    if (e.target.result) {
      const d = e.target.result;
      rnn.w.set(d.weights);
      viscosity = d.visc || 0.08; pressureK = d.press || 0.4;
      status.textContent = 'Restored sealed genome';
    }
  };
}

// BroadcastChannel transfer
const bc = new BroadcastChannel('f509-sph');
bc.onmessage = e => {
  if (e.data.type === 'genome') {
    const g = e.data.g;
    agents[1].rnn.w.set(g.weights);
    status.textContent = 'Received genome via Broadcast';
  }
};
document.getElementById('transfer').onclick = () => {
  sealGenome(rnn).then(g => bc.postMessage({ type:'genome', g }));
  status.textContent = 'Transferred genome';
};
document.getElementById('seal').onclick = () => { saveState(); status.textContent = 'Sealed to IndexedDB'; };
document.getElementById('restore').onclick = restore;

// Inputs
let hand = {x:0.5, y:0.5}, gaze = {x:0.5, y:0.5}, tilt = {x:0, y:0};
let pointer = {x:W/2, y:H/2, down:false};
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; hand.x = e.clientX/W; hand.y = e.clientY/H; });
canvas.addEventListener('pointerdown', () => pointer.down = true);
canvas.addEventListener('pointerup', () => pointer.down = false);
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    tilt.x = (e.gamma||0)/90; tilt.y = (e.beta||0)/90;
  });
}

// WebXR fallback attempt
let xrSession = null;
document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { status.textContent = 'WebXR not available'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['hand-tracking'] });
    status.textContent = 'XR session started (hand/gaze proxy via pointer)';
    // Simplified: in real XR we'd poll getPose / hand joints; here we note it
  } catch(err) { status.textContent = 'XR failed: ' + err.message; }
};

const status = document.getElementById('status');
const fitnessEl = document.getElementById('fitness');
const paramsEl = document.getElementById('params');
let orbs = [];

function spawnOrb(x, y, dens) {
  if (orbs.length > 6) return;
  const el = document.createElement('div');
  el.className = 'orb';
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el.style.transform = `scale(${0.6 + dens*0.8})`;
  el.onclick = () => { agents[active].fitness += 5; status.textContent = 'Orb reinforced'; };
  document.body.appendChild(el);
  orbs.push({el, x, y, life: 180});
}

function step() {
  // RNN forward
  const densAvg = particles.reduce((s,p)=>s+p.density,0)/N;
  const inp = [hand.x, hand.y, gaze.x, gaze.y, tilt.x, tilt.y, densAvg, performance.now()/10000];
  const out = rnn.forward(inp);
  viscosity = 0.04 + (out[0]+1)*0.08;
  pressureK = 0.2 + (out[1]+1)*0.4;
  gravity.x = tilt.x * 0.03 + out[2]*0.01;
  gravity.y = 0.015 + tilt.y*0.02;

  // SPH-inspired
  // density
  for (let p of particles) {
    p.density = 0;
    for (let q of particles) {
      const dx = p.x - q.x, dy = p.y - q.y;
      const r2 = dx*dx + dy*dy;
      if (r2 < h*h && r2 > 0) {
        const r = Math.sqrt(r2);
        const qh = r/h;
        const w = (1 - qh)*(1 - qh);
        p.density += mass * w;
      }
    }
    p.density = Math.max(p.density, 0.1);
    p.pressure = pressureK * (p.density - 1.2);
  }
  // forces
  for (let p of particles) {
    let fx = gravity.x, fy = gravity.y;
    for (let q of particles) {
      if (p === q) continue;
      const dx = p.x - q.x, dy = p.y - q.y;
      const r2 = dx*dx + dy*dy;
      if (r2 < h*h && r2 > 1) {
        const r = Math.sqrt(r2);
        const qh = r/h;
        const dw = -2*(1-qh)/h;
        const press = (p.pressure + q.pressure) / (2 * q.density) * dw;
        fx -= mass * press * dx / r;
        fy -= mass * press * dy / r;
        // viscosity
        fx += viscosity * (q.vx - p.vx) * (1-qh);
        fy += viscosity * (q.vy - p.vy) * (1-qh);
      }
    }
    // pointer attract
    if (pointer.down) {
      const dx = pointer.x - p.x, dy = pointer.y - p.y;
      const d = Math.hypot(dx,dy);
      if (d < 120) { fx += dx/d * 0.8; fy += dy/d * 0.8; }
    }
    p.vx = (p.vx + fx) * 0.96;
    p.vy = (p.vy + fy) * 0.96;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 10 || p.x > W-10) p.vx *= -0.5;
    if (p.y < 10 || p.y > H-10) p.vy *= -0.5;
    p.x = Math.max(10, Math.min(W-10, p.x));
    p.y = Math.max(10, Math.min(H-10, p.y));
  }

  // clusters → orbs
  if (Math.random() < 0.02) {
    for (let p of particles) {
      if (p.density > 2.2 && Math.random() < 0.1) spawnOrb(p.x, p.y, p.density-2);
    }
  }
  orbs = orbs.filter(o => { o.life--; if (o.life<=0) { o.el.remove(); return false; } return true; });

  // fitness
  agents[active].fitness += densAvg * 0.01 + (pointer.down ? 0.05 : 0);
  if (agents[active].fitness > agents[1-active].fitness + 10) active = 1-active; // simple switch
  rnn = agents[active].rnn;

  // render
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  for (let p of particles) {
    const a = Math.min(1, p.density * 0.4);
    ctx.fillStyle = `hsla(${200 + p.density*40}, 70%, 60%, ${a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3 + p.density, 0, Math.PI*2); ctx.fill();
  }
  paramsEl.textContent = `Visc: ${viscosity.toFixed(3)} Press: ${pressureK.toFixed(3)} Agent: ${agents[active].name}`;
  fitnessEl.textContent = `Fitness A:${agents[0].fitness.toFixed(1)} B:${agents[1].fitness.toFixed(1)}`;
  status.textContent = orbs.length ? `${orbs.length} cluster orbs` : 'SPH evolving… tilt/pointer/XR';
  requestAnimationFrame(step);
}
requestAnimationFrame(step);
status.textContent = 'Ready — pointer drag, tilt device, or Enter XR';
