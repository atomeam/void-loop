const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 80;
const agents = [];
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const master = audioCtx.createGain();
master.gain.value = 0.15;
master.connect(audioCtx.destination);

function makeAgent(i) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const panner = audioCtx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  osc.type = ['sine','triangle','sawtooth'][i%3];
  osc.connect(gain);
  gain.connect(panner);
  panner.connect(master);
  osc.start();
  return {
    x: Math.random()*W, y: Math.random()*H,
    vx: (Math.random()-0.5)*1.2, vy: (Math.random()-0.5)*1.2,
    freq: 120 + Math.random()*400,
    detune: (Math.random()-0.5)*50,
    g: 0.3 + Math.random()*0.5,
    hue: Math.random()*360,
    fitness: 0,
    osc, gain, panner
  };
}
for (let i=0; i<N; i++) agents.push(makeAgent(i));

let gravityX = 0, gravityY = 0.05;
let pointer = {x: W/2, y: H/2, down: false};
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
addEventListener('pointerdown', e => { pointer.down = true; if (audioCtx.state === 'suspended') audioCtx.resume(); });
addEventListener('pointerup', () => pointer.down = false);

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    if (e.gamma != null) gravityX = e.gamma / 90 * 0.15;
    if (e.beta != null) gravityY = e.beta / 90 * 0.15;
  });
}

const cards = [];
for (let i=0; i<4; i++) {
  const c = document.createElement('div');
  c.className = 'card';
  c.textContent = 'probe ' + i;
  c.style.left = (80 + i*100) + 'px';
  c.style.top = (H - 100) + 'px';
  document.body.appendChild(c);
  let dragging = false, ox=0, oy=0;
  c.addEventListener('pointerdown', e => { dragging=true; ox=e.offsetX; oy=e.offsetY; e.stopPropagation(); });
  addEventListener('pointermove', e => {
    if (dragging) {
      c.style.left = (e.clientX - ox) + 'px';
      c.style.top = (e.clientY - oy) + 'px';
    }
  });
  addEventListener('pointerup', () => dragging=false);
  cards.push(c);
}

function update() {
  for (let a of agents) {
    a.vx += gravityX + (pointer.down ? (pointer.x - a.x)*0.0004 : 0);
    a.vy += gravityY + (pointer.down ? (pointer.y - a.y)*0.0004 : 0);
    a.vx *= 0.98; a.vy *= 0.98;
    a.x += a.vx; a.y += a.vy;
    if (a.x < 10 || a.x > W-10) a.vx *= -0.8;
    if (a.y < 10 || a.y > H-10) a.vy *= -0.8;
    a.x = Math.max(10, Math.min(W-10, a.x));
    a.y = Math.max(10, Math.min(H-10, a.y));

    const px = (a.x / W - 0.5) * 8;
    const py = (0.5 - a.y / H) * 6;
    a.panner.positionX.value = px;
    a.panner.positionY.value = py;
    a.panner.positionZ.value = 0.5;
    a.osc.frequency.value = a.freq;
    a.osc.detune.value = a.detune;
    a.gain.gain.value = a.g * 0.4;

    const speed = Math.hypot(a.vx, a.vy);
    a.fitness = 1 / (1 + speed) + Math.random()*0.05;
  }

  for (let i=0; i<agents.length; i++) {
    for (let j=i+1; j<agents.length; j++) {
      const a = agents[i], b = agents[j];
      const dx = a.x-b.x, dy = a.y-b.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 900) {
        const fA = a.fitness, fB = b.fitness;
        if (fA > fB + 0.05) {
          b.freq = b.freq*0.85 + a.freq*0.15;
          b.hue = (b.hue*0.8 + a.hue*0.2) % 360;
          b.g = Math.min(0.9, b.g + 0.02);
        } else if (fB > fA + 0.05) {
          a.freq = a.freq*0.85 + b.freq*0.15;
          a.hue = (a.hue*0.8 + b.hue*0.2) % 360;
          a.g = Math.min(0.9, a.g + 0.02);
        }
      }
    }
  }

  cards.forEach((card, idx) => {
    const cx = parseFloat(card.style.left) + 45;
    const cy = parseFloat(card.style.top) + 35;
    let sum=0, cnt=0;
    for (let a of agents) {
      if (Math.hypot(a.x-cx, a.y-cy) < 120) { sum += a.freq; cnt++; }
    }
    const avg = cnt ? (sum/cnt).toFixed(0) : '—';
    card.textContent = `probe ${idx}\n${avg} Hz\n${cnt} agents`;
  });

  document.getElementById('status').textContent = `agents:${N} audio:${audioCtx.state}`;
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  for (let a of agents) {
    ctx.beginPath();
    ctx.fillStyle = `hsl(${a.hue},70%,55%)`;
    ctx.arc(a.x, a.y, 4 + a.fitness*6, 0, Math.PI*2);
    ctx.fill();
  }
  if (pointer.down) {
    ctx.strokeStyle = '#8cf';
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 20, 0, Math.PI*2); ctx.stroke();
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();

const dbName = 'f460-seal';
let db;
const req = indexedDB.open(dbName, 1);
req.onupgradeneeded = e => {
  e.target.result.createObjectStore('seals', {keyPath: 'id'});
};
req.onsuccess = e => { db = e.target.result; };
document.getElementById('seal').onclick = () => {
  if (!db) return;
  const genes = agents.slice(0,8).map(a => ({f:a.freq.toFixed(1), h:a.hue.toFixed(0), g:a.g.toFixed(2)}));
  const id = 'seal-' + Date.now().toString(36);
  const tx = db.transaction('seals', 'readwrite');
  tx.objectStore('seals').put({id, genes, t: Date.now()});
  document.getElementById('sealid').textContent = id;
  cards.forEach(c => c.classList.add('seal'));
  setTimeout(() => cards.forEach(c => c.classList.remove('seal')), 800);
};
document.getElementById('reset').onclick = () => {
  agents.forEach(a => {
    a.x = Math.random()*W; a.y = Math.random()*H;
    a.vx = (Math.random()-0.5)*1.5; a.vy = (Math.random()-0.5)*1.5;
    a.freq = 120 + Math.random()*400;
  });
};
