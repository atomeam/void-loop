const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W, H, particles = [], bestPolicy = [0.5, 0.5], entropy = 0.3;
let analyser, data, micOn = false, audioCtx;

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

// Simple MLP forward (weights flat: 3*6 + 6*2 = 30)
function mlp(obs, w) {
  const h = new Float32Array(6);
  for (let i = 0; i < 6; i++) {
    let s = 0;
    for (let j = 0; j < 3; j++) s += obs[j] * w[i*3 + j];
    h[i] = Math.tanh(s);
  }
  const o = [0, 0];
  for (let i = 0; i < 2; i++) {
    let s = 0;
    for (let j = 0; j < 6; j++) s += h[j] * w[18 + i*6 + j];
    o[i] = Math.tanh(s);
  }
  return o;
}

// Particle system
function initParticles() {
  particles = Array.from({length: 400}, () => ({
    x: Math.random()*W, y: Math.random()*H,
    vx: 0, vy: 0, life: Math.random()
  }));
}
initParticles();

function stepParticles() {
  const [emit, speed] = bestPolicy;
  for (const p of particles) {
    p.vx += (Math.random()-0.5)*speed*0.4;
    p.vy += (Math.random()-0.5)*speed*0.4;
    p.vx *= 0.98; p.vy *= 0.98;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -1;
    if (p.y < 0 || p.y > H) p.vy *= -1;
    p.life += emit * 0.01;
    if (p.life > 1) p.life = 0;
  }
}

function draw() {
  ctx.fillStyle = `hsla(${getComputedStyle(document.documentElement).getPropertyValue('--hue')}, 30%, 10%, 0.15)`;
  ctx.fillRect(0, 0, W, H);
  for (const p of particles) {
    ctx.fillStyle = `hsla(${200 + entropy*80}, 70%, ${50 + p.life*30}%, ${0.4 + p.life*0.4})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + p.life*2, 0, Math.PI*2);
    ctx.fill();
  }
  requestAnimationFrame(loop);
}

let lastCentroid = 0.5;
function spectralFeatures(buf) {
  let sum = 0, weighted = 0, rms = 0;
  for (let i = 0; i < buf.length; i++) {
    const mag = buf[i];
    sum += mag;
    weighted += mag * i;
    rms += mag * mag;
  }
  const centroid = sum > 0 ? weighted / sum / buf.length : 0.5;
  const flux = Math.abs(centroid - lastCentroid);
  lastCentroid = centroid;
  rms = Math.sqrt(rms / buf.length) / 255;
  return [centroid, flux, rms];
}

// Worker for evolution
const workerCode = `
let pop = Array.from({length: 12}, () => {
  const w = new Float32Array(30);
  for (let i = 0; i < 30; i++) w[i] = (Math.random()-0.5)*0.5;
  return {w, fit: 0};
});
function mlp(obs, w) {
  const h = new Float32Array(6);
  for (let i = 0; i < 6; i++) {
    let s = 0;
    for (let j = 0; j < 3; j++) s += obs[j] * w[i*3 + j];
    h[i] = Math.tanh(s);
  }
  const o = [0, 0];
  for (let i = 0; i < 2; i++) {
    let s = 0;
    for (let j = 0; j < 6; j++) s += h[j] * w[18 + i*6 + j];
    o[i] = Math.tanh(s);
  }
  return o;
}
onmessage = e => {
  if (e.data.type === 'obs') {
    const obs = e.data.obs;
    const residual = e.data.residual;
    for (const ind of pop) {
      const pred = mlp(obs, ind.w);
      const res = Math.abs(pred[0] - residual); // predict residual direction proxy
      ind.fit = -res + (Math.random()*0.01);
    }
    pop.sort((a,b) => b.fit - a.fit);
    // mutate top half
    for (let i = 6; i < 12; i++) {
      pop[i].w = new Float32Array(pop[i%6].w);
      for (let j = 0; j < 30; j++) if (Math.random() < 0.1) pop[i].w[j] += (Math.random()-0.5)*0.2;
    }
    const best = pop[0].w;
    postMessage({type:'policy', policy: [ (best[0]+1)/2, (best[1]+1)/2 ], fit: pop[0].fit});
  } else if (e.data.type === 'get') {
    postMessage({type:'pop', pop: pop.map(p => Array.from(p.w))});
  } else if (e.data.type === 'set') {
    pop = e.data.pop.map(w => ({w: new Float32Array(w), fit: 0}));
  }
};
`;
const blob = new Blob([workerCode], {type:'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = e => {
  if (e.data.type === 'policy') {
    bestPolicy = e.data.policy;
    status.textContent = `fit ${e.data.fit.toFixed(3)} · entropy ${entropy.toFixed(2)}`;
  }
};

async function startMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    audioCtx = new AudioContext();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    data = new Uint8Array(analyser.frequencyBinCount);
    micOn = true;
    status.textContent = 'mic live';
  } catch {
    micOn = false;
    status.textContent = 'mic denied · synthetic';
  }
}
startMic();

let t = 0;
function loop() {
  t++;
  if (t % 4 === 0) {
    let obs;
    if (micOn && analyser) {
      analyser.getByteFrequencyData(data);
      obs = spectralFeatures(data);
    } else {
      obs = [0.4 + Math.sin(t*0.01)*0.2, Math.abs(Math.sin(t*0.03))*0.3, 0.2 + Math.random()*0.1];
    }
    entropy = Math.min(1, obs[1]*2 + obs[2]);
    document.documentElement.style.setProperty('--entropy', entropy.toFixed(2));
    document.documentElement.style.setProperty('--hue', (180 + obs[0]*120).toFixed(0));
    const residual = Math.random() * 0.5; // proxy next
    worker.postMessage({type:'obs', obs, residual});
  }
  stepParticles();
  draw();
}
loop();

// Seal / Restore
const DB = 'f476';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seal');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
document.getElementById('seal').onclick = async () => {
  worker.postMessage({type:'get'});
  worker.onmessage = async e => {
    if (e.data.type === 'pop') {
      const db = await openDB();
      const tx = db.transaction('seal', 'readwrite');
      tx.objectStore('seal').put({pop: e.data.pop, entropy}, 'current');
      status.textContent = 'sealed';
    }
  };
};
document.getElementById('restore').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('seal', 'readonly');
  const req = tx.objectStore('seal').get('current');
  req.onsuccess = () => {
    if (req.result) {
      worker.postMessage({type:'set', pop: req.result.pop});
      status.textContent = 'restored';
    }
  };
};
document.getElementById('mic').onclick = () => startMic();
addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') document.getElementById('seal').click();
  if (e.key === 'r' || e.key === 'R') document.getElementById('restore').click();
});
