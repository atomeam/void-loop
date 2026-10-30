// F316 — WebXR Hand-Sealed Genome DOM Arena
// Branch: true WebXR hands as primary causal input + multi-agent sealed genome transfer + hybrid DOM+canvas + IndexedDB persistence
// Away from WebGPU neural/spectral/NCA/MLP-swarm clusters

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const exportArea = document.getElementById('export-area');
const exportTa = document.getElementById('export-ta');

let W = innerWidth, H = innerHeight;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// Agents: simple rule genomes (not neural)
// Genome: [attract_food, repel_others, speed, wander, cohesion]
const NUM_AGENTS = 6;
const agents = [];
const cards = [];
for (let i = 0; i < NUM_AGENTS; i++) {
  const genome = Array.from({length: 5}, () => Math.random() * 2 - 0.5);
  agents.push({
    id: i,
    x: Math.random() * W, y: Math.random() * H,
    vx: 0, vy: 0,
    genome,
    fitness: 0,
    color: `hsl(${i * 60}, 70%, 55%)`,
    sealed: false
  });
  const card = document.createElement('div');
  card.className = 'agent-card';
  card.innerHTML = `<div>A${i}</div><div class="fit">0</div>`;
  document.body.appendChild(card);
  cards.push(card);
}

let foods = Array.from({length: 12}, () => ({ x: Math.random()*W, y: Math.random()*H, life: 1 }));
let hands = []; // {x,y} from WebXR or pointer
let orientBias = {x: 0, y: 0};
let xrSession = null;
let champion = null;

