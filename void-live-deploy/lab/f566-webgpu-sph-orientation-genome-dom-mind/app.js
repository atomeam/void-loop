const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
window.onresize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };

const N = 100;
const h = 45; // smoothing radius
let particles = [];
let gravity = [0, 0.15];
let useOrientation = false;
let droplets = [];
const DB_NAME = 'f566-sph-mind';
let db;

function initParticles(count = N) {
  particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * W * 0.8 + W * 0.1,
      y: Math.random() * H * 0.6 + H * 0.2,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      density: 1,
      pressure: 0,
      genome: [1.0 + Math.random()*0.5, 0.1 + Math.random()*0.3, 0.5 + Math.random()*1.0], // restD, visc, stiff
      hue: Math.random() * 360
    });
  }
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function step() {
  // Simple SPH approximation
  for (let p of particles) {
    p.density = 0;
    for (let q of particles) {
      const d = dist(p, q);
      if (d < h && d > 0) {
        const w = Math.max(0, 1 - d/h);
        p.density += w * w;
      }
    }
    p.density = Math.max(0.1, p.density / 10);
    p.pressure = p.genome[2] * (p.density - p.genome[0]);
  }

  for (let p of particles) {
    let fx = gravity[0], fy = gravity[1];
    for (let q of particles) {
      if (p === q) continue;
      const d = dist(p, q);
      if (d < h && d > 0.1) {
        const dx = (q.x - p.x) / d, dy = (q.y - p.y) / d;
        const press = (p.pressure + q.pressure) * 0.5;
        const w = Math.max(0, 1 - d/h);
        fx -= press * dx * w * 0.8;
        fy -= press * dy * w * 0.8;
        // viscosity
        fx += (q.vx - p.vx) * p.genome[1] * w * 0.3;
        fy += (q.vy - p.vy) * p.genome[1] * w * 0.3;
      }
    }
    p.vx += fx * 0.2;
    p.vy += fy * 0.2;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.x += p.vx;
    p.y += p.vy;
    // bounds
    if (p.x < 10) { p.x = 10; p.vx *= -0.5; }
    if (p.x > W-10) { p.x = W-10; p.vx *= -0.5; }
    if (p.y < 10) { p.y = 10; p.vy *= -0.5; }
    if (p.y > H-10) { p.y = H-10; p.vy *= -0.5; }
  }

  // Clusters for DOM
  updateDroplets();
}

function updateDroplets() {
  // Find high density centers roughly
  const high = particles.filter(p => p.density > 1.5).slice(0, 6);
  droplets.forEach(d => d.el.remove());
  droplets = [];
  high.forEach((p, i) => {
    if (i > 4) return;
    const el = document.createElement('div');
    el.className = 'droplet';
    el.style.left = (p.x - 30) + 'px';
    el.style.top = (p.y - 30) + 'px';
    el.style.setProperty('--hue', p.hue);
    el.textContent = `\u03c1${p.density.toFixed(1)}\nvis${p.genome[1].toFixed(2)}`;
    el.dataset.genome = JSON.stringify(p.genome);
    makeDraggable(el, p);
    document.body.appendChild(el);
    droplets.push({ el, p });
  });
  document.getElementById('status').textContent = `SPH Fluid Verse | Particles: ${particles.length} | Clusters: ${droplets.length}`;
}

function makeDraggable(el, source) {
  let ox, oy, dragging = false;
  el.onpointerdown = e => {
    dragging = true;
    ox = e.clientX - parseFloat(el.style.left);
    oy = e.clientY - parseFloat(el.style.top);
    el.setPointerCapture(e.pointerId);
  };
  el.onpointermove = e => {
    if (!dragging) return;
    el.style.left = (e.clientX - ox) + 'px';
    el.style.top = (e.clientY - oy) + 'px';
  };
  el.onpointerup = e => {
    dragging = false;
    // Inject genome to nearby particles
    const gx = parseFloat(el.style.left) + 30;
    const gy = parseFloat(el.style.top) + 30;
    const g = JSON.parse(el.dataset.genome);
    particles.forEach(p => {
      if (Math.hypot(p.x - gx, p.y - gy) < 80) {
        p.genome = p.genome.map((v, i) => v * 0.7 + g[i] * 0.3);
        p.hue = (p.hue + parseFloat(el.style.getPropertyValue('--hue') || 180)) / 2;
      }
    });
  };
}

function render() {
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0, 0, W, H);
  for (let p of particles) {
    ctx.fillStyle = `hsla(${p.hue},70%,60%,0.7)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 + p.density * 1.5, 0, Math.PI*2);
    ctx.fill();
  }
}

function loop() {
  step();
  render();
  requestAnimationFrame(loop);
}

// Sensors
window.addEventListener('deviceorientation', e => {
  if (!useOrientation || e.beta == null) return;
  gravity = [Math.sin(e.gamma * Math.PI/180) * 0.3, Math.sin(e.beta * Math.PI/180) * 0.3];
});

cv.onpointermove = e => {
  // Gentle force toward pointer
  const mx = e.clientX, my = e.clientY;
  particles.forEach(p => {
    const d = Math.hypot(p.x - mx, p.y - my);
    if (d < 100 && d > 5) {
      p.vx += (mx - p.x) / d * 0.05;
      p.vy += (my - p.y) / d * 0.05;
    }
  });
};

// IndexedDB
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('state');
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  });
}

async function seal() {
  if (!db) db = await openDB();
  const tx = db.transaction('state', 'readwrite');
  const elites = particles.slice(0, 20).map(p => ({ x:p.x, y:p.y, genome:p.genome, hue:p.hue }));
  tx.objectStore('state').put({ particles: elites, gravity }, 'elites');
  document.getElementById('status').textContent = 'Sealed to IndexedDB';
  // Broadcast
  try {
    const bc = new BroadcastChannel('verse-sph-genome');
    bc.postMessage({ type: 'genome', data: elites });
  } catch (e) { console.debug("lab f566-webgpu-sph-orientation-genome-dom-mind:", e); }
}

async function load() {
  try {
    if (!db) db = await openDB();
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get('elites');
    req.onsuccess = () => {
      if (req.result && req.result.particles) {
        particles = req.result.particles.map(p => ({...p, vx:0, vy:0, density:1, pressure:0}));
        while (particles.length < N) initParticles(1); // pad
      }
    };
  } catch(e) { console.warn(e); }
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initParticles(); droplets.forEach(d=>d.el.remove()); };
document.getElementById('add').onclick = () => {
  for (let i=0; i<10; i++) {
    particles.push({
      x: W/2 + (Math.random()-0.5)*40,
      y: H/2 + (Math.random()-0.5)*40,
      vx:0, vy:0, density:1, pressure:0,
      genome: [1.2, 0.2, 0.8],
      hue: 200
    });
  }
};
document.getElementById('tilt').onclick = () => {
  useOrientation = !useOrientation;
  if (useOrientation && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => { if(p!=='granted') useOrientation=false; });
  }
  document.getElementById('status').textContent = 'Tilt ' + (useOrientation ? 'ON' : 'OFF');
};

// Init
initParticles();
load().then(() => loop());
