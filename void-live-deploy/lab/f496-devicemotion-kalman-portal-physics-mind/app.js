const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const N = 5;
const portals = [];
let intent = { x: innerWidth/2, y: innerHeight/2, vx: 0, vy: 0 };
let kalman = {
  // state [px, py, vx, vy]
  x: [innerWidth/2, innerHeight/2, 0, 0],
  P: [[10,0,0,0],[0,10,0,0],[0,0,1,0],[0,0,0,1]],
  Q: 0.5, // process noise
  R: 8.0  // measurement noise
};
let lastSeal = null;
const dbName = 'verse-f496-kalman';

function initPortals() {
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = 'P' + (i+1);
    stage.appendChild(el);
    portals.push({
      el,
      x: Math.random()*innerWidth,
      y: Math.random()*innerHeight,
      vx: (Math.random()-0.5)*40,
      vy: (Math.random()-0.5)*40,
      hue: 180 + i*30
    });
  }
}

function matMul(A, v) {
  return [
    A[0][0]*v[0] + A[0][1]*v[1] + A[0][2]*v[2] + A[0][3]*v[3],
    A[1][0]*v[0] + A[1][1]*v[1] + A[1][2]*v[2] + A[1][3]*v[3],
    A[2][0]*v[0] + A[2][1]*v[1] + A[2][2]*v[2] + A[2][3]*v[3],
    A[3][0]*v[0] + A[3][1]*v[1] + A[3][2]*v[2] + A[3][3]*v[3]
  ];
}

function kalmanPredict(dt) {
  // constant velocity F
  const F = [
    [1, 0, dt, 0],
    [0, 1, 0, dt],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
  kalman.x = matMul(F, kalman.x);
  // simple P update (approx, ignore full covariance for speed)
  for (let i = 0; i < 4; i++) kalman.P[i][i] += kalman.Q * dt;
}

function kalmanUpdate(zx, zy) {
  // measurement H = [1 0 0 0; 0 1 0 0]
  const yx = zx - kalman.x[0];
  const yy = zy - kalman.x[1];
  const S = kalman.P[0][0] + kalman.R;
  const Kx = kalman.P[0][0] / S;
  const Ky = kalman.P[1][1] / S;
  kalman.x[0] += Kx * yx;
  kalman.x[1] += Ky * yy;
  kalman.x[2] += (Kx * yx) * 0.1; // mild velocity correction
  kalman.x[3] += (Ky * yy) * 0.1;
  kalman.P[0][0] *= (1 - Kx);
  kalman.P[1][1] *= (1 - Ky);
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function seal() {
  const payload = JSON.stringify({
    k: kalman.x.slice(),
    p: portals.map(p => [p.x, p.y, p.vx, p.vy])
  });
  const hash = await sha256(payload);
  lastSeal = { hash, payload };
  try {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('seals');
    req.onsuccess = () => {
      const tx = req.result.transaction('seals', 'readwrite');
      tx.objectStore('seals').put(lastSeal, 'latest');
    };
  } catch (e) {
    localStorage.setItem('f496-seal', JSON.stringify(lastSeal));
  }
  statusEl.textContent = 'Sealed ' + hash.slice(0,8) + '…';
}

async function restore() {
  let data = lastSeal;
  if (!data) {
    try {
      const req = indexedDB.open(dbName, 1);
      data = await new Promise(res => {
        req.onsuccess = () => {
          const tx = req.result.transaction('seals');
          const get = tx.objectStore('seals').get('latest');
          get.onsuccess = () => res(get.result);
          get.onerror = () => res(null);
        };
        req.onerror = () => res(null);
      });
    } catch (e) {
      const ls = localStorage.getItem('f496-seal');
      if (ls) data = JSON.parse(ls);
    }
  }
  if (!data) { statusEl.textContent = 'No seal'; return; }
  const obj = JSON.parse(data.payload);
  kalman.x = obj.k;
  portals.forEach((p, i) => {
    if (obj.p[i]) {
      [p.x, p.y, p.vx, p.vy] = obj.p[i];
    }
  });
  statusEl.textContent = 'Restored ' + data.hash.slice(0,8) + '…';
}

document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') seal();
  if (e.key === 'r' || e.key === 'R') restore();
});

let lastT = performance.now();
let pointer = null;

document.addEventListener('pointermove', e => {
  pointer = { x: e.clientX, y: e.clientY };
});

window.addEventListener('devicemotion', e => {
  if (!e.accelerationIncludingGravity) return;
  const ax = e.accelerationIncludingGravity.x || 0;
  const ay = e.accelerationIncludingGravity.y || 0;
  // treat accel as velocity proxy observation (scaled)
  const zx = kalman.x[0] + ax * 30;
  const zy = kalman.x[1] + ay * 30;
  kalmanUpdate(zx, zy);
  statusEl.textContent = `Motion obs · |v| ${(Math.hypot(kalman.x[2], kalman.x[3])).toFixed(1)}`;
}, { passive: true });

function step(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  kalmanPredict(dt);

  if (pointer) {
    kalmanUpdate(pointer.x, pointer.y);
    pointer = null;
  } else if (Math.random() < 0.02) {
    // synthetic drive
    kalmanUpdate(kalman.x[0] + (Math.random()-0.5)*40, kalman.x[1] + (Math.random()-0.5)*40);
  }

  intent.x = kalman.x[0];
  intent.y = kalman.x[1];
  intent.vx = kalman.x[2];
  intent.vy = kalman.x[3];

  const speed = Math.min(1, Math.hypot(intent.vx, intent.vy) / 80);
  document.documentElement.style.setProperty('--speed', speed.toFixed(3));
  document.documentElement.style.setProperty('--hue', (200 + speed * 80).toFixed(0));

  portals.forEach((p, i) => {
    // attract to intent with phase offset
    const ox = Math.cos(now/800 + i) * 40;
    const oy = Math.sin(now/700 + i*1.3) * 40;
    const dx = (intent.x + ox) - p.x;
    const dy = (intent.y + oy) - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    p.vx += (dx / dist) * 180 * dt;
    p.vy += (dy / dist) * 180 * dt;
    // mild repulsion
    portals.forEach(q => {
      if (q === p) return;
      const rx = p.x - q.x, ry = p.y - q.y;
      const rd = Math.hypot(rx, ry) || 1;
      if (rd < 90) {
        p.vx += (rx / rd) * 120 * dt;
        p.vy += (ry / rd) * 120 * dt;
      }
    });
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // bounce
    if (p.x < 40) { p.x = 40; p.vx *= -0.6; }
    if (p.x > innerWidth - 40) { p.x = innerWidth - 40; p.vx *= -0.6; }
    if (p.y < 40) { p.y = 40; p.vy *= -0.6; }
    if (p.y > innerHeight - 40) { p.y = innerHeight - 40; p.vy *= -0.6; }
    p.el.style.transform = `translate(${p.x - 36}px, ${p.y - 36}px) scale(${0.85 + speed * 0.3})`;
    p.el.style.setProperty('--hue', p.hue + speed * 40);
  });

  requestAnimationFrame(step);
}

initPortals();
requestAnimationFrame(step);

// permission hint
if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
  document.body.addEventListener('click', () => {
    DeviceMotionEvent.requestPermission().then(s => {
      if (s === 'granted') statusEl.textContent = 'Motion permission granted';
    }).catch(() => {});
  }, { once: true });
}