// IndexedDB for sealed genomes
const DB_NAME = 'void-f316-genomes';
let db;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes', { keyPath: 'hash' });
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = rej;
  });
}
async function sealGenome(genome, fitness) {
  if (!db) await openDB().catch(() => {});
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(genome)))
    .then(b => Array.from(new Uint8Array(b)).slice(0,8).map(x=>x.toString(16).padStart(2,'0')).join(''));
  const rec = { hash, genome, fitness, ts: Date.now() };
  if (db) {
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(rec);
  }
  localStorage.setItem('f316-last-seal', JSON.stringify(rec));
  return rec;
}
function loadLastSeal() {
  try {
    const s = localStorage.getItem('f316-last-seal');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

// Simulation step
function step() {
  // Apply orientation bias
  const bx = orientBias.x * 0.4, by = orientBias.y * 0.4;

  agents.forEach(a => {
    let fx = bx, fy = by;
    // Food attraction
    let nearest = null, nd = Infinity;
    foods.forEach(f => {
      const dx = f.x - a.x, dy = f.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (d < nd) { nd = d; nearest = f; }
      if (d < 180) {
        fx += (dx / d) * a.genome[0] * (1 - d/180);
        fy += (dy / d) * a.genome[0] * (1 - d/180);
      }
    });
    // Repel others
    agents.forEach(o => {
      if (o === a) return;
      const dx = a.x - o.x, dy = a.y - o.y, d = Math.hypot(dx, dy) || 1;
      if (d < 120) {
        fx += (dx / d) * a.genome[1];
        fy += (dy / d) * a.genome[1];
      }
    });
    // Wander
    fx += (Math.random() - 0.5) * a.genome[3];
    fy += (Math.random() - 0.5) * a.genome[3];
    // Cohesion to hand if present
    hands.forEach(h => {
      const dx = h.x - a.x, dy = h.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (d < 220) {
        fx += (dx / d) * a.genome[4] * 0.6;
        fy += (dy / d) * a.genome[4] * 0.6;
      }
    });

    const speed = 1.2 + a.genome[2];
    a.vx = (a.vx + fx * 0.15) * 0.92;
    a.vy = (a.vy + fy * 0.15) * 0.92;
    const mag = Math.hypot(a.vx, a.vy) || 1;
    a.vx = (a.vx / mag) * Math.min(mag, speed * 2.2);
    a.vy = (a.vy / mag) * Math.min(mag, speed * 2.2);
    a.x = (a.x + a.vx + W) % W;
    a.y = (a.y + a.vy + H) % H;

    // Fitness: proximity to food + hand interaction
    a.fitness *= 0.995;
    if (nearest && nd < 40) {
      a.fitness += 2;
      nearest.life -= 0.02;
    }
    hands.forEach(h => {
      if (Math.hypot(h.x - a.x, h.y - a.y) < 50) a.fitness += 0.5;
    });
  });

  // Respawn food
  foods = foods.filter(f => f.life > 0);
  while (foods.length < 12) foods.push({ x: Math.random()*W, y: Math.random()*H, life: 1 });

  // Competition: mutate weakest occasionally
  if (Math.random() < 0.008) {
    agents.sort((a,b) => b.fitness - a.fitness);
    const worst = agents[agents.length-1];
    const best = agents[0];
    worst.genome = best.genome.map(g => g + (Math.random()-0.5)*0.3);
    worst.fitness *= 0.3;
    champion = best;
  }
}

// Render
function render() {
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, W, H);
  // Food
  ctx.fillStyle = '#3a5';
  foods.forEach(f => {
    ctx.globalAlpha = f.life;
    ctx.beginPath(); ctx.arc(f.x, f.y, 6, 0, Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha = 1;
  // Hands
  ctx.strokeStyle = '#5ce1e6';
  ctx.lineWidth = 2;
  hands.forEach(h => {
    ctx.beginPath(); ctx.arc(h.x, h.y, 18, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(h.x, h.y, 6, 0, Math.PI*2); ctx.fill();
  });
  // Update DOM cards
  agents.forEach((a, i) => {
    const card = cards[i];
    card.style.left = (a.x - 36) + 'px';
    card.style.top = (a.y - 36) + 'px';
    card.style.borderColor = a.color;
    card.querySelector('.fit').textContent = a.fitness.toFixed(0);
    card.classList.toggle('champion', champion && champion.id === a.id);
  });
}

let raf;
function loop() {
  step();
  render();
  const best = agents.reduce((m,a) => a.fitness > m.fitness ? a : m, agents[0]);
  statusEl.textContent = `Agents: ${NUM_AGENTS} | Best fit: ${best.fitness.toFixed(0)} | Hands: ${hands.length} | Orient: ${orientBias.x.toFixed(2)},${orientBias.y.toFixed(2)}`;
  raf = requestAnimationFrame(loop);
}
loop();

// Pointer as hand fallback
canvas.addEventListener('pointermove', e => {
  if (!xrSession) hands = [{ x: e.clientX, y: e.clientY }];
});
canvas.addEventListener('pointerleave', () => { if (!xrSession) hands = []; });

// DeviceOrientation
document.getElementById('btn-orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') addEventListener('deviceorientation', onOrient);
    });
  } else {
    addEventListener('deviceorientation', onOrient);
  }
};
function onOrient(e) {
  orientBias.x = (e.gamma || 0) / 45;
  orientBias.y = (e.beta || 0) / 45;
}

// Seal
document.getElementById('btn-seal').onclick = async () => {
  const best = agents.reduce((m,a) => a.fitness > m.fitness ? a : m, agents[0]);
  const rec = await sealGenome(best.genome, best.fitness);
  best.sealed = true;
  statusEl.textContent = `Sealed ${rec.hash.slice(0,8)}… fit ${best.fitness.toFixed(0)}`;
  exportTa.value = JSON.stringify({ hash: rec.hash, genome: rec.genome, fitness: rec.fitness }, null, 2);
  exportArea.style.display = 'block';
};

// Export / Inject
document.getElementById('btn-export').onclick = () => {
  exportArea.style.display = exportArea.style.display === 'none' ? 'block' : 'none';
};
document.getElementById('btn-inject').onclick = () => {
  try {
    const data = JSON.parse(exportTa.value);
    if (data.genome && Array.isArray(data.genome)) {
      const worst = agents.reduce((m,a) => a.fitness < m.fitness ? a : m, agents[0]);
      worst.genome = data.genome.slice(0,5);
      worst.fitness = (data.fitness || 10) * 0.5;
      statusEl.textContent = `Injected genome into agent ${worst.id}`;
    }
  } catch (err) { statusEl.textContent = 'Invalid JSON'; }
};

// WebXR Hands
async function startXR() {
  if (!navigator.xr) { statusEl.textContent = 'WebXR not available — using pointer'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['hand-tracking']
    });
    const gl = canvas.getContext('webgl2', { xrCompatible: true });
    if (!gl) throw new Error('No WebGL');
    await gl.makeXRCompatible();
    const xrGlLayer = new XRWebGLLayer(xrSession, gl);
    xrSession.updateRenderState({ baseLayer: xrGlLayer });
    const refSpace = await xrSession.requestReferenceSpace('local');
    statusEl.textContent = 'WebXR hands active — move hands in space';
    const onFrame = (time, frame) => {
      const pose = frame.getViewerPose(refSpace);
      hands = [];
      if (pose) {
        for (const input of xrSession.inputSources) {
          if (input.hand) {
            const joint = input.hand.get('index-finger-tip') || input.hand.get('wrist');
            if (joint) {
              const jointPose = frame.getJointPose(joint, refSpace);
              if (jointPose) {
                // Project roughly to screen (simple mapping)
                const p = jointPose.transform.position;
                hands.push({
                  x: W/2 + p.x * 280,
                  y: H/2 - p.y * 280
                });
              }
            }
          }
        }
      }
      xrSession.requestAnimationFrame(onFrame);
    };
    xrSession.requestAnimationFrame(onFrame);
    xrSession.addEventListener('end', () => { xrSession = null; hands = []; });
  } catch (err) {
    statusEl.textContent = 'WebXR failed: ' + err.message + ' — pointer fallback';
    xrSession = null;
  }
}
document.getElementById('btn-xr').onclick = startXR;

// Load prior seal on start
openDB().then(() => {
  const last = loadLastSeal();
  if (last) {
    agents[0].genome = last.genome;
    statusEl.textContent = `Loaded prior seal ${last.hash.slice(0,6)}…`;
  }
}).catch(() => {});

console.log('F316 WebXR Hand-Sealed Genome DOM Arena ready');
