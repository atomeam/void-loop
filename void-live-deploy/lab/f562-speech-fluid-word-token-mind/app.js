const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W, H;
function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize); resize();

// Simple particle fluid (Canvas2D fallback; WebGPU path stubbed for brevity but structure ready)
const particles = Array.from({length: 800}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5
}));
const tokens = [];
let weights = new Float32Array(16).fill(0.1); // tiny attention params
let history = [];
const common = ['the','and','of','to','a','in','is','that','for','with','on','as','at','by','this','from'];

function embed(word) {
  const v = new Float32Array(8);
  for (let i=0; i<word.length; i++) v[i%8] += word.charCodeAt(i)/255;
  return v;
}

function predict() {
  if (history.length < 1) return '-';
  // Tiny causal attention proxy: weighted sum of recent embeddings
  const last = history.slice(-4);
  let score = 0;
  last.forEach((e,i) => { for (let j=0; j<8; j++) score += e[j] * weights[(i*2+j)%16]; });
  const idx = Math.abs(Math.floor(score * 3)) % common.length;
  return common[idx];
}

function spawn(word) {
  const el = document.createElement('div');
  el.className = 'token';
  el.textContent = word;
  el.style.left = (Math.random()*0.6 + 0.2)*W + 'px';
  el.style.top = (Math.random()*0.4 + 0.3)*H + 'px';
  document.body.appendChild(el);
  tokens.push({ el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0 });
  history.push(embed(word.toLowerCase()));
  if (history.length > 20) history.shift();
  // Reward if matches last prediction
  const pred = document.getElementById('pred').textContent.replace('Prediction: ','');
  if (word.toLowerCase() === pred.toLowerCase()) {
    for (let i=0; i<weights.length; i++) weights[i] += 0.05 * (Math.random()-0.3);
  }
  document.getElementById('pred').textContent = 'Prediction: ' + predict();
}

// Drag
let drag = null, ox=0, oy=0;
document.addEventListener('pointerdown', e => {
  if (e.target.classList.contains('token')) {
    drag = e.target; ox = e.clientX - parseFloat(drag.style.left); oy = e.clientY - parseFloat(drag.style.top);
  }
});
document.addEventListener('pointermove', e => {
  if (drag) {
    drag.style.left = (e.clientX - ox) + 'px';
    drag.style.top = (e.clientY - oy) + 'px';
  }
});
document.addEventListener('pointerup', () => drag = null);

// Speech
let rec = null, listening = false;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  rec = new SR(); rec.continuous = true; rec.interimResults = false;
  rec.onresult = e => {
    const w = e.results[e.results.length-1][0].transcript.trim().split(/\s+/).pop();
    if (w) spawn(w);
  };
  rec.onerror = () => document.getElementById('status').textContent = 'Speech error - type instead';
}
document.getElementById('listen').onclick = () => {
  if (!rec) return alert('SpeechRecognition not supported - use the text box');
  if (!listening) { rec.start(); listening=true; document.getElementById('listen').textContent='Stop'; document.getElementById('status').textContent='Listening…'; }
  else { rec.stop(); listening=false; document.getElementById('listen').textContent='Start Listen'; }
};
document.getElementById('txt').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.value.trim()) { spawn(e.target.value.trim()); e.target.value=''; }
});

// Seal / load
async function seal() {
  try {
    const db = await new Promise((res,rej) => { const r=indexedDB.open('f562',1); r.onupgradeneeded=()=>r.result.createObjectStore('m'); r.onsuccess=()=>res(r.result); });
    const tx = db.transaction('m','readwrite');
    tx.objectStore('m').put({ id:1, weights: Array.from(weights), hist: history.map(h=>Array.from(h)) });
    document.getElementById('status').textContent = 'Sealed';
  } catch(e) { document.getElementById('status').textContent = 'Seal failed (in-memory)'; }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { tokens.forEach(t=>t.el.remove()); tokens.length=0; history=[]; weights.fill(0.1); document.getElementById('pred').textContent='Prediction: -'; };

// Load
(async () => {
  try {
    const db = await new Promise((res,rej) => { const r=indexedDB.open('f562',1); r.onupgradeneeded=()=>r.result.createObjectStore('m'); r.onsuccess=()=>res(r.result); });
    const tx = db.transaction('m','readonly');
    const req = tx.objectStore('m').get(1);
    req.onsuccess = () => {
      if (req.result) { weights = new Float32Array(req.result.weights); document.getElementById('status').textContent='Restored'; }
    };
  } catch (e) { console.warn('f562-speech-fluid-word-token-mind:', e); }
})();

function loop() {
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,W,H);
  // Particles
  particles.forEach(p => {
    // Attract to tokens slightly
    tokens.forEach(t => {
      const dx = t.x - p.x, dy = t.y - p.y, d2 = dx*dx+dy*dy+100;
      p.vx += dx / d2 * 2; p.vy += dy / d2 * 2;
    });
    p.vx *= 0.98; p.vy *= 0.98;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx*=-1; if (p.y<0||p.y>H) p.vy*=-1;
    ctx.fillStyle = 'rgba(100,150,255,0.4)';
    ctx.fillRect(p.x, p.y, 2, 2);
  });
  // Advect tokens
  tokens.forEach(t => {
    let vx=0, vy=0, n=0;
    particles.forEach(p => {
      const d = Math.hypot(p.x-t.x, p.y-t.y);
      if (d < 40) { vx += p.vx; vy += p.vy; n++; }
    });
    if (n) { t.vx = vx/n*0.3; t.vy = vy/n*0.3; }
    t.x += t.vx; t.y += t.vy;
    t.el.style.left = t.x + 'px'; t.el.style.top = t.y + 'px';
  });
  requestAnimationFrame(loop);
}
loop();
document.getElementById('status').textContent = SR ? 'Ready (speech or type)' : 'Type words (no Speech API)';
