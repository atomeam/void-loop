const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_MAX = 32;
let nAgents = 12;
const agents = [];
const portals = [];
let pointer = { x: W/2, y: H/2, vx: 0, vy: 0, hist: [] };
let residual = { x: 0, y: 0, mag: 0 };
let orient = { alpha: 0, beta: 0, gamma: 0 };
let hasOrient = false;

function rand(a,b){ return a + Math.random()*(b-a); }
function tanh(x){ return Math.tanh(x); }

class MLP {
  constructor() {
    this.w1 = Array.from({length: 6*8}, () => rand(-0.5,0.5)); // 6 in → 8 hid
    this.b1 = Array.from({length: 8}, () => rand(-0.2,0.2));
    this.w2 = Array.from({length: 8*2}, () => rand(-0.5,0.5)); // 8 → 2 out
    this.b2 = Array.from({length: 2}, () => 0);
    this.fitness = 0;
  }
  forward(inp) {
    const hid = [];
    for(let i=0;i<8;i++){
      let s = this.b1[i];
      for(let j=0;j<6;j++) s += inp[j] * this.w1[i*6+j];
      hid[i] = tanh(s);
    }
    const out = [];
    for(let i=0;i<2;i++){
      let s = this.b2[i];
      for(let j=0;j<8;j++) s += hid[j] * this.w2[i*8+j];
      out[i] = tanh(s) * 0.8;
    }
    return out;
  }
  mutate(rate=0.1) {
    const mut = arr => arr.map(v => v + rand(-rate,rate));
    this.w1 = mut(this.w1); this.b1 = mut(this.b1);
    this.w2 = mut(this.w2); this.b2 = mut(this.b2);
  }
  clone() {
    const m = new MLP();
    m.w1 = this.w1.slice(); m.b1 = this.b1.slice();
    m.w2 = this.w2.slice(); m.b2 = this.b2.slice();
    m.fitness = this.fitness;
    return m;
  }
}

function initAgents() {
  agents.length = 0;
  for(let i=0;i<nAgents;i++){
    agents.push({
      x: rand(80, W-80), y: rand(80, H-80),
      vx: 0, vy: 0,
      mlp: new MLP(),
      id: i
    });
  }
}

function initPortals() {
  document.querySelectorAll('.portal').forEach(el => el.remove());
  portals.length = 0;
  const titles = ['Thought','Memory','Causal','Residual','Anchor','Portal','Verse','Mind','Seal','Genome','Agent','Flow'];
  for(let i=0;i<Math.min(8, nAgents);i++){
    const el = document.createElement('div');
    el.className = 'portal';
    el.innerHTML = `<h3>${titles[i%titles.length]} ${i}</h3><p>agent ${i}</p>`;
    el.dataset.agent = i;
    document.body.appendChild(el);
    portals.push({ el, agent: i, offsetX: 0, offsetY: 0 });
    makeDraggable(el, i);
  }
}

