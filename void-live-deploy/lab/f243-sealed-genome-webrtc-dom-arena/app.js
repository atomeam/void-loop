const log = m => { const d=document.getElementById('log'); d.innerHTML += m+'<br>'; d.scrollTop=d.scrollHeight; };
let agents = [], champ = null, wind = {x:0,y:0}, energy = null, pc=null, dc=null, bc=null;
const N = 8, INPUT=5, HIDDEN=8;

function randGenome() {
  const size = (INPUT*HIDDEN) + HIDDEN + (HIDDEN*HIDDEN) + HIDDEN + (HIDDEN*2) + 2;
  const g = new Float32Array(size);
  for (let i=0;i<size;i++) g[i] = (Math.random()-0.5)*0.4;
  return g;
}

function createAgent(i, g) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = i;
  el.style.left = (20+Math.random()*60)+'vw';
  el.style.top = (20+Math.random()*50)+'vh';
  document.body.appendChild(el);
  return { id:i, el, x:parseFloat(el.style.left), y:parseFloat(el.style.top), vx:0, vy:0, hx:new Float32Array(HIDDEN), genome:g||randGenome(), fitness:0 };
}

function rnnStep(a, inp) {
  const g = a.genome;
  let o = 0;
  let hx = 0, hy = 0;
  for (let i=0;i<HIDDEN;i++) {
    let s = g[o++] * inp[0] + g[o++] * inp[1] + g[o++] * inp[2] + g[o++] * inp[3] + g[o++] * inp[4];
    s += g[o++] * a.hx[i];
    a.hx[i] = Math.tanh(s + g[o++]);
    hx += a.hx[i] * g[o++];
    hy += a.hx[i] * g[o++];
  }
  return [hx*0.15, hy*0.15];
}

function step() {
  agents.forEach(a => {
    const dx = energy ? (energy.x - a.x) : 0;
    const dy = energy ? (energy.y - a.y) : 0;
    const dist = Math.hypot(dx,dy)+1;
    const inp = [dx/dist, dy/dist, wind.x, wind.y, a.fitness/100];
    const [ax,ay] = rnnStep(a, inp);
    a.vx = a.vx*0.92 + ax + wind.x*0.3;
    a.vy = a.vy*0.92 + ay + wind.y*0.3;
    a.x = Math.max(2, Math.min(95, a.x + a.vx));
    a.y = Math.max(5, Math.min(90, a.y + a.vy));
    a.el.style.left = a.x+'vw';
    a.el.style.top = a.y+'vh';
    if (energy && dist < 8) { a.fitness += 0.2; a.el.style.boxShadow = '0 0 20px #f84'; }
    else a.el.style.boxShadow = '0 0 12px #4af';
  });
  if (energy && Math.random()<0.01) energy=null;
  requestAnimationFrame(step);
}

async function sealChampion() {
  if (!champ) return;
  const hash = await crypto.subtle.digest('SHA-256', champ.genome);
  const hex = [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  log('Sealed champion fitness='+champ.fitness.toFixed(1)+' hash='+hex.slice(0,12));
  if (dc && dc.readyState==='open') {
    dc.send(JSON.stringify({type:'genome', hash:hex, fitness:champ.fitness, genome:Array.from(champ.genome)}));
    log('Transferred sealed genome');
  }
}

document.getElementById('oriBtn').onclick = () => {
  if (DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => { if(p==='granted') window.addEventListener('deviceorientation', e=>{ wind.x=(e.gamma||0)/45; wind.y=(e.beta||0)/45; }); });
  } else window.addEventListener('deviceorientation', e=>{ wind.x=(e.gamma||0)/45; wind.y=(e.beta||0)/45; });
  log('Orientation armed');
};

document.getElementById('startPeer').onclick = async () => {
  pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  dc = pc.createDataChannel('genomes');
  dc.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.type==='genome') {
      log('Received sealed genome fitness='+msg.fitness);
      const worst = agents.reduce((a,b)=>a.fitness<b.fitness?a:b);
      worst.genome = new Float32Array(msg.genome);
      worst.fitness = 0;
    }
  };
  pc.onicecandidate = e => { if(e.candidate) document.getElementById('sigOut').value += '\n'+JSON.stringify(e.candidate); };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  document.getElementById('sigOut').value = JSON.stringify(offer);
  document.getElementById('signaling').style.display='block';
  document.getElementById('status').textContent='offer ready';
  log('Peer offer created — copy signaling');
};

document.getElementById('applySig').onclick = async () => {
  const raw = document.getElementById('sigIn').value.trim();
  if (!raw) return;
  try {
    const msg = JSON.parse(raw.split('\n')[0]);
    if (msg.type==='offer') {
      await pc.setRemoteDescription(msg);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      document.getElementById('sigOut').value = JSON.stringify(answer);
      log('Answer created');
    } else if (msg.type==='answer') {
      await pc.setRemoteDescription(msg);
      log('Answer applied — channel open');
    } else if (msg.candidate) {
      await pc.addIceCandidate(msg);
    }
  } catch(err) { log('Sig error: '+err.message); }
};

document.getElementById('sealBtn').onclick = () => {
  champ = agents.reduce((a,b)=>a.fitness>b.fitness?a:b);
  sealChampion();
};

document.getElementById('depositBtn').onclick = e => {
  energy = {x: 30+Math.random()*40, y:30+Math.random()*30};
  log('Energy deposited');
};

for (let i=0;i<N;i++) agents.push(createAgent(i));
champ = agents[0];
step();
log('Arena ready. Enable orientation, start peer, place energy, seal & transfer.');
