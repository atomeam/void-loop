const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

const AGENTS = 4;
const LIMBS_PER = 3;
const GENOME_SIZE = 5*8 + 8*2 + 8 + 2; // tiny MLP 5→8→2

let agents = [];
let limbs = [];
let energy = {x: canvas.width/2, y: canvas.height/2, vx:0, vy:0};
let tilt = {x:0, y:0};
let hand = {active:false, x:0.5, y:0.5, pinch:0, velX:0, velY:0};
let xrSession = null;
let frameCount = 0;
let db;

function randn() { return Math.sqrt(-2*Math.log(Math.random())) * Math.cos(2*Math.PI*Math.random()); }

function makeGenome() {
  const g = new Float32Array(GENOME_SIZE);
  for (let i=0;i<GENOME_SIZE;i++) g[i] = randn()*0.3;
  return g;
}

function mlp(g, inputs) {
  // 5 → 8 tanh → 2
  const h = new Float32Array(8);
  let o = 0;
  for (let i=0;i<8;i++) {
    let s = g[o++];
    for (let j=0;j<5;j++) s += g[o++] * inputs[j];
    h[i] = Math.tanh(s);
  }
  const out = [0,0];
  for (let i=0;i<2;i++) {
    let s = g[o++];
    for (let j=0;j<8;j++) s += g[o++] * h[j];
    out[i] = Math.tanh(s);
  }
  return out;
}

function init() {
  agents = [];
  limbs = [];
  for (let a=0;a<AGENTS;a++) {
    const genome = makeGenome();
    agents.push({id:a, genome, fitness:0, color:`hsl(${a*90},70%,60%)`});
    for (let l=0;l<LIMBS_PER;l++) {
      const el = document.createElement('div');
      el.className = 'limb';
      el.textContent = `A${a}`;
      el.style.borderColor = agents[a].color;
      document.body.appendChild(el);
      limbs.push({
        agent:a, el,
        x: 100 + a*180 + l*30, y: 200 + l*40,
        vx:0, vy:0, targetX:0, targetY:0, k:0.05
      });
    }
  }
  // IndexedDB
  const req = indexedDB.open('F252-seals', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath:'id', autoIncrement:true});
  req.onsuccess = e => db = e.target.result;
}

function step() {
  frameCount++;
  // energy drifts with tilt + hand
  energy.vx += (tilt.x*0.02 + (hand.x-0.5)*0.01);
  energy.vy += (tilt.y*0.02 + (hand.y-0.5)*0.01);
  energy.vx *= 0.98; energy.vy *= 0.98;
  energy.x = Math.max(50, Math.min(canvas.width-50, energy.x + energy.vx));
  energy.y = Math.max(50, Math.min(canvas.height-50, energy.y + energy.vy));

  // inputs for MLPs
  const baseInputs = [
    tilt.x, tilt.y,
    hand.x - 0.5, hand.y - 0.5, hand.pinch
  ];

  limbs.forEach(limb => {
    const ag = agents[limb.agent];
    const outs = mlp(ag.genome, baseInputs);
    limb.targetX = energy.x + outs[0]*120;
    limb.targetY = energy.y + outs[1]*120;
    limb.k = 0.04 + Math.abs(outs[0])*0.04;

    const dx = limb.targetX - limb.x;
    const dy = limb.targetY - limb.y;
    limb.vx += dx * limb.k - limb.vx*0.15;
    limb.vy += dy * limb.k - limb.vy*0.15;
    limb.x += limb.vx; limb.y += limb.vy;

    limb.el.style.left = (limb.x-40)+'px';
    limb.el.style.top = (limb.y-20)+'px';
    limb.el.style.transform = `rotate(${Math.atan2(limb.vy,limb.vx)*30}deg) scale(${1+hand.pinch*0.3})`;

    // fitness: proximity to energy
    const d = Math.hypot(limb.x-energy.x, limb.y-energy.y);
    if (d < 80) ag.fitness += (80-d)*0.01;
  });

  // evolve every 4s
  if (frameCount % 240 === 0) {
    agents.sort((a,b)=>b.fitness - a.fitness);
    const champ = agents[0];
    agents.forEach((ag,i) => {
      if (i > 0 && ag.fitness < champ.fitness * 0.6) {
        // mutate champ into this
        for (let j=0;j<GENOME_SIZE;j++) {
          ag.genome[j] = champ.genome[j] + randn()*0.15;
        }
        ag.fitness = champ.fitness * 0.4;
      }
    });
    document.getElementById('fitness').innerHTML = agents.map(a=>`A${a.id}: ${a.fitness.toFixed(1)}`).join('<br>');
  }

  // draw
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  // energy orb
  ctx.beginPath();
  ctx.arc(energy.x, energy.y, 18, 0, Math.PI*2);
  ctx.fillStyle = '#ffcc44';
  ctx.fill();
  // force lines
  limbs.forEach(limb => {
    ctx.strokeStyle = agents[limb.agent].color;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(limb.x, limb.y);
    ctx.lineTo(energy.x, energy.y);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  requestAnimationFrame(step);
}

// Orientation
document.getElementById('orientBtn').onclick = async () => {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const p = await DeviceOrientationEvent.requestPermission();
    if (p !== 'granted') return;
  }
  addEventListener('deviceorientation', e => {
    tilt.x = (e.gamma||0)/90;
    tilt.y = (e.beta||0)/90;
  });
  document.getElementById('status').textContent += ' · orientation active';
};

// WebXR hand (simplified: uses session + pose if available, fallback mouse)
document.getElementById('xrBtn').onclick = async () => {
  if (!navigator.xr) { alert('No WebXR'); return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', {optionalFeatures:['hand-tracking']});
    document.getElementById('status').textContent += ' · XR session';
    // In real XR we'd use reference space and hand joints; here we simulate with controller or fallback
    xrSession.addEventListener('end', () => { xrSession=null; });
  } catch(e) { console.warn(e); }
};
// mouse/pointer as hand proxy for desktop testing
addEventListener('pointermove', e => {
  hand.x = e.clientX / innerWidth;
  hand.y = e.clientY / innerHeight;
  hand.velX = e.movementX;
  hand.velY = e.movementY;
});
addEventListener('pointerdown', () => hand.pinch = 1);
addEventListener('pointerup', () => hand.pinch = 0);

// Seal
document.getElementById('sealBtn').onclick = () => {
  if (!db) return;
  const champ = agents.slice().sort((a,b)=>b.fitness-a.fitness)[0];
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').add({
    genome: Array.from(champ.genome),
    fitness: champ.fitness,
    ts: Date.now(),
    agent: champ.id
  });
  document.getElementById('status').textContent = `Sealed agent ${champ.id} fitness ${champ.fitness.toFixed(1)}`;
};

init();
requestAnimationFrame(step);
