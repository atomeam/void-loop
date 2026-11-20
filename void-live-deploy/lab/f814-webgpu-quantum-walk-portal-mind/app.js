const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W = 128, H = 72;
let scaleX, scaleY;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  scaleX = canvas.width / W;
  scaleY = canvas.height / H;
}
resize();
addEventListener('resize', resize);

// Classical fallback quantum-inspired walk (complex amplitudes simulated in JS for reliability)
let amp = new Float32Array(W * H * 4); // re0, im0, re1, im1
function idx(x, y, c) { return ((y * W + x) * 4) + c; }

function seed(x, y, strength = 0.8) {
  const i = idx(x, y, 0);
  amp[i] = strength; amp[i+1] = 0;
  amp[i+2] = strength * 0.3; amp[i+3] = 0.2;
}

seed(W/2, H/2, 1.0);

// Portals
const portals = [];
for (let i = 0; i < 5; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.style.left = (20 + i * 15) + '%';
  el.style.top = (30 + (i % 3) * 20) + '%';
  document.body.appendChild(el);
  portals.push({ el, x: 0, y: 0, phase: Math.random() * Math.PI });
  makeDraggable(el, i);
}

function updatePortalPositions() {
  portals.forEach(p => {
    const r = p.el.getBoundingClientRect();
    p.x = Math.floor((r.left + r.width/2) / scaleX);
    p.y = Math.floor((r.top + r.height/2) / scaleY);
  });
}

function makeDraggable(el, i) {
  let ox, oy;
  el.onpointerdown = e => {
    ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop;
    el.setPointerCapture(e.pointerId);
  };
  el.onpointermove = e => {
    if (e.buttons) {
      el.style.left = (e.clientX - ox) + 'px';
      el.style.top = (e.clientY - oy) + 'px';
      updatePortalPositions();
      // inject seed
      const px = Math.floor((e.clientX) / scaleX);
      const py = Math.floor((e.clientY) / scaleY);
      if (px >= 0 && px < W && py >= 0 && py < H) seed(px, py, 0.4);
    }
  };
}

// Tiny RNN mind
let h = new Float32Array(8);
function mindStep(obs) {
  for (let i = 0; i < 8; i++) {
    h[i] = Math.tanh(h[i] * 0.85 + obs[i % obs.length] * 0.4 + (Math.random()-0.5)*0.05);
  }
  return h[0] * 0.3; // coin bias
}

let bias = 0;
function step() {
  updatePortalPositions();
  const next = new Float32Array(amp.length);
  // Simplified Hadamard-like coin + shift with phase from portals
  for (let y = 1; y < H-1; y++) {
    for (let x = 1; x < W-1; x++) {
      let re0 = amp[idx(x,y,0)], im0 = amp[idx(x,y,1)];
      let re1 = amp[idx(x,y,2)], im1 = amp[idx(x,y,3)];
      // coin
      const c = 0.707 * (1 + bias);
      const s = 0.707 * (1 - bias);
      const nre0 = c*re0 + s*re1;
      const nim0 = c*im0 + s*im1;
      const nre1 = s*re0 - c*re1;
      const nim1 = s*im0 - c*im1;
      // phase from nearby portals
      let phase = 0;
      portals.forEach(p => {
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < 8) phase += p.phase * (1 - d/8);
      });
      const cp = Math.cos(phase), sp = Math.sin(phase);
      // shift (right for 0, left for 1, simplified)
      const tx0 = x+1, tx1 = x-1;
      if (tx0 < W) {
        next[idx(tx0,y,0)] += nre0*cp - nim0*sp;
        next[idx(tx0,y,1)] += nre0*sp + nim0*cp;
      }
      if (tx1 >= 0) {
        next[idx(tx1,y,2)] += nre1*cp - nim1*sp;
        next[idx(tx1,y,3)] += nre1*sp + nim1*cp;
      }
    }
  }
  // normalize roughly
  let norm = 0;
  for (let i = 0; i < next.length; i += 2) norm += next[i]*next[i] + next[i+1]*next[i+1];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < next.length; i++) amp[i] = next[i] / norm * 0.98;
  // mind observation
  const obs = portals.map(p => {
    let pprob = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = Math.max(0, Math.min(W-1, p.x+dx));
      const yy = Math.max(0, Math.min(H-1, p.y+dy));
      const re = amp[idx(xx,yy,0)], im = amp[idx(xx,yy,1)];
      pprob += re*re + im*im;
    }
    return pprob;
  });
  bias = mindStep(obs);
  portals.forEach((p, i) => p.phase += bias * 0.1 + obs[i] * 0.05);
}

