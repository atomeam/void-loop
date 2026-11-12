const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const info = document.getElementById('info');
const swatch = document.getElementById('swatch');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight - 60; }
addEventListener('resize', resize); resize();

// Tiny MLP: 3 -> 8 -> 4
class MLP {
  constructor() {
    this.w1 = new Float32Array(3*8); this.b1 = new Float32Array(8);
    this.w2 = new Float32Array(8*4); this.b2 = new Float32Array(4);
    this.randomize();
  }
  randomize() {
    for (let i=0;i<this.w1.length;i++) this.w1[i] = (Math.random()-0.5)*0.5;
    for (let i=0;i<this.w2.length;i++) this.w2[i] = (Math.random()-0.5)*0.5;
    this.b1.fill(0); this.b2.fill(0);
  }
  relu(x) { return x>0?x:0; }
  forward(x) { // x: [3]
    const h = new Float32Array(8);
    for (let j=0;j<8;j++) {
      let s = this.b1[j];
      for (let i=0;i<3;i++) s += x[i]*this.w1[i*8+j];
      h[j] = this.relu(s);
    }
    const y = new Float32Array(4);
    for (let k=0;k<4;k++) {
      let s = this.b2[k];
      for (let j=0;j<8;j++) s += h[j]*this.w2[j*4+k];
      y[k] = Math.tanh(s); // [-1,1]
    }
    return y;
  }
  // Simple GD step toward a target y
  train(x, target, lr=0.01) {
    // Forward with stored h for backprop (simplified, no full graph)
    const h = new Float32Array(8);
    const pre = new Float32Array(8);
    for (let j=0;j<8;j++) {
      let s = this.b1[j];
      for (let i=0;i<3;i++) s += x[i]*this.w1[i*8+j];
      pre[j] = s; h[j] = this.relu(s);
    }
    const y = new Float32Array(4);
    for (let k=0;k<4;k++) {
      let s = this.b2[k];
      for (let j=0;j<8;j++) s += h[j]*this.w2[j*4+k];
      y[k] = Math.tanh(s);
    }
    // Loss grad on y: 2*(y-target) * tanh'
    const dy = new Float32Array(4);
    for (let k=0;k<4;k++) {
      const err = y[k] - target[k];
      dy[k] = err * (1 - y[k]*y[k]);
    }
    // Update w2, b2
    for (let k=0;k<4;k++) {
      this.b2[k] -= lr * dy[k];
      for (let j=0;j<8;j++) this.w2[j*4+k] -= lr * dy[k] * h[j];
    }
    // Back to h
    const dh = new Float32Array(8);
    for (let j=0;j<8;j++) {
      let s = 0;
      for (let k=0;k<4;k++) s += dy[k] * this.w2[j*4+k];
      dh[j] = s * (pre[j]>0?1:0);
    }
    // Update w1, b1
    for (let j=0;j<8;j++) {
      this.b1[j] -= lr * dh[j];
      for (let i=0;i<3;i++) this.w1[i*8+j] -= lr * dh[j] * x[i];
    }
  }
  toJSON() { return {w1:Array.from(this.w1), b1:Array.from(this.b1), w2:Array.from(this.w2), b2:Array.from(this.b2)}; }
  fromJSON(o) {
    this.w1.set(o.w1); this.b1.set(o.b1); this.w2.set(o.w2); this.b2.set(o.b2);
  }
}
const mlp = new MLP();
let lastX = [0.5,0.5,0.5];
let params = [0,0,0.5,0.5]; // hueOff, sat, speed, size

// Particles
const N = 180;
const parts = Array.from({length:N}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
  hue: Math.random()*360
}));

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1),16);
  return [(n>>16)/255, ((n>>8)&255)/255, (n&255)/255];
}

async function sampleColor() {
  if (!window.EyeDropper) {
    const hex = prompt('EyeDropper unsupported. Enter hex color:', '#ff6600');
    if (hex) applyColor(hex);
    return;
  }
  try {
    const ed = new EyeDropper();
    const res = await ed.open();
    applyColor(res.sRGBHex);
  } catch(e) { console.log(e); }
}
function applyColor(hex) {
  swatch.style.background = hex;
  lastX = hexToRgb(hex);
  params = mlp.forward(lastX);
  // Train a bit toward a "nice" target: moderate values
  const target = [params[0]*0.5, 0.3, 0.4, 0.3];
  for (let i=0;i<8;i++) mlp.train(lastX, target, 0.02);
  params = mlp.forward(lastX);
  updateInfo();
  saveWeights();
}
function updateInfo() {
  const norm = Math.sqrt(mlp.w1.reduce((s,v)=>s+v*v,0));
  info.textContent = `MLP |w1|≈${norm.toFixed(2)} · hueOff ${(params[0]*30).toFixed(1)}° · speed×${(1+params[2]).toFixed(2)} · particles ${N}`;
}

function loop() {
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0,0,W,H);
  const hueBase = (lastX[0]*120 + lastX[1]*60 + params[0]*40) % 360;
  const speed = 1 + params[2]*1.5;
  const sz = 2 + params[3]*4;
  for (const p of parts) {
    p.x += p.vx * speed;
    p.y += p.vy * speed;
    if (p.x<0||p.x>W) p.vx*=-1;
    if (p.y<0||p.y>H) p.vy*=-1;
    p.hue = (hueBase + p.x*0.1) % 360;
    ctx.fillStyle = `hsl(${p.hue},70%,60%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, sz, 0, Math.PI*2);
    ctx.fill();
  }
  requestAnimationFrame(loop);
}
loop();

// Persistence
function saveWeights() {
  try {
    localStorage.setItem('f668-mlp', JSON.stringify(mlp.toJSON()));
  } catch (e) { console.debug("lab f668-eyedropper-causal-mlp-webgpu-palette-mind:", e); }
}
function loadWeights() {
  try {
    const s = localStorage.getItem('f668-mlp');
    if (s) { mlp.fromJSON(JSON.parse(s)); updateInfo(); }
  } catch (e) { console.debug("lab f668-eyedropper-causal-mlp-webgpu-palette-mind:", e); }
}
loadWeights();

document.getElementById('sample').onclick = sampleColor;
document.getElementById('train').onclick = () => { for(let i=0;i<5;i++) mlp.train(lastX, [0,0.2,0.3,0.2], 0.01); params=mlp.forward(lastX); updateInfo(); saveWeights(); };
document.getElementById('reset').onclick = () => { mlp.randomize(); params=mlp.forward(lastX); updateInfo(); saveWeights(); };
document.getElementById('save').onclick = saveWeights;

// WebGPU note: in supporting browsers a compute shader could advect the particles; here CPU for universal offline run.
console.log('Color Sampler Mind ready. EyeDropper + local MLP + particle field.');
