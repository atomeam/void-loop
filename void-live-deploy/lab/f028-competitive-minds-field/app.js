const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

const N = 280;
const particles = Array.from({length: N}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
  hue: Math.random()*360
}));

let pointer = {x: W/2, y: H/2, vx: 0, vy: 0, active: false};
let lastPX = pointer.x, lastPY = pointer.y;
addEventListener('pointermove', e => {
  pointer.vx = e.clientX - lastPX; pointer.vy = e.clientY - lastPY;
  lastPX = pointer.x = e.clientX; lastPY = pointer.y = e.clientY;
  pointer.active = true;
});
addEventListener('pointerleave', () => pointer.active = false);

function randomGenome() {
  return [
    0.4 + Math.random()*1.2,
    0.2 + Math.random()*0.8,
    0.3 + Math.random()*1.0,
    1.5 + Math.random()*2.5,
    0.4 + Math.random()*1.6
  ];
}
let popA = Array.from({length: 4}, randomGenome);
let popB = Array.from({length: 4}, randomGenome);
let bestA = popA[0], bestB = popB[0];
let fitA = 0, fitB = 0;
let dominant = 'A';

function mutate(g) {
  return g.map(v => Math.max(0.1, Math.min(4, v + (Math.random()-0.5)*0.25)));
}

function stepParticles(genome) {
  const [align, coh, sep, maxSp, attr] = genome;
  let velVar = 0, proxSum = 0, countProx = 0;
  for (let i = 0; i < N; i++) {
    const p = particles[i];
    let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, nAl = 0, nCo = 0, nSe = 0;
    for (let j = 0; j < N; j++) if (i !== j) {
      const q = particles[j];
      const dx = q.x - p.x, dy = q.y - p.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 3600 && d2 > 1) {
        const d = Math.sqrt(d2);
        ax += q.vx; ay += q.vy; nAl++;
        cx += q.x; cy += q.y; nCo++;
        if (d < 24) { sx -= dx/d; sy -= dy/d; nSe++; }
      }
    }
    if (nAl) { ax /= nAl; ay /= nAl; }
    if (nCo) { cx = cx/nCo - p.x; cy = cy/nCo - p.y; }
    const pdx = pointer.x - p.x, pdy = pointer.y - p.y;
    const pd = Math.hypot(pdx, pdy) || 1;
    const pattr = attr * (pointer.active ? 1 : 0.2) * (dominant === 'A' ? 1.4 : 0.6);
    ax += (pdx/pd) * pattr * 0.8;
    ay += (pdy/pd) * pattr * 0.8;
    let nvx = p.vx + ax*align*0.05 + cx*coh*0.01 + sx*sep*0.15;
    let nvy = p.vy + ay*align*0.05 + cy*coh*0.01 + sy*sep*0.15;
    const sp = Math.hypot(nvx, nvy) || 1;
    if (sp > maxSp) { nvx = nvx/sp * maxSp; nvy = nvy/sp * maxSp; }
    p.vx = nvx; p.vy = nvy;
    p.x = (p.x + p.vx + W) % W; p.y = (p.y + p.vy + H) % H;
    velVar += sp;
    if (pd < 80) { proxSum += (80 - pd); countProx++; }
  }
  const avgVel = velVar / N;
  const prox = countProx ? proxSum / countProx : 0;
  return { avgVel, prox, entropy: avgVel * 0.5 + (1 - Math.min(1, prox/40)) * 2 };
}

function evolve() {
  const stats = stepParticles(bestA);
  fitA = stats.prox * 0.7 + (pointer.active ? 2 : 0);
  fitB = stats.avgVel * 0.8 + stats.entropy * 0.4;
  popA = popA.map(g => Math.random() < 0.7 ? mutate(bestA) : randomGenome());
  popB = popB.map(g => Math.random() < 0.7 ? mutate(bestB) : randomGenome());
  bestA = popA[0]; bestB = popB[0];
  dominant = fitA > fitB * 1.1 ? 'A' : fitB > fitA * 1.1 ? 'B' : dominant;
  document.getElementById('fitA').textContent = fitA.toFixed(1);
  document.getElementById('fitB').textContent = fitB.toFixed(1);
  document.getElementById('dom').textContent = dominant + (dominant==='A'?' (engage)':' (explore)');
  document.getElementById('n').textContent = N;
}

let audioCtx, oscA, oscB, gainA, gainB;
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  oscA = audioCtx.createOscillator(); oscB = audioCtx.createOscillator();
  gainA = audioCtx.createGain(); gainB = audioCtx.createGain();
  oscA.type = 'sine'; oscB.type = 'triangle';
  oscA.connect(gainA).connect(audioCtx.destination);
  oscB.connect(gainB).connect(audioCtx.destination);
  oscA.start(); oscB.start();
  gainA.gain.value = 0; gainB.gain.value = 0;
}
addEventListener('click', initAudio, {once: true});

function applyMorph() {
  const ratio = Math.max(0, Math.min(1, (fitA - fitB + 5) / 10));
  const hue = dominant === 'A' ? 210 : 30;
  document.body.style.filter = `hue-rotate(${hue + ratio*40}deg) brightness(${0.9 + ratio*0.3})`;
  document.body.style.transform = `scale(${1 + (dominant==='A'?0.02:-0.01)})`;
  if (audioCtx) {
    const fA = 180 + fitA * 8;
    const fB = 140 + fitB * 6;
    oscA.frequency.setTargetAtTime(fA, audioCtx.currentTime, 0.1);
    oscB.frequency.setTargetAtTime(fB, audioCtx.currentTime, 0.1);
    gainA.gain.setTargetAtTime(dominant==='A' ? 0.06 : 0.02, audioCtx.currentTime, 0.2);
    gainB.gain.setTargetAtTime(dominant==='B' ? 0.05 : 0.015, audioCtx.currentTime, 0.2);
  }
}

async function seal() {
  const data = { bestA, bestB, fitA, fitB, dominant, t: Date.now() };
  const str = JSON.stringify(data);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  const hash = Array.from(new Uint8Array(buf)).slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
  const db = await new Promise(res => {
    const r = indexedDB.open('f028-seal', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
  });
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({hash, data}, hash);
  document.getElementById('seal').textContent = 'Sealed ' + hash.slice(0,6);
  setTimeout(() => document.getElementById('seal').textContent = 'Seal genomes', 2000);
}
document.getElementById('seal').onclick = seal;

let lastEvo = 0;
function loop(t) {
  if (t - lastEvo > 800) { evolve(); applyMorph(); lastEvo = t; }
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,W,H);
  for (const p of particles) {
    ctx.fillStyle = `hsl(${p.hue + (dominant==='A'?20:-20)}, 70%, 60%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.8, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = `hsla(${p.hue}, 60%, 50%, 0.3)`;
    ctx.fillRect(p.x - p.vx*2, p.y - p.vy*2, 1, 1);
  }
  if (pointer.active) {
    ctx.fillStyle = dominant === 'A' ? 'rgba(100,150,255,0.4)' : 'rgba(255,150,80,0.4)';
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 30, 0, Math.PI*2); ctx.fill();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
