const canvas = document.getElementById('score');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// --- Tiny residual RNN ---
const HIDDEN = 12;
let weightsIn = new Float32Array(HIDDEN);
let weightsHid = new Float32Array(HIDDEN * HIDDEN);
let bias = new Float32Array(HIDDEN);
let outW = new Float32Array(HIDDEN);
let hidden = new Float32Array(HIDDEN);
function initRNN() {
  for (let i = 0; i < HIDDEN; i++) {
    weightsIn[i] = (Math.random() - 0.5) * 0.4;
    bias[i] = (Math.random() - 0.5) * 0.1;
    outW[i] = (Math.random() - 0.5) * 0.3;
    for (let j = 0; j < HIDDEN; j++) weightsHid[i*HIDDEN+j] = (Math.random() - 0.5) * 0.2;
  }
}
initRNN();

function rnnStep(pitch) {
  const norm = (pitch - 60) / 24;
  const next = new Float32Array(HIDDEN);
  for (let i = 0; i < HIDDEN; i++) {
    let s = bias[i] + weightsIn[i] * norm;
    for (let j = 0; j < HIDDEN; j++) s += weightsHid[i*HIDDEN+j] * hidden[j];
    next[i] = Math.tanh(s);
  }
  for (let i = 0; i < HIDDEN; i++) hidden[i] = hidden[i] * 0.7 + next[i] * 0.3;
  let pred = 60;
  for (let i = 0; i < HIDDEN; i++) pred += outW[i] * hidden[i] * 12;
  return Math.max(36, Math.min(84, Math.round(pred)));
}

const notes = [];
let nextId = 1;
const motifs = [];
const MAX_NOTES = 180;

function placeNote(pitch, x, y, fromMIDI = false) {
  if (notes.length > MAX_NOTES) notes.shift();
  const n = { x, y, pitch, vel: fromMIDI ? 0.8 : 0.6, age: 0, id: nextId++ };
  notes.push(n);
  playNote(pitch, x);
  if (notes.length > 8 && Math.random() < 0.15) spawnMotif();
  return n;
}

function spawnMotif() {
  const recent = notes.slice(-12);
  const pitches = recent.map(n => n.pitch);
  const minP = Math.min(...pitches), maxP = Math.max(...pitches);
  const el = document.createElement('div');
  el.className = 'motif';
  el.textContent = `Motif ${minP}–${maxP}`;
  el.style.left = (Math.random() * (W - 120)) + 'px';
  el.style.top = (Math.random() * (H - 60)) + 'px';
  document.body.appendChild(el);
  const m = { el, noteIds: recent.map(n => n.id), pitchRange: [minP, maxP] };
  motifs.push(m);
  makeDraggable(el, m);
}

function makeDraggable(el, m) {
  let ox, oy, dragging = false;
  el.addEventListener('pointerdown', e => {
    dragging = true;
    ox = e.clientX - parseFloat(el.style.left);
    oy = e.clientY - parseFloat(el.style.top);
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    el.style.left = (e.clientX - ox) + 'px';
    el.style.top = (e.clientY - oy) + 'px';
  });
  el.addEventListener('pointerup', e => {
    dragging = false;
    const avg = (m.pitchRange[0] + m.pitchRange[1]) / 2;
    rnnStep(avg);
    statusEl.textContent = 'Motif dragged → re-injected';
  });
}

let audioCtx, panner;
function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  panner = audioCtx.createStereoPanner();
  panner.connect(audioCtx.destination);
}
function playNote(pitch, x) {
  try {
    ensureAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.frequency.value = 440 * Math.pow(2, (pitch - 69) / 12);
    osc.type = 'sine';
    g.gain.setValueAtTime(0.12, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    const pan = (x / W) * 2 - 1;
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), audioCtx.currentTime);
    osc.connect(g); g.connect(panner);
    osc.start(); osc.stop(audioCtx.currentTime + 0.45);
  } catch (e) {}
}

