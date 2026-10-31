const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let tilt = {x:0, y:0};
let pointer = {x:W/2, y:H/2, down:false};
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
addEventListener('pointerdown', e => { pointer.down = true; });
addEventListener('pointerup', e => { pointer.down = false; });

document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => { if (p==='granted') startOrient(); }).catch(()=>{});
  } else startOrient();
};
function startOrient() {
  addEventListener('deviceorientation', e => {
    tilt.x = (e.gamma || 0) / 45;
    tilt.y = (e.beta || 0) / 45;
  });
  document.getElementById('status').textContent = 'Orientation active. Tilt to bias forces.';
}

// Expression tree: simple recursive structure
function randomExpr(depth=0) {
  if (depth > 3 || Math.random() < 0.4) {
    const leaves = ['tilt.x','tilt.y','pos.x','pos.y','vel.x','vel.y','t','0.5','-0.5','1','-1'];
    return {op:'leaf', val: leaves[Math.floor(Math.random()*leaves.length)] };
  }
  const ops = ['+','-','*','sin','abs'];
  const op = ops[Math.floor(Math.random()*ops.length)];
  if (op === 'sin' || op === 'abs') return {op, a: randomExpr(depth+1)};
  return {op, a: randomExpr(depth+1), b: randomExpr(depth+1)};
}
function evalExpr(node, ctx) {
  if (!node) return 0;
  if (node.op === 'leaf') {
    const v = node.val;
    if (v==='tilt.x') return ctx.tilt.x;
    if (v==='tilt.y') return ctx.tilt.y;
    if (v==='pos.x') return ctx.pos.x / W - 0.5;
    if (v==='pos.y') return ctx.pos.y / H - 0.5;
    if (v==='vel.x') return ctx.vel.x;
    if (v==='vel.y') return ctx.vel.y;
    if (v==='t') return Math.sin(ctx.t * 0.01);
    return parseFloat(v) || 0;
  }
  const a = evalExpr(node.a, ctx);
  if (node.op === 'sin') return Math.sin(a);
  if (node.op === 'abs') return Math.abs(a);
  const b = evalExpr(node.b, ctx);
  if (node.op === '+') return a + b;
  if (node.op === '-') return a - b;
  if (node.op === '*') return a * b;
  return 0;
}
function cloneExpr(n) { return JSON.parse(JSON.stringify(n)); }
function exprHash(n) { return btoa(JSON.stringify(n)).slice(0,8); }

class Agent {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = (Math.random()-0.5)*2; this.vy = (Math.random()-0.5)*2;
    this.exprX = randomExpr();
    this.exprY = randomExpr();
    this.fitness = 0;
    this.sealed = false;
    this.id = Math.random().toString(36).slice(2,7);
    this.color = `hsl(${Math.random()*360},70%,60%)`;
    this.r = 8;
  }
  step(t) {
    const ctx = {tilt, pos:{x:this.x,y:this.y}, vel:{x:this.vx,y:this.vy}, t};
    let fx = evalExpr(this.exprX, ctx) * 0.15;
    let fy = evalExpr(this.exprY, ctx) * 0.15;
    // orientation gravity bias
    fx += tilt.x * 0.08;
    fy += tilt.y * 0.08;
    // pointer attract if down
    if (pointer.down) {
      const dx = pointer.x - this.x, dy = pointer.y - this.y;
      const d = Math.hypot(dx,dy)+1;
      fx += dx/d * 0.4; fy += dy/d * 0.4;
    }
    this.vx = this.vx * 0.95 + fx;
    this.vy = this.vy * 0.95 + fy;
    this.x += this.vx; this.y += this.vy;
    // bounds
    if (this.x < this.r || this.x > W-this.r) this.vx *= -0.8;
    if (this.y < this.r || this.y > H-this.r) this.vy *= -0.8;
    this.x = Math.max(this.r, Math.min(W-this.r, this.x));
    this.y = Math.max(this.r, Math.min(H-this.r, this.y));
    // fitness: low speed + center
    const speed = Math.hypot(this.vx, this.vy);
    const distC = Math.hypot(this.x-W/2, this.y-H/2) / Math.hypot(W,H);
    this.fitness = this.fitness * 0.99 + (1 - Math.min(speed/5,1)) * 0.5 + (1-distC)*0.5;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
    ctx.fillStyle = this.sealed ? '#fff' : this.color;
    ctx.fill();
    ctx.strokeStyle = this.sealed ? '#0f0' : '#fff3';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '9px sans-serif';
    ctx.fillText(this.id + (this.sealed?'★':''), this.x-10, this.y-12);
    ctx.fillText(this.fitness.toFixed(2), this.x-10, this.y+20);
  }
}

