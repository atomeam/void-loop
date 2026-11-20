const stage = document.getElementById('stage');
const turb = document.getElementById('turb');
const disp = document.getElementById('disp');
const status = document.getElementById('status');
const N = 6;
const cards = [];
for (let i = 0; i < N; i++) {
  const c = document.createElement('div');
  c.className = 'card';
  c.style.filter = 'url(#distort)';
  c.textContent = `Portal ${i+1}`;
  c.style.left = (20 + Math.random()*60) + 'vw';
  c.style.top = (20 + Math.random()*50) + 'vh';
  stage.appendChild(c);
  cards.push({el:c, x:parseFloat(c.style.left), y:parseFloat(c.style.top), vx:0, vy:0});
  c.onclick = () => reward();
}

// Tiny MLP 6-12-4
let W1 = Array.from({length:12}, () => Array.from({length:6}, () => (Math.random()-0.5)*0.4));
let B1 = Array.from({length:12}, () => 0);
let W2 = Array.from({length:4}, () => Array.from({length:12}, () => (Math.random()-0.5)*0.4));
let B2 = Array.from({length:4}, () => 0);

function tanh(x){ return Math.tanh(x); }
function forward(inp) {
  const h = B1.map((b,i) => tanh(W1[i].reduce((s,w,j)=>s+w*inp[j], b)));
  return B2.map((b,i) => tanh(W2[i].reduce((s,w,j)=>s+w*h[j], b)));
}
function hebbian(inp, out, lr=0.01) {
  const h = B1.map((b,i) => tanh(W1[i].reduce((s,w,j)=>s+w*inp[j], b)));
  for (let i=0;i<4;i++) for (let j=0;j<12;j++) W2[i][j] += lr * out[i] * h[j];
  for (let i=0;i<12;i++) for (let j=0;j<6;j++) W1[i][j] += lr * h[i] * inp[j];
}

let lastX=0, lastY=0, lastT=performance.now(), vx=0, vy=0, ax=0, ay=0, touches=1;
function onMove(e) {
  const t = performance.now();
  const dt = Math.max(1, t - lastT)/1000;
  const x = e.touches ? e.touches[0].clientX : e.clientX;
  const y = e.touches ? e.touches[0].clientY : e.clientY;
  touches = e.touches ? e.touches.length : 1;
  const nvx = (x - lastX)/dt;
  const nvy = (y - lastY)/dt;
  ax = (nvx - vx)/dt;
  ay = (nvy - vy)/dt;
  vx = nvx*0.7 + vx*0.3;
  vy = nvy*0.7 + vy*0.3;
  lastX=x; lastY=y; lastT=t;
}
stage.addEventListener('pointermove', onMove);
stage.addEventListener('touchmove', onMove, {passive:true});

function reward() {
  const phase = (performance.now()/1000)%1;
  const inp = [Math.tanh(vx/800), Math.tanh(vy/800), Math.tanh(ax/2000), Math.tanh(ay/2000), touches/5, phase];
  const out = forward(inp);
  hebbian(inp, out, 0.02);
  status.textContent = 'rewarded — adapting';
}

async function seal() {
  const data = {W1,B1,W2,B2, fitness: Math.random()};
  try {
    const db = await new Promise((res,rej)=>{const r=indexedDB.open('verse-f819',1); r.onupgradeneeded=e=>e.target.result.createObjectStore('g'); r.onsuccess=e=>res(e.target.result);});
    const tx = db.transaction('g','readwrite');
    tx.objectStore('g').put(data, 'mlp');
    status.textContent = 'sealed to IndexedDB';
  } catch(e){ status.textContent = 'seal mem only'; }
  if (window.BroadcastChannel) {
    const bc = new BroadcastChannel('f819-genome');
    bc.postMessage(data);
  }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { location.reload(); };

function load() {
  try {
    const r = indexedDB.open('verse-f819',1);
    r.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('g')) return;
      const tx = db.transaction('g');
      const req = tx.objectStore('g').get('mlp');
      req.onsuccess = () => {
        if (req.result) {
          W1=req.result.W1; B1=req.result.B1; W2=req.result.W2; B2=req.result.B2;
          status.textContent = 'restored genome';
        }
      };
    };
  } catch (e) { console.debug("lab f819-multitouch-mlp-svg-filter-mind:", e); }
  if (window.BroadcastChannel) {
    const bc = new BroadcastChannel('f819-genome');
    bc.onmessage = e => {
      if (e.data && e.data.W1) {
        W1=e.data.W1; B1=e.data.B1; W2=e.data.W2; B2=e.data.B2;
        status.textContent = 'adopted peer genome';
      }
    };
  }
}
load();

function loop() {
  const phase = (performance.now()/1000) % 1;
  const inp = [Math.tanh(vx/800), Math.tanh(vy/800), Math.tanh(ax/2000), Math.tanh(ay/2000), touches/5, phase];
  const out = forward(inp);
  const bfX = 0.005 + (out[0]+1)*0.03;
  const bfY = 0.005 + (out[1]+1)*0.03;
  const oct = 1 + Math.floor((out[2]+1)*2.5);
  const scale = 5 + (out[3]+1)*25;
  turb.setAttribute('baseFrequency', `${bfX.toFixed(4)} ${bfY.toFixed(4)}`);
  turb.setAttribute('numOctaves', oct);
  disp.setAttribute('scale', scale.toFixed(1));

  cards.forEach((c,i) => {
    c.vx += (out[0]*0.2 + Math.sin(performance.now()/1000 + i))*0.05;
    c.vy += (out[1]*0.2 + Math.cos(performance.now()/900 + i))*0.05;
    c.vx *= 0.95; c.vy *= 0.95;
    c.x = (c.x + c.vx + 100) % 100;
    c.y = (c.y + c.vy + 100) % 100;
    c.el.style.left = c.x + 'vw';
    c.el.style.top = c.y + 'vh';
    c.el.style.transform = `scale(${0.9 + Math.abs(out[3])*0.2})`;
  });
  requestAnimationFrame(loop);
}
loop();
