const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 64;
const field = new Float32Array(N*N);
for (let i=0;i<field.length;i++) field[i] = Math.random()*0.3;

function tanh(x){ return Math.tanh(x); }
function mlp(w, inp) {
  const h = new Float32Array(12);
  for (let i=0;i<12;i++) {
    let s = w[i];
    for (let j=0;j<8;j++) s += w[12 + i*8 + j] * inp[j];
    h[i] = tanh(s);
  }
  const o = new Float32Array(4);
  for (let i=0;i<4;i++) {
    let s = w[12+12*8 + i];
    for (let j=0;j<12;j++) s += w[12+12*8 + 4 + i*12 + j] * h[j];
    o[i] = tanh(s);
  }
  return o;
}
function randomWeights() {
  const len = 12 + 12*8 + 4 + 4*12; // bias + weights
  const w = new Float32Array(len);
  for (let i=0;i<len;i++) w[i] = (Math.random()-0.5)*0.5;
  return w;
}
function crossover(a, b, rate=0.4) {
  const c = a.slice();
  for (let i=0;i<c.length;i++) if (Math.random()<rate) c[i] = b[i];
  return c;
}

let agents = [];
for (let i=0;i<4;i++) {
  agents.push({
    x: Math.random()*W, y: Math.random()*H,
    vx:0, vy:0, energy:1, fitness:0,
    w: randomWeights(),
    color: `hsl(${i*90},70%,50%)`,
    el: null, id: 'local'+i
  });
}
agents.forEach(a => {
  const el = document.createElement('div');
  el.className = 'agent';
  el.style.background = a.color;
  el.textContent = a.id.slice(-1);
  document.body.appendChild(el);
  a.el = el;
});

let tilt = {x:0,y:0}, pointer = {x:W/2,y:H/2};
addEventListener('deviceorientation', e => { tilt.x = (e.gamma||0)/90; tilt.y = (e.beta||0)/90; });
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

let pc, dc;
function setupPC() {
  pc = new RTCPeerConnection({iceServers:[]});
  dc = pc.createDataChannel('genome', {ordered:true});
  dc.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'genome' && msg.fitness > (agents[0]?.fitness||0)) {
        agents[0].w = new Float32Array(msg.w);
        agents[0].fitness = msg.fitness;
        log('adopted remote genome');
      }
    } catch (err) { console.debug("lab f840-webrtc-peer-sealed-orientation-mlp-arena:", err); }
  };
  pc.onicecandidate = e => { if (e.candidate) log('ice'); };
  pc.ondatachannel = e => { dc = e.channel; };
}
setupPC();

function log(t) { const d = document.getElementById('log'); d.innerHTML = t + '<br>' + d.innerHTML; }

document.getElementById('offer').onclick = async () => {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  document.getElementById('sdp').value = JSON.stringify(pc.localDescription);
  log('offer created');
};
document.getElementById('answer').onclick = async () => {
  const offer = JSON.parse(document.getElementById('sdp').value);
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  document.getElementById('sdp').value = JSON.stringify(pc.localDescription);
  log('answer created');
};
document.getElementById('apply').onclick = async () => {
  const desc = JSON.parse(document.getElementById('sdp').value);
  await pc.setRemoteDescription(desc);
  log('remote applied');
  document.getElementById('status').textContent = 'connected';
};
document.getElementById('seal').onclick = () => {
  const best = agents.reduce((a,b)=> a.fitness>b.fitness?a:b);
  const msg = {type:'genome', w:Array.from(best.w), fitness:best.fitness};
  if (dc && dc.readyState==='open') dc.send(JSON.stringify(msg));
  const req = indexedDB.open('verse-f840',1);
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({id:'best', w:Array.from(best.w), fitness:best.fitness});
  };
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes',{keyPath:'id'});
  log('sealed fitness '+best.fitness.toFixed(2));
};

function sampleField(x,y) {
  const ix = Math.floor(x/W*N), iy = Math.floor(y/H*N);
  if (ix<0||ix>=N||iy<0||iy>=N) return 0;
  return field[iy*N+ix];
}
function deplete(x,y,a=0.05) {
  const ix = Math.floor(x/W*N), iy = Math.floor(y/H*N);
  if (ix>=0&&ix<N&&iy>=0&&iy<N) field[iy*N+ix] = Math.max(0, field[iy*N+ix]-a);
}

function tick() {
  for (let i=0;i<field.length;i++) if (Math.random()<0.01) field[i] += 0.02;
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const img = ctx.createImageData(N,N);
  for (let i=0;i<field.length;i++) {
    const v = Math.min(255, field[i]*800);
    img.data[i*4] = v*0.3; img.data[i*4+1] = v; img.data[i*4+2] = v*0.5; img.data[i*4+3] = 255;
  }
  ctx.putImageData(img,0,0);
  ctx.drawImage(canvas, 0,0,N,N, 0,0,W,H);

  agents.forEach((a,i) => {
    const dens = sampleField(a.x,a.y);
    const dx = (pointer.x - a.x)/W, dy = (pointer.y - a.y)/H;
    const inp = [dens, tilt.x, tilt.y, dx, dy, a.energy, a.fitness*0.1, agents.length*0.1];
    const o = mlp(a.w, inp);
    a.vx += o[0]*2; a.vy += o[1]*2;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x = Math.max(20, Math.min(W-20, a.x + a.vx));
    a.y = Math.max(20, Math.min(H-20, a.y + a.vy));
    a.energy = Math.max(0.1, a.energy + dens*0.1 - 0.005);
    a.fitness += dens * 0.05;
    if (dens > 0.1) deplete(a.x,a.y);
    agents.forEach(b => {
      if (a===b) return;
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if (d < 40 && a.fitness > b.fitness + 0.5) {
        a.w = crossover(a.w, b.w);
        a.fitness += 0.2;
        b.fitness *= 0.7;
        if (dc && dc.readyState==='open') {
          dc.send(JSON.stringify({type:'genome', w:Array.from(a.w), fitness:a.fitness}));
        }
        log('capture '+a.id);
      }
    });
    a.el.style.transform = `translate(${a.x-24}px,${a.y-24}px) scale(${0.8+a.energy*0.4})`;
    a.el.style.opacity = 0.7 + a.fitness*0.05;
  });
  requestAnimationFrame(tick);
}
tick();

indexedDB.open('verse-f840',1).onsuccess = e => {
  const db = e.target.result;
  if (db.objectStoreNames.contains('genomes')) {
    db.transaction('genomes').objectStore('genomes').get('best').onsuccess = ev => {
      if (ev.target.result) {
        agents[0].w = new Float32Array(ev.target.result.w);
        agents[0].fitness = ev.target.result.fitness;
        log('loaded sealed');
      }
    };
  }
};
