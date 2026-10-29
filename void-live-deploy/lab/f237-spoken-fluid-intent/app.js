const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

const N = 2500;
const particles = [];
for (let i = 0; i < N; i++) {
  particles.push({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random()-0.5)*2,
    vy: (Math.random()-0.5)*2,
    life: 1
  });
}

let forces = []; // {x,y,type,strength,life}
let mouse = {x: W/2, y: H/2, down: false};

canvas.addEventListener('pointerdown', e => { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('pointerup', () => mouse.down = false);

const lexicon = {
  calm: {type: 'damp', strength: 0.8},
  swirl: {type: 'swirl', strength: 1.2},
  focus: {type: 'attract', strength: 1.5},
  scatter: {type: 'repel', strength: 1.0},
  expand: {type: 'repel', strength: 0.7},
  gather: {type: 'attract', strength: 1.0},
  chaos: {type: 'noise', strength: 1.5},
  peace: {type: 'damp', strength: 1.0},
  flow: {type: 'swirl', strength: 0.8}
};

function applyIntent(text) {
  const words = text.toLowerCase().split(/\s+/);
  let applied = false;
  for (const w of words) {
    if (lexicon[w]) {
      forces.push({
        x: Math.random() * W,
        y: Math.random() * H,
        ...lexicon[w],
        life: 180
      });
      applied = true;
    }
  }
  if (!applied && text.trim()) {
    // default attract to center
    forces.push({x: W/2, y: H/2, type: 'attract', strength: 0.6, life: 120});
  }
  document.getElementById('status').textContent = `Intent applied: "${text}"`;
  // speak confirmation
  speak(`Sculpting with ${text}`);
}

function speak(text) {
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 0.8 + Math.random()*0.4;
    speechSynthesis.speak(u);
  }
}

// Speech recognition
let recognition;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = false;
  recognition.onresult = e => {
    const text = e.results[0][0].transcript;
    document.getElementById('text').value = text;
    applyIntent(text);
  };
  recognition.onerror = () => document.getElementById('status').textContent = 'Listen error';
}

document.getElementById('speak').onclick = () => {
  const t = document.getElementById('text').value;
  if (t) applyIntent(t);
};
document.getElementById('listen').onclick = () => {
  if (recognition) {
    document.getElementById('status').textContent = 'Listening...';
    recognition.start();
  } else {
    document.getElementById('status').textContent = 'Speech recognition not available';
  }
};

// Reflection loop
setInterval(() => {
  let avgSpeed = 0;
  for (const p of particles) avgSpeed += Math.hypot(p.vx, p.vy);
  avgSpeed /= N;
  let phrase;
  if (avgSpeed < 0.5) phrase = "The mind rests in stillness.";
  else if (avgSpeed < 1.5) phrase = "Currents of thought are flowing.";
  else phrase = "Turbulence rises. Intent is strong.";
  speak(phrase);
  document.getElementById('status').textContent = phrase;
}, 12000);

function update() {
  // mouse force
  if (mouse.down) {
    forces.push({x: mouse.x, y: mouse.y, type: 'attract', strength: 2.0, life: 8});
  }

  for (let i = forces.length - 1; i >= 0; i--) {
    const f = forces[i];
    f.life--;
    if (f.life <= 0) forces.splice(i, 1);
  }

  for (const p of particles) {
    // damping
    p.vx *= 0.98;
    p.vy *= 0.98;

    for (const f of forces) {
      const dx = f.x - p.x;
      const dy = f.y - p.y;
      const dist = Math.hypot(dx, dy) + 1;
      const ang = Math.atan2(dy, dx);
      let fx = 0, fy = 0;
      const s = f.strength / (dist * 0.01 + 1);
      if (f.type === 'attract') { fx = Math.cos(ang) * s; fy = Math.sin(ang) * s; }
      else if (f.type === 'repel') { fx = -Math.cos(ang) * s; fy = -Math.sin(ang) * s; }
      else if (f.type === 'swirl') { fx = -Math.sin(ang) * s; fy = Math.cos(ang) * s; }
      else if (f.type === 'damp') { p.vx *= 0.9; p.vy *= 0.9; }
      else if (f.type === 'noise') { p.vx += (Math.random()-0.5)*s*0.5; p.vy += (Math.random()-0.5)*s*0.5; }
      p.vx += fx * 0.15;
      p.vy += fy * 0.15;
    }

    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.8;
    if (p.y < 0 || p.y > H) p.vy *= -0.8;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  }
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,10,0.25)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4af';
  for (const p of particles) {
    const speed = Math.hypot(p.vx, p.vy);
    const alpha = Math.min(1, speed * 0.4 + 0.2);
    ctx.globalAlpha = alpha;
    ctx.fillRect(p.x, p.y, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  // draw forces
  ctx.strokeStyle = '#f84';
  for (const f of forces) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, 20 + (180-f.life)/4, 0, Math.PI*2);
    ctx.stroke();
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();

// initial
applyIntent('flow');
