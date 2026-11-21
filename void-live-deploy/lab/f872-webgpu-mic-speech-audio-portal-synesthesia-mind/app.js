const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const textIn = document.getElementById('text');
const toast = document.getElementById('toast');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let audioCtx, analyser, micStream, dataArray;
let recognition;
let portals = [];
let mlp = { w: Array(6*5).fill(0).map(() => (Math.random()-0.5)*0.3), b: Array(5).fill(0) };
let rewardAccum = 0;
let pointer = { x: W/2, y: H/2 };
let spectrum = { energy: 0.1, centroid: 0.3, flux: 0 };

async function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStream = stream;
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
  } catch (e) { console.warn('Mic denied', e); }
}

function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (e) => {
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
    }
    if (final.trim()) birthPortal(final.trim());
  };
  recognition.onerror = () => {};
  recognition.start();
}

function birthPortal(text) {
  if (portals.length >= 8) portals.shift().el.remove();
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = text.slice(0, 42);
  el.style.left = (Math.random()*0.6 + 0.2)*W + 'px';
  el.style.top = (Math.random()*0.6 + 0.2)*H + 'px';
  document.body.appendChild(el);
  const p = { el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), text, osc: null, panner: null, age: 0 };
  if (audioCtx) {
    p.osc = audioCtx.createOscillator();
    p.panner = audioCtx.createPanner();
    p.panner.panningModel = 'HRTF';
    p.osc.connect(p.panner).connect(audioCtx.destination);
    p.osc.type = 'sine';
    p.osc.frequency.value = 200 + (text.length * 12) % 400;
    p.osc.start();
  }
  let drag = false, ox, oy;
  el.onpointerdown = (ev) => { drag = true; ox = ev.clientX - p.x; oy = ev.clientY - p.y; el.setPointerCapture(ev.pointerId); };
  el.onpointermove = (ev) => { if (!drag) return; p.x = ev.clientX - ox; p.y = ev.clientY - oy; el.style.left = p.x+'px'; el.style.top = p.y+'px'; };
  el.onpointerup = () => { drag = false; rewardAccum += 0.4; el.classList.add('reward'); setTimeout(() => el.classList.remove('reward'), 400); showToast('Reward +'); };
  portals.push(p);
}

function showToast(msg) { toast.textContent = msg; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 1200); }

function policy(features) {
  const out = [];
  for (let o = 0; o < 5; o++) {
    let s = mlp.b[o];
    for (let i = 0; i < 6; i++) s += features[i] * mlp.w[i*5 + o];
    out.push(Math.tanh(s));
  }
  return out;
}

function updateMLP(reward) {
  const lr = 0.02;
  for (let i = 0; i < mlp.w.length; i++) mlp.w[i] += lr * reward * (Math.random()-0.5);
  for (let i = 0; i < mlp.b.length; i++) mlp.b[i] += lr * reward * 0.1;
}

async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f872', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('minds');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('minds', 'readwrite');
    tx.objectStore('minds').put({ w: mlp.w, b: mlp.b, portals: portals.map(p => ({text: p.text, x: p.x, y: p.y})) }, 'latest');
    showToast('Sealed');
  } catch (e) { showToast('Seal failed'); }
}

async function restore() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f872', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('minds', 'readonly');
    const req = tx.objectStore('minds').get('latest');
    req.onsuccess = () => {
      if (req.result) {
        mlp.w = req.result.w; mlp.b = req.result.b;
        (req.result.portals || []).forEach(s => birthPortal(s.text));
        showToast('Restored');
      }
    };
  } catch (e) { console.debug("lab f872-webgpu-mic-speech-audio-portal-synesthesia-mind:", e); }
}

function tick() {
  if (analyser) {
    analyser.getByteFrequencyData(dataArray);
    let e = 0, c = 0, sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i]/255;
      e += v; sum += v * i;
    }
    spectrum.energy = e / dataArray.length;
    spectrum.centroid = sum / (e * dataArray.length + 1e-6);
    spectrum.flux = Math.abs(spectrum.energy - (spectrum.prev || 0));
    spectrum.prev = spectrum.energy;
  } else {
    spectrum.energy = 0.2 + 0.1 * Math.sin(Date.now()/400);
    spectrum.centroid = 0.4;
  }

  const feats = [
    (pointer.x / W - 0.5)*2,
    (pointer.y / H - 0.5)*2,
    spectrum.energy,
    spectrum.centroid,
    spectrum.flux,
    portals.length / 8
  ];
  const outs = policy(feats);
  const fieldScale = 0.5 + outs[0]*0.5;
  const hue = (outs[1] + 1) * 180;
  const baseFreq = 180 + outs[2]*220;
  const gain = 0.05 + (outs[3]+1)*0.1;
  const drift = outs[4];

  // Canvas density field
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,W,H);
  for (let i = 0; i < 80; i++) {
    const px = Math.random()*W, py = Math.random()*H;
    const d = Math.hypot(px-pointer.x, py-pointer.y) / Math.max(W,H);
    const inten = spectrum.energy * fieldScale * (1 - d);
    ctx.fillStyle = `hsla(${hue + d*60}, 70%, ${40 + inten*40}%, ${0.15 + inten*0.3})`;
    ctx.beginPath();
    ctx.arc(px, py, 2 + inten*6, 0, Math.PI*2);
    ctx.fill();
  }

  portals.forEach(p => {
    p.age++;
    if (!p.el.matches(':active')) {
      p.x += drift * 0.8 * Math.sin(p.age*0.01 + p.text.length);
      p.y += drift * 0.5 * Math.cos(p.age*0.013);
      p.x = Math.max(20, Math.min(W-100, p.x));
      p.y = Math.max(20, Math.min(H-60, p.y));
      p.el.style.left = p.x + 'px';
      p.el.style.top = p.y + 'px';
    }
    if (p.osc && audioCtx) {
      const local = Math.hypot(p.x - pointer.x, p.y - pointer.y) / Math.max(W,H);
      p.osc.frequency.setTargetAtTime(baseFreq + local*150 + spectrum.centroid*200, audioCtx.currentTime, 0.05);
      p.osc.gain && (p.osc.gain.value = gain * (1 - local*0.5)); // note: oscillator has no gain prop by default; use GainNode if needed
      // simple: modulate via detune or skip precise gain
      p.panner.positionX.value = (p.x / W - 0.5) * 4;
      p.panner.positionZ.value = (p.y / H - 0.5) * 2;
    }
    p.el.style.background = `hsla(${hue}, 40%, 20%, 0.75)`;
  });

  if (Math.abs(rewardAccum) > 0.01) {
    updateMLP(rewardAccum);
    rewardAccum *= 0.9;
  }

  requestAnimationFrame(tick);
}

textIn.addEventListener('keydown', e => {
  if (e.key === 'Enter' && textIn.value.trim()) {
    birthPortal(textIn.value.trim());
    textIn.value = '';
  }
});
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
addEventListener('keydown', e => { if (e.key === 's' && e.ctrlKey) { e.preventDefault(); seal(); } });

initAudio().then(() => { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); });
initSpeech();
restore();
tick();
showToast('Ready — speak, type, or Ctrl+S to seal');
