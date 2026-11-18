const N = 12;
const stage = document.getElementById('stage');
const canvas = document.getElementById('strings');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let w, h, nodes = [], genomes = [], mlps = [];
let pointer = {x:0,y:0,down:false,grab:null};
let orient = {x:0,y:0,z:0};
let xrSession = null, xrFrame = null, handPos = null;

function resize() {
  w = window.innerWidth; h = window.innerHeight;
  canvas.width = w; canvas.height = h;
}
resize(); window.onresize = resize;

function rand(a,b){return a+Math.random()*(b-a);}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

class MLP {
  constructor(weights) {
    // input 8, hidden 6, output 2
    this.w1 = weights ? weights.w1 : Array.from({length:8*6}, ()=>rand(-0.5,0.5));
    this.b1 = weights ? weights.b1 : Array.from({length:6}, ()=>rand(-0.2,0.2));
    this.w2 = weights ? weights.w2 : Array.from({length:6*2}, ()=>rand(-0.5,0.5));
    this.b2 = weights ? weights.b2 : Array.from({length:2}, ()=>rand(-0.2,0.2));
  }
  forward(inp) {
    const hid = this.b1.map((b,i)=>b);
    for(let i=0;i<8;i++) for(let j=0;j<6;j++) hid[j] += inp[i]*this.w1[i*6+j];
    for(let j=0;j<6;j++) hid[j] = Math.tanh(hid[j]);
    const out = this.b2.map(b=>b);
    for(let j=0;j<6;j++) for(let k=0;k<2;k++) out[k] += hid[j]*this.w2[j*2+k];
    return out.map(v=>Math.tanh(v));
  }
  mutate(rate=0.1) {
    const m = (arr)=>arr.map(v=>v + (Math.random()<rate?rand(-0.3,0.3):0));
    return new MLP({w1:m(this.w1),b1:m(this.b1),w2:m(this.w2),b2:m(this.b2)});
  }
  crossover(other) {
    const mix = (a,b)=>a.map((v,i)=>Math.random()<0.5?v:b[i]);
    return new MLP({w1:mix(this.w1,other.w1),b1:mix(this.b1,other.b1),w2:mix(this.w2,other.w2),b2:mix(this.b2,other.b2)});
  }
  serialize(){return {w1:this.w1,b1:this.b1,w2:this.w2,b2:this.b2};}
}

function createNode(i) {
  const el = document.createElement('div');
  el.className = 'node';
  el.textContent = i;
  stage.appendChild(el);
  return {
    el, id:i,
    x: rand(80,w-80), y: rand(80,h-80),
    vx:0, vy:0,
    fitness:0,
    mlp: new MLP()
  };
}

function init() {
  nodes.forEach(n=>n.el.remove());
  nodes = [];
  for(let i=0;i<N;i++) nodes.push(createNode(i));
  status.textContent = `Magnetic string mind ready — ${N} agents. Drag nodes or enter XR.`;
}

// Input
stage.onpointerdown = e => {
  pointer.down=true; pointer.x=e.clientX; pointer.y=e.clientY;
  const t = e.target.closest('.node');
  if(t) {
    const id = +t.textContent;
    pointer.grab = nodes.find(n=>n.id===id);
  }
};
stage.onpointermove = e => {
  pointer.x=e.clientX; pointer.y=e.clientY;
  if(pointer.grab && pointer.down) {
    pointer.grab.x = e.clientX;
    pointer.grab.y = e.clientY;
    pointer.grab.vx=0; pointer.grab.vy=0;
  }
};
stage.onpointerup = ()=>{ pointer.down=false; pointer.grab=null; };

window.addEventListener('deviceorientation', e=>{
  orient.x = (e.beta||0)/90;
  orient.y = (e.gamma||0)/90;
  orient.z = (e.alpha||0)/180;
});

