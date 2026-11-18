const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width = innerWidth, H = cv.height = innerHeight;
const G = 48, cellN = 6;
let grid = new Uint8Array(G*G); // cell id 0..cellN-1
let volumes = new Float32Array(cellN);
const centers = Array.from({length:cellN}, ()=>({x:0,y:0,c:0}));
const colors = ['#222','#f44','#4f4','#44f','#ff4','#f4f','#4ff'];

// init random cells
for(let i=0;i<G*G;i++) grid[i] = (Math.random()*cellN)|0;

// MLP: 4->8->3
let w1 = Array.from({length:8}, ()=>Array.from({length:4}, ()=>Math.random()*0.4-0.2));
let b1 = Array(8).fill(0);
let w2 = Array.from({length:3}, ()=>Array.from({length:8}, ()=>Math.random()*0.4-0.2));
let b2 = Array(3).fill(0);

function mlp(inp) {
  const h = b1.map((b,i)=>Math.tanh(w1[i].reduce((s,w,j)=>s+w*inp[j], b)));
  return b2.map((b,i)=>w2[i].reduce((s,w,j)=>s+w*h[j], b));
}

let orient = [0,0,0,0]; // x,y,z,speed
window.addEventListener('deviceorientation', e=>{
  orient = [(e.gamma||0)/90, (e.beta||0)/90, (e.alpha||0)/180, Math.hypot(e.gamma||0, e.beta||0)/100];
});
let px=0,py=0;
addEventListener('pointermove', e=>{
  const dx=e.clientX-px, dy=e.clientY-py;
  orient = [dx/50, dy/50, 0, Math.hypot(dx,dy)/20];
  px=e.clientX; py=e.clientY;
});

const portals = [];
for(let i=0;i<3;i++){
  const p = document.createElement('div');
  p.className='portal'; p.textContent='cell';
  p.style.left=(100+i*120)+'px'; p.style.top='200px';
  document.body.appendChild(p);
  portals.push(p);
  p.onclick = ()=> reward();
}

function reward() {
  const inp = orient.slice();
  const out = mlp(inp);
  // simple Hebbian nudge
  for(let i=0;i<8;i++) for(let j=0;j<4;j++) w1[i][j] += 0.002 * inp[j] * Math.tanh(out[0]);
  document.getElementById('status').textContent='rewarded';
}

document.getElementById('seal').onclick = seal;

async function seal() {
  const data = {w1,b1,w2,b2,t:Date.now()};
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open('f788',1);
      r.onupgradeneeded = ()=> r.result.createObjectStore('g');
      r.onsuccess = ()=> res(r.result);
    });
    const tx = db.transaction('g','readwrite');
    tx.objectStore('g').put(data,'mlp');
    const bc = new BroadcastChannel('f788-genome');
    bc.postMessage(data);
    document.getElementById('status').textContent='sealed';
  } catch(e) { document.getElementById('status').textContent='seal fail'; }
}

// load
(async ()=>{
  try {
    const db = await new Promise(res=>{
      const r = indexedDB.open('f788',1);
      r.onupgradeneeded = ()=> r.result.createObjectStore('g');
      r.onsuccess = ()=> res(r.result);
    });
    const tx = db.transaction('g');
    const req = tx.objectStore('g').get('mlp');
    req.onsuccess = ()=>{ if(req.result){ Object.assign({w1,b1,w2,b2}, req.result); } };
  } catch (e) { console.debug("lab f788-webgpu-cellular-potts-orientation-mind:", e); }
  const bc = new BroadcastChannel('f788-genome');
  bc.onmessage = e=>{ Object.assign({w1,b1,w2,b2}, e.data); document.getElementById('status').textContent='adopted'; };
})();

function stepCPM() {
  const [T, adh, mot] = mlp(orient).map(v=>Math.abs(v)*2+0.1);
  const attempts = 800;
  for(let a=0;a<attempts;a++){
    const x = (Math.random()*G)|0, y=(Math.random()*G)|0;
    const dx = ((Math.random()*3)|0)-1, dy=((Math.random()*3)|0)-1;
    const nx = (x+dx+G)%G, ny=(y+dy+G)%G;
    const id = grid[y*G+x], nid = grid[ny*G+nx];
    if(id===nid) continue;
    let dE = 0;
    // contact energy simple
    for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++){
      if(!i&&!j) continue;
      const cx=(x+i+G)%G, cy=(y+j+G)%G;
      if(grid[cy*G+cx]!==id) dE += adh;
    }
    dE += (volumes[id]-200)*0.01; // volume constraint
    if(dE < 0 || Math.random() < Math.exp(-dE/T)) {
      grid[y*G+x] = nid;
      volumes[nid]++; volumes[id]--;
    }
  }
  // motility bias from orient
  const ox = orient[0]*mot*2, oy=orient[1]*mot*2;
  // recompute centers
  centers.forEach(c=>{c.x=0;c.y=0;c.c=0;});
  for(let y=0;y<G;y++) for(let x=0;x<G;x++){
    const id=grid[y*G+x];
    centers[id].x += x; centers[id].y += y; centers[id].c++;
  }
  centers.forEach(c=>{ if(c.c){ c.x/=c.c; c.y/=c.c; }});
}

function render() {
  const sx = W/G, sy = H/G;
  for(let y=0;y<G;y++) for(let x=0;x<G;x++){
    ctx.fillStyle = colors[grid[y*G+x]];
    ctx.fillRect(x*sx, y*sy, sx+1, sy+1);
  }
  // bind portals to largest
  const ranked = centers.map((c,i)=>({i,...c})).sort((a,b)=>b.c-a.c);
  portals.forEach((p,i)=>{
    const c = ranked[i];
    if(c && c.c>10){
      p.style.left = (c.x*sx - 35)+'px';
      p.style.top = (c.y*sy - 25)+'px';
      p.textContent = 'C'+c.i;
      p.style.borderColor = colors[c.i];
    }
  });
}

function loop() {
  stepCPM();
  render();
  requestAnimationFrame(loop);
}
volumes.fill(G*G/cellN);
loop();
addEventListener('resize', ()=>{ cv.width=innerWidth; cv.height=innerHeight; });
