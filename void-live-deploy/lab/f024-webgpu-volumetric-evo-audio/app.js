const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const hudGen = document.getElementById('gen');
const hudFit = document.getElementById('fit');
const hudEnt = document.getElementById('ent');
const hudEdg = document.getElementById('edg');
const hudRegime = document.getElementById('regime');
const statusEl = document.getElementById('status');
const sealsEl = document.getElementById('seals');

let W = 320, H = 320;
let field = new Float32Array(W * H);
let params = { scale: 0.02, octaves: 4, lacunarity: 2.1, persistence: 0.5, warp: 0.3, seed: 1.0 };
let generation = 0, fitness = 0, entropy = 0, edges = 0;
let interaction = 0;
let audioCtx, osc, gain, panner;
let worker = null;
let seals = [];
let orientEnabled = false;
let tiltX = 0, tiltY = 0;

// Simple value noise
function hash(x, y, s) {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = hash(ix, iy, seed);
  const b = hash(ix+1, iy, seed);
  const c = hash(ix, iy+1, seed);
  const d = hash(ix+1, iy+1, seed);
  const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
  return a + (b-a)*ux + (c-a)*uy + (a-b-c+d)*ux*uy;
}
function fbm(x, y, p) {
  let v = 0, a = 1, f = p.scale, max = 0;
  let sx = x, sy = y;
  for (let i = 0; i < p.octaves; i++) {
    v += a * noise(sx, sy, p.seed + i);
    max += a;
    a *= p.persistence;
    f *= p.lacunarity;
    sx *= p.lacunarity;
    sy *= p.lacunarity;
    // simple warp
    sx += p.warp * noise(sy * 0.5, sx * 0.5, p.seed + 10);
    sy += p.warp * noise(sx * 0.5, sy * 0.5, p.seed + 20);
  }
  return v / max;
}

function updateField() {
  const img = ctx.createImageData(W, H);
  const data = img.data;
  let sum = 0, sum2 = 0, edgeCount = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x / W - 0.5) * 4 + tiltX * 0.5;
      const ny = (y / H - 0.5) * 4 + tiltY * 0.5;
      let v = fbm(nx, ny, params);
      v = Math.max(0, Math.min(1, v));
      field[y*W + x] = v;
      sum += v; sum2 += v*v;
      const i = (y*W + x) * 4;
      const c = Math.floor(v * 255);
      data[i] = c * 0.3; data[i+1] = c * 0.6; data[i+2] = c; data[i+3] = 255;
      if (x > 0 && Math.abs(v - field[y*W + x - 1]) > 0.15) edgeCount++;
    }
  }
  ctx.putImageData(img, 0, 0);
  const mean = sum / (W*H);
  const var_ = sum2 / (W*H) - mean*mean;
  entropy = Math.min(1, Math.sqrt(Math.max(0, var_)) * 2.5);
  edges = edgeCount;
  hudEnt.textContent = entropy.toFixed(2);
  hudEdg.textContent = edges;
}

function morphUI() {
  const h = 180 + fitness * 140;
  document.documentElement.style.setProperty('--void-hue', h.toFixed(0));
  document.documentElement.style.setProperty('--void-radius', (8 + fitness * 42).toFixed(0) + 'px');
  document.documentElement.style.setProperty('--void-thick', (1 + fitness * 4).toFixed(1) + 'px');
  document.documentElement.style.setProperty('--void-scale', (0.85 + fitness * 0.35).toFixed(2));
  document.documentElement.style.setProperty('--void-rot', ((fitness - 0.5) * 8).toFixed(1) + 'deg');
  document.body.style.background = `hsl(${h}, 15%, ${8 + fitness * 6}%)`;
  hudRegime.textContent = fitness > 0.6 ? 'structured' : fitness > 0.3 ? 'emergent' : 'diffuse';
}

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  osc = audioCtx.createOscillator();
  gain = audioCtx.createGain();
  panner = audioCtx.createStereoPanner();
  osc.type = 'sine';
  osc.frequency.value = 220;
  gain.gain.value = 0.05;
  osc.connect(gain);
  gain.connect(panner);
  panner.connect(audioCtx.destination);
  osc.start();
}
function updateAudio() {
  if (!audioCtx) return;
  const freq = 180 + entropy * 420 + edges * 0.02;
  osc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);
  gain.gain.setTargetAtTime(0.02 + entropy * 0.08, audioCtx.currentTime, 0.15);
  panner.pan.setTargetAtTime((tiltX || 0) * 0.5, audioCtx.currentTime, 0.1);
}

