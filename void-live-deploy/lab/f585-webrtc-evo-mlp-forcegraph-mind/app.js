const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

const N = 8;
const agents = 4;
let nodes = [];
let genomes = [];
let fitness = Array(agents).fill(0);
let orientation = {x: 0, y: 0};
let peer = null, channel = null;

function randomWeights(inN, hid, out) {
  const w1 = Array.from({length: hid}, () => Array.from({length: inN}, () => Math.random()*0.4-0.2));
  const w2 = Array.from({length: out}, () => Array.from({length: hid}, () => Math.random()*0.4-0.2));
  return {w1, w2, bias1: Array(hid).fill(0), bias2: Array(out).fill(0)};
}
function mlp(g, inp) {
  const h = g.w1.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w * inp[j], 0) + g.bias1[i]));
  return g.w2.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w * h[j], 0) + g.bias2[i]));
}
function sealHash(obj) {
  const s = JSON.stringify(obj);
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h.toString(16);
}

function init() {
  nodes = [];
  genomes = [];
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'node agent' + (i % agents);
    el.textContent = 'Thought ' + i;
    el.style.left = (Math.random()*0.6 + 0.2)*innerWidth + 'px';
    el.style.top = (Math.random()*0.6 + 0.2)*innerHeight + 'px';
    document.body.appendChild(el);
    nodes.push({
      el, x: parseFloat(el.style.left), y: parseFloat(el.style.top),
      vx: 0, vy: 0, agent: i % agents, id: i
    });
  }
  for (let a = 0; a < agents; a++) genomes.push(randomWeights(4, 6, 2));
  loadSeal();
}
init();

addEventListener('deviceorientation', e => {
  orientation.x = (e.gamma || 0) / 45;
  orientation.y = (e.beta || 0) / 45;
});
let mouseTilt = false;
addEventListener('mousemove', e => {
  if (!mouseTilt) return;
  orientation.x = (e.clientX / innerWidth - 0.5) * 2;
  orientation.y = (e.clientY / innerHeight - 0.5) * 2;
});
document.getElementById('ui').addEventListener('dblclick', () => { mouseTilt = !mouseTilt; statusEl.textContent += ' | mouse tilt ' + mouseTilt; });

let dragging = null, dragOff = {x:0,y:0};
document.addEventListener('pointerdown', e => {
  const t = e.target.closest('.node');
  if (!t) return;
  dragging = nodes.find(n => n.el === t);
  dragOff = {x: e.clientX - dragging.x, y: e.clientY - dragging.y};
});
addEventListener('pointermove', e => {
  if (!dragging) return;
  dragging.x = e.clientX - dragOff.x;
  dragging.y = e.clientY - dragOff.y;
  dragging.vx = dragging.vy = 0;
});
addEventListener('pointerup', () => { dragging = null; });

function step() {
  // forces
  nodes.forEach(n => { n.fx = 0; n.fy = 0; });
  // repulsion
  for (let i = 0; i < N; i++) for (let j = i+1; j < N; j++) {
    const a = nodes[i], b = nodes[j];
    let dx = a.x - b.x, dy = a.y - b.y;
    const d2 = dx*dx + dy*dy + 100;
    const f = 800 / d2;
    const inv = 1 / Math.sqrt(d2);
    a.fx += dx * inv * f; a.fy += dy * inv * f;
    b.fx -= dx * inv * f; b.fy -= dy * inv * f;
  }
  // agent MLP forces + orientation gravity
  nodes.forEach(n => {
    const dens = nodes.filter(o => o !== n && Math.hypot(o.x-n.x, o.y-n.y) < 120).length / 4;
    const inp = [dens, orientation.x, orientation.y, (n.id % 4)/4];
    const out = mlp(genomes[n.agent], inp);
    n.fx += out[0] * 40;
    n.fy += out[1] * 40;
    // gravity from orientation
    n.fx += orientation.x * 12;
    n.fy += orientation.y * 12;
  });
  // integrate
  nodes.forEach(n => {
    if (n === dragging) return;
    n.vx = (n.vx + n.fx * 0.05) * 0.85;
    n.vy = (n.vy + n.fy * 0.05) * 0.85;
    n.x += n.vx; n.y += n.vy;
    n.x = Math.max(20, Math.min(innerWidth-100, n.x));
    n.y = Math.max(20, Math.min(innerHeight-80, n.y));
    n.el.style.left = n.x + 'px';
    n.el.style.top = n.y + 'px';
  });
  // fitness: clustering (lower mean dist to agent mean better)
  const means = Array(agents).fill(0).map(() => ({x:0,y:0,c:0}));
  nodes.forEach(n => { means[n.agent].x += n.x; means[n.agent].y += n.y; means[n.agent].c++; });
  fitness = means.map((m, a) => {
    if (!m.c) return 0;
    m.x /= m.c; m.y /= m.c;
    let d = 0; nodes.filter(n => n.agent === a).forEach(n => d += Math.hypot(n.x-m.x, n.y-m.y));
    return 100 / (1 + d / m.c);
  });
  // simple online update: nudge toward better residual (demo)
  if (Math.random() < 0.02) {
    const best = fitness.indexOf(Math.max(...fitness));
    // light mutation on others
  }
  draw();
  requestAnimationFrame(step);
}
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = 'rgba(100,150,255,0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < N; i++) for (let j = i+1; j < N; j++) {
    if (Math.hypot(nodes[i].x-nodes[j].x, nodes[i].y-nodes[j].y) < 180) {
      ctx.beginPath();
      ctx.moveTo(nodes[i].x+45, nodes[i].y+35);
      ctx.lineTo(nodes[j].x+45, nodes[j].y+35);
      ctx.stroke();
    }
  }
  // status update occasionally
  if (Math.random() < 0.01) {
    const best = Math.max(...fitness).toFixed(1);
    statusEl.textContent = `Best fitness ${best} | agents ${fitness.map(f=>f.toFixed(0)).join(',')} | ${channel ? 'Peer connected' : 'Local'}`;
  }
}
requestAnimationFrame(step);

