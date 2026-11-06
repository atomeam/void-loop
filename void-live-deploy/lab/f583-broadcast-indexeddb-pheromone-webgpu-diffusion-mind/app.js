const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; initField(); });

const SIZE = 128;
let field = new Float32Array(SIZE * SIZE);
let next = new Float32Array(SIZE * SIZE);
let agents = [];
let genomes = [];
let pointer = {x: 0, y: 0, down: false};
let motionBoost = 0;

function idx(x, y) { return (y & (SIZE-1)) * SIZE + (x & (SIZE-1)); }

function initField() {
  field.fill(0);
  for (let i = 0; i < 20; i++) field[Math.floor(Math.random()*SIZE*SIZE)] = Math.random() * 0.5;
}

function diffuse() {
  const decay = 0.98;
  const diff = 0.15;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = idx(x, y);
      const n = field[idx(x, y-1)] + field[idx(x, y+1)] + field[idx(x-1, y)] + field[idx(x+1, y)];
      next[i] = (field[i] * (1 - diff) + n * (diff / 4)) * decay;
    }
  }
  [field, next] = [next, field];
}

let gpuDevice = null;
async function tryWebGPU() {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    gpuDevice = await adapter.requestDevice();
    console.log('WebGPU available for future kernel');
  } catch(e) {}
}
tryWebGPU();

class Agent {
  constructor(genome) {
    this.genome = genome || { strength: 0.3 + Math.random()*0.7, decayBias: 0.9 + Math.random()*0.1, mobility: 0.5 + Math.random()*0.5 };
    this.x = Math.random() * SIZE;
    this.y = Math.random() * SIZE;
    this.vx = (Math.random()-0.5)*2;
    this.vy = (Math.random()-0.5)*2;
  }
  step() {
    this.x += this.vx * this.genome.mobility;
    this.y += this.vy * this.genome.mobility;
    this.x = (this.x + SIZE) % SIZE;
    this.y = (this.y + SIZE) % SIZE;
    const px = (pointer.x / W) * SIZE;
    const py = (pointer.y / H) * SIZE;
    const dx = px - this.x, dy = py - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.vx += (dx / dist) * 0.05 * (pointer.down ? 2 : 0.5);
    this.vy += (dy / dist) * 0.05 * (pointer.down ? 2 : 0.5);
    this.vx *= 0.95; this.vy *= 0.95;
    const i = idx(Math.floor(this.x), Math.floor(this.y));
    field[i] = Math.min(1, field[i] + this.genome.strength * 0.02 * (1 + motionBoost));
  }
}

function spawnAgent() {
  agents.push(new Agent());
  updateInfo();
}

function evolve() {
  if (agents.length < 2) return;
  agents.sort((a,b) => b.genome.strength - a.genome.strength);
  agents = agents.slice(0, Math.ceil(agents.length * 0.6));
  for (let i = 0; i < 3; i++) {
    const parent = agents[Math.floor(Math.random()*agents.length)];
    const g = {...parent.genome};
    g.strength = Math.max(0.1, Math.min(1, g.strength + (Math.random()-0.5)*0.2));
    agents.push(new Agent(g));
  }
  updateInfo();
}

function sealGenome() {
  if (!agents.length) return;
  const g = agents[0].genome;
  const sealed = { genome: g, ts: Date.now(), hash: simpleHash(JSON.stringify(g)) };
  genomes.push(sealed);
  saveIDB();
  broadcast({type: 'genome', data: sealed});
  alert('Genome sealed & shared: ' + sealed.hash.slice(0,8));
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}

const channel = new BroadcastChannel('verse-pheromone-f583');
channel.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === 'deposit') {
    const i = idx(msg.x, msg.y);
    field[i] = Math.min(1, field[i] + msg.amt);
  } else if (msg.type === 'genome') {
    console.log('Received sealed genome', msg.data.hash);
  }
};

function broadcast(msg) { channel.postMessage(msg); }

function depositAt(px, py, amt = 0.1) {
  const x = Math.floor((px / W) * SIZE);
  const y = Math.floor((py / H) * SIZE);
  field[idx(x, y)] = Math.min(1, field[idx(x, y)] + amt);
  broadcast({type: 'deposit', x, y, amt});
}

canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; if (pointer.down) depositAt(e.clientX, e.clientY, 0.05); });
canvas.addEventListener('pointerdown', e => { pointer.down = true; depositAt(e.clientX, e.clientY, 0.2); });
canvas.addEventListener('pointerup', () => pointer.down = false);

window.addEventListener('devicemotion', e => {
  if (e.acceleration) motionBoost = Math.min(1, Math.hypot(e.acceleration.x||0, e.acceleration.y||0, e.acceleration.z||0) / 20);
});

document.getElementById('spawn').onclick = spawnAgent;
document.getElementById('evolve').onclick = evolve;
document.getElementById('seal').onclick = sealGenome;
document.getElementById('reset').onclick = () => { initField(); agents = []; updateInfo(); };

let db;
function openDB() {
  const req = indexedDB.open('verse-pheromone-f583', 1);
  req.onupgradeneeded = e => {
    const d = e.target.result;
    if (!d.objectStoreNames.contains('genomes')) d.createObjectStore('genomes', {keyPath: 'hash'});
    if (!d.objectStoreNames.contains('field')) d.createObjectStore('field');
  };
  req.onsuccess = e => { db = e.target.result; loadIDB(); };
}
function saveIDB() {
  if (!db) return;
  const tx = db.transaction(['genomes'], 'readwrite');
  const store = tx.objectStore('genomes');
  genomes.slice(-10).forEach(g => store.put(g));
}
function loadIDB() {
  if (!db) return;
  const tx = db.transaction(['genomes'], 'readonly');
  const store = tx.objectStore('genomes');
  const req = store.getAll();
  req.onsuccess = () => {
    genomes = req.result || [];
    if (genomes.length) {
      agents.push(new Agent(genomes[genomes.length-1].genome));
    }
    updateInfo();
  };
}
openDB();

const cardsEl = document.getElementById('cards');
const cards = [];
for (let i = 0; i < 8; i++) {
  const c = document.createElement('div');
  c.className = 'card';
  c.textContent = 'V' + i;
  cardsEl.appendChild(c);
  cards.push(c);
}

function updateCards() {
  for (let i = 0; i < cards.length; i++) {
    const sx = Math.floor((i % 4) * SIZE / 4);
    const sy = Math.floor(Math.floor(i / 4) * SIZE / 2);
    let sum = 0;
    for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 8; dx++) sum += field[idx(sx+dx, sy+dy)];
    const intensity = sum / 64;
    const card = cards[i];
    card.style.background = `hsl(${200 + intensity * 160}, 70%, ${20 + intensity * 40}%)`;
    card.style.transform = `scale(${0.8 + intensity * 0.6})`;
    card.style.opacity = 0.4 + intensity * 0.6;
  }
}

function updateInfo() {
  document.getElementById('info').textContent = `Agents: ${agents.length} | Genomes: ${genomes.length} | Boost: ${motionBoost.toFixed(2)}`;
}

function render() {
  const imageData = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE*SIZE; i++) {
    const v = Math.min(1, field[i]);
    const j = i * 4;
    imageData.data[j] = v * 100;
    imageData.data[j+1] = v * 200;
    imageData.data[j+2] = v * 255;
    imageData.data[j+3] = 255;
  }
  const tmp = document.createElement('canvas');
  tmp.width = SIZE; tmp.height = SIZE;
  tmp.getContext('2d').putImageData(imageData, 0, 0);
  ctx.drawImage(tmp, 0, 0, W, H);
  ctx.fillStyle = '#fff';
  agents.forEach(a => {
    ctx.beginPath();
    ctx.arc((a.x / SIZE) * W, (a.y / SIZE) * H, 3, 0, Math.PI*2);
    ctx.fill();
  });
}

function loop() {
  diffuse();
  agents.forEach(a => a.step());
  if (pointer.down) depositAt(pointer.x, pointer.y, 0.02);
  updateCards();
  render();
  requestAnimationFrame(loop);
}

initField();
spawnAgent(); spawnAgent();
loop();
