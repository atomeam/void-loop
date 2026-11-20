const $ = id => document.getElementById(id);
const canvas = $('chart'), ctx = canvas.getContext('2d');
const wrap = $('canvasWrap'), guestsDiv = $('guests'), pool = $('pool');
let guests = [], tables = [], assignment = new Map(); // guest -> {table, seat}
let seatPositions = []; // {x,y,table,seat,occupied}

function load() {
  try {
    const s = localStorage.getItem('verse-f867-seating');
    if (s) {
      const d = JSON.parse(s);
      $('names').value = d.names || '';
      $('nTables').value = d.nTables || 2;
      $('seats').value = d.seats || 4;
      $('together').value = d.together || '';
      $('apart').value = d.apart || '';
    }
  } catch (e) { console.debug("lab f867-spatial-seating-chart-optimizer:", e); }
}
function save() {
  const d = {
    names: $('names').value,
    nTables: +$('nTables').value,
    seats: +$('seats').value,
    together: $('together').value,
    apart: $('apart').value
  };
  localStorage.setItem('verse-f867-seating', JSON.stringify(d));
}
function parseConstraints() {
  const tog = $('together').value.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>l.split('+').map(s=>s.trim()));
  const apt = $('apart').value.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>l.split('-').map(s=>s.trim()));
  return {tog, apt};
}
function resize() {
  const r = wrap.getBoundingClientRect();
  canvas.width = r.width;
  canvas.height = r.height;
  draw();
}
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  seatPositions = [];
  const nT = +$('nTables').value || 1;
  const sp = +$('seats').value || 4;
  const cx = canvas.width/2, cy = canvas.height/2;
  const radius = Math.min(canvas.width, canvas.height) * 0.28;
  for (let t=0; t<nT; t++) {
    const angle = (t / nT) * Math.PI*2 - Math.PI/2;
    const tx = cx + Math.cos(angle)*radius*0.9;
    const ty = cy + Math.sin(angle)*radius*0.9;
    ctx.beginPath();
    ctx.arc(tx, ty, 48, 0, Math.PI*2);
    ctx.fillStyle = '#1e222a';
    ctx.fill();
    ctx.strokeStyle = '#4cc9f0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('T'+(t+1), tx, ty+5);
    for (let s=0; s<sp; s++) {
      const sa = (s / sp) * Math.PI*2 - Math.PI/2;
      const sx = tx + Math.cos(sa)*70;
      const sy = ty + Math.sin(sa)*70;
      seatPositions.push({x:sx, y:sy, table:t, seat:s, occupied:false});
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI*2);
      ctx.fillStyle = '#555';
      ctx.fill();
    }
  }
  // mark occupied
  assignment.forEach((a, name) => {
    const seat = seatPositions.find(p => p.table===a.table && p.seat===a.seat);
    if (seat) seat.occupied = true;
  });
}
function renderGuests() {
  guestsDiv.innerHTML = '';
  pool.innerHTML = '';
  guests.forEach(name => {
    const el = document.createElement('div');
    el.className = 'guest';
    el.textContent = name;
    el.dataset.name = name;
    const a = assignment.get(name);
    if (a) {
      const seat = seatPositions.find(p => p.table===a.table && p.seat===a.seat);
      if (seat) {
        el.style.left = (seat.x - 40) + 'px';
        el.style.top = (seat.y - 16) + 'px';
        guestsDiv.appendChild(el);
      } else pool.appendChild(el);
    } else {
      pool.appendChild(el);
    }
    makeDraggable(el);
  });
}
function makeDraggable(el) {
  let ox, oy, dragging=false;
  const start = e => {
    dragging=true;
    const r = el.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    ox = (e.clientX||e.touches[0].clientX) - r.left;
    oy = (e.clientY||e.touches[0].clientY) - r.top;
    el.style.zIndex = 10;
  };
  const move = e => {
    if (!dragging) return;
    e.preventDefault();
    const wr = wrap.getBoundingClientRect();
    const x = (e.clientX||e.touches[0].clientX) - wr.left - ox;
    const y = (e.clientY||e.touches[0].clientY) - wr.top - oy;
    el.style.left = x+'px';
    el.style.top = y+'px';
  };
  const end = e => {
    if (!dragging) return;
    dragging=false;
    el.style.zIndex = '';
    const wr = wrap.getBoundingClientRect();
    const cx = (e.clientX||e.changedTouches[0].clientX) - wr.left;
    const cy = (e.clientY||e.changedTouches[0].clientY) - wr.top;
    // find nearest free seat
    let best=null, bd=1e9;
    seatPositions.forEach(p => {
      if (p.occupied && assignment.get(el.dataset.name)?.table !== p.table) return;
      const d = Math.hypot(p.x-cx, p.y-cy);
      if (d < bd && d < 50) { bd=d; best=p; }
    });
    if (best) {
      // free old
      const old = assignment.get(el.dataset.name);
      if (old) {
        const os = seatPositions.find(p=>p.table===old.table && p.seat===old.seat);
        if (os) os.occupied=false;
      }
      best.occupied = true;
      assignment.set(el.dataset.name, {table:best.table, seat:best.seat});
    } else {
      assignment.delete(el.dataset.name);
    }
    renderGuests();
    save();
    $('status').textContent = 'Dragged. ' + assignment.size + ' seated.';
  };
  el.addEventListener('pointerdown', start);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  el.addEventListener('touchstart', start, {passive:false});
  window.addEventListener('touchmove', move, {passive:false});
  window.addEventListener('touchend', end);
}
function applyList() {
  guests = $('names').value.split('\n').map(s=>s.trim()).filter(Boolean);
  assignment.clear();
  resize();
  renderGuests();
  save();
  $('status').textContent = guests.length + ' guests ready.';
}
function energy(assign) {
  const {tog, apt} = parseConstraints();
  let e = 0;
  // together: same table preferred
  tog.forEach(([a,b]) => {
    if (!a||!b) return;
    const aa=assign.get(a), bb=assign.get(b);
    if (aa && bb && aa.table !== bb.table) e += 10;
    if (!aa || !bb) e += 5;
  });
  // apart: different tables preferred
  apt.forEach(([a,b]) => {
    if (!a||!b) return;
    const aa=assign.get(a), bb=assign.get(b);
    if (aa && bb && aa.table === bb.table) e += 10;
  });
  // balance
  const counts = {};
  assign.forEach(a => counts[a.table] = (counts[a.table]||0)+1);
  const vals = Object.values(counts);
  if (vals.length) {
    const avg = vals.reduce((s,v)=>s+v,0)/vals.length;
    e += vals.reduce((s,v)=>s+Math.abs(v-avg),0);
  }
  return e;
}
function autoSeat() {
  if (!guests.length) return applyList();
  const nT = +$('nTables').value || 1;
  const sp = +$('seats').value || 4;
  const seats = [];
  for (let t=0;t<nT;t++) for (let s=0;s<sp;s++) seats.push({table:t,seat:s});
  // random init
  let best = new Map();
  const shuffled = [...guests].sort(()=>Math.random()-0.5);
  shuffled.forEach((g,i) => { if (i<seats.length) best.set(g, seats[i]); });
  let bestE = energy(best);
  // SA
  const steps = 400;
  for (let i=0; i<steps; i++) {
    const temp = 2 * (1 - i/steps);
    const cur = new Map(best);
    // swap two random
    const names = [...cur.keys()];
    if (names.length < 2) break;
    const i1 = Math.floor(Math.random()*names.length);
    const i2 = Math.floor(Math.random()*names.length);
    if (i1===i2) continue;
    const a = cur.get(names[i1]), b = cur.get(names[i2]);
    cur.set(names[i1], b);
    cur.set(names[i2], a);
    const e = energy(cur);
    if (e < bestE || Math.random() < Math.exp((bestE-e)/temp)) {
      best = cur; bestE = e;
    }
  }
  assignment = best;
  resize();
  renderGuests();
  save();
  $('status').textContent = 'Auto-seated. Energy ' + bestE.toFixed(1);
}
function downloadPNG() {
  // composite: draw guests onto canvas temporarily
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(canvas, 0, 0);
  // draw names at positions
  assignment.forEach((a, name) => {
    const seat = seatPositions.find(p => p.table===a.table && p.seat===a.seat);
    if (seat) {
      tctx.fillStyle = '#1a1d24';
      tctx.fillRect(seat.x-36, seat.y-14, 72, 22);
      tctx.strokeStyle = '#4cc9f0';
      tctx.strokeRect(seat.x-36, seat.y-14, 72, 22);
      tctx.fillStyle = '#fff';
      tctx.font = '12px system-ui';
      tctx.textAlign = 'center';
      tctx.fillText(name, seat.x, seat.y+4);
    }
  });
  const a = document.createElement('a');
  a.href = tmp.toDataURL('image/png');
  a.download = 'seating-chart.png';
  a.click();
  $('status').textContent = 'PNG downloaded.';
}
function copyCSV() {
  let csv = 'Table,Seat,Guest\n';
  assignment.forEach((a, name) => {
    csv += `${a.table+1},${a.seat+1},${name}\n`;
  });
  navigator.clipboard.writeText(csv).then(() => {
    $('status').textContent = 'CSV copied.';
  }).catch(() => {
    $('status').textContent = 'Copy failed; select and copy manually.';
  });
}
$('apply').onclick = applyList;
$('auto').onclick = autoSeat;
$('png').onclick = downloadPNG;
$('csv').onclick = copyCSV;
$('clear').onclick = () => { localStorage.removeItem('verse-f867-seating'); $('status').textContent='Cleared.'; };
window.addEventListener('resize', resize);
load();
applyList();
