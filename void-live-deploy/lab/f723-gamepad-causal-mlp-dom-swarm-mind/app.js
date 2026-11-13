const N = 10;
const FIELD = document.getElementById('field');
const CURSOR = document.getElementById('cursor');
const STATUS = document.getElementById('status');
const N_AGENTS = document.getElementById('nAgents');
const BEST_FIT = document.getElementById('bestFit');

let agents = [];
let stick = { x: 0, y: 0 };
let keys = {};
let mouse = { x: window.innerWidth/2, y: window.innerHeight/2 };
let bestGenome = null;
let bestFitness = -Infinity;
let channel = null;

function rand(a,b){ return a + Math.random()*(b-a); }
function tanh(x){ return Math.tanh(x); }

class MLP {
  constructor(w) {
    // 4-6-3
    this.w1 = w ? w.w1 : Array.from({length:4*6}, () => rand(-0.5,0.5));
    this.b1 = w ? w.b1 : Array.from({length:6}, () => rand(-0.2,0.2));
    this.w2 = w ? w.w2 : Array.from({length:6*3}, () => rand(-0.5,0.5));
    this.b2 = w ? w.b2 : Array.from({length:3}, () => rand(-0.2,0.2));
  }
  forward(inp) {
    const h = new Array(6).fill(0);
    for (let i=0;i<6;i++) {
      let s = this.b1[i];
      for (let j=0;j<4;j++) s += inp[j] * this.w1[j*6 + i];
      h[i] = tanh(s);
    }
    const out = new Array(3).fill(0);
    for (let i=0;i<3;i++) {
      let s = this.b2[i];
      for (let j=0;j<6;j++) s += h[j] * this.w2[j*3 + i];
      out[i] = tanh(s);
    }
    return out;
  }
  cloneMut(rate=0.15) {
    const c = new MLP(this);
    const mut = arr => arr.map(v => v + rand(-rate,rate));
    c.w1 = mut(c.w1); c.b1 = mut(c.b1);
    c.w2 = mut(c.w2); c.b2 = mut(c.b2);
    return c;
  }
  toJSON(){ return {w1:this.w1, b1:this.b1, w2:this.w2, b2:this.b2}; }
}

function createAgent(i, genome) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.innerHTML = `<div class="note" contenteditable="true">Agent ${i}</div>`;
  const x = rand(80, window.innerWidth-160);
  const y = rand(80, window.innerHeight-140);
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  FIELD.appendChild(el);
  return {
    el, x, y, vx:0, vy:0, phase: Math.random()*6.28,
    mlp: new MLP(genome), fitness: 0, hue: 200 + i*15
  };
}

function initAgents(genome) {
  agents.forEach(a => a.el.remove());
  agents = [];
  for (let i=0;i<N;i++) agents.push(createAgent(i, genome));
  N_AGENTS.textContent = agents.length;
}

function updateGamepad() {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  let found = false;
  for (const g of gps) {
    if (g && g.axes.length >= 2) {
      stick.x = g.axes[0] || 0;
      stick.y = g.axes[1] || 0;
      found = true;
      if (g.buttons[0] && g.buttons[0].pressed) rewardTargeted();
      break;
    }
  }
  if (!found) {
    stick.x = (keys['d']||keys['ArrowRight']?1:0) - (keys['a']||keys['ArrowLeft']?1:0);
    stick.y = (keys['s']||keys['ArrowDown']?1:0) - (keys['w']||keys['ArrowUp']?1:0);
    stick.x *= 0.7; stick.y *= 0.7;
  }
  STATUS.textContent = found ? 'Gamepad connected' : 'Keyboard / pointer fallback';
}

function rewardTargeted() {
  let best = null, bestD = 120;
  agents.forEach(a => {
    const dx = a.x + 70 - mouse.x, dy = a.y + 45 - mouse.y;
    const d = Math.hypot(dx,dy);
    if (d < bestD) { bestD = d; best = a; }
  });
  if (!best) return;
  best.fitness += 1;
  best.el.classList.add('rewarded');
  setTimeout(() => best.el.classList.remove('rewarded'), 400);
  // genome transfer to nearby
  agents.forEach(other => {
    if (other === best) return;
    const d = Math.hypot(other.x - best.x, other.y - best.y);
    if (d < 220) other.mlp = best.mlp.cloneMut(0.2);
  });
  if (best.fitness > bestFitness) {
    bestFitness = best.fitness;
    bestGenome = best.mlp.toJSON();
    BEST_FIT.textContent = bestFitness.toFixed(0);
    seal();
  }
}

