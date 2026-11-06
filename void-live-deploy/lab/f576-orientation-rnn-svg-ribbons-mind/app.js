const SVG_NS = "http://www.w3.org/2000/svg";
const N_RIBBONS = 6;
const H = 12; // hidden
const IN = 6; // beta, gamma, dx, dy, sin t, cos t
const OUT = N_RIBBONS * 8; // 4 points × 2 coords each

// Weights
let Wxh = randMat(H, IN);
let Whh = randMat(H, H);
let Why = randMat(OUT, H);
let bh = randVec(H);
let by = randVec(OUT);
let h = randVec(H);

let eligibility = { Wxh: zeroMat(H,IN), Whh: zeroMat(H,H), Why: zeroMat(OUT,H), bh: zeroVec(H), by: zeroVec(OUT) };

let beta = 0, gamma = 0, dx = 0, dy = 0;
let lastX = 0, lastY = 0;
let t = 0;
let ribbons = [];

function randMat(r,c){ const m=[]; for(let i=0;i<r;i++){ m[i]=[]; for(let j=0;j<c;j++) m[i][j]=(Math.random()-0.5)*0.3; } return m; }
function randVec(n){ return Array.from({length:n}, ()=>(Math.random()-0.5)*0.1); }
function zeroMat(r,c){ return Array.from({length:r}, ()=>Array(c).fill(0)); }
function zeroVec(n){ return Array(n).fill(0); }

function matVec(m,v){ return m.map(row => row.reduce((s,w,i)=>s+w*(v[i]||0),0)); }
function tanh(v){ return v.map(x=>Math.tanh(x)); }
function add(a,b){ return a.map((x,i)=>x+(b[i]||0)); }
function scale(v,s){ return v.map(x=>x*s); }

function rnnForward(x){
  const pre = add(matVec(Whh, h), add(matVec(Wxh, x), bh));
  const hNew = tanh(pre);
  const out = add(matVec(Why, hNew), by);
  // eligibility (simple eligibility trace decay)
  const decay = 0.9;
  eligibility.Whh = eligibility.Whh.map((row,i)=>row.map((v,j)=>v*decay + h[j]* (1-hNew[i]*hNew[i])));
  eligibility.Wxh = eligibility.Wxh.map((row,i)=>row.map((v,j)=>v*decay + (x[j]||0)*(1-hNew[i]*hNew[i])));
  eligibility.bh = eligibility.bh.map((v,i)=>v*decay + (1-hNew[i]*hNew[i]));
  eligibility.Why = eligibility.Why.map((row,i)=>row.map((v,j)=>v*decay + hNew[j]));
  eligibility.by = eligibility.by.map(v=>v*decay + 1);
  h = hNew;
  return out;
}

function updateWeights(reward, lr=0.01){
  const r = Math.tanh(reward);
  Why = Why.map((row,i)=>row.map((w,j)=>w + lr * r * eligibility.Why[i][j]));
  by = by.map((b,i)=>b + lr * r * eligibility.by[i]);
  Whh = Whh.map((row,i)=>row.map((w,j)=>w + lr * r * eligibility.Whh[i][j] * 0.5));
  Wxh = Wxh.map((row,i)=>row.map((w,j)=>w + lr * r * eligibility.Wxh[i][j] * 0.5));
  bh = bh.map((b,i)=>b + lr * r * eligibility.bh[i] * 0.5);
}

function makeRibbon(i){
  const g = document.createElementNS(SVG_NS, "g");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("fill", `hsla(${i*60},70%,50%,0.35)`);
  path.setAttribute("stroke", `hsla(${i*60},80%,70%,0.8)`);
  path.setAttribute("stroke-width", "2");
  path.style.cursor = "pointer";
  path.addEventListener("click", (e)=>{
    e.stopPropagation();
    const len = path.getTotalLength?.() || 100;
    const energy = h.reduce((s,v)=>s+Math.abs(v),0);
    updateWeights(len * energy * 0.01, 0.02);
    path.setAttribute("stroke-width", "4");
    setTimeout(()=>path.setAttribute("stroke-width","2"), 200);
    status.textContent = `Reinforced ribbon ${i} · reward ${ (len*energy*0.01).toFixed(2) }`;
  });
  g.appendChild(path);
  stage.appendChild(g);
  // base points
  const cx = 400 + (i-2.5)*80;
  const cy = 300;
  const pts = [
    {x:cx-40,y:cy-20}, {x:cx-20,y:cy-60}, {x:cx+20,y:cy-60}, {x:cx+40,y:cy-20},
    {x:cx+40,y:cy+20}, {x:cx+20,y:cy+60}, {x:cx-20,y:cy+60}, {x:cx-40,y:cy+20}
  ];
  return { path, pts, base: pts.map(p=>({...p})) };
}

