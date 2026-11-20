const N = 6;
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const cards = [];
let genomes = [];
let motion = { ax: 0, ay: 0, az: 0, vx: 0, vy: 0 };
let lastPointer = { x: 0, y: 0, t: 0 };

class MLP {
  constructor(w) {
    this.w1 = w?.w1 || Array.from({length: 8*7}, () => Math.random()*0.4-0.2);
    this.b1 = w?.b1 || Array.from({length: 8}, () => Math.random()*0.2-0.1);
    this.w2 = w?.w2 || Array.from({length: 5*8}, () => Math.random()*0.4-0.2);
    this.b2 = w?.b2 || Array.from({length: 5}, () => Math.random()*0.2-0.1);
  }
  forward(x) {
    const h = new Array(8);
    for (let i = 0; i < 8; i++) {
      let s = this.b1[i];
      for (let j = 0; j < 7; j++) s += this.w1[i*7+j] * x[j];
      h[i] = Math.tanh(s);
    }
    const o = new Array(5);
    for (let i = 0; i < 5; i++) {
      let s = this.b2[i];
      for (let j = 0; j < 8; j++) s += this.w2[i*8+j] * h[j];
      o[i] = Math.tanh(s);
    }
    return o;
  }
  clone() { return new MLP({ w1: [...this.w1], b1: [...this.b1], w2: [...this.w2], b2: [...this.b2] }); }
  mutate(rate = 0.08) {
    const m = (a) => a.map(v => v + (Math.random()-0.5)*rate);
    this.w1 = m(this.w1); this.b1 = m(this.b1); this.w2 = m(this.w2); this.b2 = m(this.b2);
  }
  crossover(other, frac = 0.3) {
    const mix = (a, b) => a.map((v, i) => Math.random() < frac ? b[i] : v);
    this.w1 = mix(this.w1, other.w1); this.b1 = mix(this.b1, other.b1);
    this.w2 = mix(this.w2, other.w2); this.b2 = mix(this.b2, other.b2);
  }
}

function createCard(i) {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<div class="id">Card ${i}</div><div class="fit">0</div>`;
  el.style.left = (20 + Math.random()*60) + '%';
  el.style.top = (20 + Math.random()*50) + '%';
  stage.appendChild(el);
  const mlp = new MLP();
  return { el, mlp, x: 40+Math.random()*20, y: 30+Math.random()*20, z: 0, rx: 0, ry: 0, fit: 0, id: i };
}

for (let i = 0; i < N; i++) cards.push(createCard(i));

function inputsFor(c) {
  return [
    motion.ax * 0.05, motion.ay * 0.05, motion.az * 0.05,
    motion.vx * 0.01, motion.vy * 0.01,
    c.fit * 0.1, (Math.random()-0.5)*0.3
  ];
}

function update() {
  cards.forEach(c => {
    const o = c.mlp.forward(inputsFor(c));
    c.x += o[0] * 0.8;
    c.y += o[1] * 0.8;
    c.z += o[2] * 4;
    c.rx += o[3] * 2;
    c.ry += o[4] * 2;
    c.x = Math.max(5, Math.min(85, c.x));
    c.y = Math.max(5, Math.min(75, c.y));
    c.z = Math.max(-100, Math.min(100, c.z));
    const sc = 1 + o[4] * 0.15;
    c.el.style.transform = `translate3d(${c.x}vw, ${c.y}vh, ${c.z}px) rotateX(${c.rx}deg) rotateY(${c.ry}deg) scale(${sc})`;
    c.el.querySelector('.fit').textContent = c.fit.toFixed(1);
  });

  // overlap sealed transfer
  for (let i = 0; i < N; i++) {
    const a = cards[i];
    const ra = a.el.getBoundingClientRect();
    for (let j = i+1; j < N; j++) {
      const b = cards[j];
      const rb = b.el.getBoundingClientRect();
      if (ra.left < rb.right && ra.right > rb.left && ra.top < rb.bottom && ra.bottom > rb.top) {
        if (a.fit > b.fit) { a.mlp.crossover(b.mlp); a.mlp.mutate(0.04); a.fit += 0.2; }
        else if (b.fit > a.fit) { b.mlp.crossover(a.mlp); b.mlp.mutate(0.04); b.fit += 0.2; }
      }
    }
  }
  requestAnimationFrame(update);
}
requestAnimationFrame(update);

// DeviceMotion
window.addEventListener('devicemotion', e => {
  if (e.accelerationIncludingGravity) {
    motion.ax = e.accelerationIncludingGravity.x || 0;
    motion.ay = e.accelerationIncludingGravity.y || 0;
    motion.az = e.accelerationIncludingGravity.z || 0;
  }
});

// Pointer fallback
window.addEventListener('pointermove', e => {
  const t = performance.now();
  if (lastPointer.t) {
    motion.vx = (e.clientX - lastPointer.x) / (t - lastPointer.t + 1) * 20;
    motion.vy = (e.clientY - lastPointer.y) / (t - lastPointer.t + 1) * 20;
  }
  lastPointer = { x: e.clientX, y: e.clientY, t };
});

// Click reward
stage.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (!card) return;
  const c = cards.find(x => x.el === card);
  if (c) {
    c.fit += 1;
    c.mlp.mutate(0.1);
    c.el.style.boxShadow = '0 0 30px #ff6b6b';
    setTimeout(() => c.el.style.boxShadow = '', 300);
  }
});

// Persistence
const DB = 'verse-f854-css3d';
const CH = new BroadcastChannel('f854-genome');
async function seal() {
  const best = cards.reduce((a, b) => a.fit > b.fit ? a : b);
  const data = { w1: best.mlp.w1, b1: best.mlp.b1, w2: best.mlp.w2, b2: best.mlp.b2, fit: best.fit };
  try {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => {
      const tx = req.result.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put(data, 'best');
    };
  } catch (e) { console.debug("lab f854-devicemotion-mlp-css3d-living-cards:", e); }
  CH.postMessage(data);
  statusEl.textContent = 'sealed fit=' + best.fit.toFixed(1);
}
document.getElementById('seal').onclick = seal;

CH.onmessage = e => {
  const data = e.data;
  if (!data?.w1) return;
  const worst = cards.reduce((a, b) => a.fit < b.fit ? a : b);
  worst.mlp = new MLP(data);
  worst.fit = data.fit * 0.5;
  statusEl.textContent = 'received genome';
};

// Load on start
(async () => {
  try {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => {
      const tx = req.result.transaction('genomes', 'readonly');
      const get = tx.objectStore('genomes').get('best');
      get.onsuccess = () => {
        if (get.result) {
          cards[0].mlp = new MLP(get.result);
          cards[0].fit = get.result.fit || 0;
          statusEl.textContent = 'loaded prior';
        }
      };
    };
  } catch (e) { console.debug("lab f854-devicemotion-mlp-css3d-living-cards:", e); }
})();
