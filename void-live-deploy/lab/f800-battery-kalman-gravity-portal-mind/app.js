const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const status = document.getElementById('status');
const portalsEl = document.getElementById('portals');
let W = innerWidth, H = innerHeight;
function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize); resize();

// Kalman filter: state [gx, gy], simple 2D
let state = [0, 0];
let P = [[1,0],[0,1]]; // covariance
let Q = [[0.01,0],[0,0.01]];
let R = 0.1;
let A = [[0.95,0],[0,0.95]]; // process
let fitness = 0;

// Particles
const N = 180;
let parts = Array.from({length:N}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2
}));

// Portals as mass sources
const portals = [];
for (let i=0; i<4; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'mass ' + (i+1);
  el.style.left = (20 + i*25) + '%';
  el.style.top = (30 + (i%2)*30) + '%';
  portalsEl.appendChild(el);
  portals.push({el, x:0, y:0, mass: 800 + i*200});
  // drag
  let dx, dy;
  el.onpointerdown = e => {
    el.setPointerCapture(e.pointerId);
    dx = e.clientX - el.offsetLeft; dy = e.clientY - el.offsetTop;
  };
  el.onpointermove = e => {
    if (e.buttons) {
      el.style.left = (e.clientX - dx) + 'px';
      el.style.top = (e.clientY - dy) + 'px';
    }
  };
  el.onclick = () => { fitness += 0.5; updateFilter(0.2); };
}

function updatePortalPos() {
  portals.forEach(p => {
    const r = p.el.getBoundingClientRect();
    p.x = r.left + r.width/2;
    p.y = r.top + r.height/2;
  });
}

// Battery or proxy observation
let obs = [0,0];
async function initBattery() {
  if (navigator.getBattery) {
    const b = await navigator.getBattery();
    function read() {
      obs[0] = (b.level - 0.5) * 2; // -1 to 1
      obs[1] = b.charging ? 0.8 : -0.4;
    }
    read();
    b.addEventListener('levelchange', read);
    b.addEventListener('chargingchange', read);
    status.textContent = 'Battery live';
  } else {
    status.textContent = 'Pointer proxy';
  }
}
initBattery();
let px=0, py=0;
addEventListener('pointermove', e => {
  if (!navigator.getBattery) {
    obs[0] = (e.clientX / W - 0.5) * 2;
    obs[1] = (e.clientY / H - 0.5) * 2;
  }
  px = e.clientX; py = e.clientY;
});

// Simple Kalman predict-update
function kalmanStep() {
  // predict
  state = [A[0][0]*state[0], A[1][1]*state[1]];
  // update (simplified scalar-ish)
  const innov = [obs[0]-state[0], obs[1]-state[1]];
  const K = 0.15; // fixed gain proxy
  state[0] += K * innov[0];
  state[1] += K * innov[1];
  // residual adaptation
  const res = Math.hypot(...innov);
  Q[0][0] = Math.max(0.001, Q[0][0] * (1 + (res-0.5)*0.01));
  R = Math.max(0.05, R * (1 - (res-0.5)*0.005));
}

function updateFilter(reward) {
  fitness += reward;
  // slight adaptation
  A[0][0] = Math.min(0.99, A[0][0] + reward*0.01);
}

// IndexedDB + Broadcast
const channel = new BroadcastChannel('f800-genome');
channel.onmessage = e => {
  if (e.data.fitness > fitness) {
    fitness = e.data.fitness * 0.95;
    state = e.data.state || state;
    status.textContent = 'Adopted better genome';
  }
};
document.getElementById('seal').onclick = async () => {
  const data = {state, fitness, A, Q, R, t: Date.now()};
  channel.postMessage(data);
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f800', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('g');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('g','readwrite');
    tx.objectStore('g').put(data, 'params');
    status.textContent = 'Sealed fitness ' + fitness.toFixed(2);
  } catch(e) { status.textContent = 'Seal mem only'; }
};
document.getElementById('reset').onclick = () => {
  state = [0,0]; fitness = 0; parts.forEach(p => { p.x=Math.random()*W; p.y=Math.random()*H; });
};

// Main loop
function step() {
  updatePortalPos();
  kalmanStep();
  const gx = state[0] * 0.15;
  const gy = state[1] * 0.15;
  // particles
  for (let i=0; i<N; i++) {
    const p = parts[i];
    // mutual soft gravity (few neighbors for speed)
    let ax=gx, ay=gy;
    for (let j=0; j<4; j++) { // sample some
      const q = parts[(i*7+j*13)%N];
      const dx=q.x-p.x, dy=q.y-p.y, d2=dx*dx+dy*dy+100;
      const f = 80 / d2;
      ax += dx*f; ay += dy*f;
    }
    // portal masses
    portals.forEach(pt => {
      const dx=pt.x-p.x, dy=pt.y-p.y, d2=dx*dx+dy*dy+400;
      const f = pt.mass / d2;
      ax += dx*f; ay += dy*f;
    });
    p.vx = (p.vx + ax)*0.98;
    p.vy = (p.vy + ay)*0.98;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx*=-0.8;
    if (p.y<0||p.y>H) p.vy*=-0.8;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  }
  // density reward
  portals.forEach(pt => {
    let dens=0;
    parts.forEach(p => { if (Math.hypot(p.x-pt.x, p.y-pt.y)<80) dens++; });
    if (dens > 12) { fitness += 0.01; updateFilter(0.005); }
    pt.el.style.transform = `scale(${1 + dens*0.02})`;
    pt.el.style.background = `hsla(${200 + dens*2},70%,50%,0.4)`;
  });
  // render
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#8cf';
  parts.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 6.28); ctx.fill();
  });
  status.textContent = `g:(${state[0].toFixed(2)},${state[1].toFixed(2)}) fit:${fitness.toFixed(1)} obs:(${obs[0].toFixed(2)},${obs[1].toFixed(2)})`;
  requestAnimationFrame(step);
}
step();
