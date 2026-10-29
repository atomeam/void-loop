const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

const N = 240;
const agents = Array.from({length: N}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
  ax: 0, ay: 0
}));

let pointer = {x: W/2, y: H/2};
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

// Tiny MLP: 4 inputs -> 6 hidden -> 2 outputs
const IN = 4, HID = 6, OUT = 2;
const GENOME_LEN = IN*HID + HID*OUT;
let genome = Array.from({length: GENOME_LEN}, () => (Math.random()-0.5)*0.8);

function tanh(x) { return Math.tanh(x); }
function relu(x) { return Math.max(0, x); }

function forward(g, inp) {
  // hidden
  const h = [];
  for (let i = 0; i < HID; i++) {
    let s = 0;
    for (let j = 0; j < IN; j++) s += inp[j] * g[i*IN + j];
    h.push(relu(s));
  }
  // out
  const o = [];
  const base = IN*HID;
  for (let i = 0; i < OUT; i++) {
    let s = 0;
    for (let j = 0; j < HID; j++) s += h[j] * g[base + i*HID + j];
    o.push(tanh(s));
  }
  return o;
}

// Worker for evolution
let worker = null;
let bestFit = 0;
try {
  const workerCode = `
    let pop = [];
    const LEN = ${GENOME_LEN};
    function randG() { return Array.from({length:LEN}, () => (Math.random()-0.5)*0.8); }
    function mutate(g, rate=0.15, mag=0.3) {
      return g.map(w => Math.random() < rate ? w + (Math.random()-0.5)*mag : w);
    }
    self.onmessage = e => {
      const { metrics, init } = e.data;
      if (init) {
        pop = Array.from({length:5}, randG);
        postMessage({ genome: pop[0], fit: 0 });
        return;
      }
      // simple fitness from metrics: entropy + pointer response - energy
      const fit = (metrics.entropy || 0) * 0.6 + (metrics.response || 0) * 0.4 - (metrics.energy || 0) * 0.1;
      // replace worst
      if (pop.length < 5) pop.push(randG());
      let worst = 0;
      for (let i = 1; i < pop.length; i++) if (Math.random() < 0.3) worst = i; // crude
      pop[worst] = mutate(pop[0]); // always mutate from current best-ish
      // shuffle a bit
      const best = pop[0];
      postMessage({ genome: best, fit });
    };
  `;
  const blob = new Blob([workerCode], {type: 'application/javascript'});
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = e => {
    genome = e.data.genome;
    bestFit = e.data.fit || bestFit;
  };
  worker.postMessage({ init: true });
} catch (err) {
  console.warn('Worker blocked, using static genome', err);
}

// Audio (after gesture)
let audioCtx = null, oscs = [];
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < 3; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = 120 + i*80;
    g.gain.value = 0.02;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    oscs.push({o, g});
  }
}
canvas.addEventListener('pointerdown', initAudio, {once: true});

let lastMetrics = {entropy:0, response:0, energy:0};
let frame = 0;

function step() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0, 0, W, H);

  let sumSpeed = 0, sumAct = 0;
  const positions = [];

  for (const a of agents) {
    // crude local density (sample nearby)
    let dens = 0;
    for (let k = 0; k < 12; k++) {
      const b = agents[(Math.random()*N)|0];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (dx*dx + dy*dy < 60*60) dens++;
    }
    dens /= 12;
    const pdx = (pointer.x - a.x) / W;
    const pdy = (pointer.y - a.y) / H;
    const align = (a.vx * (pointer.x - a.x) + a.vy * (pointer.y - a.y)) / (Math.hypot(a.vx, a.vy)+0.1) / 200;
    const inp = [dens*2-1, pdx*2, pdy*2, Math.tanh(align)];
    const out = forward(genome, inp);
    a.ax = out[0] * 0.15;
    a.ay = out[1] * 0.15;
    sumAct += Math.abs(out[0]) + Math.abs(out[1]);

    a.vx = (a.vx + a.ax) * 0.98;
    a.vy = (a.vy + a.ay) * 0.98;
    const sp = Math.hypot(a.vx, a.vy);
    if (sp > 3.5) { a.vx *= 3.5/sp; a.vy *= 3.5/sp; }
    a.x += a.vx; a.y += a.vy;
    if (a.x < 0) a.x += W; if (a.x > W) a.x -= W;
    if (a.y < 0) a.y += H; if (a.y > H) a.y -= H;

    sumSpeed += sp;
    positions.push(a.x, a.y);

    ctx.fillStyle = `hsla(${180 + out[0]*60}, 70%, 60%, 0.7)`;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 1.8, 0, Math.PI*2);
    ctx.fill();
  }

  // simple entropy proxy: spatial variance
  let mx=0, my=0;
  for (let i=0; i<positions.length; i+=2) { mx += positions[i]; my += positions[i+1]; }
  mx /= N; my /= N;
  let varx=0, vary=0;
  for (let i=0; i<positions.length; i+=2) {
    varx += (positions[i]-mx)**2; vary += (positions[i+1]-my)**2;
  }
  const entropy = Math.min(1, Math.sqrt(varx+vary)/N / 80);
  const energy = sumSpeed / N / 2;
  const response = Math.min(1, densNearPointer());

  lastMetrics = {entropy, response, energy, activation: sumAct/N};
  document.getElementById('ent').textContent = entropy.toFixed(2);
  document.getElementById('fit').textContent = bestFit.toFixed(2);

  // morph UI
  const m = Math.min(1, entropy * 0.7 + lastMetrics.activation * 0.3);
  document.documentElement.style.setProperty('--hue', (m * 120).toFixed(0));
  document.documentElement.style.setProperty('--blur', (m * 3).toFixed(1) + 'px');
  document.documentElement.style.setProperty('--scale', (1 + m * 0.04).toFixed(3));
  document.documentElement.style.setProperty('--bright', (0.9 + m * 0.3).toFixed(2));

  // audio
  if (oscs.length) {
    oscs[0].o.frequency.value = 80 + entropy * 200;
    oscs[1].o.frequency.value = 140 + energy * 180;
    oscs[2].g.gain.value = 0.01 + m * 0.04;
  }

  if (worker && frame % 60 === 0) {
    worker.postMessage({ metrics: lastMetrics });
  }
  frame++;
  requestAnimationFrame(step);
}

function densNearPointer() {
  let c = 0;
  for (const a of agents) {
    if ((a.x-pointer.x)**2 + (a.y-pointer.y)**2 < 80*80) c++;
  }
  return c / N * 4;
}

step();

// Seal
document.getElementById('seal').onclick = async () => {
  const data = JSON.stringify({genome: genome.slice(0,20), metrics: lastMetrics, t: Date.now()});
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  const hash = Array.from(new Uint8Array(buf)).slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('void-f035', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals', {keyPath: 'id'});
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({id: hash, data, at: Date.now()});
    document.getElementById('seal').textContent = 'sealed ' + hash.slice(0,6);
  } catch(e) { document.getElementById('seal').textContent = 'seal fail'; }
};
