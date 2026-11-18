const N = 6;
const agents = [];
const scene = document.getElementById('scene');
let orient = {x:0, y:0, z:0};
let battery = 1.0;
let bestFitness = -Infinity;
let bestWeights = null;

// Tiny RNN per agent: 4 inputs (orient.x,y,z, battery) -> hidden 6 -> 3 outputs (vx,vy,vz)
function createRNN() {
  const w1 = Array.from({length:4*6}, () => Math.random()*0.4-0.2);
  const w2 = Array.from({length:6*3}, () => Math.random()*0.4-0.2);
  const h = new Array(6).fill(0);
  return {w1, w2, h};
}
function rnnForward(rnn, input) {
  // input: [ox,oy,oz,bat]
  const hNew = new Array(6);
  for(let i=0;i<6;i++) {
    let s = 0;
    for(let j=0;j<4;j++) s += input[j] * rnn.w1[j*6 + i];
    s += rnn.h[i] * 0.5; // recurrent
    hNew[i] = Math.tanh(s);
  }
  rnn.h = hNew;
  const out = new Array(3);
  for(let i=0;i<3;i++) {
    let s = 0;
    for(let j=0;j<6;j++) s += hNew[j] * rnn.w2[j*3 + i];
    out[i] = Math.tanh(s) * 2;
  }
  return out;
}
function hebbianUpdate(rnn, input, reward) {
  const lr = 0.01 * reward;
  // simple nudge on recent
  for(let i=0;i<rnn.w1.length;i++) rnn.w1[i] += lr * (Math.random()-0.5)*0.1;
  for(let i=0;i<rnn.w2.length;i++) rnn.w2[i] += lr * (Math.random()-0.5)*0.1;
}

for(let i=0;i<N;i++) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = 'A' + i;
  el.style.left = (20 + Math.random()*60) + '%';
  el.style.top = (20 + Math.random()*50) + '%';
  scene.appendChild(el);
  agents.push({
    el,
    x: parseFloat(el.style.left)/100 * window.innerWidth,
    y: parseFloat(el.style.top)/100 * window.innerHeight,
    z: (Math.random()-0.5)*200,
    vx:0, vy:0, vz:0,
    rnn: createRNN(),
    fitness: 0,
    id: i
  });
}

window.addEventListener('deviceorientation', e => {
  orient.x = (e.beta || 0)/90;
  orient.y = (e.gamma || 0)/90;
  orient.z = (e.alpha || 0)/180;
});
window.addEventListener('pointermove', e => {
  orient.x = (e.clientX / window.innerWidth - 0.5)*2;
  orient.y = (e.clientY / window.innerHeight - 0.5)*2;
});

if('getBattery' in navigator) {
  navigator.getBattery().then(b => {
    battery = b.level;
    document.getElementById('status').textContent = 'Battery: ' + (battery*100|0) + '%';
    b.addEventListener('levelchange', () => { battery = b.level; document.getElementById('status').textContent = 'Battery: ' + (battery*100|0) + '%'; });
  });
}

let drag = null;
agents.forEach(a => {
  a.el.addEventListener('pointerdown', e => { drag = a; a.el.setPointerCapture(e.pointerId); });
  a.el.addEventListener('pointerup', () => { drag = null; });
  a.el.addEventListener('pointermove', e => {
    if(drag === a) {
      a.x = e.clientX - 40;
      a.y = e.clientY - 30;
    }
  });
  a.el.addEventListener('click', () => {
    a.fitness += 1;
    hebbianUpdate(a.rnn, [orient.x, orient.y, orient.z, battery], 1);
    a.el.classList.add('rewarded');
    setTimeout(() => a.el.classList.remove('rewarded'), 400);
    if(a.fitness > bestFitness) { bestFitness = a.fitness; bestWeights = JSON.parse(JSON.stringify(a.rnn)); }
  });
});

const bc = new BroadcastChannel('f795-genome');
bc.onmessage = e => {
  if(e.data.type === 'seal' && e.data.fitness > bestFitness) {
    bestFitness = e.data.fitness;
    bestWeights = e.data.weights;
    agents.forEach(a => a.rnn = JSON.parse(JSON.stringify(bestWeights)));
  }
};

document.getElementById('seal').onclick = () => {
  if(bestWeights) {
    localStorage.setItem('f795-best', JSON.stringify({weights:bestWeights, fitness:bestFitness}));
    bc.postMessage({type:'seal', weights:bestWeights, fitness:bestFitness});
    alert('Sealed best genome (fitness ' + bestFitness + ')');
  }
};
document.getElementById('reset').onclick = () => {
  localStorage.removeItem('f795-best');
  location.reload();
};

// Load sealed
try {
  const saved = JSON.parse(localStorage.getItem('f795-best') || 'null');
  if(saved) {
    bestWeights = saved.weights;
    bestFitness = saved.fitness;
    agents.forEach(a => a.rnn = JSON.parse(JSON.stringify(bestWeights)));
  }
} catch (e) { console.debug("lab f795-css3d-battery-rnn-agent-competition-mind:", e); }

function step() {
  const input = [orient.x, orient.y, orient.z, battery];
  agents.forEach(a => {
    const out = rnnForward(a.rnn, input);
    a.vx += out[0] * 0.5;
    a.vy += out[1] * 0.5;
    a.vz += out[2] * 0.5;
    a.vx *= 0.95; a.vy *= 0.95; a.vz *= 0.95;
    a.x += a.vx;
    a.y += a.vy;
    a.z += a.vz;
    // bounds
    a.x = Math.max(0, Math.min(window.innerWidth-80, a.x));
    a.y = Math.max(0, Math.min(window.innerHeight-60, a.y));
    a.z = Math.max(-300, Math.min(300, a.z));
    a.el.style.left = a.x + 'px';
    a.el.style.top = a.y + 'px';
    a.el.style.transform = `translateZ(${a.z}px) rotateX(${orient.x*20}deg)`;
    // simple competition: proximity boost fitness slightly
    agents.forEach(b => {
      if(a !== b) {
        const dx = a.x - b.x, dy = a.y - b.y;
        if(dx*dx + dy*dy < 10000) a.fitness += 0.01;
      }
    });
  });
  requestAnimationFrame(step);
}
step();
