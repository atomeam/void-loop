const FIELD = document.getElementById('field');
const AGENTS_EL = document.getElementById('agents');
const STATUS = document.getElementById('status');
const NUM_AGENTS = 3;
const CARDS_PER = 4;

function createRNN(genome) {
  const nIn=6, nH=8, nOut=4;
  const size = nIn*nH + nH*nH + nH*nOut + nH + nOut;
  let w = genome || Array.from({length:size}, ()=> (Math.random()-0.5)*0.4);
  let h = new Float32Array(nH);
  return {
    weights: w,
    step(inp) {
      let idx=0;
      const Whi = w.slice(idx, idx+=nIn*nH);
      const Whh = w.slice(idx, idx+=nH*nH);
      const Who = w.slice(idx, idx+=nH*nOut);
      const bh = w.slice(idx, idx+=nH);
      const bo = w.slice(idx, idx+=nOut);
      const nh = new Float32Array(nH);
      for(let i=0;i<nH;i++){
        let s = bh[i];
        for(let j=0;j<nIn;j++) s += Whi[j*nH+i]*inp[j];
        for(let j=0;j<nH;j++) s += Whh[j*nH+i]*h[j];
        nh[i] = Math.tanh(s);
      }
      h = nh;
      const out = new Float32Array(nOut);
      for(let i=0;i<nOut;i++){
        let s = bo[i];
        for(let j=0;j<nH;j++) s += Who[j*nOut+i]*h[j];
        out[i] = Math.tanh(s)*0.8;
      }
      return out;
    },
    genome(){ return this.weights.slice(); },
    mutate(){
      return this.weights.map(v => v + (Math.random()-0.5)*0.05);
    }
  };
}

