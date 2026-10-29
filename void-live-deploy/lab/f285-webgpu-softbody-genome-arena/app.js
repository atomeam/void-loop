const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_AGENTS = 5;
const GRID = 4; // 4x4 points per softbody
const POINTS = GRID * GRID;
const SPRING_REST = 18;

let resource = { x: W/2, y: H/2, vx:0, vy:0 };
let mouse = { x: W/2, y: H/2 };
let agents = [];
let pins = [];
let db = null;
let frame = 0;

function rand(a=0,b=1){ return a + Math.random()*(b-a); }
function hashGenome(g) {
  let h = 5381;
  for (let v of g) h = ((h << 5) + h) ^ (v * 1000 | 0);
  return (h >>> 0).toString(16).slice(0,6);
}

function createAgent(x, y, genome=null) {
  const g = genome || new Float32Array([
    rand(0.4,1.2), // stiffness
    rand(0.6,0.95), // damp
    rand(0.3,1.5), // attract
    rand(0.0,0.4), // noise
    rand(0.2,0.8), // cohesion
    rand(0.8,1.4)  // size bias
  ]);
  const points = [];
  const size = 22 * g[5];
  for (let j=0; j<GRID; j++) for (let i=0; i<GRID; i++) {
    points.push({
      x: x + (i-1.5)*size*0.6,
      y: y + (j-1.5)*size*0.6,
      px: x + (i-1.5)*size*0.6,
      py: y + (j-1.5)*size*0.6,
      pinned: false
    });
  }
  return { points, genome: g, fitness: 1, energy: 50, id: hashGenome(g), hue: rand(180,300) };
}

function initAgents() {
  agents = [];
  for (let i=0; i<N_AGENTS; i++) {
    agents.push(createAgent(rand(100,W-100), rand(100,H-100)));
  }
  updatePins();
}

function updatePins() {
  // recreate pin cards
  document.querySelectorAll('.pin-card').forEach(el => el.remove());
  pins = agents.map((a, i) => {
    const el = document.createElement('div');
    el.className = 'pin-card';
    el.textContent = a.id + ' ' + a.fitness.toFixed(1);
    el.dataset.i = i;
    document.body.appendChild(el);
    let dragging = false, ox=0, oy=0;
    el.onpointerdown = e => { dragging=true; ox=e.clientX-parseFloat(el.style.left||0); oy=e.clientY-parseFloat(el.style.top||0); el.setPointerCapture(e.pointerId); };
    el.onpointermove = e => {
      if (!dragging) return;
      const nx = e.clientX - ox, ny = e.clientY - oy;
      el.style.left = nx + 'px'; el.style.top = ny + 'px';
      // pin the center point of the agent
      const p = a.points[Math.floor(POINTS/2)];
      p.x = nx + 30; p.y = ny + 10; p.px = p.x; p.py = p.y; p.pinned = true;
    };
    el.onpointerup = () => { dragging=false; a.points.forEach(p=>p.pinned=false); };
    return el;
  });
}

