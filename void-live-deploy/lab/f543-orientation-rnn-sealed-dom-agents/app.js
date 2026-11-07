const stage = document.getElementById('stage');
const status = document.getElementById('status');
const N = 6;
const agents = [];
let orient = {a:0, b:0, g:0};
let hasOrient = false;
const bc = new BroadcastChannel('verse-agents-f543');

function rand(min,max){return Math.random()*(max-min)+min;}

class Agent {
  constructor(i) {
    this.id = i;
    this.el = document.createElement('div');
    this.el.className = 'agent';
    this.el.innerHTML = `<div class="id">Agent ${i}</div><div class="energy">E:1.0</div>`; // void-review: ok (built from this file's own constants and numbers, no visitor text)
    stage.appendChild(this.el);
    this.x = rand(50, window.innerWidth-150);
    this.y = rand(50, window.innerHeight-150);
    this.vx = 0; this.vy = 0;
    this.energy = 1.0;
    // Tiny Elman RNN: input 6 (orient + vel + pos norm), hidden 8, out 2
    this.Whh = Array.from({length:8}, () => Array.from({length:8}, () => rand(-0.3,0.3)));
    this.Wxh = Array.from({length:8}, () => Array.from({length:6}, () => rand(-0.3,0.3)));
    this.Why = Array.from({length:2}, () => Array.from({length:8}, () => rand(-0.3,0.3)));
    this.h = Array(8).fill(0);
    this.cooldown = 0;
  }
  step(dt) {
    if (this.cooldown > 0) this.cooldown--;
    // Input vector
    const nx = this.x / window.innerWidth;
    const ny = this.y / window.innerHeight;
    const inp = [orient.a/180, orient.b/90, orient.g/90, this.vx*0.1, this.vy*0.1, (nx+ny)*0.5];
    // RNN step
    const nh = Array(8).fill(0);
    for (let i=0;i<8;i++) {
      let s = 0;
      for (let j=0;j<8;j++) s += this.Whh[i][j] * this.h[j];
      for (let j=0;j<6;j++) s += this.Wxh[i][j] * inp[j];
      nh[i] = Math.tanh(s);
    }
    this.h = nh;
    let ox=0, oy=0;
    for (let i=0;i<8;i++) {
      ox += this.Why[0][i] * this.h[i];
      oy += this.Why[1][i] * this.h[i];
    }
    this.vx += ox * 0.4 * dt;
    this.vy += oy * 0.4 * dt;
    // Damping
    this.vx *= 0.98; this.vy *= 0.98;
    this.x += this.vx; this.y += this.vy;
    // Bounds
    if (this.x < 0 || this.x > window.innerWidth-120) this.vx *= -0.8;
    if (this.y < 0 || this.y > window.innerHeight-80) this.vy *= -0.8;
    this.x = Math.max(0, Math.min(window.innerWidth-120, this.x));
    this.y = Math.max(0, Math.min(window.innerHeight-80, this.y));
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    this.el.style.transform = `rotate(${this.vx*2}deg)`;
    this.el.querySelector('.energy').textContent = `E:${this.energy.toFixed(2)}`;
    this.el.style.borderColor = `hsl(${this.energy*120},70%,60%)`;
  }
  seal() {
    const genome = {
      id: this.id,
      Whh: this.Whh.map(r => r.map(v => +v.toFixed(3))),
      energy: this.energy,
      ts: Date.now()
    };
    const key = `seal-${this.id}-${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(genome)); // IndexedDB preferred but LS for simplicity; note in SPEC
    return genome;
  }
}

function collide() {
  for (let i=0;i<N;i++) for (let j=i+1;j<N;j++) {
    const a = agents[i], b = agents[j];
    if (a.cooldown>0 || b.cooldown>0) continue;
    if (Math.abs(a.x-b.x)<110 && Math.abs(a.y-b.y)<70) {
      // Transfer: higher energy absorbs fragment
      const winner = a.energy > b.energy ? a : b;
      const loser = winner === a ? b : a;
      // Simple transfer: average some weights
      for (let k=0;k<2;k++) for (let m=0;m<8;m++) {
        winner.Why[k][m] = 0.7*winner.Why[k][m] + 0.3*loser.Why[k][m];
      }
      winner.energy = Math.min(2, winner.energy + 0.1);
      loser.energy = Math.max(0.2, loser.energy - 0.05);
      a.cooldown = b.cooldown = 30;
      const seal = winner.seal();
      bc.postMessage({type:'transfer', winner:winner.id, seal});
      status.textContent = `Transfer: ${winner.id} absorbed from ${loser.id}`;
    }
  }
}

function loop() {
  const dt = 1;
  agents.forEach(a => a.step(dt));
  collide();
  requestAnimationFrame(loop);
}

for (let i=0;i<N;i++) agents.push(new Agent(i));
loop();

document.getElementById('perm').onclick = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    const p = await DeviceOrientationEvent.requestPermission();
    if (p === 'granted') startOrient();
  } else {
    startOrient();
  }
};
function startOrient() {
  hasOrient = true;
  status.textContent = 'Orientation active';
  window.addEventListener('deviceorientation', e => {
    orient.a = e.alpha || 0;
    orient.b = e.beta || 0;
    orient.g = e.gamma || 0;
  });
}
// Fallback: pointer as synthetic orient
stage.onpointermove = e => {
  if (!hasOrient) {
    orient.a = (e.clientX / window.innerWidth - 0.5) * 180;
    orient.b = (e.clientY / window.innerHeight - 0.5) * 90;
    orient.g = 0;
  }
};
document.getElementById('seal').onclick = () => {
  agents.forEach(a => a.seal());
  status.textContent = 'All genomes sealed to localStorage';
};
bc.onmessage = e => {
  if (e.data.type === 'transfer') status.textContent = `Remote transfer from tab: agent ${e.data.winner}`;
};
