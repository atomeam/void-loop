const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W=0, H=0, gridW=64, gridH=36, cell=0;
function resize(){ W=canvas.width=innerWidth; H=canvas.height=innerHeight; cell=Math.min(W/gridW, H/gridH); }
addEventListener('resize', resize); resize();

// Field: vx, vy, density
let vx = new Float32Array(gridW*gridH);
let vy = new Float32Array(gridW*gridH);
let dens = new Float32Array(gridW*gridH);
const particles = [];
const NPART = 320;
for(let i=0;i<NPART;i++) particles.push({x:Math.random()*gridW, y:Math.random()*gridH, vx:0, vy:0});

let orbs = [];
const MAX_ORBS = 8;

// Orientation
let ox=0, oy=0;
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => { ox = (e.gamma||0)/90; oy = (e.beta||0)/90; });
}
// Pointer
let px=0, py=0, injecting=false;
canvas.addEventListener('pointerdown', e=>{ injecting=true; px=e.clientX/cell; py=e.clientY/cell; });
canvas.addEventListener('pointermove', e=>{ if(injecting){ px=e.clientX/cell; py=e.clientY/cell; }});
canvas.addEventListener('pointerup', ()=>injecting=false);

// Worker for evolution
let worker, genomes = [];
try {
  const code = `
  let pop = [];
  function randG(){ return Array.from({length:28}, ()=>Math.random()*2-1); }
  for(let i=0;i<6;i++) pop.push(randG());
  function mlp(g, inp){
    const h = new Array(4).fill(0);
    for(let i=0;i<4;i++) for(let j=0;j<5;j++) h[i] += inp[j]*g[i*5+j];
    for(let i=0;i<4;i++) h[i] = Math.tanh(h[i]);
    const o = [0,0];
    for(let i=0;i<2;i++) for(let j=0;j<4;j++) o[i] += h[j]*g[20+i*4+j];
    return o;
  }
  self.onmessage = e => {
    if(e.data.type==='fitness'){
      const fit = e.data.fit || 0.5;
      pop.sort((a,b)=>Math.random()-0.5);
      for(let i=2;i<6;i++) for(let j=0;j<28;j++) if(Math.random()<0.1) pop[i][j] += (Math.random()-0.5)*0.3;
      self.postMessage({type:'genomes', genomes:pop.slice(0,4)});
    }
  };
  self.postMessage({type:'genomes', genomes:pop});
  `;
  const blob = new Blob([code], {type:'application/javascript'});
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = e => { if(e.data.genomes) genomes = e.data.genomes; };
} catch(e){ status.textContent += ' (no worker)'; }

function sample(arr, x, y){
  const ix = Math.floor(x)%gridW, iy=Math.floor(y)%gridH;
  return arr[iy*gridW + ix] || 0;
}

