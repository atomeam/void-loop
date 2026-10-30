const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, particles = [], cards = [], energy = 0, policy = { bias: 0.5, sensitivity: 1.0, curiosity: 0.3 };
let orientation = { x: 0, y: 0 };

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Init particles
for (let i = 0; i < 400; i++) {
  particles.push({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
    life: 1
  });
}

// Device orientation
window.addEventListener('deviceorientation', e => {
  orientation.x = (e.gamma || 0) / 90;
  orientation.y = (e.beta || 0) / 180;
});

// Pointer inject
let mouse = { x: W/2, y: H/2, down: false };
canvas.addEventListener('pointerdown', e => { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('pointerup', () => mouse.down = false);

// Simple worker-like policy (inline for no CSP issues)
function updatePolicy() {
  // Sample velocity variance as residual proxy
  let vxSum = 0, vySum = 0;
  particles.forEach(p => { vxSum += p.vx; vySum += p.vy; });
  const residual = Math.hypot(vxSum, vySum) / particles.length;
  // Evolutionary tweak
  if (Math.random() < 0.02) {
    policy.sensitivity += (Math.random()-0.5)*0.1;
    policy.curiosity += (Math.random()-0.5)*0.05;
    policy.bias = Math.max(0, Math.min(1, policy.bias + (residual - 0.5)*0.01));
  }
  return residual;
}

// Cards
function spawnCard(x, y, text) {
  const el = document.createElement('div');
  el.className = 'thought-card';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  let dx = 0, dy = 0, dragging = false;
  el.addEventListener('pointerdown', e => { dragging = true; dx = e.clientX - el.offsetLeft; dy = e.clientY - el.offsetTop; e.stopPropagation(); });
  window.addEventListener('pointermove', e => {
    if (dragging) {
      el.style.left = (e.clientX - dx) + 'px';
      el.style.top = (e.clientY - dy) + 'px';
      // Inject force near card
      particles.forEach(p => {
        const d = Math.hypot(p.x - e.clientX, p.y - e.clientY);
        if (d < 80) {
          p.vx += (p.x - e.clientX) * 0.002;
          p.vy += (p.y - e.clientY) * 0.002;
        }
      });
    }
  });
  window.addEventListener('pointerup', () => dragging = false);
  cards.push(el);
  if (cards.length > 6) {
    const old = cards.shift();
    old.remove();
  }
}

const phrases = [
  "flow remembers the path",
  "residual pulls the mind",
  "curiosity bends the field",
  "policy adapts to turbulence",
  "energy seeks equilibrium",
  "thought crystallizes here"
];

function loop() {
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0, 0, W, H);

  const residual = updatePolicy();
  energy = energy * 0.98 + residual * 0.5;

  // Update particles
  particles.forEach(p => {
    // Fluid-ish: attraction to neighbors rough, orientation bias, mouse
    p.vx += orientation.x * 0.05 * policy.sensitivity;
    p.vy += orientation.y * 0.05 * policy.sensitivity;
    if (mouse.down) {
      const dx = mouse.x - p.x, dy = mouse.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      p.vx += dx / d * 0.3;
      p.vy += dy / d * 0.3;
    }
    // Mild damping + noise
    p.vx *= 0.98; p.vy *= 0.98;
    p.vx += (Math.random()-0.5)*0.1;
    p.vy += (Math.random()-0.5)*0.1;
    p.x += p.vx; p.y += p.vy;
    // Wrap
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    // Draw
    ctx.fillStyle = `hsla(${200 + residual*60}, 70%, 60%, 0.7)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.5, 0, Math.PI*2);
    ctx.fill();
  });

  // Spawn thought cards occasionally based on curiosity
  if (Math.random() < policy.curiosity * 0.015) {
    const px = Math.random() * W * 0.8 + W*0.1;
    const py = Math.random() * H * 0.8 + H*0.1;
    const phrase = phrases[Math.floor(Math.random()*phrases.length)];
    spawnCard(px, py, phrase);
  }

  // Morph chrome
  document.body.style.background = `hsl(${220 + energy*40}, 30%, ${8 + energy*5}%)`;
  document.body.style.filter = `hue-rotate(${energy*20}deg) contrast(${1 + residual*0.3})`;

  requestAnimationFrame(loop);
}
loop();

// Seal
document.getElementById('seal').onclick = () => {
  const state = { policy, energy: energy.toFixed(3), particles: particles.length, ts: Date.now() };
  localStorage.setItem('f197-mind', JSON.stringify(state));
  alert('Mind sealed to localStorage');
};

// Restore if present
try {
  const saved = localStorage.getItem('f197-mind');
  if (saved) {
    const s = JSON.parse(saved);
    Object.assign(policy, s.policy || {});
    energy = parseFloat(s.energy) || 0;
  }
} catch(e) {}
