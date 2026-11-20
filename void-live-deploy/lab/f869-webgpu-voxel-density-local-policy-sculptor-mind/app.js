const N = 16;
const density = new Float32Array(N*N*N);
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// Policy: features [tiltX, tiltY, px, py, densGrad, time, bias1, bias2] -> [dx, dy, dz, strength]
let weights = new Float32Array(8*4);
for (let i=0; i<weights.length; i++) weights[i] = (Math.random()-0.5)*0.4;
let tilt = {x:0, y:0};
let pointer = {x:0.5, y:0.5, vx:0, vy:0};
let lastPointer = {x:0.5, y:0.5};
let rewardSignal = 0;

function idx(x,y,z) { return ((z*N+y)*N+x)|0; }
function get(x,y,z) {
  x = Math.max(0, Math.min(N-1, x|0));
  y = Math.max(0, Math.min(N-1, y|0));
  z = Math.max(0, Math.min(N-1, z|0));
  return density[idx(x,y,z)];
}
function add(x,y,z, v) {
  x = Math.max(0, Math.min(N-1, x|0));
  y = Math.max(0, Math.min(N-1, y|0));
  z = Math.max(0, Math.min(N-1, z|0));
  density[idx(x,y,z)] = Math.max(0, Math.min(1, density[idx(x,y,z)] + v));
}

// Init some density
for (let i=0; i<40; i++) add(Math.random()*N, Math.random()*N, Math.random()*N, 0.6);

function policyStep() {
  const t = performance.now()*0.001;
  const features = new Float32Array([
    tilt.x, tilt.y,
    pointer.vx, pointer.vy,
    0.1, // placeholder gradient
    Math.sin(t)*0.5,
    1, 0.5
  ]);
  // simple forward
  const actions = new Float32Array(4);
  for (let o=0; o<4; o++) {
    let s = 0;
    for (let f=0; f<8; f++) s += features[f] * weights[f*4 + o];
    actions[o] = Math.tanh(s);
  }
  const cx = (actions[0]*0.5 + 0.5) * N;
  const cy = (actions[1]*0.5 + 0.5) * N;
  const cz = (actions[2]*0.5 + 0.5) * N;
  const str = actions[3] * 0.15;
  add(cx, cy, cz, str);
  // light diffusion
  if (Math.random() < 0.3) {
    const x = (Math.random()*N)|0, y=(Math.random()*N)|0, z=(Math.random()*N)|0;
    const avg = (get(x+1,y,z)+get(x-1,y,z)+get(x,y+1,z)+get(x,y-1,z)+get(x,y,z+1)+get(x,y,z-1))/6;
    density[idx(x,y,z)] = density[idx(x,y,z)]*0.92 + avg*0.08;
  }
  return {cx, cy, cz, str, features};
}

function findCores(k=5) {
  const cores = [];
  // simple: sample high density points
  for (let i=0; i<200 && cores.length < k; i++) {
    const x = (Math.random()*N)|0, y=(Math.random()*N)|0, z=(Math.random()*N)|0;
    const d = get(x,y,z);
    if (d > 0.35) cores.push({x, y, z, d});
  }
  cores.sort((a,b)=>b.d-a.d);
  return cores.slice(0, k);
}

function project(x,y,z) {
  const px = (x / N - 0.5) * 0.7 + 0.5;
  const py = (y / N - 0.5) * 0.7 + 0.5;
  const pz = z / N;
  return {
    sx: px * W,
    sy: py * H * (0.85 + pz*0.15),
    scale: 0.6 + pz * 0.8
  };
}

