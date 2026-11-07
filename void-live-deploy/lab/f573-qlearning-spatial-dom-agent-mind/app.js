const tiles = [];
const N = 8;
const actions = ['spread', 'cluster', 'rotate', 'jitter', 'align'];
let qTable = {};
let currentState = 'mid';
let epsilon = 0.35;
let alpha = 0.12;
let gamma = 0.92;
let accumReward = 0;
let lastAction = 'init';
let step = 0;

function createTiles() {
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'tile';
    el.textContent = 'T' + (i + 1);
    el.style.left = (80 + Math.random() * (window.innerWidth - 200)) + 'px';
    el.style.top = (80 + Math.random() * (window.innerHeight - 200)) + 'px';
    document.body.appendChild(el);
    tiles.push(el);
    el.addEventListener('click', () => {
      accumReward += 1.0;
      el.classList.add('reward');
      setTimeout(() => el.classList.remove('reward'), 400);
    });
    el.addEventListener('mouseenter', () => { accumReward += 0.15; });
  }
}

function getState() {
  let cx = 0, cy = 0;
  tiles.forEach(t => {
    cx += parseFloat(t.style.left);
    cy += parseFloat(t.style.top);
  });
  cx /= N; cy /= N;
  let varSum = 0;
  tiles.forEach(t => {
    const dx = parseFloat(t.style.left) - cx;
    const dy = parseFloat(t.style.top) - cy;
    varSum += dx * dx + dy * dy;
  });
  const avgDist = Math.sqrt(varSum / N);
  if (avgDist < 120) return 'tight';
  if (avgDist < 280) return 'mid';
  return 'spread';
}

function applyAction(act) {
  lastAction = act;
  const w = window.innerWidth, h = window.innerHeight;
  const cx = w * 0.5, cy = h * 0.5;
  tiles.forEach((t, i) => {
    let x = parseFloat(t.style.left);
    let y = parseFloat(t.style.top);
    if (act === 'spread') {
      x += (x - cx) * 0.06;
      y += (y - cy) * 0.06;
    } else if (act === 'cluster') {
      x += (cx - x) * 0.09;
      y += (cy - y) * 0.09;
    } else if (act === 'rotate') {
      const dx = x - cx, dy = y - cy;
      const ang = 0.12;
      x = cx + dx * Math.cos(ang) - dy * Math.sin(ang);
      y = cy + dx * Math.sin(ang) + dy * Math.cos(ang);
    } else if (act === 'jitter') {
      x += (Math.random() - 0.5) * 50;
      y += (Math.random() - 0.5) * 50;
    } else if (act === 'align') {
      y = cy + (i - N / 2) * 36;
      x = cx + (Math.random() - 0.5) * 30;
    }
    x = Math.max(40, Math.min(w - 130, x));
    y = Math.max(40, Math.min(h - 110, y));
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  });
}

function ensureQ(state) {
  if (!qTable[state]) qTable[state] = {};
  actions.forEach(a => { if (!(a in qTable[state])) qTable[state][a] = 0; });
}

function chooseAction(state) {
  ensureQ(state);
  if (Math.random() < epsilon) return actions[Math.floor(Math.random() * actions.length)];
  let best = actions[0], maxQ = -Infinity;
  actions.forEach(a => {
    const q = qTable[state][a];
    if (q > maxQ) { maxQ = q; best = a; }
  });
  return best;
}

function updateQ(s, a, r, s2) {
  ensureQ(s); ensureQ(s2);
  const maxNext = Math.max(...actions.map(aa => qTable[s2][aa]));
  const old = qTable[s][a];
  qTable[s][a] = old + alpha * (r + gamma * maxNext - old);
}

function updateUI(r, state) {
  document.getElementById('action').textContent = lastAction;
  document.getElementById('reward').textContent = r.toFixed(2);
  document.getElementById('eps').textContent = epsilon.toFixed(2);
  document.getElementById('state').textContent = state;
  let qmax = 0;
  for (const qs of Object.values(qTable)) {
    for (const v of Object.values(qs)) if (v > qmax) qmax = v;
  }
  document.getElementById('qmax').textContent = qmax.toFixed(2);
}

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function drawMind() {
  ctx.fillStyle = 'rgba(10,10,20,0.12)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(80,180,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 1; i < tiles.length; i++) {
    const a = tiles[i - 1], b = tiles[i];
    ctx.moveTo(parseFloat(a.style.left) + 45, parseFloat(a.style.top) + 35);
    ctx.lineTo(parseFloat(b.style.left) + 45, parseFloat(b.style.top) + 35);
  }
  ctx.stroke();
  requestAnimationFrame(drawMind);
}

function agentStep() {
  step++;
  if (step % 25 === 0) {
    const action = chooseAction(currentState);
    applyAction(action);
    const newState = getState();
    const r = accumReward * 0.25;
    updateQ(currentState, action, r, newState);
    accumReward *= 0.92;
    currentState = newState;
    updateUI(r, newState);
    if (epsilon > 0.08) epsilon *= 0.9995;
  }
  requestAnimationFrame(agentStep);
}

// Persistence
function saveQ() {
  try { localStorage.setItem('verse-f573-qtable', JSON.stringify(qTable)); } catch (e) { console.debug("lab f573-qlearning-spatial-dom-agent-mind:", e); }
}
function loadQ() {
  try {
    const raw = localStorage.getItem('verse-f573-qtable');
    if (raw) qTable = JSON.parse(raw);
  } catch (e) { console.debug("lab f573-qlearning-spatial-dom-agent-mind:", e); }
}

createTiles();
loadQ();
currentState = getState();
drawMind();
agentStep();
setInterval(saveQ, 4000);
