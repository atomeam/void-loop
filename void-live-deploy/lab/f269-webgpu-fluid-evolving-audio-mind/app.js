const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, gridW=128, gridH=72, cell=8;
let density = new Float32Array(gridW*gridH);
let vx = new Float32Array(gridW*gridH);
let vy = new Float32Array(gridW*gridH);
let nextD = new Float32Array(gridW*gridH);

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  cell = Math.max(4, Math.floor(Math.min(W/gridW, H/gridH)));
}
resize(); addEventListener('resize', resize);

function stepFluid(dt) {
  for(let y=1;y<gridH-1;y++) for(let x=1;x<gridW-1;x++) {
    const i = y*gridW+x;
    nextD[i] = density[i]*0.92 + (density[i-1]+density[i+1]+density[i-gridW]+density[i+gridW])*0.02;
  }
  density.set(nextD);
  for(let i=0;i<density.length;i++) {
    vx[i] *= 0.98; vy[i] *= 0.98;
    density[i] = Math.max(0, density[i]*0.995);
  }
}

function computeStats() {
  let sum=0, sum2=0, cx=0, cy=0, max=0;
  for(let y=0;y<gridH;y++) for(let x=0;x<gridW;x++) {
    const d = density[y*gridW+x];
    sum += d; sum2 += d*d; cx += x*d; cy += y*d; if(d>max) max=d;
  }
  const mean = sum / density.length;
  const var_ = Math.max(0, sum2/density.length - mean*mean);
  const entropy = -Math.log(mean+0.001)*0.3 + Math.sqrt(var_)*2;
  return {energy: sum/100, entropy: Math.min(1, entropy), centroidX: cx/(sum+1), centroidY: cy/(sum+1), max};
}

const workerCode = `
let genome = [220, 0.5, 0.3, 1.2, 0.4];
let gen = 0;
let bestFit = -Infinity;
self.onmessage = e => {
  if (e.data.type === 'stats') {
    const {energy, entropy} = e.data;
    const targetE = 0.4, targetH = 0.55;
    const fit = 1 / (1 + Math.abs(energy-targetE)*3 + Math.abs(entropy-targetH)*2);
    if (fit > bestFit) { bestFit = fit; }
    else if (Math.random() < 0.3) {
      for(let i=0;i<genome.length;i++) genome[i] += (Math.random()-0.5)* (i===0?20:0.1);
      genome[0] = Math.max(80, Math.min(800, genome[0]));
      genome[1] = Math.max(0, Math.min(1, genome[1]));
      genome[3] = Math.max(0.05, Math.min(0.8, genome[3]));
    }
    gen++;
    self.postMessage({genome, gen, fit, mood: (genome[1]+genome[4])*0.5});
  }
  if (e.data.type === 'seal') self.postMessage({sealed: [...genome], gen});
};
`;
const blob = new Blob([workerCode], {type:'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));
let currentGenome = [220,0.5,0.3,0.4,0.4];
let mood = 0, gen=0;

worker.onmessage = e => {
  if (e.data.genome) {
    currentGenome = e.data.genome;
    mood = e.data.mood || 0;
    gen = e.data.gen || 0;
    document.documentElement.style.setProperty('--mind-mood', mood.toFixed(2));
    document.getElementById('m').textContent = mood.toFixed(2);
    document.getElementById('g').textContent = gen;
    updateAudio();
  }
};

let audioCtx, osc, gain, filter;
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  osc = audioCtx.createOscillator();
  filter = audioCtx.createBiquadFilter();
  gain = audioCtx.createGain();
  osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
  osc.type = 'sawtooth';
  osc.start();
  gain.gain.value = 0.08;
}
function updateAudio() {
  if (!osc) return;
  osc.frequency.setTargetAtTime(currentGenome[0], audioCtx.currentTime, 0.1);
  filter.frequency.setTargetAtTime(200 + currentGenome[2]*2000, audioCtx.currentTime, 0.1);
  gain.gain.setTargetAtTime(currentGenome[3]*0.15, audioCtx.currentTime, 0.05);
}

let pointer = {x:0.5, y:0.5, down:false};
canvas.addEventListener('pointerdown', e => { pointer.down=true; initAudio(); inject(e); });
canvas.addEventListener('pointermove', e => { if(pointer.down) inject(e); });
canvas.addEventListener('pointerup', () => pointer.down=false);
function inject(e) {
  const r = canvas.getBoundingClientRect();
  const gx = Math.floor((e.clientX-r.left)/cell);
  const gy = Math.floor((e.clientY-r.top)/cell);
  if (gx>=0 && gx<gridW && gy>=0 && gy<gridH) {
    const i = gy*gridW+gx;
    density[i] += 0.8;
    vx[i] += (Math.random()-0.5)*2;
    vy[i] += (Math.random()-0.5)*2;
  }
}
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    const bx = (e.gamma||0)/90 * 0.3;
    const by = (e.beta||0)/90 * 0.3;
    const cx = Math.floor(gridW/2 + bx*gridW*0.4);
    const cy = Math.floor(gridH/2 + by*gridH*0.4);
    if (cx>1 && cx<gridW-1 && cy>1 && cy<gridH-1) density[cy*gridW+cx] += 0.15;
  });
}

const orbs = [document.getElementById('o1'), document.getElementById('o2'), document.getElementById('o3')];
function updateOrbs(stats) {
  orbs.forEach((o, i) => {
    const px = (0.2 + i*0.3) * W;
    const py = (0.3 + Math.sin(Date.now()/800 + i)*0.1) * H;
    const gx = Math.floor(px / cell);
    const gy = Math.floor(py / cell);
    const d = density[Math.max(0,Math.min(gridH-1,gy))*gridW + Math.max(0,Math.min(gridW-1,gx))] || 0;
    o.style.left = px + 'px';
    o.style.top = py + 'px';
    o.style.transform = `translate(-50%,-50%) scale(${1 + d*2})`;
    o.style.opacity = 0.4 + d;
  });
}

function render() {
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  for(let y=0;y<gridH;y++) for(let x=0;x<gridW;x++) {
    const d = density[y*gridW+x];
    if (d > 0.02) {
      const hue = 180 + mood*80 + d*60;
      ctx.fillStyle = `hsla(${hue},70%,60%,${Math.min(0.8,d)})`;
      ctx.fillRect(x*cell, y*cell, cell-1, cell-1);
    }
  }
}

let last = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t-last)/1000); last=t;
  stepFluid(dt);
  const stats = computeStats();
  document.getElementById('e').textContent = stats.energy.toFixed(2);
  document.getElementById('h').textContent = stats.entropy.toFixed(2);
  document.documentElement.style.setProperty('--energy', stats.energy);
  document.documentElement.style.setProperty('--entropy', stats.entropy);
  document.documentElement.style.setProperty('--hue', 180 + mood*100);
  worker.postMessage({type:'stats', energy: stats.energy, entropy: stats.entropy});
  updateOrbs(stats);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.getElementById('seal').onclick = () => {
  worker.postMessage({type:'seal'});
  const dbReq = indexedDB.open('F269',1);
  dbReq.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath:'t'});
  dbReq.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({t:Date.now(), genome: currentGenome, gen});
    document.getElementById('status').textContent = 'Genome sealed to IndexedDB';
  };
};

document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { alert('WebXR not available'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['local-floor']});
    document.getElementById('status').textContent = 'XR session started (hand injection stub)';
    session.end();
  } catch(err) { document.getElementById('status').textContent = 'XR failed: ' + err.message; }
};

document.getElementById('mute').onclick = () => {
  if (gain) gain.gain.value = gain.gain.value > 0 ? 0 : 0.1;
};
