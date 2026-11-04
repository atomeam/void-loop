const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const portalsEl = document.getElementById('portals');
const status = document.getElementById('status');
let W=64, H=64, real=new Float32Array(W*H), imag=new Float32Array(W*H);
let agents=[], portals=[], mouse={x:0,y:0,vx:0,vy:0}, lastMouse={x:0,y:0};
function resize(){ cv.width=innerWidth; cv.height=innerHeight; }
addEventListener('resize',resize); resize();
function idx(x,y){ return ((y+H)%H)*W + ((x+W)%W); }
function inject(x,y,amp,ph){
  const i=idx(Math.floor(x*W),Math.floor(y*H));
  real[i]+=amp*Math.cos(ph); imag[i]+=amp*Math.sin(ph);
}
function stepField(){
  const nr=new Float32Array(real), ni=new Float32Array(imag);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    let r=0,im=0,c=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      const i=idx(x+dx,y+dy); r+=real[i]; im+=imag[i]; c++;
    }
    nr[idx(x,y)]=r/c*0.98; ni[idx(x,y)]=im/c*0.98;
  }
  real=nr; imag=ni;
  // pointer injection
  inject(mouse.x, mouse.y, 0.4, Math.atan2(mouse.vy,mouse.vx));
}
function mlp(w, inp){
  // 4->4->2 simple
  const h=new Array(4).fill(0);
  for(let i=0;i<4;i++) for(let j=0;j<4;j++) h[i]+=w[i*4+j]*inp[j];
  const o=[0,0];
  for(let i=0;i<2;i++) for(let j=0;j<4;j++) o[i]+=w[16+i*4+j]*Math.tanh(h[j]);
  return o;
}
function randW(){ return Array.from({length:24},()=>Math.random()*0.4-0.2); }
function spawnAgent(x,y){
  agents.push({x,y,vx:0,vy:0,w:randW(),fit:0,id:Math.random()});
}
function collapseAt(ax,ay,amp){
  const i=idx(Math.floor(ax*W),Math.floor(ay*H));
  const mag=Math.hypot(real[i],imag[i]);
  if(mag<0.15) return false;
  // zero local
  for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
    const j=idx(Math.floor(ax*W)+dx, Math.floor(ay*H)+dy);
    real[j]*=0.1; imag[j]*=0.1;
  }
  // spawn portal
  if(portals.length<10){
    const el=document.createElement('div');
    el.className='portal';
    el.style.left=(ax*innerWidth-40)+'px';
    el.style.top=(ay*innerHeight-30)+'px';
    el.style.background=`hsla(${Math.atan2(imag[i],real[i])*180/Math.PI+180},60%,40%,.7)`;
    el.style.transform=`scale(${1+mag*2})`;
    el.textContent=mag.toFixed(2);
    portalsEl.appendChild(el);
    portals.push({el,ax,ay,mag,phase:Math.atan2(imag[i],real[i])});
  }
  return true;
}
function stepAgents(){
  for(const a of agents){
    const i=idx(Math.floor(a.x*W),Math.floor(a.y*H));
    const mag=Math.hypot(real[i],imag[i]);
    const ph=Math.atan2(imag[i],real[i]);
    const out=mlp(a.w, [a.x-0.5,a.y-0.5,mag,ph/Math.PI]);
    a.vx += out[0]*0.01; a.vy += out[1]*0.01;
    a.x = Math.max(0,Math.min(1,a.x+a.vx)); a.y=Math.max(0,Math.min(1,a.y+a.vy));
    a.vx*=0.95; a.vy*=0.95;
    if(Math.random()<0.05 && collapseAt(a.x,a.y,mag)) a.fit += mag;
  }
  // simple transfer on proximity
  for(let i=0;i<agents.length;i++) for(let j=i+1;j<agents.length;j++){
    const d=Math.hypot(agents[i].x-agents[j].x, agents[i].y-agents[j].y);
    if(d<0.08 && Math.abs(agents[i].fit-agents[j].fit)>2){
      const strong=agents[i].fit>agents[j].fit?agents[i]:agents[j];
      const weak=agents[i].fit>agents[j].fit?agents[j]:agents[i];
      weak.w = strong.w.map(v=>v+(Math.random()-0.5)*0.05);
      weak.fit *= 0.5;
    }
  }
}
function draw(){
  const img=ctx.createImageData(cv.width,cv.height);
  const scaleX=cv.width/W, scaleY=cv.height/H;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i=idx(x,y), mag=Math.hypot(real[i],imag[i]);
    const ph=(Math.atan2(imag[i],real[i])+Math.PI)/(2*Math.PI);
    const px=Math.floor(x*scaleX), py=Math.floor(y*scaleY);
    for(let dy=0;dy<scaleY;dy++) for(let dx=0;dx<scaleX;dx++){
      const p=((py+dy)*cv.width + (px+dx))*4;
      img.data[p]=mag*200; img.data[p+1]=ph*180; img.data[p+2]=120; img.data[p+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
  // agents
  ctx.fillStyle='#0f0';
  for(const a of agents) ctx.fillRect(a.x*cv.width-3,a.y*cv.height-3,6,6);
}
function loop(){
  stepField(); stepAgents();
  // morph portals
  portals.forEach(p=>{
    p.el.style.transform=`scale(${1+p.mag*1.5}) rotate(${p.phase}rad)`;
    p.el.style.filter=`hue-rotate(${p.phase*30}deg)`;
  });
  draw();
  requestAnimationFrame(loop);
}
loop();
addEventListener('pointermove',e=>{
  mouse.x=e.clientX/innerWidth; mouse.y=e.clientY/innerHeight;
  mouse.vx=mouse.x-lastMouse.x; mouse.vy=mouse.y-lastMouse.y;
  lastMouse={...mouse};
});
document.getElementById('nuke').onclick=()=>spawnAgent(0.5,0.5);
document.getElementById('clear').onclick=()=>{
  agents=[]; portals.forEach(p=>p.el.remove()); portals=[]; real.fill(0); imag.fill(0); status.textContent='cleared';
};
// simple IndexedDB seal
const DB='f500';
async function seal(){
  const data={real:Array.from(real),imag:Array.from(imag),agents:agents.map(a=>({x:a.x,y:a.y,w:a.w,fit:a.fit}))};
  const db=await new Promise((res,rej)=>{const r=indexedDB.open(DB,1); r.onupgradeneeded=()=>r.result.createObjectStore('s'); r.onsuccess=()=>res(r.result);});
  const tx=db.transaction('s','readwrite'); tx.objectStore('s').put(data,'last');
  status.textContent='sealed';
}
async function restore(){
  const db=await new Promise((res,rej)=>{const r=indexedDB.open(DB,1); r.onsuccess=()=>res(r.result);});
  const tx=db.transaction('s'); const req=tx.objectStore('s').get('last');
  req.onsuccess=()=>{
    if(req.result){
      real=Float32Array.from(req.result.real); imag=Float32Array.from(req.result.imag);
      agents=req.result.agents.map(a=>({...a,vx:0,vy:0,id:Math.random()}));
      status.textContent='restored';
    }
  };
}
document.getElementById('seal').onclick=seal;
document.getElementById('restore').onclick=restore;
// seed one
spawnAgent(0.3,0.4); spawnAgent(0.7,0.6);
status.textContent='agents ready — move pointer to inject phase';
