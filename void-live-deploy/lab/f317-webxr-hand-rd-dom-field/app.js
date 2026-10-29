const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W=64, H=64, scale=1;
let u = new Float32Array(W*H), v = new Float32Array(W*H);
let Du=0.16, Dv=0.08, feed=0.035, kill=0.060;
let cells = [];
let xrSession=null, hands=null;
let orient={beta:0,gamma:0};
const status=document.getElementById('status');

function resize(){
  canvas.width=innerWidth; canvas.height=innerHeight;
  scale=Math.min(canvas.width/W, canvas.height/H);
}
addEventListener('resize',resize); resize();

// Init seed
for(let i=0;i<W*H;i++){ u[i]=1; v[i]=0; }
function seed(x,y,r=3){
  const ix=Math.floor(x), iy=Math.floor(y);
  for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
    const px=(ix+dx+W)%W, py=(iy+dy+H)%H;
    if(dx*dx+dy*dy<r*r) v[py*W+px]=0.5;
  }
}
seed(W/2,H/2,4);

function step(){
  const nu=new Float32Array(u), nv=new Float32Array(v);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i=y*W+x;
    const lapu = u[((y+1)%H)*W+x] + u[((y-1+H)%H)*W+x] + u[y*W+(x+1)%W] + u[y*W+(x-1+W)%W] - 4*u[i];
    const lapv = v[((y+1)%H)*W+x] + v[((y-1+H)%H)*W+x] + v[y*W+(x+1)%W] + v[y*W+(x-1+W)%W] - 4*v[i];
    const uvv = u[i]*v[i]*v[i];
    nu[i] = u[i] + Du*lapu - uvv + feed*(1-u[i]);
    nv[i] = v[i] + Dv*lapv + uvv - (feed+kill)*v[i];
  }
  u=nu; v=nv;
}

function render(){
  const img=ctx.createImageData(W,H);
  for(let i=0;i<W*H;i++){
    const val=Math.min(1,v[i]*4);
    const r=Math.floor(val*255), g=Math.floor(val*100), b=Math.floor((1-val)*80);
    img.data[i*4]=r; img.data[i*4+1]=g; img.data[i*4+2]=b; img.data[i*4+3]=255;
  }
  ctx.putImageData(img,0,0);
  ctx.drawImage(canvas,0,0,W,H,0,0,canvas.width,canvas.height);
}

function updateCells(){
  let peaks=[];
  for(let y=2;y<H-2;y+=2) for(let x=2;x<W-2;x+=2){
    const i=y*W+x;
    if(v[i]>0.3) peaks.push({x,y,val:v[i]});
  }
  peaks.sort((a,b)=>b.val-a.val);
  while(cells.length<Math.min(8,peaks.length)){
    const p=peaks[cells.length];
    const el=document.createElement('div');
    el.className='cell';
    document.body.appendChild(el);
    cells.push({el, x:p.x, y:p.y, age:0});
  }
  cells.forEach((c,i)=>{
    if(peaks[i]){
      c.x += (peaks[i].x - c.x)*0.1;
      c.y += (peaks[i].y - c.y)*0.1;
      c.el.style.left=(c.x*scale)+'px';
      c.el.style.top=(c.y*scale)+'px';
      c.el.style.transform=`translate(-50%,-50%) scale(${1+peaks[i].val})`;
      if(peaks[i].val>0.6 && cells.length<8 && Math.random()<0.02){
        const el=document.createElement('div'); el.className='cell'; document.body.appendChild(el);
        cells.push({el, x:c.x+2, y:c.y, age:0});
      }
    }
  });
  while(cells.length>8){ cells.pop().el.remove(); }
}

function loop(){
  step(); step();
  render();
  updateCells();
  requestAnimationFrame(loop);
}
loop();

canvas.addEventListener('pointermove', e=>{
  const x=(e.clientX/canvas.width)*W, y=(e.clientY/canvas.height)*H;
  seed(x,y,2);
});
canvas.addEventListener('click', e=>{
  const x=(e.clientX/canvas.width)*W, y=(e.clientY/canvas.height)*H;
  seed(x,y,5);
});

if(DeviceOrientationEvent){
  window.addEventListener('deviceorientation', e=>{
    orient.beta=e.beta||0; orient.gamma=e.gamma||0;
  });
  if(typeof DeviceOrientationEvent.requestPermission==='function'){
    document.body.addEventListener('click', ()=>DeviceOrientationEvent.requestPermission().then(p=>{if(p==='granted')status.textContent+=' · orient';}), {once:true});
  }
}

document.getElementById('xr').onclick=async ()=>{
  if(!navigator.xr){ status.textContent='No WebXR'; return; }
  try{
    xrSession=await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['hand-tracking']});
    status.textContent='WebXR active';
    xrSession.addEventListener('end', ()=>{xrSession=null; status.textContent='WebXR ended';});
  }catch(e){ status.textContent='XR failed: '+e.message; }
};

let db;
const req=indexedDB.open('void-f317',1);
req.onupgradeneeded=e=>{e.target.result.createObjectStore('seals');};
req.onsuccess=e=>{db=e.target.result;};
async function sha(obj){
  const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(obj)));
  return Array.from(new Uint8Array(buf)).slice(0,4).map(b=>b.toString(16).padStart(2,'0')).join('');
}
document.getElementById('seal').onclick=async ()=>{
  const params={Du,Dv,feed,kill};
  const hash=await sha(params);
  if(db){
    const tx=db.transaction('seals','readwrite');
    tx.objectStore('seals').put({params,hash,ts:Date.now()}, 'last');
  }
  document.getElementById('share').value=JSON.stringify({hash,params});
  status.textContent='Sealed '+hash;
};
document.getElementById('load').onclick=()=>{
  if(!db) return;
  const tx=db.transaction('seals');
  const g=tx.objectStore('seals').get('last');
  g.onsuccess=()=>{ if(g.result){ Object.assign({Du,Dv,feed,kill}, g.result.params); status.textContent='Loaded '+g.result.hash; } };
};
document.getElementById('evolve').onclick=()=>{
  feed += (Math.random()-0.5)*0.005;
  kill += (Math.random()-0.5)*0.005;
  status.textContent='Mutated';
};
document.getElementById('inject').onclick=()=>{
  try{
    const j=JSON.parse(document.getElementById('share').value);
    if(j.params){ Du=j.params.Du; Dv=j.params.Dv; feed=j.params.feed; kill=j.params.kill; status.textContent='Injected '+j.hash; }
  }catch(e){ status.textContent='Inject failed'; }
};
