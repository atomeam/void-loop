const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const cardsEl = document.getElementById('cards');
const hud = document.getElementById('hud');
let w, h, particles = [], cards = [], fitness = 0.3, bestGenes = [0.4, 0.6, 0.2, 0.1];
function resize() { w = canvas.width = innerWidth; h = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// Particles
for (let i = 0; i < 150; i++) {
  particles.push({ x: Math.random()*w, y: Math.random()*h, vx: 0, vy: 0, e: Math.random()*0.5 });
}

// Cards
const labels = ['density', 'cluster', 'pose', 'entropy', 'memory'];
for (let i = 0; i < 5; i++) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = labels[i];
  el.onclick = () => seal();
  cardsEl.appendChild(el);
  cards.push({ el, x: Math.random()*w, y: Math.random()*h });
}

// Worker for evolution
let worker;
try {
  const code = `
    let pop = Array.from({length:8}, () => [Math.random(), Math.random(), Math.random(), Math.random()]);
    let fit = Array(8).fill(0);
    onmessage = e => {
      const { densityVar, hits } = e.data;
      // simple fitness
      for (let i = 0; i < 8; i++) fit[i] = densityVar * 0.6 + hits * 0.4 + Math.random()*0.05;
      const best = fit.indexOf(Math.max(...fit));
      // mutate
      const elite = pop[best].slice();
      const worst = fit.indexOf(Math.min(...fit));
      pop[worst] = elite.map(g => Math.max(0, Math.min(1, g + (Math.random()-0.5)*0.15)));
      postMessage({ genes: pop[best], fitness: fit[best] });
    };
  `;
  worker = new Worker(URL.createObjectURL(new Blob([code])));
  worker.onmessage = e => { bestGenes = e.data.genes; fitness = Math.min(1, e.data.fitness); };
} catch (e) { console.warn('Worker blocked', e); }

// Input
let px = w/2, py = h/2, orient = { beta: 0, gamma: 0 };
addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; });
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => { orient.beta = e.beta || 0; orient.gamma = e.gamma || 0; });
}

// XR optional
let xrSession = null;
async function tryXR() {
  if (!navigator.xr) return;
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    hud.textContent += ' · XR active';
  } catch (e) { /* fallback */ }
}
document.body.addEventListener('click', () => { if (!xrSession) tryXR(); }, { once: true });

function step() {
  const [attr, diff, noise, bias] = bestGenes;
  // inject from pointer / orient
  const injX = px + orient.gamma * 2;
  const injY = py + orient.beta * 2;
  particles.forEach(p => {
    const dx = injX - p.x, dy = injY - p.y;
    const d = Math.hypot(dx, dy) + 1;
    p.vx += (dx / d) * attr * 0.8 + (Math.random()-0.5)*noise;
    p.vy += (dy / d) * attr * 0.8 + (Math.random()-0.5)*noise;
    p.vx *= 0.92 + diff*0.05; p.vy *= 0.92 + diff*0.05;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > w) p.vx *= -1;
    if (p.y < 0 || p.y > h) p.vy *= -1;
    p.e = Math.min(1, p.e * 0.98 + (d < 80 ? 0.15 : 0));
  });

  // stats
  const dens = particles.reduce((s, p) => s + p.e, 0) / particles.length;
  const varD = particles.reduce((s, p) => s + (p.e - dens)**2, 0) / particles.length;
  const hits = particles.filter(p => Math.hypot(p.x-injX, p.y-injY) < 100).length;
  if (worker) worker.postMessage({ densityVar: varD, hits: hits/particles.length });

  // render field
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, w, h);
  particles.forEach(p => {
    ctx.fillStyle = `hsla(${180 + p.e*80}, 70%, ${40 + p.e*40}%, ${0.4 + p.e*0.5})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2 + p.e*4, 0, Math.PI*2); ctx.fill();
  });

  // position cards near high-energy particles
  cards.forEach((c, i) => {
    const p = particles[i * 30 % particles.length];
    c.x += (p.x - c.x) * 0.05;
    c.y += (p.y - c.y) * 0.05;
    const sc = 0.8 + p.e * 0.6;
    c.el.style.transform = `translate(${c.x}px, ${c.y}px) scale(${sc}) rotateY(${(p.e-0.5)*40}deg)`;
    c.el.style.background = `hsla(${200 + dens*60}, 60%, 30%, 0.75)`;
  });

  // morph stage
  const hue = 180 + fitness * 120;
  stage.style.filter = `hue-rotate(${hue}deg) contrast(${1 + fitness*0.4})`;
  stage.style.transform = `perspective(800px) rotateX(${(fitness-0.3)*8}deg) rotateY(${orient.gamma*0.3}deg)`;

  requestAnimationFrame(step);
}
step();

async function seal() {
  const payload = JSON.stringify({ genes: bestGenes, fitness, t: Date.now() });
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const hash = Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2,'0')).join('');
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('void-f050', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ hash, genes: bestGenes, fitness }, hash);
    hud.textContent = `Sealed ${hash}`;
  } catch (e) { hud.textContent = `Sealed (mem) ${hash}`; }
}
document.getElementById('seal').onclick = seal;
