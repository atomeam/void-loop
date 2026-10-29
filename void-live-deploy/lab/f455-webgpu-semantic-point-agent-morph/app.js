const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const points = []; // {x,y, label, hash}
const cards = new Map();
let agent = { x: W/2, y: H/2, vx:0, vy:0, genes: [0.8, 0.3, 0.1] }; // attract, damp, noise
let curiosity = 0.5;

function hash(str) {
  let h = 0;
  for (let i=0; i<str.length; i++) h = (h*31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function deposit(word) {
  if (!word.trim()) return;
  const h = hash(word);
  const x = (h % 1000)/1000 * (W-100) + 50;
  const y = ((h >> 10) % 1000)/1000 * (H-100) + 50;
  points.push({x, y, label: word, hash: h, size: 4});
  if (!cards.has(word)) {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = word;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    cards.set(word, el);
  }
}

document.getElementById('word').addEventListener('keydown', e => {
  if (e.key === 'Enter') { deposit(e.target.value); e.target.value = ''; }
});

function step() {
  // Agent physics: attract to nearest points, evolve slightly
  let ax=0, ay=0, nearest=Infinity;
  for (const p of points) {
    const dx = p.x - agent.x, dy = p.y - agent.y;
    const d = Math.hypot(dx,dy) || 1;
    if (d < nearest) nearest = d;
    const f = agent.genes[0] / (d*d) * 800;
    ax += dx/d * f; ay += dy/d * f;
  }
  agent.vx = agent.vx * agent.genes[1] + ax * 0.01 + (Math.random()-0.5)*agent.genes[2];
  agent.vy = agent.vy * agent.genes[1] + ay * 0.01 + (Math.random()-0.5)*agent.genes[2];
  agent.x = Math.max(20, Math.min(W-20, agent.x + agent.vx));
  agent.y = Math.max(20, Math.min(H-20, agent.y + agent.vy));
  curiosity = 0.7*curiosity + 0.3*Math.min(1, Math.hypot(agent.vx, agent.vy)/5);

  // Morph chrome
  document.body.style.filter = `hue-rotate(${curiosity*120}deg) contrast(${1+curiosity*0.4})`;
  document.getElementById('status').textContent = `Curiosity ${curiosity.toFixed(2)} | Points ${points.length} | Agent @ (${agent.x|0},${agent.y|0})`;

  // Update cards by proximity
  cards.forEach((el, label) => {
    const p = points.find(pt => pt.label === label);
    if (!p) return;
    const d = Math.hypot(p.x - agent.x, p.y - agent.y);
    const scale = Math.max(0.6, 1.8 - d/200);
    const op = Math.max(0.3, 1 - d/400);
    el.style.transform = `translate(-50%,-50%) scale(${scale})`;
    el.style.opacity = op;
    el.style.borderColor = d < 80 ? '#8cf' : '#668';
  });

  // Render
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#4af';
  for (const p of points) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#f84';
  ctx.beginPath(); ctx.arc(agent.x, agent.y, 6, 0, 7); ctx.fill();
  ctx.strokeStyle = '#f84'; ctx.beginPath(); ctx.moveTo(agent.x, agent.y); ctx.lineTo(agent.x+agent.vx*8, agent.y+agent.vy*8); ctx.stroke();

  requestAnimationFrame(step);
}
step();

document.getElementById('seal').onclick = () => {
  const data = { points: points.map(p=>({x:p.x,y:p.y,label:p.label})), genes: agent.genes, curiosity };
  localStorage.setItem('f455-seal', JSON.stringify(data));
  document.getElementById('status').textContent = 'Sealed to localStorage';
};
document.getElementById('load').onclick = () => {
  const raw = localStorage.getItem('f455-seal');
  if (!raw) return;
  const data = JSON.parse(raw);
  points.length = 0; cards.forEach(el => el.remove()); cards.clear();
  data.points.forEach(p => deposit(p.label));
  agent.genes = data.genes || agent.genes;
  document.getElementById('status').textContent = 'Loaded seal';
};

// WebGPU note: in production, replace canvas clear/draw with compute + render pipeline for dense points
console.log('F455 Semantic Point Agent — WebGPU path noted for dense clustering');
