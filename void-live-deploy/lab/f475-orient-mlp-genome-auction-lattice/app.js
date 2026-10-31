const N = 8; // 8 agents, 64 cells
const cells = [];
const agents = [];
let orient = {x:0, y:0};
let auctionCount = 0;
const dbName = 'f475-lattice';
let db;

function log(msg) {
  const el = document.getElementById('log');
  el.innerHTML = `<div>${new Date().toLocaleTimeString()}: ${msg}</div>` + el.innerHTML;
}

class TinyMLP {
  constructor(id) {
    this.id = id;
    this.w1 = Array(4).fill(0).map(() => Math.random()*0.4-0.2);
    this.b1 = Math.random()*0.2-0.1;
    this.w2 = Math.random()*0.4-0.2;
    this.genomeHash = this.seal();
    this.energy = 1.0;
    this.wins = 0;
  }
  forward(input) { // input: [orientX, orientY, energy, rand]
    let h = 0;
    for (let i=0; i<4; i++) h += this.w1[i] * input[i];
    h = Math.tanh(h + this.b1);
    return Math.tanh(h * this.w2);
  }
  seal() {
    const data = JSON.stringify({w1:this.w1.map(x=>+x.toFixed(4)), b1:+this.b1.toFixed(4), w2:+this.w2.toFixed(4)});
    return btoa(data).slice(0,16); // simple seal proxy
  }
  mutate(rate=0.1) {
    this.w1 = this.w1.map(w => w + (Math.random()-0.5)*rate);
    this.b1 += (Math.random()-0.5)*rate;
    this.w2 += (Math.random()-0.5)*rate;
    this.genomeHash = this.seal();
  }
  receiveFragment(fragment) {
    // sealed transfer: blend a small amount
    this.w1 = this.w1.map((w,i) => w*0.9 + fragment.w1[i]*0.1);
    this.genomeHash = this.seal();
  }
}

function init() {
  const lattice = document.getElementById('lattice');
  for (let i=0; i<N; i++) agents.push(new TinyMLP(i));
  for (let i=0; i<64; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.owner = i % N;
    cell.onclick = () => feed(i);
    lattice.appendChild(cell);
    cells.push(cell);
  }
  window.addEventListener('deviceorientation', e => {
    orient.x = (e.gamma || 0)/90;
    orient.y = (e.beta || 0)/90;
    document.getElementById('orient').textContent = `${orient.x.toFixed(2)},${orient.y.toFixed(2)}`;
  });
  // mouse proxy
  document.addEventListener('mousemove', e => {
    orient.x = (e.clientX / window.innerWidth - 0.5)*2;
    orient.y = (e.clientY / window.innerHeight - 0.5)*2;
    document.getElementById('orient').textContent = `${orient.x.toFixed(2)},${orient.y.toFixed(2)}`;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'a' || e.key === 'A') forceAuction();
    if (e.key === 's' || e.key === 'S') sealState();
    if (e.key === 'r' || e.key === 'R') restoreState();
  });
  openDB().then(() => log('Ready. Tilt/move mouse, click cells to feed, A to auction.'));
  setInterval(tick, 200);
}

function feed(idx) {
  const owner = parseInt(cells[idx].dataset.owner);
  agents[owner].energy = Math.min(3, agents[owner].energy + 0.3);
  log(`Fed agent ${owner} on cell ${idx}`);
  updateVisuals();
}

function forceAuction() {
  auctionCount++;
  document.getElementById('auctions').textContent = auctionCount;
  // each agent computes fitness biased by orientation wind
  const fitness = agents.map((a, i) => {
    const input = [orient.x, orient.y, a.energy, Math.random()];
    const score = a.forward(input) + a.energy * 0.2 + orient.x * (i%2 ? 0.1 : -0.1);
    return {i, score};
  });
  fitness.sort((a,b) => b.score - a.score);
  const winner = agents[fitness[0].i];
  const loser = agents[fitness[fitness.length-1].i];
  winner.wins++;
  winner.energy = Math.max(0.5, winner.energy - 0.1);
  loser.energy = Math.min(2, loser.energy + 0.05);
  // sealed transfer
  const frag = {w1: winner.w1.map(w => w * 0.3)};
  loser.receiveFragment(frag);
  loser.mutate(0.05);
  log(`Auction ${auctionCount}: Agent ${winner.id} wins, transfers sealed fragment to ${loser.id}. Hash ${winner.genomeHash}`);
  // reassign some cells
  for (let i=0; i<8; i++) {
    const c = cells[Math.floor(Math.random()*64)];
    c.dataset.owner = winner.id;
  }
  updateVisuals();
}

function tick() {
  // gentle energy decay + orientation influence
  agents.forEach(a => a.energy = Math.max(0.2, a.energy * 0.995 + Math.abs(orient.x)*0.01));
  updateVisuals();
}

function updateVisuals() {
  cells.forEach((cell, i) => {
    const owner = parseInt(cell.dataset.owner);
    const a = agents[owner];
    const hue = (a.id * 45 + a.wins * 10) % 360;
    const intensity = Math.min(1, a.energy / 2);
    cell.style.background = `hsla(${hue},70%,${30+intensity*30}%,${0.4+intensity*0.5})`;
    cell.style.transform = `scale(${0.85 + intensity*0.2})`;
    cell.textContent = `${owner}:${a.genomeHash.slice(0,4)}`;
  });
}

function openDB() {
  return new Promise(res => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('state');
    };
    req.onsuccess = e => { db = e.target.result; res(); };
    req.onerror = () => res();
  });
}

function sealState() {
  if (!db) return;
  const state = {
    agents: agents.map(a => ({id:a.id, w1:a.w1, b1:a.b1, w2:a.w2, energy:a.energy, wins:a.wins, hash:a.genomeHash})),
    owners: cells.map(c => c.dataset.owner),
    auctions: auctionCount
  };
  const tx = db.transaction('state', 'readwrite');
  tx.objectStore('state').put(state, 'lattice');
  log('State sealed to IndexedDB');
}

function restoreState() {
  if (!db) return;
  const tx = db.transaction('state', 'readonly');
  const req = tx.objectStore('state').get('lattice');
  req.onsuccess = () => {
    const s = req.result;
    if (!s) return log('No sealed state');
    s.agents.forEach((sa, i) => {
      Object.assign(agents[i], sa);
      agents[i].genomeHash = agents[i].seal();
    });
    s.owners.forEach((o, i) => cells[i].dataset.owner = o);
    auctionCount = s.auctions || 0;
    document.getElementById('auctions').textContent = auctionCount;
    updateVisuals();
    log('Restored sealed state');
  };
}

init();
