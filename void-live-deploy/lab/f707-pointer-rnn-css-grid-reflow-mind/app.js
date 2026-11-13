const grid = document.getElementById('grid');
const status = document.getElementById('status');
const cells = Array.from(document.querySelectorAll('.cell'));

// Simple Elman RNN weights (random init)
let weights = null;
function randomWeights() {
  const rand = () => (Math.random() - 0.5) * 0.4;
  return {
    Wh: Array.from({length: 8*4}, rand), // hidden from input
    Uh: Array.from({length: 8*8}, rand), // recurrent
    bh: Array.from({length: 8}, rand),
    Wo: Array.from({length: 5*8}, rand), // output from hidden
    bo: Array.from({length: 5}, rand),
    h: Array(8).fill(0)
  };
}
function loadWeights() {
  try {
    const s = localStorage.getItem('verse-f707-rnn-weights');
    if (s) {
      weights = JSON.parse(s);
      status.textContent = 'Restored sealed mind';
      return;
    }
  } catch (e) { console.debug("lab f707-pointer-rnn-css-grid-reflow-mind:", e); }
  weights = randomWeights();
}
loadWeights();

function tanh(x) { return Math.tanh(x); }
function stepRNN(input) {
  // input: [dx, dy, speed, bias]
  const hNew = new Array(8);
  for (let i = 0; i < 8; i++) {
    let sum = weights.bh[i];
    for (let j = 0; j < 4; j++) sum += weights.Wh[i*4 + j] * input[j];
    for (let j = 0; j < 8; j++) sum += weights.Uh[i*8 + j] * weights.h[j];
    hNew[i] = tanh(sum);
  }
  weights.h = hNew;
  const out = new Array(5);
  for (let i = 0; i < 5; i++) {
    let sum = weights.bo[i];
    for (let j = 0; j < 8; j++) sum += weights.Wo[i*8 + j] * weights.h[j];
    out[i] = tanh(sum);
  }
  return out;
}

let lastX = 0, lastY = 0;
let history = [];
document.addEventListener('pointermove', e => {
  const dx = (e.clientX - lastX) / window.innerWidth;
  const dy = (e.clientY - lastY) / window.innerHeight;
  lastX = e.clientX;
  lastY = e.clientY;
  const speed = Math.hypot(dx, dy);
  history.push([dx, dy, speed]);
  if (history.length > 8) history.shift();
});

function avgTextBias() {
  let total = 0;
  cells.forEach(c => total += c.textContent.length);
  return Math.min(1, total / 400) - 0.5;
}

function applyOutput(out) {
  // out: [c1, c2, c3, gap, hue] in [-1,1]
  const c1 = 0.6 + out[0] * 0.5;
  const c2 = 0.6 + out[1] * 0.5;
  const c3 = 0.6 + out[2] * 0.5;
  const sum = c1 + c2 + c3;
  grid.style.gridTemplateColumns = `${c1/sum*3}fr ${c2/sum*3}fr ${c3/sum*3}fr`;
  const gap = 8 + (out[3] + 1) * 12;
  document.documentElement.style.setProperty('--gap', gap + 'px');
  const hue = 180 + out[4] * 80;
  document.documentElement.style.setProperty('--hue', hue);
}

let running = true;
function loop() {
  if (!running) return;
  if (history.length) {
    const recent = history[history.length - 1];
    const bias = avgTextBias();
    const inp = [recent[0]*4, recent[1]*4, recent[2]*4, bias];
    const out = stepRNN(inp);
    applyOutput(out);
    status.textContent = `h-norm ${(weights.h.reduce((a,b)=>a+b*b,0)**0.5).toFixed(2)}`;
  }
  requestAnimationFrame(loop);
}
loop();

document.getElementById('seal').onclick = () => {
  try {
    localStorage.setItem('verse-f707-rnn-weights', JSON.stringify(weights));
    status.textContent = 'Sealed to localStorage';
  } catch(e) {
    status.textContent = 'Seal failed';
  }
};
document.getElementById('reset').onclick = () => {
  weights = randomWeights();
  status.textContent = 'Weights reset';
};
document.getElementById('download').onclick = () => {
  const data = {
    weights,
    cells: cells.map(c => c.textContent)
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'f707-mind-state.json';
  a.click();
};
