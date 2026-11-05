const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W=64, H=64, c2=0.45, damping=0.02;
let u=[], v=[], prev=[], pins=new Set();
let cards=[], nextId=1, mouse={x:0,y:0,down:false,dx:0,dy:0};
let genome={dampBias:0, localScale:1, rnn:[0.1,0.05,0.02,0.01]}; // simple
let db;

function resize() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', resize); resize();

function idx(x,y){ return y*W + x; }
function initField() {
  u = new Float32Array(W*H);
  v = new Float32Array(W*H);
  prev = new Float32Array(W*H);
  pins.clear();
  cards.forEach(c=>c.el.remove()); cards=[];
}

function laplacian(arr,x,y) {
  const i=idx(x,y);
  let s = -4*arr[i];
  if(x>0) s+=arr[i-1];
  if(x<W-1) s+=arr[i+1];
  if(y>0) s+=arr[i-W];
  if(y<H-1) s+=arr[i+W];
  return s;
}

function step() {
  const next = new Float32Array(W*H);
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++) {
    const i=idx(x,y);
    if(pins.has(i)) { next[i]=0; continue; }
    const lap = laplacian(u,x,y);
    const accel = c2 * lap - damping * v[i];
    next[i] = 2*u[i] - prev[i] + accel;
    // soft clamp
    next[i] = Math.max(-2, Math.min(2, next[i]));
  }
  prev.set(u); u.set(next);
  // velocity approx
  for(let i=0;i<u.length;i++) v[i] = u[i]-prev[i];
}

function strike(gx,gy, amp=0.8) {
  const x=Math.floor(gx), y=Math.floor(gy);
  if(x<1||x>=W-1||y<1||y>=H-1) return;
  u[idx(x,y)] += amp;
  v[idx(x,y)] += amp*0.5;
}

function spawnOrUpdateCard(x,y,amp) {
  let card = cards.find(c=>!c.pinned && Math.hypot(c.gx-x,c.gy-y)<3);
  if(!card && cards.filter(c=>!c.pinned).length<8) {
    const el = document.createElement('div');
    el.className='card';
    el.textContent='~';
    el.dataset.id = nextId++;
    document.getElementById('stage').appendChild(el);
    card = {el, gx:x, gy:y, pinned:false, id:el.dataset.id};
    cards.push(card);
    makeDraggable(card);
  }
  if(card && !card.pinned) {
    card.gx=x; card.gy=y;
    const px = (x/W)*canvas.width, py=(y/H)*canvas.height;
    card.el.style.left = (px-36)+'px';
    card.el.style.top = (py-20)+'px';
    const s = 0.8 + Math.min(1.2, amp*0.6);
    card.el.style.transform = `scale(${s})`;
    card.el.style.background = `hsl(${(amp*120+200)%360},60%,28%)`;
    card.el.textContent = amp>0.4 ? '◎' : '~';
  }
}

function makeDraggable(card) {
  let ox,oy,sx,sy;
  card.el.addEventListener('pointerdown', e=>{
    e.preventDefault(); e.stopPropagation();
    ox=e.clientX; oy=e.clientY; sx=parseFloat(card.el.style.left)||0; sy=parseFloat(card.el.style.top)||0;
    card.el.setPointerCapture(e.pointerId);
  });
  card.el.addEventListener('pointermove', e=>{
    if(!card.el.hasPointerCapture(e.pointerId)) return;
    card.el.style.left = (sx + e.clientX-ox)+'px';
    card.el.style.top = (sy + e.clientY-oy)+'px';
  });
  card.el.addEventListener('pointerup', e=>{
    card.el.releasePointerCapture(e.pointerId);
    // place pin
    const rect = canvas.getBoundingClientRect();
    const gx = ((parseFloat(card.el.style.left)+36)/canvas.width)*W;
    const gy = ((parseFloat(card.el.style.top)+20)/canvas.height)*H;
    const ix=Math.floor(gx), iy=Math.floor(gy);
    if(ix>=1&&ix<W-1&&iy>=1&&iy<H-1) {
      pins.add(idx(ix,iy));
      card.pinned=true;
      card.el.classList.add('pinned');
      card.el.textContent='📌';
      status.textContent = `Pinned at ${ix},${iy} · pins:${pins.size}`;
    }
  });
}

