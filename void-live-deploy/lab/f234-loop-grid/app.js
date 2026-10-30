const STEPS = 8;
const PITCHES = [261.63, 329.63, 392.00, 523.25]; // C4 E4 G4 C5
const grid = Array.from({length: PITCHES.length}, () => Array(STEPS).fill(false));
const gridEl = document.getElementById('grid');
let audioCtx, playing = false, step = 0, timer;
const cells = [];

function buildGrid() {
  gridEl.innerHTML = '';
  cells.length = 0;
  for (let p = 0; p < PITCHES.length; p++) {
    for (let s = 0; s < STEPS; s++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.p = p;
      cell.dataset.s = s;
      cell.onclick = () => {
        grid[p][s] = !grid[p][s];
        cell.classList.toggle('on', grid[p][s]);
        saveState();
      };
      gridEl.appendChild(cell);
      cells.push(cell);
    }
  }
}
buildGrid();

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playNote(freq, time) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = document.getElementById('wave').value;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.15, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(time);
  osc.stop(time + 0.3);
}

function tick() {
  const bpm = +document.getElementById('tempo').value;
  const interval = 60 / bpm / 2; // 8th notes
  const now = audioCtx.currentTime;
  cells.forEach(c => c.classList.remove('playing'));
  for (let p = 0; p < PITCHES.length; p++) {
    if (grid[p][step]) {
      playNote(PITCHES[p], now);
      const idx = p * STEPS + step;
      cells[idx].classList.add('playing');
    }
  }
  step = (step + 1) % STEPS;
  timer = setTimeout(tick, interval * 1000);
}

document.getElementById('play').onclick = () => {
  initAudio();
  if (playing) return;
  playing = true;
  step = 0;
  tick();
  document.getElementById('status').textContent = 'Playing…';
};
document.getElementById('stop').onclick = () => {
  playing = false;
  clearTimeout(timer);
  cells.forEach(c => c.classList.remove('playing'));
  document.getElementById('status').textContent = 'Stopped.';
};
document.getElementById('clear').onclick = () => {
  grid.forEach(row => row.fill(false));
  cells.forEach(c => c.classList.remove('on'));
  saveState();
};
document.getElementById('tempo').oninput = e => {
  document.getElementById('tempoVal').textContent = e.target.value;
};

function getPattern() {
  return { grid, tempo: +document.getElementById('tempo').value, wave: document.getElementById('wave').value };
}
function saveState() {
  try {
    const json = JSON.stringify(getPattern());
    const b64 = btoa(unescape(encodeURIComponent(json)));
    history.replaceState(null, '', '#' + b64.slice(0, 1500));
  } catch (e) {}
}
function loadState() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(hash))));
    if (data.grid) {
      data.grid.forEach((row, p) => row.forEach((on, s) => {
        grid[p][s] = on;
        cells[p * STEPS + s].classList.toggle('on', on);
      }));
    }
    if (data.tempo) {
      document.getElementById('tempo').value = data.tempo;
      document.getElementById('tempoVal').textContent = data.tempo;
    }
    if (data.wave) document.getElementById('wave').value = data.wave;
    document.getElementById('status').textContent = 'Loaded shared loop.';
  } catch (e) { console.warn(e); }
}
document.getElementById('download').onclick = () => {
  const blob = new Blob([JSON.stringify(getPattern(), null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'loop-grid.json';
  a.click();
};
document.getElementById('share').onclick = () => {
  saveState();
  navigator.clipboard.writeText(location.href).then(() => {
    document.getElementById('status').textContent = 'Share link copied.';
  }).catch(() => alert(location.href));
};
loadState();
