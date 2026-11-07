const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 128;
const scale = Math.min(W, H) / N;
let A = new Float32Array(N*N), B = new Float32Array(N*N);
for (let i = 0; i < N*N; i++) { A[i] = 1; B[i] = 0; }
// seed center
for (let y = 50; y < 78; y++) for (let x = 50; x < 78; x++) B[y*N+x] = 0.8;

let feed = 0.037, kill = 0.060;
let speechEnergy = 0, lastToken = 'verse', tiltX = 0, tiltY = 0;
const plants = [];

function idx(x,y){ return ((y+N)%N)*N + ((x+N)%N); }

function stepNCA() {
  const nextA = new Float32Array(N*N), nextB = new Float32Array(N*N);
  const f = feed + (speechEnergy - 0.5)*0.01 + tiltX*0.005;
  const k = kill + (Math.abs(tiltY)*0.008);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y*N+x;
    const a = A[i], b = B[i];
    let lapA = -a, lapB = -b;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx||dy) { const j = idx(x+dx,y+dy); lapA += A[j]/8; lapB += B[j]/8; }
    }
    const abb = a*b*b;
    nextA[i] = a + (0.2*lapA - abb + f*(1-a));
    nextB[i] = b + (0.1*lapB + abb - (k+f)*b);
    nextA[i] = Math.max(0, Math.min(1, nextA[i]));
    nextB[i] = Math.max(0, Math.min(1, nextB[i]));
  }
  A = nextA; B = nextB;
}

function render() {
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < N*N; i++) {
    const v = B[i];
    img.data[i*4] = Math.floor(v*80);
    img.data[i*4+1] = Math.floor(v*180 + A[i]*40);
    img.data[i*4+2] = Math.floor(120 + v*100);
    img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(canvas, 0, 0, N, N, 0, 0, W, H); // stretch
}

function updatePlants() {
  if (plants.length < 8 && Math.random() < 0.02) {
    let best = 0, bx = 64, by = 64;
    for (let t = 0; t < 40; t++) {
      const x = Math.floor(Math.random()*N), y = Math.floor(Math.random()*N);
      if (B[y*N+x] > best) { best = B[y*N+x]; bx = x; by = y; }
    }
    if (best > 0.4) {
      const el = document.createElement('div');
      el.className = 'plant';
      el.textContent = lastToken;
      document.body.appendChild(el);
      plants.push({ el, x: bx, y: by, token: lastToken });
    }
  }
  plants.forEach(p => {
    let bx = p.x, by = p.y, best = B[Math.floor(p.y)*N + Math.floor(p.x)];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = (Math.floor(p.x) + dx + N) % N, ny = (Math.floor(p.y) + dy + N) % N;
      if (B[ny*N+nx] > best) { best = B[ny*N+nx]; bx = nx; by = ny; }
    }
    p.x += (bx - p.x) * 0.05; p.y += (by - p.y) * 0.05;
    const px = p.x * (W/N), py = p.y * (H/N);
    const act = B[Math.floor(p.y)*N + Math.floor(p.x)];
    p.el.style.left = (px - 40) + 'px';
    p.el.style.top = (py - 40) + 'px';
    p.el.style.transform = `scale(${0.6 + act}) rotate(${act*40}deg)`;
    p.el.style.background = `hsla(${120 + act*80}, 70%, ${40 + act*30}%, 0.45)`;
  });
}

let drag = null, offX, offY;
document.addEventListener('pointerdown', e => {
  if (e.target.classList.contains('plant')) {
    drag = e.target; offX = e.clientX - parseFloat(drag.style.left || 0); offY = e.clientY - parseFloat(drag.style.top || 0);
  }
});
document.addEventListener('pointermove', e => {
  if (drag) {
    drag.style.left = (e.clientX - offX) + 'px';
    drag.style.top = (e.clientY - offY) + 'px';
    const gx = Math.floor((e.clientX / W) * N), gy = Math.floor((e.clientY / H) * N);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const i = idx(gx+dx, gy+dy);
      B[i] = Math.min(1, B[i] + 0.3 * Math.exp(-(dx*dx+dy*dy)/4));
    }
  }
});
document.addEventListener('pointerup', () => drag = null);

const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec;
if (Speech) {
  rec = new Speech(); rec.continuous = true; rec.interimResults = true;
  rec.onresult = e => {
    const t = e.results[e.results.length-1][0].transcript.trim();
    if (t) { lastToken = t.split(' ').pop(); speechEnergy = 0.7 + Math.random()*0.3; document.getElementById('status').textContent = 'Heard: ' + lastToken; }
  };
  document.getElementById('listen').onclick = () => { rec.start(); document.getElementById('status').textContent = 'Listening…'; };
}

document.getElementById('type').addEventListener('change', e => {
  lastToken = e.target.value || 'verse'; speechEnergy = 0.8;
  const cx = 40 + Math.random()*48, cy = 40 + Math.random()*48;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x-cx, y-cy);
    if (d < 12) B[y*N+x] = Math.min(1, B[y*N+x] + 0.6*(1-d/12));
  }
});

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => { tiltX = (e.beta||0)/90; tiltY = (e.gamma||0)/90; });
}
addEventListener('mousemove', e => { if (Math.abs(tiltX) < 0.01) { tiltX = (e.clientX/W - 0.5)*2; tiltY = (e.clientY/H - 0.5)*2; } });

document.getElementById('seal').onclick = () => {
  localStorage.setItem('f575-seed', JSON.stringify({ feed, kill, lastToken }));
  document.getElementById('status').textContent = 'Sealed to localStorage';
};

function loop() {
  stepNCA();
  render();
  updatePlants();
  speechEnergy *= 0.98;
  requestAnimationFrame(loop);
}
loop();
