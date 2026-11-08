const board = document.getElementById('board');
const taskIn = document.getElementById('task');
const status = document.getElementById('status');
const DB_NAME = 'verse-f618-board';
const STORE = 'state';

let cards = []; // {id, text, x, y, vx, vy, pinned}
let orient = {a:0, b:0, g:0, ok:false};
let mlp = initMLP();
let db;

function initMLP() {
  // 5 inputs (3 orient + 2 pos) -> 8 hidden -> 2 outputs
  const i=5, h=8, o=2;
  const w1 = new Float32Array(i*h), b1 = new Float32Array(h);
  const w2 = new Float32Array(h*o), b2 = new Float32Array(o);
  for (let k=0;k<w1.length;k++) w1[k] = (Math.random()-0.5)*0.4;
  for (let k=0;k<w2.length;k++) w2[k] = (Math.random()-0.5)*0.4;
  return {w1,b1,w2,b2,i,h,o};
}

function relu(x){return Math.max(0,x);}

function forward(inputs) {
  const {w1,b1,w2,b2,i,h,o} = mlp;
  const hidden = new Float32Array(h);
  for (let j=0;j<h;j++) {
    let s = b1[j];
    for (let k=0;k<i;k++) s += inputs[k]*w1[k*h+j];
    hidden[j] = relu(s);
  }
  const out = new Float32Array(o);
  for (let j=0;j<o;j++) {
    let s = b2[j];
    for (let k=0;k<h;k++) s += hidden[k]*w2[k*o+j];
    out[j] = Math.tanh(s);
  }
  return out;
}

function addCard(text) {
  if (!text.trim()) return;
  const id = Date.now()+Math.random();
  const c = {id, text: text.trim(), x: Math.random()* (board.clientWidth-160)+20, y: Math.random()*(board.clientHeight-80)+20, vx:0, vy:0, pinned:false};
  cards.push(c);
  render();
  save();
  taskIn.value = '';
}

function render() {
  board.innerHTML = '';
  cards.forEach(c => {
    const el = document.createElement('div');
    el.className = 'card' + (c.pinned?' pinned':'');
    el.textContent = c.text;
    el.style.left = c.x+'px';
    el.style.top = c.y+'px';
    el.onclick = () => { c.pinned = !c.pinned; render(); save(); };
    board.appendChild(el);
  });
}

function physics(dt) {
  const w = board.clientWidth, h = board.clientHeight;
  const oa = (orient.a||0)/180, ob=(orient.b||0)/90, og=(orient.g||0)/90;
  cards.forEach(c => {
    if (c.pinned) return;
    const inputs = [oa, ob, og, (c.x/w)*2-1, (c.y/h)*2-1];
    const force = forward(inputs);
    c.vx += force[0] * 40 * dt;
    c.vy += force[1] * 40 * dt;
    c.vx *= 0.92; c.vy *= 0.92;
    c.x += c.vx * dt * 60;
    c.y += c.vy * dt * 60;
    if (c.x < 10) {c.x=10; c.vx*=-0.5;}
    if (c.x > w-150) {c.x=w-150; c.vx*=-0.5;}
    if (c.y < 10) {c.y=10; c.vy*=-0.5;}
    if (c.y > h-70) {c.y=h-70; c.vy*=-0.5;}
  });
  // update DOM positions without full re-render for perf
  Array.from(board.children).forEach((el,i) => {
    if (cards[i]) {
      el.style.left = cards[i].x+'px';
      el.style.top = cards[i].y+'px';
    }
  });
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now-last)/1000);
  last = now;
  physics(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Orientation
function onOrient(e) {
  orient.a = e.alpha; orient.b = e.beta; orient.g = e.gamma; orient.ok = true;
  status.textContent = `Tilt active · α${(e.alpha||0).toFixed(0)} β${(e.beta||0).toFixed(0)} γ${(e.gamma||0).toFixed(0)} · ${cards.length} cards`;
}
if (window.DeviceOrientationEvent) {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.body.addEventListener('click', async () => {
      try { await DeviceOrientationEvent.requestPermission(); window.addEventListener('deviceorientation', onOrient); } catch (e) { console.debug("lab f618-orientation-mlp-spatial-taskboard:", e); }
    }, {once:true});
    status.textContent = 'Tap anywhere to enable tilt';
  } else {
    window.addEventListener('deviceorientation', onOrient);
  }
} else {
  // mouse proxy
  board.onmousemove = e => {
    orient.a = (e.clientX / board.clientWidth - 0.5)*180;
    orient.b = (e.clientY / board.clientHeight - 0.5)*90;
    orient.ok = true;
  };
  status.textContent = 'No orientation: move mouse to steer';
}

// IDB
function openDB() {
  return new Promise((res,rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  });
}
async function save() {
  if (!db) return;
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put({cards, mlp: {w1:[...mlp.w1], b1:[...mlp.b1], w2:[...mlp.w2], b2:[...mlp.b2], i:mlp.i,h:mlp.h,o:mlp.o}}, 'board');
}
async function load() {
  db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const req = tx.objectStore(STORE).get('board');
  req.onsuccess = () => {
    if (req.result) {
      cards = req.result.cards || [];
      const m = req.result.mlp;
      if (m) {
        mlp.w1 = new Float32Array(m.w1); mlp.b1 = new Float32Array(m.b1);
        mlp.w2 = new Float32Array(m.w2); mlp.b2 = new Float32Array(m.b2);
      }
      render();
    }
  };
}
load();

document.getElementById('add').onclick = () => addCard(taskIn.value);
taskIn.onkeydown = e => { if (e.key==='Enter') addCard(taskIn.value); };
document.getElementById('resetModel').onclick = () => { mlp = initMLP(); save(); status.textContent='Model reset'; };
document.getElementById('clear').onclick = () => { cards=[]; render(); save(); };
document.getElementById('export').onclick = () => {
  const data = {cards, mlp: {w1:[...mlp.w1],b1:[...mlp.b1],w2:[...mlp.w2],b2:[...mlp.b2]}, ts:Date.now()};
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'verse-spatial-taskboard.json';
  a.click();
};
