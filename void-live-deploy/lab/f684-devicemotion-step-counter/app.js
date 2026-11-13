const DB_NAME = 'verse-f684-steps';
const STORE = 'sessions';
let db, session = null, steps = 0, startTime = 0, lastPeak = 0;
let accelHist = [];
const HIST_LEN = 200;
let listening = false;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const stats = document.getElementById('stats');
const sensEl = document.getElementById('sens');
const sensVal = document.getElementById('sensval');

sensEl.oninput = () => sensVal.textContent = sensEl.value;

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function loadSessions() {
  if (!db) return;
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const req = store.getAll();
  req.onsuccess = () => renderSessions(req.result || []);
}

function renderSessions(list) {
  const el = document.getElementById('sessions');
  if (!list.length) { el.textContent = 'None yet.'; return; }
  el.innerHTML = list.slice().reverse().map(s =>
    `<div>${new Date(s.start).toLocaleString()} · ${s.name} · ${s.steps} steps · ${s.distance.toFixed(2)} m · ${formatDur(s.duration)}</div>`
  ).join('');
}

function formatDur(ms) {
  const s = Math.floor(ms/1000);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function updateStats() {
  const dist = steps * parseFloat(document.getElementById('steplen').value || 0.75);
  const elapsed = session ? Date.now() - startTime : 0;
  stats.textContent = `${steps} steps · ${dist.toFixed(2)} m · ${formatDur(elapsed)}`;
}

function drawTrace() {
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#111';
  ctx.fillRect(0,0,w,h);
  if (!accelHist.length) return;
  ctx.beginPath();
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 2;
  const maxA = Math.max(2, ...accelHist.map(a => a.v));
  accelHist.forEach((a,i) => {
    const x = (i / HIST_LEN) * w;
    const y = h - (a.v / maxA) * (h-20) - 10;
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
  // step markers
  ctx.strokeStyle = '#facc15';
  accelHist.forEach((a,i) => {
    if (a.step) {
      const x = (i / HIST_LEN) * w;
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, h-10);
      ctx.stroke();
    }
  });
}

function onMotion(e) {
  if (!listening || !session) return;
  const a = e.accelerationIncludingGravity || e.acceleration;
  if (!a) return;
  const mag = Math.hypot(a.x||0, a.y||0, a.z||0);
  // simple high-pass-ish: subtract recent mean
  const recent = accelHist.slice(-20).map(p=>p.v);
  const mean = recent.length ? recent.reduce((s,v)=>s+v,0)/recent.length : mag;
  const filtered = Math.abs(mag - mean);
  const thresh = parseFloat(sensEl.value);
  const now = Date.now();
  let isStep = false;
  if (filtered > thresh && now - lastPeak > 250) {
    steps++;
    lastPeak = now;
    isStep = true;
  }
  accelHist.push({ v: filtered, step: isStep });
  if (accelHist.length > HIST_LEN) accelHist.shift();
  updateStats();
  drawTrace();
}

document.getElementById('perm').onclick = async () => {
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const p = await DeviceMotionEvent.requestPermission();
      if (p !== 'granted') { alert('Motion permission denied'); return; }
    } catch (err) { alert('Permission error'); return; }
  }
  window.addEventListener('devicemotion', onMotion);
  listening = true;
  document.getElementById('perm').textContent = 'Motion On';
  document.getElementById('perm').disabled = true;
};

document.getElementById('start').onclick = () => {
  session = true;
  steps = 0;
  startTime = Date.now();
  accelHist = [];
  document.getElementById('start').disabled = true;
  document.getElementById('stop').disabled = false;
  updateStats();
};

document.getElementById('stop').onclick = async () => {
  if (!session) return;
  const duration = Date.now() - startTime;
  const dist = steps * parseFloat(document.getElementById('steplen').value || 0.75);
  const rec = {
    id: Date.now(),
    name: document.getElementById('name').value || 'Walk',
    start: startTime,
    steps,
    distance: dist,
    duration
  };
  if (db) {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    await new Promise(r => tx.oncomplete = r);
  }
  session = null;
  document.getElementById('start').disabled = false;
  document.getElementById('stop').disabled = true;
  loadSessions();
  updateStats();
};

document.getElementById('manual').onclick = () => {
  if (!session) {
    session = true;
    startTime = Date.now();
    document.getElementById('start').disabled = true;
    document.getElementById('stop').disabled = false;
  }
  steps++;
  lastPeak = Date.now();
  accelHist.push({ v: 2, step: true });
  if (accelHist.length > HIST_LEN) accelHist.shift();
  updateStats();
  drawTrace();
};

document.getElementById('export').onclick = async () => {
  if (!db) return;
  const tx = db.transaction(STORE, 'readonly');
  const list = await new Promise(res => {
    const r = tx.objectStore(STORE).getAll();
    r.onsuccess = () => res(r.result || []);
  });
  const csv = ['name,start,steps,distance_m,duration_ms',
    ...list.map(s => `"${s.name}",${new Date(s.start).toISOString()},${s.steps},${s.distance.toFixed(2)},${s.duration}`)
  ].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'verse-steps.csv';
  a.click();
};

document.getElementById('copy').onclick = async () => {
  if (!db) return;
  const tx = db.transaction(STORE, 'readonly');
  const list = await new Promise(res => {
    const r = tx.objectStore(STORE).getAll();
    r.onsuccess = () => res(r.result || []);
  });
  const text = list.map(s => `${s.name}: ${s.steps} steps, ${s.distance.toFixed(2)} m`).join('\n') || 'No sessions';
  await navigator.clipboard.writeText(text);
  alert('Copied');
};

document.getElementById('clear').onclick = async () => {
  if (!confirm('Clear all saved sessions?')) return;
  if (db) {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await new Promise(r => tx.oncomplete = r);
  }
  loadSessions();
};

(async () => {
  try { db = await openDB(); loadSessions(); } catch(e) { console.warn(e); }
  updateStats();
  drawTrace();
})();
