const N = 64;
const cv = document.getElementById('cv');
const statusEl = document.getElementById('status');
let W = innerWidth, H = innerHeight;
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
const img = ctx.createImageData(N, N);

// CML state: logistic maps x in [0,1]
let state = new Float32Array(N*N);
for (let i=0;i<state.length;i++) state[i] = Math.random();

// Tiny MLP: 4 inputs (orient x,y or pointer vx,vy) → 2 outputs (r bias, coupling bias)
const IN=4, H1=8, OUT=2;
let w1 = new Float32Array(IN*H1), b1 = new Float32Array(H1), w2 = new Float32Array(H1*OUT), b2 = new Float32Array(OUT);
function initW() {
  for (let i=0;i<w1.length;i++) w1[i] = (Math.random()-0.5)*0.4;
  for (let i=0;i<w2.length;i++) w2[i] = (Math.random()-0.5)*0.4;
}
initW();
function mlp(x) {
  const h = new Float32Array(H1);
  for (let j=0;j<H1;j++) {
    let s = b1[j];
    for (let i=0;i<IN;i++) s += x[i]*w1[i*H1+j];
    h[j] = Math.tanh(s);
  }
  const o = new Float32Array(OUT);
  for (let k=0;k<OUT;k++) {
    let s = b2[k];
    for (let j=0;j<H1;j++) s += h[j]*w2[j*OUT+k];
    o[k] = Math.tanh(s);
  }
  return o;
}

// Inputs
let ox=0, oy=0, pvx=0, pvy=0, px=0, py=0;
window.addEventListener('deviceorientation', e => {
  ox = (e.gamma||0)/90; oy = (e.beta||0)/90;
});
cv.addEventListener('pointermove', e => {
  pvx = (e.clientX - px)*0.05; pvy = (e.clientY - py)*0.05;
  px = e.clientX; py = e.clientY;
});

// Portals
const portals = [];
const pdiv = document.getElementById('portals');
for (let i=0;i<4;i++) {
  const d = document.createElement('div');
  d.className = 'portal';
  d.textContent = 'P'+(i+1);
  d.style.left = (20+i*18)+'%';
  d.style.top = (30+ (i%2)*25)+'%';
  pdiv.appendChild(d);
  const p = { el:d, x:0, y:0, activity:0 };
  portals.push(p);
  let drag=false, dx=0, dy=0;
  d.addEventListener('pointerdown', e => { drag=true; dx=e.clientX-d.offsetLeft; dy=e.clientY-d.offsetTop; d.setPointerCapture(e.pointerId); });
  d.addEventListener('pointermove', e => { if(!drag) return; d.style.left = (e.clientX-dx)+'px'; d.style.top = (e.clientY-dy)+'px'; });
  d.addEventListener('pointerup', () => drag=false);
  d.addEventListener('click', () => { reward(p); });
}
function updatePortalPos() {
  portals.forEach(p => {
    const r = p.el.getBoundingClientRect();
    p.x = (r.left + r.width/2) / W * N;
    p.y = (r.top + r.height/2) / H * N;
  });
}

let fitness = 0;
function reward(p) {
  const inp = [ox, oy, pvx, pvy];
  const o = mlp(inp);
  for (let i=0;i<w2.length;i++) w2[i] += 0.01 * (Math.random()-0.3);
  fitness += 1;
  statusEl.textContent = 'rewarded fitness=' + fitness.toFixed(1);
}

const rBase = 3.7, coup = 0.15;
function stepCML() {
  const inp = [ox || pvx*0.5, oy || pvy*0.5, pvx, pvy];
  const o = mlp(inp);
  const r = rBase + o[0]*0.25;
  const c = Math.max(0, Math.min(0.4, coup + o[1]*0.1));
  const next = new Float32Array(N*N);
  for (let y=0;y<N;y++) for (let x=0;x<N;x++) {
    const i = y*N+x;
    const xm = state[i];
    const f = r * xm * (1 - xm);
    let avg = 0, cnt=0;
    for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
      if (dx===0 && dy===0) continue;
      const nx = (x+dx+N)%N, ny = (y+dy+N)%N;
      avg += state[ny*N+nx]; cnt++;
    }
    avg /= cnt;
    next[i] = (1-c)*f + c*avg;
  }
  updatePortalPos();
  portals.forEach(p => {
    const ix = Math.floor(p.x), iy = Math.floor(p.y);
    if (ix>=0 && ix<N && iy>=0 && iy<N) {
      const ii = iy*N+ix;
      next[ii] = Math.min(1, next[ii] + 0.3);
      let a=0;
      for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++) {
        const nx=(ix+dx+N)%N, ny=(iy+dy+N)%N;
        a += next[ny*N+nx];
      }
      p.activity = a / 25;
      p.el.classList.toggle('high', p.activity > 0.6);
      p.el.style.transform = `scale(${0.8 + p.activity*0.6})`;
    }
  });
  state = next;
}

function render() {
  for (let i=0;i<N*N;i++) {
    const v = state[i];
    const c = Math.floor(v*255);
    img.data[i*4] = c*0.3; img.data[i*4+1] = c*0.7; img.data[i*4+2] = 255-c*0.4; img.data[i*4+3] = 255;
  }
  const tmp = document.createElement('canvas'); tmp.width=N; tmp.height=N;
  tmp.getContext('2d').putImageData(img,0,0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, W, H);
}

function loop() {
  stepCML();
  render();
  requestAnimationFrame(loop);
}
loop();

const bc = new BroadcastChannel('f828-genome');
bc.onmessage = e => {
  if (e.data.fitness > fitness) {
    w1.set(e.data.w1); b1.set(e.data.b1); w2.set(e.data.w2); b2.set(e.data.b2);
    fitness = e.data.fitness;
    statusEl.textContent = 'adopted higher fitness ' + fitness.toFixed(1);
  }
};
function seal() {
  const data = { w1:Array.from(w1), b1:Array.from(b1), w2:Array.from(w2), b2:Array.from(b2), fitness };
  try {
    const req = indexedDB.open('f828-cml',1);
    req.onupgradeneeded = () => req.result.createObjectStore('seal');
    req.onsuccess = () => {
      const tx = req.result.transaction('seal','readwrite');
      tx.objectStore('seal').put(data, 'best');
    };
  } catch (e) { console.debug("lab f828-webgpu-cml-orientation-mlp-portal-mind:", e); }
  bc.postMessage(data);
  statusEl.textContent = 'sealed fitness=' + fitness.toFixed(1);
}
function restore() {
  try {
    const req = indexedDB.open('f828-cml',1);
    req.onsuccess = () => {
      const tx = req.result.transaction('seal');
      const g = tx.objectStore('seal').get('best');
      g.onsuccess = () => {
        if (g.result) {
          w1.set(g.result.w1); b1.set(g.result.b1); w2.set(g.result.w2); b2.set(g.result.b2);
          fitness = g.result.fitness || 0;
          statusEl.textContent = 'restored fitness=' + fitness.toFixed(1);
        }
      };
    };
  } catch (e) { console.debug("lab f828-webgpu-cml-orientation-mlp-portal-mind:", e); }
}
window.addEventListener('keydown', e => {
  if (e.key==='s' || e.key==='S') seal();
  if (e.key==='r' || e.key==='R') restore();
});
statusEl.textContent = 'running — tilt or move pointer, click portals, S seal';
window.addEventListener('resize', () => { W=innerWidth; H=innerHeight; cv.width=W; cv.height=H; });
