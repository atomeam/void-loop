const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
addEventListener('resize', () => { W = cv.width = innerWidth; H = cv.height = innerHeight; });

const N = 120;
const particles = Array.from({length:N}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: 0, vy: 0
}));

// Local Gaussian Process proxy: simple kernel regression on pointer history
const history = [];
const MAXH = 40;
let gpWeights = Array(8).fill(0.1); // simple linear features

function extractFeatures(px, py, t) {
  return [
    px/W, py/H, Math.sin(t*0.01), Math.cos(t*0.01),
    (px-W/2)/W, (py-H/2)/H, Math.random()*0.1, 1
  ];
}

function gpPredict(f) {
  return gpWeights.reduce((s, w, i) => s + w * f[i], 0);
}

let mouse = {x: W/2, y: H/2, down: false};
addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
addEventListener('pointerdown', e => { mouse.down = true; reward(e.clientX, e.clientY); });
addEventListener('pointerup', () => mouse.down = false);

function reward(x, y) {
  const f = extractFeatures(x, y, performance.now());
  const pred = gpPredict(f);
  const target = 1.0; // high density reward
  const err = target - pred;
  // simple online update
  for (let i = 0; i < gpWeights.length; i++) {
    gpWeights[i] += 0.05 * err * f[i];
  }
  history.push({x, y, t: performance.now()});
  if (history.length > MAXH) history.shift();
  status.textContent = `Reward err:${err.toFixed(2)}`;
}

const portals = [];
function spawnPortal(x, y) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'Portal';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  portals.push({el, x, y, vx:0, vy:0});
  el.addEventListener('pointerdown', ev => {
    ev.stopPropagation();
    const startX = ev.clientX - el.offsetLeft;
    const startY = ev.clientY - el.offsetTop;
    function move(e) {
      el.style.left = (e.clientX - startX) + 'px';
      el.style.top = (e.clientY - startY) + 'px';
    }
    function up() {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      reward(parseFloat(el.style.left), parseFloat(el.style.top));
    }
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });
}

const status = document.getElementById('status');
document.getElementById('seal').onclick = () => {
  localStorage.setItem('f732-gp', JSON.stringify({weights: gpWeights, ts: Date.now()}));
  status.textContent = 'Sealed';
};
document.getElementById('reset').onclick = () => {
  gpWeights = Array(8).fill(0.1);
  portals.forEach(p => p.el.remove());
  portals.length = 0;
  status.textContent = 'Reset';
};
try {
  const saved = JSON.parse(localStorage.getItem('f732-gp') || 'null');
  if (saved) gpWeights = saved.weights;
} catch (e) { console.debug("lab f732-local-gp-spatial-portal-mind:", e); }

function step() {
  const t = performance.now();
  const f = extractFeatures(mouse.x, mouse.y, t);
  const pred = gpPredict(f);
  const attract = Math.max(0, pred);

  ctx.fillStyle = 'rgba(10,10,18,0.2)';
  ctx.fillRect(0,0,W,H);

  particles.forEach(p => {
    const dx = mouse.x - p.x, dy = mouse.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    p.vx += (dx / d) * attract * 0.05 + (Math.random()-0.5)*0.1;
    p.vy += (dy / d) * attract * 0.05 + (Math.random()-0.5)*0.1;
    p.vx *= 0.95; p.vy *= 0.95;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -1;
    if (p.y < 0 || p.y > H) p.vy *= -1;
    ctx.fillStyle = `hsl(${(pred*60+200)%360},80%,60%)`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2 + attract*2, 0, Math.PI*2); ctx.fill();
  });

  // spawn portal occasionally in high pred
  if (Math.random() < 0.005 * attract && portals.length < 6) {
    spawnPortal(mouse.x + (Math.random()-0.5)*100, mouse.y + (Math.random()-0.5)*100);
  }

  // move portals slightly toward high areas
  portals.forEach(p => {
    const dx = mouse.x - p.x, dy = mouse.y - p.y;
    p.el.style.transform = `scale(${1 + attract*0.3})`;
  });

  requestAnimationFrame(step);
}
step();
