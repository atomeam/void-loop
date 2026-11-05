const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const N = 48;
const cell = 8;
canvas.width = N * cell;
canvas.height = N * cell;
canvas.style.width = '100vw';
canvas.style.height = '100vh';
canvas.style.objectFit = 'contain';

let spins = Array.from({length:N*N}, () => Math.random() < 0.5 ? 1 : -1);
let beta = 0.8, h = 0.0;
let fitness = 0, mode = 'mag'; // mag or energy
let lastOrient = {beta:0, gamma:0, dbeta:0, dgamma:0};
let pointerVel = {dx:0, dy:0, t:0};
let usingOri = false;

// Tiny MLP: 4 -> 8 -> 2
let W1 = Array.from({length:8}, () => Array.from({length:4}, () => (Math.random()-0.5)*0.5));
let B1 = Array.from({length:8}, () => (Math.random()-0.5)*0.1);
let W2 = Array.from({length:2}, () => Array.from({length:8}, () => (Math.random()-0.5)*0.5));
let B2 = Array.from({length:2}, () => (Math.random()-0.5)*0.1);

function tanh(x){ return Math.tanh(x); }
function mlpForward(x){
  const h1 = B1.map((b,i) => tanh(W1[i].reduce((s,w,j)=>s+w*x[j], b)));
  return B2.map((b,i) => tanh(W2[i].reduce((s,w,j)=>s+w*h1[j], b)));
}
function updateParams(){
  const inp = usingOri
    ? [lastOrient.beta/90, lastOrient.gamma/90, lastOrient.dbeta/10, lastOrient.dgamma/10]
    : [pointerVel.dx*0.01, pointerVel.dy*0.01, Math.abs(pointerVel.dx)*0.005, Math.abs(pointerVel.dy)*0.005];
  const out = mlpForward(inp);
  beta = 0.15 + (out[0]+1)*0.925; // ~0.15..2.0
  h = out[1]*0.8;
}

// Ising step
function metropolis(trials=200){
  for(let t=0; t<trials; t++){
    const i = Math.floor(Math.random()*N*N);
    const x = i % N, y = Math.floor(i/N);
    const s = spins[i];
    let sum = 0;
    sum += spins[y*N + (x+1)%N];
    sum += spins[y*N + (x-1+N)%N];
    sum += spins[((y+1)%N)*N + x];
    sum += spins[((y-1+N)%N)*N + x];
    const dE = 2 * s * (sum + h); // J=1
    if (dE <= 0 || Math.random() < Math.exp(-beta * dE)) spins[i] = -s;
  }
}

function magnetization(){
  let m = 0;
  for(const s of spins) m += s;
  return m / (N*N);
}
function energy(){
  let e = 0;
  for(let y=0; y<N; y++) for(let x=0; x<N; x++){
    const s = spins[y*N+x];
    e -= s * spins[y*N + (x+1)%N];
    e -= s * spins[((y+1)%N)*N + x];
    e -= h * s;
  }
  return e / (N*N);
}

// DOM cards
const cards = [];
for(let i=0; i<6; i++){
  const d = document.createElement('div');
  d.className = 'card';
  d.textContent = 'Domain '+(i+1);
  d.style.left = (60 + i*110) + 'px';
  d.style.top = (canvas.height - 90) + 'px';
  document.body.appendChild(d);
  cards.push({el:d, x:60+i*110, y:canvas.height-90, vx:0, vy:0});
  let drag=false, ox=0, oy=0;
  d.addEventListener('pointerdown', e=>{ drag=true; ox=e.clientX-d.offsetLeft; oy=e.clientY-d.offsetTop; d.setPointerCapture(e.pointerId); });
  d.addEventListener('pointermove', e=>{ if(!drag) return; d.style.left=(e.clientX-ox)+'px'; d.style.top=(e.clientY-oy)+'px'; });
  d.addEventListener('pointerup', e=>{
    drag=false;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width * N;
    const cy = (e.clientY - rect.top) / rect.height * N;
    if(cx>=0 && cx<N && cy>=0 && cy<N){
      // inject flips in 3x3
      for(let dy=-1; dy<=1; dy++) for(let dx=-1; dx<=1; dx++){
        const nx=(Math.floor(cx)+dx+N)%N, ny=(Math.floor(cy)+dy+N)%N;
        spins[ny*N+nx] = Math.random()<0.7 ? 1 : -1;
      }
    }
  });
}