function integrate() {
  resource.vx += (mouse.x - resource.x)*0.08;
  resource.vy += (mouse.y - resource.y)*0.08;
  resource.vx *= 0.85; resource.vy *= 0.85;
  resource.x += resource.vx; resource.y += resource.vy;

  for (const a of agents) {
    const g = a.genome;
    const stiff = g[0], damp = g[1], attract = g[2], noise = g[3], coh = g[4];
    // Verlet + springs
    for (let pi=0; pi<POINTS; pi++) {
      const p = a.points[pi];
      if (p.pinned) continue;
      let vx = (p.x - p.px)*damp, vy = (p.y - p.py)*damp;
      // attraction to resource
      const dx = resource.x - p.x, dy = resource.y - p.y;
      const d = Math.hypot(dx,dy)+1;
      vx += (dx/d)*attract*0.4;
      vy += (dy/d)*attract*0.4;
      // noise
      vx += (Math.random()-0.5)*noise;
      vy += (Math.random()-0.5)*noise;
      // cohesion to centroid
      let cx=0,cy=0; a.points.forEach(q=>{cx+=q.x;cy+=q.y;});
      cx/=POINTS; cy/=POINTS;
      vx += (cx-p.x)*coh*0.05; vy += (cy-p.y)*coh*0.05;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy;
      // bounds
      if (p.x<20||p.x>W-20) p.x = p.px;
      if (p.y<20||p.y>H-20) p.y = p.py;
    }
    // springs
    for (let j=0; j<GRID; j++) for (let i=0; i<GRID; i++) {
      const idx = j*GRID+i;
      const p = a.points[idx];
      const neighbors = [];
      if (i<GRID-1) neighbors.push(a.points[idx+1]);
      if (j<GRID-1) neighbors.push(a.points[idx+GRID]);
      for (const n of neighbors) {
        const dx = n.x-p.x, dy=n.y-p.y;
        const dist = Math.hypot(dx,dy)||1;
        const diff = (dist - SPRING_REST*g[5]*0.8)/dist * stiff * 0.5;
        if (!p.pinned) { p.x += dx*diff; p.y += dy*diff; }
        if (!n.pinned) { n.x -= dx*diff; n.y -= dy*diff; }
      }
    }
    // fitness from proximity
    let cx=0,cy=0; a.points.forEach(p=>{cx+=p.x;cy+=p.y;});
    cx/=POINTS; cy/=POINTS;
    const distR = Math.hypot(cx-resource.x, cy-resource.y);
    a.energy = Math.max(0, a.energy + (80-distR)*0.02);
    a.fitness = a.energy * 0.1 + (100/(distR+10));
  }
  // genome transfer on contact
  for (let i=0; i<agents.length; i++) for (let j=i+1; j<agents.length; j++) {
    const A = agents[i], B = agents[j];
    let acx=0,acy=0,bcx=0,bcy=0;
    A.points.forEach(p=>{acx+=p.x;acy+=p.y;});
    B.points.forEach(p=>{bcx+=p.x;bcy+=p.y;});
    acx/=POINTS; acy/=POINTS; bcx/=POINTS; bcy/=POINTS;
    if (Math.hypot(acx-bcx,acy-bcy) < 50) {
      const winner = A.fitness > B.fitness ? A : B;
      const loser = winner === A ? B : A;
      for (let k=0; k<6; k++) {
        winner.genome[k] = winner.genome[k]*0.65 + loser.genome[k]*0.35 + (Math.random()-0.5)*0.05;
        winner.genome[k] = Math.max(0.1, Math.min(2, winner.genome[k]));
      }
      winner.id = hashGenome(winner.genome);
      loser.energy *= 0.85;
    }
  }
  // update pin labels & positions
  agents.forEach((a,i) => {
    if (!pins[i]) return;
    let cx=0,cy=0; a.points.forEach(p=>{cx+=p.x;cy+=p.y;});
    cx/=POINTS; cy/=POINTS;
    pins[i].style.left = (cx-30)+'px';
    pins[i].style.top = (cy-15)+'px';
    pins[i].textContent = a.id + ' ' + a.fitness.toFixed(1);
  });
}

function draw() {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0,0,W,H);
  // resource
  ctx.beginPath(); ctx.arc(resource.x, resource.y, 12, 0, Math.PI*2);
  ctx.fillStyle = '#ffaa33'; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth=2; ctx.stroke();
  // softbodies
  for (const a of agents) {
    ctx.strokeStyle = `hsl(${a.hue},70%,60%)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let j=0; j<GRID; j++) for (let i=0; i<GRID; i++) {
      const p = a.points[j*GRID+i];
      if (i>0) {
        const prev = a.points[j*GRID+i-1];
        ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y);
      }
      if (j>0) {
        const up = a.points[(j-1)*GRID+i];
        ctx.moveTo(up.x, up.y); ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
    // points
    ctx.fillStyle = `hsl(${a.hue},80%,70%)`;
    for (const p of a.points) {
      ctx.beginPath(); ctx.arc(p.x,p.y,2.5,0,Math.PI*2); ctx.fill();
    }
  }
}

function loop() {
  frame++;
  integrate();
  draw();
  requestAnimationFrame(loop);
}

// IndexedDB
const req = indexedDB.open('F285soft', 1);
req.onupgradeneeded = e => {
  db = e.target.result;
  if (!db.objectStoreNames.contains('pop')) db.createObjectStore('pop');
};
req.onsuccess = e => { db = e.target.result; };
function seal() {
  if (!db) { document.getElementById('status').textContent = 'No IndexedDB'; return; }
  const data = agents.map(a => ({ genome: Array.from(a.genome), fitness: a.fitness }));
  const tx = db.transaction('pop','readwrite');
  tx.objectStore('pop').put(data, 'pop');
  document.getElementById('status').textContent = 'Sealed ' + agents.length + ' genomes';
}
function load() {
  if (!db) return;
  const tx = db.transaction('pop','readonly');
  const g = tx.objectStore('pop').get('pop');
  g.onsuccess = e => {
    if (e.target.result) {
      agents = e.target.result.map(d => createAgent(rand(100,W-100), rand(100,H-100), new Float32Array(d.genome)));
      updatePins();
      document.getElementById('status').textContent = 'Loaded population';
    }
  };
}

canvas.onpointermove = e => { mouse.x = e.clientX; mouse.y = e.clientY; };
document.getElementById('seal').onclick = seal;
document.getElementById('load').onclick = load;
document.getElementById('reset').onclick = () => { initAgents(); };

initAgents();
loop();
