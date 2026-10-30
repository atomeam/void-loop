const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
const domSpan = document.getElementById('dom');
const cohSpan = document.getElementById('coh');
const sealBtn = document.getElementById('seal');

let W, H, particles = [];
const N = 1200;
let pointer = { x: 0, y: 0, active: false };
let energy = 0;
let bands = [0,0,0,0,0]; // low to high
let coherence = 0;
let genes = { diffusion: 0.02, attract: 0.4, resonance: 0.6, decay: 0.985 };

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  if (particles.length === 0) init();
}
window.addEventListener('resize', resize);
resize();

function init() {
  particles = Array.from({length: N}, () => ({
    x: Math.random()*W, y: Math.random()*H,
    vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
    e: Math.random()
  }));
}

function step() {
  // Simple spectral proxy: bin particle speeds into bands
  const speeds = particles.map(p => Math.hypot(p.vx, p.vy));
  const maxS = Math.max(...speeds, 1);
  bands = [0,0,0,0,0];
  speeds.forEach(s => {
    const b = Math.min(4, Math.floor((s / maxS) * 5));
    bands[b]++;
  });
  const total = speeds.length || 1;
  bands = bands.map(b => b / total);
  const mean = bands.reduce((a,b)=>a+b,0)/5;
  const variance = bands.reduce((a,b)=>a+(b-mean)**2,0)/5;
  coherence = Math.max(0, 1 - variance*8); // higher when energy concentrated

  // Mind applies genes: attract toward pointer if active, resonance boost
  particles.forEach(p => {
    if (pointer.active) {
      const dx = pointer.x - p.x, dy = pointer.y - p.y;
      const d = Math.hypot(dx,dy) || 1;
      p.vx += (dx/d) * genes.attract * 0.15;
      p.vy += (dy/d) * genes.attract * 0.15;
      if (d < 40) p.e = Math.min(1, p.e + 0.05);
    }
    // spectral diffusion + resonance
    p.vx += (Math.random()-0.5) * genes.diffusion * 4;
    p.vy += (Math.random()-0.5) * genes.diffusion * 4;
    p.vx *= genes.decay;
    p.vy *= genes.decay;
    p.e *= 0.995;
    p.x = (p.x + p.vx + W) % W;
    p.y = (p.y + p.vy + H) % H;
  });

  // Morph page based on dominant band and coherence
  const dom = bands.indexOf(Math.max(...bands));
  const hue = 180 + dom * 40 + coherence * 60;
  document.body.style.filter = `hue-rotate(${hue}deg) saturate(${0.8 + coherence*0.6})`;
  domSpan.textContent = ['sub','low','mid','high','ultra'][dom];
  cohSpan.textContent = coherence.toFixed(2);

  // Spawn portals occasionally based on coherence
  if (Math.random() < 0.012 * coherence && portalsEl.children.length < 6) {
    spawnPortal(dom);
  }
}

function spawnPortal(band) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = ['sub','low','mid','high','ultra'][band];
  el.style.left = (Math.random()*0.7*W + 0.1*W) + 'px';
  el.style.top = (Math.random()*0.7*H + 0.1*H) + 'px';
  el.onclick = () => {
    genes.resonance = Math.min(1, genes.resonance + 0.08);
    genes.attract = Math.min(1, genes.attract + 0.05);
    el.remove();
    // brief flash
    el.style.background = 'rgba(200,255,200,0.6)';
  };
  portalsEl.appendChild(el);
  setTimeout(() => el.remove(), 8000);
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  particles.forEach(p => {
    const alpha = 0.3 + p.e * 0.7;
    ctx.fillStyle = `hsla(${180 + p.e*120}, 70%, 60%, ${alpha})`;
    ctx.fillRect(p.x-1, p.y-1, 2, 2);
  });
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
});
canvas.addEventListener('pointerleave', () => pointer.active = false);
canvas.addEventListener('pointerdown', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  // inject energy burst
  particles.forEach(p => {
    const dx = pointer.x - p.x, dy = pointer.y - p.y;
    if (Math.hypot(dx,dy) < 60) p.e = 1;
  });
});

sealBtn.onclick = () => {
  const data = { genes, bands, coherence, ts: Date.now() };
  const str = JSON.stringify(data);
  // simple hash
  let h = 0;
  for (let i=0;i<str.length;i++) h = (h*31 + str.charCodeAt(i))|0;
  localStorage.setItem('f044-seal', JSON.stringify({ hash: h.toString(16), data }));
  sealBtn.textContent = 'Sealed ' + h.toString(16).slice(-6);
  setTimeout(() => sealBtn.textContent = 'Seal Genome', 2000);
};

// Load previous if any
try {
  const prev = JSON.parse(localStorage.getItem('f044-seal')||'null');
  if (prev && prev.data && prev.data.genes) genes = prev.data.genes;
} catch(e){}
