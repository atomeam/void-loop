const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
let portals = [];
let attractors = [];
let genome = null;
const history = new Float32Array(64); // 32 x,y deltas
let hidx = 0;
const W = { w1: new Float32Array(8*16), b1: new Float32Array(16), w2: new Float32Array(16*4), b2: new Float32Array(4) };
function randW() {
  for (let i=0;i<W.w1.length;i++) W.w1[i] = (Math.random()-0.5)*0.4;
  for (let i=0;i<W.w2.length;i++) W.w2[i] = (Math.random()-0.5)*0.4;
}
randW();

const dbName = 'verse-f675';
let db;
const req = indexedDB.open(dbName, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('store');
req.onsuccess = e => { db = e.target.result; load(); };
function save() {
  if (!db) return;
  const tx = db.transaction('store','readwrite');
  tx.objectStore('store').put({ weights: {w1:[...W.w1],b1:[...W.b1],w2:[...W.w2],b2:[...W.b2]}, portals: portals.map(p=>({x:p.x,y:p.y,text:p.el.querySelector('textarea').value})) }, 'genome');
}
function load() {
  if (!db) return;
  db.transaction('store').objectStore('store').get('genome').onsuccess = e => {
    if (e.target.result) {
      const g = e.target.result;
      Object.assign(W.w1, g.weights.w1); Object.assign(W.b1, g.weights.b1);
      Object.assign(W.w2, g.weights.w2); Object.assign(W.b2, g.weights.b2);
      g.portals.forEach(p => addPortal(p.x, p.y, p.text));
    } else addPortal(200,200,'First portal');
  };
}
const bc = new BroadcastChannel('verse-f675');
bc.onmessage = e => { if (e.data.type==='genome') { Object.assign(W.w1, e.data.w.w1); status.textContent = 'Genome adopted from peer'; } };

function mlp(inp) {
  const h = new Float32Array(16);
  for (let i=0;i<16;i++) {
    let s = W.b1[i];
    for (let j=0;j<8;j++) s += inp[j] * W.w1[i*8+j];
    h[i] = Math.tanh(s);
  }
  const o = new Float32Array(4);
  for (let i=0;i<4;i++) {
    let s = W.b2[i];
    for (let j=0;j<16;j++) s += h[j] * W.w2[i*16+j];
    o[i] = Math.tanh(s);
  }
  return o;
}

function addPortal(x=100+Math.random()*300, y=100+Math.random()*200, text='') {
  const el = document.createElement('div');
  el.className = 'portal';
  el.innerHTML = `<span class="del">×</span><textarea>${text}</textarea>`;
  el.style.left = x+'px'; el.style.top = y+'px';
  el.querySelector('.del').onclick = () => { el.remove(); portals = portals.filter(p=>p.el!==el); };
  let drag = null;
  el.onpointerdown = e => { if (e.target.tagName==='TEXTAREA') return; drag={dx:e.clientX-x, dy:e.clientY-y}; el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => { if (!drag) return; x = e.clientX - drag.dx; y = e.clientY - drag.dy; el.style.left=x+'px'; el.style.top=y+'px'; };
  el.onpointerup = () => drag=null;
  document.body.appendChild(el);
  portals.push({el, x, y, vx:0, vy:0});
}

document.getElementById('add').onclick = () => addPortal();
document.getElementById('seal').onclick = () => { save(); bc.postMessage({type:'genome', w:{w1:[...W.w1],b1:[...W.b1],w2:[...W.w2],b2:[...W.b2]}}); status.textContent='Genome sealed & broadcast'; };
document.getElementById('export').onclick = () => {
  const data = { portals: portals.map(p=>({x:p.x,y:p.y,text:p.el.querySelector('textarea').value})), weights:{...W} };
  const a = document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})); a.download='f675-layout.json'; a.click();
};
document.getElementById('clear').onclick = () => { portals.forEach(p=>p.el.remove()); portals=[]; attractors=[]; };

let lastX=0, lastY=0;
window.onpointermove = e => {
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  history[hidx%32*2] = dx; history[hidx%32*2+1] = dy; hidx++;
  lastX = e.clientX; lastY = e.clientY;
};

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR(); rec.continuous = true; rec.interimResults = false;
  rec.onresult = e => {
    const t = e.results[e.results.length-1][0].transcript;
    attractors.push({x: lastX, y: lastY, s: 1, text: t});
    document.getElementById('speech').textContent = 'Speech: '+t.slice(0,20);
  };
  rec.start(); document.getElementById('speech').textContent = 'Speech: on';
}

// Simple 2D fallback field (no WebGPU for broad runnability; shader comment shows intent)
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

function noise(x,y,t,sc) {
  return Math.sin(x*sc + t)*Math.cos(y*sc*0.7 + t*0.8) * 0.5;
}

function frame(t) {
  const inp = new Float32Array(8);
  for (let i=0;i<8;i++) inp[i] = history[(hidx-1-i+32)%32*2] * 0.02;
  const params = mlp(inp);
  const scale = 0.005 + params[0]*0.004;
  const strength = 0.4 + params[1]*0.3;
  const attStr = 0.8 + params[2]*0.5;

  ctx.fillStyle = '#0a0a12'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // visual field
  for (let i=0;i<40;i++) for (let j=0;j<25;j++) {
    const x=i*40, y=j*40;
    const n = noise(x,y,t*0.001,scale);
    ctx.fillStyle = `hsla(${200+params[3]*40},70%,${50+n*30}%,0.15)`;
    ctx.fillRect(x,y,3,3);
  }

  attractors.forEach(a => { a.s *= 0.98; if (a.s<0.05) a.s=0; });
  attractors = attractors.filter(a=>a.s>0);

  portals.forEach(p => {
    let fx = noise(p.x, p.y, t*0.001, scale) * strength * 8;
    let fy = noise(p.x+100, p.y, t*0.001, scale) * strength * 8;
    attractors.forEach(a => {
      const dx=a.x-p.x, dy=a.y-p.y, d=Math.hypot(dx,dy)+1;
      fx += (dx/d)*a.s*attStr*4; fy += (dy/d)*a.s*attStr*4;
    });
    p.vx = p.vx*0.9 + fx*0.1; p.vy = p.vy*0.9 + fy*0.1;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(0, Math.min(innerWidth-160, p.x));
    p.y = Math.max(0, Math.min(innerHeight-80, p.y));
    p.el.style.left = p.x+'px'; p.el.style.top = p.y+'px';
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
