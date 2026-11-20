const N = 7;
const agents = [];
const scene = document.getElementById('scene');
let tiltX = 0, tiltY = 0;
let pointerVX = 0, pointerVY = 0;
let lastPX = 0, lastPY = 0;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const oscillators = [];

function rand(a, b) { return a + Math.random() * (b - a); }

function createAgent(i) {
  const el = document.createElement('div');
  el.className = 'tile';
  el.contentEditable = true;
  el.textContent = `Verse tile ${i}\nagent mind`;
  el.style.setProperty('--h', rand(0, 360));
  scene.appendChild(el);

  const genome = {
    hue: rand(0, 360),
    speed: rand(0.4, 1.2),
    biasY: rand(-0.3, 0.3),
    social: rand(0.2, 0.8)
  };

  const agent = {
    el, genome,
    x: rand(100, window.innerWidth - 200),
    y: rand(80, window.innerHeight - 200),
    z: rand(-120, 80),
    vx: 0, vy: 0, vz: 0,
    fitness: 0
  };

  // Audio
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 120 + genome.hue * 0.5;
  gain.gain.value = 0.0;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  oscillators.push({ osc, gain, agent });

  el.addEventListener('pointerdown', e => {
    agent.dragging = true;
    agent.ox = e.clientX - agent.x;
    agent.oy = e.clientY - agent.y;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!agent.dragging) return;
    agent.x = e.clientX - agent.ox;
    agent.y = e.clientY - agent.oy;
    agent.vx = agent.vy = 0;
  });
  el.addEventListener('pointerup', () => { agent.dragging = false; });
  el.addEventListener('click', () => reward(agent));

  agents.push(agent);
  return agent;
}

function reward(agent) {
  agent.fitness += 1;
  // Simple reinforcement: move genome slightly toward current visual state
  agent.genome.hue = agent.genome.hue * 0.85 + (parseFloat(agent.el.style.getPropertyValue('--h')) || agent.genome.hue) * 0.15;
  agent.genome.speed = Math.min(2, agent.genome.speed * 1.05);
  agent.el.style.setProperty('--h', agent.genome.hue);
  document.getElementById('status').textContent = `Rewarded agent · fitness ${agent.fitness.toFixed(0)}`;
}

function update() {
  const gX = tiltX * 0.15 + pointerVX * 0.02;
  const gY = tiltY * 0.15 + pointerVY * 0.02;

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (a.dragging) continue;

    // Local rules
    a.vx += gX + (Math.random() - 0.5) * a.genome.speed * 0.4;
    a.vy += gY + a.genome.biasY + (Math.random() - 0.5) * a.genome.speed * 0.3;
    a.vz += (Math.random() - 0.5) * 0.2;

    // Soft social
    for (let j = 0; j < agents.length; j++) {
      if (i === j) continue;
      const b = agents[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) + 1;
      if (d < 180) {
        const f = (180 - d) / 180 * a.genome.social * 0.08;
        a.vx -= dx / d * f;
        a.vy -= dy / d * f;
      }
    }

    a.vx *= 0.92; a.vy *= 0.92; a.vz *= 0.95;
    a.x += a.vx; a.y += a.vy; a.z += a.vz;

    // Bounds
    a.x = Math.max(20, Math.min(window.innerWidth - 160, a.x));
    a.y = Math.max(40, Math.min(window.innerHeight - 120, a.y));
    a.z = Math.max(-200, Math.min(120, a.z));

    a.el.style.transform = `translate3d(${a.x}px, ${a.y}px, ${a.z}px)`;
    a.el.style.setProperty('--h', a.genome.hue);

    // Audio modulation
    const act = Math.min(1, Math.hypot(a.vx, a.vy) * 0.3);
    const o = oscillators[i];
    if (o && audioCtx.state === 'running') {
      o.osc.frequency.setTargetAtTime(140 + a.genome.hue * 0.6 + act * 40, audioCtx.currentTime, 0.1);
      o.gain.gain.setTargetAtTime(0.015 * act, audioCtx.currentTime, 0.05);
    }
  }
  requestAnimationFrame(update);
}

// Orientation
window.addEventListener('deviceorientation', e => {
  if (e.beta != null) tiltY = (e.beta - 45) / 45;
  if (e.gamma != null) tiltX = e.gamma / 45;
});

// Pointer residual
window.addEventListener('pointermove', e => {
  pointerVX = e.clientX - lastPX;
  pointerVY = e.clientY - lastPY;
  lastPX = e.clientX; lastPY = e.clientY;
});

// Seal
document.getElementById('seal').onclick = async () => {
  const data = agents.map(a => ({ genome: a.genome, fitness: a.fitness }));
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f864', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(data, 'colony');
    await new Promise(r => tx.oncomplete = r);
  } catch (e) {
    sessionStorage.setItem('f864-genomes', JSON.stringify(data));
  }
  const bc = new BroadcastChannel('f864-genomes');
  bc.postMessage(data);
  document.getElementById('status').textContent = 'Genomes sealed & broadcast';
};

document.getElementById('audio').onclick = () => audioCtx.resume();
document.getElementById('reset').onclick = () => location.reload();

// Listen for other tabs
const bc = new BroadcastChannel('f864-genomes');
bc.onmessage = ev => {
  if (Array.isArray(ev.data) && ev.data.length === agents.length) {
    ev.data.forEach((d, i) => {
      if (d.fitness > agents[i].fitness) {
        agents[i].genome = { ...d.genome };
        agents[i].fitness = d.fitness;
      }
    });
    document.getElementById('status').textContent = 'Adopted higher-fitness genomes from another tab';
  }
};

// Init
for (let i = 0; i < N; i++) createAgent(i);
update();
