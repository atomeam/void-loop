const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let gaze = { x: W/2, y: H/2, vx: 0, vy: 0 };
let xrSession = null, xrRefSpace = null;

// Tiny MLP: 4 inputs -> 8 hidden -> 2 outputs (dx,dy intention)
class TinyMLP {
  constructor() {
    this.w1 = Array.from({length:4*8}, () => (Math.random()-0.5)*0.5);
    this.b1 = Array(8).fill(0);
    this.w2 = Array.from({length:8*2}, () => (Math.random()-0.5)*0.5);
    this.b2 = Array(2).fill(0);
  }
  forward(inp) {
    const h = Array(8).fill(0);
    for (let i=0; i<8; i++) {
      let s = this.b1[i];
      for (let j=0; j<4; j++) s += inp[j] * this.w1[i*4+j];
      h[i] = Math.tanh(s);
    }
    const out = Array(2).fill(0);
    for (let i=0; i<2; i++) {
      let s = this.b2[i];
      for (let j=0; j<8; j++) s += h[j] * this.w2[i*8+j];
      out[i] = Math.tanh(s);
    }
    return out;
  }
  // Simple online nudge toward target
  nudge(inp, target, lr=0.02) {
    const pred = this.forward(inp);
    const err = [target[0]-pred[0], target[1]-pred[1]];
    // Approximate backprop-lite on output layer
    for (let i=0; i<2; i++) {
      this.b2[i] += lr * err[i];
      for (let j=0; j<8; j++) this.w2[i*8+j] += lr * err[i] * 0.1; // rough
    }
  }
  clone() {
    const m = new TinyMLP();
    m.w1 = [...this.w1]; m.b1 = [...this.b1];
    m.w2 = [...this.w2]; m.b2 = [...this.b2];
    return m;
  }
  async seal() {
    const data = JSON.stringify({w1:this.w1, b1:this.b1, w2:this.w2, b2:this.b2});
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
  }
}

class Agent {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.mlp = new TinyMLP();
    this.color = color;
    this.energy = 1;
    this.fitness = 0;
    this.seal = 'pending';
    this.predicted = {x: x, y: y};
  }
  async updateSeal() { this.seal = await this.mlp.seal(); }
}

let agents = [];
function spawnAgents() {
  agents = [];
  const colors = ['#f66','#6f6','#66f','#ff6','#f6f'];
  for (let i=0; i<5; i++) {
    const a = new Agent(Math.random()*W, Math.random()*H, colors[i]);
    a.updateSeal();
    agents.push(a);
  }
}
spawnAgents();

// Pointer as gaze proxy
canvas.addEventListener('pointermove', e => {
  gaze.vx = (e.clientX - gaze.x) * 0.3;
  gaze.vy = (e.clientY - gaze.y) * 0.3;
  gaze.x = e.clientX;
  gaze.y = e.clientY;
});

// WebXR
document.getElementById('xrBtn').onclick = async () => {
  if (!navigator.xr) { status.textContent = 'WebXR not available'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    xrRefSpace = await xrSession.requestReferenceSpace('local');
    status.textContent = 'WebXR active – use controllers/gaze';
    xrSession.addEventListener('end', () => { xrSession = null; status.textContent = 'XR ended'; });
    xrSession.requestAnimationFrame(onXRFrame);
  } catch (err) { status.textContent = 'XR failed: ' + err.message; }
};

function onXRFrame(t, frame) {
  if (!xrSession) return;
  const pose = frame.getViewerPose(xrRefSpace);
  if (pose) {
    // Approximate gaze from view transform (simplified)
    const view = pose.views[0];
    const mat = view.transform.matrix;
    // Project forward vector roughly to 2D
    gaze.x = W/2 + mat[8] * 200;
    gaze.y = H/2 - mat[9] * 200;
  }
  // Input sources for hands/controllers
  for (const src of frame.session.inputSources) {
    if (src.gripSpace) {
      const grip = frame.getPose(src.gripSpace, xrRefSpace);
      if (grip) {
        gaze.x = W/2 + grip.transform.position.x * 300;
        gaze.y = H/2 - grip.transform.position.y * 300;
      }
    }
  }
  xrSession.requestAnimationFrame(onXRFrame);
}

document.getElementById('resetBtn').onclick = spawnAgents;

function step() {
  // Agents predict and act
  for (const a of agents) {
    const dx = (gaze.x - a.x) / W;
    const dy = (gaze.y - a.y) / H;
    const inp = [dx, dy, a.energy, a.fitness * 0.1];
    const intent = a.mlp.forward(inp);
    a.vx += intent[0] * 0.8;
    a.vy += intent[1] * 0.8;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x += a.vx; a.y += a.vy;
    // Bounds
    a.x = Math.max(20, Math.min(W-20, a.x));
    a.y = Math.max(20, Math.min(H-20, a.y));
    // Prediction of next gaze relative
    a.predicted.x = a.x + intent[0] * 40;
    a.predicted.y = a.y + intent[1] * 40;
    // Nudge model toward actual recent gaze motion if close
    const dist = Math.hypot(gaze.x - a.x, gaze.y - a.y);
    if (dist < 120) {
      a.fitness += 0.05;
      a.energy = Math.min(2, a.energy + 0.01);
      const target = [gaze.vx / 10, gaze.vy / 10];
      a.mlp.nudge(inp, target, 0.03);
    } else {
      a.fitness *= 0.995;
      a.energy *= 0.998;
    }
  }
  // Genome transfer on high fitness observation
  for (let i=0; i<agents.length; i++) {
    for (let j=i+1; j<agents.length; j++) {
      const d = Math.hypot(agents[i].x - agents[j].x, agents[i].y - agents[j].y);
      if (d < 80 && agents[i].fitness > agents[j].fitness + 0.5) {
        // Transfer some weights, reseal
        const donor = agents[i].mlp, recip = agents[j].mlp;
        for (let k=0; k<8; k++) recip.w2[k] = recip.w2[k]*0.7 + donor.w2[k]*0.3;
        agents[j].updateSeal();
        agents[i].fitness *= 0.8;
      }
    }
  }
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  // Gaze marker
  ctx.beginPath();
  ctx.arc(gaze.x, gaze.y, 8, 0, Math.PI*2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#8cf';
  ctx.stroke();
  for (const a of agents) {
    ctx.beginPath();
    ctx.arc(a.x, a.y, 16 + a.energy*4, 0, Math.PI*2);
    ctx.fillStyle = a.color;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    // Predicted
    ctx.beginPath();
    ctx.arc(a.predicted.x, a.predicted.y, 4, 0, Math.PI*2);
    ctx.fillStyle = a.color;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '10px system-ui';
    ctx.fillText(a.seal.slice(0,8), a.x-20, a.y-22);
    ctx.fillText(a.fitness.toFixed(1), a.x-10, a.y+30);
  }
  status.textContent = `Agents: ${agents.length} | Gaze @ ${Math.round(gaze.x)},${Math.round(gaze.y)} | XR: ${xrSession ? 'on' : 'off'}`;
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();
