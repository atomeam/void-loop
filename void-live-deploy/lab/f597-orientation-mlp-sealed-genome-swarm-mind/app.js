const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

const N = 24;
const agents = [];
let orient = {x: 0, y: 0, mag: 0};
let mouseVec = {x: 0, y: 0};
let usingMouse = true;
let lastSeal = null;
const DB_NAME = 'verse-f597';
const STORE = 'swarm';

function rand(a,b){return a+Math.random()*(b-a);}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

class Agent {
  constructor(i) {
    this.id = i;
    this.x = rand(0,W); this.y = rand(0,H);
    this.vx = 0; this.vy = 0;
    this.energy = 50;
    this.genome = new Float32Array(40);
    for(let j=0;j<40;j++) this.genome[j] = (Math.random()-0.5)*0.4;
    this.color = `hsl(${(i*37)%360},70%,60%)`;
  }
  forward(inputs) {
    // tiny MLP: 3 → 8 → 2
    const w = this.genome;
    let h = new Float32Array(8);
    for(let i=0;i<8;i++) {
      h[i] = Math.tanh(inputs[0]*w[i*3] + inputs[1]*w[i*3+1] + inputs[2]*w[i*3+2] + w[24+i]*0.1);
    }
    let ox=0, oy=0;
    for(let i=0;i<8;i++) {
      ox += h[i]*w[32+i];
      oy += h[i]*w[36+i%4]; // reuse
    }
    return [ox*2, oy*2];
  }
  step(dt, field) {
    const align = this.vx*orient.x + this.vy*orient.y;
    const inputs = [field, this.energy/100, align];
    const [ax, ay] = this.forward(inputs);
    this.vx = clamp(this.vx + ax*dt + orient.x*0.4, -3, 3);
    this.vy = clamp(this.vy + ay*dt + orient.y*0.4, -3, 3);
    this.x = (this.x + this.vx*dt*60 + W) % W;
    this.y = (this.y + this.vy*dt*60 + H) % H;
    this.energy = clamp(this.energy + align*0.8 - 0.15, 0, 120);
  }
}

function init() {
  agents.length = 0;
  for(let i=0;i<N;i++) agents.push(new Agent(i));
  load();
}

async function load() {
  try {
    const db = await idbOpen();
    const tx = db.transaction(STORE, 'readonly');
    const data = await tx.objectStore(STORE).get('state');
    if (data && data.genomes) {
      data.genomes.forEach((g,i) => { if(agents[i]) agents[i].genome.set(g); agents[i].energy = data.energies[i]||50; });
      status('Restored sealed swarm');
    }
  } catch(e) {}
}

function idbOpen() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}

async function save() {
  try {
    const db = await idbOpen();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      genomes: agents.map(a => Array.from(a.genome)),
      energies: agents.map(a => a.energy)
    }, 'state');
  } catch(e) {}
}

function status(t) { document.getElementById('status').textContent = t; }

document.getElementById('perm').onclick = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p === 'granted') startOrient();
    } catch(e) { status('Permission failed – mouse fallback'); }
  } else startOrient();
};

function startOrient() {
  addEventListener('deviceorientation', e => {
    const beta = (e.beta||0) * Math.PI/180;
    const gamma = (e.gamma||0) * Math.PI/180;
    orient.x = Math.sin(gamma)*0.8;
    orient.y = Math.sin(beta)*0.8;
    orient.mag = Math.hypot(orient.x, orient.y);
    usingMouse = false;
    document.getElementById('o').textContent = `\u03b2${(e.beta||0).toFixed(0)} \u03b3${(e.gamma||0).toFixed(0)}`;
  });
  status('Orientation active');
}

let dragging = false;
canvas.onpointerdown = e => { dragging = true; updateMouse(e); };
canvas.onpointermove = e => { if(dragging) updateMouse(e); };
canvas.onpointerup = () => dragging = false;
function updateMouse(e) {
  const cx = W/2, cy = H/2;
  mouseVec.x = (e.clientX - cx) / (W/2) * 0.7;
  mouseVec.y = (e.clientY - cy) / (H/2) * 0.7;
  if (usingMouse) {
    orient.x = mouseVec.x; orient.y = mouseVec.y;
    document.getElementById('o').textContent = `mouse (${orient.x.toFixed(2)},${orient.y.toFixed(2)})`;
  }
}

document.getElementById('reset').onclick = () => { init(); status('Reset'); };
document.getElementById('sealbtn').onclick = trySeal;

function trySeal() {
  // find closest pair
  let best = null, bd = 1e9;
  for(let i=0;i<agents.length;i++) for(let j=i+1;j<agents.length;j++) {
    const d = Math.hypot(agents[i].x-agents[j].x, agents[i].y-agents[j].y);
    if (d < 40 && d < bd) { bd = d; best = [i,j]; }
  }
  if (!best) { status('No close pair to seal'); return; }
  const [a,b] = best.map(i => agents[i]);
  const donor = a.energy > b.energy ? a : b;
  const recip = donor === a ? b : a;
  // partial transfer: copy first 12 weights
  for(let k=0;k<12;k++) recip.genome[k] = donor.genome[k]*0.7 + recip.genome[k]*0.3;
  // simple hash of donor genome
  const str = Array.from(donor.genome).map(v=>v.toFixed(3)).join(',');
  const hash = simpleHash(str);
  lastSeal = {hash, from: donor.id, to: recip.id};
  document.getElementById('sealtext').textContent = `Sealed transfer ${donor.id} \u2192 ${recip.id}`;
  document.getElementById('hash').textContent = 'sha-sim: ' + hash.slice(0,16);
  document.getElementById('seal').style.display = 'block';
  status('Genome sealed & transferred');
  save();
  setTimeout(() => document.getElementById('seal').style.display = 'none', 4000);
}

function simpleHash(s) {
  let h = 0;
  for(let i=0;i<s.length;i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(16).padStart(8,'0') + Math.abs(h*7).toString(16).padStart(8,'0');
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now-last)/1000); last = now;
  // simple density field via grid
  const field = new Float32Array(agents.length);
  for(let i=0;i<agents.length;i++) {
    let dens = 0;
    for(let j=0;j<agents.length;j++) if(i!==j) {
      const d = Math.hypot(agents[i].x-agents[j].x, agents[i].y-agents[j].y);
      if(d<80) dens += (80-d)/80;
    }
    field[i] = dens / 4;
  }
  agents.forEach((a,i) => a.step(dt, field[i]));

  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  // orientation arrow
  ctx.strokeStyle = '#446';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W/2, H/2);
  ctx.lineTo(W/2 + orient.x*120, H/2 + orient.y*120);
  ctx.stroke();

  agents.forEach(a => {
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 6 + a.energy/30, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '10px system-ui';
    ctx.fillText(a.id, a.x-4, a.y-10);
  });

  document.getElementById('n').textContent = agents.length;
  document.getElementById('e').textContent = agents.reduce((s,a)=>s+a.energy,0).toFixed(0);
  requestAnimationFrame(loop);
}

init();
requestAnimationFrame(loop);
setInterval(save, 8000);
