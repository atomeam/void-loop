const N = 10;
const stage = document.getElementById('stage');
const probesDiv = document.getElementById('probes');
const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');
const fitEl = document.getElementById('fit');
const genEl = document.getElementById('gen');

let probes = [];
let bestWeights = null;
let fitness = 0;
let gen = 0;
let pointer = {x: window.innerWidth/2, y: window.innerHeight/2};
let sealed = false;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const IN = 6, H = 8, OUT = 3;
const WLEN = IN*H + H + H*OUT + OUT;

function tanh(x) { return Math.tanh(x); }

function forward(w, inputs) {
  const h = new Float32Array(H);
  let idx = 0;
  for (let i = 0; i < H; i++) {
    let s = w[idx++];
    for (let j = 0; j < IN; j++) s += inputs[j] * w[idx++];
    h[i] = tanh(s);
  }
  const o = new Float32Array(OUT);
  for (let i = 0; i < OUT; i++) {
    let s = w[idx++];
    for (let j = 0; j < H; j++) s += h[j] * w[idx++];
    o[i] = tanh(s);
  }
  return o;
}

function initProbes() {
  probesDiv.innerHTML = '';
  probes = [];
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'probe';
    probesDiv.appendChild(el);
    probes.push({
      el,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: 0, vy: 0,
      connect: 0.5
    });
  }
}
initProbes();

const workerCode = `
const IN=6, H=8, OUT=3;
const WLEN = IN*H + H + H*OUT + OUT;
function randw() { return (Math.random()-0.5)*2; }
let pop = [];
const POP = 8;
function init() {
  for (let i=0;i<POP;i++) {
    const w = new Float32Array(WLEN);
    for (let j=0;j<WLEN;j++) w[j] = randw();
    pop.push({w, fit:0});
  }
}
init();
function mutate(w, rate=0.1, mag=0.3) {
  const n = new Float32Array(w);
  for (let i=0;i<n.length;i++) if (Math.random()<rate) n[i] += (Math.random()-0.5)*mag;
  return n;
}
self.onmessage = (e) => {
  const {metrics, observations} = e.data;
  const f = (metrics.pointerReward || 0) * 2 + (metrics.diversity || 0) + (metrics.graphAct || 0) * 0.5;
  if (pop.length) {
    pop[0].fit = f;
    for (let i=1;i<POP;i++) {
      if (Math.random()<0.3) pop[i].w = mutate(pop[0].w);
      pop[i].fit = f * (0.8 + Math.random()*0.4);
    }
    pop.sort((a,b)=>b.fit-a.fit);
  }
  self.postMessage({weights: pop[0].w, fitness: pop[0].fit, gen: (e.data.gen||0)+1});
};
`;
const blob = new Blob([workerCode], {type:'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = (e) => {
  bestWeights = e.data.weights;
  fitness = e.data.fitness;
  gen = e.data.gen;
  fitEl.textContent = fitness.toFixed(2);
  genEl.textContent = gen;
};

function sampleObservations() {
  const obs = [];
  let sumDist = 0, sumAct = 0;
  probes.forEach(p => {
    const dx = (pointer.x - p.x) / window.innerWidth;
    const dy = (pointer.y - p.y) / window.innerHeight;
    const dist = Math.hypot(dx, dy);
    sumDist += dist;
    sumAct += Math.abs(p.vx) + Math.abs(p.vy);
    obs.push([dx, dy, dist, p.vx, p.vy, p.connect]);
  });
  const diversity = probes.reduce((s,p)=>s + Math.hypot(p.x-window.innerWidth/2, p.y-window.innerHeight/2), 0) / N / 400;
  const pointerReward = 1 - (sumDist / N);
  const graphAct = probes.reduce((s,p)=>s+p.connect,0)/N;
  return {obs, metrics: {pointerReward, diversity, graphAct}};
}

function step() {
  if (!bestWeights) {
    worker.postMessage({metrics:{pointerReward:0.5,diversity:0.5,graphAct:0.3}, gen:0});
  }
  const {obs, metrics} = sampleObservations();
  probes.forEach((p, i) => {
    if (bestWeights) {
      const o = forward(bestWeights, obs[i]);
      p.vx = p.vx * 0.8 + o[0] * 2.5;
      p.vy = p.vy * 0.8 + o[1] * 2.5;
      p.connect = (p.connect + o[2] + 1) / 2 * 0.5 + 0.25;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.x = Math.max(20, Math.min(window.innerWidth-20, p.x));
    p.y = Math.max(20, Math.min(window.innerHeight-20, p.y));
    p.el.style.left = (p.x - 14) + 'px';
    p.el.style.top = (p.y - 14) + 'px';
    const hue = 180 + p.connect * 120;
    p.el.style.background = `radial-gradient(circle, hsl(${hue},80%,60%), hsl(${hue+40},70%,40%))`;
  });

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.lineWidth = 1.5;
  for (let i=0;i<N;i++) {
    for (let j=i+1;j<N;j++) {
      const str = (probes[i].connect + probes[j].connect)/2;
      if (str > 0.4) {
        ctx.strokeStyle = `hsla(${200 + str*100},70%,60%,${str*0.6})`;
        ctx.beginPath();
        ctx.moveTo(probes[i].x, probes[i].y);
        ctx.lineTo(probes[j].x, probes[j].y);
        ctx.stroke();
      }
    }
  }

  const f = Math.min(1, Math.max(0, fitness));
  stage.style.filter = `hue-rotate(${f*80}deg) contrast(${1+f*0.4}) saturate(${1+f*0.6})`;
  stage.style.transform = `scale(${1 + f*0.03}) perspective(800px) rotateX(${f*5}deg)`;

  if (Math.random() < 0.02) {
    worker.postMessage({metrics, gen});
  }

  requestAnimationFrame(step);
}
requestAnimationFrame(step);

window.addEventListener('pointermove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

document.getElementById('reset').onclick = () => {
  initProbes();
  bestWeights = null;
  gen = 0;
};

document.getElementById('seal').onclick = async () => {
  if (!bestWeights) return;
  const data = {weights: Array.from(bestWeights), fitness, gen, t: Date.now()};
  const str = JSON.stringify(data);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  const hash = Array.from(new Uint8Array(buf)).slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
  const db = await new Promise(r => {
    const req = indexedDB.open('F040-seal', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => r(req.result);
  });
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({hash, ...data}, hash);
  alert('Sealed: ' + hash);
};
