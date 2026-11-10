const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.onresize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };

// D2Q9 LBM params
const N = 48, M = 48; // grid
const e = [[0,0],[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]];
const w = [4/9,1/9,1/9,1/9,1/9,1/36,1/36,1/36,1/36];
const opp = [0,3,4,1,2,7,8,5,6];
let f = Array.from({length:9}, () => new Float32Array(N*M));
let rho = new Float32Array(N*M);
let ux = new Float32Array(N*M);
let uy = new Float32Array(N*M);
let gravity = {x:0, y:0.0002};
let tau = 0.8;

// EA genomes
let pop = [];
let current = 0;
let fitness = 0;
let bestFitness = -1;
let bestGenome = null;
const channel = new BroadcastChannel('f644-lbm-genome');

function randomGenome() {
  return { tau: 0.6 + Math.random()*0.6, gscale: 0.5 + Math.random()*1.5, src: 0.01 + Math.random()*0.05, visc: 0.8 + Math.random()*0.4 };
}
function initPop() {
  pop = Array.from({length:6}, randomGenome);
  current = 0;
  applyGenome(pop[0]);
}
function applyGenome(g) {
  tau = Math.max(0.51, Math.min(1.5, g.tau));
}
initPop();

// Buoys
const buoys = [];
function spawnBuoys() {
  for (let i=0; i<6; i++) {
    const el = document.createElement('div');
    el.className = 'buoy';
    el.textContent = 'buoy ' + i;
    el.style.left = (20 + Math.random()*(W-100)) + 'px';
    el.style.top = (60 + Math.random()*(H-120)) + 'px';
    el.onclick = () => rewardBuoy(i);
    document.body.appendChild(el);
    buoys.push({el, gx: Math.floor(Math.random()*N), gy: Math.floor(Math.random()*M), speed:0});
  }
}
spawnBuoys();

function rewardBuoy(i) {
  fitness += 5;
  status.textContent = `Reinforced! Fitness ${fitness.toFixed(1)}`;
  // inject source
  const b = buoys[i];
  const idx = b.gy * N + b.gx;
  for (let k=0; k<9; k++) f[k][idx] += 0.05 * w[k];
  evolve();
}

function evolve() {
  // simple tournament
  const a = Math.floor(Math.random()*pop.length);
  const b = Math.floor(Math.random()*pop.length);
  const winner = (Math.random() < 0.5) ? a : b; // biased later
  let g = {...pop[winner]};
  if (Math.random() < 0.4) g.tau += (Math.random()-0.5)*0.1;
  if (Math.random() < 0.4) g.gscale += (Math.random()-0.5)*0.2;
  pop[current] = g;
  applyGenome(g);
  if (fitness > bestFitness) {
    bestFitness = fitness;
    bestGenome = {...g, fitness};
    channel.postMessage({type:'genome', genome: bestGenome});
  }
}

channel.onmessage = (ev) => {
  if (ev.data.type === 'genome' && ev.data.genome.fitness > bestFitness) {
    bestFitness = ev.data.genome.fitness;
    pop[0] = ev.data.genome;
    status.textContent = 'Received better sealed genome';
  }
};

// LBM step
function equilibrium(i, j, r, vx, vy) {
  const u2 = vx*vx + vy*vy;
  const res = new Float32Array(9);
  for (let k=0; k<9; k++) {
    const eu = e[k][0]*vx + e[k][1]*vy;
    res[k] = w[k] * r * (1 + 3*eu + 4.5*eu*eu - 1.5*u2);
  }
  return res;
}
function stepLBM() {
  // collide + force
  for (let j=0; j<M; j++) for (let i=0; i<N; i++) {
    const idx = j*N + i;
    let r = 0, vx=0, vy=0;
    for (let k=0; k<9; k++) r += f[k][idx];
    if (r < 1e-6) r = 1;
    for (let k=0; k<9; k++) { vx += e[k][0]*f[k][idx]; vy += e[k][1]*f[k][idx]; }
    vx /= r; vy /= r;
    // gravity force (simple)
    vx += gravity.x * 0.01;
    vy += gravity.y * 0.01;
    rho[idx] = r; ux[idx] = vx; uy[idx] = vy;
    const feq = equilibrium(i, j, r, vx, vy);
    for (let k=0; k<9; k++) f[k][idx] += (feq[k] - f[k][idx]) / tau;
  }
  // stream
  const nf = Array.from({length:9}, () => new Float32Array(N*M));
  for (let j=0; j<M; j++) for (let i=0; i<N; i++) {
    const idx = j*N + i;
    for (let k=0; k<9; k++) {
      let ni = i + e[k][0], nj = j + e[k][1];
      if (ni<0 || ni>=N || nj<0 || nj>=M) {
        // bounce
        nf[opp[k]][idx] += f[k][idx];
      } else {
        nf[k][nj*N + ni] += f[k][idx];
      }
    }
  }
  f = nf;
}

