// The drawing course's drills and how each one is scored (/learn-to-draw/, 2026-10-29: assimilates wheelroot.com, "Drawing Fundamentals":
// line, shape, proportion and shading through short daily exercises). Every score is measured from the strokes themselves on a 300 x 300 sheet,
// so the same strokes always give the same score: a shared link is scored again when it opens, and tools/learn-to-draw.test.mjs checks the sums.
export const SIZE = 300;
export const UNITS = ['Line', 'Shape', 'Proportion', 'Shading'];
const seg = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
const arc = (cx, cy, r, from, to, n) => Array.from({ length: n + 1 }, (_, i) => { const t = from + (to - from) * i / n; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; });
const poly = (pts, n) => pts.flatMap((p, i) => seg(p, pts[(i + 1) % pts.length], n).slice(0, -1));
export const DRILLS = [
  { id: 'line', unit: 'Line', name: 'A straight line', how: 'Draw one straight line from the left dot to the right dot, in one stroke.', dots: [[40, 150], [260, 150]], path: seg([40, 150], [260, 150], 110), kind: 'path', guide: 'dots' },
  { id: 'curve', unit: 'Line', name: 'A steady curve', how: 'Trace the faint arc in one stroke, at an even pace.', path: arc(150, 220, 110, Math.PI, 2 * Math.PI, 120), kind: 'path', guide: 'path' },
  { id: 'circle', unit: 'Shape', name: 'A circle by eye', how: 'Draw a circle round the dot, about the size of the faint ring, and close it.', dots: [[150, 150]], ring: [150, 150, 90], kind: 'circle', guide: 'ring' },
  { id: 'square', unit: 'Shape', name: 'A square', how: 'Trace the faint square: four straight sides, four right angles.', path: poly([[70, 70], [230, 70], [230, 230], [70, 230]], 40), kind: 'path', guide: 'path' },
  { id: 'half', unit: 'Proportion', name: 'Find the middle', how: 'Tap where you think the middle of the line is. Judge it by eye, with no measuring.', line: [[30, 150], [270, 150]], kind: 'half', guide: 'line' },
  { id: 'memory', unit: 'Proportion', name: 'Draw it from memory', how: 'Look at the shape for 4 seconds. When it hides, draw it where it was, at the same size.', path: poly([[90, 220], [150, 80], [210, 220]], 40), kind: 'path', guide: 'flash' },
  { id: 'values', unit: 'Shading', name: 'A value scale', how: 'Shade the 5 boxes in even steps: leave the first white, make the last as dark as you can.', boxes: [0, 1, 2, 3, 4].map((i) => [20 + i * 54, 110, 46, 80]), kind: 'values', guide: 'boxes' },
  { id: 'gradient', unit: 'Shading', name: 'A smooth gradient', how: 'Shade the bar from white at the left to dark at the right, with no jumps.', bar: [30, 120, 240, 60], kind: 'gradient', guide: 'bar' },
];
export const drillOf = (id) => DRILLS.find((d) => d.id === id) || null;
// the drill of the day: the same for everyone on a given date, round the 8 drills in order
export const dailyDrill = (date = new Date()) => DRILLS[Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5) % DRILLS.length];

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const near = (p, pts) => pts.reduce((m, q) => Math.min(m, dist(p, q)), Infinity);
// the points of every stroke, filled in so no gap between two points is wider than 2 px
export function densify(strokes) {
  const out = [];
  for (const s of strokes || []) for (let i = 0; i < s.length; i++) {
    if (!i) { out.push(s[0]); continue; }
    const a = s[i - 1], b = s[i], n = Math.max(1, Math.ceil(dist(a, b) / 2));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
const clamp = (x) => Math.max(0, Math.min(1, x));
const r1 = (x) => Math.round(x * 10) / 10;

// a traced or remembered path: how far the strokes are from it on average, and how much of it they cover (a point of the path counts once a
// stroke passes within 12 px). Score = 100 x cover x (1 - average distance / 20 px).
function scorePath(d, pts) {
  const off = pts.reduce((s, p) => s + near(p, d.path), 0) / pts.length, cover = d.path.filter((q) => near(q, pts) <= 12).length / d.path.length;
  return { score: Math.round(100 * cover * clamp(1 - off / 20)), notes: [r1(off).toFixed(1) + ' px from the line on average', Math.round(cover * 100) + '% of the way covered'] };
}
// a circle by eye: how round (the spread of the distance from its own centre; a spread of 1% or less is as round as an eye can see) and how closed (how much of the way round it goes, in 36 slices)
function scoreCircle(d, pts) {
  const c = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length], rs = pts.map((p) => dist(p, c));
  const mean = rs.reduce((s, r) => s + r, 0) / rs.length, sd = Math.sqrt(rs.reduce((s, r) => s + (r - mean) ** 2, 0) / rs.length), cv = mean ? sd / mean : 1;
  const slices = new Set(pts.map((p) => Math.floor(((Math.atan2(p[1] - c[1], p[0] - c[0]) + Math.PI) / (2 * Math.PI)) * 36) % 36)).size / 36;
  return { score: Math.round(100 * clamp(1 - Math.max(0, cv - 0.01) / 0.2) * slices), notes: [Math.round((1 - cv) * 100) + '% round (radius ' + Math.round(mean) + ' px, ring ' + d.ring[2] + ' px)', Math.round(slices * 100) + '% of the way round'] };
}
// the middle of a line, by eye: the last tap, and how far it is from the true middle; 10% of the line off scores 0
function scoreHalf(d, strokes) {
  const s = strokes[strokes.length - 1], p = s[s.length - 1], len = dist(d.line[0], d.line[1]), mid = [(d.line[0][0] + d.line[1][0]) / 2, (d.line[0][1] + d.line[1][1]) / 2];
  const off = Math.abs(p[0] - mid[0]);
  return { score: Math.round(100 * clamp(1 - off / (len * 0.1))), notes: [Math.round(off) + ' px from the middle (' + r1(off / len * 100).toFixed(1) + '% of the line)', p[0] < mid[0] - 0.5 ? 'to the left' : p[0] > mid[0] + 0.5 ? 'to the right' : 'right on it'] };
}
// shading: the strokes are laid on a grid of 5 px cells as a pencil lays graphite, each pass of a 12 px wide stroke darkening a cell by a
// quarter, up to fully dark; a region's darkness is the mean of its cells, from 0 (white) to 1 (dark)
export function darkness(strokes, rect) {
  const C = 5, [x, y, w, h] = rect, cols = Math.ceil(w / C), rows = Math.ceil(h / C), ink = new Float32Array(cols * rows);
  for (const s of strokes || []) {
    const hit = new Set();
    for (const p of densify([s])) {
      const i0 = Math.floor((p[0] - 6 - x) / C), i1 = Math.floor((p[0] + 6 - x) / C), j0 = Math.floor((p[1] - 6 - y) / C), j1 = Math.floor((p[1] + 6 - y) / C);
      for (let j = Math.max(0, j0); j <= Math.min(rows - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(cols - 1, i1); i++) if (dist(p, [x + (i + 0.5) * C, y + (j + 0.5) * C]) <= 6) hit.add(j * cols + i);
    }
    for (const k of hit) ink[k] = Math.min(1, ink[k] + 0.25);
  }
  return ink.reduce((s, v) => s + v, 0) / ink.length;
}
function scoreSteps(have, notes) {
  const want = have.map((_, i) => i / (have.length - 1)), err = have.reduce((s, v, i) => s + Math.abs(v - want[i]), 0) / have.length;
  const rises = have.every((v, i) => !i || v >= have[i - 1]);
  return { score: Math.round(100 * clamp(1 - err / 0.25)), notes: [...notes, 'off the even steps by ' + Math.round(err * 100) + ' points on average', rises ? 'gets darker all the way' : 'a step gets lighter where it should get darker'] };
}
const pct = (v) => Math.round(v * 100) + '%';
export function score(id, strokes) {
  const d = drillOf(id); if (!d) return null;
  const pts = densify(strokes);
  if (!pts.length) return { score: 0, notes: ['nothing drawn yet'] };
  if (d.kind === 'path') return scorePath(d, pts);
  if (d.kind === 'circle') return scoreCircle(d, pts);
  if (d.kind === 'half') return scoreHalf(d, strokes);
  if (d.kind === 'values') { const v = d.boxes.map((b) => darkness(strokes, b)); return scoreSteps(v, ['boxes ' + v.map(pct).join(', ')]); }
  const [x, y, w, h] = d.bar, v = Array.from({ length: 10 }, (_, i) => darkness(strokes, [x + i * w / 10, y, w / 10, h]));
  return scoreSteps(v, ['left to right ' + pct(v[0]) + ' to ' + pct(v[9])]);
}

// strokes in a link: each point as two base-36 pairs (x then y, 0 to 300), strokes joined by "_"; points closer than 3 px are dropped
export function encode(strokes) {
  const two = (n) => Math.max(0, Math.min(SIZE, Math.round(n))).toString(36).padStart(2, '0');
  return (strokes || []).map((s) => s.filter((p, i) => !i || i === s.length - 1 || dist(p, s[i - 1]) >= 3).map((p) => two(p[0]) + two(p[1])).join('')).filter(Boolean).join('_');
}
export function decode(text) {
  const out = [];
  for (const part of String(text || '').split('_')) {
    if (!/^([0-9a-z]{4})+$/.test(part) || part.length > 4000) continue;
    const s = []; for (let i = 0; i < part.length; i += 4) s.push([parseInt(part.slice(i, i + 2), 36), parseInt(part.slice(i + 2, i + 4), 36)]);
    if (s.every((p) => p[0] <= SIZE && p[1] <= SIZE)) out.push(s);
    if (out.length >= 60) break;
  }
  return out;
}
// the streak: days in a row with at least one drill, up to today (or up to yesterday, while today has none yet)
export function streak(days, today) {
  const set = new Set(days || []), key = (t) => new Date(t).toISOString().slice(0, 10);
  let t = Date.parse(today + 'T00:00:00Z'); if (!set.has(key(t))) t -= 864e5;
  let n = 0; while (set.has(key(t))) { n++; t -= 864e5; }
  return n;
}
