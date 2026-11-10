const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');
const agentsDiv = document.getElementById('agents');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_AGENTS = 8;
const channel = new BroadcastChannel('f649-nbody-swarm');
let peers = new Map();
const myId = Math.random().toString(36).slice(2,8);

function createRNN() {
  const h = 6, i = 6, o = 2;
  return {
    Wh: Array(h*h).fill(0).map(() => (Math.random()-0.5)*0.3),
    Wi: Array(h*i).fill(0).map(() => (Math.random()-0.5)*0.4),
    Wo: Array(o*h).fill(0).map(() => (Math.random()-0.5)*0.5),
    bh: Array(h).fill(0),
    bo: Array(o).fill(0),
    h: Array(h).fill(0)
  };
}
function rnnStep(rnn, input) {
  const h = 6, i = 6;
  const newh = [];
  for (let j=0; j<h; j++) {
    let s = rnn.bh[j];
    for (let k=0; k<h; k++) s += rnn.Wh[j*h+k] * rnn.h[k];
    for (let k=0; k<i; k++) s += rnn.Wi[j*i+k] * input[k];
    newh[j] = Math.tanh(s);
  }
  rnn.h = newh;
  const out = [];
  for (let j=0; j<2; j++) {
    let s = rnn.bo[j];
    for (let k=0; k<h; k++) s += rnn.Wo[j*h+k] * rnn.h[k];
    out[j] = Math.tanh(s) * 1.5;
  }
  return out;
}

const agents = [];
for (let a=0; a<N_AGENTS; a++) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = 'A' + a;
  agentsDiv.appendChild(el);
  agents.push({
    id: myId + '-' + a,
    x: Math.random()*W, y: Math.random()*H,
    vx: 0, vy: 0,
    fitness: 0,
    rnn: createRNN(),
    el,
    lastReward: 0
  });
}

let best = null;
const dbName = 'verse-f649';
function openDB() {
  return new Promise(res => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('best');
    r.onsuccess = () => res(r.result);
  });
}
async function saveBest(g) {
  const db = await openDB();
  const tx = db.transaction('best', 'readwrite');
  tx.objectStore('best').put(g, 'genome');
}
async function loadBest() {
  const db = await openDB();
  return new Promise(res => {
    const tx = db.transaction('best');
    const g = tx.objectStore('best').get('genome');
    g.onsuccess = () => res(g.result);
  });
}
loadBest().then(g => { if (g && g.rnn) { agents[0].rnn = g.rnn; best = g; statusEl.textContent += ' | restored'; } });

channel.onmessage = e => {
  const d = e.data;
  if (d.type === 'state') {
    peers.set(d.id, d);
  } else if (d.type === 'genome' && d.fitness > (best?.fitness || 0)) {
    agents.forEach(ag => { if (Math.random() < 0.3) ag.rnn = JSON.parse(JSON.stringify(d.rnn)); });
    best = d;
    statusEl.textContent = 'accepted genome f=' + d.fitness.toFixed(1);
  }
};

let mouse = {x: W/2, y: H/2, down: false};
addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
addEventListener('pointerdown', e => { mouse.down = true; });
addEventListener('pointerup', () => mouse.down = false);

function getInput(ag) {
  const all = [...peers.values(), ...agents.map(a => ({x:a.x,y:a.y,id:a.id}))].filter(p => p.id !== ag.id);
  all.sort((a,b) => (a.x-ag.x)**2 + (a.y-ag.y)**2 - ((b.x-ag.x)**2 + (b.y-ag.y)**2));
  const p1 = all[0] || {x:ag.x, y:ag.y};
  const p2 = all[1] || {x:ag.x, y:ag.y};
  return [
    (p1.x - ag.x)/W, (p1.y - ag.y)/H,
    (p2.x - ag.x)/W, (p2.y - ag.y)/H,
    ag.vx/5, ag.vy/5
  ];
}

function step() {
  agents.forEach(ag => {
    channel.postMessage({ type:'state', id:ag.id, x:ag.x, y:ag.y, vx:ag.vx, vy:ag.vy, fitness:ag.fitness });
  });

  agents.forEach(ag => {
    const inp = getInput(ag);
    const delta = rnnStep(ag.rnn, inp);
    ag.vx += delta[0] * 0.15;
    ag.vy += delta[1] * 0.15;
    if (mouse.down) {
      const dx = mouse.x - ag.x, dy = mouse.y - ag.y;
      const d = Math.hypot(dx,dy) || 1;
      ag.vx += dx/d * 0.4;
      ag.vy += dy/d * 0.4;
    }
    ag.vx *= 0.92; ag.vy *= 0.92;
    ag.x += ag.vx; ag.y += ag.vy;
    if (ag.x < 20) ag.x = 20; if (ag.x > W-20) ag.x = W-20;
    if (ag.y < 20) ag.y = 20; if (ag.y > H-20) ag.y = H-20;
    ag.el.style.left = (ag.x - 36) + 'px';
    ag.el.style.top = (ag.y - 24) + 'px';
    ag.el.style.transform = `rotate(${Math.atan2(ag.vy,ag.vx)*20}deg)`;
    ag.el.textContent = 'A' + ag.id.slice(-1) + ' f' + ag.fitness.toFixed(0);
  });

  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#4466aa';
  const particles = 80;
  for (let i=0; i<particles; i++) {
    let px = (i*47 % W), py = (i*31 % H);
    agents.forEach(ag => {
      const dx = ag.x - px, dy = ag.y - py;
      const d2 = dx*dx + dy*dy + 100;
      px += dx / d2 * 80;
      py += dy / d2 * 80;
    });
    ctx.fillRect(px, py, 2, 2);
  }

  requestAnimationFrame(step);
}
step();

agents.forEach(ag => {
  ag.el.addEventListener('pointerdown', e => {
    e.stopPropagation();
    ag.fitness += 5;
    ag.el.classList.add('rewarded');
    setTimeout(() => ag.el.classList.remove('rewarded'), 400);
    if (ag.fitness > 20 && (!best || ag.fitness > best.fitness)) {
      best = { rnn: JSON.parse(JSON.stringify(ag.rnn)), fitness: ag.fitness };
      channel.postMessage({ type:'genome', rnn: best.rnn, fitness: best.fitness, sealed: true });
      saveBest(best);
      statusEl.textContent = 'sealed & broadcast f=' + ag.fitness.toFixed(0);
    }
  });
});

document.getElementById('seal').onclick = () => {
  const data = { best, agents: agents.map(a => ({x:a.x,y:a.y,fitness:a.fitness,rnn:a.rnn})), ts: Date.now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'f649-nbody-swarm-seal.json';
  a.click();
};
document.getElementById('reset').onclick = () => { location.reload(); };

statusEl.textContent = 'tabs: open more for shared field';
