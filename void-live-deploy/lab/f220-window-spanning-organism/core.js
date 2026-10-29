// F-220 Window-Spanning Organism: pure simulation core.
// Runs inside a SharedWorker, in a page (fallback), and in Node (bench).
// World = union of window rectangles in screen coordinates. The creature
// can only stand where at least one window is; two windows connect only
// where they overlap. It cannot see other windows: it learns doors by
// feeling itself inside two rooms at once, and forgets doors that vanish.
(function (root) {
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  function World(opts) {
    opts = opts || {};
    this.rand = rng(opts.seed || 7);
    this.rooms = new Map();          // id -> {x,y,w,h}
    this.mode = opts.mode || 'learn'; // 'learn' | 'straight'
    this.c = { x: 0, y: 0, vx: 0, vy: 0, room: null, hunger: 0, trail: [] };
    this.food = null;
    this.doors = new Map();          // "a|b" -> {x,y,n}
    this.cover = new Map();          // room -> Int32Array(16) visit counts on a 4x4 grid
    this.waypoint = null; this.plan = []; this.thought = 'waking';
    this.tick = 0; this.eaten = 0; this.surprises = 0; this.blocked = 0;
    this.events = [];
  }
  const P = World.prototype;
  const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

  P.setRoom = function (id, r) {
    const had = this.rooms.has(id), old = this.rooms.get(id);
    // a window carries its contents: food in a dragged window moves with it
    if (had && this.food && this.food.room === id) { this.food.x += r.x - old.x; this.food.y += r.y - old.y; this.food.x = Math.min(Math.max(this.food.x, r.x + 20), r.x + Math.max(40, r.w) - 20); this.food.y = Math.min(Math.max(this.food.y, r.y + 20), r.y + Math.max(40, r.h) - 20); }
    this.rooms.set(id, { x: r.x, y: r.y, w: Math.max(40, r.w), h: Math.max(40, r.h) });
    if (!this.cover.has(id)) this.cover.set(id, new Int32Array(16));
    if (!had && this.rooms.size === 1) { const q = this.rooms.get(id); this.c.x = q.x + q.w / 2; this.c.y = q.y + q.h / 2; this.c.room = id; }
    this.rescue();
    if (!this.food) this.spawnFood();
  };
  // a window was dragged out from under the creature: it falls to the nearest point of the nearest window
  P.rescue = function () {
    const c = this.c; const here = this.roomsAt(c.x, c.y);
    if (here.length) { if (!here.includes(c.room)) c.room = here[0]; return; }
    let best = null, bd = 1e18;
    for (const [id, r] of this.rooms) { const x = Math.min(Math.max(c.x, r.x + 2), r.x + r.w - 2), y = Math.min(Math.max(c.y, r.y + 2), r.y + r.h - 2); const d = (x - c.x) ** 2 + (y - c.y) ** 2; if (d < bd) { bd = d; best = { id, x, y }; } }
    if (best) { c.x = best.x; c.y = best.y; c.room = best.id; c.vx = c.vy = 0; this.waypoint = null; this.events.push({ t: this.tick, e: 'fell', to: best.id }); }
  };
  P.removeRoom = function (id) {
    this.rooms.delete(id); this.cover.delete(id);
    for (const k of [...this.doors.keys()]) if (k.split('|').includes(String(id))) this.doors.delete(k);
    if (this.food && this.food.room === id) this.food = null;
    if (!this.roomsAt(this.c.x, this.c.y).length) { const f = this.rooms.entries().next().value; if (f) { this.c.x = f[1].x + f[1].w / 2; this.c.y = f[1].y + f[1].h / 2; this.c.room = f[0]; } }
    this.plan = []; this.waypoint = null;
    if (!this.food && this.rooms.size) this.spawnFood();
  };
  P.roomsAt = function (x, y) { const o = []; for (const [id, r] of this.rooms) if (inside(r, x, y)) o.push(id); return o; };

  P.spawnFood = function () {
    const ids = [...this.rooms.keys()]; if (!ids.length) return;
    // prefer a room other than the creature's, so it has to travel
    let pick = ids[Math.floor(this.rand() * ids.length)];
    if (ids.length > 1) while (pick === this.c.room) pick = ids[Math.floor(this.rand() * ids.length)];
    const r = this.rooms.get(pick);
    this.food = { room: pick, x: r.x + 25 + this.rand() * (r.w - 50), y: r.y + 25 + this.rand() * (r.h - 50), born: this.tick };
    this.plan = []; this.waypoint = null;
  };

  // learned door graph -> BFS path of room ids
  P.path = function (from, to) {
    if (from === to) return [to];
    const adj = new Map();
    for (const k of this.doors.keys()) { const [a, b] = k.split('|'); (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
    const prev = new Map([[String(from), null]]), q = [String(from)];
    while (q.length) { const u = q.shift(); if (u === String(to)) break; for (const v of adj.get(u) || []) if (!prev.has(v)) { prev.set(v, u); q.push(v); } }
    if (!prev.has(String(to))) return null;
    const out = []; for (let u = String(to); u !== null; u = prev.get(u)) out.unshift(u);
    return out.slice(1);
  };

  P.exploreTarget = function () {
    // curiosity: least-visited cell of the current room, biased toward edges (doors live at edges)
    const r = this.rooms.get(this.c.room), cv = this.cover.get(this.c.room); if (!r) return null;
    let best = -1, bs = 1e9;
    for (let i = 0; i < 16; i++) { const gx = i % 4, gy = i >> 2; const edge = gx === 0 || gx === 3 || gy === 0 || gy === 3; const s = cv[i] * (edge ? 1 : 3) + this.rand() * 2; if (s < bs) { bs = s; best = i; } }
    const gx = best % 4, gy = best >> 2;
    return { x: r.x + (gx === 0 ? 4 : gx === 3 ? r.w - 4 : (gx + 0.5) * r.w / 4), y: r.y + (gy === 0 ? 4 : gy === 3 ? r.h - 4 : (gy + 0.5) * r.h / 4), kind: 'explore', cell: best };
  };

  P.decide = function () {
    const c = this.c, f = this.food; if (!f) return;
    if (this.mode === 'straight') { this.waypoint = { x: f.x, y: f.y, kind: 'food' }; this.thought = 'smell'; return; }
    if (c.room === f.room || this.roomsAt(c.x, c.y).includes(f.room)) { this.waypoint = { x: f.x, y: f.y, kind: 'food' }; this.thought = 'eat'; this.plan = [f.room]; return; }
    const p = this.path(c.room, f.room);
    if (p && p.length) { this.plan = p; const d = this.doors.get(key(String(c.room), p[0])); this.waypoint = { x: d.x, y: d.y, kind: 'door', to: p[0] }; this.thought = 'route ' + p.length; return; }
    // frontier: among rooms it can already reach, explore the least-explored one (edge cells only, where doors live)
    let goal = String(c.room), gs = 1e9;
    for (const id of this.rooms.keys()) {
      const pp = String(id) === String(c.room) ? [] : this.path(c.room, id); if (!pp) continue;
      const cv = this.cover.get(id); let e = 0; for (let i = 0; i < 16; i++) { const gx = i % 4, gy = i >> 2; if (gx === 0 || gx === 3 || gy === 0 || gy === 3) e += Math.min(cv[i], 3); }
      const s = e + pp.length * 4; if (s < gs) { gs = s; goal = String(id); }
    }
    if (goal !== String(c.room)) { const pp = this.path(c.room, goal); this.plan = pp; const d = this.doors.get(key(String(c.room), pp[0])); this.waypoint = { x: d.x, y: d.y, kind: 'door', to: pp[0] }; this.thought = 'scout ' + pp.length; return; }
    this.plan = []; if (!this.waypoint || this.waypoint.kind !== 'explore') this.waypoint = this.exploreTarget(); this.thought = 'explore';
  };

  P.step = function () {
    this.tick++; const c = this.c; if (!this.rooms.size) return;
    if (!this.food) this.spawnFood();
    if (this.c.room == null || !this.rooms.has(this.c.room)) this.rescue();
    this.decide();
    const w = this.waypoint || { x: c.x, y: c.y };
    let dx = w.x - c.x, dy = w.y - c.y; const d = Math.hypot(dx, dy) || 1;
    const sp = 6; let ax = dx / d * sp, ay = dy / d * sp;
    if (this.mode === 'straight' && this.blockStreak > 3) { const a = this.rand() * 6.283; ax = Math.cos(a) * sp; ay = Math.sin(a) * sp; }
    c.vx = c.vx * 0.5 + ax * 0.5; c.vy = c.vy * 0.5 + ay * 0.5;
    let nx = c.x + c.vx, ny = c.y + c.vy;
    if (!this.roomsAt(nx, ny).length) { // wall: slide along one axis
      if (this.roomsAt(nx, c.y).length) ny = c.y; else if (this.roomsAt(c.x, ny).length) nx = c.x; else { nx = c.x; ny = c.y; }
      this.blocked++; this.blockStreak = (this.blockStreak || 0) + 1;
    } else this.blockStreak = 0;
    c.x = nx; c.y = ny;
    const here = this.roomsAt(c.x, c.y);
    if (!here.includes(c.room)) c.room = here[0];
    // sense: standing in two rooms at once = a door. Running-average its position.
    if (here.length > 1) for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) {
      const k = key(String(here[i]), String(here[j])); const o = this.doors.get(k);
      if (!o) { this.doors.set(k, { x: c.x, y: c.y, n: 1 }); this.events.push({ t: this.tick, e: 'door', k }); }
      else { o.n = Math.min(o.n + 1, 50); o.x += (c.x - o.x) / o.n; o.y += (c.y - o.y) / o.n; }
    }
    // crossing: once in the overlap, commit to the next room
    if (w.kind === 'door' && here.includes(w.to)) { c.room = w.to; this.waypoint = null; }
    // surprise: arrived at a remembered door but the other room is not here -> forget it
    if (w.kind === 'door' && (d < 8 || this.blockStreak > 10) && !here.includes(w.to)) { this.doors.delete(key(String(c.room), w.to)); this.surprises++; this.events.push({ t: this.tick, e: 'forget', k: key(String(c.room), w.to) }); this.waypoint = null; }
    if (w.kind === 'explore' && (d < 10 || this.blockStreak > 8)) { const cv = this.cover.get(c.room); if (cv && w.cell != null) cv[w.cell] += 1; this.waypoint = null; }
    const cv = this.cover.get(c.room), r = this.rooms.get(c.room);
    if (cv && r) { const gx = Math.min(3, Math.max(0, Math.floor((c.x - r.x) / r.w * 4))), gy = Math.min(3, Math.max(0, Math.floor((c.y - r.y) / r.h * 4))); if (this.tick % 10 === 0) cv[gy * 4 + gx]++; }
    c.hunger = Math.min(1, c.hunger + 0.0015);
    if (this.food && Math.hypot(this.food.x - c.x, this.food.y - c.y) < 14) { this.eaten++; this.events.push({ t: this.tick, e: 'eat', dt: this.tick - this.food.born }); c.hunger = 0; this.food = null; this.spawnFood(); }
    if (this.tick % 3 === 0) { c.trail.push([Math.round(c.x), Math.round(c.y)]); if (c.trail.length > 120) c.trail.shift(); }
    if (this.events.length > 200) this.events.splice(0, this.events.length - 200);
  };

  // what the creature believes about one room, used for that window's favicon + title
  P.belief = function (id) {
    id = String(id); const c = this.c;
    if (String(c.room) === id) return { glyph: '◉', text: this.thought, hops: 0 };
    const p = this.path(c.room, id);
    if (p) return { glyph: p.length === 1 ? '◐' : '○', text: p.length + (p.length === 1 ? ' door away' : ' doors away'), hops: p.length };
    return { glyph: '?', text: 'unmapped', hops: -1 };
  };

  P.snapshot = function () {
    return { tick: this.tick, rooms: [...this.rooms].map(([id, r]) => ({ id, ...r })), c: { x: this.c.x, y: this.c.y, room: this.c.room, hunger: this.c.hunger, trail: this.c.trail }, food: this.food, doors: [...this.doors].map(([k, d]) => ({ k, x: d.x, y: d.y, n: d.n })), plan: this.plan, waypoint: this.waypoint, thought: this.thought, eaten: this.eaten, surprises: this.surprises, mode: this.mode };
  };

  const api = { World };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.F220 = api;
})(typeof self !== 'undefined' ? self : this);