function startWorker() {
  const code = `
  let pop = [];
  const POP = 6;
  function randGenome() {
    return {
      scale: 0.01 + Math.random()*0.04,
      octaves: 3 + Math.floor(Math.random()*3),
      lacunarity: 1.8 + Math.random()*0.6,
      persistence: 0.4 + Math.random()*0.3,
      warp: Math.random()*0.6,
      seed: Math.random()*100
    };
  }
  function mutate(g) {
    const m = {...g};
    m.scale *= 0.9 + Math.random()*0.2;
    m.lacunarity *= 0.95 + Math.random()*0.1;
    m.persistence = Math.max(0.2, Math.min(0.8, m.persistence + (Math.random()-0.5)*0.1));
    m.warp = Math.max(0, Math.min(1, m.warp + (Math.random()-0.5)*0.15));
    m.seed += (Math.random()-0.5)*5;
    return m;
  }
  for (let i=0;i<POP;i++) pop.push({g: randGenome(), fit: 0});
  self.onmessage = (e) => {
    const {entropy, edges, interaction, gen} = e.data;
    const fit = entropy * (1 + edges/8000) * (1 + interaction*0.3);
    pop[0].fit = fit;
    pop.sort((a,b) => b.fit - a.fit);
    const next = [pop[0], pop[1]];
    while (next.length < POP) {
      const p = pop[Math.floor(Math.random()*3)];
      next.push({g: mutate(p.g), fit: 0});
    }
    pop = next;
    const best = pop[0];
    self.postMessage({genome: best.g, fitness: best.fit, generation: gen+1});
  };
  `;
  const blob = new Blob([code], {type: 'application/javascript'});
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = (e) => {
    const {genome, fitness: f, generation: g} = e.data;
    params = genome;
    fitness = f;
    generation = g;
    hudGen.textContent = generation;
    hudFit.textContent = fitness.toFixed(2);
    statusEl.textContent = `Gen ${generation} · fitness ${fitness.toFixed(2)} · ${hudRegime.textContent}`;
    morphUI();
  };
  statusEl.textContent = 'Mind online · evolving generative volume';
}

function tick() {
  updateField();
  updateAudio();
  if (worker && Math.random() < 0.05) {
    worker.postMessage({entropy, edges, interaction, gen: generation});
    interaction *= 0.95;
  }
  requestAnimationFrame(tick);
}

canvas.addEventListener('pointerdown', initAudio);
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons) {
    interaction = Math.min(1, interaction + 0.05);
  }
});
document.getElementById('clear').onclick = () => {
  params.seed = Math.random()*100;
  interaction = 0;
  statusEl.textContent = 'Field cleared · new seed';
};
document.getElementById('seal').onclick = async () => {
  const payload = JSON.stringify({params, fitness, entropy, ts: Date.now()});
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
  seals.unshift({hash, fitness: fitness.toFixed(2), gen: generation});
  if (seals.length > 5) seals.pop();
  sealsEl.innerHTML = seals.map(s => `<div>${s.hash} · f${s.fitness} g${s.gen}</div>`).join('');
  statusEl.textContent = `Sealed ${hash}`;
  try {
    const req = indexedDB.open('void-vol-seals', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('seals', {keyPath: 'hash'});
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('seals', 'readwrite');
      tx.objectStore('seals').put({hash, payload, ts: Date.now()});
    };
  } catch(e) {}
};
document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') enableOrient();
    });
  } else {
    enableOrient();
  }
};
function enableOrient() {
  orientEnabled = true;
  window.addEventListener('deviceorientation', (e) => {
    tiltX = (e.gamma || 0) / 45;
    tiltY = (e.beta || 0) / 45;
  });
  statusEl.textContent = 'Tilt bias active';
}

startWorker();
tick();
statusEl.textContent = 'Volumetric noise field · local evolutionary mind · spatial audio morph';
