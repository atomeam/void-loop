const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const status = document.getElementById('status');
const portalsEl = document.getElementById('portals');
let W=innerWidth, H=innerHeight;
cv.width=W; cv.height=H;
addEventListener('resize', ()=>{ W=innerWidth; H=innerHeight; cv.width=W; cv.height=H; });

// Simplified SPH-like particles (canvas fallback; WebGPU path stubbed for novelty)
const N = 1800;
const parts = [];
for(let i=0;i<N;i++){
  parts.push({
    x: Math.random()*W, y: Math.random()*H*0.6,
    vx: (Math.random()-0.5)*1, vy: (Math.random()-0.5)*1,
    dens:1, press:0, genome: Math.random()*360,
    r: 2.2 + Math.random()*1.5
  });
}

// Local MLP 6->8->3 (speed, ori deltas -> viscosity, inject, cohesion)
let weights = new Float32Array(6*8 + 8*3);
for(let i=0;i<weights.length;i++) weights[i]=(Math.random()-0.5)*0.3;
let mlpOut = [0.4, 0.2, 0.5]; // viscosity, inject, cohesion

function mlp(inp){
  // simple forward
  const h = new Float32Array(8);
  for(let i=0;i<8;i++){
    let s=0; for(let j=0;j<6;j++) s += inp[j]*weights[i*6+j];
    h[i] = Math.tanh(s);
  }
  const o = [0,0,0];
  const off=48;
  for(let i=0;i<3;i++){
    let s=0; for(let j=0;j<8;j++) s += h[j]*weights[off+i*8+j];
    o[i] = 0.5+0.5*Math.tanh(s);
  }
  return o;
}

// DeviceOrientation + pointer as hand
let ori = {beta:0, gamma:0, alpha:0};
let hand = {x:W/2, y:H/2, vx:0, vy:0, active:false};
let lastOri = {...ori};
if(window.DeviceOrientationEvent){
  addEventListener('deviceorientation', e=>{
    ori.beta = e.beta||0; ori.gamma = e.gamma||0; ori.alpha = e.alpha||0;
  });
}
cv.addEventListener('pointermove', e=>{
  const dx=e.clientX-hand.x, dy=e.clientY-hand.y;
  hand.vx = dx*0.1; hand.vy=dy*0.1;
  hand.x=e.clientX; hand.y=e.clientY; hand.active=true;
});
cv.addEventListener('pointerleave', ()=> hand.active=false);

// Portals
const portals = [];
for(let i=0;i<5;i++){
  const d=document.createElement('div');
  d.className='portal';
  d.textContent='portal '+i;
  portalsEl.appendChild(d);
  portals.push({el:d, x:100+i*140, y:80, dens:0});
}

// Persistence
const dbName='verse-f812';
let db;
const req=indexedDB.open(dbName,1);
req.onupgradeneeded=e=>{ e.target.result.createObjectStore('genome'); };
req.onsuccess=e=>{ db=e.target.result; loadGenome(); };
function loadGenome(){
  if(!db) return;
  const tx=db.transaction('genome','readonly');
  tx.objectStore('genome').get('weights').onsuccess=e=>{
    if(e.target.result) weights=new Float32Array(e.target.result);
  };
}
function seal(){
  if(!db) return;
  const tx=db.transaction('genome','readwrite');
  tx.objectStore('genome').put(Array.from(weights),'weights');
  status.textContent='genome sealed';
  // BroadcastChannel sealed transfer
  try{
    const bc=new BroadcastChannel('f812-genome');
    bc.postMessage({w:Array.from(weights)});
    bc.close();
  }catch (e) { console.debug("lab f812-webgpu-sph-hand-policy-mind:", e); }
}
document.getElementById('seal').onclick=seal;
new BroadcastChannel('f812-genome').onmessage=e=>{
  if(e.data?.w){ weights=new Float32Array(e.data.w); status.textContent='genome received'; }
};

