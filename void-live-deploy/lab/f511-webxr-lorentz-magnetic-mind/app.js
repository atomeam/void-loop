const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.onresize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };

const N = 100;
let particles = [];
let B = { x: W/2, y: H/2, strength: 0.8, angle: 0 };
let rnn = { w: new Float32Array(6*8 + 8*3), h: new Float32Array(8), fitness: 0 };
let cards = [];
let pointer = { x: W/2, y: H/2, down: false };
let orient = { beta: 0, gamma: 0 };
let frame = 0;

function rand(a,b){ return a + Math.random()*(b-a); }
function initParticles(){
  particles = [];
  for(let i=0;i<N;i++){
    particles.push({
      x: rand(50, W-50), y: rand(50, H-50),
      vx: rand(-1,1), vy: rand(-1,1),
      q: Math.random() > 0.5 ? 1 : -1,
      ke: 0
    });
  }
}
initParticles();

// Tiny residual RNN: input 6 (px,py,bx,by,ke_avg,orient), hidden 8, out 3 (dB, charge_bias, damp)
function rnnStep(input){
  const {w, h} = rnn;
  // hidden = tanh(Wh * input + Uh * h_prev) residual-ish
  for(let i=0;i<8;i++){
    let s = 0;
    for(let j=0;j<6;j++) s += w[i*6 + j] * input[j];
    for(let j=0;j<8;j++) s += w[48 + i*8 + j] * h[j]; // reuse weights space roughly
    h[i] = Math.tanh(s * 0.5);
  }
  const out = new Float32Array(3);
  for(let i=0;i<3;i++){
    let s = 0;
    for(let j=0;j<8;j++) s += w[48+64 + i*8 + j] * h[j];
    out[i] = Math.tanh(s);
  }
  return out;
}

function update(){
  frame++;
  // Causal input from pointer / orient
  const dx = (pointer.x - B.x) / W;
  const dy = (pointer.y - B.y) / H;
  let keAvg = 0;
  particles.forEach(p => keAvg += p.vx*p.vx + p.vy*p.vy);
  keAvg /= N;
  const input = [dx, dy, orient.beta/90, orient.gamma/90, keAvg*0.1, Math.sin(frame*0.01)];
  const mod = rnnStep(input);
  B.strength = Math.max(0.1, Math.min(3, B.strength + mod[0]*0.05));
  // B position follows pointer / hand slowly
  B.x += (pointer.x - B.x) * 0.05;
  B.y += (pointer.y - B.y) * 0.05;
  B.angle = Math.atan2(dy, dx);

  // Lorentz update
  const dt = 0.8;
  particles.forEach(p => {
    const rx = p.x - B.x, ry = p.y - B.y;
    const r2 = rx*rx + ry*ry + 100;
    const Bx = B.strength * Math.cos(B.angle) * 2000 / r2;
    const By = B.strength * Math.sin(B.angle) * 2000 / r2;
    // F = q (v × B)  (2D: vx*By - vy*Bx for force components appropriately)
    const fx = p.q * (p.vy * By - p.vx * Bx) * 0.02;
    const fy = p.q * (p.vx * Bx - p.vy * By) * 0.02;
    p.vx += fx * dt;
    p.vy += fy * dt;
    p.vx *= 0.995; p.vy *= 0.995; // mild damping
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if(p.x < 10 || p.x > W-10) p.vx *= -0.8;
    if(p.y < 10 || p.y > H-10) p.vy *= -0.8;
    p.ke = p.vx*p.vx + p.vy*p.vy;
    // Charge bias from RNN
    if(Math.random() < 0.002 && mod[1] > 0.3) p.q *= -1;
  });

  // Spawn flux cards on high KE clusters (simple spatial bin)
  if(frame % 30 === 0){
    const bins = {};
    particles.forEach(p => {
      if(p.ke > 4){
        const k = Math.floor(p.x/80)+','+Math.floor(p.y/80);
        bins[k] = (bins[k]||0) + 1;
      }
    });
    for(const k of Object.keys(bins)){
      if(bins[k] > 4 && cards.length < 8){
        const [bx,by] = k.split(',').map(Number);
        cards.push({ x: bx*80+40, y: by*80+40, life: 300, hue: Math.random()*60+200 });
      }
    }
  }
  cards.forEach(c => c.life--);
  cards = cards.filter(c => c.life > 0);

  // Fitness
  rnn.fitness += keAvg * 0.01 + (cards.length > 0 ? 0.05 : 0);
}

