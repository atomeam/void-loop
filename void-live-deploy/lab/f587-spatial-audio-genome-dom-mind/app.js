const N = 6;
const agents = [];
let audioCtx, listener;
let sealed = null;
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');

function createAgent(i, genome) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const panner = audioCtx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1;
  panner.maxDistance = 20;
  panner.rolloffFactor = 1;
  osc.type = genome.type || 'sine';
  osc.frequency.value = genome.freq || 220 + i * 40;
  gain.gain.value = genome.gain || 0.15;
  osc.connect(gain);
  gain.connect(panner);
  panner.connect(audioCtx.destination);
  osc.start();
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = `A${i}`;
  stage.appendChild(el);
  return { osc, gain, panner, el, genome, fitness: 0, id: i };
}

function randomGenome() {
  const types = ['sine', 'square', 'sawtooth', 'triangle'];
  return {
    freq: 120 + Math.random() * 600,
    type: types[Math.floor(Math.random() * types.length)],
    gain: 0.08 + Math.random() * 0.2,
    x: (Math.random() - 0.5) * 8,
    y: (Math.random() - 0.5) * 6,
    z: (Math.random() - 0.5) * 4
  };
}

function project(pos) {
  const scale = 80 / (pos.z + 6);
  return {
    x: window.innerWidth / 2 + pos.x * scale * 40,
    y: window.innerHeight / 2 + pos.y * scale * 40
  };
}

function updateStyles(a) {
  const g = a.genome;
  const hue = (g.freq / 10) % 360;
  a.el.style.background = `hsla(${hue}, 70%, 40%, 0.85)`;
  a.el.style.color = `hsl(${hue}, 80%, 70%)`;
  a.el.style.transform = `scale(${0.6 + g.gain * 2})`;
  a.el.style.borderRadius = g.type === 'square' ? '4px' : '50%';
}

let frame = 0;
function loop() {
  requestAnimationFrame(loop);
  if (!audioCtx) return;
  frame++;
  const lx = (pointer.x / window.innerWidth - 0.5) * 6;
  const ly = (pointer.y / window.innerHeight - 0.5) * -4;
  const lz = 0;
  if (listener) {
    listener.positionX.value = lx;
    listener.positionY.value = ly;
    listener.positionZ.value = lz;
  }
  agents.forEach(a => {
    const p = a.genome;
    a.panner.positionX.value = p.x;
    a.panner.positionY.value = p.y;
    a.panner.positionZ.value = p.z;
    const proj = project(p);
    a.el.style.left = (proj.x - 40) + 'px';
    a.el.style.top = (proj.y - 40) + 'px';
    updateStyles(a);
    const dx = p.x - lx, dy = p.y - ly, dz = p.z - lz;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.1;
    a.fitness = 0.9 * a.fitness + 0.1 * (1 / dist);
  });
  if (frame % 40 === 0 && agents.length) {
    agents.sort((a, b) => b.fitness - a.fitness);
    const best = agents[0].genome;
    agents.forEach((a, i) => {
      if (i > 1 && Math.random() < 0.4) {
        a.genome.freq = best.freq * (0.85 + Math.random() * 0.3);
        a.genome.gain = Math.max(0.05, Math.min(0.3, best.gain + (Math.random()-0.5)*0.05));
        a.genome.x += (best.x - a.genome.x) * 0.15 + (Math.random()-0.5)*0.4;
        a.genome.y += (best.y - a.genome.y) * 0.15 + (Math.random()-0.5)*0.4;
        a.genome.z += (best.z - a.genome.z) * 0.1 + (Math.random()-0.5)*0.3;
        a.osc.frequency.setTargetAtTime(a.genome.freq, audioCtx.currentTime, 0.05);
        a.gain.gain.setTargetAtTime(a.genome.gain, audioCtx.currentTime, 0.05);
      }
    });
  }
}

const pointer = { x: window.innerWidth/2, y: window.innerHeight/2 };
window.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
window.addEventListener('deviceorientation', e => {
  if (e.beta != null) {
    pointer.x = window.innerWidth/2 + e.gamma * 3;
    pointer.y = window.innerHeight/2 + e.beta * 2;
  }
});

document.getElementById('start').onclick = async () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    listener = audioCtx.listener;
    for (let i = 0; i < N; i++) {
      agents.push(createAgent(i, randomGenome()));
    }
    statusEl.textContent = 'Audio live. Move pointer / tilt to attract the swarm.';
    loop();
  } else if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
    statusEl.textContent = 'Resumed.';
  }
};

async function seal() {
  if (!agents.length) return;
  const data = {
    genomes: agents.map(a => a.genome),
    t: Date.now()
  };
  const db = await idbOpen();
  const tx = db.transaction('seals', 'readwrite');
  tx.objectStore('seals').put(data, 'verse-f587');
  await tx.complete;
  statusEl.textContent = 'Sealed to IndexedDB.';
}

async function restore() {
  const db = await idbOpen();
  const tx = db.transaction('seals', 'readonly');
  const req = tx.objectStore('seals').get('verse-f587');
  req.onsuccess = () => {
    const data = req.result;
    if (!data || !agents.length) return;
    data.genomes.forEach((g, i) => {
      if (agents[i]) {
        agents[i].genome = { ...g };
        agents[i].osc.frequency.setTargetAtTime(g.freq, audioCtx.currentTime, 0.1);
        agents[i].gain.gain.setTargetAtTime(g.gain, audioCtx.currentTime, 0.1);
        agents[i].osc.type = g.type;
      }
    });
    statusEl.textContent = 'Restored sealed genome.';
  };
}

function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-f587', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seals');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}

document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('clear').onclick = async () => {
  const db = await idbOpen();
  const tx = db.transaction('seals', 'readwrite');
  tx.objectStore('seals').delete('verse-f587');
  statusEl.textContent = 'Seal cleared.';
};

statusEl.textContent = 'Click Start to awaken the spatial audio mind.';