function updateCards(){
  cards.forEach((c,i)=>{
    const gx = Math.floor((i%3)*N/3 + N/6), gy = Math.floor(Math.floor(i/3)*N/2 + N/4);
    let m=0, cnt=0;
    for(let dy=-2; dy<=2; dy++) for(let dx=-2; dx<=2; dx++){
      const nx=(gx+dx+N)%N, ny=(gy+dy+N)%N;
      m += spins[ny*N+nx]; cnt++;
    }
    m /= cnt;
    const hue = m>0 ? 0 : 220;
    const sat = Math.min(100, Math.abs(m)*120);
    c.el.style.background = `hsl(${hue},${sat}%,${40+Math.abs(m)*20}%)`;
    c.el.style.transform = `scale(${0.85 + Math.abs(m)*0.3})`;
    c.el.textContent = `Domain ${i+1}\nm=${m.toFixed(2)}`;
  });
}

// Rendering
function render(){
  const img = ctx.createImageData(N*cell, N*cell);
  for(let y=0; y<N; y++) for(let x=0; x<N; x++){
    const s = spins[y*N+x];
    const col = s>0 ? [220,60,60] : [60,80,220];
    for(let dy=0; dy<cell; dy++) for(let dx=0; dx<cell; dx++){
      const idx = ((y*cell+dy)*N*cell + (x*cell+dx))*4;
      img.data[idx]=col[0]; img.data[idx+1]=col[1]; img.data[idx+2]=col[2]; img.data[idx+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
}

// Main loop
let lastFit = 0;
function loop(){
  updateParams();
  metropolis(180);
  const m = magnetization();
  const e = energy();
  fitness = mode==='mag' ? Math.abs(m) : -e;
  if(fitness > lastFit + 0.01){
    // simple reward update
    for(let i=0;i<8;i++) for(let j=0;j<4;j++) W1[i][j] += (Math.random()-0.5)*0.002;
    lastFit = fitness;
  }
  updateCards();
  render();
  statusEl.innerHTML = `β=${beta.toFixed(2)} h=${h.toFixed(2)}<br>M=${m.toFixed(3)} E=${e.toFixed(2)}<br>fit=${fitness.toFixed(3)} ${usingOri?'ori':'ptr'}<br>N=${N}`;
  requestAnimationFrame(loop);
}
loop();

// Controls
document.getElementById('oriBtn').onclick = ()=>{
  if(DeviceOrientationEvent.requestPermission){
    DeviceOrientationEvent.requestPermission().then(p=>{
      if(p==='granted'){ usingOri=true; window.addEventListener('deviceorientation', onOri); statusEl.textContent+=' ori ok'; }
    });
  } else {
    usingOri=true; window.addEventListener('deviceorientation', onOri);
  }
};
function onOri(e){
  const b = e.beta||0, g=e.gamma||0;
  lastOrient.dbeta = b - lastOrient.beta;
  lastOrient.dgamma = g - lastOrient.gamma;
  lastOrient.beta = b; lastOrient.gamma = g;
}
canvas.addEventListener('pointermove', e=>{
  const now = performance.now();
  if(pointerVel.t){
    pointerVel.dx = (e.clientX - pointerVel.lx) / Math.max(1, now-pointerVel.t) * 16;
    pointerVel.dy = (e.clientY - pointerVel.ly) / Math.max(1, now-pointerVel.t) * 16;
  }
  pointerVel.lx=e.clientX; pointerVel.ly=e.clientY; pointerVel.t=now;
});

document.getElementById('sealBtn').onclick = seal;
async function seal(){
  const data = {W1,B1,W2,B2,beta,h,fitness,t:Date.now()};
  const str = JSON.stringify(data);
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  const hash = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const db = await new Promise((res,rej)=>{
    const r = indexedDB.open('verse-f532',1);
    r.onupgradeneeded = ()=> r.result.createObjectStore('genomes');
    r.onsuccess = ()=> res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({hash,data}, 'latest');
  await new Promise(r=> tx.oncomplete=r);
  try{
    const bc = new BroadcastChannel('f532-ising');
    bc.postMessage({hash,fitness,data});
  }catch(e){}
  statusEl.innerHTML += `<br>sealed ${hash.slice(0,8)}`;
}

document.getElementById('resetBtn').onclick = ()=>{
  spins = Array.from({length:N*N}, () => Math.random()<0.5?1:-1);
};
document.getElementById('fitBtn').onclick = (e)=>{
  mode = mode==='mag' ? 'energy' : 'mag';
  e.target.textContent = 'Fitness: ' + (mode==='mag' ? '|M|' : '-E');
};

// Listen for sealed genomes
try{
  const bc = new BroadcastChannel('f532-ising');
  bc.onmessage = (ev)=>{
    if(ev.data.fitness > fitness + 0.05){
      Object.assign({W1,B1,W2,B2}, ev.data.data);
      statusEl.innerHTML += '<br>adopted genome';
    }
  };
}catch(e){}

statusEl.textContent = 'Verse Ising ready — enable orientation or move pointer';