// XR
document.getElementById('xrBtn').onclick = async ()=>{
  if(!navigator.xr) { status.textContent='WebXR not available — using pointer.'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['hand-tracking']});
    status.textContent='XR session started — move hands near nodes.';
    // Simple loop stub; full hand tracking requires more, but we sample if present
    xrSession.addEventListener('end', ()=>{xrSession=null; status.textContent='XR ended.';});
  } catch(err) {
    status.textContent='XR denied or unsupported: '+err.message;
  }
};

function getCausalInput(n) {
  const hx = handPos ? (handPos.x - n.x)/w : (pointer.x - n.x)/w;
  const hy = handPos ? (handPos.y - n.y)/h : (pointer.y - n.y)/h;
  return [hx, hy, Math.hypot(hx,hy), orient.x, orient.y, orient.z, n.vx/10, n.vy/10];
}

function step() {
  // Forces
  for(let i=0;i<N;i++){
    const a = nodes[i];
    let fx=0, fy=0;
    const inp = getCausalInput(a);
    const out = a.mlp.forward(inp);
    const pol = out[0], str = Math.abs(out[1])*40 + 10;
    for(let j=0;j<N;j++) if(i!==j){
      const b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx,dy)+1;
      if(d<300){
        const mag = (pol * str) / (d*d) * 800;
        fx += (dx/d)*mag;
        fy += (dy/d)*mag;
        // string contact genome transfer
        if(d<80 && Math.random()<0.01){
          a.mlp = a.mlp.crossover(b.mlp).mutate(0.05);
          a.fitness += 0.1;
        }
      }
    }
    // hand pull
    if(pointer.grab === a) { /* already positioned */ }
    else {
      a.vx = (a.vx + fx*0.01)*0.92;
      a.vy = (a.vy + fy*0.01)*0.92;
      a.x = clamp(a.x + a.vx, 20, w-20);
      a.y = clamp(a.y + a.vy, 20, h-20);
    }
    a.el.style.left = a.x+'px';
    a.el.style.top = a.y+'px';
    a.el.classList.toggle('high', a.fitness>1);
  }
  // Draw strings
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle = 'rgba(100,180,255,0.4)';
  ctx.lineWidth = 1.5;
  for(let i=0;i<N;i++) for(let j=i+1;j<N;j++){
    const a=nodes[i], b=nodes[j];
    const d = Math.hypot(a.x-b.x, a.y-b.y);
    if(d<220){
      ctx.beginPath();
      ctx.moveTo(a.x,a.y);
      ctx.lineTo(b.x,b.y);
      ctx.globalAlpha = clamp(1-d/220,0,0.6);
      ctx.stroke();
    }
  }
  ctx.globalAlpha=1;
  requestAnimationFrame(step);
}

// Persistence
const DB_NAME = 'f781-magnetic-mind';
async function seal() {
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open(DB_NAME,1);
      r.onupgradeneeded = ()=>r.result.createObjectStore('genomes');
      r.onsuccess = ()=>res(r.result);
      r.onerror = ()=>rej(r.error);
    });
    const tx = db.transaction('genomes','readwrite');
    const store = tx.objectStore('genomes');
    const best = nodes.slice().sort((a,b)=>b.fitness-a.fitness).slice(0,4);
    store.put(best.map(n=>n.mlp.serialize()), 'top');
    status.textContent = 'Genomes sealed to IndexedDB.';
  } catch(e){ status.textContent='Seal failed: '+e.message; }
}
document.getElementById('sealBtn').onclick = seal;
document.getElementById('resetBtn').onclick = init;

// BroadcastChannel multi-tab
try {
  const bc = new BroadcastChannel('f781-genome');
  setInterval(()=>{
    if(nodes.length) bc.postMessage({type:'genome', data:nodes[0].mlp.serialize()});
  }, 2000);
  bc.onmessage = e=>{
    if(e.data.type==='genome' && nodes.length){
      nodes[Math.floor(Math.random()*N)].mlp = new MLP(e.data.data).mutate(0.02);
    }
  };
} catch (e) { console.debug("lab f781-webxr-hand-magnetic-string-genome-mind:", e); }

init();
step();
status.textContent = 'Verse magnetic string genome mind active. Drag nodes; seal to persist.';
