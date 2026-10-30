const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// Simple L-system
let axiom = 'F';
let rules = { 'F': 'F[+F]F[-F]F' };
let angle = 25;
let step = 8;
let fitness = 0;
let gen = 0;

function interpret(str, maxDepth = 5) {
  let stack = [];
  let x = W/2, y = H*0.85, a = -Math.PI/2;
  let depth = 0;
  ctx.strokeStyle = `hsl(${(fitness*40)%360},70%,60%)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let ch of str) {
    if (ch === 'F') {
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      ctx.lineTo(x, y);
      depth++;
    } else if (ch === '+') a += angle * Math.PI/180;
    else if (ch === '-') a -= angle * Math.PI/180;
    else if (ch === '[') stack.push({x,y,a});
    else if (ch === ']') {
      const s = stack.pop();
      if (s) { x=s.x; y=s.y; a=s.a; ctx.moveTo(x,y); }
    }
  }
  ctx.stroke();
  return depth;
}

function expand(n=3) {
  let s = axiom;
  for (let i=0; i<n; i++) {
    let ns = '';
    for (let ch of s) ns += rules[ch] || ch;
    s = ns;
    if (s.length > 2000) break;
  }
  return s;
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,W,H);
  const expanded = expand(3);
  const d = interpret(expanded);
  document.getElementById('status').textContent = `Fitness: ${fitness.toFixed(1)} | Gen: ${gen} | Depth~${d} | Rules: ${Object.keys(rules).length}`;
}

function mutateRules() {
  const keys = Object.keys(rules);
  if (Math.random() < 0.5 && keys.length) {
    const k = keys[Math.floor(Math.random()*keys.length)];
    let r = rules[k];
    if (Math.random() < 0.3) r += '[+F]';
    else if (Math.random() < 0.5) r = r.slice(0, -1) + (Math.random()<0.5?'+':'-') + 'F';
    else r = r.replace(/F/g, m => Math.random()<0.3 ? 'F[+F]' : m);
    rules[k] = r.slice(0, 20);
  } else {
    rules['X'] = 'F';
    axiom += 'X';
  }
  angle = 15 + Math.random()*30;
  step = 4 + Math.random()*8;
  gen++;
  updateCards();
  draw();
}

// DOM rule cards
const cards = [];
function updateCards() {
  cards.forEach(c => c.el.remove());
  cards.length = 0;
  let i = 0;
  for (const [k,v] of Object.entries(rules)) {
    const el = document.createElement('div');
    el.className = 'rule-card';
    el.textContent = `${k} → ${v}`;
    el.style.left = (20 + i*190) + 'px';
    el.style.top = (60 + (i%3)*40) + 'px';
    el.dataset.key = k;
    document.body.appendChild(el);
    let dragging = false, ox, oy;
    el.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX-parseInt(el.style.left); oy=e.clientY-parseInt(el.style.top); el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => { if(dragging){ el.style.left=(e.clientX-ox)+'px'; el.style.top=(e.clientY-oy)+'px'; } });
    el.addEventListener('pointerup', () => dragging=false);
    el.addEventListener('click', () => { if(!dragging) { rules[k] = (rules[k]||'') + (Math.random()<0.5?'[+F]':'[-F]'); updateCards(); draw(); } });
    cards.push({el, key:k});
    i++;
  }
}

document.getElementById('reward').onclick = () => { fitness += 1 + Math.random()*2; mutateRules(); };
document.getElementById('mutate').onclick = mutateRules;
document.getElementById('seal').onclick = () => {
  const data = {axiom, rules, angle, step, fitness, gen};
  localStorage.setItem('f453-champion', JSON.stringify(data));
  alert('Sealed to localStorage');
};
document.getElementById('load').onclick = () => {
  const raw = localStorage.getItem('f453-champion');
  if (raw) {
    const data = JSON.parse(raw);
    Object.assign(window, {axiom:data.axiom, rules:data.rules, angle:data.angle, step:data.step, fitness:data.fitness, gen:data.gen});
    updateCards(); draw();
  }
};

canvas.addEventListener('click', e => {
  // reward if click near plant (simplified)
  fitness += 0.5;
  mutateRules();
});

updateCards();
draw();
setInterval(draw, 2000); // idle redraw
