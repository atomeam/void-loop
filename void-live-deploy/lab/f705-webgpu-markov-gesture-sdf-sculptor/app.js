const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const anchorsEl = document.getElementById('anchors');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const NTOK = 16; // 8 dirs * 2 speeds + pause variants
let trans = Array.from({length:NTOK}, () => Array(NTOK).fill(1)); // counts
let lastToken = 0;
let history = [];
let fitness = 0;

function velToToken(vx, vy) {
  const sp = Math.hypot(vx, vy);
  if (sp < 0.5) return 0; // pause
  const ang = Math.atan2(vy, vx);
  const dir = Math.floor(((ang + Math.PI) / (2*Math.PI)) * 8) % 8;
  const fast = sp > 8 ? 1 : 0;
  return 1 + dir * 2 + fast;
}

function updateMarkov(tok) {
  if (lastToken !== null) trans[lastToken][tok] += 1;
  lastToken = tok;
  history.push(tok);
  if (history.length > 64) history.shift();
}

function getRowProb(row) {
  const sum = trans[row].reduce((a,b)=>a+b,0);
  return trans[row].map(v => v/sum);
}

function predictDist() {
  return getRowProb(lastToken || 0);
}

let mouse = {x:W/2, y:H/2, vx:0, vy:0, down:false};
let lastX=0, lastY=0;
canvas.addEventListener('pointerdown', e => { mouse.down=true; lastX=e.clientX; lastY=e.clientY; });
addEventListener('pointerup', () => mouse.down=false);
addEventListener('pointermove', e => {
  if (!mouse.down) return;
  const vx = e.clientX - lastX, vy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  mouse.x = e.clientX; mouse.y = e.clientY;
  mouse.vx = vx; mouse.vy = vy;
  const tok = velToToken(vx, vy);
  updateMarkov(tok);
});

// DOM anchors
const anchors = [];
for (let i=0; i<5; i++) {
  const d = document.createElement('div');
  d.className = 'anchor';
  d.textContent = '•';
  anchorsEl.appendChild(d);
  anchors.push({el:d, ang: i*1.25, r:0.4});
}

function renderVolume(t) {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const dist = predictDist();
  const entropy = -dist.reduce((s,p)=> s + (p>0? p*Math.log(p):0), 0);
  const predTok = dist.indexOf(Math.max(...dist));
  statusEl.textContent = `Draw to train · Last:${lastToken} Pred:${predTok} Ent:${entropy.toFixed(2)} Fit:${fitness.toFixed(1)}`;

  // Procedural SDF-like blob
  const cx = W/2, cy = H/2;
  const baseR = 120 + Math.sin(t*0.001)*20;
  const elong = 0.6 + dist[predTok]*0.8;
  ctx.save();
  ctx.translate(cx, cy);
  for (let r=baseR; r>10; r-=8) {
    const alpha = 0.15 * (1 - r/baseR);
    const hue = 200 + predTok*15 + entropy*10;
    ctx.fillStyle = `hsla(${hue},70%,60%,${alpha})`;
    ctx.beginPath();
    for (let a=0; a<Math.PI*2; a+=0.2) {
      const noise = Math.sin(a*3 + t*0.002 + predTok)* (20*dist[Math.floor(a/0.8)%NTOK] || 0);
      const rr = r * (1 + (Math.cos(a)*elong - 1)*0.3) + noise;
      const x = Math.cos(a)*rr, y = Math.sin(a)*rr*0.85;
      if (a===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Update anchors
  anchors.forEach((a,i) => {
    const ang = a.ang + t*0.0005 + predTok*0.1;
    const rad = baseR * a.r * (0.8 + dist[i%NTOK]*0.4);
    const x = cx + Math.cos(ang)*rad;
    const y = cy + Math.sin(ang)*rad*0.8;
    a.el.style.left = x+'px';
    a.el.style.top = y+'px';
    a.el.textContent = `tok ${predTok} · ${['pause','dir'][predTok>0?1:0]}`;
    a.el.style.transform = `translate(-50%,-50%) rotate(${ang}rad)`;
  });
}

let t0 = performance.now();
function loop(now) {
  const t = now - t0;
  renderVolume(t);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Persistence
const dbName = 'verse-f705';
let db;
const req = indexedDB.open(dbName, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath:'id'});
req.onsuccess = e => { db = e.target.result; loadGenome(); };
function loadGenome() {
  if (!db) return;
  const tx = db.transaction('genomes','readonly');
  const g = tx.objectStore('genomes').get('current');
  g.onsuccess = () => { if (g.result) { trans = g.result.trans; fitness = g.result.fit||0; } };
}
document.getElementById('seal').onclick = () => {
  fitness += 1;
  if (!db) return alert('No IDB');
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({id:'current', trans, fit:fitness, ts:Date.now()});
  const ch = new BroadcastChannel('f705-genome');
  ch.postMessage({trans, fit:fitness});
  statusEl.textContent += ' · Sealed';
};
const ch = new BroadcastChannel('f705-genome');
ch.onmessage = e => {
  if (e.data.fit > fitness) { trans = e.data.trans; fitness = e.data.fit; }
};
document.getElementById('reset').onclick = () => { trans = Array.from({length:NTOK},()=>Array(NTOK).fill(1)); fitness=0; history=[]; };
document.getElementById('clear').onclick = () => { history=[]; lastToken=0; };

// WebGPU stub note in console
if (navigator.gpu) console.log('WebGPU available — raymarch path prepared for future');
