const COLS = 6, ROWS = 6, N = COLS * ROWS;
const REST = 90;
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const nodes = [];
const pos = [], prev = [], vel = [];
let stiffness = 0.8, damping = 0.92;
let mlp = Array(20).fill(0).map(() => (Math.random()-0.5)*0.4);
let hand = {x: innerWidth/2, y: innerHeight/2, active: false};
let orient = {beta:0, gamma:0};
let idbReady = false;
const bc = new BroadcastChannel('f836-genome');

function relu(x){ return x>0?x:0; }
function mlpForward(inputs){
  // tiny: 4->4->2
  let h = [0,0,0,0];
  for(let i=0;i<4;i++) for(let j=0;j<4;j++) h[i] += inputs[j]*mlp[i*4+j];
  h = h.map(relu);
  let o = [0,0];
  for(let i=0;i<2;i++) for(let j=0;j<4;j++) o[i] += h[j]*mlp[16+i*4+j];
  return o.map(x => Math.tanh(x));
}

function initNodes(){
  stage.innerHTML = '';
  nodes.length = 0; pos.length=0; prev.length=0;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const el = document.createElement('div');
    el.className = 'node';
    el.contentEditable = true;
    el.textContent = `thought ${r*COLS+c}`;
    const x = 80 + c*REST, y = 100 + r*REST;
    el.style.left = x+'px'; el.style.top = y+'px';
    stage.appendChild(el);
    nodes.push(el);
    pos.push({x,y});
    prev.push({x,y});
  }
}

function constraints(){
  for(let iter=0;iter<4;iter++){
    for(let i=0;i<N;i++){
      const r = Math.floor(i/COLS), c = i%COLS;
      const neigh = [];
      if(c+1<COLS) neigh.push(i+1);
      if(r+1<ROWS) neigh.push(i+COLS);
      if(c+1<COLS && r+1<ROWS) neigh.push(i+1+COLS); // shear
      for(const j of neigh){
        let dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
        let dist = Math.hypot(dx,dy) || 1;
        let diff = (dist - REST) / dist * 0.5 * stiffness;
        pos[i].x += dx * diff; pos[i].y += dy * diff;
        pos[j].x -= dx * diff; pos[j].y -= dy * diff;
      }
    }
  }
}

function step(){
  // gravity + orientation bias
  const gx = orient.gamma * 0.15, gy = orient.beta * 0.15 + 0.4;
  for(let i=0;i<N;i++){
    let vx = (pos[i].x - prev[i].x) * damping;
    let vy = (pos[i].y - prev[i].y) * damping;
    prev[i].x = pos[i].x; prev[i].y = pos[i].y;
    pos[i].x += vx + gx;
    pos[i].y += vy + gy;
  }
  // hand grasp
  if(hand.active){
    let best=0, bd=1e9;
    for(let i=0;i<N;i++){
      let d = Math.hypot(pos[i].x-hand.x, pos[i].y-hand.y);
      if(d<bd){bd=d; best=i;}
    }
    if(bd<120){
      pos[best].x += (hand.x - pos[best].x)*0.35;
      pos[best].y += (hand.y - pos[best].y)*0.35;
    }
  }
  constraints();
  // MLP material adapt
  let strain=0;
  for(let i=0;i<N-1;i++){
    let d = Math.hypot(pos[i].x-pos[i+1].x, pos[i].y-pos[i+1].y);
    strain += Math.abs(d-REST);
  }
  strain /= N;
  const inputs = [strain/40, Math.hypot(hand.x-innerWidth/2, hand.y-innerHeight/2)/400, orient.gamma/30, Math.sin(Date.now()/800)];
  const out = mlpForward(inputs);
  stiffness = 0.5 + out[0]*0.4;
  damping = 0.88 + out[1]*0.08;
  // render
  for(let i=0;i<N;i++){
    nodes[i].style.left = pos[i].x+'px';
    nodes[i].style.top = pos[i].y+'px';
    const s = Math.min(1, strain/30);
    nodes[i].style.background = `hsl(${200+s*80},50%,${20+s*15}%)`;
  }
  statusEl.textContent = `stiff ${stiffness.toFixed(2)} damp ${damping.toFixed(2)} strain ${strain.toFixed(1)}`;
  requestAnimationFrame(step);
}

function mutateMLP(){
  for(let i=0;i<mlp.length;i++) if(Math.random()<0.3) mlp[i] += (Math.random()-0.5)*0.15;
}

// events
stage.addEventListener('pointermove', e => { hand.x=e.clientX; hand.y=e.clientY; hand.active=true; });
stage.addEventListener('pointerup', () => hand.active=false);
stage.addEventListener('pointerdown', e => {
  if(e.target.classList.contains('node')) mutateMLP();
});
window.addEventListener('deviceorientation', e => {
  if(e.beta!=null){ orient.beta=e.beta; orient.gamma=e.gamma||0; }
});

// persistence
const req = indexedDB.open('verse-f836',1);
req.onupgradeneeded = e => e.target.result.createObjectStore('state');
req.onsuccess = e => { idbReady=true; const db=e.target.result;
  const tx=db.transaction('state','readonly');
  tx.objectStore('state').get('mlp').onsuccess = ev => { if(ev.target.result) mlp=ev.target.result; };
};

function seal(){
  if(!idbReady) return;
  const dbReq = indexedDB.open('verse-f836',1);
  dbReq.onsuccess = e => {
    const db=e.target.result;
    const tx=db.transaction('state','readwrite');
    tx.objectStore('state').put(mlp,'mlp');
    bc.postMessage({type:'genome', mlp, fitness: Math.random()});
    statusEl.textContent = 'sealed & broadcast';
  };
}
document.getElementById('seal').onclick = seal;
document.getElementById('load').onclick = () => location.reload();
document.getElementById('reset').onclick = () => { mlp=Array(20).fill(0).map(()=>(Math.random()-0.5)*0.4); initNodes(); };
bc.onmessage = ev => {
  if(ev.data.type==='genome' && ev.data.mlp){ mlp=ev.data.mlp; statusEl.textContent='adopted genome'; }
};

// WebXR stub (full hand would use XRHand + joint poses)
document.getElementById('xr').onclick = async () => {
  if(!navigator.xr){ statusEl.textContent='no WebXR'; return; }
  try {
    const session = await navigator.xr.requestSession('inline', {optionalFeatures:['hand-tracking']});
    statusEl.textContent='XR session (fallback pointer)';
    // full joint mapping omitted for size; pointer remains primary in this prototype
  } catch(err){ statusEl.textContent='XR denied'; }
};

initNodes();
step();
