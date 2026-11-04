const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const agentsDiv = document.getElementById('agents');
let W=64, H=64, scale=1;
let u=[], v=[], d=[], u0=[], v0=[], d0=[];
let agents=[];
let mouse={x:0,y:0,down:false,px:0,py:0};
let visc=0.001;
let ke=0, entropy=0;

function idx(x,y){ return (y*W+x)|0; }
function alloc(){
  const n=W*H;
  u=new Float32Array(n); v=new Float32Array(n); d=new Float32Array(n);
  u0=new Float32Array(n); v0=new Float32Array(n); d0=new Float32Array(n);
}
function resize(){
  canvas.width=innerWidth; canvas.height=innerHeight;
  scale=Math.min(canvas.width/W, canvas.height/H);
  alloc();
}
resize(); addEventListener('resize',resize);

function setBnd(b,x){
  for(let i=1;i<W-1;i++){
    x[idx(i,0)] = b===2 ? -x[idx(i,1)] : x[idx(i,1)];
    x[idx(i,H-1)] = b===2 ? -x[idx(i,H-2)] : x[idx(i,H-2)];
  }
  for(let j=1;j<H-1;j++){
    x[idx(0,j)] = b===1 ? -x[idx(1,j)] : x[idx(1,j)];
    x[idx(W-1,j)] = b===1 ? -x[idx(W-2,j)] : x[idx(W-2,j)];
  }
  x[idx(0,0)] = 0.5*(x[idx(1,0)]+x[idx(0,1)]);
  x[idx(0,H-1)] = 0.5*(x[idx(1,H-1)]+x[idx(0,H-2)]);
  x[idx(W-1,0)] = 0.5*(x[idx(W-2,0)]+x[idx(W-1,1)]);
  x[idx(W-1,H-1)] = 0.5*(x[idx(W-2,H-1)]+x[idx(W-1,H-2)]);
}
function linSolve(b,x,x0,a,c){
  const inv=1/c;
  for(let k=0;k<12;k++){
    for(let j=1;j<H-1;j++) for(let i=1;i<W-1;i++){
      x[idx(i,j)] = (x0[idx(i,j)] + a*(x[idx(i-1,j)]+x[idx(i+1,j)]+x[idx(i,j-1)]+x[idx(i,j+1)])) * inv;
    }
    setBnd(b,x);
  }
}
function diffuse(b,x,x0,diff,dt){
  const a=dt*diff*(W-2)*(H-2);
  linSolve(b,x,x0,a,1+4*a);
}
function advect(b,d,d0,u,v,dt){
  const dt0x=dt*(W-2), dt0y=dt*(H-2);
  for(let j=1;j<H-1;j++) for(let i=1;i<W-1;i++){
    let x=i-dt0x*u[idx(i,j)], y=j-dt0y*v[idx(i,j)];
    if(x<0.5)x=0.5; if(x>W-1.5)x=W-1.5;
    if(y<0.5)y=0.5; if(y>H-1.5)y=H-1.5;
    const i0=x|0, i1=i0+1, j0=y|0, j1=j0+1;
    const s1=x-i0, s0=1-s1, t1=y-j0, t0=1-t1;
    d[idx(i,j)] = s0*(t0*d0[idx(i0,j0)]+t1*d0[idx(i0,j1)]) + s1*(t0*d0[idx(i1,j0)]+t1*d0[idx(i1,j1)]);
  }
  setBnd(b,d);
}
function project(u,v,p,div){
  for(let j=1;j<H-1;j++) for(let i=1;i<W-1;i++){
    div[idx(i,j)] = -0.5*(u[idx(i+1,j)]-u[idx(i-1,j)] + v[idx(i,j+1)]-v[idx(i,j-1)]) / Math.max(W,H);
    p[idx(i,j)] = 0;
  }
  setBnd(0,div); setBnd(0,p);
  linSolve(0,p,div,1,4);
  for(let j=1;j<H-1;j++) for(let i=1;i<W-1;i++){
    u[idx(i,j)] -= 0.5*(p[idx(i+1,j)]-p[idx(i-1,j)]) * Math.max(W,H);
    v[idx(i,j)] -= 0.5*(p[idx(i,j+1)]-p[idx(i,j-1)]) * Math.max(W,H);
  }
  setBnd(1,u); setBnd(2,v);
}
function step(){
  // sources from pointer
  if(mouse.down){
    const gx=((mouse.x/canvas.width)*W)|0, gy=((mouse.y/canvas.height)*H)|0;
    const dx=mouse.x-mouse.px, dy=mouse.y-mouse.py;
    if(gx>0&&gx<W-1&&gy>0&&gy<H-1){
      d[idx(gx,gy)] += 80;
      u[idx(gx,gy)] += dx*0.4;
      v[idx(gx,gy)] += dy*0.4;
    }
  }
  // agent injections
  for(const a of agents){
    const gx=((a.x/canvas.width)*W)|0, gy=((a.y/canvas.height)*H)|0;
    if(gx>1&&gx<W-2&&gy>1&&gy<H-2){
      const localU=u[idx(gx,gy)], localV=v[idx(gx,gy)];
      const mag=Math.hypot(localU,localV);
      const dye=d[idx(gx,gy)];
      const pdist=Math.hypot(a.x-mouse.x,a.y-mouse.y)/Math.max(canvas.width,canvas.height);
      const [fx,fy]=mlpForward(a.w, [mag, dye*0.01, pdist, 1]);
      u[idx(gx,gy)] += fx*2;
      v[idx(gx,gy)] += fy*2;
      d[idx(gx,gy)] += 8;
    }
  }
  // diffuse + project + advect
  const tmp=u0; u0=u; u=tmp; // swap
  diffuse(1,u,u0,visc,0.1);
  const tmp2=v0; v0=v; v=tmp2;
  diffuse(2,v,v0,visc,0.1);
  project(u,v,u0,v0);
  const tu=u0; u0=u; u=tu;
  const tv=v0; v0=v; v=tv;
  advect(1,u,u0,u0,v0,0.1);
  advect(2,v,v0,u0,v0,0.1);
  project(u,v,u0,v0);
  const td=d0; d0=d; d=td;
  diffuse(0,d,d0,0.0001,0.1);
  advect(0,d,d0,u,v,0.1);
  // advect agents
  for(const a of agents){
    const gx=a.x/canvas.width*W, gy=a.y/canvas.height*H;
    const i0=Math.max(0,Math.min(W-2,gx|0)), j0=Math.max(0,Math.min(H-2,gy|0));
    const s=gx-i0, t=gy-j0;
    const uu=u[idx(i0,j0)]*(1-s)*(1-t)+u[idx(i0+1,j0)]*s*(1-t)+u[idx(i0,j0+1)]*(1-s)*t+u[idx(i0+1,j0+1)]*s*t;
    const vv=v[idx(i0,j0)]*(1-s)*(1-t)+v[idx(i0+1,j0)]*s*(1-t)+v[idx(i0,j0+1)]*(1-s)*t+v[idx(i0+1,j0+1)]*s*t;
    a.x += uu*scale*0.8;
    a.y += vv*scale*0.8;
    a.x=(a.x+canvas.width)%canvas.width; a.y=(a.y+canvas.height)%canvas.height;
    a.el.style.left=(a.x-36)+'px';
    a.el.style.top=(a.y-24)+'px';
    a.el.style.transform=`scale(${1+0.3*Math.min(1,Math.hypot(uu,vv))})`;
  }
  // metrics
  let sumU=0, sumD=0, sumD2=0;
  for(let i=0;i<u.length;i++){ sumU+=u[i]*u[i]+v[i]*v[i]; sumD+=d[i]; sumD2+=d[i]*d[i]; }
  ke=sumU/u.length;
  const meanD=sumD/d.length, varD=sumD2/d.length - meanD*meanD;
  entropy=Math.log(1+varD);
  document.documentElement.style.setProperty('--ke', Math.min(1,ke*20));
  document.documentElement.style.setProperty('--hue', (200+entropy*40)%360);
  document.body.style.filter=`hue-rotate(${entropy*30}deg)`;
  mouse.px=mouse.x; mouse.py=mouse.y;
}
function mlpForward(w, x){
  // 4→6→2
  const h=new Array(6);
  for(let i=0;i<6;i++){
    let s=w[i*5+4]; // bias
    for(let j=0;j<4;j++) s+=w[i*5+j]*x[j];
    h[i]=Math.max(0,s);
  }
  const o=[0,0];
  const base=30;
  for(let k=0;k<2;k++){
    let s=w[base+k*7+6];
    for(let i=0;i<6;i++) s+=w[base+k*7+i]*h[i];
    o[k]=Math.tanh(s);
  }
  return o;
}
function randomW(){
  const w=new Float32Array(44);
  for(let i=0;i<w.length;i++) w[i]=(Math.random()-0.5)*0.4;
  return w;
}
function addAgent(x,y,w){
  const el=document.createElement('div');
  el.className='agent';
  el.textContent='agent';
  agentsDiv.appendChild(el);
  const a={x:x||Math.random()*canvas.width, y:y||Math.random()*canvas.height, w:w||randomW(), el};
  agents.push(a);
  el.onpointerdown=e=>{ e.stopPropagation(); el.setPointerCapture(e.pointerId); a.drag=true; };
  el.onpointerup=()=>a.drag=false;
  el.onpointermove=e=>{ if(a.drag){ a.x=e.clientX; a.y=e.clientY; } };
  return a;
}
function draw(){
  const img=ctx.createImageData(W,H);
  let maxD=1e-6;
  for(let i=0;i<d.length;i++) maxD=Math.max(maxD,d[i]);
  for(let i=0;i<d.length;i++){
    const t=Math.min(1,d[i]/maxD);
    const p=i*4;
    img.data[p]=t*80+ke*40; img.data[p+1]=t*180; img.data[p+2]=220-t*100; img.data[p+3]=255;
  }
  // scale blit
  const tmp=document.createElement('canvas'); tmp.width=W; tmp.height=H;
  tmp.getContext('2d').putImageData(img,0,0);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(tmp,0,0,canvas.width,canvas.height);
}
let last=0;
function loop(t){
  if(t-last>16){ step(); draw(); last=t; document.getElementById('status').textContent=`KE ${(ke*100).toFixed(1)}  agents ${agents.length}`; }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

canvas.onpointerdown=e=>{ mouse.down=true; mouse.x=e.clientX; mouse.y=e.clientY; mouse.px=mouse.x; mouse.py=mouse.y; };
canvas.onpointerup=()=>mouse.down=false;
canvas.onpointermove=e=>{ mouse.x=e.clientX; mouse.y=e.clientY; };
document.getElementById('add').onclick=()=>addAgent();
document.getElementById('visc').oninput=e=>visc=+e.target.value;
document.getElementById('clear').onclick=()=>{ u.fill(0); v.fill(0); d.fill(0); };
async function sha(obj){
  const s=JSON.stringify(obj);
  const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
}
document.getElementById('seal').onclick=async ()=>{
  const weights=agents.map(a=>Array.from(a.w));
  const hash=await sha({weights, ke:ke.toFixed(4)});
  const db=await idb();
  const tx=db.transaction('seals','readwrite');
  tx.objectStore('seals').put({id:'latest', weights, hash, t:Date.now()});
  document.getElementById('status').textContent='sealed '+hash;
};
document.getElementById('restore').onclick=async ()=>{
  const db=await idb();
  const req=db.transaction('seals').objectStore('seals').get('latest');
  req.onsuccess=()=>{
    if(req.result){
      agents.forEach(a=>a.el.remove());
      agents=[];
      req.result.weights.forEach(w=>addAgent(undefined,undefined,new Float32Array(w)));
      document.getElementById('status').textContent='restored '+req.result.hash;
    }
  };
};
function idb(){
  return new Promise(res=>{
    const r=indexedDB.open('f504',1);
    r.onupgradeneeded=e=>e.target.result.createObjectStore('seals',{keyPath:'id'});
    r.onsuccess=()=>res(r.result);
  });
}
// seed
for(let i=0;i<4;i++) addAgent();
