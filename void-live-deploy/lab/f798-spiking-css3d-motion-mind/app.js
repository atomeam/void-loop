const N = 48; // sparks / neurons
const sparks = [];
const stage = document.getElementById('stage');
const status = document.getElementById('status');
let membrane = new Float32Array(N);
let recovery = new Float32Array(N);
let weights = new Float32Array(N * N); // recurrent
let reward = 0;
let motionX = 0, motionY = 0, motionZ = 0;
let pointerX = 0, pointerY = 0;
const bc = new BroadcastChannel('f798-genome');
const DB_NAME = 'f798-mind';
let db;

function initWeights() {
  for (let i = 0; i < N*N; i++) weights[i] = (Math.random()-0.5)*0.4;
}

function createSparks() {
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'spark';
    el.dataset.i = i;
    el.style.left = (Math.random()*window.innerWidth) + 'px';
    el.style.top = (Math.random()*window.innerHeight) + 'px';
    el.addEventListener('click', () => { reward += 1.5; el.style.background = 'radial-gradient(circle,#ff0,#fa0)'; setTimeout(()=>el.style.background='', 300); });
    stage.appendChild(el);
    sparks.push({ el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), z: (Math.random()-0.5)*200 });
  }
}

function step() {
  // Causal input: motion + pointer velocity proxy
  const inputGain = 0.8;
  for (let i = 0; i < N; i++) {
    let I = (motionX + motionY + motionZ) * inputGain * (i%7-3)/3 + Math.sin(Date.now()/400 + i)*0.2;
    // recurrent spikes
    for (let j = 0; j < N; j++) {
      if (membrane[j] > 1.0) I += weights[i*N + j] * 2.0;
    }
    membrane[i] += 0.05 * (0.2 - membrane[i] + I) - recovery[i];
    recovery[i] += 0.02 * (membrane[i] > 0.5 ? 1 : 0);
    if (membrane[i] > 1.0) {
      membrane[i] = 0;
      recovery[i] += 0.5;
      // spatial effect
      const s = sparks[i];
      s.x += (Math.random()-0.5)*30 + motionX*2;
      s.y += (Math.random()-0.5)*30 + motionY*2;
      s.z += (Math.random()-0.5)*40;
      s.el.style.opacity = 1;
      s.el.style.transform = `translate3d(${s.x}px,${s.y}px,${s.z}px) scale(1.4)`;
    } else {
      sparks[i].el.style.opacity = 0.4 + membrane[i]*0.5;
      sparks[i].el.style.transform = `translate3d(${sparks[i].x}px,${sparks[i].y}px,${sparks[i].z}px)`;
    }
    // simple STDP-like with reward
    if (reward > 0 && membrane[i] > 0.8) {
      for (let j = 0; j < N; j++) if (membrane[j] > 0.6) weights[i*N+j] += 0.01 * reward;
    }
  }
  reward *= 0.95;
  // soft bounds
  for (let i = 0; i < N; i++) {
    sparks[i].x = Math.max(20, Math.min(window.innerWidth-20, sparks[i].x));
    sparks[i].y = Math.max(20, Math.min(window.innerHeight-20, sparks[i].y));
  }
  status.textContent = `spikes ~${Array.from(membrane).filter(m=>m>0.9).length} | reward ${reward.toFixed(2)}`;
  requestAnimationFrame(step);
}

function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}

async function seal() {
  if (!db) db = await openDB();
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({ weights: Array.from(weights), membrane: Array.from(membrane), t: Date.now() }, 'best');
  bc.postMessage({ type:'genome', weights: Array.from(weights) });
  status.textContent = 'Sealed to IndexedDB + broadcast';
}

bc.onmessage = (e) => {
  if (e.data.type === 'genome' && e.data.weights) {
    // competition: adopt if higher mean |weight|
    const theirs = new Float32Array(e.data.weights);
    let myE = 0, theirE = 0;
    for (let i=0;i<weights.length;i++) { myE += Math.abs(weights[i]); theirE += Math.abs(theirs[i]); }
    if (theirE > myE * 1.05) {
      weights.set(theirs);
      status.textContent = 'Adopted stronger genome from peer tab';
    }
  }
};

window.addEventListener('devicemotion', e => {
  if (e.accelerationIncludingGravity) {
    motionX = e.accelerationIncludingGravity.x || 0;
    motionY = e.accelerationIncludingGravity.y || 0;
    motionZ = e.accelerationIncludingGravity.z || 0;
  }
});
window.addEventListener('pointermove', e => { pointerX = e.clientX; pointerY = e.clientY; });

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initWeights(); membrane.fill(0); recovery.fill(0); };

initWeights();
createSparks();
step();
status.textContent = 'Live. Shake or tilt. Click sparks.';
