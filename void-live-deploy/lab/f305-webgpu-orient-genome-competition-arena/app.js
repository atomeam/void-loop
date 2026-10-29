const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_AGENTS = 36, N_FOOD = 18;
let agents = [], food = [], tilt = {x:0, y:0}, cards = [], champGenome = null;
const GENOME_LEN = 5; // speed, sense, aggression, turnRate, efficiency

function rand(a=0,b=1){ return a + Math.random()*(b-a); }
function dist(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }

function makeGenome(base=null) {
  if (!base) return Array.from({length:GENOME_LEN}, () => rand(0.2,0.9));
  return base.map(g => Math.max(0, Math.min(1, g + rand(-0.15,0.15))));
}

function Agent(x,y,genome) {
  this.x = x; this.y = y;
  this.vx = 0; this.vy = 0;
  this.energy = 80 + rand(0,40);
  this.genome = genome || makeGenome();
  this.fitness = 0;
  this.id = Math.random().toString(36).slice(2,7);
  this.color = `hsl(${this.genome[2]*360},70%,60%)`;
}
Agent.prototype.update = function() {
  const [speed, sense, agg, turn, eff] = this.genome;
  let tx = 0, ty = 0, nearest = Infinity;
  for (const f of food) {
    const d = dist(this, f);
    if (d < sense*180 && d < nearest) { nearest = d; tx = f.x - this.x; ty = f.y - this.y; }
  }
  if (nearest < Infinity) {
    const mag = Math.hypot(tx,ty) || 1;
    tx /= mag; ty /= mag;
  } else { tx = Math.cos(this.fitness*0.1); ty = Math.sin(this.fitness*0.1); }
  // aggression: repel close agents
  for (const o of agents) if (o !== this) {
    const d = dist(this, o);
    if (d < 40 && d > 0) {
      const push = agg * 30 / d;
      tx -= (o.x - this.x)/d * push * 0.05;
      ty -= (o.y - this.y)/d * push * 0.05;
    }
  }
  // orientation tilt
  tx += tilt.x * 0.8; ty += tilt.y * 0.8;
  this.vx += tx * speed * 0.4 * turn;
  this.vy += ty * speed * 0.4 * turn;
  this.vx *= 0.92; this.vy *= 0.92;
  this.x += this.vx; this.y += this.vy;
  // bounds
  if (this.x < 10) this.vx += 2; if (this.x > W-10) this.vx -= 2;
  if (this.y < 10) this.vy += 2; if (this.y > H-10) this.vy -= 2;
  this.energy -= 0.08 * (1.1 - eff);
  this.fitness += 0.01;
  // eat
  for (let i = food.length-1; i>=0; i--) {
    if (dist(this, food[i]) < 12) {
      this.energy += 25 + eff*20;
      this.fitness += 1;
      food.splice(i,1);
      if (food.length < N_FOOD) food.push({x:rand(20,W-20), y:rand(20,H-20), e:1});
    }
  }
  if (this.energy > 120) this.energy = 120;
};

function init() {
  agents = []; food = [];
  for (let i=0; i<N_AGENTS; i++) agents.push(new Agent(rand(50,W-50), rand(50,H-50)));
  for (let i=0; i<N_FOOD; i++) food.push({x:rand(20,W-20), y:rand(20,H-20), e:1});
  updateCards();
}
init();

