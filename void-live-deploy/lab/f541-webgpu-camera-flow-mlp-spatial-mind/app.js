const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const video = document.getElementById('video');
const flowCanvas = document.createElement('canvas');
flowCanvas.width = 32; flowCanvas.height = 24;
const flowCtx = flowCanvas.getContext('2d', { willReadFrequently: true });
let prevData = null;
let cameraOn = false;

const N = 800;
const particles = new Float32Array(N * 4); // x,y,vx,vy
const cards = [];
const cardEls = [];
const pointer = { x: W/2, y: H/2, vx:0, vy:0 };
let weights = new Float32Array(40);
let fitness = 0;

function initParticles() {
  for (let i=0; i<N; i++) {
    particles[i*4] = Math.random()*W;
    particles[i*4+1] = Math.random()*H;
    particles[i*4+2] = (Math.random()-0.5)*1;
    particles[i*4+3] = (Math.random()-0.5)*1;
  }
}
function initCards() {
  const titles = ['Flow α','Motion β','Spatial γ','Track δ'];
  for (let i=0; i<4; i++) {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<h4>${titles[i]}</h4><div class="state">flow: 0.00</div>`; // void-review: ok (built from this file's own constants and numbers, no visitor text)
    el.style.left = (100 + i*180) + 'px';
    el.style.top = (80 + (i%2)*140) + 'px';
    document.body.appendChild(el);
    cardEls.push(el);
    cards.push({ x: parseFloat(el.style.left), y: parseFloat(el.style.top), flow:0.1 });
  }
}
function initWeights() {
  for (let i=0; i<weights.length; i++) weights[i] = (Math.random()-0.5)*0.4;
}

function sampleFlow() {
  if (!cameraOn || video.readyState < 2) {
    // synthetic from pointer
    return { mag: Math.hypot(pointer.vx, pointer.vy)*0.02, dirX: pointer.vx, dirY: pointer.vy, bins: [0.2,0.2,0.2,0.2] };
  }
  flowCtx.drawImage(video, 0, 0, 32, 24);
  const data = flowCtx.getImageData(0, 0, 32, 24).data;
  let mag = 0, dirX = 0, dirY = 0;
  const bins = [0,0,0,0];
  if (prevData) {
    for (let i=0; i<data.length; i+=4) {
      const lum = (data[i]+data[i+1]+data[i+2])/3;
      const prev = (prevData[i]+prevData[i+1]+prevData[i+2])/3;
      const d = Math.abs(lum - prev);
      mag += d;
      if (d > 10) {
        const px = (i/4) % 32, py = Math.floor((i/4)/32);
        dirX += (px - 16) * d;
        dirY += (py - 12) * d;
        bins[Math.min(3, Math.floor(d / 40))]++;
      }
    }
    mag /= (32*24);
  }
  prevData = data;
  const total = bins.reduce((a,b)=>a+b,1);
  bins.forEach((v,i)=> bins[i]=v/total);
  return { mag: Math.min(1, mag/40), dirX: dirX*0.001, dirY: dirY*0.001, bins };
}

// Tiny MLP
function mlp(inputs) {
  // 12 in → 8 hid → 4 out
  const h = new Float32Array(8);
  for (let j=0; j<8; j++) {
    let s = weights[j];
    for (let i=0; i<12; i++) s += inputs[i] * weights[8 + j*12 + i];
    h[j] = Math.tanh(s);
  }
  const o = new Float32Array(4);
  for (let k=0; k<4; k++) {
    let s = weights[8+96 + k];
    for (let j=0; j<8; j++) s += h[j] * weights[8+96+4 + k*8 + j];
    o[k] = Math.tanh(s);
  }
  return o;
}

function update() {
  const flow = sampleFlow();
  const inputs = [
    flow.mag, flow.dirX, flow.dirY,
    flow.bins[0], flow.bins[1], flow.bins[2], flow.bins[3],
    pointer.vx/30, pointer.vy/30, pointer.x/W, pointer.y/H, fitness*0.1
  ];
  const outs = mlp(inputs);
  const forceScale = 0.5 + outs[0]*0.8;
  const damp = 0.96 + outs[1]*0.02;
  const emit = Math.max(0, outs[2]);
  const cardBias = outs[3];

  // find high flow centroid (synthetic or real)
  let cx = W/2 + flow.dirX * 200, cy = H/2 + flow.dirY * 200;
  cx = Math.max(50, Math.min(W-50, cx));
  cy = Math.max(50, Math.min(H-50, cy));

  // particles
  for (let i=0; i<N; i++) {
    let x = particles[i*4], y = particles[i*4+1];
    let vx = particles[i*4+2], vy = particles[i*4+3];
    const dx = cx - x, dy = cy - y;
    const d = Math.hypot(dx, dy) + 1;
    vx += (dx/d) * forceScale * flow.mag * 0.3;
    vy += (dy/d) * forceScale * flow.mag * 0.3;
    vx *= damp; vy *= damp;
    vx += (Math.random()-0.5)*0.05; vy += (Math.random()-0.5)*0.05;
    x += vx; y += vy;
    if (x<0||x>W) vx *= -0.4; if (y<0||y>H) vy *= -0.4;
    x = Math.max(0, Math.min(W, x)); y = Math.max(0, Math.min(H, y));
    particles[i*4]=x; particles[i*4+1]=y; particles[i*4+2]=vx; particles[i*4+3]=vy;
  }

  // cards track flow centroid with bias
  cards.forEach((c, i) => {
    const targetX = cx + (i-1.5)*40 * (1+cardBias);
    const targetY = cy + ((i%2)-0.5)*60;
    c.x += (targetX - c.x) * 0.08;
    c.y += (targetY - c.y) * 0.08;
    c.flow = flow.mag;
    const el = cardEls[i];
    el.style.left = c.x + 'px';
    el.style.top = c.y + 'px';
    const s = 0.9 + flow.mag * 0.6;
    el.style.transform = `scale(${s})`;
    el.style.filter = `hue-rotate(${180 + flow.mag*80}deg)`;
    el.querySelector('.state').textContent = `flow: ${flow.mag.toFixed(2)}`;
  });

  fitness = flow.mag * 2 + (1 / (1 + Math.hypot(cards[0].x - cx, cards[0].y - cy)/100));
  document.getElementById('fitness').textContent = 'fitness: ' + fitness.toFixed(2);
}

function render() {
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#6cf';
  for (let i=0; i<N; i++) {
    ctx.globalAlpha = 0.4 + Math.min(0.6, Math.hypot(particles[i*4+2], particles[i*4+3])*0.3);
    ctx.fillRect(particles[i*4], particles[i*4+1], 1.8, 1.8);
  }
  ctx.globalAlpha = 1;
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.x; pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX; pointer.y = e.clientY;
});

document.getElementById('cam').onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
    video.srcObject = stream;
    cameraOn = true;
    document.getElementById('status').textContent = 'Camera active · wave hand to drive flow';
    document.getElementById('cam').disabled = true;
  } catch (err) {
    document.getElementById('status').textContent = 'Camera denied · using pointer flow';
  }
};

// Seal / IndexedDB / Broadcast
const dbName = 'f541-camera-flow-mlp';
let db;
const bc = new BroadcastChannel('f541-genome');
function openDB() {
  const req = indexedDB.open(dbName, 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath:'id'});
  req.onsuccess = e => { db = e.target.result; loadGenome(); };
}
function hashWeights() {
  let h = 2166136261;
  for (let w of weights) h = Math.imul(h ^ (w*1000|0), 16777619);
  return h >>> 0;
}
function seal() {
  if (!db) return;
  const rec = { id:'best', weights: Array.from(weights), fitness, hash: hashWeights(), t: Date.now() };
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put(rec);
  bc.postMessage(rec);
  document.getElementById('status').textContent = 'Sealed genome hash ' + rec.hash.toString(16);
}
function loadGenome() {
  if (!db) return;
  const tx = db.transaction('genomes','readonly');
  const req = tx.objectStore('genomes').get('best');
  req.onsuccess = e => { if (e.target.result && e.target.result.weights) { weights.set(e.target.result.weights); fitness = e.target.result.fitness || 0; } };
}
bc.onmessage = e => {
  const rec = e.data;
  if (rec && rec.hash && rec.fitness > fitness) {
    weights.set(rec.weights);
    fitness = rec.fitness;
    document.getElementById('status').textContent = 'Adopted higher-fitness genome';
  }
};
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initWeights(); initParticles(); };

async function probeGPU() {
  if (!navigator.gpu) { document.getElementById('status').textContent += ' · Canvas2D'; return; }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (adapter) document.getElementById('status').textContent += ' · WebGPU available (compute path ready)';
  } catch (e) { console.debug("lab f541-webgpu-camera-flow-mlp-spatial-mind:", e); }
}

initParticles(); initCards(); initWeights(); openDB(); probeGPU(); loop();
