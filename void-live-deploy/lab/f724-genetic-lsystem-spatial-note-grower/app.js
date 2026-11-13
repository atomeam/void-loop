const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// L-system state
let axiom = "F";
let rules = { F: "F[+F]F[-F]F", "+": "+", "-": "-", "[": "[", "]": "]" };
let population = [];
let bestFitness = -Infinity;
let generation = 0;
let tips = [];
let notes = [];
let rewardMap = new Map();

function randomRule() {
  const variants = [
    "FF", "F[+F]F[-F]F", "F[+F][-F]F", "FF[+F][-F]",
    "F[+FF]F[-FF]F", "F[+F]F[-F][+F]F", "FF[+F]F[-F]"
  ];
  return variants[Math.floor(Math.random()*variants.length)];
}

function initPop() {
  population = [];
  for (let i=0; i<8; i++) {
    const r = {...rules, F: randomRule()};
    population.push({ rules: r, fitness: 0 });
  }
}
initPop();

function rewrite(s, r, depth=0) {
  if (depth > 5) return s;
  let out = "";
  for (const c of s) out += r[c] || c;
  return depth < 4 ? rewrite(out, r, depth+1) : out;
}

function turtle(str, steps=80) {
  const path = [];
  const stack = [];
  let x = W/2, y = H*0.7, a = -Math.PI/2, len = 8;
  tips = [];
  for (let i=0; i<Math.min(str.length, steps*3); i++) {
    const c = str[i];
    if (c === 'F') {
      const nx = x + Math.cos(a)*len, ny = y + Math.sin(a)*len;
      path.push([x,y,nx,ny]);
      x = nx; y = ny;
      if (i > steps) tips.push({x,y, symbol: c});
    } else if (c === '+') a += 0.45;
    else if (c === '-') a -= 0.45;
    else if (c === '[') stack.push([x,y,a]);
    else if (c === ']') { if (stack.length) [x,y,a] = stack.pop(); }
  }
  return path;
}

function evaluate(ind) {
  const expanded = rewrite(axiom, ind.rules);
  const path = turtle(expanded);
  let coverage = tips.length;
  let reward = 0;
  tips.forEach(t => {
    const k = Math.round(t.x/20)+','+Math.round(t.y/20);
    reward += rewardMap.get(k) || 0;
  });
  const penalty = Math.max(0, path.length - 200) * 0.01;
  return coverage * 2 + reward - penalty;
}

function evolve() {
  population.forEach(ind => ind.fitness = evaluate(ind));
  population.sort((a,b) => b.fitness - a.fitness);
  bestFitness = population[0].fitness;
  rules = {...population[0].rules};
  const next = [population[0], population[1]];
  while (next.length < 8) {
    const p1 = population[Math.floor(Math.random()*3)];
    const p2 = population[Math.floor(Math.random()*3)];
    const child = { rules: {...p1.rules}, fitness: 0 };
    if (Math.random() < 0.5) child.rules.F = p2.rules.F;
    if (Math.random() < 0.3) child.rules.F = randomRule();
    next.push(child);
  }
  population = next;
  generation++;
  updateNotes();
  draw();
  status.textContent = `Generation ${generation} | Fitness ${bestFitness.toFixed(1)} | Tips ${tips.length}`;
}

function draw() {
  ctx.fillStyle = '#05050a';
  ctx.fillRect(0,0,W,H);
  const expanded = rewrite(axiom, rules);
  const path = turtle(expanded);
  ctx.strokeStyle = `hsl(${(generation*15)%360},70%,60%)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  path.forEach(([x,y,nx,ny]) => { ctx.moveTo(x,y); ctx.lineTo(nx,ny); });
  ctx.stroke();
  ctx.fillStyle = '#88aaff';
  tips.forEach(t => { ctx.beginPath(); ctx.arc(t.x, t.y, 3, 0, Math.PI*2); ctx.fill(); });
}

function updateNotes() {
  notes.forEach(n => n.el.remove());
  notes = [];
  const uniqueTips = tips.slice(0, 6);
  uniqueTips.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'note';
    el.contentEditable = true;
    el.textContent = (rules.F || "F").slice(0, 12) + "…" || "tip";
    el.style.left = (t.x - 40) + 'px';
    el.style.top = (t.y - 20) + 'px';
    document.body.appendChild(el);
    notes.push({el, tip: t});
  });
}

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  tips.forEach(t => {
    if (Math.hypot(t.x-mx, t.y-my) < 20) {
      const k = Math.round(t.x/20)+','+Math.round(t.y/20);
      rewardMap.set(k, (rewardMap.get(k)||0) + 5);
    }
  });
  draw();
});

document.getElementById('evolve').onclick = evolve;
document.getElementById('inject').onclick = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) inject(text);
  } catch(e) { status.textContent = "Clipboard denied — use type box"; }
};
document.getElementById('addtoken').onclick = () => {
  const t = document.getElementById('typein').value.trim();
  if (t) inject(t);
  document.getElementById('typein').value = "";
};
function inject(text) {
  const tokens = text.split(/\s+/).filter(Boolean).slice(0,5);
  tokens.forEach(tok => {
    const sym = tok[0].toUpperCase();
    if (!rules[sym]) rules[sym] = randomRule().replace(/F/g, sym);
    axiom += sym;
  });
  status.textContent = `Injected: ${tokens.join(' ')} | Axiom length ${axiom.length}`;
  draw();
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { axiom="F"; rules={F:"F[+F]F[-F]F"}; initPop(); generation=0; rewardMap.clear(); notes.forEach(n=>n.el.remove()); notes=[]; draw(); status.textContent="Reset"; };
document.getElementById('download').onclick = () => {
  const data = {axiom, rules, generation, bestFitness, reward: Object.fromEntries(rewardMap)};
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], {type:'application/json'}));
  a.download = 'f724-genome.json';
  a.click();
};

async function seal() {
  const genome = {axiom, rules, generation, bestFitness, date: Date.now()};
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f724', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(genome, 'best');
    await new Promise(r => tx.oncomplete = r);
    status.textContent = "Sealed genome to IndexedDB";
  } catch(e) { status.textContent = "Seal failed (session only)"; }
}

async function load() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f724', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => {
      if (req.result) {
        axiom = req.result.axiom || axiom;
        rules = req.result.rules || rules;
        generation = req.result.generation || 0;
        status.textContent = "Loaded sealed genome";
        draw();
      }
    };
  } catch (e) { console.debug("lab f724-genetic-lsystem-spatial-note-grower:", e); }
}
load();
draw();
