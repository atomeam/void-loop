const N = 24;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let w = canvas.width = innerWidth, h = canvas.height = innerHeight;
addEventListener('resize', () => { w = canvas.width = innerWidth; h = canvas.height = innerHeight; });

// Tiny MLP: 6 inputs → 8 hidden → 2 force
const IN = 6, HID = 8, OUT = 2;
const WEIGHTS = IN*HID + HID*OUT; // per agent

let agents = [];
let orbs = [];
let orient = {x:0, y:0};
let useWebGPU = false;

function rand(a,b){ return a + Math.random()*(b-a); }
function hashWeights(w){
  let h = 0;
  for(let i=0;i<w.length;i++) h = (h*31 + Math.floor(w[i]*1000))|0;
  return 'sha-demo-' + (h>>>0).toString(16);
}

function makeAgent(id){
  const weights = new Float32Array(WEIGHTS);
  for(let i=0;i<WEIGHTS;i++) weights[i] = rand(-1,1);
  return {
    id, x: rand(0,w), y: rand(0,h), vx:0, vy:0, energy:1, fitness:0,
    weights, badge: document.createElement('div')
  };
}
function initAgents(){
  agents = [];
  for(let i=0;i<N;i++){
    const a = makeAgent(i);
    a.badge.className = 'badge';
    a.badge.textContent = `#${i} 0`;
    document.body.appendChild(a.badge);
    agents.push(a);
  }
  orbs = [];
  for(let i=0;i<5;i++) orbs.push({x:rand(50,w-50), y:rand(50,h-50), e:10});
}
initAgents();

function mlpForce(a, ox, oy){
  const dx = (ox - a.x)/w, dy = (oy - a.y)/h;
  const inputs = [dx, dy, a.vx*0.1, a.vy*0.1, a.energy*0.1, Math.hypot(orient.x,orient.y)];
  let hid = new Float32Array(HID);
  let wi = 0;
  for(let h=0;h<HID;h++){
    let s = 0;
    for(let i=0;i<IN;i++) s += inputs[i] * a.weights[wi++];
    hid[h] = Math.tanh(s);
  }
  let fx=0, fy=0;
  for(let o=0;o<OUT;o++){
    let s=0;
    for(let h=0;h<HID;h++) s += hid[h] * a.weights[wi++];
    if(o===0) fx=s; else fy=s;
  }
  return {fx:fx*2, fy:fy*2};
}

function stepCPU(){
  for(let a of agents){
    let best=orbs[0], bd=1e9;
    for(let o of orbs){
      const d = Math.hypot(o.x-a.x, o.y-a.y);
      if(d<bd){ bd=d; best=o; }
    }
    const f = mlpForce(a, best.x, best.y);
    a.vx += f.fx + orient.x*0.5;
    a.vy += f.fy + orient.y*0.5;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x += a.vx; a.y += a.vy;
    if(a.x<0||a.x>w) a.vx*=-1;
    if(a.y<0||a.y>h) a.vy*=-1;
    a.x = Math.max(0,Math.min(w,a.x));
    a.y = Math.max(0,Math.min(h,a.y));
    if(bd < 30){ a.energy += 0.5; a.fitness += 0.5; best.e -= 0.5; if(best.e<0){ best.x=rand(50,w-50); best.y=rand(50,h-50); best.e=10; } }
    a.energy *= 0.995;
  }
}

function render(){
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,w,h);
  for(let o of orbs){
    ctx.beginPath();
    ctx.arc(o.x, o.y, 8+o.e, 0, 6.28);
    ctx.fillStyle = `hsl(${120 + o.e*10},80%,60%)`;
    ctx.fill();
  }
  for(let a of agents){
    ctx.beginPath();
    ctx.arc(a.x, a.y, 6+a.energy*2, 0, 6.28);
    ctx.fillStyle = `hsl(${a.id*15},70%,60%)`;
    ctx.fill();
    a.badge.style.left = a.x + 'px';
    a.badge.style.top = a.y + 'px';
    a.badge.textContent = `#${a.id} f:${a.fitness.toFixed(0)}`;
  }
}

let sealed = null;
document.getElementById('seal').onclick = () => {
  const best = agents.reduce((a,b)=> a.fitness>b.fitness?a:b);
  sealed = {id:best.id, weights:Array.from(best.weights), hash:hashWeights(best.weights), fitness:best.fitness};
  try{
    const req = indexedDB.open('void-f264',1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('genomes','readwrite');
      tx.objectStore('genomes').put(sealed, 'champion');
      status.textContent = `Sealed #${best.id} hash:${sealed.hash}`;
    };
  }catch(e){ status.textContent = 'Sealed in memory only'; }
};

document.getElementById('load').onclick = () => {
  if(!sealed){ status.textContent='No sealed'; return; }
  for(let a of agents) a.weights.set(sealed.weights);
  status.textContent = 'Loaded sealed into all agents';
};

let orientEnabled = false;
document.getElementById('orient').onclick = () => {
  if(DeviceOrientationEvent && DeviceOrientationEvent.requestPermission){
    DeviceOrientationEvent.requestPermission().then(p => {
      if(p==='granted') enableOrient();
    });
  } else enableOrient();
};
function enableOrient(){
  orientEnabled = true;
  addEventListener('deviceorientation', e => {
    orient.x = (e.gamma||0)/30;
    orient.y = (e.beta||0)/30;
  });
  status.textContent = 'Orientation enabled';
}
addEventListener('pointermove', e => {
  if(!orientEnabled){
    orient.x = (e.clientX - w/2)/w * 2;
    orient.y = (e.clientY - h/2)/h * 2;
  }
});

const bc = new BroadcastChannel('void-f264-genome');
bc.onmessage = e => {
  if(e.data.type==='genome' && e.data.weights){
    for(let a of agents) a.weights.set(e.data.weights);
    status.textContent = 'Received genome via BroadcastChannel';
  }
};
document.getElementById('send').onclick = () => {
  if(!sealed){ status.textContent='Seal first'; return; }
  bc.postMessage({type:'genome', weights:sealed.weights, hash:sealed.hash});
  status.textContent = 'Sent genome via BroadcastChannel (open another tab)';
};

async function tryWebGPU(){
  if(!navigator.gpu) return;
  try{
    const adapter = await navigator.gpu.requestAdapter();
    if(!adapter) return;
    await adapter.requestDevice();
    status.textContent = 'WebGPU available (CPU sim for reliability)';
  }catch(e){ console.log(e); }
}
tryWebGPU();

function loop(){
  stepCPU();
  render();
  requestAnimationFrame(loop);
}
loop();
status.textContent = 'Arena running. Tilt or move pointer. Seal champion.';
