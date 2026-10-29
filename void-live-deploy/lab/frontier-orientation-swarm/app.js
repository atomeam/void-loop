const canvas = document.getElementById('c');
const ui = document.getElementById('ui');
const stats = document.getElementById('stats');
let gl, particles = [], N = 2000;
let mouseX = 0, mouseY = 0, tiltX = 0, tiltY = 0;

function init() {
  canvas.width = innerWidth; canvas.height = innerHeight;
  gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) { alert('WebGL required'); return; }
  for (let i = 0; i < N; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random()-0.5)*2,
      vy: (Math.random()-0.5)*2,
      rule: Math.random()
    });
  }
  window.addEventListener('deviceorientation', e => {
    tiltX = (e.gamma || 0) / 90;
    tiltY = (e.beta || 0) / 90;
  });
  canvas.addEventListener('mousemove', e => {
    mouseX = e.clientX; mouseY = e.clientY;
  });
  requestAnimationFrame(loop);
}
function loop() {
  let energy = 0;
  for (let p of particles) {
    const dx = mouseX - p.x, dy = mouseY - p.y;
    const dist = Math.hypot(dx, dy) + 1;
    p.vx += (dx / dist) * 0.1 * (tiltX + 0.5) + (Math.random()-0.5)*0.1 * p.rule;
    p.vy += (dy / dist) * 0.1 * (tiltY + 0.5) + (Math.random()-0.5)*0.1 * p.rule;
    p.vx *= 0.98; p.vy *= 0.98;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    energy += Math.hypot(p.vx, p.vy);
    p.rule = (p.rule + 0.001 * (tiltX + tiltY)) % 1;
  }
  energy /= N;
  gl.viewport(0,0,canvas.width,canvas.height);
  gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
  stats.textContent = `Particles: ${N} | Energy: ${energy.toFixed(2)} | Tilt: ${tiltX.toFixed(2)},${tiltY.toFixed(2)}`;
  if (energy > 1.5) ui.classList.add('high'); else ui.classList.remove('high');
  requestAnimationFrame(loop);
}
function reset() {
  particles.forEach(p => { p.x = Math.random()*canvas.width; p.y = Math.random()*canvas.height; p.rule = Math.random(); });
}
window.onload = init;
