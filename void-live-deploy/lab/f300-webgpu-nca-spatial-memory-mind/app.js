const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const orbsEl = document.getElementById('orbs');
const status = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.onresize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };

const N = 80, M = 50;
let field = new Float32Array(N * M);
let next = new Float32Array(N * M);
let seeds = []; // {x,y,strength,id}

function idx(x,y){ return ((y+M)%M)*N + ((x+N)%N); }

function step(){
  for(let y=0; y<M; y++) for(let x=0; x<N; x++){
    let s = 0;
    for(let dy=-1; dy<=1; dy++) for(let dx=-1; dx<=1; dx++) s += field[idx(x+dx,y+dy)];
    s /= 9;
    // simple NCA-like: grow toward neighbors if seeded, decay otherwise
    let v = field[idx(x,y)];
    let target = s * 1.15;
    next[idx(x,y)] = Math.max(0, Math.min(1, v*0.92 + (target - v)*0.15));
  }
  [field, next] = [next, field];
  // reinforce seeds
  seeds.forEach(sd => {
    const ix = Math.floor(sd.x / W * N), iy = Math.floor(sd.y / H * M);
    if(ix>=0&&ix<N&&iy>=0&&iy<M) field[idx(ix,iy)] = Math.min(1, field[idx(ix,iy)] + sd.strength);
    sd.strength *= 0.995;
  });
  seeds = seeds.filter(sd => sd.strength > 0.01);
}

function draw(){
  const img = ctx.createImageData(N, M);
  for(let i=0; i<field.length; i++){
    const v = field[i];
    img.data[i*4] = v*80; img.data[i*4+1] = v*160; img.data[i*4+2] = v*255; img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(canvas, 0, 0, N, M, 0, 0, W, H);
}

function updateOrbs(){
  orbsEl.innerHTML = '';
  // sample high activity for orbs
  let peaks = [];
  for(let y=0; y<M; y+=8) for(let x=0; x<N; x+=8){
    let mx=0, px=0, py=0;
    for(let dy=0; dy<8; dy++) for(let dx=0; dx<8; dx++){
      const v = field[idx(x+dx,y+dy)];
      if(v > mx){ mx=v; px=x+dx; py=y+dy; }
    }
    if(mx > 0.4) peaks.push({x: px/N*W, y: py/M*H, v:mx});
  }
  peaks.slice(0,5).forEach((p,i) => {
    const d = document.createElement('div');
    d.className = 'orb';
    d.style.left = p.x + 'px';
    d.style.top = p.y + 'px';
    d.style.opacity = Math.min(1, p.v);
    d.style.transform = `translate(-50%,-50%) scale(${0.6 + p.v})`;
    d.title = 'memory orb ' + i;
    d.onpointerdown = e => { e.preventDefault(); seeds.push({x:p.x, y:p.y, strength:0.8, id:Date.now()}); };
    orbsEl.appendChild(d);
  });
}

let mouseX=0, mouseY=0, down=false;
canvas.onpointerdown = e => { down=true; addSeed(e); };
canvas.onpointermove = e => { if(down) addSeed(e); mouseX=e.clientX; mouseY=e.clientY; };
canvas.onpointerup = () => down=false;
function addSeed(e){ seeds.push({x:e.clientX, y:e.clientY, strength:0.6, id:Date.now()}); }

function seal(){
  const snap = Array.from(field);
  const data = {field: snap, seeds: seeds.map(s=>({x:s.x,y:s.y})), t:Date.now()};
  localStorage.setItem('f300-seal', JSON.stringify(data));
  status.textContent = 'Sealed to localStorage';
}
function load(){
  const s = localStorage.getItem('f300-seal');
  if(!s) return status.textContent='No seal';
  const d = JSON.parse(s);
  field.set(d.field);
  status.textContent = 'Loaded seal';
}
document.getElementById('seal').onclick = seal;
document.getElementById('load').onclick = load;

function loop(){
  step();
  draw();
  updateOrbs();
  requestAnimationFrame(loop);
}
loop();
status.textContent = 'Running · pointer seeds memory attractors · orbs are live peaks';
