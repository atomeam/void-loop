const PEER_ID = 'p' + Math.random().toString(36).slice(2, 8);
const CHANNEL_NAME = 'verse-f571-mesh';
const channel = new BroadcastChannel(CHANNEL_NAME);
const cards = [];
const tokenBuffer = [];
const MAX_TOKENS = 48;
let opfsDir = null;
let lastBroadcast = 0;

const CARD_DEFS = [
  { title: 'Attention', desc: 'Shared focus' },
  { title: 'Memory', desc: 'Sealed state' },
  { title: 'Portal', desc: 'Consensus gate' },
  { title: 'Verse', desc: 'Local canvas' },
  { title: 'Mind', desc: 'Peer aggregate' },
  { title: 'Seal', desc: 'OPFS persist' }
];

function initCards() {
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '';
  cards.length = 0;
  CARD_DEFS.forEach((def, i) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<h3>${def.title}</h3><p>${def.desc}</p>`; // void-review: ok (constant labels, numbers or a hash only; no visitor text)
    el.dataset.idx = i;
    canvas.appendChild(el);
    cards.push({
      el,
      x: 80 + (i % 3) * 180 + Math.random() * 40,
      y: 120 + Math.floor(i / 3) * 140 + Math.random() * 40,
      scale: 1,
      hue: 200 + i * 20
    });
  });
  updateCardPositions();
}

function updateCardPositions() {
  cards.forEach(c => {
    c.el.style.left = c.x + 'px';
    c.el.style.top = c.y + 'px';
    c.el.style.transform = `scale(${c.scale})`;
    c.el.style.background = `hsl(${c.hue}, 40%, 18%)`;
  });
}

function computeConsensus() {
  if (tokenBuffer.length === 0) return { cx: window.innerWidth / 2, cy: window.innerHeight / 2, var: 200, peers: 1 };
  const peers = new Set(tokenBuffer.map(t => t.peer));
  let sx = 0, sy = 0;
  tokenBuffer.forEach(t => { sx += t.x; sy += t.y; });
  const n = tokenBuffer.length;
  const cx = sx / n, cy = sy / n;
  let v = 0;
  tokenBuffer.forEach(t => { v += (t.x - cx) ** 2 + (t.y - cy) ** 2; });
  const variance = Math.sqrt(v / n);
  return { cx, cy, var: variance, peers: peers.size };
}

function morphFromConsensus() {
  const cons = computeConsensus();
  const agreement = Math.max(0, 1 - cons.var / 400);
  cards.forEach((c, i) => {
    const angle = (i / cards.length) * Math.PI * 2;
    const radius = 80 + (1 - agreement) * 120;
    const tx = cons.cx + Math.cos(angle) * radius - 70;
    const ty = cons.cy + Math.sin(angle) * radius - 45;
    c.x += (tx - c.x) * 0.12;
    c.y += (ty - c.y) * 0.12;
    c.scale = 0.8 + agreement * 0.6;
    c.hue = 180 + agreement * 80 + i * 10;
  });
  updateCardPositions();
  document.getElementById('peers').textContent = `Peers: ${cons.peers}`;
  document.getElementById('status').textContent =
    `Consensus var: ${cons.var.toFixed(0)} | Agreement: ${(agreement*100).toFixed(0)}% | Tokens: ${tokenBuffer.length}`;
}

function pushToken(x, y, peer = PEER_ID) {
  const now = performance.now();
  tokenBuffer.push({ x, y, t: now, peer });
  if (tokenBuffer.length > MAX_TOKENS) tokenBuffer.shift();
  while (tokenBuffer.length && now - tokenBuffer[0].t > 8000) tokenBuffer.shift();
}

function broadcastToken(x, y) {
  const now = performance.now();
  if (now - lastBroadcast < 33) return;
  lastBroadcast = now;
  channel.postMessage({ type: 'token', x, y, peer: PEER_ID, t: now });
}

channel.onmessage = (ev) => {
  const msg = ev.data;
  if (!msg || msg.peer === PEER_ID) return;
  if (msg.type === 'token') {
    pushToken(msg.x, msg.y, msg.peer);
  } else if (msg.type === 'reset') {
    tokenBuffer.length = 0;
    initCards();
  }
};

document.addEventListener('pointermove', (e) => {
  pushToken(e.clientX, e.clientY);
  broadcastToken(e.clientX, e.clientY);
});

async function initOPFS() {
  try {
    opfsDir = await navigator.storage.getDirectory();
    const handle = await opfsDir.getFileHandle('f571-consensus.json', { create: false }).catch(() => null);
    if (handle) {
      const file = await handle.getFile();
      const text = await file.text();
      const state = JSON.parse(text);
      if (state.cards) {
        state.cards.forEach((sc, i) => { if (cards[i]) { cards[i].x = sc.x; cards[i].y = sc.y; } });
        updateCardPositions();
        document.getElementById('status').textContent = 'Restored sealed consensus from OPFS';
      }
    }
  } catch (err) {
    console.warn('OPFS unavailable', err);
    document.getElementById('status').textContent = 'OPFS unavailable - memory only';
  }
}

document.getElementById('seal').onclick = async () => {
  if (!opfsDir) return alert('OPFS not available');
  const state = {
    peer: PEER_ID,
    cards: cards.map(c => ({ x: c.x, y: c.y, scale: c.scale })),
    tokens: tokenBuffer.slice(-16),
    sealed: new Date().toISOString()
  };
  try {
    const handle = await opfsDir.getFileHandle('f571-consensus.json', { create: true });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();
    document.getElementById('status').textContent = 'Sealed to OPFS';
  } catch (e) { console.error(e); }
};

document.getElementById('reset').onclick = () => {
  tokenBuffer.length = 0;
  initCards();
  channel.postMessage({ type: 'reset', peer: PEER_ID });
  document.getElementById('status').textContent = 'Reset';
};

initCards();
initOPFS();
setInterval(morphFromConsensus, 50);

channel.postMessage({ type: 'hello', peer: PEER_ID });
