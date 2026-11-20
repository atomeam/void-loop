const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const status = document.getElementById('status');
const beadsDiv = document.getElementById('beads');
let W = innerWidth, H = innerHeight;
cv.width = W; cv.height = H;
onresize = () => { W = innerWidth; H = innerHeight; cv.width = W; cv.height = H; };

// Chain params
const N = 12;
const restLen = 48;
const kSpring = 0.18;
const damping = 0.92;
const gravity = 0.15;
let nodes = Array.from({length:N}, (_,i) => ({
  x: W/2 + (i-N/2)*20, y: 120 + i*8,
  px: W/2 + (i-N/2)*20, py: 120 + i*8,
  vx:0, vy:0, fixed: i===0
}));
const beads = [];
for(let i=0;i<N;i++){
  const b = document.createElement('div');
  b.className = 'bead';
  b.textContent = i;
  b.dataset.i = i;
  beadsDiv.appendChild(b);
  beads.push(b);
}

// Kalman filter: estimates user "intent" velocity from DeviceMotion accel
// State: [vx, vy], measurement: accel-derived
let kf = {
  x: [0,0], // state
  P: [[1,0],[0,1]], // cov
  Q: 0.01, // process noise
  R: 0.5  // measurement noise
};
function kfPredict(){
  // simple constant velocity, no control
  // P = P + Q
  kf.P[0][0] += kf.Q; kf.P[1][1] += kf.Q;
}
function kfUpdate(z){ // z = [ax, ay] approx velocity residual
  const K0 = kf.P[0][0] / (kf.P[0][0] + kf.R);
  const K1 = kf.P[1][1] / (kf.P[1][1] + kf.R);
  kf.x[0] += K0 * (z[0] - kf.x[0]);
  kf.x[1] += K1 * (z[1] - kf.x[1]);
  kf.P[0][0] *= (1-K0);
  kf.P[1][1] *= (1-K1);
}

// DeviceMotion
let ax=0, ay=0;
if(window.DeviceMotionEvent){
  window.addEventListener('devicemotion', e => {
    if(e.accelerationIncludingGravity){
      ax = (e.accelerationIncludingGravity.x || 0) * 0.05;
      ay = (e.accelerationIncludingGravity.y || 0) * 0.05;
    }
  });
}
// Fallback pointer
let px=W/2, py=H/2;
onpointermove = e => { px=e.clientX; py=e.clientY; };

// Drag beads
let dragging = -1, offX=0, offY=0;
beadsDiv.addEventListener('pointerdown', e => {
  if(e.target.classList.contains('bead')){
    dragging = +e.target.dataset.i;
    const n = nodes[dragging];
    offX = e.clientX - n.x; offY = e.clientY - n.y;
    e.target.setPointerCapture(e.pointerId);
  }
});
onpointermove = e => {
  if(dragging>=0){
    nodes[dragging].x = e.clientX - offX;
    nodes[dragging].y = e.clientY - offY;
    nodes[dragging].px = nodes[dragging].x;
    nodes[dragging].py = nodes[dragging].y;
  } else {
    px = e.clientX; py = e.clientY;
  }
};
onpointerup = () => dragging = -1;

// Fitness / reward
let fitness = 0;
function rewardClosest(){
  let best=0, bestD=1e9;
  for(let i=0;i<N;i++){
    const d = Math.hypot(nodes[i].x-px, nodes[i].y-py);
    if(d<bestD){ bestD=d; best=i; }
  }
  fitness += 1/(1+bestD);
  // slight param adaptation
  kf.Q = Math.max(0.001, kf.Q * 0.99);
  status.textContent = `rewarded bead ${best} | fit ${fitness.toFixed(2)}`;
}

// Seal / IDB + Broadcast
const DB = 'f826-kalman-chain';
const bc = new BroadcastChannel('f826-genome');
async function seal(){
  const data = { kf: JSON.parse(JSON.stringify(kf)), fitness, kSpring, restLen };
  try{
    const req = indexedDB.open(DB,1);
    req.onupgradeneeded = () => req.result.createObjectStore('g');
    req.onsuccess = () => {
      const tx = req.result.transaction('g','readwrite');
      tx.objectStore('g').put(data, 'best');
    };
  }catch (e) { console.debug("lab f826-devicemotion-kalman-webgpu-chain-mind:", e); }
  bc.postMessage(data);
  status.textContent = 'sealed genome';
}
bc.onmessage = e => {
  if(e.data && e.data.fitness > fitness){
    Object.assign(kf, e.data.kf);
    fitness = e.data.fitness * 0.9;
    status.textContent = 'adopted higher fitness genome';
  }
};
document.addEventListener('keydown', e => {
  if(e.key==='s' || e.key==='S') seal();
  if(e.key==='r' || e.key==='R') rewardClosest();
});

// Physics step (Verlet-ish)
function step(){
  // Kalman
  kfPredict();
  const z = [ax + (px - nodes[N-1].x)*0.002, ay + (py - nodes[N-1].y)*0.002];
  kfUpdate(z);
  // Apply estimated intent as force on free end
  nodes[N-1].vx += kf.x[0];
  nodes[N-1].vy += kf.x[1];

  for(let i=0;i<N;i++){
    if(nodes[i].fixed && dragging!==i) continue;
    nodes[i].vy += gravity;
    nodes[i].vx *= damping;
    nodes[i].vy *= damping;
    nodes[i].x += nodes[i].vx;
    nodes[i].y += nodes[i].vy;
  }
  // Springs
  for(let iter=0;iter<3;iter++){
    for(let i=0;i<N-1;i++){
      const a=nodes[i], b=nodes[i+1];
      const dx=b.x-a.x, dy=b.y-a.y;
      const d=Math.hypot(dx,dy)||1;
      const diff=(d-restLen)/d * kSpring;
      if(!a.fixed || dragging===i){ a.x += dx*diff*0.5; a.y += dy*diff*0.5; }
      if(!b.fixed || dragging===i+1){ b.x -= dx*diff*0.5; b.y -= dy*diff*0.5; }
    }
  }
  // Bounds
  for(let i=0;i<N;i++){
    nodes[i].x = Math.max(20, Math.min(W-20, nodes[i].x));
    nodes[i].y = Math.max(20, Math.min(H-20, nodes[i].y));
  }
}

function draw(){
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = '#6af';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(nodes[0].x, nodes[0].y);
  for(let i=1;i<N;i++) ctx.lineTo(nodes[i].x, nodes[i].y);
  ctx.stroke();
  // Beads
  for(let i=0;i<N;i++){
    const b = beads[i];
    b.style.left = (nodes[i].x - 18) + 'px';
    b.style.top = (nodes[i].y - 18) + 'px';
    const hue = 200 + i*8;
    b.style.background = `radial-gradient(circle at 30% 30%, hsl(${hue},80%,70%), hsl(${hue},60%,40%))`;
  }
  // Intent vector
  ctx.strokeStyle = '#f6a';
  ctx.beginPath();
  ctx.moveTo(nodes[N-1].x, nodes[N-1].y);
  ctx.lineTo(nodes[N-1].x + kf.x[0]*40, nodes[N-1].y + kf.x[1]*40);
  ctx.stroke();
}

function loop(){
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();
status.textContent = 'running — tilt or drag | S seal | R reward';
