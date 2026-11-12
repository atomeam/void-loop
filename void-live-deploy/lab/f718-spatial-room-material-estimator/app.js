const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
let points = [];
let rooms = []; // {name, points, area}
let current = [];
let scale = 20; // pixels per metre
let origin = {x: 40, y: 40};

function load() {
  try {
    const raw = localStorage.getItem('verse-f718-room-planner');
    if (raw) {
      const data = JSON.parse(raw);
      rooms = data.rooms || [];
      points = data.points || [];
      document.getElementById('height').value = data.height || 2.4;
      document.getElementById('coverage').value = data.coverage || 12;
      document.getElementById('coats').value = data.coats || 2;
      document.getElementById('waste').value = data.waste || 10;
      document.getElementById('tile').value = data.tile || 30;
    }
  } catch (e) { console.debug("lab f718-spatial-room-material-estimator:", e); }
  draw();
  updateTotals();
}
function save() {
  const data = {
    rooms, points,
    height: +document.getElementById('height').value,
    coverage: +document.getElementById('coverage').value,
    coats: +document.getElementById('coats').value,
    waste: +document.getElementById('waste').value,
    tile: +document.getElementById('tile').value
  };
  localStorage.setItem('verse-f718-room-planner', JSON.stringify(data));
  alert('Layout saved on this device.');
}
function toWorld(px, py) {
  return { x: (px - origin.x) / scale, y: (H - py - origin.y) / scale };
}
function toScreen(wx, wy) {
  return { x: origin.x + wx * scale, y: H - origin.y - wy * scale };
}
function shoelace(pts) {
  if (pts.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
}
function draw() {
  ctx.fillStyle = '#16181e';
  ctx.fillRect(0, 0, W, H);
  // grid
  ctx.strokeStyle = '#2a2d35';
  ctx.lineWidth = 1;
  for (let m = 0; m < 30; m++) {
    const p = toScreen(m, 0);
    ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, H); ctx.stroke();
    const q = toScreen(0, m);
    ctx.beginPath(); ctx.moveTo(0, q.y); ctx.lineTo(W, q.y); ctx.stroke();
  }
  // rooms
  rooms.forEach((r, i) => {
    if (r.points.length < 3) return;
    ctx.fillStyle = `hsla(${i*50 % 360}, 40%, 30%, 0.35)`;
    ctx.beginPath();
    const first = toScreen(r.points[0].x, r.points[0].y);
    ctx.moveTo(first.x, first.y);
    r.points.forEach(p => {
      const s = toScreen(p.x, p.y);
      ctx.lineTo(s.x, s.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  // current
  if (current.length) {
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const f = toScreen(current[0].x, current[0].y);
    ctx.moveTo(f.x, f.y);
    current.forEach(p => {
      const s = toScreen(p.x, p.y);
      ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
    current.forEach(p => {
      const s = toScreen(p.x, p.y);
      ctx.fillStyle = '#facc15';
      ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI*2); ctx.fill();
    });
  }
  // all points
  points.forEach(p => {
    const s = toScreen(p.x, p.y);
    ctx.fillStyle = '#aaa';
    ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI*2); ctx.fill();
  });
}
function updateTotals() {
  const height = +document.getElementById('height').value || 2.4;
  const coverage = +document.getElementById('coverage').value || 12;
  const coats = +document.getElementById('coats').value || 2;
  const waste = (+document.getElementById('waste').value || 10) / 100;
  const tileCm = +document.getElementById('tile').value || 30;
  const tileArea = (tileCm/100) ** 2;
  let totalArea = 0;
  let html = '';
  rooms.forEach((r, i) => {
    const a = shoelace(r.points);
    totalArea += a;
    const wallArea = a * 0.4;
    const paintL = (wallArea * height * coats * (1+waste)) / coverage;
    const floorBoxes = Math.ceil((a * (1+waste)) / tileArea);
    html += `<div class="room"><strong>${r.name || 'Room '+(i+1)}</strong>: ${a.toFixed(1)} m² · paint ~${paintL.toFixed(1)} L · flooring ~${floorBoxes} boxes</div>`;
  });
  document.getElementById('rooms').innerHTML = html || '<em>No closed rooms yet.</em>';
  const totPaint = rooms.reduce((s, r) => {
    const a = shoelace(r.points);
    const wallA = a * 0.4;
    return s + (wallA * height * coats * (1+waste)) / coverage;
  }, 0);
  const totFloor = rooms.reduce((s, r) => s + Math.ceil((shoelace(r.points)*(1+waste))/tileArea), 0);
  document.getElementById('totals').innerHTML = rooms.length
    ? `Total floor area: ${totalArea.toFixed(1)} m²<br>Paint: ~${totPaint.toFixed(1)} L<br>Flooring tiles: ~${totFloor} boxes (${tileCm} cm)`
    : 'Draw and close a room to see estimates.';
}
canvas.addEventListener('pointerdown', e => {
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (W / rect.width);
  const py = (e.clientY - rect.top) * (H / rect.height);
  const w = toWorld(px, py);
  current.push(w);
  points.push(w);
  draw();
});
document.getElementById('closeRoom').onclick = () => {
  if (current.length >= 3) {
    const name = prompt('Room name?', 'Room ' + (rooms.length+1)) || 'Room';
    rooms.push({ name, points: [...current] });
    current = [];
    draw();
    updateTotals();
    save();
  } else alert('Need at least 3 points to close a room.');
};
document.getElementById('undo').onclick = () => {
  if (current.length) current.pop();
  else if (points.length) points.pop();
  draw();
};
document.getElementById('clear').onclick = () => {
  if (confirm('Clear everything?')) {
    points = []; rooms = []; current = [];
    localStorage.removeItem('verse-f718-room-planner');
    draw(); updateTotals();
  }
};
document.getElementById('save').onclick = save;
document.getElementById('png').onclick = () => {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'room-plan.png';
  a.click();
};
document.getElementById('csv').onclick = () => {
  let csv = 'Room,Floor_m2,Paint_L,Flooring_boxes\n';
  const height = +document.getElementById('height').value || 2.4;
  const coverage = +document.getElementById('coverage').value || 12;
  const coats = +document.getElementById('coats').value || 2;
  const waste = (+document.getElementById('waste').value || 10)/100;
  const tileArea = ((+document.getElementById('tile').value||30)/100)**2;
  rooms.forEach(r => {
    const a = shoelace(r.points);
    const wallA = a * 0.4;
    const paint = (wallA * height * coats * (1+waste)) / coverage;
    const boxes = Math.ceil((a * (1+waste)) / tileArea);
    csv += `"${r.name}",${a.toFixed(2)},${paint.toFixed(2)},${boxes}\n`;
  });
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'materials.csv';
  a.click();
};
['height','coverage','coats','waste','tile'].forEach(id => {
  document.getElementById(id).oninput = updateTotals;
});
load();
