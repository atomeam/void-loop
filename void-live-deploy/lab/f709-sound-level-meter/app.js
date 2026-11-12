const levelEl = document.getElementById('level');
const peakEl = document.getElementById('peak');
const statusEl = document.getElementById('status');
const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const copyBtn = document.getElementById('copy');
const downloadBtn = document.getElementById('download');
const resetPeakBtn = document.getElementById('resetPeak');

let audioCtx, analyser, source, stream;
let running = false;
let current = -Infinity;
let peak = -Infinity;
let history = []; // {t, db}
const MAX_HISTORY = 600; // ~60s at 10 Hz
const SAMPLE_INTERVAL = 100;

function loadState() {
  try {
    const raw = localStorage.getItem('verse-f709-sound');
    if (raw) {
      const data = JSON.parse(raw);
      if (typeof data.peak === 'number') peak = data.peak;
      if (Array.isArray(data.history)) history = data.history.slice(-MAX_HISTORY);
      updatePeakDisplay();
    }
  } catch (e) { console.debug("lab f709-sound-level-meter:", e); }
}

function saveState() {
  try {
    localStorage.setItem('verse-f709-sound', JSON.stringify({ peak, history: history.slice(-200) }));
  } catch (e) { console.debug("lab f709-sound-level-meter:", e); }
}

function updatePeakDisplay() {
  peakEl.textContent = peak > -Infinity ? `Peak: ${peak.toFixed(1)} dBFS` : 'Peak: —';
}

function drawGraph() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (history.length < 2) return;
  ctx.strokeStyle = '#58a6ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const minDb = -60, maxDb = 0;
  history.forEach((p, i) => {
    const x = (i / (history.length - 1)) * w;
    const norm = (p.db - minDb) / (maxDb - minDb);
    const y = h - Math.max(0, Math.min(1, norm)) * h;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  if (peak > -Infinity) {
    const y = h - Math.max(0, Math.min(1, (peak - minDb) / (maxDb - minDb))) * h;
    ctx.strokeStyle = '#f85149';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function computeRms(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / data.length);
}

async function start() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    running = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
    statusEl.textContent = 'Listening…';
    sampleLoop();
  } catch (err) {
    statusEl.textContent = 'Microphone access denied or unavailable.';
  }
}

function stop() {
  running = false;
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (audioCtx) audioCtx.close();
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusEl.textContent = 'Stopped.';
  saveState();
}

const dataArray = new Float32Array(2048);
let lastSample = 0;

function sampleLoop() {
  if (!running) return;
  requestAnimationFrame(sampleLoop);
  const now = performance.now();
  if (now - lastSample < SAMPLE_INTERVAL) return;
  lastSample = now;
  analyser.getFloatTimeDomainData(dataArray);
  const rms = computeRms(dataArray);
  current = rms > 0 ? 20 * Math.log10(rms) : -100;
  if (current > peak) peak = current;
  levelEl.textContent = current.toFixed(1);
  updatePeakDisplay();
  history.push({ t: Date.now(), db: current });
  if (history.length > MAX_HISTORY) history.shift();
  drawGraph();
}

startBtn.addEventListener('click', start);
stopBtn.addEventListener('click', stop);
resetPeakBtn.addEventListener('click', () => { peak = -Infinity; updatePeakDisplay(); saveState(); });

copyBtn.addEventListener('click', async () => {
  const text = `Current: ${current.toFixed(1)} dBFS\nPeak: ${peak > -Infinity ? peak.toFixed(1) : '—'} dBFS\n(Relative, device microphone)`;
  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = 'Copied to clipboard.';
  } catch {
    statusEl.textContent = 'Copy failed (permission).';
  }
});

downloadBtn.addEventListener('click', () => {
  const lines = ['timestamp_ms,dBFS'];
  history.forEach(p => lines.push(`${p.t},${p.db.toFixed(2)}`));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sound-level-${new Date().toISOString().slice(0,19).replace(/:/g,'')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  statusEl.textContent = 'CSV downloaded.';
});

window.addEventListener('beforeunload', saveState);
loadState();
drawGraph();
