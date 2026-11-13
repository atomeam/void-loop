const STAGE = document.getElementById('stage');
const STATUS = document.getElementById('status');
const N_MODES = 5;
const N_STARS = 10;
const BUF = 64; // power of 2 for FFT
const traj = [];
let modes = [];
let stars = [];
let activeMode = 0;
let energy = new Array(N_MODES).fill(0);
let bestFitness = -1;
let bestGenome = null;

function initModes() {
  modes = [];
  for (let i = 0; i < N_MODES; i++) {
    const c = new Array(8).fill(0).map(() => Math.random() * 2 - 1);
    modes.push({ centroid: c, count: 1, params: randomParams() });
  }
}
function randomParams() {
  return { radius: 80 + Math.random()*120, spin: Math.random()*2-1, hue: Math.random()*360, scale: 0.7+Math.random()*0.6 };
}
function initStars() {
  STAGE.innerHTML = '';
  stars = [];
  for (let i = 0; i < N_STARS; i++) {
    const el = document.createElement('div');
    el.className = 'star';
    el.textContent = '★';
    el.dataset.i = i;
    STAGE.appendChild(el);
    stars.push({ el, mode: i % N_MODES });
    el.addEventListener('click', () => reward(stars[i].mode));
  }
}
function reward(m) {
  energy[m] += 5;
  // slight mutate
  modes[m].centroid = modes[m].centroid.map(v => v + (Math.random()-0.5)*0.05);
  updateStatus();
}

// Pure JS radix-2 FFT (real input, returns magnitudes + phases for first half)
function fft(real) {
  const n = real.length;
  let re = real.slice(), im = new Array(n).fill(0);
  // bit reverse
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < len/2; j++) {
        const uRe = re[i+j], uIm = im[i+j];
        const vRe = re[i+j+len/2]*curRe - im[i+j+len/2]*curIm;
        const vIm = re[i+j+len/2]*curIm + im[i+j+len/2]*curRe;
        re[i+j] = uRe + vRe; im[i+j] = uIm + vIm;
        re[i+j+len/2] = uRe - vRe; im[i+j+len/2] = uIm - vIm;
        const nextRe = curRe*wRe - curIm*wIm;
        curIm = curRe*wIm + curIm*wRe;
        curRe = nextRe;
      }
    }
  }
  const mags = [], phases = [];
  for (let k = 1; k < n/2; k++) {
    mags.push(Math.hypot(re[k], im[k]) / n);
    phases.push(Math.atan2(im[k], re[k]));
  }
  return { mags, phases };
}

function featuresFromTraj() {
  if (traj.length < BUF) return null;
  const recent = traj.slice(-BUF);
  const vels = [];
  for (let i = 1; i < recent.length; i++) {
    const dx = recent[i].x - recent[i-1].x;
    const dy = recent[i].y - recent[i-1].y;
    vels.push(Math.hypot(dx, dy));
  }
  while (vels.length < BUF) vels.unshift(0);
  const { mags } = fft(vels.slice(0, BUF));
  return mags.slice(0, 8).map(m => Math.min(m * 10, 5)); // top bins normalized
}

function assignAndUpdate(feat) {
  if (!feat) return 0;
  let best = 0, bestD = Infinity;
  for (let i = 0; i < modes.length; i++) {
    let d = 0;
    for (let k = 0; k < feat.length; k++) d += (feat[k] - modes[i].centroid[k])**2;
    if (d < bestD) { bestD = d; best = i; }
  }
  // update centroid
  const m = modes[best];
  const lr = 0.1 / Math.sqrt(m.count);
  for (let k = 0; k < feat.length; k++) {
    m.centroid[k] += lr * (feat[k] - m.centroid[k]);
  }
  m.count++;
  activeMode = best;
  energy[best] += 0.05;
  return best;
}

function applyConstellation(modeIdx) {
  const p = modes[modeIdx].params;
  const hue = (p.hue + energy[modeIdx] * 2) % 360;
  stars.forEach((s, i) => {
    if (s.mode !== modeIdx && Math.random() > 0.3) return; // mostly active mode
    const ang = (i / N_STARS) * Math.PI * 2 + p.spin * performance.now()/1000;
    const r = p.radius * (0.6 + 0.4 * Math.sin(i + energy[modeIdx]));
    const z = Math.sin(ang * 2) * 40;
    s.el.style.transform = `translate3d(${Math.cos(ang)*r}px, ${Math.sin(ang)*r}px, ${z}px) scale(${p.scale})`;
    s.el.style.background = `radial-gradient(circle, #fff, hsl(${hue}, 70%, 55%))`;
    s.el.textContent = energy[modeIdx].toFixed(1);
  });
}

function updateStatus() {
  STATUS.textContent = `Active mode ${activeMode} | Energy: ${energy.map(e=>e.toFixed(1)).join(' ')} | Fitness best ${bestFitness.toFixed(1)}`;
}

function seal() {
  const fit = energy[activeMode];
  if (fit > bestFitness) {
    bestFitness = fit;
    bestGenome = JSON.parse(JSON.stringify({ modes, energy, fit }));
    localStorage.setItem('f742-best', JSON.stringify(bestGenome));
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('f742-genomes');
      bc.postMessage(bestGenome);
    }
    STATUS.textContent = 'Sealed genome fitness ' + fit.toFixed(1);
  }
}

function loadGenome(g) {
  if (!g || g.fit <= bestFitness) return;
  modes = g.modes;
  energy = g.energy;
  bestFitness = g.fit;
  bestGenome = g;
  updateStatus();
}

// init
initModes();
initStars();
const saved = localStorage.getItem('f742-best');
if (saved) try { loadGenome(JSON.parse(saved)); } catch (e) { console.debug("lab f742-pointer-fourier-kmeans-css3d-constellation-mind:", e); }

if (typeof BroadcastChannel !== 'undefined') {
  const bc = new BroadcastChannel('f742-genomes');
  bc.onmessage = e => loadGenome(e.data);
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initModes(); energy.fill(0); bestFitness=-1; };

let last = performance.now();
document.addEventListener('pointermove', e => {
  traj.push({ x: e.clientX - innerWidth/2, y: e.clientY - innerHeight/2 });
  if (traj.length > BUF*2) traj.shift();
  const now = performance.now();
  if (now - last > 50) {
    last = now;
    const feat = featuresFromTraj();
    if (feat) {
      const m = assignAndUpdate(feat);
      // derive params from centroid
      const c = modes[m].centroid;
      modes[m].params.radius = 60 + Math.abs(c[0])*80;
      modes[m].params.spin = c[1]*2;
      modes[m].params.hue = (c[2]+1)*180;
      modes[m].params.scale = 0.5 + Math.abs(c[3])*0.8;
      applyConstellation(m);
    }
    updateStatus();
  }
});

// center stage origin
function resize() {
  STAGE.style.transformOrigin = '50% 50%';
}
resize();
window.addEventListener('resize', resize);

// idle animation
setInterval(() => {
  applyConstellation(activeMode);
}, 100);