// Seal / IDB
const DB = 'verse-f585';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seal');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
async function saveSeal() {
  const best = fitness.indexOf(Math.max(...fitness));
  const sealed = {genome: genomes[best], fitness: fitness[best], hash: sealHash(genomes[best]), ts: Date.now()};
  const db = await openDB();
  const tx = db.transaction('seal', 'readwrite');
  tx.objectStore('seal').put(sealed, 'best');
  statusEl.textContent = 'Sealed genome hash ' + sealed.hash.slice(0,8);
}
async function loadSeal() {
  try {
    const db = await openDB();
    const tx = db.transaction('seal', 'readonly');
    const req = tx.objectStore('seal').get('best');
    req.onsuccess = () => {
      if (req.result) {
        genomes[0] = req.result.genome;
        statusEl.textContent = 'Restored sealed genome';
      }
    };
  } catch(e) {}
}
document.getElementById('seal').onclick = saveSeal;
document.getElementById('reset').onclick = () => { location.reload(); };

// WebRTC simple manual
async function createOffer() {
  peer = new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]});
  channel = peer.createDataChannel('genome');
  setupChannel(channel);
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  document.getElementById('sdp').value = JSON.stringify(peer.localDescription);
  statusEl.textContent = 'Offer created – copy SDP to peer';
}
async function createAnswer() {
  const remote = JSON.parse(document.getElementById('sdp').value);
  peer = new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]});
  peer.ondatachannel = e => { channel = e.channel; setupChannel(channel); };
  await peer.setRemoteDescription(remote);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  document.getElementById('sdp').value = JSON.stringify(peer.localDescription);
  statusEl.textContent = 'Answer created – copy back';
}
function setupChannel(ch) {
  ch.onopen = () => { statusEl.textContent = 'Data channel open – genomes can transfer'; };
  ch.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'genome' && msg.fitness > Math.max(...fitness)) {
        const target = Math.floor(Math.random()*agents);
        genomes[target] = msg.genome;
        // light mutate
        genomes[target].w1.forEach(row => row.forEach((_,j) => row[j] += (Math.random()-0.5)*0.05));
        statusEl.textContent = 'Adopted higher-fitness genome from peer';
      }
    } catch(err) {}
  };
}
setInterval(() => {
  if (channel && channel.readyState === 'open') {
    const best = fitness.indexOf(Math.max(...fitness));
    channel.send(JSON.stringify({type:'genome', genome: genomes[best], fitness: fitness[best], hash: sealHash(genomes[best])}));
  }
}, 5000);
document.getElementById('connect').onclick = createOffer;
document.getElementById('answer').onclick = createAnswer;
document.getElementById('setRemote').onclick = async () => {
  if (!peer) return;
  const remote = JSON.parse(document.getElementById('sdp').value);
  await peer.setRemoteDescription(remote);
  statusEl.textContent = 'Remote description set';
};

console.log('F585 Verse force-graph mind ready. Verse is Verse.');
