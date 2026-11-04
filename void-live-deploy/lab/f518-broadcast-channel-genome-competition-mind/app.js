const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
let W=innerWidth, H=innerHeight;
cv.width=W; cv.height=H;
addEventListener('resize',()=>{W=innerWidth;H=innerHeight;cv.width=W;cv.height=H;});

const agents=[], els=[];
const particles=[];
function init(){
  agents.length=0; els.length=0; particles.length=0;
  document.getElementById('agents').innerHTML='';
  for(let i=0;i<4;i++){
    const el=document.createElement('div');
    el.className='agent';
    el.textContent='Agent '+i;
    el.onclick=()=>broadcast(i);
    document.getElementById('agents').appendChild(el);
    els.push(el);
    const w=Array(4*6+6*2).fill(0).map(()=>Math.random()*0.3-0.15);
    agents.push({id:i, x:W*0.25+i*W*0.15, y:H*0.5, vx:0, vy:0, fitness:0, weights:w, color:120+i*40});
    for(let j=0;j<20;j++) particles.push({ax:i, x:agents[i].x+(Math.random()-0.5)*40, y:agents[i].y+(Math.random()-0.5)*30, vx:0, vy:0});
  }
}
init();

function mlp(w, inp){
  const hid=6;
  let h=new Array(hid).fill(0);
  for(let i=0;i<hid;i++){
    let s=0; for(let j=0;j<4;j++) s+=inp[j]*w[i*4+j];
    h[i]=Math.tanh(s);
  }
  const o=[0,0];
  const base=4*6;
  for(let i=0;i<2;i++){
    let s=0; for(let j=0;j<hid;j++) s+=h[j]*w[base+i*hid+j];
    o[i]=Math.tanh(s);
  }
  return o;
}

let drive={x:0,y:0};
if(window.DeviceOrientationEvent){
  window.addEventListener('deviceorientation', e=>{
    if(e.gamma!=null){ drive.x=(e.gamma||0)/40; drive.y=(e.beta||0)/40; }
  });
}
cv.addEventListener('pointermove', e=>{
  drive.x=(e.clientX-W/2)/W*2; drive.y=(e.clientY-H/2)/H*2;
});

const bc=new BroadcastChannel('verse-f518-genomes');
bc.onmessage=e=>{
  const msg=e.data;
  if(msg.type==='genome'){
    document.getElementById('ch').textContent='rx '+msg.from;
    // adopt to weakest
    let weak=0; for(let i=1;i<agents.length;i++) if(agents[i].fitness<agents[weak].fitness) weak=i;
    if(msg.fitness>agents[weak].fitness){
      agents[weak].weights=msg.weights.map(w=>w+(Math.random()-0.5)*0.04);
      agents[weak].fitness=msg.fitness*0.8;
      els[weak].style.outline='3px solid #4f4';
      setTimeout(()=>els[weak].style.outline='',800);
    }
  }
};

function broadcast(idx){
  const a=agents[idx];
  bc.postMessage({type:'genome', from:a.id, fitness:a.fitness, weights:a.weights});
  document.getElementById('ch').textContent='tx '+idx;
}

document.getElementById('seal').onclick=seal;
document.getElementById('rest').onclick=restore;
document.getElementById('bcast').onclick=()=>{ let best=0; agents.forEach((a,i)=>{if(a.fitness>agents[best].fitness)best=i;}); broadcast(best); };
addEventListener('keydown', e=>{ if(e.key==='s'||e.key==='S')seal(); if(e.key==='r'||e.key==='R')restore(); });

function update(){
  let totalE=0;
  agents.forEach((a,i)=>{
    const inp=[drive.x, drive.y, a.vx, a.vy];
    const out=mlp(a.weights, inp);
    a.vx += out[0]*0.6; a.vy += out[1]*0.6;
    a.vx *=0.92; a.vy *=0.92;
    a.x += a.vx; a.y += a.vy;
    a.x=Math.max(50,Math.min(W-50,a.x)); a.y=Math.max(30,Math.min(H-30,a.y));
    // particles follow
    let cx=0,cy=0,ke=0,cnt=0;
    particles.forEach(p=>{
      if(p.ax!==i) return;
      p.vx += (a.x-p.x)*0.05 + out[0]*0.3;
      p.vy += (a.y-p.y)*0.05 + out[1]*0.3;
      p.vx *=0.9; p.vy *=0.9;
      p.x += p.vx; p.y += p.vy;
      cx+=p.x; cy+=p.y; ke+=Math.hypot(p.vx,p.vy); cnt++;
    });
    if(cnt){ a.x=cx/cnt*0.2 + a.x*0.8; a.y=cy/cnt*0.2 + a.y*0.8; }
    a.fitness = a.fitness*0.97 + ke*0.03;
    totalE += ke;
    const el=els[i];
    el.style.left=(a.x-50)+'px'; el.style.top=(a.y-30)+'px';
    el.style.background=`hsla(${a.color},70%,${35+a.fitness*5}%,0.8)`;
    el.style.transform=`scale(${1+a.fitness*0.02})`;
    el.textContent=`Agent ${i}\nF:${a.fitness.toFixed(2)}`;
  });
  document.getElementById('en').textContent=totalE.toFixed(1);
  document.documentElement.style.setProperty('--energy', Math.min(1,totalE/10));
}

function seal(){
  const data={agents:agents.map(a=>({x:a.x,y:a.y,weights:a.weights,fitness:a.fitness})), ts:Date.now()};
  const req=indexedDB.open('verse-f518',1);
  req.onupgradeneeded=e=>e.target.result.createObjectStore('seal');
  req.onsuccess=e=>{
    e.target.result.transaction('seal','readwrite').objectStore('seal').put(data,'latest');
    document.getElementById('hud').style.outline='2px solid #4f4';
    setTimeout(()=>document.getElementById('hud').style.outline='',500);
  };
}
function restore(){
  const req=indexedDB.open('verse-f518',1);
  req.onsuccess=e=>{
    const g=e.target.result.transaction('seal','readonly').objectStore('seal').get('latest');
    g.onsuccess=()=>{
      if(!g.result) return;
      g.result.agents.forEach((d,i)=>{ if(agents[i]){ agents[i].x=d.x; agents[i].y=d.y; agents[i].weights=d.weights; agents[i].fitness=d.fitness; } });
      document.getElementById('hud').style.outline='2px solid #48f';
      setTimeout(()=>document.getElementById('hud').style.outline='',500);
    };
  };
}

function loop(){
  update();
  ctx.fillStyle='rgba(12,12,20,0.3)'; ctx.fillRect(0,0,W,H);
  particles.forEach(p=>{
    ctx.fillStyle=`hsla(${agents[p.ax].color},80%,60%,0.7)`;
    ctx.beginPath(); ctx.arc(p.x,p.y,2.2,0,6.28); ctx.fill();
  });
  requestAnimationFrame(loop);
}
loop();
