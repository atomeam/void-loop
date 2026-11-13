const N = 7;
const cards = [];
const constraints = [];
let mlp = { w1: Array(8).fill(0).map(()=>Math.random()*0.4-0.2), w2: Array(2).fill(0).map(()=>Math.random()*0.4-0.2), b: [0,0] };
let fitness = 0;
let hand = { x: 200, y: 200, vx:0, vy:0 };
let tilt = { x:0, y:0 };
const status = document.getElementById('status');
const svg = document.getElementById('line');

function rand(a,b){ return a + Math.random()*(b-a); }

function createCards(){
  for(let i=0;i<N;i++){
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = 'C'+(i+1);
    el.style.left = rand(80, window.innerWidth-120)+'px';
    el.style.top = rand(80, window.innerHeight-100)+'px';
    document.body.appendChild(el);
    const c = { el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), px:0, py:0, vx:0, vy:0, clicks:0 };
    c.px = c.x; c.py = c.y;
    el.onpointerdown = e => { e.preventDefault(); c.dragging=true; c.ox=e.clientX-c.x; c.oy=e.clientY-c.y; c.clicks++; fitness+=5; };
    el.onpointerup = () => c.dragging=false;
    el.onpointermove = e => { if(c.dragging){ c.x=e.clientX-c.ox; c.y=e.clientY-c.oy; } };
    cards.push(c);
  }
  // chain + some cross
  for(let i=0;i<N-1;i++) constraints.push({ a:i, b:i+1, rest:140, k:0.15 });
  constraints.push({ a:0, b:3, rest:200, k:0.1 });
  constraints.push({ a:2, b:5, rest:180, k:0.12 });
}

function mlpForward(inputs){
  let h = 0;
  for(let i=0;i<Math.min(4,inputs.length);i++) h += inputs[i] * mlp.w1[i];
  h = Math.tanh(h + mlp.b[0]);
  const out1 = h * mlp.w2[0];
  const out2 = h * mlp.w2[1];
  return [0.08 + Math.abs(out1)*0.3, 0.8 + out2*0.4]; // stiffness, restBias
}

function step(){
  // hand from pointer or last
  const hx = hand.x, hy = hand.y;
  const hdistAvg = cards.reduce((s,c)=>s+Math.hypot(c.x-hx,c.y-hy),0)/N;
  const inputs = [hdistAvg/300, hand.vx/10, tilt.x, tilt.y];
  const [stiff, restB] = mlpForward(inputs);

  // update constraints params from MLP
  constraints.forEach(con => { con.k = stiff; con.rest *= restB; con.rest = Math.max(80, Math.min(280, con.rest)); });

  // Verlet-like on cards
  cards.forEach(c => {
    if(c.dragging){ c.vx=0; c.vy=0; return; }
    c.vx *= 0.92; c.vy *= 0.92;
    c.vy += 0.05; // slight gravity
    c.x += c.vx; c.y += c.vy;
    // bounds
    c.x = Math.max(20, Math.min(window.innerWidth-110, c.x));
    c.y = Math.max(40, Math.min(window.innerHeight-90, c.y));
  });

  // spring constraints
  constraints.forEach(con => {
    const a = cards[con.a], b = cards[con.b];
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx,dy) || 1;
    const diff = (con.rest - dist) / dist * con.k;
    const ox = dx * diff * 0.5, oy = dy * diff * 0.5;
    if(!a.dragging){ a.x -= ox; a.y -= oy; }
    if(!b.dragging){ b.x += ox; b.y += oy; }
  });

  // apply positions
  cards.forEach(c => { c.el.style.left = c.x+'px'; c.el.style.top = c.y+'px'; });

  // collisions for genome transfer
  for(let i=0;i<N;i++) for(let j=i+1;j<N;j++){
    const a=cards[i], b=cards[j];
    if(Math.hypot(a.x-b.x, a.y-b.y) < 70){
      const fa = a.clicks - Math.abs(a.vx+a.vy);
      const fb = b.clicks - Math.abs(b.vx+b.vy);
      if(fa > fb + 2){ /* transfer to b? simplified shared */ status.textContent = 'overlap transfer signal'; }
    }
  }

  // draw lines
  svg.innerHTML = constraints.map(con => {
    const a=cards[con.a], b=cards[con.b];
    return `<line x1="${a.x+45}" y1="${a.y+35}" x2="${b.x+45}" y2="${b.y+35}" stroke="rgba(100,200,255,0.4)" stroke-width="2"/>`;
  }).join('');

  status.textContent = `stiff:${stiff.toFixed(2)} restB:${restB.toFixed(2)} fit:${fitness.toFixed(0)} cards:${N}`;
  requestAnimationFrame(step);
}

// pointer as hand
document.addEventListener('pointermove', e => {
  hand.vx = e.clientX - hand.x; hand.vy = e.clientY - hand.y;
  hand.x = e.clientX; hand.y = e.clientY;
});

// orientation
window.addEventListener('deviceorientation', e => {
  tilt.x = (e.gamma||0)/90; tilt.y = (e.beta||0)/90;
});

// IndexedDB + BC
const bc = new BroadcastChannel('f678-genome');
bc.onmessage = e => { if(e.data && e.data.fit > fitness){ mlp = e.data.mlp; fitness = e.data.fit; status.textContent = 'adopted genome'; } };

function seal(){
  const dbReq = indexedDB.open('verse-f678',1);
  dbReq.onupgradeneeded = ev => ev.target.result.createObjectStore('genomes');
  dbReq.onsuccess = ev => {
    const tx = ev.target.result.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({mlp, fitness}, 'best');
  };
  bc.postMessage({mlp, fit:fitness});
  status.textContent = 'sealed & broadcast';
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => location.reload();

// try XR
document.getElementById('xr').onclick = async () => {
  if(navigator.xr){
    try {
      const session = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['hand-tracking']});
      status.textContent = 'XR session started (hand proxy active)';
      // simple: keep pointer proxy; real joint mapping would go here
    } catch(err){ status.textContent = 'XR failed: '+err.message; }
  } else status.textContent = 'no WebXR';
};

createCards();
requestAnimationFrame(step);
