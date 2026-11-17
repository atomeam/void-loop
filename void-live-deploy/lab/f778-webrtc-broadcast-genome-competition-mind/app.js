const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 12;
const agents = [];
const claim = new Float32Array(W * H / 16 | 0); // coarse
let bestFit = 0;
let orient = { beta: 0, gamma: 0 };
let ptr = { x: W/2, y: H/2, vx: 0, vy: 0 };

class MLP {
  constructor(w) {
    this.w1 = w ? w.w1 : Array.from({length:5*8}, () => (Math.random()-0.5)*0.5);
    this.b1 = w ? w.b1 : Array.from({length:8}, () => 0);
    this.w2 = w ? w.w2 : Array.from({length:8*3}, () => (Math.random()-0.5)*0.5);
    this.b2 = w ? w.b2 : Array.from({length:3}, () => 0);
  }
  forward(x) {
    const h = new Array(8).fill(0);
    for (let i=0;i<8;i++) {
      let s = this.b1[i];
      for (let j=0;j<5;j++) s += x[j] * this.w1[j*8 + i];
      h[i] = Math.tanh(s);
    }
    const y = new Array(3).fill(0);
    for (let i=0;i<3;i++) {
      let s = this.b2[i];
      for (let j=0;j<8;j++) s += h[j] * this.w2[j*3 + i];
      y[i] = Math.tanh(s);
    }
    return y;
  }
  export() { return { w1:this.w1.slice(), b1:this.b1.slice(), w2:this.w2.slice(), b2:this.b2.slice() }; }
  mutate(rate=0.05) {
    const m = (a) => a.map(v => v + (Math.random()-0.5)*rate);
    this.w1 = m(this.w1); this.b1 = m(this.b1); this.w2 = m(this.w2); this.b2 = m(this.b2);
  }
}

for (let i=0;i<N;i++) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.style.setProperty('--h', i*30);
  el.textContent = i;
  document.body.appendChild(el);
  agents.push({
    x: Math.random()*W, y: Math.random()*H,
    vx: 0, vy: 0, fit: 0, mlp: new MLP(), el
  });
}

const bc = new BroadcastChannel('verse-f778-genome');
bc.onmessage = (e) => {
  const { genome, fitness, id } = e.data;
  if (fitness > bestFit) {
    bestFit = fitness;
    agents.forEach(a => { a.mlp = new MLP(genome); a.mlp.mutate(0.02); });
    document.getElementById('fit').textContent = bestFit.toFixed(1);
  }
};

async function persist(genome, fit) {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f778', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({ genome, fit, t: Date.now() }, 'best');
  } catch (e) { console.debug("lab f778-webrtc-broadcast-genome-competition-mind:", e); }
}

function loadPersisted() {
  indexedDB.open('verse-f778',1).onsuccess = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('genomes')) return;
    const tx = db.transaction('genomes');
    tx.objectStore('genomes').get('best').onsuccess = (ev) => {
      if (ev.target.result) {
        const { genome, fit } = ev.target.result;
        bestFit = fit || 0;
        agents.forEach(a => a.mlp = new MLP(genome));
        document.getElementById('fit').textContent = bestFit.toFixed(1);
      }
    };
  };
}
loadPersisted();

function getLocalDensity(x,y) {
  const ix = Math.floor(x / 4) % (W/4|0);
  const iy = Math.floor(y / 4) % (H/4|0);
  const idx = iy*(W/4|0) + ix;
  return claim[idx] || 0;
}

function step() {
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(80,120,255,0.08)';
  for (let i=0;i<claim.length;i++) if (claim[i]>0.1) {
    const x = (i % (W/4|0))*4, y = Math.floor(i/(W/4|0))*4;
    ctx.fillRect(x,y,4,4);
  }

  agents.forEach(a => {
    const dens = getLocalDensity(a.x, a.y);
    const inp = [orient.beta/90, orient.gamma/90, ptr.vx/20, ptr.vy/20, dens];
    const out = a.mlp.forward(inp);
    a.vx += out[0]*0.8; a.vy += out[1]*0.8;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x = (a.x + a.vx + W) % W;
    a.y = (a.y + a.vy + H) % H;
    const claimAmt = Math.max(0, out[2]);
    const ix = Math.floor(a.x / 4) % (W/4|0);
    const iy = Math.floor(a.y / 4) % (H/4|0);
    const idx = iy*(W/4|0) + ix;
    claim[idx] = Math.min(1, (claim[idx]||0) + claimAmt*0.05);
    a.fit += claimAmt * 0.01 + (claim[idx]||0)*0.002;
    a.el.style.left = a.x-18 + 'px';
    a.el.style.top = a.y-18 + 'px';
    a.el.style.transform = `scale(${1+claimAmt*0.3})`;
  });

  requestAnimationFrame(step);
}
step();

document.getElementById('seal').onclick = () => {
  const best = agents.reduce((b,a) => a.fit > b.fit ? a : b, agents[0]);
  const g = best.mlp.export();
  bestFit = Math.max(bestFit, best.fit);
  bc.postMessage({ genome: g, fitness: best.fit, id: Math.random() });
  persist(g, best.fit);
  document.getElementById('fit').textContent = bestFit.toFixed(1);
};

document.getElementById('reset').onclick = () => {
  claim.fill(0);
  agents.forEach(a => { a.x = Math.random()*W; a.y = Math.random()*H; a.fit = 0; });
};

addEventListener('pointermove', e => {
  ptr.vx = e.clientX - ptr.x; ptr.vy = e.clientY - ptr.y;
  ptr.x = e.clientX; ptr.y = e.clientY;
});
addEventListener('pointerdown', e => {
  agents.forEach(a => {
    const d = Math.hypot(a.x-e.clientX, a.y-e.clientY);
    if (d < 40) a.fit += 5;
  });
});

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
}

// WebRTC stub for future peer expansion
window.f778RTC = { ready: false };
