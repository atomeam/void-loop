const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const cardsEl = document.getElementById('cards');
const info = document.getElementById('info');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 80, K = 6, DIM = 4;
let particles = [];
let pointer = { x: W/2, y: H/2 };
let seals = [];

function randState() { return Array.from({length: DIM}, () => Math.random()*2-1); }

function initParticles() {
  particles = Array.from({length: N}, () => ({
    x: Math.random()*W, y: Math.random()*H,
    vx: 0, vy: 0,
    state: randState(),
    attn: 0
  }));
}

function dist(a,b) { const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }
function cosine(a,b) {
  let d=0, na=0, nb=0;
  for (let i=0;i<DIM;i++) { d+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
  return d / (Math.sqrt(na*nb)+1e-6);
}

function step() {
  // local attention
  for (let i=0;i<N;i++) {
    const p = particles[i];
    const neigh = [];
    for (let j=0;j<N;j++) if (i!==j) {
      const d = dist(p, particles[j]);
      if (d < 180) neigh.push({j, d, sim: cosine(p.state, particles[j].state)});
    }
    neigh.sort((a,b)=>a.d-b.d);
    const top = neigh.slice(0, K);
    if (!top.length) continue;
    let scores = top.map(n => Math.exp(-n.d/60) * (n.sim+1)/2);
    const sum = scores.reduce((a,b)=>a+b,0)+1e-6;
    scores = scores.map(s=>s/sum);
    let fx=0, fy=0, msg = [0,0,0,0];
    top.forEach((n,k) => {
      const q = particles[n.j];
      fx += (q.x - p.x) * scores[k] * 0.15;
      fy += (q.y - p.y) * scores[k] * 0.15;
      for (let d=0;d<DIM;d++) msg[d] += q.state[d] * scores[k];
    });
    // pointer bias as observation
    const pdx = pointer.x - p.x, pdy = pointer.y - p.y;
    const pd = Math.hypot(pdx,pdy)+1;
    fx += pdx/pd * 0.4; fy += pdy/pd * 0.4;
    p.vx = p.vx*0.92 + fx;
    p.vy = p.vy*0.92 + fy;
    p.x += p.vx; p.y += p.vy;
    // soft bounds
    if (p.x<0||p.x>W) p.vx *= -0.5;
    if (p.y<0||p.y>H) p.vy *= -0.5;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
    // update state slightly toward message
    for (let d=0;d<DIM;d++) p.state[d] = p.state[d]*0.95 + msg[d]*0.05;
    p.attn = scores.reduce((a,b)=>a+b,0);
  }
}

function findClusters() {
  const bins = new Map();
  const BS = 80;
  particles.forEach((p,i) => {
    const bx = Math.floor(p.x/BS), by = Math.floor(p.y/BS);
    const key = bx+','+by;
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push(i);
  });
  const clusters = [];
  bins.forEach(idxs => {
    if (idxs.length < 4) return;
    let mx=0, my=0, energy=0, mean=[0,0,0,0];
    idxs.forEach(i => {
      const p = particles[i];
      mx += p.x; my += p.y; energy += p.attn;
      for (let d=0;d<DIM;d++) mean[d] += p.state[d];
    });
    const n = idxs.length;
    mx/=n; my/=n; energy/=n;
    for (let d=0;d<DIM;d++) mean[d]/=n;
    if (energy > 0.25) clusters.push({ x:mx, y:my, energy, mean, n });
  });
  return clusters;
}

function render(clusters) {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  particles.forEach(p => {
    ctx.fillStyle = `hsla(${(p.state[0]*180+180)|0},70%,60%,0.8)`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3+p.attn*4, 0, Math.PI*2); ctx.fill();
  });
  // cards
  cardsEl.innerHTML = '';
  clusters.forEach((c,i) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.style.left = c.x+'px';
    el.style.top = c.y+'px';
    el.style.setProperty('--hue', (c.mean[0]*180+180)|0);
    el.style.setProperty('--scale', (0.8 + c.energy*0.8).toFixed(2));
    el.style.setProperty('--blur', Math.max(0, 2-c.energy*3)+'px');
    el.textContent = c.mean.map(v=>v.toFixed(1)).join(' ');
    el.onclick = () => { // reinforce
      particles.forEach(p => {
        if (Math.hypot(p.x-c.x, p.y-c.y) < 100) {
          for (let d=0;d<DIM;d++) p.state[d] = p.state[d]*0.7 + c.mean[d]*0.3;
          p.attn += 0.2;
        }
      });
    };
    cardsEl.appendChild(el);
  });
  info.textContent = `particles: ${N} | clusters: ${clusters.length}`;
}

async function seal() {
  const clusters = findClusters();
  if (!clusters.length) return;
  const data = clusters.map(c => c.mean);
  const str = JSON.stringify(data);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  const hex = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const db = await openDB();
  const tx = db.transaction('seals', 'readwrite');
  tx.objectStore('seals').put({ id: Date.now(), hash: hex, data, time: new Date().toISOString() });
  seals.push(hex);
  alert('Sealed ' + clusters.length + ' clusters\nhash: ' + hex.slice(0,16)+'...');
}

function openDB() {
  return new Promise((res,rej) => {
    const req = indexedDB.open('f487-mind', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('seals', {keyPath:'id'});
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
}

async function restore() {
  try {
    const db = await openDB();
    const tx = db.transaction('seals', 'readonly');
    const all = await new Promise(r => { const req = tx.objectStore('seals').getAll(); req.onsuccess = () => r(req.result); });
    if (all.length) {
      const last = all[all.length-1];
      // re-seed some particles toward last seals
      last.data.forEach((mean,i) => {
        if (particles[i]) particles[i].state = mean.slice();
      });
      alert('Restored last seal');
    }
  } catch(e) {}
}

document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('reset').onclick = () => { initParticles(); seals=[]; };
addEventListener('keydown', e => { if (e.key==='s'||e.key==='S') seal(); if (e.key==='r'||e.key==='R') restore(); });
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
addEventListener('pointerdown', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

initParticles();
function loop() {
  step();
  const clusters = findClusters();
  render(clusters);
  requestAnimationFrame(loop);
}
loop();