function draw() {
  const img = ctx.createImageData(canvas.width, canvas.height);
  const data=img.data;
  const sx=canvas.width/W, sy=canvas.height/H;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    const amp = Math.abs(u[idx(x,y)]);
    const g = Math.min(255, amp*180);
    const b = Math.min(255, 40+amp*100);
    const r = pins.has(idx(x,y)) ? 255 : g*0.3;
    for(let py=0;py<sy;py++) for(let px=0;px<sx;px++) {
      const i=((y*sy+py)*canvas.width + (x*sx+px))*4;
      data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
}

function findMaxima() {
  let best=[];
  for(let y=2;y<H-2;y+=2) for(let x=2;x<W-2;x+=2) {
    const a=Math.abs(u[idx(x,y)]);
    if(a>0.25) best.push({x,y,a});
  }
  best.sort((p,q)=>q.a-p.a);
  return best.slice(0,4);
}

// simple local "RNN"/genome update
function updateGenome() {
  const meanE = v.reduce((s,x)=>s+Math.abs(x),0)/v.length;
  const residual = Math.hypot(mouse.dx, mouse.dy);
  genome.dampBias = Math.max(0, Math.min(0.08, genome.dampBias + (residual*0.001 - meanE*0.002)));
  damping = 0.015 + genome.dampBias;
}

// IndexedDB
const req = indexedDB.open('verse-f518',1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
req.onsuccess = e => { db=e.target.result; };

function seal() {
  if(!db) { status.textContent='IndexedDB unavailable'; return; }
  const tx=db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({genome, pins:[...pins], t:Date.now()}, 'best');
  status.textContent='Sealed genome + pins';
}
function restore() {
  if(!db) return;
  const tx=db.transaction('genomes','readonly');
  const g=tx.objectStore('genomes').get('best');
  g.onsuccess=()=>{
    if(g.result) {
      Object.assign(genome, g.result.genome);
      pins = new Set(g.result.pins||[]);
      status.textContent='Restored';
    }
  };
}

document.getElementById('strike').onclick=()=>strike(W/2,H/2,1.2);
document.getElementById('seal').onclick=seal;
document.getElementById('restore').onclick=restore;
document.getElementById('clear').onclick=()=>{pins.clear(); cards.forEach(c=>{if(c.pinned){c.pinned=false;c.el.classList.remove('pinned');}}); status.textContent='Pins cleared';};
document.getElementById('c2').oninput=e=>c2=parseFloat(e.target.value);

canvas.addEventListener('pointerdown', e=>{
  const r=canvas.getBoundingClientRect();
  const gx=((e.clientX-r.left)/r.width)*W;
  const gy=((e.clientY-r.top)/r.height)*H;
  strike(gx,gy,1.0);
  mouse.down=true; mouse.x=e.clientX; mouse.y=e.clientY;
});
canvas.addEventListener('pointermove', e=>{
  mouse.dx=e.clientX-mouse.x; mouse.dy=e.clientY-mouse.y;
  mouse.x=e.clientX; mouse.y=e.clientY;
  if(mouse.down) {
    const r=canvas.getBoundingClientRect();
    strike(((e.clientX-r.left)/r.width)*W, ((e.clientY-r.top)/r.height)*H, 0.4);
  }
});
canvas.addEventListener('pointerup', ()=>mouse.down=false);

initField();
function loop() {
  updateGenome();
  step(); step(); // two substeps
  const maxs = findMaxima();
  maxs.forEach(m=>spawnOrUpdateCard(m.x,m.y,m.a));
  draw();
  requestAnimationFrame(loop);
}
loop();
status.textContent = 'Membrane ready · strike & place pins';
