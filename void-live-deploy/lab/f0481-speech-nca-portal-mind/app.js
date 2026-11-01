const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const seedInput = document.getElementById('seedInput');
let W=128, H=128, scale=6;
function resize(){ canvas.width = W*scale; canvas.height = H*scale; }
resize(); window.onresize = resize;

let grid = new Float32Array(W*H);
let portals = []; // {x,y, seed:[], rules:[], age, id}
let captures = []; // {frag, hash, x,y}
let entropy = 0.3;

function hashStr(s){
  let h=0; for(let i=0;i<s.length;i++) h = Math.imul(31,h) + s.charCodeAt(i) |0;
  return Math.abs(h);
}
function seedFromText(t){
  const h = hashStr(t || 'void');
  const s = [];
  for(let i=0;i<8;i++) s.push( ((h >> (i*4)) & 15)/15 );
  return s;
}

function nucleate(text){
  const seed = seedFromText(text);
  const x = 20 + Math.random()*(W-40);
  const y = 20 + Math.random()*(H-40);
  portals.push({x,y,seed, rules:seed.slice(0,4), age:0, id:Date.now()});
  // inject
  const ix = Math.floor(x), iy=Math.floor(y);
  for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
    const i = (iy+dy)*W + (ix+dx);
    if(i>=0 && i<grid.length) grid[i] = 0.8 + Math.random()*0.2;
  }
  status.textContent = `Portal nucleated: "${text.slice(0,20)}"`;
  updateCSS();
}

function stepNCA(){
  const next = new Float32Array(grid.length);
  let sum=0;
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++){
    const i = y*W+x;
    let n=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) n += grid[(y+dy)*W+(x+dx)];
    n /= 9;
    // find nearest portal for rule bias
    let best=0, bd=1e9;
    for(const p of portals){
      const d = (p.x-x)**2 + (p.y-y)**2;
      if(d<bd){ bd=d; best=p; }
    }
    const r = best ? best.rules : [0.5,0.5,0.5,0.5];
    const growth = n * r[0] + (1-n)*r[1];
    const decay = grid[i] * r[2];
    next[i] = Math.max(0, Math.min(1, growth - decay + (Math.random()-0.5)*r[3]*0.1 ));
    sum += next[i];
  }
  grid = next;
  entropy = sum / (W*H);
  portals.forEach(p => p.age++);
}

function draw(){
  const img = ctx.createImageData(W*scale, H*scale);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const v = grid[y*W+x];
    const c = Math.floor(v*255);
    for(let sy=0;sy<scale;sy++) for(let sx=0;sx<scale;sx++){
      const i = ((y*scale+sy)* (W*scale) + (x*scale+sx))*4;
      img.data[i]=c; img.data[i+1]=c*0.7; img.data[i+2]=255-c; img.data[i+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
  // draw portals
  portals.forEach(p => {
    ctx.strokeStyle = `hsl(${(p.id%360)},70%,60%)`;
    ctx.beginPath(); ctx.arc(p.x*scale, p.y*scale, 12+p.age*0.05, 0, Math.PI*2); ctx.stroke();
  });
}

function updateCSS(){
  document.documentElement.style.setProperty('--entropy', entropy.toFixed(2));
  document.documentElement.style.setProperty('--portals', portals.length);
  document.documentElement.style.setProperty('--hue', (200 + entropy*160)|0);
}

let mouseDown=false, captureStart=null;
canvas.onmousedown = e => { mouseDown=true; captureStart={x:e.offsetX/scale, y:e.offsetY/scale}; };
canvas.onmouseup = e => {
  if(!mouseDown) return; mouseDown=false;
  const ex = e.offsetX/scale, ey=e.offsetY/scale;
  if(captureStart && Math.hypot(ex-captureStart.x, ey-captureStart.y)>5){
    // capture fragment
    const frag = [];
    for(let dy=0;dy<16;dy++) for(let dx=0;dx<16;dx++){
      const gx=Math.floor(captureStart.x+dx)%W, gy=Math.floor(captureStart.y+dy)%H;
      frag.push(grid[gy*W+gx]);
    }
    const hash = frag.reduce((a,b)=>a+b,0).toFixed(3);
    captures.push({frag, hash, x:ex, y:ey});
    status.textContent = `Captured fragment ${hash}`;
  }
};
canvas.onclick = e => {
  const x=e.offsetX/scale, y=e.offsetY/scale;
  // transfer if near a capture and a portal
  for(const c of captures){
    if(Math.hypot(c.x-x, c.y-y)<8){
      for(const p of portals){
        if(Math.hypot(p.x-x, p.y-y)<20){
          // mutate rules with fragment avg
          const avg = c.frag.reduce((a,b)=>a+b,0)/c.frag.length;
          p.rules = p.rules.map(r => (r + avg)*0.5);
          status.textContent = `Transferred to portal ${p.id%1000}`;
          return;
        }
      }
    }
  }
};

function seal(){
  const state = {grid: Array.from(grid), portals, captures, entropy};
  const req = indexedDB.open('verse-f481',1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('state');
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('state','readwrite');
    tx.objectStore('state').put(state, 'main');
    status.textContent = 'Sealed to IndexedDB';
  };
}
function restore(){
  const req = indexedDB.open('verse-f481',1);
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('state');
    const g = tx.objectStore('state').get('main');
    g.onsuccess = ev => {
      if(ev.target.result){
        const s = ev.target.result;
        grid = new Float32Array(s.grid);
        portals = s.portals; captures = s.captures; entropy = s.entropy;
        status.textContent = 'Restored from seal';
        updateCSS();
      }
    };
  };
}
document.getElementById('sealBtn').onclick = seal;
document.getElementById('restoreBtn').onclick = restore;
document.addEventListener('keydown', e => { if(e.key==='s') seal(); if(e.key==='r') restore(); });

seedInput.onkeydown = e => { if(e.key==='Enter') nucleate(seedInput.value); };

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
if(SpeechRec){
  const rec = new SpeechRec();
  rec.continuous=false; rec.interimResults=false;
  document.getElementById('speakBtn').onclick = () => { rec.start(); status.textContent='Listening...'; };
  rec.onresult = e => { const t = e.results[0][0].transcript; seedInput.value=t; nucleate(t); };
  rec.onerror = () => status.textContent='Speech failed, type instead';
} else {
  document.getElementById('speakBtn').disabled=true;
}

// main loop
setInterval(() => { stepNCA(); draw(); updateCSS(); }, 100);
// initial
nucleate('verse');
