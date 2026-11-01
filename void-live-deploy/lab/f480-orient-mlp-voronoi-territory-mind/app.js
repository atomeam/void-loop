const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = 80, H = 50;
let ownership = new Int16Array(W * H);
let influence = new Float32Array(W * H);

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

class TinyMLP {
  constructor() {
    this.w1 = Array.from({length:4}, () => Array.from({length:3}, () => Math.random()*0.4-0.2));
    this.b1 = Array.from({length:4}, () => Math.random()*0.2-0.1);
    this.w2 = Array.from({length:2}, () => Array.from({length:4}, () => Math.random()*0.4-0.2));
    this.b2 = Array.from({length:2}, () => Math.random()*0.2-0.1);
  }
  forward(x) {
    const h = this.w1.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w * x[j], this.b1[i])));
    return this.w2.map((row, i) => row.reduce((s, w, j) => s + w * h[j], this.b2[i]));
  }
  clone() {
    const m = new TinyMLP();
    m.w1 = this.w1.map(r => [...r]); m.b1 = [...this.b1];
    m.w2 = this.w2.map(r => [...r]); m.b2 = [...this.b2];
    return m;
  }
  mutate(rate=0.15) {
    const m = this.clone();
    const noise = () => (Math.random()-0.5)*rate;
    m.w1.forEach(r => r.forEach((_,j)=> r[j] += noise()));
    m.b1.forEach((_,i)=> m.b1[i] += noise());
    m.w2.forEach(r => r.forEach((_,j)=> r[j] += noise()));
    m.b2.forEach((_,i)=> m.b2[i] += noise());
    return m;
  }
  serialize() {
    return { w1: this.w1, b1: this.b1, w2: this.w2, b2: this.b2 };
  }
  static deserialize(o) {
    const m = new TinyMLP();
    m.w1 = o.w1; m.b1 = o.b1; m.w2 = o.w2; m.b2 = o.b2;
    return m;
  }
}

const agents = [];
let nextId = 0;
function addAgent(x=0.5, y=0.5) {
  const a = {
    id: nextId++,
    x, y,
    vx: 0, vy: 0,
    mlp: new TinyMLP(),
    fitness: 0,
    color: `hsl(${nextId*47 % 360}, 70%, 55%)`,
    label: document.createElement('div')
  };
  a.label.className = 'agent-label';
  a.label.textContent = 'A' + a.id;
  document.body.appendChild(a.label);
  agents.push(a);
  return a;
}
for(let i=0;i<4;i++) addAgent(0.2 + Math.random()*0.6, 0.2 + Math.random()*0.6);

let orient = { beta: 0, gamma: 0, alpha: 0 };
let permGranted = false;

function onOrient(e) {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
  orient.alpha = e.alpha || 0;
  const t = Math.min(1, Math.hypot(orient.beta, orient.gamma)/45);
  document.documentElement.style.setProperty('--tilt', t);
  document.getElementById('tiltv').textContent = t.toFixed(2);
}
document.getElementById('perm').onclick = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p === 'granted') {
        addEventListener('deviceorientation', onOrient);
        permGranted = true;
        document.getElementById('perm').textContent = 'Tilt On';
      }
    } catch(err) {}
  } else if (typeof DeviceOrientationEvent !== 'undefined') {
    addEventListener('deviceorientation', onOrient);
    permGranted = true;
    document.getElementById('perm').textContent = 'Tilt On';
  }
};
canvas.addEventListener('pointermove', e => {
  if (!permGranted) {
    orient.gamma = (e.clientX / innerWidth - 0.5) * 40;
    orient.beta = (e.clientY / innerHeight - 0.5) * 40;
    const t = Math.min(1, Math.hypot(orient.beta, orient.gamma)/45);
    document.documentElement.style.setProperty('--tilt', t);
    document.getElementById('tiltv').textContent = t.toFixed(2);
  }
});

document.getElementById('add').onclick = () => addAgent(Math.random(), Math.random());

function updateTerritory() {
  ownership.fill(-1);
  influence.fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let best = -1, bestInf = -1;
      const px = (x + 0.5) / W, py = (y + 0.5) / H;
      agents.forEach(a => {
        const dx = px - a.x, dy = py - a.y;
        const d2 = dx*dx + dy*dy + 0.0001;
        const inf = 1 / d2;
        if (inf > bestInf) { bestInf = inf; best = a.id; }
      });
      const idx = y * W + x;
      ownership[idx] = best;
      influence[idx] = Math.min(1, bestInf * 0.02);
    }
  }
  const counts = {};
  agents.forEach(a => counts[a.id] = 0);
  for (let i = 0; i < ownership.length; i++) if (ownership[i] >= 0) counts[ownership[i]]++;
  agents.forEach(a => a.fitness = (counts[a.id] || 0) / (W*H));
}

