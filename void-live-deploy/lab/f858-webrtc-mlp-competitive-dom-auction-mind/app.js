const N = 4;
const portals = [];
let orient = {x:0, y:0};
let pointer = {x: innerWidth/2, y: innerHeight/2};
let db;
const channel = new BroadcastChannel('f858-auction');
let peers = new Map();

async function openDB() {
  return new Promise(r => {
    const req = indexedDB.open('verse-f858', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
    req.onsuccess = e => r(e.target.result);
  });
}

function rand(n) { return (Math.random()-0.5)*n; }
function sigmoid(x) { return 1/(1+Math.exp(-x)); }

class MLP {
  constructor() {
    this.w1 = Array.from({length:4*6}, () => rand(1));
    this.b1 = Array.from({length:6}, () => rand(0.5));
    this.w2 = Array.from({length:6*2}, () => rand(1));
    this.b2 = Array.from({length:2}, () => rand(0.5));
  }
  forward(inp) {
    const h = new Array(6).fill(0);
    for (let i=0;i<4;i++) for (let j=0;j<6;j++) h[j] += inp[i]*this.w1[i*6+j];
    for (let j=0;j<6;j++) h[j] = Math.tanh(h[j] + this.b1[j]);
    const o = new Array(2).fill(0);
    for (let j=0;j<6;j++) for (let k=0;k<2;k++) o[k] += h[j]*this.w2[j*2+k];
    return o.map((v,i) => Math.tanh(v + this.b2[i]) * 3);
  }
  clone() {
    const m = new MLP();
    m.w1 = [...this.w1]; m.b1=[...this.b1]; m.w2=[...this.w2]; m.b2=[...this.b2];
    return m;
  }
  serialize() { return {w1:this.w1, b1:this.b1, w2:this.w2, b2:this.b2}; }
  static deserialize(o) {
    const m = new MLP();
    Object.assign(m, o);
    return m;
  }
}

class Agent {
  constructor(id, color) {
    this.id = id;
    this.mlp = new MLP();
    this.x = Math.random()*innerWidth;
    this.y = Math.random()*innerHeight;
    this.vx = 0; this.vy = 0;
    this.fitness = 0;
    this.color = color;
    this.el = document.createElement('div');
    this.el.className = 'portal';
    this.el.style.background = color;
    this.el.textContent = `A${id}`;
    this.el.onclick = () => this.reward(20);
    document.body.appendChild(this.el);
  }
  step() {
    const dx = (pointer.x - this.x)/innerWidth;
    const dy = (pointer.y - this.y)/innerHeight;
    const inp = [dx, dy, orient.x, orient.y];
    const [ovx, ovy] = this.mlp.forward(inp);
    this.vx = this.vx*0.9 + ovx*0.2;
    this.vy = this.vy*0.9 + ovy*0.2;
    this.x = (this.x + this.vx + innerWidth) % innerWidth;
    this.y = (this.y + this.vy + innerHeight) % innerHeight;
    this.el.style.transform = `translate(${this.x-45}px,${this.y-35}px)`;
    const dist = Math.hypot(pointer.x-this.x, pointer.y-this.y);
    if (dist < 80) this.fitness += 0.05;
  }
  reward(v) {
    this.fitness += v;
    if (this.fitness > 30) this.sealAndAuction();
  }
  async sealAndAuction() {
    const data = {id:this.id, fitness:this.fitness, genome:this.mlp.serialize()};
    try {
      const tx = db.transaction('genomes','readwrite');
      tx.objectStore('genomes').put(data, 'best');
    } catch (e) { console.debug("lab f858-webrtc-mlp-competitive-dom-auction-mind:", e); }
    channel.postMessage({type:'auction', ...data});
    this.el.classList.add('winner');
  }
  adopt(genome, fit) {
    if (fit > this.fitness) {
      this.mlp = MLP.deserialize(genome);
      this.fitness = fit * 0.8;
      this.el.classList.add('winner');
      setTimeout(() => this.el.classList.remove('winner'), 1000);
    }
  }
}

async function init() {
  db = await openDB().catch(() => null);
  const colors = ['#4a90e2','#e24a4a','#4ae24a','#e2e24a'];
  for (let i=0;i<N;i++) portals.push(new Agent(i, colors[i]));
  // try load best
  if (db) {
    try {
      const tx = db.transaction('genomes');
      const req = tx.objectStore('genomes').get('best');
      req.onsuccess = () => {
        if (req.result) portals.forEach(p => p.adopt(req.result.genome, req.result.fitness));
      };
    } catch (e) { console.debug("lab f858-webrtc-mlp-competitive-dom-auction-mind:", e); }
  }
  // simple WebRTC signaling via BC for multi-tab
  channel.onmessage = async e => {
    const msg = e.data;
    if (msg.type === 'auction') {
      portals.forEach(p => p.adopt(msg.genome, msg.fitness));
    }
    // stub for real WebRTC offer/answer if desired
  };
  loop();
}

function loop() {
  portals.forEach(a => a.step());
  requestAnimationFrame(loop);
}

addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
addEventListener('deviceorientation', e => {
  orient.x = (e.gamma || 0)/90;
  orient.y = (e.beta || 0)/180;
});
init();
