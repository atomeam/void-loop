const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const body = document.getElementById('body');
const limbs = [];
const NUM_LIMBS = 6;
for (let i = 0; i < NUM_LIMBS; i++) {
  const el = document.createElement('div');
  el.className = 'limb';
  el.dataset.i = i;
  document.body.appendChild(el);
  limbs.push(el);
  el.addEventListener('pointerdown', (e) => {
    sensory[i] = 1;
    e.preventDefault();
  });
  el.addEventListener('pointerup', () => sensory[i] = 0);
  el.addEventListener('pointermove', (e) => {
    if (e.buttons) sensory[i] = 0.5 + Math.random() * 0.5;
  });
}

let w = canvas.width = window.innerWidth;
let h = canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
});

// Simple RNN state (hidden dim 4)
let hidden = new Float32Array([0.1, 0.2, -0.1, 0.05]);
const W_hh = [0.6, -0.3, 0.2, 0.1, -0.2, 0.5, -0.1, 0.3, 0.1, 0.2, 0.4, -0.2, -0.1, 0.1, -0.3, 0.6]; // 4x4
const W_xh = new Float32Array(4 * 6); // input 6 (pointer x,y,vx,vy, orient, sensory avg)
for (let i = 0; i < W_xh.length; i++) W_xh[i] = (Math.random() - 0.5) * 0.4;

let pointer = {x: w/2, y: h/2, vx: 0, vy: 0};
let orient = {beta: 0, gamma: 0};
let sensory = new Float32Array(NUM_LIMBS);
let energy = 0;

document.addEventListener('pointermove', (e) => {
  const nx = e.clientX, ny = e.clientY;
  pointer.vx = (nx - pointer.x) * 0.1;
  pointer.vy = (ny - pointer.y) * 0.1;
  pointer.x = nx;
  pointer.y = ny;
});

document.getElementById('orient').onclick = () => {
  if (window.DeviceOrientationEvent) {
    DeviceOrientationEvent.requestPermission?.().then(p => {
      if (p === 'granted' || !DeviceOrientationEvent.requestPermission) {
        window.addEventListener('deviceorientation', (e) => {
          orient.beta = (e.beta || 0) / 90;
          orient.gamma = (e.gamma || 0) / 90;
        });
      }
    });
  }
};

function stepRNN() {
  const input = [
    (pointer.x / w - 0.5) * 2,
    (pointer.y / h - 0.5) * 2,
    pointer.vx / 10,
    pointer.vy / 10,
    orient.gamma,
    sensory.reduce((a,b)=>a+b,0) / NUM_LIMBS
  ];
  const newH = new Float32Array(4);
  for (let i = 0; i < 4; i++) {
    let s = 0;
    for (let j = 0; j < 4; j++) s += W_hh[i*4 + j] * hidden[j];
    for (let j = 0; j < 6; j++) s += W_xh[i*6 + j] * input[j];
    newH[i] = Math.tanh(s);
  }
  hidden = newH;
  energy = Math.abs(hidden[0]) + Math.abs(hidden[1]);
  document.documentElement.style.setProperty('--hue', 180 + hidden[2] * 120);
  document.documentElement.style.setProperty('--energy', Math.min(1, energy));
  document.documentElement.style.setProperty('--scale', 0.98 + energy * 0.04);
  document.getElementById('hval').textContent = hidden[0].toFixed(2);
  document.getElementById('eval').textContent = energy.toFixed(2);
}

// Field particles for viz
const particles = Array.from({length: 200}, () => ({
  x: Math.random() * w,
  y: Math.random() * h,
  vx: 0, vy: 0
}));

function draw() {
  stepRNN();
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0, 0, w, h);
  // update limbs
  limbs.forEach((el, i) => {
    const angle = (i / NUM_LIMBS) * Math.PI * 2 + hidden[i % 4] * 0.8;
    const len = 40 + Math.abs(hidden[(i+1)%4]) * 120 + sensory[i] * 40;
    el.style.height = len + 'px';
    el.style.transform = `translate(-50%, -100%) rotate(${angle}rad)`;
    el.style.opacity = 0.6 + sensory[i] * 0.4;
  });
  // particles attracted to body + limbs influence
  particles.forEach(p => {
    const dx = w/2 - p.x, dy = h/2 - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    p.vx += (dx / dist) * energy * 0.2 + (Math.random()-0.5)*0.1;
    p.vy += (dy / dist) * energy * 0.2 + (Math.random()-0.5)*0.1;
    p.vx *= 0.95; p.vy *= 0.95;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > w) p.vx *= -1;
    if (p.y < 0 || p.y > h) p.vy *= -1;
    ctx.fillStyle = `hsla(${180 + hidden[0]*60}, 70%, 60%, 0.6)`;
    ctx.fillRect(p.x, p.y, 2, 2);
  });
  requestAnimationFrame(draw);
}
draw();

document.getElementById('seal').onclick = async () => {
  const state = { hidden: Array.from(hidden), energy, t: Date.now() };
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('F201', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seals');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = db.transaction('seals', 'readwrite');
  tx.objectStore('seals').put(state, 'latest');
  alert('Sealed to IndexedDB');
};
