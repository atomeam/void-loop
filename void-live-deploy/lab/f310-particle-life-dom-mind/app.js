const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const sealsEl = document.getElementById('seals');
const SPECIES = 4;
const COLORS = ['#ff6b6b','#4ecdc4','#ffe66d','#a29bfe'];
const N_PARTICLES = 280;
let particles = [];
let matrix = Array.from({length: SPECIES}, () => Array(SPECIES).fill(0).map(() => (Math.random()-0.5)*1.6));
let fitness = 0;
let orbs = [];
let audioCtx, oscillators = [], gains = [];
let worker = null;
let running = true;
let pointer = {x: 0, y: 0, down: false};
let orientation = {beta: 0, gamma: 0};

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

function initParticles() {
  particles = [];
  for (let i = 0; i < N_PARTICLES; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random()-0.5)*0.5,
      vy: (Math.random()-0.5)*0.5,
      s: Math.floor(Math.random() * SPECIES),
      m: 1
    });
  }
}
initParticles();

// Audio
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let s = 0; s < SPECIES; s++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 110 * (s+1) * 1.5;
    osc.type = 'sine';
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    oscillators.push(osc);
    gains.push(gain);
  }
}
document.body.addEventListener('pointerdown', initAudio, {once: true});

// Worker (GA)
function startWorker() {
  const code = `
    const SPECIES = 4;
    let pop = [];
    function randomMatrix() {
      return Array.from({length: SPECIES}, () => Array(SPECIES).fill(0).map(() => (Math.random()-0.5)*1.8));
    }
    function clone(m) { return m.map(r => r.slice()); }
    function mutate(m) {
      const n = clone(m);
      const i = Math.floor(Math.random()*SPECIES);
      const j = Math.floor(Math.random()*SPECIES);
      n[i][j] += (Math.random()-0.5)*0.4;
      n[i][j] = Math.max(-1.5, Math.min(1.5, n[i][j]));
      return n;
    }
    function evaluate(m, snapshot) {
      let forceVar = 0, count = 0;
      for (let i=0;i<SPECIES;i++) for (let j=0;j<SPECIES;j++) {
        forceVar += m[i][j]*m[i][j]; count++;
      }
      const counts = snapshot.counts || [1,1,1,1];
      const total = counts.reduce((a,b)=>a+b,0) || 1;
      let ent = 0;
      counts.forEach(c => { const p=c/total; if(p>0) ent -= p*Math.log(p); });
      const engage = snapshot.engage || 0;
      return ent * 2 + Math.sqrt(forceVar/count) + engage * 0.5;
    }
    self.onmessage = e => {
      const {snapshot, current} = e.data;
      if (pop.length === 0) {
        pop = [clone(current)];
        for (let k=0;k<7;k++) pop.push(mutate(current));
      }
      const scored = pop.map(m => ({m, f: evaluate(m, snapshot)}));
      scored.sort((a,b)=>b.f-a.f);
      const best = scored[0];
      pop = [clone(best.m)];
      while (pop.length < 8) {
        const parent = scored[Math.floor(Math.random()*3)].m;
        pop.push(mutate(parent));
      }
      self.postMessage({matrix: best.m, fitness: best.f});
    };
  `;
  const blob = new Blob([code], {type: 'application/javascript'});
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = e => {
    matrix = e.data.matrix;
    fitness = e.data.fitness;
  };
}
try { startWorker(); } catch(e) { statusEl.textContent = 'Worker blocked, fixed matrix'; }

