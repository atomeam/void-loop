const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const portalsEl = document.getElementById('portals');
const status = document.getElementById('status');
let W = innerWidth, H = innerHeight;
function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize); resize();

const N_MAPS = 3;
const POP = 10;
const POINTS = 1800;
let genomes = [];
let best = null;
let points = [];
let pointer = {x: W/2, y: H/2, t: 0};
let fitnessHist = [];

function randomGenome() {
  const maps = [];
  for (let i = 0; i < N_MAPS; i++) {
    maps.push({
      a: (Math.random()-0.5)*1.6, b: (Math.random()-0.5)*1.6,
      c: (Math.random()-0.5)*1.6, d: (Math.random()-0.5)*1.6,
      e: (Math.random()-0.5)*0.8, f: (Math.random()-0.5)*0.8,
      p: 1/N_MAPS
    });
  }
  return { maps, fitness: 0, id: Math.random() };
}

function mutate(g, rate=0.15) {
  const ng = JSON.parse(JSON.stringify(g));
  ng.maps.forEach(m => {
    ['a','b','c','d','e','f'].forEach(k => { if (Math.random() < rate) m[k] += (Math.random()-0.5)*0.25; });
    m.p = Math.max(0.05, m.p + (Math.random()-0.5)*0.05);
  });
  const s = ng.maps.reduce((a,m)=>a+m.p,0);
  ng.maps.forEach(m => m.p /= s);
  ng.fitness = 0;
  ng.id = Math.random();
  return ng;
}

function init() {
  genomes = Array.from({length: POP}, randomGenome);
  best = genomes[0];
  points = [{x:0,y:0}];
}
init();

function iterate(g, n) {
  let x=0, y=0;
  const pts = [];
  for (let i = 0; i < n; i++) {
    let r = Math.random(), acc = 0, map = g.maps[0];
    for (const m of g.maps) { acc += m.p; if (r < acc) { map = m; break; } }
    const nx = map.a * x + map.b * y + map.e;
    const ny = map.c * x + map.d * y + map.f;
    x = nx; y = ny;
    if (i > 20) pts.push({x, y});
  }
  return pts;
}

function fitnessOf(g) {
  const pts = iterate(g, 400);
  if (!pts.length) return 0;
  let minX=1e9, maxX=-1e9, minY=1e9, maxY=-1e9, near=0;
  const px = (pointer.x / W - 0.5) * 2;
  const py = (pointer.y / H - 0.5) * 2;
  pts.forEach(p => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    const dx = p.x - px, dy = p.y - py;
    if (dx*dx + dy*dy < 0.15) near++;
  });
  const spread = (maxX-minX) * (maxY-minY);
  const ent = Math.min(1, pts.length / 200);
  return spread * 0.4 + (near / pts.length) * 2.2 + ent * 0.3;
}

function evolve() {
  genomes.forEach(g => g.fitness = fitnessOf(g));
  genomes.sort((a,b) => b.fitness - a.fitness);
  best = genomes[0];
  const next = genomes.slice(0, 4);
  while (next.length < POP) next.push(mutate(genomes[Math.floor(Math.random()*4)]));
  genomes = next;
}

function render() {
  ctx.fillStyle = 'rgba(10,12,20,0.18)';
  ctx.fillRect(0,0,W,H);
  const pts = iterate(best, POINTS);
  points = pts;
  let minX=1e9, maxX=-1e9, minY=1e9, maxY=-1e9;
  pts.forEach(p => { minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y); });
  const sx = (maxX-minX)||1, sy = (maxY-minY)||1;
  ctx.fillStyle = `hsla(${getComputedStyle(document.documentElement).getPropertyValue('--hue')},70%,65%,0.55)`;
  pts.forEach(p => {
    const X = ((p.x - minX)/sx) * (W*0.8) + W*0.1;
    const Y = ((p.y - minY)/sy) * (H*0.8) + H*0.1;
    ctx.fillRect(X, Y, 1.4, 1.4);
  });

  const portalCount = 5;
  while (portalsEl.children.length < portalCount) {
    const d = document.createElement('div');
    d.className = 'portal';
    d.textContent = 'Verse';
    portalsEl.appendChild(d);
  }
  for (let i = 0; i < portalCount; i++) {
    const p = pts[Math.floor(i * pts.length / portalCount)] || pts[0];
    if (!p) continue;
    const X = ((p.x - minX)/sx) * (W*0.8) + W*0.1;
    const Y = ((p.y - minY)/sy) * (H*0.8) + H*0.1;
    const el = portalsEl.children[i];
    el.style.left = X + 'px';
    el.style.top = Y + 'px';
    el.style.transform = `translate(-50%,-50%) scale(${0.7 + Math.min(1, best.fitness)*0.6}) rotate(${i*12}deg)`;
  }

  const complexity = Math.min(1, (sx*sy)*0.8 + Math.abs(best.fitness)*0.2);
  document.documentElement.style.setProperty('--complexity', complexity);
  document.documentElement.style.setProperty('--energy', Math.min(1, best.fitness * 0.5));
  document.documentElement.style.setProperty('--hue', 180 + complexity * 140);
  status.textContent = `fitness ${best.fitness.toFixed(2)} · complexity ${complexity.toFixed(2)} · portals ${portalCount}`;
}

let lastEvo = 0;
function loop(t) {
  if (t - lastEvo > 420) { evolve(); lastEvo = t; }
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = performance.now(); });
addEventListener('pointerdown', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

async function seal() {
  const payload = { genome: best, ts: Date.now() };
  const str = JSON.stringify(payload);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  const hash = Array.from(new Uint8Array(buf)).slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f494', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put(payload, 'last');
    await new Promise(r => tx.oncomplete = r);
  } catch (e) {
    localStorage.setItem('f494-last', str);
  }
  status.textContent = `sealed ${hash}`;
  setTimeout(() => status.textContent = 'Move pointer to guide · S seal · R restore', 2000);
}

async function restore() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f494', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readonly');
    const req = tx.objectStore('seals').get('last');
    req.onsuccess = () => {
      if (req.result?.genome) {
        genomes[0] = req.result.genome;
        best = req.result.genome;
        status.textContent = 'restored last seal';
      }
    };
  } catch (e) {
    const s = localStorage.getItem('f494-last');
    if (s) { const p = JSON.parse(s); genomes[0] = p.genome; best = p.genome; status.textContent = 'restored (ls)'; }
  }
}

document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('reset').onclick = () => { init(); status.textContent = 'reset'; };
addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') seal();
  if (e.key === 'r' || e.key === 'R') restore();
});