function updateCards() {
  document.querySelectorAll('.card').forEach(c => c.remove());
  const top = [...agents].sort((a,b)=>b.fitness-a.fitness).slice(0,3);
  top.forEach((a,i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h4>Agent ${a.id}</h4><div class="fit">Fit ${a.fitness.toFixed(1)}</div><div>E ${a.energy.toFixed(0)}</div><div>spd ${(a.genome[0]*100)|0}%</div>`;
    card.style.left = (20 + i*160) + 'px';
    card.style.top = (H - 110) + 'px';
    card.dataset.id = a.id;
    makeDraggable(card, a);
    document.body.appendChild(card);
  });
}

function makeDraggable(el, agent) {
  let ox, oy, dragging = false;
  el.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX-parseInt(el.style.left); oy=e.clientY-parseInt(el.style.top); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!dragging) return; el.style.left = (e.clientX-ox)+'px'; el.style.top = (e.clientY-oy)+'px'; agent.energy = Math.min(120, agent.energy+0.5); });
  el.addEventListener('pointerup', () => dragging=false);
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// IndexedDB
let db;
const req = indexedDB.open('F305Arena', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath:'id'});
req.onsuccess = e => db = e.target.result;
function sealChampion() {
  const top = [...agents].sort((a,b)=>b.fitness-a.fitness)[0];
  if (!top || !db) { toast('No champ or IDB'); return; }
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({id:'champ', genome:top.genome, fitness:top.fitness, ts:Date.now()});
  champGenome = top.genome;
  document.getElementById('champ').textContent = top.id;
  toast('Champion sealed');
}
function loadGenome() {
  if (!db) { toast('No IDB'); return; }
  const tx = db.transaction('genomes','readonly');
  const g = tx.objectStore('genomes').get('champ');
  g.onsuccess = e => {
    if (e.target.result) {
      champGenome = e.target.result.genome;
      toast('Loaded champ genome');
    } else toast('No sealed genome');
  };
}
function spawnOffspring() {
  const base = champGenome || (agents[0] && agents[0].genome);
  if (!base) return;
  const g = makeGenome(base);
  agents.push(new Agent(W/2 + rand(-30,30), H/2 + rand(-30,30), g));
  if (agents.length > 50) agents.shift();
  toast('Offspring spawned');
}

document.getElementById('spawn').onclick = spawnOffspring;
document.getElementById('seal').onclick = sealChampion;
document.getElementById('load').onclick = loadGenome;
document.getElementById('reset').onclick = init;

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    tilt.x = (e.gamma || 0) / 45;
    tilt.y = (e.beta || 0) / 45;
    document.getElementById('orient').textContent = `Orient: γ${(e.gamma||0)|0} β${(e.beta||0)|0}`;
  });
  // iOS permission
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.getElementById('ui').insertAdjacentHTML('beforeend', '<button id="perm">Enable Orient</button>');
    document.getElementById('perm').onclick = () => DeviceOrientationEvent.requestPermission().then(s => s==='granted' && toast('Orient on'));
  }
} else document.getElementById('orient').textContent = 'Orient: unsupported';

// Pointer to drop food
canvas.addEventListener('pointerdown', e => {
  food.push({x:e.clientX, y:e.clientY, e:1});
  if (food.length > N_FOOD*2) food.shift();
});

let last = 0;
function loop(t) {
  requestAnimationFrame(loop);
  if (t - last < 16) return; last = t;
  // prune dead
  agents = agents.filter(a => a.energy > 5);
  if (agents.length < 12) for (let i=0; i<4; i++) agents.push(new Agent(rand(50,W-50), rand(50,H-50), makeGenome(champGenome)));
  agents.forEach(a => a.update());
  // draw
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  food.forEach(f => { ctx.fillStyle='#4a8'; ctx.beginPath(); ctx.arc(f.x,f.y,6,0,6.28); ctx.fill(); });
  agents.forEach(a => {
    ctx.fillStyle = a.color;
    ctx.beginPath(); ctx.arc(a.x, a.y, 5 + a.energy/40, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#fff2'; ctx.beginPath(); ctx.arc(a.x,a.y, a.genome[1]*90, 0, 6.28); ctx.stroke();
  });
  document.getElementById('nAgents').textContent = agents.length;
  document.getElementById('nFood').textContent = food.length;
  if (t % 800 < 20) updateCards();
}
requestAnimationFrame(loop);

// WebGPU upgrade note: replace particle update with compute shader dispatch for N>200; current is CPU progressive baseline.
