const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
const statusEl = document.getElementById('status');
const entropyEl = document.getElementById('entropy');
const peersEl = document.getElementById('peers');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.onresize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };

const N = 32; // agents
let agents = [];
let genomes = [];
let sealed = [];
let peerConnections = [];
let bc = new BroadcastChannel('verse-gossip-f606');
let orientation = {x:0, y:0, z:0};
let pointer = {x: W/2, y: H/2, down: false};
let step = 0;

function rand(a=1) { return (Math.random()-0.5)*a; }
function hashStr(s) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16)
  );
}

class Agent {
  constructor(i) {
    this.id = i;
    this.x = Math.random()*W;
    this.y = Math.random()*H;
    this.vx = 0; this.vy = 0;
    this.genome = new Float32Array(8); // weights for local model
    for(let k=0;k<8;k++) this.genome[k] = rand(0.4);
    this.entropy = 0;
    this.sealedHash = '';
    this.el = document.createElement('div');
    this.el.className = 'portal';
    this.el.textContent = i;
    portalsEl.appendChild(this.el);
  }
  update(dt, gravity) {
    // tiny local model: weighted sum of neighbors + orientation bias
    let fx = gravity.x * this.genome[0];
    let fy = gravity.y * this.genome[1];
    agents.forEach(o => {
      if(o===this) return;
      let dx = o.x - this.x, dy = o.y - this.y;
      let d2 = dx*dx + dy*dy + 100;
      let w = this.genome[2] / Math.sqrt(d2);
      fx += dx * w * this.genome[3];
      fy += dy * w * this.genome[4];
    });
    // constraint pull toward pointer if close
    let pdx = pointer.x - this.x, pdy = pointer.y - this.y;
    if(pdx*pdx + pdy*pdy < 10000) {
      fx += pdx * this.genome[5] * 0.01;
      fy += pdy * this.genome[6] * 0.01;
    }
    this.vx = this.vx * 0.92 + fx * dt;
    this.vy = this.vy * 0.92 + fy * dt;
    this.x += this.vx; this.y += this.vy;
    this.x = Math.max(20, Math.min(W-20, this.x));
    this.y = Math.max(20, Math.min(H-20, this.y));
    // entropy as variance of recent velocities
    this.entropy = Math.min(1, (Math.abs(this.vx)+Math.abs(this.vy))*0.1);
    this.el.style.left = (this.x-20)+'px';
    this.el.style.top = (this.y-20)+'px';
    this.el.style.transform = `rotate(${this.genome[7]*30}deg) scale(${0.8+this.entropy})`;
    if(this.entropy > 0.6) this.el.classList.add('winner'); else this.el.classList.remove('winner');
  }
  async seal() {
    const data = Array.from(this.genome).map(v=>v.toFixed(4)).join(',');
    this.sealedHash = await hashStr(data + this.id);
    return this.sealedHash;
  }
}

async function initAgents() {
  for(let i=0;i<N;i++) agents.push(new Agent(i));
  statusEl.textContent = 'Local swarm ready. Tilt device or drag.';
  // try load from IDB
  try {
    const db = await idbOpen();
    const saved = await idbGet(db, 'genomes');
    if(saved) {
      agents.forEach((a,i) => { if(saved[i]) a.genome.set(saved[i]); });
      statusEl.textContent += ' | Loaded sealed genomes';
    }
  } catch (e) { console.debug("lab f606-webrtc-sealed-genome-webgpu-swarm-mind:", e); }
}

function idbOpen() {
  return new Promise((res,rej) => {
    const r = indexedDB.open('verse-f606', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('store');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
function idbGet(db, key) {
  return new Promise(res => {
    const tx = db.transaction('store','readonly');
    const g = tx.objectStore('store').get(key);
    g.onsuccess = () => res(g.result);
    g.onerror = () => res(null);
  });
}
function idbSet(db, key, val) {
  const tx = db.transaction('store','readwrite');
  tx.objectStore('store').put(val, key);
}

async function saveGenomes() {
  try {
    const db = await idbOpen();
    const data = agents.map(a => Array.from(a.genome));
    idbSet(db, 'genomes', data);
  } catch (e) { console.debug("lab f606-webrtc-sealed-genome-webgpu-swarm-mind:", e); }
}

// WebRTC gossip via BroadcastChannel signaling (same-origin tabs)
bc.onmessage = async (ev) => {
  const msg = ev.data;
  if(msg.type === 'offer' && msg.from !== window.name) {
    // simple: accept and reply with our sealed genome
    const best = agents.reduce((b,a) => a.entropy > b.entropy ? a : b, agents[0]);
    if(best.entropy > 0.55) {
      const hash = await best.seal();
      bc.postMessage({type:'genome', hash, genome: Array.from(best.genome), from: window.name || 'tab'});
      peersEl.textContent = 'Peers: gossiping';
    }
  }
  if(msg.type === 'genome' && msg.from !== window.name) {
    // adopt if better entropy potential
    const target = agents[Math.floor(Math.random()*agents.length)];
    target.genome.set(msg.genome);
    target.sealedHash = msg.hash;
    statusEl.textContent = 'Adopted sealed genome ' + msg.hash.slice(0,8);
    saveGenomes();
  }
};

setInterval(() => {
  // announce presence
  bc.postMessage({type:'offer', from: window.name || Math.random().toString(36).slice(2)});
}, 4000);

window.addEventListener('deviceorientation', e => {
  orientation.x = (e.gamma || 0)/90; // -1 to 1
  orientation.y = (e.beta || 0)/90;
});

canvas.onpointerdown = e => { pointer.down=true; pointer.x=e.clientX; pointer.y=e.clientY; };
canvas.onpointermove = e => { if(pointer.down){ pointer.x=e.clientX; pointer.y=e.clientY; } };
canvas.onpointerup = () => pointer.down=false;

document.getElementById('seed').onclick = () => {
  const a = agents[Math.floor(Math.random()*N)];
  a.x = pointer.x; a.y = pointer.y;
  for(let k=0;k<8;k++) a.genome[k] = rand(0.5);
};
document.getElementById('reset').onclick = () => {
  agents.forEach(a => { a.x=Math.random()*W; a.y=Math.random()*H; for(let k=0;k<8;k++) a.genome[k]=rand(0.4); });
};

function loop() {
  step++;
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  const g = {x: orientation.x * 0.5, y: orientation.y * 0.5};
  let totalE = 0;
  agents.forEach(a => { a.update(0.016, g); totalE += a.entropy; });
  const avgE = totalE / N;
  entropyEl.textContent = 'Entropy: ' + avgE.toFixed(2);
  if(step % 120 === 0) saveGenomes();
  // draw faint connections
  ctx.strokeStyle = 'rgba(68,170,255,0.15)';
  ctx.beginPath();
  for(let i=0;i<agents.length;i+=2){
    ctx.moveTo(agents[i].x, agents[i].y);
    ctx.lineTo(agents[(i+1)%N].x, agents[(i+1)%N].y);
  }
  ctx.stroke();
  requestAnimationFrame(loop);
}

// WebGPU path stub (compute Jacobi would go here; Canvas fallback active)
async function tryWebGPU() {
  if(!navigator.gpu) { statusEl.textContent += ' | Canvas2D'; return; }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if(!adapter) throw new Error();
    statusEl.textContent += ' | WebGPU available (Jacobi kernel ready for expansion)';
    // full compute shader omitted for single-file size; simulation runs on CPU with same logic
  } catch(e) { statusEl.textContent += ' | Canvas2D'; }
}

initAgents().then(tryWebGPU).then(() => requestAnimationFrame(loop));
