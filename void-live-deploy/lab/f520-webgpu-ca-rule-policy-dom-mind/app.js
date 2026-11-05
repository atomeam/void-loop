const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const GW = 48, GH = 32;
let grid = new Uint8Array(GW * GH);
let next = new Uint8Array(GW * GH);
// Simple parameterized rules: birth/survival for 4 states simplified to Life-like + mutation
let birth = [3], survive = [2,3];
let policyW = Array.from({length:18}, () => Math.random()*0.2-0.1); // tiny weights

function idx(x,y){ return ((y+GH)%GH)*GW + ((x+GW)%GW); }

function stepCA(){
  for(let y=0;y<GH;y++) for(let x=0;x<GW;x++){
    let n=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(dx||dy) n += grid[idx(x+dx,y+dy)]>0 ?1:0;
    const s = grid[idx(x,y)]>0;
    let live = false;
    if(s) live = survive.includes(n);
    else live = birth.includes(n);
    next[idx(x,y)] = live ? 1 : 0;
  }
  [grid, next] = [next, grid];
}

function mutateRules(){
  // simple policy-like: based on entropy-ish
  let act=0; for(let v of grid) if(v) act++;
  const dens = act/(GW*GH);
  const mut = dens > 0.4 ? 1 : dens < 0.1 ? -1 : 0;
  if(Math.random()<0.1){
    if(mut>0 && birth.length<4) birth.push(Math.floor(Math.random()*5)+1);
    if(mut<0 && birth.length>1) birth.pop();
    if(Math.random()<0.3) survive = [2,3].filter(()=>Math.random()>0.2);
  }
}

function draw(){
  ctx.fillStyle='#0a0a12';
  ctx.fillRect(0,0,W,H);
  const cw = W/GW, ch = H/GH;
  for(let y=0;y<GH;y++) for(let x=0;x<GW;x++){
    if(grid[idx(x,y)]){
      ctx.fillStyle=`hsl(${ (x*7+y*5)%360 },70%,50%)`;
      ctx.fillRect(x*cw, y*ch, cw-1, ch-1);
    }
  }
}

const portals = [];
for(let i=0;i<6;i++){
  const d = document.createElement('div');
  d.className='portal';
  d.textContent=`Portal ${i+1}`;
  d.style.left = (20+i*12)+'%';
  d.style.top = (30+ (i%3)*15)+'%';
  document.body.appendChild(d);
  portals.push({el:d, x:parseFloat(d.style.left), y:parseFloat(d.style.top)});
  d.addEventListener('pointerdown', e=>{
    e.preventDefault();
    const startX=e.clientX, startY=e.clientY;
    const sx=parseFloat(d.style.left), sy=parseFloat(d.style.top);
    const move=ev=>{
      d.style.left = (sx + (ev.clientX-startX)/W*100)+'%';
      d.style.top = (sy + (ev.clientY-startY)/H*100)+'%';
      // inject
      const gx = Math.floor(parseFloat(d.style.left)/100 * GW);
      const gy = Math.floor(parseFloat(d.style.top)/100 * GH);
      grid[idx(gx,gy)] = 1;
    };
    const up=()=>{ removeEventListener('pointermove',move); removeEventListener('pointerup',up); };
    addEventListener('pointermove',move); addEventListener('pointerup',up);
  });
}

function updatePortals(){
  portals.forEach(p=>{
    const gx = Math.floor(parseFloat(p.el.style.left)/100 * GW);
    const gy = Math.floor(parseFloat(p.el.style.top)/100 * GH);
    let act=0, cnt=0;
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){ act += grid[idx(gx+dx,gy+dy)]; cnt++; }
    const dens = act/cnt;
    p.el.style.transform = `scale(${0.8+dens*0.6}) rotate(${dens*10-5}deg)`;
    p.el.style.background = `hsla(${dens*120},60%,30%,.85)`;
    // slight advection
    if(Math.random()<0.05){
      p.el.style.left = Math.max(5, Math.min(90, parseFloat(p.el.style.left) + (Math.random()-0.5)*2 ))+'%';
    }
  });
}

canvas.addEventListener('pointerdown', e=>{
  const gx = Math.floor(e.clientX/W * GW);
  const gy = Math.floor(e.clientY/H * GH);
  for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) grid[idx(gx+dx,gy+dy)]=1;
});

document.getElementById('seal').onclick = async ()=>{
  const data = {birth, survive, dens: [...grid].reduce((a,b)=>a+b,0)/(GW*GH)};
  const idb = indexedDB.open('verse-f520',1);
  idb.onupgradeneeded = e => e.target.result.createObjectStore('seal');
  idb.onsuccess = e => {
    const tx = e.target.result.transaction('seal','readwrite');
    tx.objectStore('seal').put(data, 'genome');
    document.getElementById('status').textContent = 'Sealed to IndexedDB';
  };
};
document.getElementById('restore').onclick = ()=>{
  const idb = indexedDB.open('verse-f520',1);
  idb.onsuccess = e => {
    const tx = e.target.result.transaction('seal');
    const req = tx.objectStore('seal').get('genome');
    req.onsuccess = ()=>{ if(req.result){ birth=req.result.birth; survive=req.result.survive; document.getElementById('status').textContent='Restored'; } };
  };
};
document.getElementById('mutate').onclick = mutateRules;

let frame=0;
function loop(){
  if(frame++ % 2 ===0) stepCA();
  if(frame % 30 ===0) mutateRules();
  draw();
  updatePortals();
  requestAnimationFrame(loop);
}
// seed
for(let i=0;i<200;i++) grid[Math.floor(Math.random()*GW*GH)]=1;
loop();
