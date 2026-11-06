const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
let nodes = [];
let edges = [];
let weights = { W1: null, b1: null, W2: null, b2: null };
let xrSession = null;
let lastHand = null;
let frameCount = 0;

function rand(n) { return (Math.random()-0.5)*n; }
function dist(a,b) { return Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z); }

function initMLP() {
  const inS=6, h=8, outS=3;
  weights.W1 = Array.from({length:h}, ()=>Array.from({length:inS}, ()=>rand(0.2)));
  weights.b1 = Array(h).fill(0);
  weights.W2 = Array.from({length:outS}, ()=>Array.from({length:h}, ()=>rand(0.2)));
  weights.b2 = Array(outS).fill(0);
}

function mlpForward(x) {
  const h = weights.W1.map((row,i)=> Math.tanh(row.reduce((s,w,j)=>s+w*x[j], weights.b1[i])));
  return weights.W2.map((row,i)=> row.reduce((s,w,j)=>s+w*h[j], weights.b2[i]));
}

function updateMLP(x, reward) {
  const lr = 0.01 * reward;
  for (let i=0;i<weights.W2.length;i++)
    for (let j=0;j<weights.W2[i].length;j++)
      weights.W2[i][j] += lr * (Math.random()-0.5)*0.01;
}

function createNode(x,y,z) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'Portal ' + (nodes.length+1);
  canvas.appendChild(el);
  const n = { el, x, y, z, vx:0, vy:0, vz:0, sealed:false };
  nodes.push(n);
  return n;
}

function render() {
  nodes.forEach(n => {
    n.el.style.transform = `translate3d(${n.x}px,${n.y}px,${n.z}px) rotateY(${n.x*0.1}deg)`;
    n.el.style.opacity = 0.6 + Math.min(0.4, Math.hypot(n.vx,n.vy)*0.01);
  });
}

async function loadSealed() {
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open('f568-spatial-graph',1);
      r.onupgradeneeded = ()=> r.result.createObjectStore('graph');
      r.onsuccess = ()=> res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('graph','readonly');
    const data = await new Promise(res=> tx.objectStore('graph').get('sealed').onsuccess = e=> res(e.target.result));
    if (data) {
      nodes = [];
      canvas.innerHTML = '';
      data.nodes.forEach(nd => {
        const n = createNode(nd.x, nd.y, nd.z);
        n.sealed = true;
        n.el.classList.add('sealed');
      });
      if (data.weights) weights = data.weights;
      status.textContent = 'Sealed graph restored (' + nodes.length + ' nodes)';
    }
  } catch(e) { status.textContent = 'No sealed data or IDB blocked'; }
}

async function seal() {
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open('f568-spatial-graph',1);
      r.onupgradeneeded = ()=> r.result.createObjectStore('graph');
      r.onsuccess = ()=> res(r.result);
      r.onerror = rej;
    });
    const data = {
      nodes: nodes.map(n=>({x:n.x,y:n.y,z:n.z})),
      weights
    };
    const tx = db.transaction('graph','readwrite');
    tx.objectStore('graph').put(data, 'sealed');
    nodes.forEach(n=>{ n.sealed=true; n.el.classList.add('sealed'); });
    status.textContent = 'Graph sealed to IndexedDB';
  } catch(e) { status.textContent = 'Seal failed: ' + e.message; }
}

function step(handPos) {
  frameCount++;
  if (!handPos) handPos = lastHand || {x:200,y:200,z:0};
  lastHand = handPos;

  nodes.forEach(n => {
    const dx = handPos.x - n.x, dy = handPos.y - n.y, dz = (handPos.z||0) - n.z;
    const d = Math.hypot(dx,dy,dz)+1;
    const features = [dx/d, dy/d, dz/d, n.vx*0.01, n.vy*0.01, Math.min(1, d/400)];
    const pred = mlpForward(features);
    n.vx += pred[0]*0.5;
    n.vy += pred[1]*0.5;
    n.vz += pred[2]*0.5;
    n.vx *= 0.95; n.vy *= 0.95; n.vz *= 0.95;
    n.x += n.vx; n.y += n.vy; n.z += n.vz;
    n.x = Math.max(20, Math.min(window.innerWidth-140, n.x));
    n.y = Math.max(20, Math.min(window.innerHeight-100, n.y));
  });

  const nearest = nodes.reduce((best,n)=> dist(handPos,n)<dist(handPos,best)?n:best, nodes[0]||{x:0,y:0,z:0});
  const reward = nearest && dist(handPos, nearest)<80 ? 1 : 0.1;
  if (frameCount % 5 === 0) updateMLP([0,0,0,0,0,0], reward);

  render();
  requestAnimationFrame(()=>step(lastHand));
}

let pointer = {x:300,y:300,z:0};
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  lastHand = pointer;
});
canvas.addEventListener('pointerdown', e => {
  if (nodes.length < 10) createNode(e.clientX, e.clientY, 0);
});

document.getElementById('enterXR').onclick = async () => {
  if (!navigator.xr) { status.textContent = 'WebXR not available — using pointer'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['hand-tracking']});
    status.textContent = 'WebXR active (hand tracking if supported)';
  } catch(e) {
    status.textContent = 'WebXR failed: ' + e.message + ' — pointer mode';
  }
};

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => {
  nodes.forEach(n=>n.el.remove());
  nodes = [];
  initMLP();
  status.textContent = 'Reset';
};

initMLP();
loadSealed().then(()=>{
  if (nodes.length === 0) {
    createNode(200,150,0);
    createNode(400,200,20);
    createNode(300,300,-10);
  }
  status.textContent = 'Ready — move pointer or enter XR. Drag to interact. Seal to persist.';
  requestAnimationFrame(()=>step(pointer));
});

window.addEventListener('deviceorientation', e => {
  if (e.beta != null) {
    pointer.z = (e.beta - 45) * 2;
  }
});
