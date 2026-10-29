const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let orient = { beta: 0, gamma: 0 };
let hasOrient = false;
window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
  hasOrient = true;
  document.getElementById('status').textContent = `orient β:${orient.beta.toFixed(1)} γ:${orient.gamma.toFixed(1)}`;
});

// Tiny Hebbian network: 4 inputs (local dens, orient, vel) → 2 outputs (force x/y)
// Weights 4x2, updated Hebbian on success (speed toward high dens or something)
class Agent {
  constructor(x, y, id) {
    this.id = id;
    this.x = x; this.y = y;
    this.vx = (Math.random()-0.5)*2; this.vy = (Math.random()-0.5)*2;
    this.w = Array.from({length:4}, () => Array.from({length:2}, () => (Math.random()-0.5)*0.5)); // 4→2
    this.genomeHash = this.seal();
    this.energy = 1;
    this.color = `hsl(${(id*40)%360},70%,60%)`;
    this.el = document.createElement('div');
    this.el.className = 'orb';
    this.el.style.background = this.color;
    document.body.appendChild(this.el);
  }
  seal() {
    // simple hash of weights
    let s = '';
    for (let i=0;i<4;i++) for (let j=0;j<2;j++) s += this.w[i][j].toFixed(4);
    let h = 0; for (let c of s) h = (h*31 + c.charCodeAt(0))|0;
    return (h>>>0).toString(16);
  }
  forward(inputs) {
    // inputs: [localX, localY, betaN, gammaN]
    let ox = 0, oy = 0;
    for (let i=0;i<4;i++) {
      ox += inputs[i] * this.w[i][0];
      oy += inputs[i] * this.w[i][1];
    }
    return [Math.tanh(ox), Math.tanh(oy)];
  }
  hebbianUpdate(inputs, targetForce, lr=0.01) {
    // simple Hebbian: strengthen if input correlated with successful force
    for (let i=0;i<4;i++) {
      this.w[i][0] += lr * inputs[i] * targetForce[0];
      this.w[i][1] += lr * inputs[i] * targetForce[1];
      // clip
      this.w[i][0] = Math.max(-2, Math.min(2, this.w[i][0]));
      this.w[i][1] = Math.max(-2, Math.min(2, this.w[i][1]));
    }
    this.genomeHash = this.seal();
  }
  update(field) {
    const fx = (orient.gamma / 90) * 0.3; // causal orient
    const fy = (orient.beta / 90) * 0.3;
    const lx = (this.x / W - 0.5)*2;
    const ly = (this.y / H - 0.5)*2;
    const inputs = [lx, ly, orient.beta/90, orient.gamma/90];
    const [ax, ay] = this.forward(inputs);
    this.vx += ax * 0.2 + fx;
    this.vy += ay * 0.2 + fy;
    this.vx *= 0.98; this.vy *= 0.98;
    this.x += this.vx; this.y += this.vy;
    if (this.x<10||this.x>W-10) this.vx *= -0.8;
    if (this.y<10||this.y>H-10) this.vy *= -0.8;
    this.x = Math.max(10, Math.min(W-10, this.x));
    this.y = Math.max(10, Math.min(H-10, this.y));
    // Hebbian: reward if moving toward center or high energy area (simple)
    const reward = 1 - Math.hypot(lx, ly);
    this.hebbianUpdate(inputs, [ax * reward, ay * reward]);
    this.el.style.left = (this.x-12)+'px';
    this.el.style.top = (this.y-12)+'px';
    this.el.style.transform = `scale(${0.8 + this.energy*0.4})`;
  }
  collide(other) {
    const dx = this.x - other.x, dy = this.y - other.y;
    const d = Math.hypot(dx, dy);
    if (d < 28 && d > 0) {
      // genome theft: weaker steals from stronger if energy lower
      if (this.energy < other.energy) {
        // copy some weights, seal
        for (let i=0;i<4;i++) for (let j=0;j<2;j++) {
          if (Math.random()<0.3) this.w[i][j] = other.w[i][j];
        }
        this.genomeHash = this.seal();
        this.energy += 0.1;
        other.energy -= 0.05;
      }
      // bounce
      const nx = dx/d, ny = dy/d;
      const dv = (this.vx-other.vx)*nx + (this.vy-other.vy)*ny;
      if (dv < 0) {
        this.vx -= dv * nx; this.vy -= dv * ny;
        other.vx += dv * nx; other.vy += dv * ny;
      }
    }
  }
}

const agents = [];
for (let i=0;i<12;i++) agents.push(new Agent(Math.random()*W, Math.random()*H, i));

let pointer = {x:W/2, y:H/2};
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.2)';
  ctx.fillRect(0,0,W,H);
  // simple field viz
  ctx.strokeStyle = 'rgba(100,100,255,0.15)';
  for (let a of agents) {
    ctx.beginPath(); ctx.arc(a.x, a.y, 40, 0, Math.PI*2); ctx.stroke();
  }
  for (let i=0;i<agents.length;i++) {
    agents[i].update();
    for (let j=i+1;j<agents.length;j++) agents[i].collide(agents[j]);
  }
  // pointer attractor
  ctx.fillStyle = 'rgba(255,255,100,0.3)';
  ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 8, 0, Math.PI*2); ctx.fill();
  requestAnimationFrame(draw);
}
draw();

// persist genomes to IndexedDB on unload (simple)
window.addEventListener('beforeunload', () => {
  const data = agents.map(a => ({id:a.id, w:a.w, h:a.genomeHash}));
  localStorage.setItem('f454-genomes', JSON.stringify(data));
});
// load if present
try {
  const saved = JSON.parse(localStorage.getItem('f454-genomes')||'null'); // void-review: ok (inside a try whose catch keeps the default)
  if (saved) saved.forEach((s,i) => { if (agents[i]) agents[i].w = s.w; });
} catch (e) { console.warn('f454-deviceorient-hebbian-genome-theft:', e); }
