const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
});

const cards = [];
const cardData = [
  { t: 'Verse Node', d: 'Local mind' },
  { t: 'Energy Quanta', d: 'Battery flow' },
  { t: 'Policy', d: 'Vitality tune' },
  { t: 'Seal', d: 'Metabolic snapshot' },
  { t: 'Activity', d: 'Pointer residual' },
  { t: 'Recall', d: 'IndexedDB' }
];
cardData.forEach((cd, i) => {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<strong>${cd.t}</strong><br>${cd.d}`; // void-review: ok (built from this file's own constants and numbers, no user text)
  el.style.left = (80 + i * 160) + 'px';
  el.style.top = (120 + (i % 2) * 140) + 'px';
  document.body.appendChild(el);
  cards.push({
    el,
    x: parseFloat(el.style.left),
    y: parseFloat(el.style.top),
    vx: 0, vy: 0
  });
});

let particles = [];
let batteryLevel = 0.7;
let charging = false;
let activity = 0;
let vitality = 0.5;
let policyEmit = 1.0;
let policyDecay = 0.98;
let lastActivity = 0;

async function initBattery() {
  if (navigator.getBattery) {
    try {
      const batt = await navigator.getBattery();
      const update = () => {
        batteryLevel = batt.level;
        charging = batt.charging;
        document.getElementById('batt').textContent = 
          Math.round(batteryLevel * 100) + '% ' + (charging ? '(charging)' : '');
      };
      update();
      batt.addEventListener('levelchange', update);
      batt.addEventListener('chargingchange', update);
      document.getElementById('status').textContent = 'Real Battery Status API active.';
    } catch (e) {
      simulateBattery();
    }
  } else {
    simulateBattery();
  }
}
function simulateBattery() {
  document.getElementById('status').textContent = 'Battery API unavailable — simulated metabolic oscillator + pointer.';
  setInterval(() => {
    batteryLevel = 0.4 + 0.3 * Math.sin(Date.now() / 8000);
    document.getElementById('batt').textContent = Math.round(batteryLevel * 100) + '% (sim)';
  }, 1000);
}

function spawnParticle(x, y, boost = 1) {
  particles.push({
    x, y,
    vx: (Math.random() - 0.5) * 2 * boost,
    vy: (Math.random() - 0.5) * 2 * boost,
    e: 0.6 + Math.random() * 0.4
  });
}

let pointerX = W/2, pointerY = H/2;
let lastMove = 0;
window.addEventListener('pointermove', e => {
  pointerX = e.clientX;
  pointerY = e.clientY;
  lastMove = Date.now();
  activity = Math.min(1, activity + 0.02);
  if (Math.random() < 0.15 * policyEmit) spawnParticle(e.clientX, e.clientY, 1.2);
});
window.addEventListener('click', e => {
  activity = Math.min(1, activity + 0.15);
  for (let i = 0; i < 8; i++) spawnParticle(e.clientX, e.clientY, 1.5);
});

function updatePolicy() {
  // Simple proportional + residual
  const target = 0.55 + batteryLevel * 0.3;
  const err = target - vitality;
  policyEmit = Math.max(0.2, Math.min(2.5, policyEmit + err * 0.05));
  policyDecay = Math.max(0.94, Math.min(0.995, policyDecay - err * 0.002));
  // Decay activity
  activity *= 0.985;
}

function step() {
  // Emit based on battery and policy
  const baseEmit = batteryLevel * 0.8 * policyEmit;
  if (Math.random() < baseEmit * 0.4) {
    spawnParticle(Math.random() * W, Math.random() * H, 0.8);
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.99;
    p.vy *= 0.99;
    p.e *= policyDecay;
    // Soft bounds
    if (p.x < 0 || p.x > W) p.vx *= -0.8;
    if (p.y < 0 || p.y > H) p.vy *= -0.8;
    if (p.e < 0.05) particles.splice(i, 1);
  }

  // Compute vitality (entropy proxy + battery residual)
  const density = particles.length / 120;
  vitality = 0.7 * Math.min(1, density) + 0.3 * batteryLevel + activity * 0.2;
  vitality = Math.max(0, Math.min(1, vitality));

  updatePolicy();

  // Forces on cards from particles
  cards.forEach(c => {
    let fx = 0, fy = 0;
    particles.forEach(p => {
      const dx = c.x + 70 - p.x;
      const dy = c.y + 45 - p.y;
      const d2 = dx*dx + dy*dy + 100;
      const d = Math.sqrt(d2);
      if (d < 180) {
        const f = (p.e * 40) / d2;
        fx += (dx / d) * f;
        fy += (dy / d) * f;
      }
    });
    // Mild centering + damping
    fx += (W/2 - c.x) * 0.0008;
    fy += (H/2 - c.y) * 0.0008;
    c.vx = (c.vx + fx) * 0.92;
    c.vy = (c.vy + fy) * 0.92;
    c.x += c.vx;
    c.y += c.vy;
    // Bounds
    c.x = Math.max(10, Math.min(W - 150, c.x));
    c.y = Math.max(10, Math.min(H - 100, c.y));
    c.el.style.left = c.x + 'px';
    c.el.style.top = c.y + 'px';
  });

  // Render particles
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
  particles.forEach(p => {
    ctx.globalAlpha = p.e;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + p.e * 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // CSS morph
  document.documentElement.style.setProperty('--vitality', vitality.toFixed(2));
  document.documentElement.style.setProperty('--battery', batteryLevel.toFixed(2));
  document.documentElement.style.setProperty('--hue', (180 + vitality * 80).toFixed(0));

  document.getElementById('vit').textContent = vitality.toFixed(2);
  document.getElementById('pcount').textContent = particles.length;
  document.getElementById('act').textContent = activity.toFixed(2);

  requestAnimationFrame(step);
}

// Seal / Restore
async function seal() {
  const state = {
    batteryLevel, charging, vitality, policyEmit, policyDecay,
    particles: particles.map(p => ({x:p.x, y:p.y, e:p.e})),
    cards: cards.map(c => ({x:c.x, y:c.y})),
    ts: Date.now()
  };
  const str = JSON.stringify(state);
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
  try {
    const db = await openDB();
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({ id: 'last', hash, state });
    await tx.complete;
    document.getElementById('status').textContent = 'Sealed: ' + hash.slice(0,12) + '…';
  } catch (e) {
    localStorage.setItem('f499-seal', str);
    document.getElementById('status').textContent = 'Sealed to localStorage.';
  }
}

async function restore() {
  try {
    const db = await openDB();
    const tx = db.transaction('seals', 'readonly');
    const req = tx.objectStore('seals').get('last');
    req.onsuccess = () => {
      if (req.result) applyState(req.result.state);
      else tryLocal();
    };
  } catch (e) { tryLocal(); }
}
function tryLocal() {
  const s = localStorage.getItem('f499-seal');
  if (s) applyState(JSON.parse(s));
}
function applyState(state) {
  batteryLevel = state.batteryLevel || batteryLevel;
  vitality = state.vitality || 0.5;
  policyEmit = state.policyEmit || 1;
  policyDecay = state.policyDecay || 0.98;
  particles = (state.particles || []).map(p => ({...p, vx:0, vy:0}));
  (state.cards || []).forEach((sc, i) => {
    if (cards[i]) {
      cards[i].x = sc.x;
      cards[i].y = sc.y;
      cards[i].vx = cards[i].vy = 0;
    }
  });
  document.getElementById('status').textContent = 'Restored metabolic snapshot.';
}

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f499-mind', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seals', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}

document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
window.addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') seal();
  if (e.key === 'r' || e.key === 'R') restore();
});

initBattery();
// Seed initial particles
for (let i = 0; i < 40; i++) spawnParticle(Math.random()*W, Math.random()*H);
step();
