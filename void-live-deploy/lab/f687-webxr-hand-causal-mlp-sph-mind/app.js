const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 400;
const particles = [];
const portals = [];
let agents = [
  { id:'A', fitness:1, genome: randomGenome(), color:'#f88' },
  { id:'B', fitness:1, genome: randomGenome(), color:'#8f8' }
];
let hand = { x: W/2, y: H/2, vx:0, vy:0, pinch:0 };
let ori = { x:0, y:0 };
let xrSession = null, xrRefSpace = null;

function randomGenome() {
  const g = [];
  for (let i=0; i<5*6 + 6*3; i++) g.push((Math.random()-0.5)*0.5);
  return g;
}

function mlpForward(genome, input) {
  const w1 = 5*6, w2 = 6*3;
  let h = new Array(6).fill(0);
  for (let i=0; i<6; i++) {
    let s = 0;
    for (let j=0; j<5; j++) s += input[j] * genome[i*5 + j];
    h[i] = Math.tanh(s);
  }
  let o = new Array(3).fill(0);
  for (let i=0; i<3; i++) {
    let s = 0;
    for (let j=0; j<6; j++) s += h[j] * genome[w1 + i*6 + j];
    o[i] = Math.tanh(s);
  }
  return o;
}

function initParticles() {
  particles.length = 0;
  for (let i=0; i<N; i++) {
    particles.push({
      x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
      dens: 0
    });
  }
}
initParticles();

function createPortals() {
  const container = document.getElementById('portals');
  container.innerHTML = '';
  portals.length = 0;
  for (let i=0; i<4; i++) {
    const p = document.createElement('div');
    p.className = 'portal ' + (i<2 ? 'a' : 'b');
    p.textContent = (i<2 ? 'A' : 'B') + ' portal';
    p.style.left = (100 + i*150) + 'px';
    p.style.top = (100 + (i%2)*100) + 'px';
    p.agent = i<2 ? agents[0] : agents[1];
    p.addEventListener('pointerdown', (e) => reward(p.agent));
    container.appendChild(p);
    portals.push({ el: p, x: 100+i*150, y:100+(i%2)*100, agent: p.agent });
  }
}
createPortals();

function reward(agent) {
  agent.fitness += 1;
  document.getElementById('status').textContent = agent.id + ' rewarded · fitness ' + agent.fitness.toFixed(1);
}