function step() {
  if (!running) return;
  const w = canvas.width, h = canvas.height;
  const counts = [0,0,0,0];
  let engage = 0;
  const forceScale = 0.08;
  const drag = 0.92;
  const gx = (orientation.gamma || 0) * 0.01;
  const gy = (orientation.beta || 0) * 0.01;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    let fx = gx, fy = gy;
    const dxp = pointer.x - p.x, dyp = pointer.y - p.y;
    const dp = Math.hypot(dxp, dyp) || 1;
    if (dp < 120) {
      fx += dxp / dp * 0.4;
      fy += dyp / dp * 0.4;
      engage += 1;
    }
    for (let j = i+1; j < particles.length; j += 3) {
      const q = particles[j];
      const dx = q.x - p.x, dy = q.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 80) {
        const f = matrix[p.s][q.s] * forceScale / (d*0.02 + 1);
        fx += dx / d * f;
        fy += dy / d * f;
        const f2 = matrix[q.s][p.s] * forceScale / (d*0.02 + 1);
        q.vx -= dx / d * f2 * 0.5;
        q.vy -= dy / d * f2 * 0.5;
      }
    }
    p.vx = (p.vx + fx) * drag;
    p.vy = (p.vy + fy) * drag;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x += w; if (p.x > w) p.x -= w;
    if (p.y < 0) p.y += h; if (p.y > h) p.y -= h;
    counts[p.s]++;
  }
  orbs.forEach(o => o.life--);
  orbs = orbs.filter(o => o.life > 0);
  for (let s = 0; s < SPECIES; s++) {
    if (counts[s] > 40 && orbs.filter(o=>o.s===s).length === 0) {
      let cx=0, cy=0, n=0;
      particles.forEach(p => { if(p.s===s){cx+=p.x;cy+=p.y;n++;} });
      if (n) {
        const orb = document.createElement('div');
        orb.className = 'orb';
        orb.style.background = COLORS[s];
        orb.style.left = (cx/n - 18) + 'px';
        orb.style.top = (cy/n - 18) + 'px';
        orb.textContent = s;
        orb.dataset.s = s;
        document.body.appendChild(orb);
        makeDraggable(orb, s);
        orbs.push({el: orb, s, life: 300, x: cx/n, y: cy/n});
      }
    }
  }
  const avgF = Math.max(0, Math.min(1, (fitness || 1) / 4));
  document.documentElement.style.setProperty('--hue', 180 + avgF * 140);
  document.documentElement.style.setProperty('--scale', 0.98 + avgF * 0.04);
  document.documentElement.style.setProperty('--border', (1 + avgF * 4) + 'px');
  if (gains.length) {
    const total = counts.reduce((a,b)=>a+b,0) || 1;
    counts.forEach((c,s) => {
      const amp = Math.min(0.08, (c / total) * 0.15);
      gains[s].gain.setTargetAtTime(amp, audioCtx.currentTime, 0.1);
    });
  }
  if (worker && Math.random() < 0.03) {
    worker.postMessage({
      current: matrix,
      snapshot: {counts, engage: engage / N_PARTICLES}
    });
  }
  statusEl.textContent = `fit ${fitness.toFixed(2)} | species [${counts.join(',')}] | orbs ${orbs.length}`;
}

function makeDraggable(el, species) {
  let dragging = false, ox=0, oy=0;
  el.addEventListener('pointerdown', e => {
    dragging = true;
    ox = e.clientX - el.offsetLeft;
    oy = e.clientY - el.offsetTop;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    el.style.left = (e.clientX - ox) + 'px';
    el.style.top = (e.clientY - oy) + 'px';
  });
  el.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    const x = parseFloat(el.style.left) + 18;
    const y = parseFloat(el.style.top) + 18;
    particles.forEach(p => {
      if (p.s === species) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < 100) {
          p.vx += (x - p.x) * 0.02;
          p.vy += (y - p.y) * 0.02;
        }
      }
    });
    for (let k=0;k<8;k++) {
      particles.push({
        x: x + (Math.random()-0.5)*40,
        y: y + (Math.random()-0.5)*40,
        vx: (Math.random()-0.5)*2,
        vy: (Math.random()-0.5)*2,
        s: species, m:1
      });
    }
    el.remove();
    orbs = orbs.filter(o => o.el !== el);
  });
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,20,0.25)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  particles.forEach(p => {
    ctx.fillStyle = COLORS[p.s];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI*2);
    ctx.fill();
  });
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
});
canvas.addEventListener('pointerdown', e => { pointer.down = true; });
canvas.addEventListener('pointerup', () => { pointer.down = false; });

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orientation.beta = e.beta || 0;
    orientation.gamma = e.gamma || 0;
  });
}

async function seal() {
  const flat = matrix.flat().map(v => v.toFixed(3)).join(',');
  const data = flat + '|' + fitness.toFixed(3);
  const buf = new TextEncoder().encode(data);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const hash = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
  const entry = {hash, matrix: matrix.map(r=>r.slice()), fitness, t: Date.now()};
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f310-seals', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals', {keyPath: 'hash'});
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put(entry);
    const div = document.createElement('div');
    div.textContent = hash + ' f=' + fitness.toFixed(2);
    sealsEl.prepend(div);
  } catch(e) {
    console.warn(e);
    sealsEl.textContent = 'IDB unavailable';
  }
}
document.getElementById('sealBtn').onclick = seal;
document.getElementById('resetBtn').onclick = () => {
  matrix = Array.from({length: SPECIES}, () => Array(SPECIES).fill(0).map(() => (Math.random()-0.5)*1.6));
  initParticles();
  orbs.forEach(o => o.el.remove());
  orbs = [];
};

(async () => {
  try {
    const db = await new Promise(res => {
      const r = indexedDB.open('f310-seals', 1);
      r.onsuccess = () => res(r.result);
    });
    const tx = db.transaction('seals');
    const req = tx.objectStore('seals').getAll();
    req.onsuccess = () => {
      (req.result || []).slice(-5).reverse().forEach(e => {
        const d = document.createElement('div');
        d.textContent = e.hash + ' f=' + (e.fitness||0).toFixed(2);
        sealsEl.appendChild(d);
      });
    };
  } catch(e) {}
})();
