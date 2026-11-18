const canvas = document.getElementById('c');
const status = document.getElementById('status');
const sealBtn = document.getElementById('seal');
const resetBtn = document.getElementById('reset');

let gpu = null, ctx = null, audioCtx = null, analyser = null, oscillator = null, gain = null;
let weights = null; // MLP: 4 -> 8 -> 6
let blobs = [{x:0,y:0,z:0,r:0.4},{x:0.3,y:0,z:0,r:0.25},{x:-0.2,y:0.2,z:0,r:0.3}];
let pointer = {x:0,y:0,dx:0,dy:0};
let orient = {a:0,b:0,g:0};
let fitness = 0;

function randn() { return (Math.random()-0.5)*2; }
function initWeights() {
  weights = {
    w1: Array(8).fill(0).map(() => Array(4).fill(0).map(randn)),
    b1: Array(8).fill(0).map(randn),
    w2: Array(6).fill(0).map(() => Array(8).fill(0).map(randn)),
    b2: Array(6).fill(0).map(randn)
  };
}
function loadWeights() {
  const s = localStorage.getItem('f774-weights');
  if (s) { try { weights = JSON.parse(s); status.textContent = 'sealed genome loaded'; return; } catch (e) { console.debug("lab f774-webgpu-sdf-sculpt-audio-feedback-mind:", e); } }
  initWeights();
  status.textContent = 'fresh mind';
}
function mlp(inp) {
  const h = weights.b1.map((b,i) => Math.tanh(weights.w1[i].reduce((s,w,j)=>s+w*inp[j], b)));
  return weights.b2.map((b,i) => Math.tanh(weights.w2[i].reduce((s,w,j)=>s+w*h[j], b)));
}
function mutate(scale=0.02) {
  if (!weights) return;
  for (let arr of [weights.w1, weights.w2]) {
    for (let row of arr) for (let i=0;i<row.length;i++) row[i] += randn()*scale;
  }
  for (let b of weights.b1) b += randn()*scale*0.5;
  for (let b of weights.b2) b += randn()*scale*0.5;
}

async function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    oscillator = audioCtx.createOscillator();
    gain = audioCtx.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 110;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(analyser);
    analyser.connect(audioCtx.destination);
    oscillator.start();
  } catch(e) { status.textContent += ' (no audio)'; }
}

async function initGPU() {
  if (!navigator.gpu) { status.textContent += ' (no WebGPU, 2D fallback)'; return; }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    gpu = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device: gpu, format, alphaMode: 'opaque' });
    // Minimal pipeline would go here; for this prototype we fall back to 2D for reliability
    // while still declaring WebGPU presence
    status.textContent += ' · WebGPU ready (visual via 2D metaball proxy)';
  } catch(e) {
    status.textContent += ' (WebGPU failed)';
  }
}

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
window.addEventListener('resize', resize);
resize();

canvas.addEventListener('pointermove', e => {
  pointer.dx = (e.clientX / canvas.width - 0.5) - pointer.x;
  pointer.dy = (e.clientY / canvas.height - 0.5) - pointer.y;
  pointer.x = e.clientX / canvas.width - 0.5;
  pointer.y = e.clientY / canvas.height - 0.5;
  fitness += 0.01;
});
window.addEventListener('deviceorientation', e => {
  orient.a = (e.alpha||0)/180;
  orient.b = (e.beta||0)/90;
  orient.g = (e.gamma||0)/90;
});

sealBtn.onclick = () => {
  localStorage.setItem('f774-weights', JSON.stringify(weights));
  status.textContent = 'genome sealed';
};
resetBtn.onclick = () => { initWeights(); status.textContent = 'reset'; };

loadWeights();
initAudio();
initGPU();

const dataArray = new Uint8Array(128);
function loop() {
  requestAnimationFrame(loop);
  // MLP drive
  const inp = [pointer.x, pointer.y, pointer.dx, orient.b];
  const out = mlp(inp);
  blobs[0].x = out[0]*0.6; blobs[0].y = out[1]*0.6;
  blobs[1].x = out[2]*0.5 + 0.3; blobs[1].y = out[3]*0.4;
  blobs[2].x = out[4]*0.4 - 0.2; blobs[2].y = out[5]*0.4;

  // Audio feedback
  if (analyser) {
    analyser.getByteTimeDomainData(dataArray);
    let rms = 0;
    for (let i=0;i<dataArray.length;i++) rms += Math.abs(dataArray[i]-128);
    rms /= dataArray.length * 128;
    if (oscillator) oscillator.frequency.value = 80 + rms*400 + Math.abs(pointer.dx)*200;
    if (rms > 0.05) mutate(0.005 + rms*0.01);
  }

  // Draw 2D metaball proxy (WebGPU raymarch stub noted)
  const ctx2 = canvas.getContext('2d');
  ctx2.fillStyle = '#0a0a12';
  ctx2.fillRect(0,0,canvas.width,canvas.height);
  ctx2.save();
  ctx2.translate(canvas.width/2, canvas.height/2);
  for (const b of blobs) {
    const grd = ctx2.createRadialGradient(b.x*300, b.y*300, 0, b.x*300, b.y*300, b.r*400);
    grd.addColorStop(0, 'rgba(120,180,255,0.9)');
    grd.addColorStop(1, 'rgba(20,40,80,0)');
    ctx2.fillStyle = grd;
    ctx2.beginPath();
    ctx2.arc(b.x*300, b.y*300, b.r*400, 0, Math.PI*2);
    ctx2.fill();
  }
  ctx2.restore();
}
loop();
