const N = 8, T = 4; // 8x8 grid, 4 tile types
const TILES = ['VOID','MIND','VERSE','SEED'];
const COLORS = ['#2a2a40','#4a2a6a','#2a4a6a','#6a4a2a'];
let possibilities = Array.from({length:N*N}, () => Array(T).fill(true));
let collapsed = Array(N*N).fill(-1);
let entropy = Array(N*N).fill(T);
let pointerHist = [0,0,0,0]; // density-like residual
let mlpW = Array(4*6 + 6*T).fill(0).map(() => (Math.random()-0.5)*0.5); // tiny 4→6→T
let lastSeal = null;
const grid = document.getElementById('grid');
grid.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
grid.style.gridTemplateRows = `repeat(${N}, 1fr)`;
const cards = [];
for (let i=0; i<N*N; i++) {
  const c = document.createElement('div');
  c.className = 'card';
  c.dataset.i = i;
  c.textContent = '?';
  c.onclick = () => forceCollapse(i);
  grid.appendChild(c);
  cards.push(c);
}
function mlpForward(x) {
  const h = Array(6).fill(0);
  for (let j=0; j<6; j++) for (let k=0; k<4; k++) h[j] += x[k] * mlpW[j*4 + k];
  const o = Array(T).fill(0);
  for (let j=0; j<T; j++) for (let k=0; k<6; k++) o[j] += h[k] * mlpW[4*6 + j*6 + k];
  const m = Math.max(...o);
  const e = o.map(v => Math.exp(v - m));
  const s = e.reduce((a,b)=>a+b,0);
  return e.map(v => v/s);
}
function updateBias() {
  const b = mlpForward(pointerHist);
  for (let i=0; i<N*N; i++) if (collapsed[i]<0) {
    let sum = 0;
    for (let t=0; t<T; t++) if (possibilities[i][t]) sum += b[t];
    // soft bias: reduce possibility of low-bias tiles
    for (let t=0; t<T; t++) if (possibilities[i][t] && b[t] < 0.15) possibilities[i][t] = Math.random() > 0.3;
  }
}
function propagate() {
  // simple iterative neighbor constraint: similar tiles preferred
  let changed = true, iters=0;
  while (changed && iters<4) {
    changed = false; iters++;
    for (let y=0; y<N; y++) for (let x=0; x<N; x++) {
      const i = y*N + x;
      if (collapsed[i] >= 0) continue;
      for (let t=0; t<T; t++) if (possibilities[i][t]) {
        let ok = true;
        [[0,1],[1,0],[0,-1],[-1,0]].forEach(([dx,dy]) => {
          const nx=x+dx, ny=y+dy;
          if (nx<0||nx>=N||ny<0||ny>=N) return;
          const ni = ny*N + nx;
          if (collapsed[ni] >= 0 && Math.abs(collapsed[ni]-t)>1 && Math.random()>0.7) ok=false;
        });
        if (!ok) { possibilities[i][t]=false; changed=true; }
      }
    }
  }
  for (let i=0; i<N*N; i++) {
    const p = possibilities[i].filter(Boolean).length;
    entropy[i] = p;
    if (p===0) { possibilities[i] = Array(T).fill(true); entropy[i]=T; } // restart
    if (p===1) {
      collapsed[i] = possibilities[i].findIndex(Boolean);
    }
  }
}
function forceCollapse(i) {
  if (collapsed[i] >= 0) return;
  const opts = possibilities[i].map((p,t)=>p?t:-1).filter(t=>t>=0);
  if (!opts.length) return;
  const t = opts[Math.floor(Math.random()*opts.length)];
  collapsed[i] = t;
  possibilities[i] = Array(T).fill(false);
  possibilities[i][t] = true;
  entropy[i] = 1;
  propagate();
  render();
}
function render() {
  let cons = 0;
  for (let i=0; i<N*N; i++) {
    const c = cards[i];
    if (collapsed[i] >= 0) {
      c.textContent = TILES[collapsed[i]];
      c.style.background = COLORS[collapsed[i]];
      c.style.transform = 'scale(1)';
      cons++;
    } else {
      c.textContent = entropy[i] + '';
      c.style.background = `hsl(${200 + entropy[i]*20}, 30%, ${20 + entropy[i]*5}%)`;
      c.style.transform = `scale(${0.85 + entropy[i]*0.03})`;
    }
  }
  const e = cons / (N*N);
  document.documentElement.style.setProperty('--ent', e);
  document.getElementById('info').textContent = `consistency ${(e*100)|0}%`;
  if (e > 0.85) document.getElementById('status').textContent = 'High consistency — sealed memory ready';
}
function step() {
  updateBias();
  propagate();
  render();
  requestAnimationFrame(step);
}
step();
// pointer history
document.addEventListener('pointermove', e => {
  pointerHist = [e.clientX/window.innerWidth, e.clientY/window.innerHeight, pointerHist[0], pointerHist[1]];
});
// seal / restore
async function seal() {
  const data = { pattern: collapsed.slice(), weights: mlpW.slice(), t: Date.now() };
  const str = JSON.stringify(data);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(b => Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join(''));
  try {
    const db = await new Promise((res,rej) => { const r=indexedDB.open('verse-f498',1); r.onupgradeneeded=()=>r.result.createObjectStore('seals'); r.onsuccess=()=>res(r.result); r.onerror=rej; });
    const tx = db.transaction('seals','readwrite');
    tx.objectStore('seals').put({hash, data}, 'latest');
    await new Promise(r => tx.oncomplete=r);
  } catch(e) { localStorage.setItem('f498-seal', str); }
  lastSeal = data;
  document.getElementById('status').textContent = 'Sealed ' + hash.slice(0,8);
}
async function restore() {
  let data = lastSeal;
  try {
    const db = await new Promise((res,rej) => { const r=indexedDB.open('verse-f498',1); r.onsuccess=()=>res(r.result); r.onerror=rej; });
    const tx = db.transaction('seals','readonly');
    data = await new Promise(r => { const req=tx.objectStore('seals').get('latest'); req.onsuccess=()=>r(req.result?.data); });
  } catch(e) {
    const s = localStorage.getItem('f498-seal');
    if (s) data = JSON.parse(s);
  }
  if (!data) return;
  collapsed = data.pattern.slice();
  mlpW = data.weights.slice();
  for (let i=0; i<N*N; i++) {
    possibilities[i] = Array(T).fill(false);
    if (collapsed[i]>=0) possibilities[i][collapsed[i]]=true;
    entropy[i] = collapsed[i]>=0 ? 1 : T;
  }
  render();
  document.getElementById('status').textContent = 'Restored seal';
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('reset').onclick = () => {
  possibilities = Array.from({length:N*N}, () => Array(T).fill(true));
  collapsed.fill(-1);
  entropy.fill(T);
  render();
};
document.addEventListener('keydown', e => {
  if (e.key==='s' || e.key==='S') seal();
  if (e.key==='r' || e.key==='R') restore();
});