function seal() {
  if (!bestGenome) return;
  const data = { genome: bestGenome, fitness: bestFitness, t: Date.now() };
  try {
    const req = indexedDB.open('verse-f723', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('seal');
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('seal','readwrite');
      tx.objectStore('seal').put(data, 'best');
    };
  } catch (e) { console.debug("lab f723-gamepad-causal-mlp-dom-swarm-mind:", e); }
  if (channel) channel.postMessage(data);
}

function loadSeal() {
  try {
    const req = indexedDB.open('verse-f723', 1);
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('seal')) return;
      const tx = db.transaction('seal');
      const get = tx.objectStore('seal').get('best');
      get.onsuccess = () => {
        if (get.result && get.result.genome) {
          bestGenome = get.result.genome;
          bestFitness = get.result.fitness || 0;
          BEST_FIT.textContent = bestFitness.toFixed(0);
          initAgents(bestGenome);
        }
      };
    };
  } catch (e) { console.debug("lab f723-gamepad-causal-mlp-dom-swarm-mind:", e); }
}

function step() {
  updateGamepad();
  // virtual cursor follows stick or mouse
  const cx = window.innerWidth/2 + stick.x * 280;
  const cy = window.innerHeight/2 + stick.y * 180;
  mouse.x = mouse.x * 0.85 + cx * 0.15;
  mouse.y = mouse.y * 0.85 + cy * 0.15;
  CURSOR.style.left = mouse.x + 'px';
  CURSOR.style.top = mouse.y + 'px';

  agents.forEach(a => {
    a.phase += 0.04;
    const inp = [stick.x, stick.y, a.vx*0.5, Math.sin(a.phase)];
    const out = a.mlp.forward(inp);
    a.vx = a.vx*0.85 + out[0]*1.8;
    a.vy = a.vy*0.85 + out[1]*1.8;
    a.x += a.vx;
    a.y += a.vy;
    // bounds
    a.x = Math.max(20, Math.min(window.innerWidth-160, a.x));
    a.y = Math.max(20, Math.min(window.innerHeight-120, a.y));
    a.el.style.left = a.x + 'px';
    a.el.style.top = a.y + 'px';
    const hue = (a.hue + out[2]*40) % 360;
    a.el.style.filter = `hue-rotate(${hue}deg)`;
    a.el.style.opacity = 0.75 + out[2]*0.2;
    // targeting highlight
    const d = Math.hypot(a.x+70-mouse.x, a.y+45-mouse.y);
    a.el.classList.toggle('targeted', d < 90);
  });
  requestAnimationFrame(step);
}

// input
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if(e.key===' ') { e.preventDefault(); rewardTargeted(); } });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
FIELD.addEventListener('click', rewardTargeted);

document.getElementById('sealBtn').onclick = seal;
document.getElementById('resetBtn').onclick = () => { bestGenome=null; bestFitness=-Infinity; BEST_FIT.textContent='0'; initAgents(); };
document.getElementById('dlBtn').onclick = () => {
  const blob = new Blob([JSON.stringify({agents: agents.map(a=>({x:a.x,y:a.y,genome:a.mlp.toJSON(),fitness:a.fitness})), best:bestGenome}, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'f723-genome.json';
  a.click();
};

// multi-tab
try {
  channel = new BroadcastChannel('verse-f723');
  channel.onmessage = e => {
    if (e.data && e.data.genome) {
      bestGenome = e.data.genome;
      bestFitness = e.data.fitness || bestFitness;
      BEST_FIT.textContent = bestFitness.toFixed(0);
      // soft adopt: mutate a few agents toward it
      agents.forEach((a,i) => { if (i%3===0) a.mlp = new MLP(bestGenome); });
    }
  };
} catch (e) { console.debug("lab f723-gamepad-causal-mlp-dom-swarm-mind:", e); }

initAgents();
loadSeal();
step();