function render() {
  const img = ctx.createImageData(canvas.width, canvas.height);
  const data = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const re = amp[idx(x,y,0)], im = amp[idx(x,y,1)];
      const prob = Math.min(1, (re*re + im*im) * 12);
      const hue = (Math.atan2(im, re) + Math.PI) / (2*Math.PI);
      const r = Math.floor(prob * 255 * (0.5 + 0.5*Math.sin(hue*6.28)));
      const g = Math.floor(prob * 180);
      const b = Math.floor(prob * 255 * (0.5 + 0.5*Math.cos(hue*6.28)));
      for (let sy = 0; sy < scaleY; sy++) for (let sx = 0; sx < scaleX; sx++) {
        const px = Math.floor(x * scaleX + sx);
        const py = Math.floor(y * scaleY + sy);
        if (px < canvas.width && py < canvas.height) {
          const pi = (py * canvas.width + px) * 4;
          data[pi] = r; data[pi+1] = g; data[pi+2] = b; data[pi+3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // update portal visuals
  portals.forEach(p => {
    const scale = 0.8 + Math.abs(Math.sin(p.phase)) * 0.6;
    p.el.style.transform = `scale(${scale})`;
    p.el.style.background = `radial-gradient(circle, hsl(${(p.phase*50)%360}, 80%, 70%) 0%, #28f 70%, transparent 100%)`;
  });
}

// Audio
let ac, oscs = [];
function initAudio() {
  if (ac) return;
  ac = new AudioContext();
  for (let i = 0; i < 3; i++) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = ['sine','triangle','sawtooth'][i];
    o.frequency.value = 110 * (i+1);
    g.gain.value = 0.05;
    o.connect(g); g.connect(ac.destination);
    o.start();
    oscs.push({o, g});
  }
}
document.body.onclick = () => { initAudio(); if (ac) ac.resume(); };

function audioStep() {
  if (!oscs.length) return;
  let avg = 0;
  for (let i = 0; i < amp.length; i += 4) avg += amp[i]*amp[i] + amp[i+1]*amp[i+1];
  avg /= (W*H);
  oscs.forEach((o, i) => {
    o.o.frequency.value = 80 + avg * 200 * (i+1) + Math.sin(performance.now()/1000 + i) * 20;
    o.g.gain.value = 0.02 + avg * 0.08;
  });
}

// Persistence
async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f814', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('state');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({ amp: Array.from(amp), h: Array.from(h), bias, portals: portals.map(p => ({phase: p.phase, left: p.el.style.left, top: p.el.style.top})) }, 'genome');
    status.textContent = 'Sealed';
  } catch(e) { status.textContent = 'Seal failed (session only)'; }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { amp.fill(0); seed(W/2, H/2); status.textContent = 'Reset'; };

async function load() {
  try {
    const db = await new Promise((res) => {
      const r = indexedDB.open('verse-f814', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    });
    if (!db) return;
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get('genome');
    req.onsuccess = () => {
      if (req.result) {
        amp.set(req.result.amp);
        h.set(req.result.h);
        bias = req.result.bias || 0;
        req.result.portals?.forEach((pp, i) => {
          if (portals[i]) {
            portals[i].phase = pp.phase;
            portals[i].el.style.left = pp.left;
            portals[i].el.style.top = pp.top;
          }
        });
        status.textContent = 'Genome restored';
      }
    };
  } catch (e) { console.debug("lab f814-webgpu-quantum-walk-portal-mind:", e); }
}
load();

status.textContent = 'Quantum walk running (JS fallback)';
function loop() {
  step();
  render();
  audioStep();
  requestAnimationFrame(loop);
}
loop();

// pointer proxy for orientation
addEventListener('pointermove', e => {
  bias += (e.movementX * 0.0005);
});
