const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const portalsEl = document.getElementById('portals');
const status = document.getElementById('status');
let W = 64, H = 64;
let grid = new Float32Array(W * H);
let next = new Float32Array(W * H);
let orient = {a:0, b:0, g:0};
let pointer = {x:0.5, y:0.5, down:false};
let fitness = 0;

// Reservoir (Echo State)
const N = 32;
let x = new Float32Array(N);
let Wres = new Float32Array(N * N);
let Win = new Float32Array(N * 4);
let Wout = new Float32Array(2 * N); // 2 outputs
function initRes() {
  for (let i = 0; i < N*N; i++) Wres[i] = (Math.random()-0.5)*0.3;
  for (let i = 0; i < N*4; i++) Win[i] = (Math.random()-0.5)*0.5;
  for (let i = 0; i < 2*N; i++) Wout[i] = (Math.random()-0.5)*0.1;
}
initRes();

function stepRes(u) {
  const nx = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let j = 0; j < N; j++) s += Wres[i*N + j] * x[j];
    for (let k = 0; k < 4; k++) s += Win[i*4 + k] * u[k];
    nx[i] = Math.tanh(s);
  }
  x = nx;
  let o0 = 0, o1 = 0;
  for (let i = 0; i < N; i++) {
    o0 += Wout[i] * x[i];
    o1 += Wout[N + i] * x[i];
  }
  return [Math.tanh(o0), Math.tanh(o1)];
}

function hebb(reward) {
  const eta = 0.01 * reward;
  for (let i = 0; i < N; i++) {
    Wout[i] += eta * x[i];
    Wout[N + i] += eta * x[i] * 0.5;
  }
  for (let i = 0; i < 2*N; i++) Wout[i] = Math.max(-1, Math.min(1, Wout[i]));
}

function stepLattice(inject, dirx, diry) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y*W + x;
      let v = grid[i] * 0.92;
      v += (grid[((y-1+H)%H)*W + x] + grid[((y+1)%H)*W + x] + grid[y*W + (x-1+W)%W] + grid[y*W + (x+1)%W]) * 0.02;
      const sx = Math.floor(dirx * 2);
      const sy = Math.floor(diry * 2);
      const si = ((y+sy+H)%H)*W + (x+sx+W)%W;
      v += grid[si] * 0.05;
      next[i] = Math.max(0, Math.min(1, v));
    }
  }
  const ix = Math.floor(pointer.x * W);
  const iy = Math.floor(pointer.y * H);
  const ii = iy*W + ix;
  next[ii] = Math.min(1, next[ii] + inject * 0.3);
  [grid, next] = [next, grid];
}

function resize() {
  cv.width = window.innerWidth;
  cv.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const portals = [];
for (let i = 0; i < 4; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'Portal ' + (i+1);
  el.onclick = () => { fitness++; hebb(1); status.textContent = 'Reinforced! Fitness ' + fitness; };
  portalsEl.appendChild(el);
  portals.push({el, x: Math.random(), y: Math.random()});
}

function findPeaks() {
  const peaks = [];
  for (let i = 0; i < 4; i++) peaks.push({v: -1, x:0, y:0});
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = grid[y*W + x];
      for (let p = 0; p < 4; p++) {
        if (v > peaks[p].v) {
          peaks[p] = {v, x: x/W, y: y/H};
          break;
        }
      }
    }
  }
  return peaks;
}

let t = 0;
function loop() {
  t++;
  const u = [orient.a/180, orient.b/90, orient.g/90, Math.sin(t*0.01)];
  const [inj, dir] = stepRes(u);
  const dirx = Math.cos(dir * Math.PI);
  const diry = Math.sin(dir * Math.PI);
  stepLattice(Math.max(0, inj*0.5 + 0.2), dirx, diry);

  const img = ctx.createImageData(cv.width, cv.height);
  const scaleX = cv.width / W, scaleY = cv.height / H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = grid[y*W + x];
      const c = Math.floor(v * 255);
      for (let py = 0; py < scaleY; py++) {
        for (let px = 0; px < scaleX; px++) {
          const i = ((Math.floor(y*scaleY)+py)*cv.width + Math.floor(x*scaleX)+px) * 4;
          if (i < img.data.length) {
            img.data[i] = c*0.2; img.data[i+1] = c*0.6; img.data[i+2] = c; img.data[i+3] = 255;
          }
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  const peaks = findPeaks();
  portals.forEach((p, i) => {
    const pk = peaks[i] || {x:0.5, y:0.5};
    p.x = p.x * 0.9 + pk.x * 0.1;
    p.y = p.y * 0.9 + pk.y * 0.1;
    p.el.style.left = (p.x * cv.width - 60) + 'px';
    p.el.style.top = (p.y * cv.height - 35) + 'px';
    p.el.textContent = 'Portal ' + (i+1) + '\ndens ' + (peaks[i]?.v||0).toFixed(2);
  });

  requestAnimationFrame(loop);
}
loop();

document.getElementById('perm').onclick = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p === 'granted') status.textContent = 'Orientation enabled';
    } catch(e) { status.textContent = 'Permission failed: ' + e.message; }
  } else {
    status.textContent = 'Orientation available or pointer mode';
  }
};
window.addEventListener('deviceorientation', e => {
  orient.a = e.alpha || 0;
  orient.b = e.beta || 0;
  orient.g = e.gamma || 0;
});
cv.addEventListener('pointerdown', e => { pointer.down = true; updatePointer(e); });
cv.addEventListener('pointermove', e => { if (pointer.down) updatePointer(e); });
window.addEventListener('pointerup', () => pointer.down = false);
function updatePointer(e) {
  const r = cv.getBoundingClientRect();
  pointer.x = (e.clientX - r.left) / r.width;
  pointer.y = (e.clientY - r.top) / r.height;
}

document.getElementById('seal').onclick = () => {
  const genome = {
    Wout: Array.from(Wout),
    fitness,
    timestamp: new Date().toISOString(),
    note: 'F642 orientation reservoir readout'
  };
  const blob = new Blob([JSON.stringify(genome, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'f642-genome.json';
  a.click();
  status.textContent = 'Genome sealed and downloaded';
};
document.getElementById('reset').onclick = () => { initRes(); fitness = 0; status.textContent = 'Weights reset'; };
