const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const rEl = document.getElementById('r');
const psiEl = document.getElementById('psi');
const fitEl = document.getElementById('fit');
const genEl = document.getElementById('gen');

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

const N = 180;
let phases = new Float32Array(N);
let omegas = new Float32Array(N);
let K = 1.8; // coupling
let sigma = 0.4; // freq spread
let driveGain = 0.6;

for (let i = 0; i < N; i++) {
  phases[i] = Math.random() * Math.PI * 2;
  omegas[i] = (Math.random() - 0.5) * sigma * 2;
}

let pointerX = 0.5, pointerY = 0.5, pointerVX = 0, pointerVY = 0;
let tiltX = 0, tiltY = 0;
let lastPX = 0.5, lastPY = 0.5;

addEventListener('pointermove', e => {
  pointerX = e.clientX / innerWidth;
  pointerY = e.clientY / innerHeight;
  pointerVX = pointerX - lastPX;
  pointerVY = pointerY - lastPY;
  lastPX = pointerX;
  lastPY = pointerY;
});

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    tiltX = (e.gamma || 0) / 45;
    tiltY = (e.beta || 0) / 45;
  });
}

let orderR = 0, orderPsi = 0;
let fitness = 0;

function step(dt) {
  // Kuramoto step
  let sumSin = 0, sumCos = 0;
  const drive = (pointerVX * 8 + tiltX * 0.3) * driveGain;
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let j = 0; j < N; j++) {
      sum += Math.sin(phases[j] - phases[i]);
    }
    sum /= N;
    const dphi = omegas[i] + K * sum + drive * Math.sin(Math.PI * 2 * pointerX - phases[i]);
    phases[i] += dphi * dt;
    phases[i] = ((phases[i] % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    sumSin += Math.sin(phases[i]);
    sumCos += Math.cos(phases[i]);
  }
  orderR = Math.sqrt(sumSin * sumSin + sumCos * sumCos) / N;
  orderPsi = Math.atan2(sumSin, sumCos);
  // fitness: high order + some drive response
  fitness = orderR * 0.7 + Math.min(1, Math.abs(pointerVX) * 4 + Math.abs(tiltX) * 0.5) * 0.3;
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.5;
  const R = Math.min(canvas.width, canvas.height) * 0.32;
  for (let i = 0; i < N; i++) {
    const a = phases[i];
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    const hue = (a / (Math.PI * 2) * 360 + orderPsi * 30) % 360;
    ctx.fillStyle = `hsla(${hue}, 70%, ${50 + orderR * 30}%, 0.85)`;
    ctx.beginPath();
    ctx.arc(x, y, 2.2 + orderR * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // mean phase marker
  ctx.strokeStyle = `hsla(${orderPsi * 57}, 80%, 70%, 0.9)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(orderPsi) * R * 1.15, cy + Math.sin(orderPsi) * R * 1.15, 6, 0, Math.PI * 2);
  ctx.stroke();
}

// Evolutionary mind in Worker
const workerCode = `
let pop = [];
const POP = 8;
function init() {
  for (let i = 0; i < POP; i++) {
    pop.push({ K: 0.5 + Math.random() * 3, sigma: 0.1 + Math.random() * 0.8, driveGain: 0.2 + Math.random() * 1.2, fit: 0 });
  }
}
init();
self.onmessage = e => {
  const { fitness, current } = e.data;
  // update current
  if (current) {
    const idx = pop.findIndex(p => Math.abs(p.K - current.K) < 0.05);
    if (idx >= 0) pop[idx].fit = fitness;
  }
  // sort, mutate best
  pop.sort((a,b) => b.fit - a.fit);
  for (let i = 2; i < POP; i++) {
    const p = pop[i];
    p.K = pop[0].K + (Math.random() - 0.5) * 0.4;
    p.sigma = pop[0].sigma + (Math.random() - 0.5) * 0.15;
    p.driveGain = pop[0].driveGain + (Math.random() - 0.5) * 0.3;
    p.K = Math.max(0.1, Math.min(5, p.K));
    p.sigma = Math.max(0.05, Math.min(1.5, p.sigma));
    p.driveGain = Math.max(0, Math.min(2, p.driveGain));
    p.fit = 0;
  }
  self.postMessage(pop[0]);
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
let best = { K: 1.8, sigma: 0.4, driveGain: 0.6, fit: 0 };
worker.onmessage = e => {
  best = e.data;
  K = best.K;
  sigma = best.sigma;
  driveGain = best.driveGain;
  genEl.textContent = `K:${best.K.toFixed(2)} σ:${best.sigma.toFixed(2)} d:${best.driveGain.toFixed(2)}`;
};

let lastMind = 0;
function loop(t) {
  const dt = 0.016;
  step(dt);
  draw();
  rEl.textContent = orderR.toFixed(3);
  psiEl.textContent = orderPsi.toFixed(2);
  fitEl.textContent = fitness.toFixed(3);

  // morph UI by order
  const hue = (orderPsi * 40 + 180) % 360;
  const scale = 1 + orderR * 0.08;
  const blur = (1 - orderR) * 1.5;
  hud.style.filter = `hue-rotate(${hue}deg) brightness(${0.9 + orderR * 0.3}) blur(${blur}px)`;
  hud.style.transform = `scale(${scale}) rotate(${orderR * 4}deg)`;
  hud.style.borderRadius = `${8 + orderR * 12}px`;
  document.body.style.background = `hsl(${hue}, 30%, ${6 + orderR * 4}%)`;

  if (t - lastMind > 800) {
    worker.postMessage({ fitness, current: best });
    lastMind = t;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Seal
document.getElementById('seal').onclick = async () => {
  const payload = { K, sigma, driveGain, orderR, orderPsi, t: Date.now() };
  const str = JSON.stringify(payload);
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem('f300-seal', JSON.stringify({ hash, payload }));
  alert('Sealed: ' + hash.slice(0, 16) + '…');
};

// Web Audio optional drone
let audioCtx, osc, gain;
function startAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  osc = audioCtx.createOscillator();
  gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 110;
  gain.gain.value = 0.05;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  function updateAudio() {
    if (!osc) return;
    osc.frequency.value = 90 + orderR * 180 + Math.abs(orderPsi) * 20;
    gain.gain.value = 0.02 + orderR * 0.08;
    requestAnimationFrame(updateAudio);
  }
  updateAudio();
}
addEventListener('pointerdown', startAudio, { once: true });
