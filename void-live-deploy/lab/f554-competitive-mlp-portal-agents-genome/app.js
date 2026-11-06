const N = 10;
const agents = [];
const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');
const agentsDiv = document.getElementById('agents');
let pointer = {x: innerWidth/2, y: innerHeight/2};
let orient = {beta:0, gamma:0};
let db;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

document.getElementById('ori').onclick = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    const p = await DeviceOrientationEvent.requestPermission();
    if (p === 'granted') addEventListener('deviceorientation', e => { orient.beta = e.beta||0; orient.gamma = e.gamma||0; });
  } else {
    addEventListener('deviceorientation', e => { orient.beta = e.beta||0; orient.gamma = e.gamma||0; });
  }
  document.getElementById('status').textContent = 'Orientation enabled';
};

function rand(n) { return Array.from({length:n}, () => (Math.random()-0.5)*0.4); }
function mlp(w, inp) {
  // 8 -> 6 -> 4
  const h = new Array(6).fill(0);
  for (let i=0;i<6;i++) for (let j=0;j<8;j++) h[i] += w[i*8+j] * inp[j];
  for (let i=0;i<6;i++) h[i] = Math.tanh(h[i]);
  const o = new Array(4).fill(0);
  for (let i=0;i<4;i++) for (let j=0;j<6;j++) o[i] += w[48 + i*6 + j] * h[j];
  return o.map(v => Math.tanh(v));
}

function makeAgent(i, weights) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = i;
  agentsDiv.appendChild(el);
  return {
    el, i,
    x: Math.random()*innerWidth, y: Math.random()*innerHeight,
    vx:0, vy:0, fitness:0, age:0,
    weights: weights || rand(8*6 + 6*4),
    hue: Math.random()*360
  };
}

function sealHash(w) {
  let h = 0;
  for (let v of w) h = (h * 31 + Math.round(v*1000)) | 0;
  return h.toString(16);
}

async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f554', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function loadGenomes() {
  try {
    db = await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const store = tx.objectStore('genomes');
    const all = await new Promise(r => { const g = store.get('all'); g.onsuccess = () => r(g.result); });
    if (all && all.length === N) {
      all.forEach((w,i) => agents.push(makeAgent(i, w)));
      document.getElementById('status').textContent = 'Loaded sealed genomes';
      return;
    }
  } catch (e) { console.debug("lab f554-competitive-mlp-portal-agents-genome:", e); }
  for (let i=0;i<N;i++) agents.push(makeAgent(i));
}

const bc = new BroadcastChannel('f554-best');
bc.onmessage = e => {
  if (e.data && e.data.weights) {
    // inject best into weakest
    let min = agents.reduce((a,b) => a.fitness < b.fitness ? a : b);
    min.weights = e.data.weights.slice();
    min.hue = e.data.hue;
  }
};

function broadcastBest() {
  const best = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
  bc.postMessage({weights: best.weights, hue: best.hue, fitness: best.fitness});
}

document.getElementById('seal').onclick = async () => {
  if (!db) db = await openDB();
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put(agents.map(a => a.weights), 'all');
  document.getElementById('status').textContent = 'Sealed to IndexedDB · hash ' + sealHash(agents[0].weights);
};

document.getElementById('reset').onclick = () => {
  agents.forEach(a => { a.weights = rand(8*6+6*4); a.fitness=0; });
};

function step() {
  // density
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  agents.forEach(a => {
    const g = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, 80);
    g.addColorStop(0, `hsla(${a.hue},80%,60%,0.25)`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(a.x,a.y,80,0,Math.PI*2); ctx.fill();
  });

  agents.forEach(a => {
    const dx = (pointer.x - a.x) / innerWidth;
    const dy = (pointer.y - a.y) / innerHeight;
    const inp = [dx, dy, orient.beta/90, orient.gamma/90, a.vx, a.vy, a.age*0.01, a.fitness*0.01];
    const out = mlp(a.weights, inp);
    a.vx = a.vx*0.9 + out[0]*3;
    a.vy = a.vy*0.9 + out[1]*3;
    a.x += a.vx; a.y += a.vy;
    if (a.x<20||a.x>innerWidth-20) a.vx *= -1;
    if (a.y<20||a.y>innerHeight-20) a.vy *= -1;
    a.x = Math.max(20, Math.min(innerWidth-20, a.x));
    a.y = Math.max(20, Math.min(innerHeight-20, a.y));
    const dist = Math.hypot(pointer.x-a.x, pointer.y-a.y);
    a.fitness += Math.max(0, 1 - dist/300);
    a.age++;
    a.hue = (a.hue + out[3]*2) % 360;
    const s = 1 + out[2]*0.5;
    a.el.style.transform = `translate(${a.x-20}px,${a.y-20}px) scale(${s})`;
    a.el.style.background = `hsl(${a.hue},70%,55%)`;
    a.el.style.color = a.fitness > 50 ? '#fff' : '#000';
  });

  // collisions
  for (let i=0;i<N;i++) for (let j=i+1;j<N;j++) {
    const A = agents[i], B = agents[j];
    const d = Math.hypot(A.x-B.x, A.y-B.y);
    if (d < 48) {
      const winner = A.fitness > B.fitness ? A : B;
      const loser = winner === A ? B : A;
      loser.weights = winner.weights.map(w => w + (Math.random()-0.5)*0.1);
      loser.hue = winner.hue;
      // seal
      const h = sealHash(loser.weights);
      document.getElementById('status').textContent = `Collision seal ${h.slice(0,6)} · fit ${winner.fitness.toFixed(0)}`;
    }
  }

  if (Math.random() < 0.02) broadcastBest();
  requestAnimationFrame(step);
}

loadGenomes().then(() => step());
