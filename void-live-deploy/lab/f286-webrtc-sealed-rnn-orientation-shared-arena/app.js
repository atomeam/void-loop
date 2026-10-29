const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let tilt = {beta:0, gamma:0};
let pointer = {x:W/2, y:H/2, active:false};
const agents = [];
let peer = null, dc = null, connected = false;
const idbName = 'f286-seals';

// Tiny Elman RNN: input[4] (dx,dy to target, tiltx, tilty) -> hidden[4] -> out[2] force
function makeRNN() {
  const h = 4, i = 4, o = 2;
  return {
    Wh: Array.from({length:h*h}, () => (Math.random()-0.5)*0.5),
    Wi: Array.from({length:h*i}, () => (Math.random()-0.5)*0.5),
    Wo: Array.from({length:o*h}, () => (Math.random()-0.5)*0.5),
    bh: Array.from({length:h}, () => 0),
    bo: Array.from({length:o}, () => 0),
    hidden: Array.from({length:h}, () => 0)
  };
}
function stepRNN(rnn, input) {
  const h = 4, i = 4, o = 2;
  const newH = new Array(h);
  for (let j=0; j<h; j++) {
    let s = rnn.bh[j];
    for (let k=0; k<i; k++) s += rnn.Wi[j*i + k] * input[k];
    for (let k=0; k<h; k++) s += rnn.Wh[j*h + k] * rnn.hidden[k];
    newH[j] = Math.tanh(s);
  }
  rnn.hidden = newH;
  const out = new Array(o);
  for (let j=0; j<o; j++) {
    let s = rnn.bo[j];
    for (let k=0; k<h; k++) s += rnn.Wo[j*h + k] * newH[k];
    out[j] = Math.tanh(s);
  }
  return out;
}
function hashGenome(rnn) {
  const str = [...rnn.Wh, ...rnn.Wi, ...rnn.Wo, ...rnn.bh, ...rnn.bo].map(v => v.toFixed(3)).join(',');
  let h = 0;
  for (let i=0; i<str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h.toString(16).slice(0,8);
}
function mutate(rnn, rate=0.15) {
  const clone = JSON.parse(JSON.stringify(rnn));
  const keys = ['Wh','Wi','Wo','bh','bo'];
  keys.forEach(k => {
    clone[k] = clone[k].map(v => v + (Math.random()-0.5)*rate);
  });
  return clone;
}

function makeAgent(x, y, rnn) {
  const a = {
    id: Math.random().toString(36).slice(2,7),
    x, y, vx:0, vy:0, r:12,
    rnn: rnn || makeRNN(),
    score: 0,
    seal: '',
    card: null
  };
  a.seal = hashGenome(a.rnn);
  const card = document.createElement('div');
  card.className = 'agent-card';
  card.innerHTML = `<b>${a.id}</b><br>seal:${a.seal}<br>sc:0`;
  card.style.left = x+'px'; card.style.top = y+'px';
  document.body.appendChild(card);
  a.card = card;
  // drag
  let dragging = false, ox, oy;
  card.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX-a.x; oy=e.clientY-a.y; card.setPointerCapture(e.pointerId); });
  card.addEventListener('pointermove', e => { if(dragging){ a.x=e.clientX-ox; a.y=e.clientY-oy; a.vx=a.vy=0; } });
  card.addEventListener('pointerup', () => dragging=false);
  agents.push(a);
  return a;
}

// Init local agents
for (let i=0; i<4; i++) makeAgent(100+i*80, 200+Math.random()*100);

