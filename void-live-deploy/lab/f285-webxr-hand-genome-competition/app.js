const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const statusEl = document.getElementById('status');
const NUM_AGENTS = 6;
const agents = [];
const sealedGenomes = [];
let xrSession = null, xrRefSpace = null, handPoses = { left: null, right: null };
let mouse = { x: W/2, y: H/2, down: false };

function randomGenome() {
  return {
    w1: Array(8).fill(0).map(() => (Math.random()-0.5)*1.2),
    b1: Array(2).fill(0).map(() => (Math.random()-0.5)*0.5),
    fitness: 0
  };
}
function mutate(g, rate=0.15) {
  const ng = JSON.parse(JSON.stringify(g));
  ng.w1 = ng.w1.map(w => w + (Math.random()-0.5)*rate);
  ng.b1 = ng.b1.map(b => b + (Math.random()-0.5)*rate*0.5);
  return ng;
}
function mlpForward(g, inputs) {
  const h0 = Math.tanh(inputs[0]*g.w1[0] + inputs[1]*g.w1[1] + inputs[2]*g.w1[2] + inputs[3]*g.w1[3] + g.b1[0]);
  const h1 = Math.tanh(inputs[0]*g.w1[4] + inputs[1]*g.w1[5] + inputs[2]*g.w1[6] + inputs[3]*g.w1[7] + g.b1[1]);
  return [h0 * 0.8, h1 * 0.8];
}

class Agent {
  constructor(i) {
    this.id = i;
    this.x = Math.random()*W; this.y = Math.random()*H;
    this.vx = 0; this.vy = 0;
    this.genome = randomGenome();
    this.energy = 0.5;
    this.color = `hsl(${(i*60)%360},70%,60%)`;
    this.sealed = false;
    this.label = document.createElement('div');
    this.label.className = 'agent-label';
    this.label.textContent = `A${i}`;
    document.body.appendChild(this.label);
  }
  update(orb, neighbors, hands) {
    const dx = (orb.x - this.x)/W, dy = (orb.y - this.y)/H;
    const nAvg = neighbors.reduce((s,n)=>s+n.energy,0)/(neighbors.length||1);
    const inputs = [dx, dy, this.energy, nAvg];
    const [fx, fy] = mlpForward(this.genome, inputs);
    for (const h of hands) {
      if (!h) continue;
      const d = Math.hypot(h.x-this.x, h.y-this.y);
      if (d < 80) {
        const push = (80-d)/80 * 2.5;
        this.vx += (this.x - h.x)/d * push;
        this.vy += (this.y - h.y)/d * push;
        if (d < 40 && mouse.down) this.energy = Math.min(1, this.energy + 0.02);
      }
    }
    this.vx += fx * 1.5; this.vy += fy * 1.5;
    this.vx *= 0.92; this.vy *= 0.92;
    this.x += this.vx; this.y += this.vy;
    if (this.x < 20 || this.x > W-20) this.vx *= -0.8;
    if (this.y < 20 || this.y > H-20) this.vy *= -0.8;
    this.x = Math.max(20, Math.min(W-20, this.x));
    this.y = Math.max(20, Math.min(H-20, this.y));
    const dOrb = Math.hypot(this.x-orb.x, this.y-orb.y);
    this.energy = Math.max(0, Math.min(1, this.energy + (dOrb < 60 ? 0.008 : -0.002)));
    this.genome.fitness = this.energy * 10 + (1 - dOrb/Math.max(W,H));
    this.label.style.left = (this.x + 12) + 'px';
    this.label.style.top = (this.y - 18) + 'px';
    this.label.textContent = `A${this.id} ${this.energy.toFixed(2)}`;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, 12 + this.energy*6, 0, Math.PI*2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = this.sealed ? '#0f0' : '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

const orb = { x: W/2, y: H/2, r: 18, pulse: 0 };
for (let i=0; i<NUM_AGENTS; i++) agents.push(new Agent(i));

function getHands() {
  const hands = [];
  if (handPoses.left) hands.push(handPoses.left);
  if (handPoses.right) hands.push(handPoses.right);
  if (hands.length === 0) hands.push(mouse);
  return hands;
}

function loop() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  orb.pulse += 0.05;
  orb.r = 18 + Math.sin(orb.pulse)*3;
  ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI*2);
  ctx.fillStyle = '#ffaa33'; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.stroke();

  const hands = getHands();
  agents.forEach(a => {
    const neigh = agents.filter(o => o !== a && Math.hypot(o.x-a.x,o.y-a.y)<120);
    a.update(orb, neigh, hands);
    a.draw();
  });
  hands.forEach(h => {
    if (!h) return;
    ctx.beginPath(); ctx.arc(h.x, h.y, 15, 0, Math.PI*2);
    ctx.strokeStyle = '#4af'; ctx.lineWidth = 3; ctx.stroke();
  });
  requestAnimationFrame(loop);
}
loop();

canvas.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('pointerdown', () => mouse.down = true);
canvas.addEventListener('pointerup', () => mouse.down = false);

document.getElementById('enterXR').onclick = async () => {
  if (!navigator.xr) { statusEl.textContent = 'WebXR not available'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    xrRefSpace = await xrSession.requestReferenceSpace('local');
    statusEl.textContent = 'XR session active — hands tracked';
    xrSession.addEventListener('end', () => { xrSession = null; statusEl.textContent = 'XR ended'; });
    xrSession.requestAnimationFrame(onXRFrame);
  } catch (e) { statusEl.textContent = 'XR failed: ' + e.message; }
};
function onXRFrame(t, frame) {
  if (!xrSession) return;
  const pose = frame.getViewerPose(xrRefSpace);
  if (pose) {
    for (const input of xrSession.inputSources) {
      if (input.hand) {
        const wrist = input.hand.get('wrist');
        if (wrist) {
          const jointPose = frame.getJointPose(wrist, xrRefSpace);
          if (jointPose) {
            const p = jointPose.transform.position;
            const side = input.handedness;
            handPoses[side] = { x: W/2 + p.x * 200, y: H/2 - p.y * 200 };
          }
        }
      }
    }
  }
  xrSession.requestAnimationFrame(onXRFrame);
}

document.getElementById('sealBest').onclick = () => {
  const best = agents.reduce((b,a) => a.genome.fitness > b.genome.fitness ? a : b, agents[0]);
  best.sealed = true;
  sealedGenomes.push(JSON.parse(JSON.stringify(best.genome)));
  try { localStorage.setItem('f285-sealed', JSON.stringify(sealedGenomes)); } catch(e){}
  statusEl.textContent = `Sealed A${best.id} fitness ${best.genome.fitness.toFixed(2)}`;
};
document.getElementById('loadGenome').onclick = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('f285-sealed') || '[]');
    if (stored.length) {
      const g = stored[stored.length-1];
      const target = agents[Math.floor(Math.random()*agents.length)];
      target.genome = mutate(g, 0.05);
      target.sealed = true;
      statusEl.textContent = `Loaded sealed genome into A${target.id}`;
    } else statusEl.textContent = 'No sealed genomes';
  } catch(e) { statusEl.textContent = 'Load failed'; }
};
document.getElementById('reset').onclick = () => {
  agents.forEach((a,i) => { a.x = Math.random()*W; a.y = Math.random()*H; a.vx=a.vy=0; a.energy=0.5; a.genome = randomGenome(); a.sealed=false; });
  statusEl.textContent = 'Arena reset';
};

try {
  const prev = JSON.parse(localStorage.getItem('f285-sealed') || '[]');
  if (prev.length) statusEl.textContent += ` | ${prev.length} sealed genomes in storage`;
} catch(e){}
