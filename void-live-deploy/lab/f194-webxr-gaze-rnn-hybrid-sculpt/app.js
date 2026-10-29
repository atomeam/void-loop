const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cardsEl = document.getElementById('cards');
const status = document.getElementById('status');
let w, h, particles = [], seeds = [];
let rnn = { h: [0,0,0,0], wIn: [[0.2,0.1],[ -0.1,0.3],[0.4,-0.2],[0.1,0.5]], wH: [[0.5,0.1,0,0],[0,0.6,-0.1,0.2],[0.1,0,0.4,0],[0,0.2,0,0.7]], wOut: [[0.3,0.1, -0.2,0.4],[0.1,0.5,0.2,-0.1],[ -0.3,0.2,0.6,0.1]] };
let xrSession = null, gaze = {x:0.5, y:0.5, active:false};
let db;

function resize() { w = canvas.width = innerWidth; h = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

function tanh(x) { return Math.tanh(x); }
function stepRNN(input) {
  const newH = [0,0,0,0];
  for(let i=0;i<4;i++) {
    let s = rnn.wIn[i][0]*input[0] + rnn.wIn[i][1]*input[1];
    for(let j=0;j<4;j++) s += rnn.wH[i][j] * rnn.h[j];
    newH[i] = tanh(s);
  }
  rnn.h = newH;
  const out = [0,0,0];
  for(let o=0;o<3;o++) {
    for(let j=0;j<4;j++) out[o] += rnn.wOut[o][j] * rnn.h[j];
    out[o] = tanh(out[o]);
  }
  return out;
}

function createCards() {
  cardsEl.innerHTML = '';
  for(let i=0;i<5;i++) {
    const c = document.createElement('div');
    c.className = 'card';
    c.textContent = `Mind node ${i+1}`;
    c.style.left = (20 + i*15) + '%';
    c.style.top = (30 + (i%3)*15) + '%';
    cardsEl.appendChild(c);
  }
}
createCards();

function updateCards(out) {
  const cards = cardsEl.children;
  for(let i=0;i<cards.length;i++) {
    const card = cards[i];
    const dx = out[0] * 10 * (i%2 ? 1 : -1);
    const dy = out[1] * 8;
    const sc = 1 + out[2] * 0.3;
    card.style.transform = `translate(${dx}%, ${dy}%) scale(${sc})`;
    card.style.background = `rgba(${80+out[0]*40}, ${40+out[1]*30}, 160, 0.7)`;
  }
}

function addParticle(x, y) {
  particles.push({x:x*w, y:y*h, vx:(Math.random()-0.5)*2, vy:(Math.random()-0.5)*2, life:60, e:1});
  seeds.push({x,y,t:Date.now()});
  if(seeds.length > 50) seeds.shift();
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,w,h);
  particles.forEach((p,i) => {
    p.x += p.vx; p.y += p.vy; p.life--;
    if(p.life<=0) particles.splice(i,1);
    else {
      ctx.fillStyle = `hsla(${200 + p.e*60},80%,60%,${p.life/60})`;
      ctx.beginPath(); ctx.arc(p.x,p.y,3+p.e*2,0,Math.PI*2); ctx.fill();
    }
  });
  if(Math.random()<0.3 && seeds.length) {
    const s = seeds[seeds.length-1];
    addParticle(s.x + (Math.random()-0.5)*0.05, s.y + (Math.random()-0.5)*0.05);
  }
}

let lastT = 0;
function loop(t) {
  const energy = particles.length / 100;
  const out = stepRNN([energy, (t%10000)/10000]);
  updateCards(out);
  draw();
  status.textContent = `RNN h:[${rnn.h.map(v=>v.toFixed(2)).join(',')}] energy:${energy.toFixed(2)} seeds:${seeds.length}`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

canvas.addEventListener('click', e => {
  const x = e.clientX / w, y = e.clientY / h;
  addParticle(x, y);
  gaze = {x, y, active:true};
});

document.getElementById('seedBtn').onclick = () => addParticle(gaze.x || 0.5, gaze.y || 0.5);
document.getElementById('resetBtn').onclick = () => { rnn.h=[0,0,0,0]; particles=[]; seeds=[]; status.textContent='Mind reset'; saveState(); };

async function openDB() {
  return new Promise((res,rej) => {
    const req = indexedDB.open('F194Mind',1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('state');
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  });
}
async function saveState() {
  if(!db) db = await openDB();
  const tx = db.transaction('state','readwrite');
  tx.objectStore('state').put({rnn, seeds: seeds.slice(-20)}, 'mind');
}
async function loadState() {
  try {
    db = await openDB();
    const tx = db.transaction('state','readonly');
    const req = tx.objectStore('state').get('mind');
    req.onsuccess = () => { if(req.result) { Object.assign(rnn, req.result.rnn); seeds = req.result.seeds || []; status.textContent='Loaded persisted mind'; } };
  } catch(e) {}
}
loadState();
setInterval(saveState, 5000);

async function enterXR() {
  if(!navigator.xr) { status.textContent='No WebXR'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['local-floor']});
    status.textContent='WebXR active – gaze/click seeds';
    xrSession.addEventListener('end', () => { xrSession=null; status.textContent='XR ended'; });
  } catch(e) { status.textContent='XR fail: '+e.message; }
}
document.getElementById('xrBtn').onclick = enterXR;

addEventListener('pointermove', e => { gaze.x = e.clientX/w; gaze.y = e.clientY/h; });
