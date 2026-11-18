const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 96;
let field = new Float32Array(N*N);
let prev = new Float32Array(N*N);
let vel = new Float32Array(N*N);

function inject(x, y, amp=2.5, r=4) {
  const ix = Math.floor(x / W * N), iy = Math.floor(y / H * N);
  for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
    const px = ix+dx, py = iy+dy;
    if (px<1||px>=N-1||py<1||py>=N-1) continue;
    const d = Math.hypot(dx,dy);
    if (d<=r) field[py*N+px] += amp * Math.exp(-d*d/(r*0.6));
  }
}

canvas.addEventListener('pointerdown', e => inject(e.clientX, e.clientY));

// Simple MLP
const mlp = {
  w1: Array.from({length:4*8}, () => (Math.random()-0.5)*0.3),
  b1: new Float32Array(8),
  w2: Array.from({length:8*2}, () => (Math.random()-0.5)*0.3),
  b2: new Float32Array(2),
  forward(x) {
    const h = new Float32Array(8);
    for (let i=0;i<8;i++) {
      let s = this.b1[i];
      for (let j=0;j<4;j++) s += x[j]*this.w1[j*8+i];
      h[i] = Math.tanh(s);
    }
    const y = new Float32Array(2);
    for (let i=0;i<2;i++) {
      let s = this.b2[i];
      for (let j=0;j<8;j++) s += h[j]*this.w2[j*2+i];
      y[i] = Math.tanh(s);
    }
    return y;
  },
  nudge(x, target) {
    // crude residual update
    const y = this.forward(x);
    const err = [target[0]-y[0], target[1]-y[1]];
    for (let i=0;i<2;i++) this.b2[i] += 0.01 * err[i];
  }
};

// Portals
const portals = [];
for (let i=0;i<4;i++) {
  const d = document.createElement('div');
  d.className = 'portal';
  d.textContent = '•';
  d.style.left = (20+i*18)+'%';
  d.style.top = (30+i*10)+'%';
  document.body.appendChild(d);
  portals.push({el:d, x:parseFloat(d.style.left), y:parseFloat(d.style.top)});
  let dragging=false, ox=0, oy=0;
  d.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX; oy=e.clientY; e.stopPropagation(); });
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - ox, dy = e.clientY - oy;
    ox = e.clientX; oy = e.clientY;
    const rect = d.getBoundingClientRect();
    d.style.left = (rect.left + dx) + 'px';
    d.style.top = (rect.top + dy) + 'px';
    inject(e.clientX, e.clientY, 1.2, 3);
  });
  window.addEventListener('pointerup', () => dragging=false);
}

// Audio: simple Karplus-Strong via ScriptProcessor fallback / oscillator hybrid
let audioCtx, delay, filter, gain, noise;
try {
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  delay = audioCtx.createDelay(1);
  filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  gain = audioCtx.createGain();
  gain.gain.value = 0.08;
  noise = audioCtx.createBufferSource();
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate*0.05, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i=0;i<data.length;i++) data[i] = Math.random()*2-1;
  noise.buffer = buf; noise.loop = true;
  noise.connect(delay); delay.connect(filter); filter.connect(delay); delay.connect(gain); gain.connect(audioCtx.destination);
  noise.start();
} catch(e) { console.warn('audio', e); }

function updateAudio(pluck, damp) {
  if (!delay) return;
  const freq = 110 + pluck * 220;
  delay.delayTime.value = 1 / freq;
  filter.frequency.value = 800 + damp * 2000;
  filter.Q.value = 0.5 + Math.abs(damp)*4;
}

function stepWave() {
  for (let y=1;y<N-1;y++) for (let x=1;x<N-1;x++) {
    const i = y*N+x;
    const lap = field[i-1]+field[i+1]+field[i-N]+field[i+N] - 4*field[i];
    vel[i] += 0.2 * lap;
    vel[i] *= 0.995;
  }
  for (let i=0;i<field.length;i++) {
    prev[i] = field[i];
    field[i] += vel[i];
  }
}

function stats() {
  let e=0, cx=0, cy=0, mx=0, tot=0;
  for (let y=0;y<N;y++) for (let x=0;x<N;x++) {
    const v = Math.abs(field[y*N+x]);
    e += v; tot += v;
    cx += x*v; cy += y*v;
    if (v>mx) mx=v;
  }
  if (tot<1e-6) return [0,0.5,0.5,0];
  return [e/ (N*N), cx/tot/N, cy/tot/N, Math.min(1, mx/4)];
}

function draw() {
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y=0;y<H;y++) {
    const iy = Math.floor(y / H * N);
    for (let x=0;x<W;x++) {
      const ix = Math.floor(x / W * N);
      const v = field[iy*N+ix];
      const a = Math.min(255, Math.abs(v)*60);
      const i = (y*W+x)*4;
      d[i] = v>0 ? a : 0;
      d[i+1] = a*0.6;
      d[i+2] = v<0 ? a : 0;
      d[i+3] = 255;
    }
  }
  ctx.putImageData(img,0,0);
}

function frame() {
  stepWave();
  const s = stats();
  const y = mlp.forward(s);
  updateAudio((y[0]+1)/2, y[1]);
  // crude learning: prefer higher energy near center
  if (s[0] > 0.05) mlp.nudge(s, [0.2, 0]);
  // style portals
  portals.forEach(p => {
    const rect = p.el.getBoundingClientRect();
    const ix = Math.floor(rect.left / W * N), iy = Math.floor(rect.top / H * N);
    const v = Math.abs(field[Math.max(0,Math.min(N-1,iy))*N + Math.max(0,Math.min(N-1,ix))]);
    const sc = 1 + Math.min(1.5, v*0.4);
    p.el.style.transform = `scale(${sc})`;
    p.el.style.background = `hsla(${200+v*40},80%,60%,0.5)`;
  });
  draw();
  requestAnimationFrame(frame);
}
frame();

document.getElementById('seal').onclick = () => {
  const data = { w1: mlp.w1, b1: Array.from(mlp.b1), w2: mlp.w2, b2: Array.from(mlp.b2) };
  localStorage.setItem('f805-genome', JSON.stringify(data));
  document.getElementById('status').textContent = 'sealed ' + Date.now();
};
// load if present
try {
  const saved = JSON.parse(localStorage.getItem('f805-genome')||'null');
  if (saved) { mlp.w1=saved.w1; mlp.b1=new Float32Array(saved.b1); mlp.w2=saved.w2; mlp.b2=new Float32Array(saved.b2); }
} catch (e) { console.debug("lab f805-webaudio-waveguide-webgpu-wavefield-mind:", e); }