const stage = document.getElementById("stage");
const status = document.getElementById("status");
for(let i=0;i<N_RIBBONS;i++) ribbons.push(makeRibbon(i));

function pointsToD(pts){
  // closed cubic
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for(let i=0;i<pts.length;i+=2){
    const c1 = pts[i];
    const c2 = pts[(i+1)%pts.length];
    const end = pts[(i+2)%pts.length];
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
  }
  return d + " Z";
}

function loop(ts){
  t = ts * 0.001;
  const x = [
    Math.tanh(beta/45),
    Math.tanh(gamma/45),
    Math.tanh(dx*0.05),
    Math.tanh(dy*0.05),
    Math.sin(t*0.7),
    Math.cos(t*0.7)
  ];
  const out = rnnForward(x);
  ribbons.forEach((r, ri)=>{
    const off = ri*8;
    for(let k=0;k<8;k++){
      r.pts[k].x = r.base[k].x + out[off + (k%4)*2] * 40;
      r.pts[k].y = r.base[k].y + out[off + (k%4)*2 +1] * 40;
    }
    r.path.setAttribute("d", pointsToD(r.pts));
    const hue = (ri*60 + h.reduce((s,v)=>s+v,0)*30 + t*10) % 360;
    r.path.setAttribute("fill", `hsla(${hue},70%,50%,0.32)`);
    r.path.setAttribute("stroke", `hsla(${hue},85%,65%,0.85)`);
  });
  dx *= 0.85; dy *= 0.85;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Inputs
window.addEventListener("deviceorientation", e=>{
  if(e.beta!=null) beta = e.beta;
  if(e.gamma!=null) gamma = e.gamma;
});
stage.addEventListener("pointermove", e=>{
  dx = e.clientX - lastX;
  dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
});
stage.addEventListener("pointerdown", e=>{ lastX=e.clientX; lastY=e.clientY; });

// iOS permission
if(typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function"){
  const btn = document.createElement("button");
  btn.textContent = "Enable tilt";
  btn.style.marginLeft = "6px";
  btn.onclick = ()=> DeviceOrientationEvent.requestPermission().then(s=>{ if(s==="granted") status.textContent="Tilt enabled"; });
  document.querySelector(".hud").appendChild(btn);
}

// IndexedDB
const DB = "verse-f576";
function openDB(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open(DB,1);
    r.onupgradeneeded = ()=> r.result.createObjectStore("w", {keyPath:"id"});
    r.onsuccess = ()=> res(r.result);
    r.onerror = ()=> rej(r.error);
  });
}
async function seal(){
  const db = await openDB();
  const tx = db.transaction("w","readwrite");
  tx.objectStore("w").put({id:"weights", Wxh, Whh, Why, bh, by, h});
  status.textContent = "Sealed to IndexedDB";
}
async function load(){
  try{
    const db = await openDB();
    const tx = db.transaction("w","readonly");
    const req = tx.objectStore("w").get("weights");
    req.onsuccess = ()=>{
      const d = req.result;
      if(d){ Wxh=d.Wxh; Whh=d.Whh; Why=d.Why; bh=d.bh; by=d.by; h=d.h; status.textContent="Loaded seal"; }
      else status.textContent="No seal";
    };
  }catch(e){ status.textContent="DB error"; }
}
function reset(){
  Wxh=randMat(H,IN); Whh=randMat(H,H); Why=randMat(OUT,H); bh=randVec(H); by=randVec(OUT); h=randVec(H);
  status.textContent="Weights reset";
}
document.getElementById("seal").onclick = seal;
document.getElementById("load").onclick = load;
document.getElementById("reset").onclick = reset;
load();
