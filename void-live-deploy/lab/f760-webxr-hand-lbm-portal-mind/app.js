const cv = document.getElementById('cv');
const status = document.getElementById('status');
const N = 96; // grid
let density = new Float32Array(N*N);
let ux = new Float32Array(N*N);
let uy = new Float32Array(N*N);
// simplified LBM-like: density + velocity with diffusion and force
for(let i=0;i<N*N;i++) density[i] = 0.1 + Math.random()*0.05;

const portals = [];
const NUM = 5;
function randW() { return Array.from({length:8*4 + 4*2}, ()=> (Math.random()-0.5)*0.5); }
for(let i=0;i<NUM;i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'P'+i;
  document.body.appendChild(el);
  portals.push({el, w: randW(), x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight, fit:0, force:0});
}

let mouseX=0, mouseY=0, down=false;
cv.addEventListener('pointermove', e => { mouseX=e.clientX; mouseY=e.clientY; if(down) inject(e.clientX, e.clientY, 0.8); });
cv.addEventListener('pointerdown', e => { down=true; inject(e.clientX, e.clientY, 1.2); });
cv.addEventListener('pointerup', () => down=false);

function inject(cx, cy, str) {
  const gx = Math.floor(cx / window.innerWidth * N);
  const gy = Math.floor(cy / window.innerHeight * N);
  for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++) {
    const x=(gx+dx+N)%N, y=(gy+dy+N)%N, i=y*N+x;
    const d = Math.hypot(dx,dy);
    if(d<3.5) { density[i] += str * (1-d/3.5); ux[i] += dx*0.1*str; uy[i] += dy*0.1*str; }
  }
}

let beta=0, gamma=0;
window.addEventListener('deviceorientation', e => { beta = (e.beta||0)/90; gamma=(e.gamma||0)/90; });

// tiny MLP
function mlp(w, inp) {
  // 4->4->2
  const h = new Array(4).fill(0);
  for(let i=0;i<4;i++) for(let j=0;j<4;j++) h[i] += inp[j]*w[i*4+j];
  for(let i=0;i<4;i++) h[i] = Math.tanh(h[i]);
  const o = [0,0];
  const off=16;
  for(let i=0;i<2;i++) for(let j=0;j<4;j++) o[i] += h[j]*w[off+i*4+j];
  return o.map(v=>Math.tanh(v));
}

function step() {
  // simple diffusion + advection + force (LBM-inspired but JS for reliability)
  const nd = new Float32Array(N*N);
  const nux = new Float32Array(N*N);
  const nuy = new Float32Array(N*N);
  const tiltX = gamma * 0.05, tiltY = beta * 0.05;
  for(let y=0;y<N;y++) for(let x=0;x<N;x++) {
    const i = y*N+x;
    let d=0, vx=0, vy=0, c=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      const xx=(x+dx+N)%N, yy=(y+dy+N)%N, j=yy*N+xx;
      const w = (dx===0&&dy===0)?0.5:0.0625;
      d += density[j]*w; vx += ux[j]*w; vy += uy[j]*w; c+=w;
    }
    d = Math.max(0, Math.min(1.5, d*0.98 + 0.002));
    vx = vx*0.9 + tiltX; vy = vy*0.9 + tiltY;
    nd[i]=d; nux[i]=vx; nuy[i]=vy;
  }
  density=nd; ux=nux; uy=nuy;

  // portals
  portals.forEach(p => {
    const gx = Math.floor(p.x / window.innerWidth * N);
    const gy = Math.floor(p.y / window.innerHeight * N);
    let dens=0, vel=0;
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) {
      const xx=(gx+dx+N)%N, yy=(gy+dy+N)%N, i=yy*N+xx;
      dens += density[i]; vel += Math.hypot(ux[i],uy[i]);
    }
    dens/=25; vel/=25;
    const handD = Math.hypot(p.x-mouseX, p.y-mouseY)/200;
    const out = mlp(p.w, [handD, beta, dens, vel]);
    p.force = out[0]*0.3;
    p.fit = dens * (1+out[1]*0.5) + (p.dragged?0.2:0);
    // seek denser
    let best=0, bx=p.x, by=p.y;
    for(let k=0;k<8;k++) {
      const ang = k/8*Math.PI*2;
      const tx = (gx + Math.cos(ang)*4 + N)%N;
      const ty = (gy + Math.sin(ang)*4 + N)%N;
      const td = density[Math.floor(ty)*N+Math.floor(tx)];
      if(td>best) { best=td; bx = tx/N*window.innerWidth; by=ty/N*window.innerHeight; }
    }
    p.x += (bx - p.x)*0.05 + (Math.random()-0.5)*2;
    p.y += (by - p.y)*0.05 + (Math.random()-0.5)*2;
    p.x = Math.max(40, Math.min(window.innerWidth-40, p.x));
    p.y = Math.max(40, Math.min(window.innerHeight-40, p.y));
    p.el.style.left = (p.x-35)+'px';
    p.el.style.top = (p.y-35)+'px';
    p.el.style.transform = `scale(${0.8+dens*0.8+Math.abs(out[0])*0.3}) rotate(${out[1]*20}deg)`;
    p.el.style.background = `radial-gradient(circle, hsl(${180+out[1]*60},80%,${50+dens*30}%), #124)`;
    if(p.fit>0.4) p.el.classList.add('fit'); else p.el.classList.remove('fit');
  });

  draw();
  requestAnimationFrame(step);
}

function draw() {
  const ctx = cv.getContext('2d');
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  const img = ctx.createImageData(N, N);
  for(let i=0;i<N*N;i++) {
    const d = density[i];
    const v = Math.min(1, Math.hypot(ux[i],uy[i])*5);
    const r = Math.floor(d*80 + v*100);
    const g = Math.floor(d*150);
    const b = Math.floor(d*200 + 50);
    img.data[i*4]=r; img.data[i*4+1]=g; img.data[i*4+2]=b; img.data[i*4+3]=255;
  }
  // upscale
  const tmp = document.createElement('canvas'); tmp.width=N; tmp.height=N;
  tmp.getContext('2d').putImageData(img,0,0);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(tmp, 0,0, cv.width, cv.height);
}

document.getElementById('seal').onclick = () => {
  const best = portals.reduce((a,b)=> a.fit>b.fit?a:b);
  portals.forEach(p => { if(p!==best) p.w = best.w.slice(); });
  status.textContent = 'sealed → '+best.el.textContent;
  try { localStorage.setItem('f760', JSON.stringify(best.w)); } catch (e) { console.debug("lab f760-webxr-hand-lbm-portal-mind:", e); }
};
document.getElementById('reset').onclick = () => {
  portals.forEach(p=> p.w = randW());
  for(let i=0;i<N*N;i++) density[i]=0.1;
  status.textContent = 'reset';
};

// drag portals
portals.forEach(p => {
  let ox,oy;
  p.el.onpointerdown = e => { p.dragged=true; ox=e.clientX-p.x; oy=e.clientY-p.y; e.target.setPointerCapture(e.pointerId); };
  p.el.onpointermove = e => { if(p.dragged){ p.x=e.clientX-ox; p.y=e.clientY-oy; inject(p.x,p.y,0.4); } };
  p.el.onpointerup = () => p.dragged=false;
});

status.textContent = 'running (pointer + orient)';
requestAnimationFrame(step);