function step(dt){
  const nvx = new Float32Array(vx), nvy = new Float32Array(vy);
  for(let y=1;y<gridH-1;y++) for(let x=1;x<gridW-1;x++){
    const i = y*gridW+x;
    nvx[i] = (vx[i] + 0.1*(vx[i-1]+vx[i+1]+vx[i-gridW]+vx[i+gridW])) / 1.4;
    nvy[i] = (vy[i] + 0.1*(vy[i-1]+vy[i+1]+vy[i-gridW]+vy[i+gridW])) / 1.4;
  }
  vx=nvx; vy=nvy;

  for(let a=0; a<Math.min(4, genomes.length); a++){
    const sx = (a%2)*gridW*0.5 + gridW*0.25, sy = Math.floor(a/2)*gridH*0.5 + gridH*0.25;
    const fx = (Math.sin(performance.now()/800 + a) + ox)*0.02;
    const fy = (Math.cos(performance.now()/700 + a) + oy)*0.02;
    const ix = Math.floor(sx), iy=Math.floor(sy);
    if(ix>=0&&ix<gridW&&iy>=0&&iy<gridH){ vx[iy*gridW+ix] += fx; vy[iy*gridW+ix] += fy; }
  }

  if(injecting){
    const ix=Math.floor(px), iy=Math.floor(py);
    if(ix>0&&ix<gridW-1&&iy>0&&iy<gridH-1){
      dens[iy*gridW+ix] += 0.5;
      vx[iy*gridW+ix] += (px-ix-0.5)*0.1;
    }
  }

  dens.fill(0);
  for(const p of particles){
    const svx = sample(vx, p.x, p.y), svy = sample(vy, p.x, p.y);
    p.vx = p.vx*0.9 + svx*0.2;
    p.vy = p.vy*0.9 + svy*0.2;
    p.x = (p.x + p.vx*dt*20 + gridW)%gridW;
    p.y = (p.y + p.vy*dt*20 + gridH)%gridH;
    const ix=Math.floor(p.x), iy=Math.floor(p.y);
    dens[iy*gridW+ix] += 0.1;
  }

  if(orbs.length < MAX_ORBS && Math.random()<0.02){
    let mx=0, my=0, md=0;
    for(let i=0;i<dens.length;i++) if(dens[i]>md){ md=dens[i]; mx=i%gridW; my=Math.floor(i/gridW); }
    if(md>0.3) orbs.push({x:mx, y:my, life:1, sealed:false, el:createOrb()});
  }
  for(const o of orbs){
    o.life *= 0.995;
    const d = sample(dens, o.x, o.y);
    o.el.style.left = (o.x*cell)+'px';
    o.el.style.top = (o.y*cell)+'px';
    o.el.style.transform = `scale(${0.6 + d*1.5})`;
    o.el.style.opacity = Math.min(1, o.life + d);
    if(o.life<0.1){ o.el.remove(); o.dead=true; }
  }
  orbs = orbs.filter(o=>!o.dead);

  let ent=0, mv=0, c=0;
  for(let i=0;i<dens.length;i++){ if(dens[i]>0) ent -= dens[i]*Math.log(dens[i]+1e-6); mv += Math.abs(vx[i])+Math.abs(vy[i]); c++; }
  document.documentElement.style.setProperty('--field-entropy', Math.min(1, ent/200));
  document.documentElement.style.setProperty('--mean-vorticity', Math.min(1, mv/c*5));
}

function createOrb(){
  const el = document.createElement('div');
  el.className = 'orb';
  el.onclick = () => sealOrb(el);
  document.body.appendChild(el);
  return el;
}

async function sealOrb(el){
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({dens: Array.from(dens).slice(0,100), t:Date.now()})));
  const h = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
  el.classList.add('sealed');
  el.title = 'sealed '+h;
  try{
    const req = indexedDB.open('f321',1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('orbs');
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('orbs','readwrite');
      tx.objectStore('orbs').put({h, dens:Array.from(dens).slice(0,200), t:Date.now()}, h);
    };
  }catch (e) { console.warn('f321-webgpu-agent-fluid-memory-orbs:', e); }
  status.textContent = 'sealed '+h;
}

function loop(){
  step(0.016);
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#48f';
  for(const p of particles){
    ctx.fillRect(p.x*cell, p.y*cell, 2, 2);
  }
  for(let y=0;y<gridH;y++) for(let x=0;x<gridW;x++){
    const d = dens[y*gridW+x];
    if(d>0.05){ ctx.fillStyle = `rgba(100,180,255,${Math.min(0.4,d)})`; ctx.fillRect(x*cell, y*cell, cell, cell); }
  }
  status.textContent = `F321 · agents:${genomes.length} orbs:${orbs.length} · ${ox.toFixed(1)},${oy.toFixed(1)}`;
  requestAnimationFrame(loop);
}
loop();

document.getElementById('reset').onclick = ()=>{ dens.fill(0); vx.fill(0); vy.fill(0); particles.forEach(p=>{p.x=Math.random()*gridW; p.y=Math.random()*gridH;}); };
document.getElementById('sealBest').onclick = ()=> status.textContent = 'genome seal stub (use orbs)';
document.getElementById('loadLast').onclick = ()=> status.textContent = 'load from IDB stub';
