const $ = id => document.getElementById(id);
const fill = $('fill'), levelEl = $('level'), peakEl = $('peak'), status = $('status'), logEl = $('log');
const startBtn = $('start'), stopBtn = $('stop'), copyBtn = $('copy'), resetBtn = $('resetPeak'), dlBtn = $('download');

let audioCtx, analyser, source, stream, raf, peak = -Infinity, samples = [];
const PEAK_HOLD_MS = 1500;
let peakTime = 0;

function dbFromRms(rms) {
  if (rms < 1e-8) return -Infinity;
  return 20 * Math.log10(rms);
}

function formatDb(db) {
  if (!isFinite(db) || db < -100) return '−∞';
  return db.toFixed(1);
}

function updateMeter(rms, peakSample) {
  const db = dbFromRms(rms);
  const dbPeak = dbFromRms(peakSample);
  const now = performance.now();
  if (dbPeak > peak || now - peakTime > PEAK_HOLD_MS) {
    if (dbPeak > peak) { peak = dbPeak; peakTime = now; }
  }
  // visual: map -60..0 to 0..100%
  const pct = Math.max(0, Math.min(100, (Math.max(db, -60) + 60) / 60 * 100));
  fill.style.width = pct + '%';
  levelEl.textContent = formatDb(db) + ' dBFS';
  peakEl.textContent = 'Peak ' + formatDb(peak) + ' dBFS';
  samples.push({ t: Date.now(), db, peak });
  if (samples.length > 200) samples.shift();
}

async function start() {
  try {
    status.textContent = 'Requesting microphone…';
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    function loop() {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0, max = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i];
        sum += v * v;
        max = Math.max(max, Math.abs(v));
      }
      const rms = Math.sqrt(sum / buf.length);
      updateMeter(rms, max);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    startBtn.disabled = true;
    stopBtn.disabled = false;
    copyBtn.disabled = false;
    dlBtn.disabled = false;
    status.textContent = 'Listening. Speak or make a sound.';
  } catch (e) {
    status.textContent = 'Microphone unavailable: ' + (e.name || e.message) + '. Check permission and that the page is secure (https).';
  }
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (audioCtx) audioCtx.close();
  stream = audioCtx = source = analyser = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  status.textContent = 'Stopped.';
}

function copyReading() {
  const text = `Sound level: ${levelEl.textContent} (peak ${peakEl.textContent.replace('Peak ','')}) — relative dBFS, not calibrated.`;
  navigator.clipboard.writeText(text).then(() => {
    status.textContent = 'Copied to clipboard.';
  }).catch(() => {
    status.textContent = 'Copy failed. Select the number and copy manually.';
  });
}

function resetPeak() {
  peak = -Infinity;
  peakTime = 0;
  peakEl.textContent = 'Peak —';
}

function downloadLog() {
  const lines = ['timestamp,dBFS,peak_dBFS', ...samples.map(s => `${new Date(s.t).toISOString()},${isFinite(s.db)?s.db.toFixed(2):''},${isFinite(s.peak)?s.peak.toFixed(2):''}`)];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sound-level-log.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  status.textContent = 'Log downloaded.';
}

startBtn.onclick = start;
stopBtn.onclick = stop;
copyBtn.onclick = copyReading;
resetBtn.onclick = resetPeak;
dlBtn.onclick = downloadLog;

// prevent sleep while listening? optional, skip for simplicity
