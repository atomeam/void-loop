const cv = document.getElementById('cv');
const status = document.getElementById('status');
const boxes = [...document.querySelectorAll('.box')];
let W, H, particles = [], genomes = [], gravity = {x:0, y:0.15}, cohesionOn = true;
let modeWebGPU = false, device, context, pipeline;
const N = 400;
const GENS = 4;

function resize() {
  W = cv.width = innerWidth;
  H = cv.height = innerHeight;
}
resize(); addEventListener('resize', resize);

// Genomes: friction, cohesion, restitution
function initGenomes() {
  genomes = [];
  for (let g = 0; g < GENS; g++) {
    genomes.push({
      id: g,
      friction: 0.3 + Math.random()*0.4,
      cohesion: 0.05 + Math.random()*0.1,
      restitution: 0.3 + Math.random()*0.3,
      fitness: 0,
      color: `hsl(${g*90},70%,55%)`
    });
  }
}
initGenomes();

function initParticles() {
  particles = [];
  for (let i = 0; i < N; i++) {
    const g = i % GENS;
    particles.push({
      x: Math.random()*W, y: Math.random()*H*0.4,
      vx: (Math.random()-0.5)*2, vy: 0,
      r: 3 + Math.random()*2,
      gid: g
    });
  }
}
initParticles();

// Simple 2D DEM fallback (pairwise nearby)
function step2D() {
  const dt = 1;
  // Gravity
  for (const p of particles) {
    p.vx += gravity.x * dt;
    p.vy += gravity.y * dt;
  }
  // Contacts (naive O(n^2) for small N)
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    for (let j = i+1; j < particles.length; j++) {
      const b = particles[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const overlap = a.r + b.r - d;
      if (overlap > 0) {
        const nx = dx/d, ny = dy/d;
        const relv = (b.vx - a.vx)*nx + (b.vy - a.vy)*ny;
        const genA = genomes[a.gid], genB = genomes[b.gid];
        const fric = (genA.friction + genB.friction)/2;
        const rest = (genA.restitution + genB.restitution)/2;
        const coh = cohesionOn ? (genA.cohesion + genB.cohesion)/2 : 0;
        const force = overlap * 0.8 + coh - relv * 0.3;
        const fn = Math.max(0, force);
        const fx = nx * fn, fy = ny * fn;
        a.vx -= fx * 0.5; a.vy -= fy * 0.5;
        b.vx += fx * 0.5; b.vy += fy * 0.5;
        // Friction tangential (simplified)
        const tx = -ny, ty = nx;
        const vt = (b.vx - a.vx)*tx + (b.vy - a.vy)*ty;
        const ff = Math.min(Math.abs(vt), fn * fric) * Math.sign(vt);
        a.vx += tx * ff * 0.3; a.vy += ty * ff * 0.3;
        b.vx -= tx * ff * 0.3; b.vy -= ty * ff * 0.3;
      }
    }
  }
  // Obstacles from DOM boxes
  const obstacles = boxes.map(el => {
    const r = el.getBoundingClientRect();
    return {x:r.left, y:r.top, w:r.width, h:r.height, el};
  });
  for (const p of particles) {
    for (const o of obstacles) {
      if (p.x > o.x && p.x < o.x+o.w && p.y > o.y && p.y < o.y+o.h) {
        // simple bounce out
        const cx = o.x + o.w/2, cy = o.y + o.h/2;
        const dx = p.x - cx, dy = p.y - cy;
        if (Math.abs(dx)/o.w > Math.abs(dy)/o.h) p.vx = Math.sign(dx)*2;
        else p.vy = Math.sign(dy)*2;
      }
    }
    // walls
    if (p.x < p.r) { p.x = p.r; p.vx *= -0.5; }
    if (p.x > W-p.r) { p.x = W-p.r; p.vx *= -0.5; }
    if (p.y < p.r) { p.y = p.r; p.vy *= -0.5; }
    if (p.y > H-p.r) { p.y = H-p.r; p.vy *= -0.3; }
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.99; p.vy *= 0.99;
  }
  // Fitness: mean y inverted (higher piles better)
  genomes.forEach(g => g.fitness = 0);
  const counts = genomes.map(() => 0);
  for (const p of particles) {
    genomes[p.gid].fitness += (H - p.y);
    counts[p.gid]++;
  }
  genomes.forEach((g,i) => g.fitness = counts[i] ? g.fitness / counts[i] / H : 0);
}

