const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 12;
const ACTIONS = [[0,-1],[0,1],[-1,0],[1,0],[0,0]]; // N S W E stay
const N_ACTIONS = 5;
const ANGLE_BINS = 8;
const DIST_BINS = 3;
const ORI_BINS = 3;
const N_STATES = ANGLE_BINS * DIST_BINS * ORI_BINS; // 72

let agents = [];
let pointer = {x: W/2, y: H/2, vx:0, vy:0};
let ori = {beta:0, gamma:0};
let audioCtx = null;
let running = true;
let epsilon = 0.25;
let alpha = 0.15;
let gamma = 0.92;

class Agent {
  constructor(i) {
    this.id = i;
    this.x = Math.random()*W;
    this.y = Math.random()*H;
    this.vx = 0; this.vy = 0;
    this.fitness = 0.5;
    this.q = Array.from({length: N_STATES}, () => Array(N_ACTIONS).fill(0));
    this.lastState = 0;
    this.lastAction = 0;
    this.osc = null; this.gain = null; this.pan = null;
  }
  state() {
    const dx = pointer.x - this.x, dy = pointer.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);
    const aBin = Math.floor(((angle + Math.PI) / (2*Math.PI)) * ANGLE_BINS) % ANGLE_BINS;
    const dBin = dist < 80 ? 0 : dist < 200 ? 1 : 2;
    const oBin = Math.abs(ori.gamma) < 10 ? 1 : ori.gamma > 0 ? 2 : 0;
    return aBin + dBin * ANGLE_BINS + oBin * ANGLE_BINS * DIST_BINS;
  }
  choose() {
    const s = this.state();
    if (Math.random() < epsilon) return Math.floor(Math.random()*N_ACTIONS);
    let best = 0, bestQ = -1e9;
    for (let a=0; a<N_ACTIONS; a++) if (this.q[s][a] > bestQ) { bestQ = this.q[s][a]; best = a; }
    return best;
  }
  update() {
    const s = this.state();
    const a = this.choose();
    const [ax, ay] = ACTIONS[a];
    const speed = 1.8 + this.fitness * 0.8;
    this.vx = this.vx * 0.85 + ax * speed + ori.gamma * 0.04;
    this.vy = this.vy * 0.85 + ay * speed - ori.beta * 0.03;
    this.x += this.vx; this.y += this.vy;
    if (this.x < 10 || this.x > W-10) this.vx *= -0.5;
    if (this.y < 10 || this.y > H-10) this.vy *= -0.5;
    this.x = Math.max(10, Math.min(W-10, this.x));
    this.y = Math.max(10, Math.min(H-10, this.y));

    const dx = pointer.x - this.x, dy = pointer.y - this.y;
    const dist = Math.hypot(dx, dy);
    const reward = Math.max(0, 1 - dist / 300) * 0.5 + (dist < 40 ? 0.3 : 0);
    const ns = this.state();
    let maxNext = Math.max(...this.q[ns]);
    this.q[s][a] += alpha * (reward + gamma * maxNext - this.q[s][a]);
    this.fitness = this.fitness * 0.995 + reward * 0.3;
    this.lastState = s; this.lastAction = a;

    if (this.osc) {
      const freq = 180 + this.fitness * 220 + Math.sin(Date.now()*0.001 + this.id)*15;
      this.osc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.05);
      const pan = (this.x / W - 0.5) * 1.4;
      this.pan.pan.setTargetAtTime(pan, audioCtx.currentTime, 0.05);
      this.gain.gain.setTargetAtTime(0.04 + this.fitness * 0.08, audioCtx.currentTime, 0.1);
    }
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6 + this.fitness*4, 0, Math.PI*2);
    ctx.fillStyle = `hsl(${200 + this.fitness*80}, 70%, ${50 + this.fitness*20}%)`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,180,255,0.4)';
    ctx.stroke();
  }
}

function init() {
  agents = Array.from({length:N}, (_,i) => new Agent(i));
  try {
    const saved = localStorage.getItem('verse-f713-q');
    if (saved) {
      const data = JSON.parse(saved);
      data.forEach((q,i) => { if (agents[i]) agents[i].q = q; });
    }
  } catch (e) { console.debug("lab f713-qlearning-spatial-audio-agent-mind:", e); }
}

function startAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  agents.forEach(ag => {
    ag.osc = audioCtx.createOscillator();
    ag.gain = audioCtx.createGain();
    ag.pan = audioCtx.createStereoPanner();
    ag.osc.type = 'sine';
    ag.osc.frequency.value = 220;
    ag.gain.gain.value = 0.05;
    ag.osc.connect(ag.gain);
    ag.gain.connect(ag.pan);
    ag.pan.connect(audioCtx.destination);
    ag.osc.start();
  });
  document.getElementById('status').textContent = 'Audio live — agents learning spatial policies';
}

function seal() {
  try {
    const data = agents.map(a => a.q);
    localStorage.setItem('verse-f713-q', JSON.stringify(data));
    document.getElementById('status').textContent = 'Sealed Q-tables to localStorage';
    if (window.BroadcastChannel) {
      const ch = new BroadcastChannel('verse-f713');
      ch.postMessage({type:'q', data});
    }
  } catch(e) { document.getElementById('status').textContent = 'Seal failed (storage)'; }
}

function reset() {
  agents.forEach(a => a.q = Array.from({length:N_STATES}, () => Array(N_ACTIONS).fill(0)));
  localStorage.removeItem('verse-f713-q');
  document.getElementById('status').textContent = 'Reset — random Q-tables';
}

document.getElementById('audioBtn').onclick = startAudio;
document.getElementById('sealBtn').onclick = seal;
document.getElementById('resetBtn').onclick = reset;
document.getElementById('epsBtn').onclick = () => {
  epsilon = epsilon > 0.1 ? 0.05 : 0.3;
  document.getElementById('epsBtn').textContent = `ε: ${epsilon.toFixed(2)}`;
};

addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
addEventListener('click', e => {
  let best = null, bd = 1e9;
  agents.forEach(a => {
    const d = Math.hypot(a.x - e.clientX, a.y - e.clientY);
    if (d < bd) { bd = d; best = a; }
  });
  if (best && bd < 60) best.fitness += 0.4;
});

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    ori.beta = e.beta || 0;
    ori.gamma = e.gamma || 0;
  });
}

if (window.BroadcastChannel) {
  const ch = new BroadcastChannel('verse-f713');
  ch.onmessage = ev => {
    if (ev.data.type === 'q' && ev.data.data) {
      ev.data.data.forEach((q,i) => { if (agents[i]) agents[i].q = q; });
      document.getElementById('status').textContent = 'Received shared Q-tables';
    }
  };
}

function loop() {
  ctx.fillStyle = 'rgba(5,5,16,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#adf';
  ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 4, 0, Math.PI*2); ctx.fill();
  agents.forEach(a => { a.update(); a.draw(); });
  requestAnimationFrame(loop);
}

init();
loop();
document.getElementById('status').textContent = 'Ready — click Start Audio to begin';
