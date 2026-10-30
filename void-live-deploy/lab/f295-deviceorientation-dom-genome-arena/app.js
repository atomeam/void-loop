const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const arena = document.getElementById('arena');
const info = document.getElementById('orient');
const genEl = document.getElementById('gen');
const fitEl = document.getElementById('fit');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let tiltX = 0, tiltY = 0;
let hasOrient = false;
let generation = 0;
let champion = null;
let championFit = 0;

const AGENTS = 10;
const agents = [];

function randGenome() {
  return Array.from({length:4}, () => (Math.random()-0.5)*2);
}
function mlp(genome, inputs) {
  const [w0,w1,w2,w3] = genome;
  const x = Math.tanh(w0*inputs[0] + w1*inputs[1] + w2*inputs[2]);
  const y = Math.tanh(w3*inputs[0] + w0*inputs[1] + w1*inputs[2]);
  return [x*0.4, y*0.4];
}

for (let i=0; i<AGENTS; i++) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = `A${i}\nfit:0`;
  arena.appendChild(el);
  agents.push({
    el, x: Math.random()*(W-80)+40, y: Math.random()*(H-60)+30,
    vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
    genome: randGenome(), fitness: 0, age: 0, captures: 0
  });
}

function updatePositions() {
  agents.forEach(a => {
    a.el.style.left = (a.x - 36) + 'px';
    a.el.style.top = (a.y - 24) + 'px';
    a.el.innerHTML = `A${agents.indexOf(a)}<br>f:${a.fitness.toFixed(0)}`;
    if (champion && a.genome.every((w,i)=>Math.abs(w-champion[i])<0.01)) a.el.classList.add('winner');
    else a.el.classList.remove('winner');
  });
}

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    tiltX = (e.gamma || 0) / 45;
    tiltY = (e.beta || 0) / 45;
    hasOrient = true;
    info.textContent = `\u03b3:${tiltX.toFixed(2)} \u03b2:${tiltY.toFixed(2)}`;
  });
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.body.addEventListener('click', () => DeviceOrientationEvent.requestPermission().then(s => {
      if (s==='granted') info.textContent = 'orient granted';
    }).catch(()=>{}), {once:true});
  }
} else {
  info.textContent = 'no DeviceOrientation — drag to simulate';
}

let dragging = null;
arena.addEventListener('pointerdown', e => {
  if (e.target.classList.contains('agent')) {
    dragging = agents.find(a => a.el === e.target);
    e.target.setPointerCapture(e.pointerId);
  }
});
arena.addEventListener('pointermove', e => {
  if (dragging) {
    dragging.x = e.clientX;
    dragging.y = e.clientY;
    if (!hasOrient) {
      tiltX = (e.clientX / W - 0.5) * 2;
      tiltY = (e.clientY / H - 0.5) * 2;
      info.textContent = `sim \u03b3:${tiltX.toFixed(2)} \u03b2:${tiltY.toFixed(2)}`;
    }
  }
});
arena.addEventListener('pointerup', () => { dragging = null; });

function step() {
  agents.forEach(a => {
    const energy = Math.min(1, a.fitness / 50);
    const bias = mlp(a.genome, [tiltX, tiltY, energy]);
    a.vx += bias[0] + tiltX * 0.15;
    a.vy += bias[1] + tiltY * 0.15;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x += a.vx; a.y += a.vy;
    if (a.x < 40) { a.x = 40; a.vx *= -0.5; }
    if (a.x > W-40) { a.x = W-40; a.vx *= -0.5; }
    if (a.y < 30) { a.y = 30; a.vy *= -0.5; }
    if (a.y > H-30) { a.y = H-30; a.vy *= -0.5; }
    a.age++;
    a.fitness = a.age * 0.1 + a.captures * 5;
  });

  for (let i=0; i<agents.length; i++) {
    for (let j=i+1; j<agents.length; j++) {
      const a = agents[i], b = agents[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d < 70 && d > 0) {
        const f = (70-d)*0.02;
        a.vx += (dx/d)*f; b.vx -= (dx/d)*f;
        a.vy += (dy/d)*f; b.vy -= (dy/d)*f;
        if (a.fitness > b.fitness) {
          b.genome = a.genome.map(w => w + (Math.random()-0.5)*0.1);
          a.captures++;
        } else if (b.fitness > a.fitness) {
          a.genome = b.genome.map(w => w + (Math.random()-0.5)*0.1);
          b.captures++;
        }
      }
    }
  }

  const best = agents.reduce((m,a) => a.fitness > m.fitness ? a : m, agents[0]);
  if (best.fitness > championFit) {
    champion = [...best.genome];
    championFit = best.fitness;
    fitEl.textContent = championFit.toFixed(1);
  }

  updatePositions();

  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = `hsla(${200 + tiltX*40},70%,50%,0.15)`;
  agents.forEach(a => {
    ctx.beginPath();
    ctx.arc(a.x, a.y, 40 + a.fitness*0.2, 0, Math.PI*2);
    ctx.fill();
  });

  requestAnimationFrame(step);
}
step();

const DB = 'f295-genome';
function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seal');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
document.getElementById('seal').onclick = async () => {
  if (!champion) return;
  const db = await openDB();
  const tx = db.transaction('seal','readwrite');
  tx.objectStore('seal').put({genome: champion, fit: championFit, gen: ++generation}, 'champ');
  genEl.textContent = generation;
  alert('Sealed generation ' + generation);
};
document.getElementById('load').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('seal','readonly');
  const req = tx.objectStore('seal').get('champ');
  req.onsuccess = () => {
    if (req.result) {
      champion = req.result.genome;
      championFit = req.result.fit;
      generation = req.result.gen;
      agents.forEach(a => a.genome = champion.map(w => w + (Math.random()-0.5)*0.05));
      genEl.textContent = generation;
      fitEl.textContent = championFit.toFixed(1);
    }
  };
};
document.getElementById('reset').onclick = () => {
  agents.forEach(a => { a.genome = randGenome(); a.fitness=0; a.captures=0; a.age=0; });
  champion = null; championFit=0; generation=0;
  genEl.textContent=0; fitEl.textContent=0;
};
