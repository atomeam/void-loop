const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
let W, H, particles = [], portals = [], pattern = [], entropy = 0.3, energy = 0.4;
const N = 400, GRID = 16, PH = 12;
function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
resize(); addEventListener('resize', resize);

// Simple Hopfield in main (Worker noted for scale)
let weights = Array(GRID*PH).fill(0).map(() => Array(GRID*PH).fill(0));
let stored = [];
function hebbianStore(pat) {
  stored.push(pat.slice());
  for (let i = 0; i < pat.length; i++) {
    for (let j = i+1; j < pat.length; j++) {
      weights[i][j] += pat[i] * pat[j];
      weights[j][i] = weights[i][j];
    }
  }
}
function recall(partial) {
  let state = partial.slice();
  for (let step = 0; step < 8; step++) {
    for (let i = 0; i < state.length; i++) {
      let s = 0;
      for (let j = 0; j < state.length; j++) s += weights[i][j] * state[j];
      state[i] = s > 0 ? 1 : -1;
    }
  }
  return state;
}

function initParticles() {
  particles = [];
  for (let i = 0; i < N; i++) {
    particles.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
      life: 1
    });
  }
}
initParticles();

function makePortals() {
  portalsEl.innerHTML = '';
  portals = [];
  for (let i = 0; i < 5; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = `Memory ${i+1}\nDrag me`;
    el.style.left = (20 + i*15) + '%';
    el.style.top = (30 + (i%2)*20) + '%';
    portalsEl.appendChild(el);
    portals.push({ el, x: parseFloat(el.style.left)/100*W, y: parseFloat(el.style.top)/100*H, vx:0, vy:0 });
  }
}
makePortals();

let drawing = false, lastX, lastY, stroke = [];
canvas.addEventListener('pointerdown', e => { drawing = true; stroke = []; lastX = e.clientX; lastY = e.clientY; });
addEventListener('pointerup', () => {
  drawing = false;
  if (stroke.length > 4) {
    const pat = Array(GRID*PH).fill(-1);
    stroke.forEach(p => {
      const gx = Math.floor(p.x / W * GRID), gy = Math.floor(p.y / H * PH);
      if (gx>=0 && gx<GRID && gy>=0 && gy<PH) pat[gy*GRID + gx] = 1;
    });
    hebbianStore(pat);
    // inject full recall as forces
    const rec = recall(pat);
    energy = Math.min(1, energy + 0.15);
  }
  stroke = [];
});
canvas.addEventListener('pointermove', e => {
  if (!drawing) return;
  const x = e.clientX, y = e.clientY;
  stroke.push({x,y});
  // seed particles near stroke
  for (let i = 0; i < 3; i++) {
    particles.push({ x: x + (Math.random()-0.5)*20, y: y + (Math.random()-0.5)*20, vx: (x-lastX)*0.2, vy: (y-lastY)*0.2, life: 0.8 });
  }
  if (particles.length > N*1.5) particles.splice(0, particles.length - N);
  lastX = x; lastY = y;
  // partial recall on long stroke
  if (stroke.length % 8 === 0 && stroke.length > 10) {
    const partial = Array(GRID*PH).fill(-1);
    stroke.slice(-12).forEach(p => {
      const gx = Math.floor(p.x / W * GRID), gy = Math.floor(p.y / H * PH);
      if (gx>=0 && gx<GRID && gy>=0 && gy<PH) partial[gy*GRID + gx] = 1;
    });
    const rec = recall(partial);
    // inject forces from recalled bits
    for (let i = 0; i < rec.length; i++) if (rec[i] > 0) {
      const gx = i % GRID, gy = Math.floor(i / GRID);
      const fx = (gx / GRID) * W, fy = (gy / PH) * H;
      particles.forEach(p => {
        const dx = fx - p.x, dy = fy - p.y, d2 = dx*dx + dy*dy + 100;
        p.vx += dx / d2 * 40;
        p.vy += dy / d2 * 40;
      });
    }
    entropy = Math.min(1, entropy + 0.05);
  }
});

// Portal drag
let drag = null, offX, offY;
portalsEl.addEventListener('pointerdown', e => {
  if (e.target.classList.contains('portal')) {
    drag = e.target;
    offX = e.clientX - drag.offsetLeft; offY = e.clientY - drag.offsetTop;
    e.stopPropagation();
  }
});
addEventListener('pointermove', e => {
  if (drag) {
    drag.style.left = (e.clientX - offX) + 'px';
    drag.style.top = (e.clientY - offY) + 'px';
  }
});
addEventListener('pointerup', () => drag = null);

function step() {
  // diffuse velocities a bit
  particles.forEach(p => {
    p.vx *= 0.98; p.vy *= 0.98;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.8;
    if (p.y < 0 || p.y > H) p.vy *= -0.8;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  });
  // attract portals to high energy regions (simple)
  portals.forEach(pt => {
    let best = 0, bx = pt.x, by = pt.y;
    particles.forEach(p => {
      const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d < 120 && p.life > best) { best = p.life; bx = p.x; by = p.y; }
    });
    pt.vx += (bx - pt.x) * 0.002;
    pt.vy += (by - pt.y) * 0.002;
    pt.vx *= 0.9; pt.vy *= 0.9;
    pt.x += pt.vx; pt.y += pt.vy;
    pt.el.style.left = pt.x + 'px';
    pt.el.style.top = pt.y + 'px';
    const act = Math.min(1, best * 1.5);
    pt.el.style.transform = `translate(-50%,-50%) scale(${0.8 + act * 0.4})`;
    pt.el.style.opacity = 0.6 + act * 0.4;
    pt.el.style.borderColor = `hsl(${180 + entropy*120}, 70%, ${50 + act*20}%)`;
  });
  energy = Math.max(0.1, energy * 0.995);
  entropy = Math.max(0.1, entropy * 0.998);
  document.documentElement.style.setProperty('--entropy', entropy.toFixed(3));
  document.documentElement.style.setProperty('--energy', energy.toFixed(3));
}

function draw() {
  ctx.fillStyle = 'rgba(10, 15, 25, 0.25)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `hsla(${200 + entropy*60}, 70%, 60%, 0.6)`;
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.5, 0, Math.PI*2);
    ctx.fill();
  });
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

// Seal / Restore
document.getElementById('seal').onclick = async () => {
  const data = { weights: weights.map(r => r.slice()), stored: stored.slice(-5), entropy, energy };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f597', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('state');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put(data, 'main');
    alert('Sealed to IndexedDB');
  } catch(e) { alert('Seal failed (private mode?)'); }
};
document.getElementById('restore').onclick = async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f597', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get('main');
    req.onsuccess = () => {
      if (req.result) {
        weights = req.result.weights;
        stored = req.result.stored || [];
        entropy = req.result.entropy || 0.3;
        energy = req.result.energy || 0.4;
        alert('Restored');
      }
    };
  } catch(e) { alert('Restore failed'); }
};
document.getElementById('reset').onclick = () => {
  weights = Array(GRID*PH).fill(0).map(() => Array(GRID*PH).fill(0));
  stored = []; entropy = 0.3; energy = 0.4; initParticles(); makePortals();
};
