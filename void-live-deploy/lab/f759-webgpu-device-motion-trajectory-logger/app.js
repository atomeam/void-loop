const $ = id => document.getElementById(id);
const canvas = $('c');
const ctx = canvas.getContext('2d');
const status = $('status');
const logEl = $('log');

let recording = false;
let samples = [];
let marks = [];
let animId = null;
let lastT = 0;
let pos = {x:0,y:0,z:0};
let vel = {x:0,y:0,z:0};
const GRAV = 9.81;

function resize() {
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * devicePixelRatio;
  canvas.height = r.height * devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
window.addEventListener('resize', resize);
resize();

function setStatus(msg, ok=false) {
  status.textContent = msg;
  status.style.color = ok ? 'var(--ok)' : '#8b949e';
}

async function requestSensors() {
  try {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const p = await DeviceMotionEvent.requestPermission();
      if (p !== 'granted') throw new Error('Motion permission denied');
    }
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      await DeviceOrientationEvent.requestPermission();
    }
    return true;
  } catch (e) {
    setStatus('Sensor permission denied or unavailable — using mouse fallback');
    return false;
  }
}

function onMotion(e) {
  if (!recording) return;
  const a = e.accelerationIncludingGravity || e.acceleration || {};
  const ax = a.x || 0, ay = a.y || 0, az = a.z || 0;
  const t = performance.now();
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;

  // High-pass + integrate rough position (demo quality)
  vel.x += (ax) * dt; vel.y += (ay) * dt; vel.z += (az - GRAV) * dt;
  vel.x *= 0.98; vel.y *= 0.98; vel.z *= 0.98;
  pos.x += vel.x * dt; pos.y += vel.y * dt; pos.z += vel.z * dt;

  samples.push({
    t: Date.now(),
    ax, ay, az,
    alpha: e.rotationRate ? e.rotationRate.alpha : 0,
    beta: e.rotationRate ? e.rotationRate.beta : 0,
    gamma: e.rotationRate ? e.rotationRate.gamma : 0,
    px: pos.x, py: pos.y, pz: pos.z
  });
  if (samples.length > 8000) samples.shift();
}

function onOrient(e) {
  // store latest orientation on most recent sample if present
  if (recording && samples.length) {
    const s = samples[samples.length-1];
    s.alpha = e.alpha || s.alpha;
    s.beta = e.beta || s.beta;
    s.gamma = e.gamma || s.gamma;
  }
}

let mouseDown = false;
canvas.addEventListener('pointerdown', e => { mouseDown = true; });
canvas.addEventListener('pointerup', () => mouseDown = false);
canvas.addEventListener('pointermove', e => {
  if (!recording || !mouseDown) return;
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) / rect.width * 2 - 1;
  const my = -((e.clientY - rect.top) / rect.height * 2 - 1);
  const t = performance.now();
  const dt = Math.min(0.05, (t - lastT)/1000 || 0.016);
  lastT = t;
  pos.x += mx * 0.05; pos.y += my * 0.05;
  samples.push({
    t: Date.now(), ax: mx*2, ay: my*2, az: 0,
    alpha:0, beta:0, gamma:0,
    px: pos.x, py: pos.y, pz: 0
  });
  if (samples.length > 8000) samples.shift();
});

function draw() {
  const w = canvas.width / devicePixelRatio;
  const h = canvas.height / devicePixelRatio;
  ctx.clearRect(0,0,w,h);
  ctx.save();
  ctx.translate(w/2, h/2);
  ctx.scale(80, 80);

  if (samples.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 0.04;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const x = s.px || 0;
      const y = s.py || 0;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // marks
    ctx.fillStyle = '#3fb950';
    marks.forEach(m => {
      if (m.sample) {
        ctx.beginPath();
        ctx.arc(m.sample.px || 0, m.sample.py || 0, 0.08, 0, Math.PI*2);
        ctx.fill();
      }
    });

    // current point
    const last = samples[samples.length-1];
    ctx.fillStyle = '#f85149';
    ctx.beginPath();
    ctx.arc(last.px||0, last.py||0, 0.06, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();

  // HUD
  ctx.fillStyle = '#8b949e';
  ctx.font = '13px system-ui';
  ctx.fillText(`samples: ${samples.length}  marks: ${marks.length}`, 12, 22);
  animId = requestAnimationFrame(draw);
}

$('start').onclick = async () => {
  const ok = await requestSensors();
  recording = true;
  samples = [];
  marks = [];
  pos = {x:0,y:0,z:0}; vel = {x:0,y:0,z:0};
  lastT = performance.now();
  window.addEventListener('devicemotion', onMotion);
  window.addEventListener('deviceorientation', onOrient);
  $('start').disabled = true;
  $('stop').disabled = false;
  $('mark').disabled = false;
  $('label').disabled = false;
  setStatus(ok ? 'Recording… move the device' : 'Recording (mouse fallback) — drag on canvas', true);
  logEl.textContent = 'Recording started.\n';
  if (!animId) draw();
};

$('stop').onclick = () => {
  recording = false;
  window.removeEventListener('devicemotion', onMotion);
  window.removeEventListener('deviceorientation', onOrient);
  $('start').disabled = false;
  $('stop').disabled = true;
  $('mark').disabled = true;
  $('label').disabled = true;
  $('csv').disabled = samples.length === 0;
  $('seal').disabled = samples.length === 0;
  setStatus(`Stopped. ${samples.length} samples captured.`, true);
  logEl.textContent += `Stopped. ${samples.length} samples.\n`;
};

$('mark').onclick = () => {
  const label = $('label').value.trim() || `mark-${marks.length+1}`;
  const sample = samples[samples.length-1] || null;
  marks.push({ label, t: Date.now(), sample });
  logEl.textContent += `MARK: ${label}\n`;
  $('label').value = '';
};

function toCSV() {
  const headers = ['timestamp','ax','ay','az','alpha','beta','gamma','px','py','pz','mark'];
  const rows = samples.map(s => {
    const mark = marks.find(m => m.sample === s);
    return [
      s.t, s.ax.toFixed(4), s.ay.toFixed(4), s.az.toFixed(4),
      (s.alpha||0).toFixed(2), (s.beta||0).toFixed(2), (s.gamma||0).toFixed(2),
      (s.px||0).toFixed(4), (s.py||0).toFixed(4), (s.pz||0).toFixed(4),
      mark ? mark.label : ''
    ].join(',');
  });
  return headers.join(',') + '\n' + rows.join('\n');
}

$('csv').onclick = () => {
  const blob = new Blob([toCSV()], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `motion-trajectory-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus('CSV downloaded', true);
};

$('seal').onclick = () => {
  const payload = { samples, marks, sealed: Date.now() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `motion-seal-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  try { localStorage.setItem('verse-f759-last', JSON.stringify({n: samples.length, t: Date.now()})); } catch (e) { console.debug("lab f759-webgpu-device-motion-trajectory-logger:", e); }
  setStatus('Seal JSON downloaded', true);
};

// restore note
try {
  const last = localStorage.getItem('verse-f759-last');
  if (last) {
    const o = JSON.parse(last);
    logEl.textContent = `Previous seal: ${o.n} samples at ${new Date(o.t).toLocaleString()}\n`;
  }
} catch (e) { console.debug("lab f759-webgpu-device-motion-trajectory-logger:", e); }

draw();
