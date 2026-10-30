const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let particles = [];
const N = 400;
let hebbWeights = new Float32Array(16); // 4x4 spectral bins association
let audioCtx, analyser, micStream, dataArray;
let worker = null;
let gpu = null, device = null, pipeline = null; // WebGPU stubs for future

function initParticles() {
  particles = Array.from({length: N}, () => ({
    x: Math.random()*W, y: Math.random()*H,
    vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
    hue: Math.random()*360, size: 2+Math.random()*3
  }));
}

// Simple Hebbian update from spectral bins
function updateHebb(bins) {
  // 4 bins averaged
  const acts = [0,0,0,0];
  for (let i=0; i<bins.length; i++) {
    const b = Math.floor(i / (bins.length/4));
    if (b<4) acts[b] += bins[i];
  }
  for (let i=0; i<4; i++) acts[i] /= (bins.length/4);
  // Outer product like Hebb
  for (let i=0; i<4; i++) for (let j=0; j<4; j++) {
    hebbWeights[i*4+j] = Math.max(0, Math.min(1, hebbWeights[i*4+j] + 0.01 * acts[i]*acts[j]));
  }
}

function step() {
  // Audio if available
  if (analyser) {
    analyser.getByteFrequencyData(dataArray);
    updateHebb(dataArray);
  }
  // Swarm forces from Hebb
  for (let p of particles) {
    let fx=0, fy=0;
    const bin = Math.floor((p.hue/360)*4) % 4;
    for (let q of particles) {
      if (p===q) continue;
      const dx = q.x - p.x, dy = q.y - p.y;
      const d2 = dx*dx + dy*dy + 100;
      const d = Math.sqrt(d2);
      const otherBin = Math.floor((q.hue/360)*4) % 4;
      const w = hebbWeights[bin*4 + otherBin] || 0.1;
      const force = w * 0.5 / d;
      fx += dx / d * force;
      fy += dy / d * force;
    }
    p.vx = (p.vx + fx*0.1) * 0.98;
    p.vy = (p.vy + fy*0.1) * 0.98;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx *= -1;
    if (p.y<0||p.y>H) p.vy *= -1;
    p.hue = (p.hue + 0.2) % 360;
  }
  // Draw
  ctx.fillStyle = 'rgba(10,10,18,0.2)';
  ctx.fillRect(0,0,W,H);
  for (let p of particles) {
    ctx.fillStyle = `hsl(${p.hue},70%,60%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
    ctx.fill();
  }
  // Morph DOM cards based on local density
  morphCards();
  requestAnimationFrame(step);
}

function morphCards() {
  document.querySelectorAll('.card').forEach((card, i) => {
    const rect = card.getBoundingClientRect();
    let density = 0;
    for (let p of particles) {
      if (Math.abs(p.x - rect.left) < 100 && Math.abs(p.y - rect.top) < 60) density++;
    }
    const scale = 0.8 + Math.min(1.5, density / 20);
    const rot = (density % 10) - 5;
    card.style.transform = `scale(${scale}) rotate(${rot}deg)`;
    card.style.opacity = 0.6 + Math.min(0.4, density/50);
  });
}

function createCards() {
  const container = document.getElementById('cards');
  for (let i=0; i<5; i++) {
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = `Thought ${i+1}`;
    card.style.left = (20 + i*15) + '%';
    card.style.top = (30 + (i%2)*20) + '%';
    card.draggable = true;
    let ox, oy;
    card.addEventListener('pointerdown', e => { ox=e.offsetX; oy=e.offsetY; card.setPointerCapture(e.pointerId); });
    card.addEventListener('pointermove', e => {
      if (e.buttons) {
        card.style.left = (e.clientX - ox) + 'px';
        card.style.top = (e.clientY - oy) + 'px';
        // Inject seed near card
        for (let k=0; k<5; k++) {
          particles.push({ x: e.clientX + (Math.random()-0.5)*40, y: e.clientY + (Math.random()-0.5)*40, vx:0, vy:0, hue: Math.random()*360, size:3 });
        }
        if (particles.length > N*1.5) particles.splice(0, particles.length - N);
      }
    });
    container.appendChild(card);
  }
}

document.getElementById('startMic').onclick = async () => {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    document.getElementById('status').textContent = 'Mic active. Speak to train Hebbian associations.';
  } catch(e) { document.getElementById('status').textContent = 'Mic denied: ' + e.message; }
};

document.getElementById('seal').onclick = () => {
  const data = { weights: Array.from(hebbWeights), ts: Date.now() };
  localStorage.setItem('f465-hebb', JSON.stringify(data));
  document.getElementById('status').textContent = 'Sealed Hebbian weights to localStorage.';
};

document.getElementById('load').onclick = () => {
  const raw = localStorage.getItem('f465-hebb');
  if (raw) {
    const data = JSON.parse(raw);
    hebbWeights.set(data.weights);
    document.getElementById('status').textContent = 'Loaded sealed weights.';
  }
};

// WebGPU probe (progressive)
if (navigator.gpu) {
  navigator.gpu.requestAdapter().then(a => a && a.requestDevice().then(d => {
    device = d;
    document.getElementById('status').textContent += ' | WebGPU available (Canvas2D active for prototype).';
  }));
}

initParticles();
createCards();
step();
