const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W, H, cards = [], field = [], learning = true;
let orient = {beta:0, gamma:0}, pointer = {x:0, y:0, vx:0, vy:0};
let rnn = {Wih: [], Whh: [], Who: [], h: [0,0,0,0,0,0,0,0]}; // simple

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  initField();
}
function initField() {
  field = [];
  const g = 40;
  for (let y=0; y<H; y+=g) for (let x=0; x<W; x+=g) field.push({x,y,vx:0,vy:0});
}
function addCard(text='Note') {
  const c = document.createElement('div');
  c.className = 'card';
  c.textContent = text;
  c.contentEditable = true;
  c.style.left = (Math.random()*W*0.6+W*0.2)+'px';
  c.style.top = (Math.random()*H*0.6+H*0.2)+'px';
  document.body.appendChild(c);
  let dragging = false, ox, oy;
  c.onpointerdown = e => { dragging=true; ox=e.clientX-parseFloat(c.style.left); oy=e.clientY-parseFloat(c.style.top); c.setPointerCapture(e.pointerId); };
  c.onpointermove = e => { if(dragging){ c.style.left=(e.clientX-ox)+'px'; c.style.top=(e.clientY-oy)+'px'; } };
  c.onpointerup = () => dragging=false;
  cards.push(c);
}
function stepRNN(db, dg, px, py) {
  // ultra-simple residual predictor update
  const pred = rnn.h[0]*0.1 + rnn.h[1]*0.05;
  const err = db - pred;
  rnn.h[0] = Math.tanh(rnn.h[0]*0.9 + err*0.2);
  rnn.h[1] = Math.tanh(rnn.h[1]*0.9 + dg*0.1);
  return {predBeta: pred, err};
}
function update() {
  const pred = stepRNN(orient.beta*0.01, orient.gamma*0.01, pointer.x/W, pointer.y/H);
  // simple field update (Canvas fallback; WebGPU stub)
  field.forEach(p => {
    const dx = (pointer.x - p.x)*0.001 + pred.err*2;
    const dy = (pointer.y - p.y)*0.001 + (orient.beta||0)*0.01;
    p.vx = p.vx*0.9 + dx;
    p.vy = p.vy*0.9 + dy;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx*=-0.5;
    if (p.y<0||p.y>H) p.vy*=-0.5;
  });
  // move cards toward local field average
  cards.forEach(c => {
    const cx = parseFloat(c.style.left)+40, cy = parseFloat(c.style.top)+20;
    let fx=0, fy=0, n=0;
    field.forEach(p => {
      const d = Math.hypot(p.x-cx, p.y-cy);
      if (d < 80) { fx += p.vx; fy += p.vy; n++; }
    });
    if (n && !c.matches(':active')) {
      c.style.left = (parseFloat(c.style.left) + fx/n*2)+'px';
      c.style.top = (parseFloat(c.style.top) + fy/n*2)+'px';
    }
  });
  // draw
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle = '#4af4';
  field.forEach(p => {
    ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+p.vx*8, p.y+p.vy*8); ctx.stroke();
  });
  requestAnimationFrame(update);
}
window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta||0; orient.gamma = e.gamma||0;
  document.getElementById('status').textContent = `tilt β${orient.beta.toFixed(0)} γ${orient.gamma.toFixed(0)}`;
});
window.addEventListener('pointermove', e => { pointer.x=e.clientX; pointer.y=e.clientY; });
document.getElementById('add').onclick = () => addCard(prompt('Note text')||'Note');
document.getElementById('export').onclick = () => {
  const data = {cards: cards.map(c=>({text:c.textContent, left:c.style.left, top:c.style.top})), rnn: rnn.h};
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.download = 'intent-field.json'; a.click();
};
document.getElementById('reset').onclick = () => { cards.forEach(c=>c.remove()); cards=[]; initField(); };
resize(); addEventListener('resize', resize);
addCard('Tilt or drag'); addCard('Local RNN learns your motion');
update();
