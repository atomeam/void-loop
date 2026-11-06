const arena = document.getElementById('arena');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
let agents = [];
let pointer = {x: innerWidth/2, y: innerHeight/2};
let orient = {a:0, b:0, g:0};
let idbReady = false;
const DB_NAME = 'f567-rnn-comp-mind';
const STORE = 'agents';

function log(msg) {
  const d = document.createElement('div');
  d.textContent = new Date().toISOString().slice(11,19) + ' ' + msg;
  logEl.prepend(d);
  if (logEl.children.length > 8) logEl.lastChild.remove();
}

function rand(n=1) { return (Math.random()-0.5)*2*n; }
function tanh(x) { return Math.tanh(x); }

class Agent {
  constructor(id, x, y, weights=null) {
    this.id = id;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.fitness = 0;
    this.hidden = new Float32Array(8);
    this.hue = Math.random()*360;
    // Weights: Wih 6x8, Whh 8x8, Who 8x4
    this.Wih = weights?.Wih || Array.from({length:48}, () => rand(0.5));
    this.Whh = weights?.Whh || Array.from({length:64}, () => rand(0.3));
    this.Who = weights?.Who || Array.from({length:32}, () => rand(0.4));
    this.el = document.createElement('div');
    this.el.className = 'agent';
    this.el.innerHTML = `<div class="id">A${id}</div><div class="fit">fit 0</div>`; // void-review: ok (constant labels, numbers or a hash only; no visitor text)
    this.el.style.left = x+'px';
    this.el.style.top = y+'px';
    this.el.style.setProperty('--hue', this.hue);
    arena.appendChild(this.el);
    this.el.addEventListener('pointerenter', () => this.fitness += 2);
    this.el.addEventListener('click', () => { this.fitness += 15; log(`Clicked A${id} +15 fit`); });
  }
  step(dt) {
    const dx = (pointer.x - this.x)/innerWidth;
    const dy = (pointer.y - this.y)/innerHeight;
    const input = [dx, dy, orient.a, orient.b, orient.g, Math.sin(performance.now()/1000)];
    // RNN
    const hnew = new Float32Array(8);
    for(let i=0;i<8;i++) {
      let s = 0;
      for(let j=0;j<6;j++) s += input[j] * this.Wih[j*8 + i];
      for(let j=0;j<8;j++) s += this.hidden[j] * this.Whh[j*8 + i];
      hnew[i] = tanh(s);
    }
    this.hidden = hnew;
    const out = [0,0,0,0];
    for(let i=0;i<4;i++) {
      let s=0;
      for(let j=0;j<8;j++) s += this.hidden[j] * this.Who[j*4 + i];
      out[i] = tanh(s);
    }
    this.vx = out[0]*80;
    this.vy = out[1]*80;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = Math.max(20, Math.min(innerWidth-140, this.x));
    this.y = Math.max(20, Math.min(innerHeight-100, this.y));
    const sc = 0.8 + out[2]*0.4;
    this.hue = (this.hue + out[3]*2 + 360) % 360;
    this.el.style.transform = `translate(${this.x}px,${this.y}px) scale(${sc})`;
    this.el.style.setProperty('--hue', this.hue);
    this.el.querySelector('.fit').textContent = 'fit ' + Math.floor(this.fitness);
    this.fitness *= 0.995;
  }
  async hashWeights() {
    const data = new Float32Array([...this.Wih, ...this.Whh, ...this.Who]);
    const buf = await crypto.subtle.digest('SHA-256', data.buffer);
    return Array.from(new Uint8Array(buf)).slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  getState() {
    return {id:this.id, x:this.x, y:this.y, fitness:this.fitness, hue:this.hue,
            hidden:Array.from(this.hidden), Wih:this.Wih, Whh:this.Whh, Who:this.Who};
  }
  static fromState(s) {
    const a = new Agent(s.id, s.x, s.y, {Wih:s.Wih, Whh:s.Whh, Who:s.Who});
    a.fitness = s.fitness; a.hue = s.hue; a.hidden = new Float32Array(s.hidden);
    return a;
  }
}

function spawn(n=6) {
  agents.forEach(a => a.el.remove());
  agents = [];
  for(let i=0;i<n;i++) {
    agents.push(new Agent(i, 100+Math.random()*(innerWidth-200), 100+Math.random()*(innerHeight-200)));
  }
}

async function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    const st = tx.objectStore(STORE);
    const states = agents.map(a => a.getState());
    await st.put(states, 'population');
    log('Sealed ' + agents.length + ' agents to IndexedDB');
    idbReady = true;
  } catch(e) { log('Seal failed: ' + e.message); }
}

async function load() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('population');
    req.onsuccess = () => {
      if (req.result) {
        agents.forEach(a => a.el.remove());
        agents = req.result.map(Agent.fromState);
        agents.forEach(a => arena.appendChild(a.el));
        log('Loaded ' + agents.length + ' agents from IndexedDB');
      } else spawn();
    };
  } catch(e) { spawn(); log('Load failed, fresh spawn'); }
}

async function absorb() {
  if (agents.length < 2) return;
  agents.sort((a,b) => b.fitness - a.fitness);
  const win = agents[0], lose = agents[agents.length-1];
  const h = await win.hashWeights();
  lose.Wih = [...win.Wih]; lose.Whh = [...win.Whh]; lose.Who = [...win.Who];
  lose.hidden.fill(0);
  log(`Sealed transfer ${h} : A${win.id} → A${lose.id}`);
}

document.getElementById('seal').onclick = seal;
document.getElementById('add').onclick = () => {
  if (agents.length >= 8) return;
  const id = agents.length ? Math.max(...agents.map(a=>a.id))+1 : 0;
  agents.push(new Agent(id, pointer.x, pointer.y));
  log('Added A'+id);
};
document.getElementById('reset').onclick = () => { spawn(); log('Reset population'); };
document.getElementById('tilt').onclick = () => { orient = {a:rand(0.5), b:rand(0.5), g:rand(0.5)}; log('Tilt proxy injected'); };
document.getElementById('absorb').onclick = absorb;

window.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
window.addEventListener('deviceorientation', e => {
  orient.a = (e.alpha||0)/180 - 1;
  orient.b = (e.beta||0)/90;
  orient.g = (e.gamma||0)/90;
}, true);

// Gesture to request orientation
document.body.addEventListener('click', () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => log('Orient perm: '+p)).catch(()=>{});
  }
}, {once:true});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now-last)/1000);
  last = now;
  agents.forEach(a => a.step(dt));
  const best = agents.reduce((m,a) => Math.max(m, a.fitness), 0);
  statusEl.textContent = `Agents: ${agents.length} | Best fit: ${Math.floor(best)}`;
  requestAnimationFrame(loop);
}
load().then(() => requestAnimationFrame(loop));
