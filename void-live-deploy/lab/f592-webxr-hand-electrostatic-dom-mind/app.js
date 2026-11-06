const status = document.getElementById('status');
const portals = [];
const N = 8;
let handPos = {x:0, y:0, active:false};
let sealStore = null;
let genomes = [];

// Simple local linear models per agent: charge strength, polarity, damping
function randomGenome() {
  return {
    charge: (Math.random()-0.5)*2,
    polarity: Math.random() > 0.5 ? 1 : -1,
    damp: 0.85 + Math.random()*0.1,
    fitness: 0
  };
}

function createPortal(i, g) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'A' + i;
  el.style.left = (20 + Math.random()*60) + 'vw';
  el.style.top = (20 + Math.random()*50) + 'vh';
  el.style.background = `hsl(${(i*40)%360},70%,40%)`;
  document.body.appendChild(el);
  return {el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0, genome: g || randomGenome(), id:i};
}

for(let i=0;i<N;i++) portals.push(createPortal(i));

// Pointer / mouse as hand fallback
window.addEventListener('pointermove', e => {
  handPos.x = e.clientX / window.innerWidth;
  handPos.y = e.clientY / window.innerHeight;
  handPos.active = true;
});

// WebXR hand tracking attempt (progressive)
async function tryWebXR() {
  if (!navigator.xr) return;
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['hand-tracking']});
    status.textContent = 'WebXR active';
    // Simplified: in real XR we'd poll joint poses; here we keep pointer as proxy for demo
  } catch(e) { status.textContent = 'WebXR unavailable, using pointer'; }
}
document.body.addEventListener('click', tryWebXR, {once:true});

// Physics: electrostatic between portals + hand charge
function step() {
  const w = window.innerWidth, h = window.innerHeight;
  const handCharge = handPos.active ? 1.5 : 0;
  const hx = handPos.x * w, hy = handPos.y * h;

  for(const p of portals) {
    let fx=0, fy=0;
    // Hand interaction
    const dxh = hx - (p.x/100*w), dyh = hy - (p.y/100*h);
    const dh2 = dxh*dxh + dyh*dyh + 100;
    const fh = handCharge * p.genome.polarity / dh2;
    fx += fh * dxh; fy += fh * dyh;

    // Portal-portal
    for(const q of portals) {
      if(p===q) continue;
      const dx = (q.x - p.x)/100*w, dy = (q.y - p.y)/100*h;
      const d2 = dx*dx + dy*dy + 400;
      const f = p.genome.charge * q.genome.charge * p.genome.polarity * q.genome.polarity / d2;
      fx += f * dx; fy += f * dy;
    }
    p.vx = (p.vx + fx*0.002) * p.genome.damp;
    p.vy = (p.vy + fy*0.002) * p.genome.damp;
    p.x = Math.max(5, Math.min(90, p.x + p.vx));
    p.y = Math.max(5, Math.min(85, p.y + p.vy));
    p.el.style.left = p.x + 'vw';
    p.el.style.top = p.y + 'vh';
    p.el.style.transform = `scale(${1 + Math.abs(p.genome.charge)*0.3}) rotate(${p.vx*20}deg)`;
    p.el.style.filter = `hue-rotate(${p.genome.polarity*30}deg)`;
  }
  requestAnimationFrame(step);
}
step();

// Reward / fitness
document.body.addEventListener('click', e => {
  const t = e.target.closest('.portal');
  if(!t) return;
  const p = portals.find(x => x.el === t);
  if(p) { p.genome.fitness += 1; p.el.style.boxShadow = '0 0 20px gold'; setTimeout(()=>p.el.style.boxShadow='',800); }
});

// Seal / restore
document.addEventListener('keydown', e => {
  if(e.key==='s' || e.key==='S') {
    const data = portals.map(p => ({id:p.id, genome:p.genome, x:p.x, y:p.y}));
    localStorage.setItem('verse-f592', JSON.stringify(data));
    status.textContent = 'Sealed to localStorage';
  }
  if(e.key==='r' || e.key==='R') {
    const raw = localStorage.getItem('verse-f592');
    if(raw) {
      const data = JSON.parse(raw);
      data.forEach(d => {
        const p = portals.find(x=>x.id===d.id);
        if(p) { Object.assign(p.genome, d.genome); p.x=d.x; p.y=d.y; }
      });
      status.textContent = 'Restored sealed genomes';
    }
  }
});

// BroadcastChannel for multi-tab genome transfer
const bc = new BroadcastChannel('f592-genome');
bc.onmessage = ev => {
  if(ev.data.type==='seal' && ev.data.fitness > Math.max(...portals.map(p=>p.genome.fitness))) {
    // adopt higher fitness genome into a random portal
    const target = portals[Math.floor(Math.random()*portals.length)];
    Object.assign(target.genome, ev.data.genome);
    status.textContent = 'Adopted peer genome';
  }
};
setInterval(() => {
  const best = portals.reduce((a,b)=> a.genome.fitness > b.genome.fitness ? a : b);
  if(best.genome.fitness > 2) bc.postMessage({type:'seal', genome:best.genome, fitness:best.genome.fitness});
}, 3000);

status.textContent = 'ready — tilt/move pointer, click portals, S seal';
