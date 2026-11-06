const wrap = document.getElementById('canvas-wrap');
const statusEl = document.getElementById('status');
const N = 16; // tiles
let tiles = [];
let sensors = { lux: 200, battery: 0.8, charging: true, alpha: 0, beta: 0, gamma: 0 };
let mlp = null;
let running = true;

// Tiny MLP: 6 inputs → 8 hidden → 4 outputs (scale, hue, dx, dy)
function makeMLP() {
  const w1 = Array.from({length: 8}, () => Array.from({length: 6}, () => (Math.random()-0.5)*0.8));
  const b1 = Array.from({length: 8}, () => (Math.random()-0.5)*0.2);
  const w2 = Array.from({length: 4}, () => Array.from({length: 8}, () => (Math.random()-0.5)*0.6));
  const b2 = Array.from({length: 4}, () => (Math.random()-0.5)*0.1);
  return { w1, b1, w2, b2 };
}
function relu(x) { return Math.max(0, x); }
function tanh(x) { return Math.tanh(x); }
function forward(m, x) {
  const h = m.w1.map((row, i) => relu(row.reduce((s, w, j) => s + w * x[j], 0) + m.b1[i]));
  return m.w2.map((row, i) => tanh(row.reduce((s, w, j) => s + w * h[j], 0) + m.b2[i]));
}
function hebbianUpdate(m, x, reward) {
  // very light Hebbian-ish adjustment on positive reward
  if (Math.abs(reward) < 0.05) return;
  const lr = 0.002 * reward;
  for (let i = 0; i < m.w1.length; i++)
    for (let j = 0; j < m.w1[i].length; j++)
      m.w1[i][j] += lr * x[j] * 0.1;
}

async function initSensors() {
  // Battery
  if (navigator.getBattery) {
    try {
      const bat = await navigator.getBattery();
      sensors.battery = bat.level;
      sensors.charging = bat.charging;
      bat.addEventListener('levelchange', () => { sensors.battery = bat.level; updateStatus(); });
      bat.addEventListener('chargingchange', () => { sensors.charging = bat.charging; updateStatus(); });
    } catch (e) { console.debug("lab f572-ambient-sensor-mlp-living-tiles:", e); }
  }
  // Ambient Light
  if ('AmbientLightSensor' in window) {
    try {
      const sensor = new AmbientLightSensor({ frequency: 2 });
      sensor.addEventListener('reading', () => { sensors.lux = sensor.illuminance || 200; updateStatus(); });
      sensor.start();
    } catch(e) { sensors.lux = 300; }
  } else {
    // fallback: light from prefers-color-scheme + time of day proxy
    sensors.lux = window.matchMedia('(prefers-color-scheme: dark)').matches ? 80 : 400;
  }
  // Orientation
  window.addEventListener('deviceorientation', (e) => {
    sensors.alpha = e.alpha || 0;
    sensors.beta = e.beta || 0;
    sensors.gamma = e.gamma || 0;
    updateStatus();
  });
  // Request permission on iOS
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.body.addEventListener('click', async () => {
      try { await DeviceOrientationEvent.requestPermission(); } catch (e) { console.debug("lab f572-ambient-sensor-mlp-living-tiles:", e); }
    }, { once: true });
  }
  updateStatus();
}

function updateStatus() {
  statusEl.textContent = `lux:${sensors.lux.toFixed(0)} bat:${(sensors.battery*100).toFixed(0)}% ${sensors.charging?'⚡':''} ori:${sensors.beta.toFixed(0)}/${sensors.gamma.toFixed(0)}`;
}

function makeTiles() {
  wrap.innerHTML = '';
  tiles = [];
  const w = wrap.clientWidth, h = wrap.clientHeight;
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'tile';
    const x = Math.random() * (w - 80) + 20;
    const y = Math.random() * (h - 80) + 20;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = '64px';
    el.style.height = '64px';
    el.dataset.energy = 0.5;
    el.textContent = (i+1).toString(16).toUpperCase();
    el.addEventListener('pointerdown', (ev) => {
      const reward = 0.6 + Math.random()*0.4;
      el.dataset.energy = Math.min(1, parseFloat(el.dataset.energy) + 0.3);
      hebbianUpdate(mlp, getInput(), reward);
      if (navigator.vibrate) navigator.vibrate(12);
      ev.stopPropagation();
    });
    wrap.appendChild(el);
    tiles.push({ el, x, y, vx: 0, vy: 0 });
  }
}

function getInput() {
  const energy = parseFloat(document.getElementById('energy').value);
  return [
    Math.min(1, sensors.lux / 1000),
    sensors.battery,
    sensors.charging ? 1 : 0,
    (sensors.beta + 90) / 180,
    (sensors.gamma + 90) / 180,
    energy
  ];
}

function step() {
  if (!running || !mlp) return;
  const inp = getInput();
  const out = forward(mlp, inp); // [scale, hueShift, dx, dy]
  const scale = 0.6 + out[0] * 0.5;
  const hue = (180 + out[1] * 120) % 360;
  const forceX = out[2] * 2.2;
  const forceY = out[3] * 2.2;
  const lightBoost = Math.min(1, sensors.lux / 800);
  const batBoost = sensors.battery * (sensors.charging ? 1.2 : 0.7);

  tiles.forEach((t, i) => {
    // soft spring back + force from MLP + orientation gravity
    const cx = wrap.clientWidth / 2, cy = wrap.clientHeight / 2;
    t.vx += forceX * 0.15 + (sensors.gamma * 0.002);
    t.vy += forceY * 0.15 + (sensors.beta * 0.002);
    t.vx *= 0.92; t.vy *= 0.92;
    t.x += t.vx; t.y += t.vy;
    // bounds
    t.x = Math.max(10, Math.min(wrap.clientWidth - 70, t.x));
    t.y = Math.max(10, Math.min(wrap.clientHeight - 70, t.y));

    const e = parseFloat(t.el.dataset.energy) * (0.98 + lightBoost * 0.03);
    t.el.dataset.energy = Math.max(0.1, e).toFixed(3);
    const s = 48 + scale * 40 * e * batBoost;
    t.el.style.left = t.x + 'px';
    t.el.style.top = t.y + 'px';
    t.el.style.width = s + 'px';
    t.el.style.height = s + 'px';
    t.el.style.background = `hsla(${hue + i*12}, 70%, ${40 + e*30}%, 0.85)`;
    t.el.style.transform = `scale(${0.85 + e*0.3}) rotate(${out[2]*8}deg)`;
  });
  requestAnimationFrame(step);
}

async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({
      id: 'f572',
      mlp, sensors: {...sensors},
      tiles: tiles.map(t => ({x:t.x, y:t.y, energy: parseFloat(t.el.dataset.energy)}))
    });
    statusEl.textContent = 'sealed ✓';
    setTimeout(updateStatus, 1200);
  } catch(e) { console.warn(e); }
}
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-f572', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state', {keyPath: 'id'});
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function restore() {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get('f572');
    req.onsuccess = () => {
      if (req.result) {
        mlp = req.result.mlp;
        if (req.result.tiles) {
          req.result.tiles.forEach((saved, i) => {
            if (tiles[i]) {
              tiles[i].x = saved.x; tiles[i].y = saved.y;
              tiles[i].el.dataset.energy = saved.energy;
            }
          });
        }
      }
    };
  } catch (e) { console.debug("lab f572-ambient-sensor-mlp-living-tiles:", e); }
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { mlp = makeMLP(); makeTiles(); };
window.addEventListener('resize', makeTiles);

(async () => {
  mlp = makeMLP();
  makeTiles();
  await initSensors();
  await restore();
  step();
})();
