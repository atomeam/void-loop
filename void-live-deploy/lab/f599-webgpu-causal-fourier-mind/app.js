const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const status = document.getElementById('status');
function resize() { cv.width = innerWidth; cv.height = innerHeight; }
addEventListener('resize', resize); resize();

// Spectral bins
const NBINS = 24;
let spectrum = new Float32Array(NBINS).fill(0.2);
let mlp = { w1: [], b1: [], w2: [], b2: [] }; // 6→12→24
function initMLP() {
  const rand = () => (Math.random()-0.5)*0.4;
  mlp.w1 = Array.from({length:12}, () => Array.from({length:6}, rand));
  mlp.b1 = Array.from({length:12}, rand);
  mlp.w2 = Array.from({length:NBINS}, () => Array.from({length:12}, rand));
  mlp.b2 = Array.from({length:NBINS}, rand);
}
initMLP();

let orient = {x:0, y:0}, pointer = {x:0.5, y:0.5, dx:0, dy:0}, lastP = {x:0,y:0};
addEventListener('deviceorientation', e => { orient.x = (e.gamma||0)/90; orient.y = (e.beta||0)/90; });
addEventListener('pointermove', e => {
  pointer.x = e.clientX / innerWidth; pointer.y = e.clientY / innerHeight;
  pointer.dx = (e.clientX - lastP.x) * 0.01; pointer.dy = (e.clientY - lastP.y) * 0.01;
  lastP.x = e.clientX; lastP.y = e.clientY;
});

function tanh(x) { return Math.tanh(x); }
function mlpForward(inp) {
  const h = mlp.b1.map((b,i) => tanh(mlp.w1[i].reduce((s,w,j)=>s+w*inp[j], b)));
  return mlp.b2.map((b,i) => tanh(mlp.w2[i].reduce((s,w,j)=>s+w*h[j], b)));
}

// Audio
let ac, oscs = [], gains = [];
function initAudio() {
  if (ac) return;
  ac = new AudioContext();
  for (let i=0; i<12; i++) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = 110 * Math.pow(2, i/6);
    g.gain.value = 0;
    o.connect(g); g.connect(ac.destination);
    o.start();
    oscs.push(o); gains.push(g);
  }
}
addEventListener('click', initAudio, {once:true});
addEventListener('keydown', initAudio, {once:true});

// Portals
const portals = [];
for (let i=0; i<5; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'reward';
  el.style.left = (20 + i*15) + '%';
  el.style.top = (30 + (i%2)*20) + '%';
  el.onclick = () => reward();
  document.body.appendChild(el);
  portals.push({el, x: parseFloat(el.style.left)/100, y: parseFloat(el.style.top)/100});
}

let fitness = 0;
function reward() {
  fitness += 1;
  // simple Hebbian-ish update: strengthen weights toward current spectrum
  const target = spectrum.slice();
  for (let i=0; i<mlp.w2.length; i++) {
    for (let j=0; j<mlp.w2[i].length; j++) {
      mlp.w2[i][j] += 0.002 * (target[i] - 0.5) * Math.random();
    }
  }
  status.textContent = `rewarded fitness=${fitness.toFixed(1)}`;
}

function update() {
  const t = performance.now() * 0.001;
  const inp = [orient.x, orient.y, pointer.dx, pointer.dy, Math.sin(t*0.5), Math.cos(t*0.3)];
  const out = mlpForward(inp);
  for (let i=0; i<NBINS; i++) {
    spectrum[i] = spectrum[i]*0.92 + (out[i]*0.5 + 0.5)*0.08;
    spectrum[i] = Math.max(0, Math.min(1, spectrum[i]));
  }
  // Audio
  if (ac && ac.state === 'running') {
    for (let i=0; i<oscs.length; i++) {
      const bin = spectrum[i*2] || 0;
      gains[i].gain.setTargetAtTime(bin * 0.04, ac.currentTime, 0.05);
    }
  }
  // Chrome
  const centroid = spectrum.reduce((s,v,i)=>s+v*i,0) / (spectrum.reduce((s,v)=>s+v,0)+1e-6);
  const entropy = -spectrum.reduce((s,v)=>s + (v>0?v*Math.log(v):0),0) / Math.log(NBINS);
  document.documentElement.style.setProperty('--hue', (centroid*360).toFixed(0));
  document.documentElement.style.setProperty('--pulse', entropy.toFixed(2));
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,20,0.15)';
  ctx.fillRect(0,0,cv.width,cv.height);
  const w = cv.width / NBINS;
  for (let i=0; i<NBINS; i++) {
    const h = spectrum[i] * cv.height * 0.6;
    const hue = (i/NBINS*360 + performance.now()*0.02) % 360;
    ctx.fillStyle = `hsla(${hue},70%,60%,0.7)`;
    ctx.fillRect(i*w, cv.height - h, w-2, h);
    // interference lines
    ctx.strokeStyle = `hsla(${hue},80%,70%,${spectrum[i]*0.3})`;
    ctx.beginPath();
    for (let x=0; x<cv.width; x+=8) {
      const y = cv.height*0.5 + Math.sin(x*0.02 + i + performance.now()*0.001)*spectrum[i]*40;
      if (x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  // portals morph
  portals.forEach(p => {
    const bin = Math.floor(p.x * NBINS);
    const e = spectrum[bin] || 0;
    p.el.style.transform = `scale(${0.8 + e*0.6})`;
    p.el.style.background = `hsla(${e*180},60%,40%,0.2)`;
  });
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();

// Seal / restore
const DB = 'verse-f599';
function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({spectrum: Array.from(spectrum), mlp, fitness}, 'best');
    status.textContent = 'sealed';
  } catch(e) { status.textContent = 'seal fail'; }
}
async function restore() {
  try {
    const db = await openDB();
    const tx = db.transaction('genomes','readonly');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => {
      if (req.result) {
        spectrum.set(req.result.spectrum);
        mlp = req.result.mlp;
        fitness = req.result.fitness || 0;
        status.textContent = 'restored';
      }
    };
  } catch(e) { status.textContent = 'restore fail'; }
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
addEventListener('keydown', e => { if (e.key==='s'||e.key==='S') seal(); if (e.key==='r'||e.key==='R') restore(); });

status.textContent = 'ready — click anywhere to enable audio';
