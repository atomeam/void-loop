const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const sdpBox = document.getElementById('sdp');
const fitEl = document.getElementById('fit');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 6;
const agents = [];
let bestFitness = -Infinity;
let bestWeights = null;
let ori = {beta:0, gamma:0};
let pointer = {x:W/2, y:H/2};

function rand(n) { return (Math.random()-0.5)*n; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

class MLP {
  constructor(w) {
    this.w = w || this.random();
  }
  random() {
    const w = [];
    for(let i=0;i<38;i++) w.push(rand(0.8));
    return w;
  }
  forward(x) {
    const h = new Array(4).fill(0);
    let o = 0;
    for(let i=0;i<4;i++) {
      let s = this.w[o++];
      for(let j=0;j<6;j++) s += this.w[o++]*x[j];
      h[i] = Math.tanh(s);
    }
    const out = [0,0];
    for(let k=0;k<2;k++) {
      let s = this.w[o++];
      for(let i=0;i<4;i++) s += this.w[o++]*h[i];
      out[k] = Math.tanh(s)*0.4;
    }
    return out;
  }
  clone() { return new MLP(this.w.slice()); }
  mutate(rate=0.05) {
    const nw = this.w.map(v => v + rand(rate));
    return new MLP(nw);
  }
}

for(let i=0;i<N;i++) {
  agents.push({
    x: Math.random()*W, y: Math.random()*H,
    vx:0, vy:0,
    mlp: new MLP(),
    fitness: 0,
    color: `hsl(${i*60},70%,60%)`
  });
}
bestWeights = agents[0].mlp.w.slice();

function loadSeal() {
  try {
    const s = localStorage.getItem('verse-f708-genome');
    if(s) {
      const data = JSON.parse(s);
      bestWeights = data.w;
      bestFitness = data.f || 0;
      agents.forEach(a => a.mlp = new MLP(bestWeights.slice()));
      status.textContent = 'Restored sealed genome';
    }
  } catch (e) { console.debug("lab f708-webrtc-peer-mlp-orientation-canvas:", e); }
}
loadSeal();

window.addEventListener('deviceorientation', e => {
  ori.beta = (e.beta||0)/90;
  ori.gamma = (e.gamma||0)/90;
});
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

canvas.addEventListener('click', e => {
  let best = null, bd = 1e9;
  agents.forEach(a => {
    const d = Math.hypot(a.x-e.clientX, a.y-e.clientY);
    if(d<bd && d<40) { bd=d; best=a; }
  });
  if(best) {
    best.fitness += 5;
    if(best.fitness > bestFitness) {
      bestFitness = best.fitness;
      bestWeights = best.mlp.w.slice();
    }
  }
});

document.getElementById('sealBtn').onclick = () => {
  if(bestWeights) {
    localStorage.setItem('verse-f708-genome', JSON.stringify({w:bestWeights, f:bestFitness}));
    status.textContent = 'Sealed to localStorage';
  }
};
document.getElementById('resetBtn').onclick = () => {
  agents.forEach(a => { a.mlp = new MLP(); a.fitness=0; a.x=Math.random()*W; a.y=Math.random()*H; });
  bestFitness = -Infinity;
  status.textContent = 'Reset';
};

let pc, dc;
const iceServers = [{urls:'stun:stun.l.google.com:19302'}];

async function createOffer() {
  pc = new RTCPeerConnection({iceServers});
  dc = pc.createDataChannel('genome');
  setupChannel(dc);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  pc.onicecandidate = e => { if(!e.candidate) sdpBox.value = JSON.stringify(pc.localDescription); };
  status.textContent = 'Offer generated — copy SDP, paste on peer, then Paste Answer here';
}
document.getElementById('offerBtn').onclick = createOffer;

async function pasteAnswer() {
  if(!pc) { status.textContent = 'Generate Offer first'; return; }
  try {
    const ans = JSON.parse(sdpBox.value);
    await pc.setRemoteDescription(ans);
    status.textContent = 'Answer set — connecting…';
  } catch(e) { status.textContent = 'Invalid SDP'; }
}

function setupChannel(channel) {
  channel.onopen = () => {
    status.textContent = 'Peer connected — genomes can transfer';
    sendGenome();
  };
  channel.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);
      if(msg.f > bestFitness) {
        bestFitness = msg.f;
        bestWeights = msg.w;
        agents.forEach(a => a.mlp = new MLP(msg.w).mutate(0.03));
        status.textContent = 'Adopted better peer genome';
      }
    } catch (err) { console.debug("lab f708-webrtc-peer-mlp-orientation-canvas:", err); }
  };
}

function sendGenome() {
  if(dc && dc.readyState==='open' && bestWeights) {
    dc.send(JSON.stringify({w:bestWeights, f:bestFitness}));
  }
}
setInterval(sendGenome, 2000);

document.getElementById('answerBtn').onclick = async () => {
  if(pc) { await pasteAnswer(); return; }
  try {
    const offer = JSON.parse(sdpBox.value);
    pc = new RTCPeerConnection({iceServers});
    pc.ondatachannel = e => { dc = e.channel; setupChannel(dc); };
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    pc.onicecandidate = e => { if(!e.candidate) sdpBox.value = JSON.stringify(pc.localDescription); };
    status.textContent = 'Answer generated — copy back to first peer';
  } catch(e) { status.textContent = 'Paste a valid offer first'; }
};

function step() {
  const ox = ori.gamma || (pointer.x/W - 0.5)*2;
  const oy = ori.beta || (pointer.y/H - 0.5)*2;
  agents.forEach((a,i) => {
    let ndx=0, ndy=0, md=1e9;
    agents.forEach((b,j) => {
      if(i===j) return;
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if(d<md && d>1) { md=d; ndx=(b.x-a.x)/md; ndy=(b.y-a.y)/md; }
    });
    const inp = [ox, oy, ndx, ndy, a.vx*0.1, a.vy*0.1];
    const acc = a.mlp.forward(inp);
    a.vx += acc[0]; a.vy += acc[1];
    a.vx *= 0.92; a.vy *= 0.92;
    a.x += a.vx; a.y += a.vy;
    if(a.x<10||a.x>W-10) a.vx *= -0.5;
    if(a.y<10||a.y>H-10) a.vy *= -0.5;
    a.x = clamp(a.x,5,W-5); a.y = clamp(a.y,5,H-5);
    a.fitness *= 0.995;
  });
  ctx.fillStyle = '#050510';
  ctx.fillRect(0,0,W,H);
  agents.forEach(a => {
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 12 + a.fitness*0.2, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '10px system-ui';
    ctx.fillText(a.fitness.toFixed(1), a.x-10, a.y+4);
  });
  fitEl.textContent = 'Best Fitness: ' + bestFitness.toFixed(1);
  requestAnimationFrame(step);
}
step();
