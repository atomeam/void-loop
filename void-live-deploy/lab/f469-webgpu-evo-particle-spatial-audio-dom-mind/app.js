const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const tilesEl = document.getElementById('tiles');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 80;
const particles = [];
const genomes = []; // float[6]: attract, noise, hueBias, pitch, push, birth
let pointer = {x: W/2, y: H/2, down: false};
let likes = [];
let gen = 0;
let avgFitness = 0.5, energy = 0.5;
let audioOn = false;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const panners = [];
const oscs = [];

function randGenome() {
  return [0.5+Math.random()*0.5, Math.random()*0.3, Math.random(), 200+Math.random()*400, Math.random()*2, Math.random()*0.5];
}
function initParticles() {
  particles.length = 0; genomes.length = 0;
  for (let i=0; i<N; i++) {
    particles.push({x: Math.random()*W, y: Math.random()*H, vx:0, vy:0, life:1, fitness:0});
    genomes.push(randGenome());
  }
}
initParticles();

// Tiles
const tileData = [
  {x:100, y:100, text:'Verse seed 1'},
  {x:300, y:200, text:'Living thought'},
  {x:500, y:150, text:'Push me'},
  {x:200, y:400, text:'Evolving field'}
];
function makeTiles() {
  tilesEl.innerHTML = '';
  tileData.forEach((t,i) => {
    const d = document.createElement('div');
    d.className = 'tile';
    d.contentEditable = true;
    d.textContent = t.text;
    d.style.left = t.x + 'px';
    d.style.top = t.y + 'px';
    d.dataset.i = i;
    let drag = false, ox, oy;
    d.onmousedown = e => { drag=true; ox=e.offsetX; oy=e.offsetY; e.stopPropagation(); };
    document.onmousemove = e => { if(drag){ t.x = e.clientX - ox; t.y = e.clientY - oy; d.style.left=t.x+'px'; d.style.top=t.y+'px'; } };
    document.onmouseup = () => drag=false;
    tilesEl.appendChild(d);
  });
}
makeTiles();

// GA
function evolve() {
  const fits = particles.map((p,i) => {
    let f = 0;
    const dx = p.x - pointer.x, dy = p.y - pointer.y;
    const dist = Math.hypot(dx,dy);
    f += Math.max(0, 1 - dist/200) * genomes[i][0]; // attract genome
    likes.forEach(l => { const d=Math.hypot(p.x-l.x, p.y-l.y); f += Math.max(0,1-d/80); });
    f += (1-p.life)*0.1; // survival
    p.fitness = f;
    return f;
  });
  avgFitness = fits.reduce((a,b)=>a+b,0)/N;
  // Tournament
  const nextG = [];
  for (let i=0; i<N; i++) {
    const a = Math.floor(Math.random()*N), b = Math.floor(Math.random()*N);
    const winner = fits[a] > fits[b] ? a : b;
    let g = genomes[winner].slice();
    // mutate
    if (Math.random()<0.3) g[Math.floor(Math.random()*6)] += (Math.random()-0.5)*0.2;
    // clamp
    g[0]=Math.max(0,Math.min(2,g[0])); g[1]=Math.max(0,Math.min(1,g[1])); g[2]=Math.max(0,Math.min(1,g[2]));
    g[3]=Math.max(80,Math.min(800,g[3])); g[4]=Math.max(0,Math.min(5,g[4])); g[5]=Math.max(0,Math.min(1,g[5]));
    nextG.push(g);
  }
  genomes.splice(0,N,...nextG);
  gen++;
}

// Audio
function setupAudio() {
  for (let i=0; i<16; i++) {
    const osc = audioCtx.createOscillator();
    const pan = audioCtx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = 100;
    osc.connect(pan);
    pan.connect(audioCtx.destination);
    osc.start();
    osc.frequency.value = 0;
    oscs.push(osc); panners.push(pan);
  }
}
setupAudio();

function updateAudio() {
  if (!audioOn) return;
  for (let i=0; i<16 && i<particles.length; i++) {
    const p = particles[i];
    const g = genomes[i];
    oscs[i].frequency.setTargetAtTime(g[3] + Math.hypot(p.vx,p.vy)*10, audioCtx.currentTime, 0.05);
    panners[i].positionX.setTargetAtTime((p.x - W/2)/2, audioCtx.currentTime, 0.05);
    panners[i].positionZ.setTargetAtTime((p.y - H/2)/2, audioCtx.currentTime, 0.05);
    panners[i].positionY.setTargetAtTime(0, audioCtx.currentTime, 0.05);
  }
}