let agents = [];
function spawn(n=12) {
  agents = [];
  for (let i=0; i<n; i++) agents.push(new Agent(Math.random()*W, Math.random()*H));
}
spawn();

document.getElementById('reset').onclick = () => spawn();
document.getElementById('sealAll').onclick = () => {
  const top = agents.reduce((a,b)=> a.fitness>b.fitness?a:b);
  top.sealed = true;
  sealToIDB(top);
};

function sealToIDB(agent) {
  const dbReq = indexedDB.open('verse-f468', 1);
  dbReq.onupgradeneeded = e => e.target.result.createObjectStore('seals', {keyPath:'id'});
  dbReq.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('seals','readwrite');
    tx.objectStore('seals').put({id: agent.id, exprX: agent.exprX, exprY: agent.exprY, fitness: agent.fitness, hash: exprHash(agent.exprX)+exprHash(agent.exprY)});
    document.getElementById('status').textContent = `Sealed ${agent.id} hash ${exprHash(agent.exprX)}`;
  };
}

// Collision genome transfer
function checkCollisions() {
  for (let i=0; i<agents.length; i++) {
    for (let j=i+1; j<agents.length; j++) {
      const a = agents[i], b = agents[j];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if (d < a.r + b.r + 4) {
        // separate
        const nx = (b.x-a.x)/d, ny = (b.y-a.y)/d;
        a.x -= nx*2; b.x += nx*2;
        // transfer if both sealed, fitter gives tree
        if (a.sealed && b.sealed) {
          if (a.fitness > b.fitness) {
            b.exprX = cloneExpr(a.exprX);
            b.exprY = cloneExpr(a.exprY);
            b.color = a.color;
          } else {
            a.exprX = cloneExpr(b.exprX);
            a.exprY = cloneExpr(b.exprY);
            a.color = b.color;
          }
        }
      }
    }
  }
}

// Click to seal individual
canvas.addEventListener('click', e => {
  const mx = e.clientX, my = e.clientY;
  for (const a of agents) {
    if (Math.hypot(a.x-mx, a.y-my) < a.r+10) {
      a.sealed = true;
      sealToIDB(a);
      break;
    }
  }
});

// WebRTC for sealed genome share
let pc = null, dc = null;
document.getElementById('createOffer').onclick = async () => {
  pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  dc = pc.createDataChannel('genomes');
  dc.onmessage = onGenomeMsg;
  pc.onicecandidate = e => { if (!e.candidate) document.getElementById('sdp').value = JSON.stringify(pc.localDescription); };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  document.getElementById('status').textContent = 'Offer created. Copy SDP to peer.';
};
document.getElementById('pasteAnswer').onclick = async () => {
  if (!pc) {
    pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    pc.ondatachannel = e => { dc = e.channel; dc.onmessage = onGenomeMsg; };
    pc.onicecandidate = e => { if (!e.candidate) document.getElementById('sdp').value = JSON.stringify(pc.localDescription); };
  }
  const sdp = JSON.parse(document.getElementById('sdp').value);
  await pc.setRemoteDescription(sdp);
  if (sdp.type === 'offer') {
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
  }
  document.getElementById('status').textContent = 'WebRTC connecting... share sealed genomes.';
};
function onGenomeMsg(e) {
  const data = JSON.parse(e.data);
  // inject into lowest fitness
  const low = agents.reduce((a,b)=> a.fitness<b.fitness?a:b);
  low.exprX = data.exprX;
  low.exprY = data.exprY;
  low.sealed = true;
  low.color = '#ff0';
  document.getElementById('status').textContent = `Received sealed genome into ${low.id}`;
}
// periodic share top sealed
setInterval(() => {
  if (dc && dc.readyState === 'open') {
    const top = agents.filter(a=>a.sealed).reduce((a,b)=> a&&a.fitness>b.fitness?a:b, null);
    if (top) dc.send(JSON.stringify({exprX:top.exprX, exprY:top.exprY, id:top.id}));
  }
}, 5000);

let t = 0;
function loop() {
  t++;
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  for (const a of agents) a.step(t);
  checkCollisions();
  for (const a of agents) a.draw();
  // pointer
  ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 4, 0, Math.PI*2); ctx.fillStyle='#0ff'; ctx.fill();
  requestAnimationFrame(loop);
}
loop();

// Load any prior seals on start (optional inject)
indexedDB.open('verse-f468',1).onsuccess = e => {
  const db = e.target.result;
  if (db.objectStoreNames.contains('seals')) {
    db.transaction('seals').objectStore('seals').getAll().onsuccess = ev => {
      if (ev.target.result.length) document.getElementById('status').textContent += ` Loaded ${ev.target.result.length} prior seals.`;
    };
  }
};