function makeDraggable(el, portalIdx) {
  let dragging = false, sx, sy, ox, oy;
  el.addEventListener('pointerdown', e => {
    dragging = true; el.classList.add('dragging');
    sx = e.clientX; sy = e.clientY;
    const r = el.getBoundingClientRect();
    ox = r.left; oy = r.top;
    e.preventDefault();
  });
  addEventListener('pointermove', e => {
    if(!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    el.style.left = (ox + dx) + 'px';
    el.style.top = (oy + dy) + 'px';
    // reward / move agent
    const a = agents[portals[portalIdx].agent];
    if(a){ a.x = ox + dx + 70; a.y = oy + dy + 45; a.mlp.fitness += 0.05; }
  });
  addEventListener('pointerup', () => { if(dragging){ dragging=false; el.classList.remove('dragging'); } });
}

function updateResidual() {
  pointer.hist.push({vx: pointer.vx, vy: pointer.vy});
  if(pointer.hist.length > 6) pointer.hist.shift();
  // simple predictor: last velocity
  const last = pointer.hist[pointer.hist.length-2] || {vx:0,vy:0};
  residual.x = pointer.vx - last.vx * 0.85;
  residual.y = pointer.vy - last.vy * 0.85;
  residual.mag = Math.hypot(residual.x, residual.y);
}

function step() {
  updateResidual();
  const inp = [
    residual.x * 0.05, residual.y * 0.05, residual.mag * 0.02,
    orient.beta * 0.01, orient.gamma * 0.01, hasOrient ? 1 : 0
  ];
  for(const a of agents){
    const acc = a.mlp.forward(inp);
    a.vx += acc[0]; a.vy += acc[1];
    a.vx *= 0.92; a.vy *= 0.92;
    a.x += a.vx; a.y += a.vy;
    // soft bounds
    if(a.x < 40) a.vx += 0.4; if(a.x > W-40) a.vx -= 0.4;
    if(a.y < 40) a.vy += 0.4; if(a.y > H-40) a.vy -= 0.4;
  }
  // occasional evolutionary step
  if(Math.random() < 0.02){
    agents.sort((a,b)=>b.mlp.fitness - a.mlp.fitness);
    if(agents[0] && agents[agents.length-1]){
      agents[agents.length-1].mlp = agents[0].mlp.clone();
      agents[agents.length-1].mlp.mutate(0.15);
      agents[agents.length-1].mlp.fitness *= 0.5;
    }
  }
  // update portals
  for(const p of portals){
    const a = agents[p.agent];
    if(!a) continue;
    // try CSS anchor if supported, else absolute
    p.el.style.left = (a.x - 70) + 'px';
    p.el.style.top = (a.y - 45) + 'px';
    p.el.querySelector('p').textContent = `fit ${a.mlp.fitness.toFixed(1)} · res ${residual.mag.toFixed(1)}`;
    if(residual.mag > 2) p.el.style.borderColor = '#5ce1e6';
    else p.el.style.borderColor = '#2a3440';
  }
  // draw
  ctx.fillStyle = 'rgba(10,12,16,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = '#5ce1e640';
  ctx.beginPath();
  for(const a of agents){
    ctx.moveTo(a.x, a.y);
    ctx.arc(a.x, a.y, 4 + Math.min(8, a.mlp.fitness*0.2), 0, Math.PI*2);
  }
  ctx.stroke();
  // residual vector
  ctx.strokeStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.moveTo(pointer.x, pointer.y);
  ctx.lineTo(pointer.x + residual.x*8, pointer.y + residual.y*8);
  ctx.stroke();
  requestAnimationFrame(step);
}

addEventListener('pointermove', e => {
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  pointer.vx = dx; pointer.vy = dy;
  pointer.x = e.clientX; pointer.y = e.clientY;
});

document.getElementById('orient').onclick = () => {
  if(typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission){
    DeviceOrientationEvent.requestPermission().then(p => { if(p==='granted') startOrient(); });
  } else startOrient();
};
function startOrient(){
  hasOrient = true;
  addEventListener('deviceorientation', e => {
    orient.alpha = e.alpha||0; orient.beta = e.beta||0; orient.gamma = e.gamma||0;
  });
  document.getElementById('status').textContent = 'Orientation active · residual + tilt drive MLPs';
}

document.getElementById('nAgents').oninput = e => {
  nAgents = +e.target.value;
  initAgents(); initPortals();
};
document.getElementById('reset').onclick = () => { initAgents(); initPortals(); };
document.getElementById('seal').onclick = async () => {
  const data = {
    n: nAgents,
    agents: agents.map(a => ({x:a.x,y:a.y, fitness:a.mlp.fitness, w1:a.mlp.w1, w2:a.mlp.w2})),
    ts: Date.now()
  };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f685', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal','readwrite');
    tx.objectStore('seal').put(data, 'latest');
    await new Promise(r => tx.oncomplete = r);
    document.getElementById('status').textContent = 'Sealed to IndexedDB · reload restores';
  } catch(err) {
    document.getElementById('status').textContent = 'Seal failed (private?) · session only';
  }
};

// restore
(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f685', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal');
    const req = tx.objectStore('seal').get('latest');
    req.onsuccess = () => {
      if(req.result){
        // simple restore of positions & fitness; weights optional
        const d = req.result;
        nAgents = d.n || 12;
        initAgents();
        d.agents.forEach((s,i) => {
          if(agents[i]){
            agents[i].x = s.x; agents[i].y = s.y;
            agents[i].mlp.fitness = s.fitness || 0;
            if(s.w1) agents[i].mlp.w1 = s.w1;
            if(s.w2) agents[i].mlp.w2 = s.w2;
          }
        });
        initPortals();
        document.getElementById('status').textContent = 'Restored sealed genome';
      }
    };
  } catch (e) { console.debug("lab f685-webgpu-anchor-positioning-causal-agent-mind:", e); }
  initAgents(); initPortals();
  step();
})();
