const N = 6;
const oracles = [];
const container = document.getElementById('oracles');
let leaderIdx = 0;
let handHistory = new Array(8).fill(0).map(() => [0.5, 0.5]);
let lastPred = [0.5, 0.5];
let residual = 0;
let xrSession = null;
let refSpace = null;
let handPose = null;

function createOracle(i) {
  const el = document.createElement('div');
  el.className = 'oracle';
  el.textContent = 'O' + i;
  el.dataset.idx = i;
  el.style.left = (10 + i * 12) + '%';
  el.style.top = (20 + (i % 3) * 20) + '%';
  const genome = Array.from({length: 4}, () => (Math.random() - 0.5) * 0.4);
  oracles.push({ el, genome, fitness: 1, x: 0.5, y: 0.5 });
  container.appendChild(el);
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId);
    el.dataset.drag = '1';
  });
  el.addEventListener('pointermove', e => {
    if (!el.dataset.drag) return;
    const r = container.getBoundingClientRect();
    oracles[i].x = (e.clientX - r.left) / r.width;
    oracles[i].y = (e.clientY - r.top) / r.height;
  });
  el.addEventListener('pointerup', () => delete el.dataset.drag);
}
for (let i = 0; i < N; i++) createOracle(i);

function predict(hist) {
  const avg = hist.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  avg[0] /= hist.length; avg[1] /= hist.length;
  return avg;
}

function updateOracles(targetX, targetY) {
  residual = Math.hypot(targetX - lastPred[0], targetY - lastPred[1]);
  lastPred = predict(handHistory);
  handHistory.shift();
  handHistory.push([targetX, targetY]);

  oracles.forEach((o, i) => {
    const corr = o.genome[0] * residual + o.genome[1] * (targetX - 0.5);
    o.x = Math.max(0.05, Math.min(0.95, o.x + corr * 0.05));
    o.y = Math.max(0.05, Math.min(0.95, o.y + o.genome[2] * residual * 0.03));
    o.fitness = Math.max(0.1, 1 - residual * (1 + o.genome[3]));
    o.el.style.left = (o.x * 100) + '%';
    o.el.style.top = (o.y * 100) + '%';
    o.el.style.transform = `scale(${0.7 + o.fitness * 0.4})`;
    o.el.classList.toggle('leader', i === leaderIdx);
    o.el.textContent = `O${i}\n${o.fitness.toFixed(2)}`;
  });

  if (Math.random() < 0.02) {
    let worst = 0;
    oracles.forEach((o, i) => { if (o.fitness < oracles[worst].fitness) worst = i; });
    oracles[worst].genome = oracles[leaderIdx].genome.map(w => w + (Math.random() - 0.5) * 0.1);
    oracles[worst].fitness = oracles[leaderIdx].fitness * 0.9;
  }
  leaderIdx = oracles.reduce((best, o, i) => o.fitness > oracles[best].fitness ? i : best, 0);
  document.getElementById('fitness').textContent = `Fitness: ${oracles[leaderIdx].fitness.toFixed(3)} res:${residual.toFixed(3)}`;
}

let pointer = [0.5, 0.5];
document.addEventListener('pointermove', e => {
  if (xrSession) return;
  const r = document.body.getBoundingClientRect();
  pointer = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
});

function loop() {
  let tx = pointer[0], ty = pointer[1];
  if (handPose) {
    tx = handPose[0]; ty = handPose[1];
  }
  updateOracles(tx, ty);
  requestAnimationFrame(loop);
}
loop();

document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { alert('WebXR not available'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['hand-tracking', 'local-floor']
    });
    xrSession = session;
    document.getElementById('mode').textContent = 'Mode: XR immersive';
    refSpace = await session.requestReferenceSpace('local-floor');
    session.requestAnimationFrame(onXRFrame);
    session.addEventListener('end', () => {
      xrSession = null;
      document.getElementById('mode').textContent = 'Mode: flat';
    });
  } catch (e) {
    console.warn(e);
    document.getElementById('mode').textContent = 'Mode: flat (XR denied)';
  }
};

function onXRFrame(time, frame) {
  if (!xrSession) return;
  const session = xrSession;
  const pose = frame.getViewerPose(refSpace);
  if (pose && frame.getHandPose) {
    try {
      const input = session.inputSources.find(s => s.hand);
      if (input && input.hand) {
        const wrist = frame.getJointPose(input.hand.get('wrist'), refSpace);
        if (wrist) {
          handPose = [
            0.5 + wrist.transform.position.x * 0.3,
            0.5 - wrist.transform.position.y * 0.3
          ];
        }
      }
    } catch (_) {}
  }
  session.requestAnimationFrame(onXRFrame);
}

const dbName = 'F216-oracle';
document.getElementById('seal').onclick = () => {
  const req = indexedDB.open(dbName, 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('leaders');
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('leaders', 'readwrite');
    tx.objectStore('leaders').put({
      genome: oracles[leaderIdx].genome,
      fitness: oracles[leaderIdx].fitness,
      ts: Date.now()
    }, 'leader');
    document.getElementById('status').textContent = 'Leader genome sealed to IndexedDB.';
  };
};

indexedDB.open(dbName).onsuccess = e => {
  const db = e.target.result;
  if (!db.objectStoreNames.contains('leaders')) return;
  const tx = db.transaction('leaders', 'readonly');
  tx.objectStore('leaders').get('leader').onsuccess = ev => {
    if (ev.target.result) {
      oracles[0].genome = ev.target.result.genome;
      document.getElementById('status').textContent = 'Loaded sealed leader.';
    }
  };
};