// WebXR stub (hand joints as extra spheres)
let xrSession=null;
document.getElementById('xr').onclick=async ()=>{
  if(!navigator.xr){ status.textContent='no WebXR'; return; }
  try{
    xrSession=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['hand-tracking']});
    status.textContent='WebXR active (hand tracking if supported)';
    xrSession.addEventListener('end',()=>{xrSession=null; status.textContent='XR ended';});
  }catch(e){ status.textContent='XR denied'; }
};

// Main loop — simplified SPH forces
function step(){
  // MLP from orientation deltas + hand speed
  const dbeta=ori.beta-lastOri.beta, dgamma=ori.gamma-lastOri.gamma;
  lastOri={...ori};
  const inp=[hand.vx, hand.vy, dbeta*0.01, dgamma*0.01, ori.beta*0.01, Math.hypot(hand.vx,hand.vy)];
  mlpOut = mlp(inp);
  const visc = 0.02 + mlpOut[0]*0.15;
  const inject = mlpOut[1]*0.8;
  const cohesion = 0.3 + mlpOut[2]*0.6;

  // gravity + hand repulsion + neighbor density approx
  for(let i=0;i<N;i++){
    const p=parts[i];
    // gravity
    p.vy += 0.08;
    // hand sphere
    const dx=p.x-hand.x, dy=p.y-hand.y, dist=Math.hypot(dx,dy)+1;
    if(dist<80 && hand.active){
      const f=(80-dist)/dist * 2.2;
      p.vx += dx/dist * f;
      p.vy += dy/dist * f;
      if(inject>0.3) p.vy -= inject*0.4; // injection
    }
    // simple neighbor cohesion / pressure (sampled)
    let nx=0,ny=0,cnt=0;
    for(let j=0;j<12;j++){ // sparse sample
      const q=parts[(i+j*137)%N];
      const ddx=p.x-q.x, ddy=p.y-q.y, d=Math.hypot(ddx,ddy);
      if(d>0 && d<28){
        const k=(28-d)/28;
        nx -= ddx*k; ny -= ddy*k; cnt++;
        // genome transfer on contact
        if(d<6 && Math.random()<0.02) p.genome = (p.genome*0.7 + q.genome*0.3);
      }
    }
    if(cnt){ p.vx += nx*cohesion*0.04; p.vy += ny*cohesion*0.04; }
    // viscosity
    p.vx *= (1-visc); p.vy *= (1-visc);
    // integrate
    p.x += p.vx; p.y += p.vy;
    // bounds
    if(p.x<0){p.x=0;p.vx*=-0.5;} if(p.x>W){p.x=W;p.vx*=-0.5;}
    if(p.y>H){p.y=H;p.vy*=-0.4;} if(p.y<0){p.y=0;p.vy*=-0.3;}
  }

  // portals sample nearby density
  portals.forEach(po=>{
    let dsum=0, cnt=0;
    for(let i=0;i<200;i++){
      const p=parts[i];
      if(Math.hypot(p.x-po.x, p.y-po.y)<60){ dsum++; cnt++; }
    }
    po.dens = dsum/40;
    po.el.style.left=(po.x-45)+'px';
    po.el.style.top=(po.y-35)+'px';
    po.el.style.transform=`scale(${1+po.dens*0.4}) rotate(${po.dens*10}deg)`;
    po.el.style.background=`hsla(${180+po.dens*40},70%,40%,0.65)`;
    po.el.textContent=`ρ ${po.dens.toFixed(1)}`;
    // slight drift with fluid
    po.x += (Math.random()-0.5)*0.3;
  });

  // render
  ctx.fillStyle='rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  for(const p of parts){
    ctx.fillStyle=`hsla(${p.genome},70%,${50+mlpOut[0]*20}%,0.75)`;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.28); ctx.fill();
  }
  if(hand.active){
    ctx.strokeStyle='#6cf'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(hand.x,hand.y,40,0,6.28); ctx.stroke();
  }
  status.textContent=`visc ${mlpOut[0].toFixed(2)} | inject ${mlpOut[1].toFixed(2)} | parts ${N}`;
  requestAnimationFrame(step);
}
requestAnimationFrame(step);
