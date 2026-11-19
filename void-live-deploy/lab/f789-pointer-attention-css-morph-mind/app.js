const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const status = document.getElementById('status');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

const SEQ = 16, DIM = 8, HEADS = 4, PORTALS = 6;
let buffer = Array(SEQ).fill(null).map(() => new Float32Array(DIM));
let pos = 0;
let Wq = Array(HEADS).fill(0).map(() => randMat(DIM, DIM));
let Wk = Array(HEADS).fill(0).map(() => randMat(DIM, DIM));
let Wv = Array(HEADS).fill(0).map(() => randMat(DIM, DIM));
let Wo = randMat(HEADS*DIM, DIM);
function randMat(r,c){ const m=Array(r); for(let i=0;i<r;i++){ m[i]=new Float32Array(c); for(let j=0;j<c;j++) m[i][j]=(Math.random()-.5)*.2; } return m; }
function matVec(m,v){ const o=new Float32Array(m.length); for(let i=0;i<m.length;i++){ let s=0; for(let j=0;j<v.length;j++) s+=m[i][j]*v[j]; o[i]=s; } return o; }
function softmax(a){ const m=Math.max(...a); const e=a.map(x=>Math.exp(x-m)); const s=e.reduce((p,c)=>p+c,0); return e.map(x=>x/s); }

const portals = [];
for(let i=0;i<PORTALS;i++){
  const d=document.createElement('div');
  d.className='portal';
  d.textContent=`portal ${i}`;
  d.style.left = (20+i*15)+'%';
  d.style.top = (30+ (i%3)*20)+'%';
  d.onclick = ()=> reward(i);
  stage.appendChild(d);
  portals.push(d);
}

let lastX=0, lastY=0, lastT=performance.now();
let residual=0;
addEventListener('pointermove', e=>{
  const t=performance.now();
  const dt=Math.max(1,t-lastT);
  const vx=(e.clientX-lastX)/dt*1000;
  const vy=(e.clientY-lastY)/dt*1000;
  const feat=new Float32Array([e.clientX/innerWidth, e.clientY/innerHeight, Math.tanh(vx/500), Math.tanh(vy/500), e.buttons, (t%10000)/10000, Math.sin(t/300), Math.cos(t/400)]);
  buffer[pos]=feat;
  pos=(pos+1)%SEQ;
  lastX=e.clientX; lastY=e.clientY; lastT=t;
  step();
});

function step(){
  // simple multi-head attention over buffer
  const seq=buffer;
  let outs=[];
  for(let h=0;h<HEADS;h++){
    const qs=seq.map(x=>matVec(Wq[h],x));
    const ks=seq.map(x=>matVec(Wk[h],x));
    const vs=seq.map(x=>matVec(Wv[h],x));
    const scores=qs.map(q=>ks.map(k=>dot(q,k)/Math.sqrt(DIM)));
    const att=scores.map(s=>softmax(s));
    const headOut=att.map((a,i)=>a.reduce((p,w,j)=>add(p, scale(vs[j],w)), new Float32Array(DIM)));
    outs.push(headOut[pos]); // use current
  }
  const concat=concatArr(outs);
  const final=matVec(Wo, concat);
  residual = Math.hypot(final[0], final[1]);
  // morph portals
  portals.forEach((p,i)=>{
    const a=final[(i*2)%DIM];
    const b=final[(i*2+1)%DIM];
    const sc=1 + residual*0.4 + Math.sin(Date.now()/400+i)*0.1;
    p.style.transform=`translate(${a*80}px,${b*60}px) scale(${sc}) rotate(${a*30}deg)`;
    const hue=(residual*180 + i*40)%360;
    p.style.background=`hsl(${hue},60%,20%)`;
    p.style.borderColor=`hsl(${hue},80%,60%)`;
    p.textContent=`portal ${i}\nres ${residual.toFixed(2)}`;
  });
  // draw attention heatmap simple
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='rgba(80,200,255,0.15)';
  for(let i=0;i<SEQ;i++){
    const f=buffer[(pos-i+SEQ)%SEQ];
    if(!f) continue;
    ctx.beginPath();
    ctx.arc(f[0]*canvas.width, f[1]*canvas.height, 8+residual*10, 0, Math.PI*2);
    ctx.fill();
  }
  status.textContent=`residual ${residual.toFixed(2)} · seq ${pos}`;
}
function dot(a,b){ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; }
function scale(v,s){ return v.map(x=>x*s); }
function add(a,b){ return a.map((x,i)=>x+b[i]); }
function concatArr(arrs){ const o=[]; arrs.forEach(a=>o.push(...a)); return new Float32Array(o); }

function reward(i){
  // simple reinforce: nudge Wo a bit toward current
  const scale=0.01;
  for(let r=0;r<Wo.length;r++) for(let c=0;c<Wo[0].length;c++) Wo[r][c]+= (Math.random()-.5)*scale;
  status.textContent='rewarded portal '+i;
}

document.getElementById('seal').onclick=async ()=>{
  const data={Wq,Wk,Wv,Wo, ts:Date.now()};
  const db=await idb();
  const tx=db.transaction('seal','readwrite');
  tx.objectStore('seal').put(data,'params');
  await tx.complete;
  status.textContent='sealed';
};
function idb(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open('f789-attention',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('seal');
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error);
  });
}
// load if present
idb().then(db=>{
  const tx=db.transaction('seal','readonly');
  const g=tx.objectStore('seal').get('params');
  g.onsuccess=()=>{ if(g.result){ Object.assign({Wq,Wk,Wv,Wo}, g.result); status.textContent='loaded seal'; } };
}).catch(()=>{});