function updateCards() {
  agents.forEach(a => {
    a.card.style.left = (a.x - 40)+'px';
    a.card.style.top = (a.y - 20)+'px';
    a.card.innerHTML = `<b>${a.id}</b><br>seal:${a.seal.slice(0,6)}<br>sc:${a.score.toFixed(0)}`;
    a.card.classList.toggle('winner', a.score === Math.max(...agents.map(x=>x.score)) && a.score>0);
  });
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now-last)/1000); last=now;
  const gX = tilt.gamma / 90 * 80;
  const gY = tilt.beta / 90 * 80;

  agents.forEach(a => {
    const dx = pointer.x - a.x, dy = pointer.y - a.y;
    const dist = Math.hypot(dx,dy) || 1;
    const input = [dx/dist, dy/dist, tilt.gamma/90, tilt.beta/90];
    const force = stepRNN(a.rnn, input);
    a.vx += (force[0]*60 + gX*0.3 + (dx/dist)*20) * dt;
    a.vy += (force[1]*60 + gY*0.3 + (dy/dist)*20) * dt;
    a.vx *= 0.98; a.vy *= 0.98;
    a.x += a.vx; a.y += a.vy;
    // bounds
    if (a.x < a.r) { a.x=a.r; a.vx*=-0.5; }
    if (a.x > W-a.r) { a.x=W-a.r; a.vx*=-0.5; }
    if (a.y < a.r) { a.y=a.r; a.vy*=-0.5; }
    if (a.y > H-a.r) { a.y=H-a.r; a.vy*=-0.5; }
    // score near pointer
    if (dist < 40) a.score += dt * 10;
  });

  // collisions -> genome transfer
  for (let i=0; i<agents.length; i++) {
    for (let j=i+1; j<agents.length; j++) {
      const a=agents[i], b=agents[j];
      const dx=a.x-b.x, dy=a.y-b.y, d=Math.hypot(dx,dy);
      if (d < a.r+b.r && d>0) {
        const overlap = (a.r+b.r - d)/2;
        a.x += (dx/d)*overlap; b.x -= (dx/d)*overlap;
        a.y += (dy/d)*overlap; b.y -= (dy/d)*overlap;
        // transfer from higher score
        if (a.score > b.score + 2) {
          b.rnn = mutate(a.rnn, 0.2);
          b.seal = hashGenome(b.rnn);
          b.score = Math.max(0, b.score-1);
          if (dc && connected) dc.send(JSON.stringify({type:'genome', to:b.id, genome:b.rnn}));
        } else if (b.score > a.score + 2) {
          a.rnn = mutate(b.rnn, 0.2);
          a.seal = hashGenome(a.rnn);
          a.score = Math.max(0, a.score-1);
          if (dc && connected) dc.send(JSON.stringify({type:'genome', to:a.id, genome:a.rnn}));
        }
      }
    }
  }

  // draw
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(100,200,255,0.15)';
  ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 30, 0, Math.PI*2); ctx.fill();
  agents.forEach(a => {
    ctx.fillStyle = `hsl(${(parseInt(a.seal,16)%360)},70%,60%)`;
    ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '10px system-ui';
    ctx.fillText(a.seal.slice(0,4), a.x-10, a.y+3);
  });
  updateCards();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Orientation
document.getElementById('oriBtn').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => { if(p==='granted') startOri(); }).catch(()=>{});
  } else startOri();
};
function startOri() {
  addEventListener('deviceorientation', e => {
    tilt.beta = e.beta || 0;
    tilt.gamma = e.gamma || 0;
  });
  document.getElementById('status').textContent = 'Orientation active. Tilt to bias forces.';
}
// Pointer
canvas.addEventListener('pointerdown', e => { pointer.active=true; pointer.x=e.clientX; pointer.y=e.clientY; });
canvas.addEventListener('pointermove', e => { if(pointer.active || e.buttons) { pointer.x=e.clientX; pointer.y=e.clientY; } });
canvas.addEventListener('pointerup', () => pointer.active=false);

document.getElementById('addBtn').onclick = () => makeAgent(W/2 + (Math.random()-0.5)*200, H/2, null);

// Seal to IDB
document.getElementById('sealBtn').onclick = async () => {
  const best = agents.reduce((m,a) => a.score > m.score ? a : m, agents[0]);
  if (!best) return;
  const rec = {id:best.id, seal:best.seal, genome:best.rnn, score:best.score, t:Date.now()};
  try {
    const db = await idbOpen();
    const tx = db.transaction('seals','readwrite');
    tx.objectStore('seals').put(rec);
    document.getElementById('status').textContent = `Sealed ${best.seal} to IndexedDB.`;
  } catch(e) { document.getElementById('status').textContent = 'Seal failed (IDB).'; }
};
function idbOpen() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(idbName,1);
    r.onupgradeneeded = () => r.result.createObjectStore('seals',{keyPath:'seal'});
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}

// WebRTC manual signaling
function setupPeer() {
  peer = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  dc = peer.createDataChannel('arena');
  dc.onopen = () => { connected=true; document.getElementById('status').textContent='Peer connected. Syncing genomes.'; };
  dc.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type==='genome') {
        const a = agents.find(x=>x.id===msg.to);
        if (a) { a.rnn = msg.genome; a.seal = hashGenome(a.rnn); }
      }
    } catch{}
  };
  peer.onicecandidate = e => { if(e.candidate) document.getElementById('sdpOut').textContent += '\nICE:'+JSON.stringify(e.candidate); };
}
document.getElementById('offerBtn').onclick = async () => {
  setupPeer();
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  document.getElementById('sdpOut').textContent = JSON.stringify(peer.localDescription);
  document.getElementById('status').textContent = 'Offer created. Copy SDP to peer.';
};
document.getElementById('answerBtn').onclick = async () => {
  if (!peer) setupPeer();
  const offer = JSON.parse(document.getElementById('sdpIn').value);
  await peer.setRemoteDescription(offer);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  document.getElementById('sdpOut').textContent = JSON.stringify(peer.localDescription);
  document.getElementById('status').textContent = 'Answer created. Copy SDP back.';
};
document.getElementById('connectBtn').onclick = async () => {
  if (!peer) setupPeer();
  try {
    const desc = JSON.parse(document.getElementById('sdpIn').value);
    await peer.setRemoteDescription(desc);
    document.getElementById('status').textContent = 'Remote description set. Waiting for channel.';
  } catch(e) { document.getElementById('status').textContent = 'Bad SDP.'; }
};
