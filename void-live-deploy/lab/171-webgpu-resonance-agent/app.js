// Minimal local AI: feature extractor + rule agent that updates shader-like params
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hudGesture = document.getElementById('gesture');
const hudState = document.getElementById('state');
const hudCount = document.getElementById('count');

let w, h, particles = [];
const N = 800;
let agentState = 'observe'; // observe | gather | disperse | orbit
let fieldStrength = 0.4;
let hueShift = 0;

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function initParticles() {
  particles = [];
  for (let i = 0; i < N; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      life: Math.random()
    });
  }
}
initParticles();

// Local gesture classifier (features from recent path)
const path = [];
let lastX = 0, lastY = 0;
function classifyGesture(dx, dy, speed, curvature) {
  if (speed < 1) return 'idle';
  if (curvature > 0.8) return 'circle';
  if (Math.abs(dx) > Math.abs(dy) * 2) return 'swipe-h';
  if (Math.abs(dy) > Math.abs(dx) * 2) return 'swipe-v';
  return 'drag';
}

// Simple agent: maps gesture class to state transition + param modulation
function agentStep(gesture) {
  const prev = agentState;
  if (gesture === 'circle') agentState = 'orbit';
  else if (gesture === 'swipe-h') agentState = 'disperse';
  else if (gesture === 'swipe-v') agentState = 'gather';
  else if (gesture === 'drag') agentState = 'observe';
  // "reasoning" visible as param change
  if (agentState === 'gather') fieldStrength = Math.min(1.2, fieldStrength + 0.02);
  else if (agentState === 'disperse') fieldStrength = Math.max(0.1, fieldStrength - 0.015);
  else if (agentState === 'orbit') hueShift = (hueShift + 2) % 360;
  return prev !== agentState;
}

canvas.addEventListener('pointermove', e => {
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  const speed = Math.hypot(dx, dy);
  path.push({dx, dy, speed});
  if (path.length > 12) path.shift();
  const curvature = path.length > 3 ? Math.abs(path[path.length-1].dx * path[0].dy - path[path.length-1].dy * path[0].dx) / (speed * path[0].speed + 1e-6) : 0;
  const g = classifyGesture(dx, dy, speed, curvature);
  hudGesture.textContent = g;
  agentStep(g);
  lastX = e.clientX;
  lastY = e.clientY;
});

function step() {
  // Simulate compute-like update (would be WebGPU compute shader in full version)
  for (const p of particles) {
    let fx = 0, fy = 0;
    if (agentState === 'gather') {
      fx = (w/2 - p.x) * 0.001 * fieldStrength;
      fy = (h/2 - p.y) * 0.001 * fieldStrength;
    } else if (agentState === 'disperse') {
      fx = (p.x - w/2) * 0.0008 * (1 / fieldStrength);
      fy = (p.y - h/2) * 0.0008 * (1 / fieldStrength);
    } else if (agentState === 'orbit') {
      const dx = p.x - w/2, dy = p.y - h/2;
      fx = -dy * 0.002;
      fy = dx * 0.002;
    }
    p.vx = p.vx * 0.98 + fx;
    p.vy = p.vy * 0.98 + fy;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > w) p.vx *= -1;
    if (p.y < 0 || p.y > h) p.vy *= -1;
    p.life += 0.01;
  }
  hudState.textContent = agentState;
  hudCount.textContent = particles.length;
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,10,0.25)';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const hue = (hueShift + p.life * 40) % 360;
    ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.6)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

// Note: full WebGPU version would move particle update to a compute pipeline
// and read back only for agent feedback. This 2D canvas is the runnable baseline.
console.log('Resonance Field Agent prototype ready — local only');