function draw() {
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  for (const p of particles) {
    ctx.fillStyle = genomes[p.gid].color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fill();
  }
  // genome bars
  ctx.fillStyle = '#fff';
  genomes.forEach((g,i) => {
    ctx.fillStyle = g.color;
    ctx.fillRect(10 + i*70, H-30, 60, -g.fitness*40);
    ctx.fillText(g.fitness.toFixed(2), 12+i*70, H-8);
  });
}

let last = 0;
function loop(t) {
  if (t - last > 16) {
    step2D();
    draw();
    status.innerHTML = `F532 DEM Granular Mind<br>WebGPU: ${modeWebGPU?'yes':'fallback 2D'}<br>Particles: ${particles.length}<br>Best fitness: ${Math.max(...genomes.map(g=>g.fitness)).toFixed(3)}<br>Gravity: ${gravity.x.toFixed(2)},${gravity.y.toFixed(2)}`; // void-review: ok (built from this file's own constants and numbers, no visitor text)
    last = t;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Orientation
document.getElementById('orient').onclick = () => {
  if (window.DeviceOrientationEvent) {
    if (DeviceOrientationEvent.requestPermission) {
      DeviceOrientationEvent.requestPermission().then(p => {
        if (p === 'granted') addEventListener('deviceorientation', onOrient);
      });
    } else addEventListener('deviceorientation', onOrient);
  } else status.innerHTML += '<br>No orientation';
};
function onOrient(e) {
  const beta = (e.beta || 0) * Math.PI/180;
  const gamma = (e.gamma || 0) * Math.PI/180;
  gravity.x = Math.sin(gamma) * 0.3;
  gravity.y = Math.cos(beta) * 0.2 + 0.05;
}

// Pointer tilt fallback
let tilting = false;
cv.onpointerdown = e => { tilting = true; };
cv.onpointerup = () => tilting = false;
cv.onpointermove = e => {
  if (tilting) {
    gravity.x = (e.clientX / W - 0.5) * 0.4;
    gravity.y = (e.clientY / H - 0.5) * 0.3 + 0.1;
  }
};

// Drag boxes
boxes.forEach(b => {
  let ox, oy;
  b.onpointerdown = e => {
    ox = e.clientX - b.offsetLeft; oy = e.clientY - b.offsetTop;
    b.setPointerCapture(e.pointerId);
  };
  b.onpointermove = e => {
    if (e.buttons) {
      b.style.left = (e.clientX - ox) + 'px';
      b.style.top = (e.clientY - oy) + 'px';
    }
  };
});

// Seal + Broadcast
let bc;
try { bc = new BroadcastChannel('f532-dem'); } catch (e) { console.debug("lab f532-webgpu-dem-granular-dom-mind:", e); }
document.getElementById('seal').onclick = seal;
async function seal() {
  const best = genomes.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const data = { genomes, best: best.id, t: Date.now() };
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  const hex = [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  localStorage.setItem('f532-last', hex);
  if (bc) bc.postMessage({type:'genome', genomes, hash:hex});
  status.innerHTML += `<br>Sealed ${hex.slice(0,8)}`; // void-review: ok (built from this file's own constants and numbers, no visitor text)
}
if (bc) bc.onmessage = e => {
  if (e.data.type === 'genome' && e.data.genomes) {
    genomes = e.data.genomes;
    status.innerHTML += '<br>Adopted remote genome';
  }
};
document.getElementById('reset').onclick = () => { initGenomes(); initParticles(); };
document.getElementById('cohesion').onclick = () => { cohesionOn = !cohesionOn; };

// WebGPU probe (stub for future full compute; fallback always works)
async function tryWebGPU() {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    device = await adapter.requestDevice();
    modeWebGPU = true;
    status.innerHTML = status.innerHTML.replace('checking...', 'yes (compute path reserved)'); // void-review: ok (built from this file's own constants and numbers, no visitor text)
  } catch (e) { console.debug("lab f532-webgpu-dem-granular-dom-mind:", e); }
}
tryWebGPU();