function draw(){
  ctx.fillStyle = 'rgba(5,5,16,0.25)';
  ctx.fillRect(0,0,W,H);
  // Field marker
  ctx.beginPath(); ctx.arc(B.x, B.y, 12 + B.strength*4, 0, Math.PI*2);
  ctx.strokeStyle = `hsla(${B.angle*30+180},80%,60%,0.6)`; ctx.lineWidth=2; ctx.stroke();
  // Particles
  particles.forEach(p => {
    const speed = Math.sqrt(p.ke);
    ctx.fillStyle = p.q > 0 ? `hsla(200,80%,${50+speed*10}%,0.8)` : `hsla(320,80%,${50+speed*10}%,0.8)`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2 + speed*0.5, 0, Math.PI*2); ctx.fill();
  });
  // Cards
  document.querySelectorAll('.flux-card').forEach(el => el.remove());
  cards.forEach((c,i) => {
    const el = document.createElement('div');
    el.className = 'flux-card';
    el.style.left = c.x+'px'; el.style.top = c.y+'px';
    el.style.background = `hsla(${c.hue},70%,40%,0.75)`;
    el.textContent = 'flux';
    el.onpointerdown = e => { e.preventDefault(); dragCard(c, e); };
    document.body.appendChild(el);
  });
}

function dragCard(c, e){
  const move = ev => {
    c.x = ev.clientX; c.y = ev.clientY;
    // Inject momentum near card
    particles.forEach(p => {
      const d = Math.hypot(p.x-c.x, p.y-c.y);
      if(d < 40){ p.vx += (p.x-c.x)*0.05; p.vy += (p.y-c.y)*0.05; }
    });
  };
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
}

function loop(){ update(); draw(); requestAnimationFrame(loop); }
loop();

// Inputs
canvas.onpointermove = e => { pointer.x = e.clientX; pointer.y = e.clientY; };
canvas.onpointerdown = e => { pointer.down = true; };
window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0; orient.gamma = e.gamma || 0;
  // Mild influence
  pointer.x += orient.gamma * 0.3;
  pointer.y += orient.beta * 0.2;
});

// Persistence
function seal(){
  const data = { rnn: Array.from(rnn.w), fitness: rnn.fitness, B: {...B}, particles: particles.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy,q:p.q})) };
  const req = indexedDB.open('verse-f511', 1);
  req.onupgradeneeded = ev => ev.target.result.createObjectStore('genomes');
  req.onsuccess = ev => {
    const db = ev.target.result;
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(data, 'latest');
    document.getElementById('status').textContent = 'Sealed to IndexedDB';
  };
}
function restore(){
  const req = indexedDB.open('verse-f511', 1);
  req.onsuccess = ev => {
    const db = ev.target.result;
    if(!db.objectStoreNames.contains('genomes')) return;
    const tx = db.transaction('genomes');
    const g = tx.objectStore('genomes').get('latest');
    g.onsuccess = () => {
      if(g.result){
        rnn.w.set(g.result.rnn);
        Object.assign(B, g.result.B);
        // particles partial restore
        document.getElementById('status').textContent = 'Restored genome';
      }
    };
  };
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('reset').onclick = () => { initParticles(); cards=[]; rnn.fitness=0; };

// WebXR attempt
if(navigator.xr){
  document.getElementById('xrbtn').style.display = 'inline-block';
  document.getElementById('xrbtn').onclick = async () => {
    try {
      const session = await navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['hand-tracking'] });
      document.getElementById('status').textContent = 'XR session started (hand tracking optional)';
      // Minimal: on frame, try to get hand pose and set pointer
      const refSpace = await session.requestReferenceSpace('local');
      const loopXR = (time, frame) => {
        const hands = frame.getHandPoses ? frame.getHandPoses(session.inputSources) : null;
        if(hands && hands[0]){
          const pose = hands[0];
          if(pose && pose.transform){
            pointer.x = W/2 + pose.transform.position.x * 200;
            pointer.y = H/2 - pose.transform.position.y * 200;
          }
        }
        session.requestAnimationFrame(loopXR);
      };
      session.requestAnimationFrame(loopXR);
    } catch(err){
      document.getElementById('status').textContent = 'XR unavailable: ' + err.message;
    }
  };
}
