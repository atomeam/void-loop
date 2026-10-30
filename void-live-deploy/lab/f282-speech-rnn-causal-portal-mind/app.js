const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 120;
let particles = Array.from({length:N}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: (Math.random()-.5)*1, vy: (Math.random()-.5)*1,
  life: 1
}));
let portals = [];
let lastPhrase = '';
let residual = 0;
let pointer = {x: W/2, y: H/2, vx:0, vy:0};
let listening = false;
let recognition = null;

// Tiny embedding
function embed(word) {
  const w = (word||'').toLowerCase();
  const bins = [0,0,0,0]; // action, object, spatial, other
  if (/move|go|turn|push|pull|create|destroy|change/.test(w)) bins[0]=1;
  else if (/thing|object|particle|portal|mind|field/.test(w)) bins[1]=1;
  else if (/left|right|up|down|here|there|center/.test(w)) bins[2]=1;
  else bins[3]=1;
  return [...bins, Math.min(1, w.length/12), residual];
}

// Worker RNN
const workerCode = `
let h = new Float32Array(8).fill(0);
let Wxh = Array.from({length:8}, () => Array.from({length:6}, () => (Math.random()-.5)*.2));
let Whh = Array.from({length:8}, () => Array.from({length:8}, () => (Math.random()-.5)*.1));
let Why = Array.from({length:4}, () => Array.from({length:8}, () => (Math.random()-.5)*.3));
function tanh(x){ return Math.tanh(x); }
function step(input) {
  const nh = new Float32Array(8);
  for(let i=0;i<8;i++){
    let s = 0;
    for(let j=0;j<6;j++) s += Wxh[i][j]*input[j];
    for(let j=0;j<8;j++) s += Whh[i][j]*h[j];
    nh[i] = tanh(s);
  }
  h = nh;
  const out = new Float32Array(4);
  for(let i=0;i<4;i++){
    let s=0; for(let j=0;j<8;j++) s += Why[i][j]*h[j];
    out[i] = Math.tanh(s);
  }
  return {bias: Array.from(out), hidden: Array.from(h)};
}
self.onmessage = e => {
  if(e.data.type==='step') self.postMessage({type:'out', ...step(e.data.input)});
  if(e.data.type==='get') self.postMessage({type:'genome', h:Array.from(h), Wxh, Whh, Why});
};
`;
const blob = new Blob([workerCode], {type:'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));
let lastBias = [0,0,0,0];
worker.onmessage = e => { if(e.data.type==='out') lastBias = e.data.bias; };

function stepRNN(emb) {
  worker.postMessage({type:'step', input: emb});
}

// Speech
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.onresult = ev => {
    const phrase = ev.results[ev.results.length-1][0].transcript.trim();
    lastPhrase = phrase;
    const words = phrase.split(/\s+/);
    const emb = embed(words[0] || phrase);
    residual = Math.min(1, residual*0.9 + 0.3);
    stepRNN(emb);
    maybeSpawnPortal(phrase);
    log('Heard: ' + phrase);
  };
  recognition.onerror = e => log('Speech error: ' + e.error);
}

document.getElementById('listen').onclick = () => {
  if (!recognition) { log('SpeechRecognition not available'); return; }
  if (!listening) {
    recognition.start();
    listening = true;
    document.getElementById('listen').textContent = 'Stop Listening';
  } else {
    recognition.stop();
    listening = false;
    document.getElementById('listen').textContent = 'Start Listening';
  }
};
document.getElementById('demo').onclick = () => {
  const demos = ['move left', 'create portal', 'expand field', 'turn right', 'gather here'];
  const phrase = demos[Math.floor(Math.random()*demos.length)];
  lastPhrase = phrase;
  residual = 0.8;
  stepRNN(embed(phrase.split(' ')[0]));
  maybeSpawnPortal(phrase);
  log('Demo: ' + phrase);
};

function maybeSpawnPortal(phrase) {
  if (portals.length > 6) portals.shift();
  const p = document.createElement('div');
  p.className = 'portal';
  p.textContent = phrase.slice(0, 24);
  p.style.left = (pointer.x - 40) + 'px';
  p.style.top = (pointer.y - 20) + 'px';
  document.body.appendChild(p);
  makeDraggable(p);
  portals.push({el: p, x: pointer.x, y: pointer.y, phrase});
}

function makeDraggable(el) {
  let ox, oy, dragging=false;
  el.onpointerdown = e => {
    dragging=true; el.classList.add('dragging');
    ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop;
    el.setPointerCapture(e.pointerId);
  };
  el.onpointermove = e => {
    if (!dragging) return;
    el.style.left = (e.clientX - ox) + 'px';
    el.style.top = (e.clientY - oy) + 'px';
    const port = portals.find(p => p.el===el);
    if (port) { port.x = e.clientX; port.y = e.clientY; }
  };
  el.onpointerup = e => {
    if (!dragging) return;
    dragging=false; el.classList.remove('dragging');
    // inject impulse
    residual = Math.min(1, residual + 0.4);
    stepRNN(embed('impulse'));
    seal();
  };
}

function seal() {
  worker.postMessage({type:'get'});
  // simple local seal log
  const entry = {t: Date.now(), phrase: lastPhrase, residual};
  try {
    const dbReq = indexedDB.open('f282mind', 1);
    dbReq.onupgradeneeded = ev => ev.target.result.createObjectStore('seals', {keyPath:'t'});
    dbReq.onsuccess = ev => {
      const tx = ev.target.result.transaction('seals', 'readwrite');
      tx.objectStore('seals').put(entry);
    };
  } catch(e) {}
  log('Sealed: ' + lastPhrase);
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => {
  particles.forEach(p => { p.x=Math.random()*W; p.y=Math.random()*H; p.vx=0; p.vy=0; });
  portals.forEach(p => p.el.remove());
  portals = [];
  residual = 0;
};

addEventListener('pointermove', e => {
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  pointer.vx = dx*0.1; pointer.vy = dy*0.1;
  pointer.x = e.clientX; pointer.y = e.clientY;
  residual = Math.min(1, residual*0.95 + Math.hypot(dx,dy)*0.002);
  if (Math.random()<0.1) stepRNN(embed(lastPhrase || 'move'));
});

function log(msg) {
  const l = document.getElementById('log');
  l.textContent = msg + '\n' + l.textContent.slice(0, 200);
}

function loop() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  const bx = lastBias[0]*40, by = lastBias[1]*40;
  particles.forEach(p => {
    // attract to pointer + bias
    const dx = pointer.x - p.x, dy = pointer.y - p.y;
    const d = Math.hypot(dx,dy)+1;
    p.vx += (dx/d)*0.08 + bx*0.01 + (Math.random()-.5)*0.05;
    p.vy += (dy/d)*0.08 + by*0.01 + (Math.random()-.5)*0.05;
    // portal attractions
    portals.forEach(port => {
      const pdx = port.x - p.x, pdy = port.y - p.y;
      const pd = Math.hypot(pdx,pdy)+1;
      if (pd < 180) { p.vx += (pdx/pd)*0.04; p.vy += (pdy/pd)*0.04; }
    });
    p.vx *= 0.96; p.vy *= 0.96;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx*=-1;
    if (p.y<0||p.y>H) p.vy*=-1;
    const hue = 200 + lastBias[2]*60 + residual*40;
    ctx.fillStyle = `hsla(${hue},70%,60%,0.7)`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI*2); ctx.fill();
  });
  // mild CSS morph on portals
  portals.forEach(port => {
    port.el.style.transform = `rotateX(${lastBias[3]*15}deg) scale(${1+residual*0.15})`;
  });
  document.getElementById('status').textContent = `Speech: ${listening?'on':'off'} | Residual: ${residual.toFixed(2)} | Bias: ${lastBias.map(v=>v.toFixed(2)).join(',')}`;
  requestAnimationFrame(loop);
}
loop();
log('F282 ready. Speak or use Demo. Drag portals to inject & seal.');
