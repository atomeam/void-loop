const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start');
const sealBtn = document.getElementById('seal');
const loadBtn = document.getElementById('load');

let audioCtx, analyser, oscs = [], gains = [];
let worker, running = false;
let particles = [];
let cards = [];
let genome = null;
let fitness = 0;
let gen = 0;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

// Simple MLP in main or via worker
function createWorker() {
  const code = `
    let W1 = [], b1 = [], W2 = [], b2 = [];
    function init(g) {
      // 9->8->4
      W1 = g.W1 || Array.from({length:72}, () => Math.random()*0.4-0.2);
      b1 = g.b1 || Array.from({length:8}, () => Math.random()*0.2-0.1);
      W2 = g.W2 || Array.from({length:32}, () => Math.random()*0.4-0.2);
      b2 = g.b2 || Array.from({length:4}, () => Math.random()*0.2-0.1);
    }
    function forward(x) {
      const h = b1.map((b,i) => {
        let s = b;
        for(let j=0;j<9;j++) s += x[j]*W1[i*9+j];
        return Math.tanh(s);
      });
      const y = b2.map((b,i) => {
        let s = b;
        for(let j=0;j<8;j++) s += h[j]*W2[i*8+j];
        return Math.tanh(s);
      });
      return {y, h};
    }
    self.onmessage = e => {
      if(e.data.type === 'init') { init(e.data.genome); self.postMessage({type:'ready'}); }
      if(e.data.type === 'step') {
        const {spectrum, residual} = e.data;
        const x = [...spectrum.slice(0,8), residual || 0];
        const {y, h} = forward(x);
        self.postMessage({type:'out', y, h, residual});
      }
    };
  `;
  const blob = new Blob([code], {type:'application/javascript'});
  return new Worker(URL.createObjectURL(blob));
}

function initParticles() {
  particles = Array.from({length: 36}, () => ({
    x: Math.random()*canvas.width,
    y: Math.random()*canvas.height,
    vx: 0, vy: 0,
    life: 1
  }));
}

function initCards() {
  cards = Array.from({length: 4}, (_,i) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = 'Agent card ' + (i+1);
    el.style.left = (20 + i*160) + 'px';
    el.style.top = (innerHeight/2) + 'px';
    document.body.appendChild(el);
    let dragging = false, ox=0, oy=0;
    el.addEventListener('pointerdown', e => { dragging=true; ox=e.offsetX; oy=e.offsetY; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => { if(dragging){ el.style.left=(e.clientX-ox)+'px'; el.style.top=(e.clientY-oy)+'px'; } });
    el.addEventListener('pointerup', e => { if(dragging){ dragging=false; fitness += 0.5; statusEl.textContent = 'Reward injected. Fitness: ' + fitness.toFixed(1); } });
    return {el, x: parseFloat(el.style.left), y: parseFloat(el.style.top)};
  });
}

async function startAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  for(let i=0; i<4; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 120 + i*80;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(analyser);
    osc.start();
    oscs.push(osc);
    gains.push(gain);
  }
  analyser.connect(audioCtx.destination);
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  running = true;
  startBtn.disabled = true;
  sealBtn.disabled = false;
  statusEl.textContent = 'Self-listening loop active.';
  loop();
}

function getSpectrum() {
  const bins = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(bins);
  return Array.from(bins).map(b => b/255);
}

function updateParticles(forces) {
  particles.forEach((p,i) => {
    const f = forces[i % 4] || 0;
    p.vx += (Math.random()-0.5)*0.2 + f*0.5;
    p.vy += (Math.random()-0.5)*0.2 + (forces[(i+1)%4]||0)*0.5;
    p.vx *= 0.98; p.vy *= 0.98;
    p.x += p.vx; p.y += p.vy;
    if(p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if(p.y < 0 || p.y > canvas.height) p.vy *= -1;
    p.x = Math.max(0, Math.min(canvas.width, p.x));
    p.y = Math.max(0, Math.min(canvas.height, p.y));
  });
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  particles.forEach(p => {
    ctx.fillStyle = `hsla(${200 + p.vx*20}, 70%, 60%, 0.7)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
    ctx.fill();
  });
}

function updateCards(h) {
  cards.forEach((c,i) => {
    const target = particles[(i*9) % particles.length];
    const tx = target.x - 70;
    const ty = target.y - 30;
    c.x += (tx - c.x)*0.05;
    c.y += (ty - c.y)*0.05;
    if(!c.el.matches(':active')) {
      c.el.style.left = c.x + 'px';
      c.el.style.top = c.y + 'px';
    }
    const energy = Math.abs(h[i%h.length] || 0);
    c.el.style.opacity = 0.4 + energy*0.6;
    c.el.style.filter = `hue-rotate(${energy*90}deg)`;
    c.el.textContent = `State ${i}: ${energy.toFixed(2)}`;
  });
}

let lastOut = {y:[0,0,0,0], h:[0,0,0,0]};
function loop() {
  if(!running) return;
  const spectrum = getSpectrum();
  const residual = spectrum.reduce((a,b)=>a+b,0)/spectrum.length - 0.2;
  if(worker) worker.postMessage({type:'step', spectrum, residual});
  // apply last
  lastOut.y.forEach((dy,i) => {
    if(oscs[i]) {
      const base = 100 + i*60;
      oscs[i].frequency.setTargetAtTime(base + dy*80, audioCtx.currentTime, 0.05);
      gains[i].gain.setTargetAtTime(0.04 + Math.abs(dy)*0.06, audioCtx.currentTime, 0.05);
    }
  });
  updateParticles(lastOut.y);
  draw();
  updateCards(lastOut.h);
  requestAnimationFrame(loop);
}

worker = createWorker();
worker.onmessage = e => {
  if(e.data.type === 'ready') statusEl.textContent += ' Worker ready.';
  if(e.data.type === 'out') lastOut = e.data;
};
const initialGenome = {W1: null, b1: null, W2: null, b2: null};
worker.postMessage({type:'init', genome: initialGenome});

initParticles();
initCards();

startBtn.onclick = startAudio;

sealBtn.onclick = async () => {
  // simple seal of current outputs as proxy for genome
  const data = {fitness, gen: ++gen, seed: Date.now()};
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f290', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal', 'readwrite');
    tx.objectStore('seal').put(data, 'champion');
    statusEl.textContent = 'Sealed champion. Gen ' + gen;
  } catch(e) { statusEl.textContent = 'Seal failed (in-memory).'; }
};

loadBtn.onclick = async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f290', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal', 'readonly');
    const req = tx.objectStore('seal').get('champion');
    req.onsuccess = () => {
      if(req.result) {
        fitness = req.result.fitness || 0;
        gen = req.result.gen || 0;
        statusEl.textContent = 'Loaded champion. Fitness ' + fitness.toFixed(1);
      }
    };
  } catch(e) { statusEl.textContent = 'No prior seal.'; }
};

// initial draw
draw();
