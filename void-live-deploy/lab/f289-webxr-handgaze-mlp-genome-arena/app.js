const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const fallbackEl = document.getElementById('fallback');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 12;
let agents = [];
let generation = 0;
let champion = null;
let selected = -1;
let pinch = 0;
let gazeX = 0.5, gazeY = 0.5;
let xrSession = null;
let pointerX = 0.5, pointerY = 0.5;

function rand(a=0,b=1){ return a + Math.random()*(b-a); }
function genome(){ return Array.from({length:8}, ()=>rand(-1,1)); }

function initAgents(seed=null){
  agents = [];
  for(let i=0;i<N;i++){
    agents.push({
      x: rand(0.1,0.9)*W, y: rand(0.1,0.9)*H,
      vx: rand(-1,1), vy: rand(-1,1),
      g: seed ? seed.map(v=>v + rand(-0.15,0.15)) : genome(),
      fitness: 0, captures: 0, age: 0, id: i
    });
  }
}
initAgents();

// Tiny MLP: 4 -> 8 -> 4
function mlpForward(inputs, weights){
  const h = new Array(8).fill(0);
  for(let j=0;j<8;j++){
    let s = weights[j]*0.5;
    for(let i=0;i<4;i++) s += inputs[i] * (weights[(i+1)%8] || 0);
    h[j] = Math.tanh(s);
  }
  const out = new Array(4).fill(0);
  for(let k=0;k<4;k++){
    let s = 0;
    for(let j=0;j<8;j++) s += h[j] * (weights[(j+k)%8] || 0.1);
    out[k] = Math.tanh(s);
  }
  return out;
}

function step(){
  const gx = xrSession ? gazeX : pointerX;
  const gy = xrSession ? gazeY : pointerY;
  const inputsBase = [gx*2-1, gy*2-1, pinch, 0];

  for(let a of agents){
    a.age++;
    a.fitness += 0.01;
    const local = Math.hypot((a.x/W - gx), (a.y/H - gy));
    const inputs = [...inputsBase];
    inputs[3] = 1 - Math.min(1, local*3);
    const out = mlpForward(inputs, a.g);
    a.vx += out[0]*0.15;
    a.vy += out[1]*0.15;
    a.vx *= 0.98; a.vy *= 0.98;
    a.x += a.vx; a.y += a.vy;
    if(a.x<10||a.x>W-10) a.vx *= -0.8;
    if(a.y<10||a.y>H-10) a.vy *= -0.8;
    a.x = Math.max(10, Math.min(W-10, a.x));
    a.y = Math.max(10, Math.min(H-10, a.y));
  }

  let best = 1e9, bestI = -1;
  for(let i=0;i<agents.length;i++){
    const d = Math.hypot(agents[i].x/W - gx, agents[i].y/H - gy);
    if(d < best && d < 0.15){ best = d; bestI = i; }
  }
  selected = bestI;

  if(pinch > 0.6 && selected >= 0){
    for(let j=0;j<agents.length;j++){
      if(j===selected) continue;
      const d = Math.hypot(agents[selected].x - agents[j].x, agents[selected].y - agents[j].y);
      if(d < 40){
        agents[j].g = agents[selected].g.map(v => v*0.7 + agents[j].g[Math.floor(Math.random()*8)]*0.3 + rand(-0.05,0.05));
        agents[selected].captures++;
        agents[selected].fitness += 5;
        agents[j].fitness = Math.max(0, agents[j].fitness - 1);
      }
    }
  }

  const bestA = agents.reduce((b,a)=> a.fitness > b.fitness ? a : b, agents[0]);
  if(!champion || bestA.fitness > champion.fitness) champion = {g: [...bestA.g], fitness: bestA.fitness, gen: generation};

  draw();
  requestAnimationFrame(step);
}

function draw(){
  ctx.fillStyle = '#050510';
  ctx.fillRect(0,0,W,H);
  for(let a of agents){
    const sel = agents.indexOf(a) === selected;
    ctx.beginPath();
    ctx.arc(a.x, a.y, sel ? 14 : 10, 0, Math.PI*2);
    const hue = (a.g[0]+1)*180;
    ctx.fillStyle = `hsl(${hue},70%,${50 + a.captures*5}%)`;
    ctx.fill();
    if(sel){ ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke(); }
  }
  ctx.strokeStyle = '#8cf';
  ctx.beginPath();
  ctx.moveTo(gazeX*W-10, gazeY*H); ctx.lineTo(gazeX*W+10, gazeY*H);
  ctx.moveTo(gazeX*W, gazeY*H-10); ctx.lineTo(gazeX*W, gazeY*H+10);
  ctx.stroke();

  const best = champion ? champion.fitness.toFixed(1) : '—';
  statusEl.innerHTML = `Gen ${generation} | Agents ${N}<br>Selected: ${selected>=0?selected:'none'} | Pinch ${(pinch*100)|0}%<br>Champion fitness: ${best}<br>Captures total: ${agents.reduce((s,a)=>s+a.captures,0)}`;
}

canvas.addEventListener('pointermove', e => {
  pointerX = e.clientX / W;
  pointerY = e.clientY / H;
  if(!xrSession){ gazeX = pointerX; gazeY = pointerY; }
});
canvas.addEventListener('pointerdown', () => { pinch = 0.9; });
canvas.addEventListener('pointerup', () => { pinch = 0; });

document.getElementById('xrbtn').onclick = async () => {
  if(!navigator.xr){ fallbackEl.textContent = 'WebXR not available — using pointer'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['hand-tracking']});
    statusEl.textContent += ' | XR session started (pose simulated for prototype)';
  } catch(e){
    fallbackEl.textContent = 'XR denied or unsupported — pointer active';
  }
};

let db;
const req = indexedDB.open('F289Genome', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('champ', {keyPath:'id'});
req.onsuccess = e => { db = e.target.result; };
function seal(){
  if(!champion || !db) return;
  const tx = db.transaction('champ','readwrite');
  tx.objectStore('champ').put({id:'champ', ...champion, gen: generation});
  statusEl.textContent += ' | Sealed!';
}
function load(){
  if(!db) return;
  const tx = db.transaction('champ','readonly');
  const g = tx.objectStore('champ').get('champ');
  g.onsuccess = () => {
    if(g.result){
      champion = g.result;
      initAgents(champion.g);
      generation = champion.gen || 0;
      statusEl.textContent += ' | Loaded champion';
    }
  };
}
document.getElementById('seal').onclick = seal;
document.getElementById('load').onclick = load;

step();
