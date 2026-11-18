const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

const portals = [];
const NUM = 6;
let orient = { beta: 0, gamma: 0 };
let pointer = { x: innerWidth/2, y: innerHeight/2, dx: 0, dy: 0 };
let lastPointer = { ...pointer };
let genomes = [];
let bestFitness = -Infinity;
let frame = 0;

function rand(a,b){ return a + Math.random()*(b-a); }
function tanh(x){ return Math.tanh(x); }

class MLP {
  constructor() {
    this.w1 = Array.from({length:8*6}, () => rand(-0.5,0.5));
    this.b1 = Array.from({length:6}, () => rand(-0.2,0.2));
    this.w2 = Array.from({length:6*4}, () => rand(-0.5,0.5));
    this.b2 = Array.from({length:4}, () => rand(-0.2,0.2));
  }
  forward(inp) {
    const h = new Array(6).fill(0);
    for(let i=0;i<6;i++) {
      let s = this.b1[i];
      for(let j=0;j<8;j++) s += inp[j] * this.w1[j*6 + i];
      h[i] = tanh(s);
    }
    const out = new Array(4).fill(0);
    for(let i=0;i<4;i++) {
      let s = this.b2[i];
      for(let j=0;j<6;j++) s += h[j] * this.w2[j*4 + i];
      out[i] = tanh(s);
    }
    return out;
  }
  clone() {
    const m = new MLP();
    m.w1 = [...this.w1]; m.b1 = [...this.b1];
    m.w2 = [...this.w2]; m.b2 = [...this.b2];
    return m;
  }
  mutate(rate=0.1) {
    const mut = arr => arr.map(v => v + rand(-rate,rate));
    this.w1 = mut(this.w1); this.b1 = mut(this.b1);
    this.w2 = mut(this.w2); this.b2 = mut(this.b2);
  }
}

function createPortal(i) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = `Portal ${i+1}\nPolicy active`;
  el.style.left = rand(50, innerWidth-200) + 'px';
  el.style.top = rand(80, innerHeight-150) + 'px';
  document.getElementById('stage').appendChild(el);
  const p = {
    el, x: parseFloat(el.style.left), y: parseFloat(el.style.top),
    vx:0, vy:0, scale:1, hue:200, fitness:0, hover:0,
    mlp: new MLP()
  };
  el.addEventListener('pointerenter', () => p.hover = 1);
  el.addEventListener('pointerleave', () => p.hover = 0);
  el.addEventListener('click', () => { p.fitness += 5; statusEl.textContent = `Rewarded Portal ${i+1}`; });
  return p;
}

for(let i=0;i<NUM;i++) portals.push(createPortal(i));
genomes = portals.map(p => p.mlp);

function update() {
  frame++;
  pointer.dx = pointer.x - lastPointer.x;
  pointer.dy = pointer.y - lastPointer.y;
  lastPointer = { ...pointer };

  const inpBase = [
    pointer.dx / 20, pointer.dy / 20,
    orient.beta / 90, orient.gamma / 90,
    0, 0, 0, 0
  ];

  portals.forEach((p, i) => {
    const rect = p.el.getBoundingClientRect();
    const relX = (rect.left + rect.width/2 - pointer.x) / innerWidth;
    const relY = (rect.top + rect.height/2 - pointer.y) / innerHeight;
    const inp = [...inpBase];
    inp[4] = relX; inp[5] = relY; inp[6] = p.hover; inp[7] = p.scale - 1;
    const out = p.mlp.forward(inp);
    p.vx += out[0] * 0.8;
    p.vy += out[1] * 0.8;
    p.scale = Math.max(0.6, Math.min(1.8, p.scale + out[2]*0.02));
    p.hue = (p.hue + out[3]*2 + 360) % 360;
    p.vx *= 0.92; p.vy *= 0.92;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(10, Math.min(innerWidth-160, p.x));
    p.y = Math.max(60, Math.min(innerHeight-110, p.y));
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
    p.el.style.transform = `scale(${p.scale})`;
    p.el.style.borderColor = `hsl(${p.hue},70%,60%)`;
    p.el.style.background = `hsla(${p.hue},40%,15%,0.85)`;
    if (p.hover) p.fitness += 0.05;
    p.fitness *= 0.995;
  });

  if (frame % 180 === 0) {
    const sorted = [...portals].sort((a,b) => b.fitness - a.fitness);
    const winner = sorted[0].mlp;
    portals.forEach((p, i) => {
      if (i > 0 && p.fitness < sorted[0].fitness) {
        p.mlp = winner.clone();
        p.mlp.mutate(0.15);
      }
    });
    bestFitness = sorted[0].fitness;
  }

  // draw overlay
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = 'rgba(100,180,255,0.4)';
  ctx.lineWidth = 1;
  portals.forEach(p => {
    ctx.beginPath();
    ctx.moveTo(pointer.x, pointer.y);
    const cx = p.x + 70, cy = p.y + 45;
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.fillStyle = `hsla(${p.hue},70%,60%,0.3)`;
    ctx.beginPath();
    ctx.arc(cx, cy, 8 + p.fitness, 0, Math.PI*2);
    ctx.fill();
  });

  statusEl.textContent = `Frame ${frame} | Best fitness ${bestFitness.toFixed(1)} | Portals morphing`;
  requestAnimationFrame(update);
}
update();

addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
});

document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') addEventListener('deviceorientation', e => {
        orient.beta = e.beta || 0; orient.gamma = e.gamma || 0;
      });
    });
  } else {
    addEventListener('deviceorientation', e => {
      orient.beta = e.beta || 0; orient.gamma = e.gamma || 0;
    });
  }
  statusEl.textContent = 'Orientation listener active (tilt device)';
};

document.getElementById('seal').onclick = async () => {
  const data = {
    ts: Date.now(),
    genomes: portals.map(p => ({
      w1: p.mlp.w1, b1: p.mlp.b1, w2: p.mlp.w2, b2: p.mlp.b2,
      x: p.x, y: p.y, fitness: p.fitness
    }))
  };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f783', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put(data, 'latest');
    statusEl.textContent = 'Genome sealed to IndexedDB';
  } catch(e) { statusEl.textContent = 'Seal failed: ' + e.message; }
};

document.getElementById('reset').onclick = () => {
  portals.forEach((p,i) => {
    p.mlp = new MLP();
    p.x = rand(50, innerWidth-200);
    p.y = rand(80, innerHeight-150);
    p.fitness = 0; p.scale = 1; p.hue = 200;
    p.el.style.left = p.x+'px'; p.el.style.top = p.y+'px';
  });
  statusEl.textContent = 'Reset to random policies';
};