function initLBM() {
  for (let j=0; j<M; j++) for (let i=0; i<N; i++) {
    const idx = j*N + i;
    const feq = equilibrium(i, j, 1.0, 0, 0);
    for (let k=0; k<9; k++) f[k][idx] = feq[k];
  }
}
initLBM();

// Orientation
let orientEnabled = false;
document.getElementById('perm').onclick = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p === 'granted') orientEnabled = true;
    } catch (e) { console.debug("lab f644-webgpu-lbm-orientation-evo-dom-fluid:", e); }
  } else orientEnabled = true;
  status.textContent = orientEnabled ? 'Orientation active' : 'Pointer mode';
};
window.addEventListener('deviceorientation', (ev) => {
  if (!orientEnabled) return;
  gravity.x = (ev.gamma || 0) * 0.00002;
  gravity.y = (ev.beta || 0) * 0.00002;
});
let lastX=0, lastY=0;
canvas.onpointermove = (ev) => {
  if (orientEnabled) return;
  gravity.x = (ev.clientX - lastX) * 0.00001;
  gravity.y = (ev.clientY - lastY) * 0.00001;
  lastX = ev.clientX; lastY = ev.clientY;
};

// Render + update buoys
function updateBuoys() {
  // find peaks
  let peaks = [];
  for (let j=1; j<M-1; j+=4) for (let i=1; i<N-1; i+=4) {
    const idx = j*N + i;
    const sp = Math.hypot(ux[idx], uy[idx]);
    peaks.push({i,j,sp, idx});
  }
  peaks.sort((a,b)=>b.sp-a.sp);
  buoys.forEach((b, bi) => {
    if (peaks[bi]) {
      const p = peaks[bi];
      b.gx = p.i; b.gy = p.j;
      b.speed = p.sp;
      const px = (p.i / N) * W;
      const py = (p.j / M) * H;
      b.el.style.transform = `translate(${px-35}px, ${py-20}px)`;
      b.el.textContent = `v:${p.sp.toFixed(3)}`;
    }
  });
  fitness += buoys.reduce((s,b)=>s+b.speed, 0) * 0.1;
}

function render() {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0,0,W,H);
  const scaleX = W / N, scaleY = H / M;
  for (let j=0; j<M; j++) for (let i=0; i<N; i++) {
    const idx = j*N + i;
    const sp = Math.min(1, Math.hypot(ux[idx], uy[idx])*20);
    const dens = Math.min(1, Math.max(0, (rho[idx]-0.8)*2));
    ctx.fillStyle = `rgba(${100+dens*155},${50+sp*200},${200-sp*100},0.7)`;
    ctx.fillRect(i*scaleX, j*scaleY, scaleX, scaleY);
  }
}

function loop() {
  stepLBM();
  updateBuoys();
  render();
  if (Math.random() < 0.02) evolve();
  requestAnimationFrame(loop);
}
loop();

// Seal
document.getElementById('seal').onclick = () => {
  const snap = [];
  for (let j=0; j<M; j+=4) for (let i=0; i<N; i+=4) snap.push(rho[j*N+i].toFixed(3));
  const data = {genome: bestGenome || pop[current], fitness, density_snapshot: snap, timestamp: Date.now(), verse: 'F644'};
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'f644-lbm-genome.json';
  a.click();
  status.textContent = 'Sealed genome downloaded';
  // IndexedDB simple
  try {
    const req = indexedDB.open('verse-f644', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => {
      const tx = req.result.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put(data, 'best');
    };
  } catch (e) { console.debug("lab f644-webgpu-lbm-orientation-evo-dom-fluid:", e); }
};
document.getElementById('reset').onclick = () => { initLBM(); initPop(); fitness=0; status.textContent='Reset'; };