async function initMIDI() {
  if (!navigator.requestMIDIAccess) {
    statusEl.textContent = 'Web MIDI unavailable · click canvas to inject';
    return;
  }
  try {
    const access = await navigator.requestMIDIAccess();
    statusEl.textContent = 'MIDI ready · ' + access.inputs.size + ' inputs';
    for (const input of access.inputs.values()) {
      input.onmidimessage = msg => {
        const [st, note, vel] = msg.data;
        if ((st & 0xf0) === 0x90 && vel > 0) {
          const pred = rnnStep(note);
          const angle = notes.length * 0.4;
          const r = 40 + notes.length * 2.2;
          const x = W/2 + Math.cos(angle) * r;
          const y = H/2 + Math.sin(angle) * r;
          placeNote(note, x, y, true);
          placeNote(pred, x + 18, y + 12);
        }
      };
    }
  } catch (e) {
    statusEl.textContent = 'MIDI denied · click to inject';
  }
}
initMIDI();

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const pitch = Math.round(84 - (y / H) * 48);
  const pred = rnnStep(pitch);
  placeNote(pitch, x, y);
  placeNote(pred, x + 15, y + 10);
  statusEl.textContent = `Injected ${pitch} → predicted ${pred}`;
});

let auto = false;
document.getElementById('auto').onclick = () => {
  auto = !auto;
  statusEl.textContent = auto ? 'Auto improvising' : 'Auto off';
};
setInterval(() => {
  if (!auto) return;
  const last = notes.length ? notes[notes.length-1].pitch : 60;
  const pred = rnnStep(last + (Math.random()-0.5)*4);
  const angle = notes.length * 0.35;
  const r = 30 + notes.length * 1.8;
  placeNote(pred, W/2 + Math.cos(angle)*r, H/2 + Math.sin(angle)*r);
}, 420);

function draw() {
  ctx.fillStyle = '#0c0c18';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(100,140,255,0.25)';
  ctx.lineWidth = 1;
  for (let i = 1; i < notes.length; i++) {
    const a = notes[i-1], b = notes[i];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const n of notes) {
    n.age++;
    const alpha = Math.max(0.3, 1 - n.age / 400);
    const hue = (n.pitch - 36) * 4;
    ctx.fillStyle = `hsla(${hue}, 70%, 65%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 5 + n.vel * 3, 0, Math.PI*2);
    ctx.fill();
  }
  requestAnimationFrame(draw);
}
draw();

const DB = 'verse-score-f516';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
document.getElementById('seal').onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({
      weightsIn: Array.from(weightsIn),
      weightsHid: Array.from(weightsHid),
      bias: Array.from(bias),
      outW: Array.from(outW),
      hidden: Array.from(hidden),
      notes: notes.map(n => ({x:n.x,y:n.y,pitch:n.pitch,id:n.id})),
      ts: Date.now()
    }, 'genome');
    await new Promise(r => tx.oncomplete = r);
    statusEl.textContent = 'Sealed to IndexedDB';
  } catch (e) {
    statusEl.textContent = 'Seal failed (unattested)';
  }
};
document.getElementById('restore').onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get('genome');
    req.onsuccess = () => {
      const s = req.result;
      if (!s) { statusEl.textContent = 'No sealed genome'; return; }
      weightsIn.set(s.weightsIn);
      weightsHid.set(s.weightsHid);
      bias.set(s.bias);
      outW.set(s.outW);
      hidden.set(s.hidden);
      notes.length = 0;
      s.notes.forEach(n => notes.push({...n, vel:0.5, age:50}));
      statusEl.textContent = 'Restored ' + notes.length + ' notes';
    };
  } catch (e) {
    statusEl.textContent = 'Restore failed';
  }
};
document.getElementById('clear').onclick = () => {
  notes.length = 0;
  motifs.forEach(m => m.el.remove());
  motifs.length = 0;
  initRNN();
  statusEl.textContent = 'Cleared';
};

statusEl.textContent = 'Click canvas or connect MIDI';
