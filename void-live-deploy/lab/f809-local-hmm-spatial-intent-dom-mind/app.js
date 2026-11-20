const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_STATES = 4; // explore, focus, cluster, disperse
const N_OBS = 4;
const stateNames = ['explore','focus','cluster','disperse'];
const stateColors = ['#4af','#fa4','#af4','#f4a'];

// HMM parameters (row-stochastic)
let A = Array.from({length:N_STATES}, () => Array(N_STATES).fill(0.25));
let B = Array.from({length:N_STATES}, () => Array(N_OBS).fill(0.25));
let pi = Array(N_STATES).fill(1/N_STATES);
let posterior = [...pi];

function normalize(arr) {
  const s = arr.reduce((a,b)=>a+b,0) || 1;
  return arr.map(v => v/s);
}
function initRandom() {
  A = A.map(row => normalize(row.map(() => Math.random())));
  B = B.map(row => normalize(row.map(() => Math.random())));
  pi = normalize(Array(N_STATES).fill(1).map(()=>Math.random()));
  posterior = [...pi];
}
initRandom();

// Cards
const cards = [];
for (let i=0; i<10; i++) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = 'thought ' + i;
  el.style.left = (Math.random()*0.7+0.1)*W + 'px';
  el.style.top = (Math.random()*0.7+0.1)*H + 'px';
  stage.appendChild(el);
  cards.push({el, x:parseFloat(el.style.left), y:parseFloat(el.style.top), vx:0, vy:0, id:i});
  el.addEventListener('click', () => reward(i));
}

// Observation from pointer
let px=W/2, py=H/2, vx=0, vy=0;
let lastObs = 0;
addEventListener('pointermove', e => {
  vx = e.clientX - px; vy = e.clientY - py;
  px = e.clientX; py = e.clientY;
});
let tilt = {beta:0, gamma:0};
addEventListener('deviceorientation', e => {
  if (e.beta != null) tilt = {beta:e.beta, gamma:e.gamma};
});

function getObs() {
  const speed = Math.hypot(vx, vy);
  const tiltMag = Math.hypot(tilt.beta, tilt.gamma);
  const bin = Math.min(3, Math.floor((speed*0.05 + tiltMag*0.02) * 1.5));
  return bin;
}

// Forward step (simple)
function stepHMM(o) {
  const newPost = Array(N_STATES).fill(0);
  for (let j=0; j<N_STATES; j++) {
    let sum = 0;
    for (let i=0; i<N_STATES; i++) sum += posterior[i] * A[i][j];
    newPost[j] = sum * B[j][o];
  }
  posterior = normalize(newPost);
  lastObs = o;
}

function reward(cardId) {
  // Local multiplicative boost toward recent path
  const s = posterior.indexOf(Math.max(...posterior));
  for (let i=0; i<N_STATES; i++) A[i][s] *= 1.15;
  A = A.map(normalize);
  B[s][lastObs] *= 1.2;
  B[s] = normalize(B[s]);
  statusEl.textContent = 'reinforced ' + stateNames[s];
}

// Attractors per state
const attractors = [
  {cx:0.5, cy:0.5, spread:0.35}, // explore
  {cx:0.5, cy:0.5, spread:0.08}, // focus
  {cx:0.3, cy:0.4, spread:0.12}, // cluster
  {cx:0.7, cy:0.6, spread:0.4}   // disperse
];

function updateCards() {
  const s = posterior.indexOf(Math.max(...posterior));
  const att = attractors[s];
  cards.forEach((c,i) => {
    const tx = att.cx * W + (Math.sin(i*1.7)*att.spread*W);
    const ty = att.cy * H + (Math.cos(i*2.3)*att.spread*H);
    c.vx += (tx - c.x)*0.04;
    c.vy += (ty - c.y)*0.04;
    c.vx *= 0.85; c.vy *= 0.85;
    c.x += c.vx; c.y += c.vy;
    c.x = Math.max(20, Math.min(W-70, c.x));
    c.y = Math.max(20, Math.min(H-50, c.y));
    c.el.style.left = c.x + 'px';
    c.el.style.top = c.y + 'px';
    c.el.style.background = `rgba(${parseInt(stateColors[s].slice(1,3),16)},${parseInt(stateColors[s].slice(3,5),16)},${parseInt(stateColors[s].slice(5,7),16)},0.7)`;
    c.el.style.transform = `scale(${0.85 + posterior[s]*0.4})`;
  });
}

function drawField() {
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0,0,W,H);
  for (let s=0; s<N_STATES; s++) {
    if (posterior[s] < 0.05) continue;
    const col = stateColors[s];
    ctx.fillStyle = col + Math.floor(posterior[s]*40).toString(16).padStart(2,'0');
    ctx.beginPath();
    ctx.arc(W*0.5 + (s-1.5)*80, H*0.5, 120*posterior[s], 0, 6.28);
    ctx.fill();
  }
  statusEl.textContent = stateNames[posterior.indexOf(Math.max(...posterior))] + 
    ' ' + posterior.map(p=>p.toFixed(2)).join(' ');
}

let last = 0;
function loop(t) {
  if (t - last > 50) {
    const o = getObs();
    stepHMM(o);
    updateCards();
    drawField();
    last = t;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Seal / persistence
const DB = 'verse-f809';
let db;
const req = indexedDB.open(DB, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('hmm');
req.onsuccess = e => { db = e.target.result; load(); };
function seal() {
  if (!db) return;
  const tx = db.transaction('hmm','readwrite');
  tx.objectStore('hmm').put({A, B, pi, posterior}, 'best');
  statusEl.textContent = 'sealed';
  // broadcast
  try {
    const bc = new BroadcastChannel('f809-genome');
    bc.postMessage({A, B, fitness: Math.max(...posterior)});
    bc.close();
  } catch (e) { console.debug("lab f809-local-hmm-spatial-intent-dom-mind:", e); }
}
function load() {
  if (!db) return;
  const tx = db.transaction('hmm','readonly');
  const g = tx.objectStore('hmm').get('best');
  g.onsuccess = () => {
    if (g.result) {
      A = g.result.A; B = g.result.B; pi = g.result.pi; posterior = g.result.posterior || pi;
      statusEl.textContent = 'restored';
    }
  };
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initRandom(); statusEl.textContent = 'reset'; };

// Accept remote genomes
try {
  const bc = new BroadcastChannel('f809-genome');
  bc.onmessage = e => {
    if (e.data && e.data.fitness > Math.max(...posterior)) {
      A = e.data.A; B = e.data.B;
      statusEl.textContent = 'adopted peer genome';
    }
  };
} catch (e) { console.debug("lab f809-local-hmm-spatial-intent-dom-mind:", e); }
