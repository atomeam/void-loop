const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const COLS = 24, ROWS = 14;
const field = Array.from({length: ROWS}, () => Array.from({length: COLS}, () => ({x:0, y:0})));
const portals = [];
for (let i = 0; i < 6; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'Portal ' + (i+1);
  el.style.left = (100 + i * 140) + 'px';
  el.style.top = (120 + (i%2)*100) + 'px';
  document.body.appendChild(el);
  portals.push({el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0, dragging:false});
}

let pointer = {x: W/2, y: H/2, down: false};
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
canvas.addEventListener('pointerdown', e => { pointer.down = true; });
canvas.addEventListener('pointerup', e => { pointer.down = false; });

// Simple policy: random weights for demo (4→8→2)
function makePolicy() {
  const w1 = Array.from({length: 8}, () => Array.from({length: 4}, () => (Math.random()-0.5)*0.5));
  const b1 = Array.from({length: 8}, () => (Math.random()-0.5)*0.1);
  const w2 = Array.from({length: 2}, () => Array.from({length: 8}, () => (Math.random()-0.5)*0.5));
  const b2 = Array.from({length: 2}, () => 0);
  return {w1, b1, w2, b2, fitness: 0};
}
let policies = [makePolicy(), makePolicy(), makePolicy()];
let best = policies[0];

function mlp(p, input) {
  const h = p.b1.map((b, i) => Math.tanh(b + p.w1[i].reduce((s, w, j) => s + w * input[j], 0)));
  return p.b2.map((b, i) => b + p.w2[i].reduce((s, w, j) => s + w * h[j], 0));
}

let frame = 0, entropy = 0, fitness = 0;
function step() {
  // Decay + diffusion
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    field[r][c].x *= 0.92; field[r][c].y *= 0.92;
  }
  // Agent injections
  policies.forEach((p, pi) => {
    const cx = (pi / policies.length) * COLS;
    const cy = ROWS / 2;
    const local = [
      field[Math.floor(cy)][Math.floor(cx)].x,
      field[Math.floor(cy)][Math.floor(cx)].y,
      (pointer.x / W - 0.5),
      Math.sin(frame * 0.01)
    ];
    const out = mlp(p, local);
    const fx = Math.tanh(out[0]) * 0.8;
    const fy = Math.tanh(out[1]) * 0.8;
    const r = Math.floor(cy), c = Math.floor(cx);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      field[r][c].x += fx; field[r][c].y += fy;
    }
  });
  // Pointer attractor
  if (pointer.down) {
    const pc = Math.floor(pointer.x / W * COLS);
    const pr = Math.floor(pointer.y / H * ROWS);
    if (pr >= 0 && pr < ROWS && pc >= 0 && pc < COLS) {
      field[pr][pc].x += (pointer.x - W/2) * 0.001;
      field[pr][pc].y += (pointer.y - H/2) * 0.001;
    }
  }
  // Advect portals
  portals.forEach(p => {
    if (p.dragging) return;
    const c = Math.floor(p.x / W * COLS);
    const r = Math.floor(p.y / H * ROWS);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      p.vx += field[r][c].x * 0.4;
      p.vy += field[r][c].y * 0.4;
    }
    p.vx *= 0.85; p.vy *= 0.85;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(20, Math.min(W-140, p.x));
    p.y = Math.max(20, Math.min(H-100, p.y));
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
  });
  // Simple entropy / fitness
  let sum = 0, cnt = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const m = Math.hypot(field[r][c].x, field[r][c].y);
    sum += m; cnt++;
  }
  entropy = sum / cnt;
  fitness = entropy * 10 + portals.reduce((s, p) => s + Math.hypot(p.vx, p.vy), 0);
  // Occasional policy update (simplified)
  if (frame % 60 === 0) {
    policies.forEach(p => p.fitness = fitness + (Math.random()-0.5)*0.2);
    policies.sort((a,b) => b.fitness - a.fitness);
    best = policies[0];
    // Mutate weaker
    for (let i = 1; i < policies.length; i++) {
      policies[i].w2.forEach(row => row.forEach((_, j) => row[j] += (Math.random()-0.5)*0.05));
    }
  }
  frame++;
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(100,180,255,0.35)';
  ctx.lineWidth = 1;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = (c + 0.5) / COLS * W;
    const y = (r + 0.5) / ROWS * H;
    const vx = field[r][c].x * 12;
    const vy = field[r][c].y * 12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + vx, y + vy);
    ctx.stroke();
  }
  document.getElementById('stats').textContent = `entropy: ${entropy.toFixed(3)} fitness: ${fitness.toFixed(2)}`;
}

function loop() { step(); draw(); requestAnimationFrame(loop); }
loop();

// Drag portals
portals.forEach(p => {
  p.el.addEventListener('pointerdown', e => {
    p.dragging = true;
    e.target.setPointerCapture(e.pointerId);
  });
  p.el.addEventListener('pointermove', e => {
    if (!p.dragging) return;
    p.x = e.clientX - 60;
    p.y = e.clientY - 40;
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
    // Inject reverse force
    const c = Math.floor(p.x / W * COLS);
    const r = Math.floor(p.y / H * ROWS);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      field[r][c].x -= e.movementX * 0.02;
      field[r][c].y -= e.movementY * 0.02;
    }
  });
  p.el.addEventListener('pointerup', () => { p.dragging = false; });
});

document.getElementById('seal').onclick = () => {
  const data = {weights: best.w2, fitness, t: Date.now()};
  localStorage.setItem('f519-seal', JSON.stringify(data));
  alert('Genome sealed to localStorage (IndexedDB path reserved). Fitness: ' + fitness.toFixed(2));
};
document.getElementById('reset').onclick = () => { policies = [makePolicy(), makePolicy(), makePolicy()]; };