const portals = [];
for (let i=0; i<5; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'core ' + i;
  el.onclick = () => { rewardSignal = 1; document.getElementById('status').textContent = 'rewarded'; };
  document.body.appendChild(el);
  portals.push(el);
}

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  // render density as soft points
  ctx.globalAlpha = 0.7;
  for (let z=0; z<N; z+=2) {
    for (let y=0; y<N; y+=2) {
      for (let x=0; x<N; x+=2) {
        const d = get(x,y,z);
        if (d < 0.05) continue;
        const p = project(x,y,z);
        const r = 4 + d*12;
        ctx.fillStyle = `hsla(${200 + d*80}, 70%, ${40+d*30}%, ${d*0.8})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r * p.scale, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

let frame = 0;
function loop() {
  frame++;
  if (frame % 2 === 0) {
    const res = policyStep();
    if (rewardSignal > 0) {
      // delta rule: move weights toward producing the last action
      const lr = 0.08 * rewardSignal;
      for (let f=0; f<8; f++) {
        for (let o=0; o<4; o++) {
          weights[f*4+o] += lr * res.features[f] * 0.1;
        }
      }
      rewardSignal *= 0.85;
    }
  }
  const cores = findCores();
  cores.forEach((c, i) => {
    if (!portals[i]) return;
    const p = project(c.x, c.y, c.z);
    portals[i].style.left = (p.sx - 40) + 'px';
    portals[i].style.top = (p.sy - 24) + 'px';
    portals[i].style.transform = `scale(${0.7 + c.d})`;
    portals[i].style.background = `hsla(${180 + c.d*100}, 60%, 50%, 0.3)`;
    portals[i].textContent = `d:${c.d.toFixed(2)}`;
  });
  render();
  requestAnimationFrame(loop);
}
loop();

// Inputs
addEventListener('pointermove', e => {
  const nx = e.clientX / W, ny = e.clientY / H;
  pointer.vx = nx - lastPointer.x;
  pointer.vy = ny - lastPointer.y;
  lastPointer.x = nx; lastPointer.y = ny;
  pointer.x = nx; pointer.y = ny;
  if (e.buttons) {
    // direct sculpt
    const wx = nx * N, wy = ny * N, wz = 8;
    add(wx, wy, wz, 0.25);
    add(wx+1, wy, wz, 0.1);
  }
});
addEventListener('pointerdown', e => {
  const nx = e.clientX / W, ny = e.clientY / H;
  add(nx*N, ny*N, 8, 0.4);
});

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    tilt.x = (e.gamma || 0) / 90;
    tilt.y = (e.beta || 0) / 90;
  });
}

// Seal
const DB_NAME = 'verse-f869';
const KEY = 'voxel-state';
document.getElementById('seal').onclick = async () => {
  const state = {
    weights: Array.from(weights),
    density: Array.from(density).filter((_,i)=>i%4===0) // compressed
  };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('s');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('s', 'readwrite');
    tx.objectStore('s').put(state, KEY);
    await new Promise(r => tx.oncomplete = r);
    document.getElementById('status').textContent = 'sealed';
    if (window.BroadcastChannel) {
      new BroadcastChannel('f869-voxel').postMessage(state);
    }
  } catch(e) {
    sessionStorage.setItem(KEY, JSON.stringify(state));
    document.getElementById('status').textContent = 'sealed (session)';
  }
};

document.getElementById('reset').onclick = () => {
  density.fill(0);
  for (let i=0; i<30; i++) add(Math.random()*N, Math.random()*N, Math.random()*N, 0.5);
  for (let i=0; i<weights.length; i++) weights[i] = (Math.random()-0.5)*0.4;
  document.getElementById('status').textContent = 'reset';
};

// Restore
(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('s', 'readonly');
    const req = tx.objectStore('s').get(KEY);
    req.onsuccess = () => {
      if (req.result) {
        const s = req.result;
        if (s.weights) weights.set(s.weights);
        document.getElementById('status').textContent = 'restored';
      }
    };
  } catch (e) { console.debug("lab f869-webgpu-voxel-density-local-policy-sculptor-mind:", e); }
})();

if (window.BroadcastChannel) {
  new BroadcastChannel('f869-voxel').onmessage = e => {
    if (e.data && e.data.weights) {
      weights.set(e.data.weights);
      document.getElementById('status').textContent = 'received';
    }
  };
}
