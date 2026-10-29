const panels = [null, null, null];
const stage = document.getElementById('stage');
let currentTool = 'bubble';
let currentPanel = 0;

function makePanel(i) {
  const wrap = document.createElement('div');
  wrap.className = 'panel';
  wrap.dataset.i = i;
  const c = document.createElement('canvas');
  c.width = 280; c.height = 320;
  wrap.appendChild(c);
  stage.appendChild(wrap);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,280,320);
  panels[i] = { canvas: c, ctx, elements: [] };
  wrap.addEventListener('click', e => onPanelClick(e, i));
  return wrap;
}
for (let i = 0; i < 3; i++) makePanel(i);

document.querySelectorAll('[data-tool]').forEach(b => {
  b.onclick = () => { currentTool = b.dataset.tool; document.getElementById('status').textContent = 'Tool: ' + currentTool; };
});
document.getElementById('panelSelect').onchange = e => { currentPanel = +e.target.value; };

function onPanelClick(e, pi) {
  if (e.target.closest('.bubble')) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const p = panels[pi];
  if (currentTool === 'bubble') addBubble(p, x, y);
  else if (currentTool === 'figure') drawFigure(p.ctx, x, y);
  else if (currentTool === 'prop') drawProp(p.ctx, x, y);
  saveState();
}

function addBubble(p, x, y) {
  const div = document.createElement('div');
  div.className = 'bubble';
  div.style.left = (x - 40) + 'px';
  div.style.top = (y - 30) + 'px';
  const inp = document.createElement('input');
  inp.className = 'bubble-edit';
  inp.value = 'Hi!';
  inp.placeholder = 'dialogue';
  div.appendChild(inp);
  p.canvas.parentElement.appendChild(div);
  p.elements.push(div);
  makeDraggable(div);
  inp.focus();
  inp.select();
}

function makeDraggable(el) {
  let ox, oy, sx, sy;
  el.onpointerdown = e => {
    if (e.target.tagName === 'INPUT') return;
    e.preventDefault();
    ox = e.clientX; oy = e.clientY;
    sx = parseInt(el.style.left); sy = parseInt(el.style.top);
    const move = ev => {
      el.style.left = (sx + ev.clientX - ox) + 'px';
      el.style.top = (sy + ev.clientY - oy) + 'px';
    };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); saveState(); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
}

function drawFigure(ctx, x, y) {
  ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath();
  ctx.arc(x, y - 30, 12, 0, Math.PI*2); // head
  ctx.moveTo(x, y - 18); ctx.lineTo(x, y + 20); // body
  ctx.moveTo(x, y - 5); ctx.lineTo(x - 18, y + 10); // arm
  ctx.moveTo(x, y - 5); ctx.lineTo(x + 18, y + 10);
  ctx.moveTo(x, y + 20); ctx.lineTo(x - 12, y + 45); // leg
  ctx.moveTo(x, y + 20); ctx.lineTo(x + 12, y + 45);
  ctx.stroke();
}

function drawProp(ctx, x, y) {
  ctx.fillStyle = Math.random() > 0.5 ? '#e33' : '#fc0';
  ctx.beginPath();
  if (Math.random() > 0.5) { // star
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI / 5) - Math.PI/2;
      const r = i % 2 === 0 ? 14 : 6;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
  } else { // heart
    ctx.moveTo(x, y + 8);
    ctx.bezierCurveTo(x - 20, y - 10, x - 10, y - 20, x, y - 8);
    ctx.bezierCurveTo(x + 10, y - 20, x + 20, y - 10, x, y + 8);
  }
  ctx.closePath(); ctx.fill();
}

function saveState() {
  const data = panels.map(p => ({
    img: p.canvas.toDataURL('image/png'),
    bubbles: p.elements.map(el => ({
      left: el.style.left, top: el.style.top,
      text: el.querySelector('input').value
    }))
  }));
  try {
    const json = JSON.stringify(data);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    history.replaceState(null, '', '#' + b64.slice(0, 1800)); // limit length
  } catch (e) {}
}

function loadState() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  try {
    const json = decodeURIComponent(escape(atob(hash)));
    const data = JSON.parse(json);
    data.forEach((d, i) => {
      if (!panels[i]) return;
      const img = new Image();
      img.onload = () => panels[i].ctx.drawImage(img, 0, 0);
      img.src = d.img;
      d.bubbles.forEach(b => {
        const div = document.createElement('div');
        div.className = 'bubble';
        div.style.left = b.left; div.style.top = b.top;
        const inp = document.createElement('input');
        inp.className = 'bubble-edit'; inp.value = b.text;
        div.appendChild(inp);
        panels[i].canvas.parentElement.appendChild(div);
        panels[i].elements.push(div);
        makeDraggable(div);
      });
    });
    document.getElementById('status').textContent = 'Loaded shared comic.';
  } catch (e) { console.warn(e); }
}

document.getElementById('download').onclick = () => {
  const out = document.createElement('canvas');
  out.width = 280*3 + 40; out.height = 360;
  const octx = out.getContext('2d');
  octx.fillStyle = '#f4f0e6'; octx.fillRect(0,0,out.width,out.height);
  panels.forEach((p, i) => {
    const tmp = document.createElement('canvas');
    tmp.width = 280; tmp.height = 320;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(p.canvas, 0, 0);
    // composite bubbles (simple text draw)
    p.elements.forEach(el => {
      const left = parseInt(el.style.left), top = parseInt(el.style.top);
      const text = el.querySelector('input').value;
      tctx.fillStyle = '#fff'; tctx.strokeStyle = '#000'; tctx.lineWidth = 2;
      tctx.beginPath(); tctx.roundRect(left, top, 120, 40, 10); tctx.fill(); tctx.stroke();
      tctx.fillStyle = '#000'; tctx.font = '13px system-ui';
      tctx.fillText(text.slice(0, 18), left + 8, top + 24);
    });
    octx.drawImage(tmp, 20 + i*290, 20);
  });
  const a = document.createElement('a');
  a.href = out.toDataURL('image/png');
  a.download = 'panel-play.png';
  a.click();
};

document.getElementById('share').onclick = () => {
  saveState();
  navigator.clipboard.writeText(location.href).then(() => {
    document.getElementById('status').textContent = 'Share link copied.';
  }).catch(() => alert(location.href));
};

document.getElementById('clear').onclick = () => {
  location.hash = '';
  location.reload();
};

loadState();
