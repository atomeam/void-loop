const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const W = 64, H = 64;
let grid = new Uint8Array(W*H); // 0=S, 1=I, 2=R
let beta = 0.2, gamma = 0.1;
let orient = {beta:0, gamma:0, dbeta:0, dgamma:0};
let lastOrient = {beta:0, gamma:0};
let fitness = 0;
let weights = null; // MLP: 4->8->2
const hosts = [];
const channel = new BroadcastChannel('f531-sir');

function initGrid() {
  grid.fill(0);
  for (let i=0; i<20; i++) grid[Math.floor(Math.random()*W*H)] = 1;
}

function initMLP() {
  weights = {
    w1: Array(8).fill(0).map(() => Array(4).fill(0).map(() => Math.random()*0.4-0.2)),
    b1: Array(8).fill(0).map(() => Math.random()*0.2-0.1),
    w2: Array(2).fill(0).map(() => Array(8).fill(0).map(() => Math.random()*0.4-0.2)),
    b2: Array(2).fill(0).map(() => Math.random()*0.2-0.1)
  };
}

function mlpForward(inputs) {
  const h = [];
  for (let i=0; i<8; i++) {
    let s = weights.b1[i];
    for (let j=0; j<4; j++) s += weights.w1[i][j] * inputs[j];
    h[i] = Math.tanh(s);
  }
  const o = [];
  for (let i=0; i<2; i++) {
    let s = weights.b2[i];
    for (let j=0; j<8; j++) s += weights.w2[i][j] * h[j];
    o[i] = 0.25 + 0.25 * Math.tanh(s); // [0.01,0.5]
  }
  return o;
}

function updateMLP() {
  const inputs = [orient.beta/90, orient.gamma/90, orient.dbeta/10, orient.dgamma/10];
  const [nb, ng] = mlpForward(inputs);
  beta = Math.max(0.01, Math.min(0.5, nb));
  gamma = Math.max(0.01, Math.min(0.5, ng));
}

function stepLattice() {
  const next = new Uint8Array(grid);
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const i = y*W + x;
    if (grid[i] === 1) { // I
      if (Math.random() < gamma) next[i] = 2; // recover
      else {
        const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
        for (const [dx,dy] of dirs) {
          const nx = (x+dx+W)%W, ny = (y+dy+H)%H;
          const ni = ny*W + nx;
          if (grid[ni] === 0 && Math.random() < beta) next[ni] = 1;
        }
      }
    }
  }
  grid = next;
  let infected = 0, recovered = 0;
  for (let v of grid) { if (v===1) infected++; if (v===2) recovered++; }
  fitness = recovered / (W*H) - Math.abs(infected/(W*H) - 0.15); // prefer controlled
}

function createHosts() {
  for (let i=0; i<6; i++) {
    const el = document.createElement('div');
    el.className = 'host';
    el.textContent = `Host ${i}`;
    el.style.left = (100 + i*110) + 'px';
    el.style.top = (120 + (i%2)*90) + 'px';
    document.body.appendChild(el);
    hosts.push({el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), state:0});
    makeDraggable(el, hosts[hosts.length-1]);
  }
}

function makeDraggable(el, host) {
  let dragging = false, ox=0, oy=0;
  el.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX-host.x; oy=e.clientY-host.y; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!dragging) return; host.x = e.clientX-ox; host.y = e.clientY-oy; el.style.left=host.x+'px'; el.style.top=host.y+'px'; });
  el.addEventListener('pointerup', e => {
    dragging=false;
    // inject at canvas position
    const cx = (host.x / canvas.width) * W | 0;
    const cy = (host.y / canvas.height) * H | 0;
    const i = Math.max(0, Math.min(W*H-1, cy*W + cx));
    grid[i] = Math.random() < 0.5 ? 1 : 0; // infect or vaccinate
  });
}

function updateHosts() {
  hosts.forEach((h, idx) => {
    const cx = (h.x / canvas.width) * W | 0;
    const cy = (h.y / canvas.height) * H | 0;
    let dens = 0, state = 0;
    for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
      const x = (cx+dx+W)%W, y = (cy+dy+H)%H;
      const v = grid[y*W + x];
      if (v===1) dens++;
      if (v > state) state = v;
    }
    h.state = state;
    h.el.className = 'host' + (state===1?' I':state===2?' R':'');
    h.el.style.transform = `scale(${1 + dens*0.05})`;
    h.el.textContent = `Host ${idx}\n${['S','I','R'][state]} dens:${dens}`;
  });
}

function draw() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const cw = canvas.width / W, ch = canvas.height / H;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const v = grid[y*W+x];
    ctx.fillStyle = v===0 ? '#113' : v===1 ? '#f33' : '#33f';
    ctx.fillRect(x*cw, y*ch, cw+1, ch+1);
  }
}

function loop() {
  updateMLP();
  stepLattice();
  updateHosts();
  draw();
  status.textContent = `\u03b2:${beta.toFixed(2)} \u03b3:${gamma.toFixed(2)} fit:${fitness.toFixed(3)} inf:${(grid.filter(v=>v===1).length/(W*H)*100).toFixed(1)}%`;
  requestAnimationFrame(loop);
}

async function seal() {
  const data = {weights, beta, gamma, fitness, ts:Date.now()};
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  const hex = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const db = await new Promise((res,rej) => {
    const req = indexedDB.open('f531', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => res(req.result);
  });
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({hash:hex, data}, hex);
  channel.postMessage({hash:hex, data, fitness});
  status.textContent += ' | Sealed ' + hex.slice(0,8);
}

channel.onmessage = e => {
  if (e.data.fitness > fitness) {
    weights = e.data.data.weights;
    status.textContent += ' | Adopted better genome';
  }
};

document.getElementById('orientBtn').onclick = () => {
  if (window.DeviceOrientationEvent) {
    DeviceOrientationEvent.requestPermission?.().then(p => {
      if (p==='granted' || !DeviceOrientationEvent.requestPermission) {
        window.addEventListener('deviceorientation', e => {
          orient.dbeta = e.beta - lastOrient.beta;
          orient.dgamma = e.gamma - lastOrient.gamma;
          orient.beta = e.beta || 0;
          orient.gamma = e.gamma || 0;
          lastOrient = {beta:orient.beta, gamma:orient.gamma};
        });
        status.textContent = 'Orientation active';
      }
    }).catch(() => status.textContent = 'Orient denied; use pointer');
  } else status.textContent = 'No orientation; pointer fallback';
};

document.getElementById('sealBtn').onclick = seal;
document.getElementById('resetBtn').onclick = initGrid;

initGrid();
initMLP();
createHosts();
loop();
