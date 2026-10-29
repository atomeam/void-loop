const { World } = require('./core.js');
// Layouts in screen pixels, like real desktop windows. Each is connected only through overlaps.
const layouts = {
  chain: [[0,0,500,380],[460,300,420,360],[840,0,420,340],[1220,260,400,400]],
  ring:  [[0,0,520,320],[480,0,520,320],[480,280,520,320],[0,280,520,320]],
  zigzag:[[0,0,360,300],[330,240,360,300],[0,480,360,300],[330,720,360,300],[660,700,500,300]],
};
const out = {};
for (const [name, L] of Object.entries(layouts)) for (const mode of ['learn', 'straight']) {
  const rows = [];
  for (const seed of [1,2,3,4,5]) {
    const w = new World({ seed, mode }); L.forEach((r, i) => w.setRoom(String(i), { x: r[0], y: r[1], w: r[2], h: r[3] }));
    const T = 12000, half = []; let e0 = 0;
    for (let t = 0; t < T; t++) { w.step(); if (t === T / 5) e0 = w.eaten; }
        rows.push({ seed, eaten: w.eaten, firstFifth: e0, doors: w.doors.size });
  }
  out[name + ':' + mode] = { meanEaten: rows.reduce((a, r) => a + r.eaten, 0) / rows.length, meanDoors: rows.reduce((a, r) => a + r.doors, 0) / rows.length, rows };
}
// Topology change: learn the chain, then drag window 1 down so the 0-1 door moves.
{ const w = new World({ seed: 3, mode: 'learn' }); const L = layouts.chain; L.forEach((r, i) => w.setRoom(String(i), { x: r[0], y: r[1], w: r[2], h: r[3] }));
  for (let t = 0; t < 6000; t++) w.step(); const before = w.eaten; const doorsBefore = [...w.doors.keys()];
  w.setRoom('0', { x: 0, y: 420, w: 480, h: 380 }); // user drags window 0 down-left: old 0-1 door is gone, a new one opens lower down
  for (let t = 0; t < 6000; t++) w.step();
  out.moveWindow = { eatenBefore6000: before, eatenAfter6000: w.eaten - before, surprises: w.surprises, doorsBefore, doorsAfter: [...w.doors.keys()], forgets: w.events.filter(e => e.e === 'forget').length };
}
console.log(JSON.stringify(out, (k, v) => k === 'rows' ? v.map(r => r.eaten) : v, 1));
