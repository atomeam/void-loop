const N = 5;
const agents = [];
let tiltX = 0, tiltY = 0, battery = 1.0;
const bc = new BroadcastChannel('f796-genome');

function makeTree() {
  return {
    splits: [
      { feat: 0, thresh: 0.1, left: 0.4, right: -0.3 },
      { feat: 1, thresh: -0.1, left: -0.2, right: 0.5 },
      { feat: 2, thresh: 0.5, left: 0.3, right: -0.1 }
    ]
  };
}

function evalTree(tree, inputs) {
  const outs = [0,0,0];
  tree.splits.forEach((s, i) => {
    const v = inputs[s.feat] || 0;
    outs[i] = v > s.thresh ? s.right : s.left;
  });
  return outs;
}

function createAgent(i) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.style.left = (20 + i * 18) + '%';
  el.style.top = '40%';
  for (let s = 0; s < 3; s++) {
    const seg = document.createElement('div');
    seg.className = 'seg';
    el.appendChild(seg);
  }
  document.getElementById('stage').appendChild(el);
  return { el, tree: makeTree(), fitness: 0, hue: 200 + i*30 };
}

for (let i = 0; i < N; i++) agents.push(createAgent(i));

function update() {
  const inputs = [tiltX, tiltY, battery, 0];
  agents.forEach(a => {
    const outs = evalTree(a.tree, inputs);
    a.el.style.transform = `translateZ(${outs[2]*80}px) rotateX(${outs[0]*40}deg) rotateY(${outs[1]*40}deg)`;
    const segs = a.el.children;
    segs[0].style.transform = `rotateX(${outs[0]*30}deg)`;
    segs[1].style.transform = `rotateY(${outs[1]*25}deg)`;
    segs[2].style.transform = `rotateX(${outs[2]*20}deg)`;
    a.el.style.filter = `hue-rotate(${a.hue + outs[0]*20}deg)`;
  });
  requestAnimationFrame(update);
}
update();

window.addEventListener('deviceorientation', e => {
  tiltX = (e.beta || 0) / 90;
  tiltY = (e.gamma || 0) / 90;
});
document.addEventListener('pointermove', e => {
  if (!window.DeviceOrientationEvent) {
    tiltX = (e.clientY / window.innerHeight - 0.5) * 2;
    tiltY = (e.clientX / window.innerWidth - 0.5) * 2;
  }
});

if (navigator.getBattery) {
  navigator.getBattery().then(b => {
    battery = b.level;
    b.addEventListener('levelchange', () => battery = b.level);
  });
}

agents.forEach(a => {
  a.el.addEventListener('click', () => {
    a.fitness += 1;
    a.hue = (a.hue + 20) % 360;
    // transfer to lowest fitness
    const sorted = [...agents].sort((x,y) => y.fitness - x.fitness);
    if (sorted[0] === a) {
      const worst = sorted[sorted.length-1];
      worst.tree = JSON.parse(JSON.stringify(a.tree));
      worst.fitness = Math.max(0, worst.fitness - 0.5);
    }
    document.getElementById('status').textContent = `Fitness: ${agents.map(x=>x.fitness).join(', ')}`;
  });
});

document.getElementById('seal').onclick = async () => {
  const data = agents.map(a => ({tree: a.tree, fitness: a.fitness}));
  localStorage.setItem('f796-seal', JSON.stringify(data));
  bc.postMessage(data);
  document.getElementById('status').textContent = 'Sealed to localStorage + BroadcastChannel';
};

document.getElementById('load').onclick = () => {
  const raw = localStorage.getItem('f796-seal');
  if (raw) {
    const data = JSON.parse(raw);
    data.forEach((d, i) => { if (agents[i]) { agents[i].tree = d.tree; agents[i].fitness = d.fitness; } });
  }
};

bc.onmessage = e => {
  const data = e.data;
  data.forEach((d, i) => { if (agents[i]) agents[i].tree = d.tree; });
  document.getElementById('status').textContent = 'Received sealed genome from peer';
};

// IndexedDB stub for permanence
const dbReq = indexedDB.open('f796', 1);
dbReq.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