function stepAgents() {
  const inputs = [
    Math.tanh(orient.beta / 30),
    Math.tanh(orient.gamma / 30),
    Math.tanh((orient.alpha % 360 - 180) / 180)
  ];
  agents.forEach(a => {
    const out = a.mlp.forward(inputs);
    a.vx += out[0] * 0.004 + (orient.gamma / 90) * 0.001;
    a.vy += out[1] * 0.004 + (orient.beta / 90) * 0.001;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x = Math.max(0.05, Math.min(0.95, a.x + a.vx));
    a.y = Math.max(0.05, Math.min(0.95, a.y + a.vy));
    agents.forEach(b => {
      if (b === a) return;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 0.008) {
        const f = 0.0008 / (d2 + 0.001);
        a.vx += dx * f; a.vy += dy * f;
      }
    });
  });
}

function maybeTransfer() {
  if (agents.length < 2) return;
  agents.sort((a,b) => b.fitness - a.fitness);
  const leader = agents[0], weak = agents[agents.length-1];
  if (leader.fitness - weak.fitness > 0.18 && Math.random() < 0.04) {
    weak.mlp = leader.mlp.mutate(0.22);
    weak.color = leader.color;
    document.getElementById('leadv').textContent = 'A' + leader.id + ' → A' + weak.id;
    setTimeout(() => document.getElementById('leadv').textContent = 'A' + leader.id, 800);
  } else {
    document.getElementById('leadv').textContent = agents[0] ? 'A' + agents[0].id : '—';
  }
}

function draw() {
  ctx.fillStyle = '#0c0c14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cw = canvas.width / W, ch = canvas.height / H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const id = ownership[y*W + x];
      if (id >= 0) {
        const a = agents.find(ag => ag.id === id);
        if (a) {
          const inf = influence[y*W + x];
          ctx.fillStyle = a.color.replace(')', `, ${0.15 + inf*0.45})`).replace('hsl', 'hsla');
          ctx.fillRect(x*cw, y*ch, cw+1, ch+1);
        }
      }
    }
  }
  agents.forEach(a => {
    ctx.beginPath();
    ctx.arc(a.x * canvas.width, a.y * canvas.height, 8 + a.fitness * 14, 0, Math.PI*2);
    ctx.fillStyle = a.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    a.label.style.left = (a.x * canvas.width - 10) + 'px';
    a.label.style.top = (a.y * canvas.height - 28) + 'px';
  });
  updateTerritory();
  stepAgents();
  maybeTransfer();
  requestAnimationFrame(draw);
}
draw();

let dragging = null;
canvas.addEventListener('pointerdown', e => {
  const mx = e.clientX / canvas.width, my = e.clientY / canvas.height;
  dragging = agents.find(a => Math.hypot(a.x - mx, a.y - my) < 0.06);
  if (!dragging) addAgent(mx, my);
});
canvas.addEventListener('pointermove', e => {
  if (dragging) {
    dragging.x = Math.max(0.05, Math.min(0.95, e.clientX / canvas.width));
    dragging.y = Math.max(0.05, Math.min(0.95, e.clientY / canvas.height));
  }
});
canvas.addEventListener('pointerup', () => dragging = null);

const DB = 'f480-voronoi-territory';
function seal() {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', { keyPath: 'id' });
  req.onsuccess = e => {
    const tx = e.target.result.transaction('genomes', 'readwrite');
    const store = tx.objectStore('genomes');
    agents.forEach(a => store.put({ id: a.id, genome: a.mlp.serialize(), fitness: a.fitness, x: a.x, y: a.y }));
    store.put({ id: -1, nextId, agents: agents.map(a => a.id) }, -1);
  };
}
function restore() {
  const req = indexedDB.open(DB, 1);
  req.onsuccess = e => {
    const tx = e.target.result.transaction('genomes', 'readonly');
    const store = tx.objectStore('genomes');
    const g = store.getAll();
    g.onsuccess = () => {
      const rows = g.result || [];
      const meta = rows.find(r => r.id === -1);
      if (!meta) return;
      agents.forEach(a => a.label.remove());
      agents.length = 0;
      nextId = meta.nextId || 0;
      rows.filter(r => r.id >= 0).forEach(r => {
        const a = addAgent(r.x || 0.5, r.y || 0.5);
        a.id = r.id;
        a.mlp = TinyMLP.deserialize(r.genome);
        a.fitness = r.fitness || 0;
      });
    };
  };
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') seal();
  if (e.key === 'r' || e.key === 'R') restore();
});

setInterval(() => {
  if (!permGranted && Math.random() < 0.3) {
    orient.beta += (Math.random()-0.5)*2;
    orient.gamma += (Math.random()-0.5)*2;
    orient.beta = Math.max(-40, Math.min(40, orient.beta));
    orient.gamma = Math.max(-40, Math.min(40, orient.gamma));
  }
}, 300);