function stepSPH(dt) {
  const h = 40;
  for (let p of particles) p.dens = 0;
  for (let i=0; i<N; i++) {
    for (let j=i+1; j<N; j++) {
      const a = particles[i], b = particles[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const r2 = dx*dx + dy*dy;
      if (r2 < h*h && r2 > 0.1) {
        const r = Math.sqrt(r2);
        const dens = (1 - r/h);
        a.dens += dens; b.dens += dens;
        const f = dens * 0.05;
        const nx = dx/r, ny = dy/r;
        a.vx += nx * f * dt; a.vy += ny * f * dt;
        b.vx -= nx * f * dt; b.vy -= ny * f * dt;
      }
    }
  }
  const mid = W/2;
  for (let p of particles) {
    const agent = p.x < mid ? agents[0] : agents[1];
    const inp = [hand.vx/50, hand.vy/50, hand.pinch, ori.x, ori.y];
    const out = mlpForward(agent.genome, inp);
    const visc = 0.98 + out[0]*0.02;
    const press = 1 + out[1]*0.5;
    p.vx *= visc; p.vy *= visc;
    const dx = p.x - hand.x, dy = p.y - hand.y;
    const d = Math.hypot(dx,dy);
    if (d < 100) {
      p.vx += (hand.x - p.x) * out[2] * 0.01 * press;
      p.vy += (hand.y - p.y) * out[2] * 0.01 * press;
    }
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    if (p.x < 0 || p.x > W) p.vx *= -0.5;
    if (p.y < 0 || p.y > H) p.vy *= -0.5;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  }
}

function updatePortals() {
  for (let portal of portals) {
    let sx=0, sy=0, c=0;
    for (let p of particles) {
      const d = Math.hypot(p.x - portal.x, p.y - portal.y);
      if (d < 80) { sx += p.x; sy += p.y; c++; }
    }
    if (c > 5) {
      portal.x = portal.x * 0.9 + (sx/c) * 0.1;
      portal.y = portal.y * 0.9 + (sy/c) * 0.1;
    }
    portal.el.style.left = portal.x + 'px';
    portal.el.style.top = portal.y + 'px';
    for (let other of portals) {
      if (other.agent !== portal.agent && Math.hypot(other.x - portal.x, other.y - portal.y) < 60) {
        const winner = portal.agent.fitness > other.agent.fitness ? portal.agent : other.agent;
        const loser = winner === portal.agent ? other.agent : portal.agent;
        for (let k=0; k<loser.genome.length; k++) {
          loser.genome[k] = (loser.genome[k] + winner.genome[k]) * 0.5 + (Math.random()-0.5)*0.05;
        }
        loser.fitness *= 0.9;
        document.getElementById('status').textContent = 'Genome sealed from ' + winner.id + ' → ' + loser.id;
      }
    }
  }
}

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  for (let p of particles) {
    const dens = Math.min(1, p.dens / 10);
    ctx.fillStyle = `hsla(${200 + dens*60}, 80%, ${40 + dens*30}%, 0.7)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + dens*2, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.arc(hand.x, hand.y, 15, 0, Math.PI*2);
  ctx.stroke();
}

let last = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t - last)/1000);
  last = t;
  stepSPH(dt);
  updatePortals();
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

canvas.addEventListener('pointermove', e => {
  hand.vx = e.clientX - hand.x;
  hand.vy = e.clientY - hand.y;
  hand.x = e.clientX; hand.y = e.clientY;
});
canvas.addEventListener('pointerdown', () => hand.pinch = 1);
canvas.addEventListener('pointerup', () => hand.pinch = 0);

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    ori.x = (e.beta || 0)/90;
    ori.y = (e.gamma || 0)/90;
  });
}

document.getElementById('xrBtn').onclick = async () => {
  if (!navigator.xr) return alert('WebXR not available');
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    xrRefSpace = await xrSession.requestReferenceSpace('local');
    xrSession.addEventListener('end', () => { xrSession = null; });
    const onFrame = (time, frame) => {
      const pose = frame.getViewerPose(xrRefSpace);
      if (pose) {
        for (const source of xrSession.inputSources) {
          if (source.hand) {
            const tip = source.hand.get('index-finger-phalanx-tip');
            if (tip) {
              const jointPose = frame.getJointPose(tip, xrRefSpace);
              if (jointPose) {
                hand.x = (jointPose.transform.position.x + 1) * W/2;
                hand.y = (1 - jointPose.transform.position.y) * H/2;
                hand.pinch = source.hand.get('thumb-phalanx-tip') ? 1 : 0;
              }
            }
          }
        }
      }
      xrSession.requestAnimationFrame(onFrame);
    };
    xrSession.requestAnimationFrame(onFrame);
  } catch (err) {
    console.warn(err);
    alert('XR failed: ' + err.message);
  }
};

const DB = 'verse-f687';
document.getElementById('sealBtn').onclick = () => {
  const data = { agents: agents.map(a => ({...a, genome: a.genome.slice()})), particles: particles.map(p => ({x:p.x,y:p.y,vx:p.vx,vy:p.vy})) };
  localStorage.setItem(DB, JSON.stringify(data));
  document.getElementById('status').textContent = 'Sealed to localStorage';
};
document.getElementById('resetBtn').onclick = () => {
  agents.forEach(a => a.genome = randomGenome());
  initParticles();
  createPortals();
};
try {
  const saved = localStorage.getItem(DB);
  if (saved) {
    const data = JSON.parse(saved);
    agents = data.agents;
  }
} catch (e) { console.debug("lab f687-webxr-hand-causal-mlp-sph-mind:", e); }