// Sim (Canvas2D primary; WebGPU compute path noted for next)
let frame = 0;
function step() {
  frame++;
  if (frame % 120 === 0) evolve();
  energy = 0;
  particles.forEach((p,i) => {
    const g = genomes[i];
    // forces
    let ax = 0, ay = 0;
    const dx = pointer.x - p.x, dy = pointer.y - p.y;
    const d = Math.hypot(dx,dy) || 1;
    ax += (dx/d) * g[0] * 0.8;
    ay += (dy/d) * g[0] * 0.8;
    ax += (Math.random()-0.5) * g[1] * 2;
    ay += (Math.random()-0.5) * g[1] * 2;
    // tilt gravity (simple)
    if (window.tilt) { ax += window.tilt.gamma * 0.01; ay += window.tilt.beta * 0.01; }
    p.vx = p.vx * 0.96 + ax;
    p.vy = p.vy * 0.96 + ay;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx *= -0.5;
    if (p.y<0||p.y>H) p.vy *= -0.5;
    p.x = Math.max(0,Math.min(W,p.x));
    p.y = Math.max(0,Math.min(H,p.y));
    energy += Math.hypot(p.vx,p.vy);
    // push tiles
    tileData.forEach(t => {
      const td = Math.hypot(p.x - (t.x+60), p.y - (t.y+30));
      if (td < 40) {
        const push = g[4] * 0.5;
        t.x += (p.x - (t.x+60)) / td * push;
        t.y += (p.y - (t.y+30)) / td * push;
        const el = tilesEl.children[tileData.indexOf(t)];
        if (el) { el.style.left = t.x+'px'; el.style.top = t.y+'px'; }
      }
    });
  });
  energy = Math.min(1, energy / (N*2));
  updateAudio();
  // chrome
  document.documentElement.style.setProperty('--hue', 180 + avgFitness*120);
  document.documentElement.style.setProperty('--energy', energy);
  document.documentElement.style.setProperty('--fitness', avgFitness);
}

function draw() {
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0,0,W,H);
  particles.forEach((p,i) => {
    const g = genomes[i];
    ctx.beginPath();
    ctx.fillStyle = `hsla(${g[2]*360},70%,60%,0.8)`;
    ctx.arc(p.x, p.y, 3 + p.fitness*2, 0, Math.PI*2);
    ctx.fill();
  });
  likes.forEach(l => {
    ctx.strokeStyle = '#0f0';
    ctx.beginPath(); ctx.arc(l.x,l.y,8,0,Math.PI*2); ctx.stroke();
  });
}

function loop() {
  step();
  draw();
  statusEl.textContent = `Gen ${gen} | avgFit ${avgFitness.toFixed(2)} | energy ${energy.toFixed(2)} | audio ${audioOn?'ON':'OFF'}`;
  requestAnimationFrame(loop);
}
loop();

// Input
canvas.onmousemove = e => { pointer.x = e.clientX; pointer.y = e.clientY; };
canvas.onmousedown = e => {
  pointer.down = true;
  // like nearest
  let best = 0, bd = 1e9;
  particles.forEach((p,i) => {
    const d = Math.hypot(p.x-e.clientX, p.y-e.clientY);
    if (d < bd) { bd=d; best=i; }
  });
  if (bd < 30) likes.push({x:particles[best].x, y:particles[best].y});
  if (likes.length > 8) likes.shift();
};
canvas.onmouseup = () => pointer.down = false;

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    window.tilt = {beta: e.beta||0, gamma: e.gamma||0};
  });
}

// Seal / Restore
const DB = 'f469-verse';
function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB,1);
    r.onupgradeneeded = () => r.result.createObjectStore('seal');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
document.getElementById('seal').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('seal','readwrite');
  tx.objectStore('seal').put({
    genomes: genomes.map(g=>g.slice()),
    particles: particles.map(p=>({x:p.x,y:p.y})),
    tiles: tileData.map(t=>({x:t.x,y:t.y,text:t.text})),
    gen, avgFitness
  }, 'living');
  statusEl.textContent = 'Sealed to IndexedDB';
};
document.getElementById('restore').onclick = async () => {
  const db = await openDB();
  const req = db.transaction('seal').objectStore('seal').get('living');
  req.onsuccess = () => {
    const s = req.result;
    if (!s) return;
    genomes.splice(0,N,...s.genomes);
    s.particles.forEach((p,i) => { if(particles[i]) { particles[i].x=p.x; particles[i].y=p.y; } });
    s.tiles.forEach((t,i) => { if(tileData[i]) { tileData[i].x=t.x; tileData[i].y=t.y; tileData[i].text=t.text; } });
    makeTiles();
    gen = s.gen; avgFitness = s.avgFitness;
    statusEl.textContent = 'Restored living state';
  };
};
document.getElementById('audio').onclick = () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  audioOn = !audioOn;
  if (!audioOn) oscs.forEach(o => o.frequency.setTargetAtTime(0, audioCtx.currentTime, 0.1));
};

// WebGPU note: in supporting browsers a compute pipeline would replace the step() integration with a storage-buffer dispatch; current is Canvas2D for universal runnability.
statusEl.textContent = 'Ready — pointer to attract, click to like, drag tiles, seal to persist';