class Agent {
  constructor(id, genome) {
    this.id = id;
    this.rnn = createRNN(genome);
    this.cards = [];
    this.fitness = 0;
    this.engagement = 0;
    this.color = `hsl(${(id*137)%360},70%,60%)`;
    for(let i=0;i<CARDS_PER;i++){
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<div class="label">A${id}</div><div class="fitness">f:0</div>`;
      el.style.left = (20+Math.random()*60)+'%';
      el.style.top = (20+Math.random()*50)+'%';
      el.style.borderColor = this.color;
      el.dataset.agent = id;
      el.addEventListener('pointerdown', e => this.dragStart(e, el));
      FIELD.appendChild(el);
      this.cards.push({el, x:parseFloat(el.style.left), y:parseFloat(el.style.top), s:1, hue:0});
    }
  }
  dragStart(e, el) {
    this.engagement += 2;
    const startX = e.clientX, startY = e.clientY;
    const rect = el.getBoundingClientRect();
    const ox = rect.left, oy = rect.top;
    const move = ev => {
      el.style.left = (ox + ev.clientX - startX) + 'px';
      el.style.top = (oy + ev.clientY - startY) + 'px';
      this.engagement += 0.1;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    e.preventDefault();
  }
  step(motion) {
    const inp = [motion.ax||0, motion.ay||0, motion.az||0, motion.gx||0, motion.gy||0, this.engagement*0.01];
    const out = this.rnn.step(inp);
    this.fitness = this.fitness*0.98 + (this.engagement*0.5 - Math.abs(out[0])+Math.abs(out[1]))*0.1;
    this.engagement *= 0.95;
    this.cards.forEach((c,i) => {
      const dx = out[0]*8 + (i-1.5)*0.5;
      const dy = out[1]*8;
      const ds = 1 + out[2]*0.1;
      c.x = Math.max(5, Math.min(85, c.x + dx*0.1));
      c.y = Math.max(5, Math.min(75, c.y + dy*0.1));
      c.el.style.left = c.x + '%';
      c.el.style.top = c.y + '%';
      c.el.style.transform = `scale(${ds}) rotate(${out[3]*15}deg)`;
      c.el.querySelector('.fitness').textContent = 'f:'+this.fitness.toFixed(1);
      if (this.engagement > 1) c.el.classList.add('active'); else c.el.classList.remove('active');
    });
  }
  seal() {
    return { id:this.id, genome:this.rnn.genome(), fitness:this.fitness, ts:Date.now() };
  }
  accept(genome) {
    this.rnn = createRNN(genome.mutate ? genome.mutate() : genome);
    this.fitness = 0;
  }
}

const agents = Array.from({length:NUM_AGENTS}, (_,i)=> new Agent(i));
let active = 0;
let motion = {ax:0,ay:0,az:0,gx:0,gy:0};

function updateAgentsUI() {
  AGENTS_EL.innerHTML = agents.map((a,i)=>`
    <div>A${i} fit:${a.fitness.toFixed(1)} eng:${a.engagement.toFixed(1)}
      <button data-i="${i}">Select</button>
    </div>`).join('');
  AGENTS_EL.querySelectorAll('button').forEach(b=>b.onclick=()=>{active=+b.dataset.i;});
}
updateAgentsUI();

if (window.DeviceMotionEvent) {
  window.addEventListener('devicemotion', e => {
    if (e.accelerationIncludingGravity) {
      motion.ax = e.accelerationIncludingGravity.x||0;
      motion.ay = e.accelerationIncludingGravity.y||0;
      motion.az = e.accelerationIncludingGravity.z||0;
    }
  });
}
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    motion.gx = (e.gamma||0)/90;
    motion.gy = (e.beta||0)/90;
  });
}

function loop() {
  agents.forEach(a => a.step(motion));
  updateAgentsUI();
  requestAnimationFrame(loop);
}
loop();

const DB_NAME = 'f507-verse';
let db;
const req = indexedDB.open(DB_NAME, 1);
req.onupgradeneeded = e => {
  e.target.result.createObjectStore('genomes', {keyPath:'id'});
};
req.onsuccess = e => { db = e.target.result; loadGenomes(); };
function saveGenome(sealed) {
  if (!db) return;
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put(sealed);
}
function loadGenomes() {
  if (!db) return;
  const tx = db.transaction('genomes','readonly');
  tx.objectStore('genomes').getAll().onsuccess = e => {
    (e.target.result||[]).forEach(g => {
      if (agents[g.id]) agents[g.id].accept(g.genome);
    });
  };
}

document.getElementById('sealBtn').onclick = () => {
  const sealed = agents[active].seal();
  saveGenome(sealed);
  STATUS.textContent = `Sealed genome A${active} fit:${sealed.fitness.toFixed(1)} — offer via WebRTC`;
  if (dataChannel && dataChannel.readyState==='open') {
    dataChannel.send(JSON.stringify({type:'genome', payload:sealed}));
  }
};

let pc, dataChannel;
function setupPC(initiator) {
  pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  pc.onicecandidate = e => {
    if (!e.candidate) {
      document.getElementById('localSdp').value = JSON.stringify(pc.localDescription);
    }
  };
  if (initiator) {
    dataChannel = pc.createDataChannel('genome-auction');
    setupChannel(dataChannel);
    pc.createOffer().then(o => pc.setLocalDescription(o));
  } else {
    pc.ondatachannel = e => { dataChannel = e.channel; setupChannel(dataChannel); };
  }
}
function setupChannel(ch) {
  ch.onopen = () => { document.getElementById('rtcStatus').textContent = 'Connected — genomes can flow'; };
  ch.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type==='genome') {
        const weakest = agents.reduce((a,b)=> a.fitness < b.fitness ? a : b);
        weakest.accept(msg.payload.genome || msg.payload);
        STATUS.textContent = `Received sealed genome into A${weakest.id}`;
        saveGenome({id:weakest.id, genome:weakest.rnn.genome(), fitness:0, ts:Date.now()});
      }
    } catch(err) {}
  };
}
document.getElementById('offerBtn').onclick = () => {
  setupPC(true);
  document.getElementById('rtcStatus').textContent = 'Offer created — copy SDP';
};
document.getElementById('answerBtn').onclick = async () => {
  const remote = document.getElementById('remoteSdp').value;
  if (!remote) return;
  if (!pc) setupPC(false);
  await pc.setRemoteDescription(JSON.parse(remote));
  if (pc.signalingState === 'have-remote-offer') {
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
  }
  document.getElementById('rtcStatus').textContent = 'Remote set — waiting for channel';
};

const bc = new BroadcastChannel('f507-auction');
bc.onmessage = e => {
  if (e.data.type==='genome') {
    const weakest = agents.reduce((a,b)=> a.fitness < b.fitness ? a : b);
    weakest.accept(e.data.payload.genome);
    STATUS.textContent = `Broadcast genome into A${weakest.id}`;
  }
};
document.getElementById('sealBtn').addEventListener('click', () => {
  const sealed = agents[active].seal();
  bc.postMessage({type:'genome', payload:sealed});
});

if (typeof DeviceMotionEvent.requestPermission === 'function') {
  document.body.addEventListener('click', () => {
    DeviceMotionEvent.requestPermission().then(p => {
      if (p==='granted') STATUS.textContent = 'Motion permission granted';
    }).catch(()=>{});
  }, {once:true});
}
