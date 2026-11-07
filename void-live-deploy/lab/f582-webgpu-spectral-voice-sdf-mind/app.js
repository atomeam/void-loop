const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const portalsEl = document.getElementById('portals');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let analyser, dataArray, micStream;
let spectrum = new Float32Array(64);
let genomes = Array.from({length:16}, () => ({
  radii: [0.3+Math.random()*0.4, 0.2+Math.random()*0.3],
  offsets: [Math.random()*2-1, Math.random()*2-1],
  freqs: [1+Math.random()*3, 0.5+Math.random()*2],
  fitness: 0
}));
let bestGenome = genomes[0];
let resonance = 0;

function updateSpectrum() {
  if (analyser) {
    analyser.getFloatFrequencyData(dataArray);
    for (let i=0; i<spectrum.length; i++) spectrum[i] = (dataArray[i] + 100) / 100;
  } else {
    const v = document.getElementById('specSlider').value / 100;
    for (let i=0; i<spectrum.length; i++) spectrum[i] = v * (0.5 + 0.5*Math.sin(i*0.3 + performance.now()/1000));
  }
}

function evolve() {
  const centroid = spectrum.reduce((s,v,i)=>s+v*i,0) / (spectrum.reduce((s,v)=>s+v,0)+1e-6);
  genomes.forEach(g => {
    const match = 1 - Math.abs(g.freqs[0]/4 - centroid/64);
    g.fitness = match * spectrum.slice(0,8).reduce((s,v)=>s+v,0);
  });
  genomes.sort((a,b)=>b.fitness - a.fitness);
  bestGenome = genomes[0];
  resonance = bestGenome.fitness;
  for (let i=8; i<genomes.length; i++) {
    const g = genomes[i];
    g.radii[0] = bestGenome.radii[0] + (Math.random()-0.5)*0.1;
    g.radii[1] = bestGenome.radii[1] + (Math.random()-0.5)*0.1;
    g.freqs[0] = bestGenome.freqs[0] + (Math.random()-0.5)*0.3;
    g.offsets[0] = bestGenome.offsets[0] + (Math.random()-0.5)*0.2;
  }
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const cx = W/2, cy = H/2;
  for (let r=20; r<Math.min(W,H)/2; r+=8) {
    const bin = Math.floor((r / (Math.min(W,H)/2)) * spectrum.length);
    const amp = spectrum[bin] || 0;
    const mod = bestGenome.radii[0] * (1 + amp * bestGenome.freqs[0]);
    ctx.beginPath();
    ctx.arc(cx + bestGenome.offsets[0]*100, cy + bestGenome.offsets[1]*50, r * mod, 0, Math.PI*2);
    ctx.strokeStyle = `hsla(${200 + amp*60}, 80%, ${40+amp*30}%, ${0.15+amp*0.4})`;
    ctx.lineWidth = 1 + amp*2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 30 + resonance*40, 0, Math.PI*2);
  ctx.fillStyle = `rgba(100,180,255,${0.1+resonance*0.3})`;
  ctx.fill();
}

function updatePortals() {
  portalsEl.innerHTML = '';
  const peaks = [];
  for (let i=0; i<6; i++) {
    const bin = Math.floor(i * spectrum.length / 6);
    peaks.push({i, amp: spectrum[bin] || 0});
  }
  peaks.sort((a,b)=>b.amp - a.amp);
  peaks.slice(0,6).forEach((p, idx) => {
    const el = document.createElement('div');
    el.className = 'portal';
    const ang = (idx / 6) * Math.PI*2 + performance.now()/2000;
    const dist = 120 + p.amp * 150;
    el.style.left = (W/2 + Math.cos(ang)*dist - 30) + 'px';
    el.style.top = (H/2 + Math.sin(ang)*dist - 30) + 'px';
    el.style.transform = `scale(${0.6 + p.amp*1.4})`;
    el.style.opacity = 0.4 + p.amp*0.6;
    el.style.background = `radial-gradient(circle, hsl(${180+p.i*20},90%,70%) 0%, transparent 70%)`;
    portalsEl.appendChild(el);
  });
}

async function startMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({audio:true});
    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(micStream);
    analyser = ac.createAnalyser();
    analyser.fftSize = 128;
    dataArray = new Float32Array(analyser.frequencyBinCount);
    src.connect(analyser);
    status.textContent = 'Mic active. Speak or hum to sculpt.';
  } catch(e) {
    status.textContent = 'Mic denied. Using slider.';
  }
}

function seal() {
  const genome = {...bestGenome, resonance, ts: Date.now()};
  localStorage.setItem('verse-f582-genome', JSON.stringify(genome));
  status.textContent = `Sealed. Fitness ${resonance.toFixed(2)}`;
}

function restore() {
  const raw = localStorage.getItem('verse-f582-genome');
  if (raw) {
    const g = JSON.parse(raw);
    bestGenome = g;
    genomes[0] = g;
    status.textContent = 'Restored sealed vocal mind.';
  }
}

document.getElementById('startMic').onclick = startMic;
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('clear').onclick = () => { localStorage.removeItem('verse-f582-genome'); status.textContent='Cleared.'; };

function loop() {
  updateSpectrum();
  evolve();
  draw();
  updatePortals();
  requestAnimationFrame(loop);
}
loop();
