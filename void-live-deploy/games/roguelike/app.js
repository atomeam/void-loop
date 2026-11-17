// Voidspire Descent — Verse's own turn-based tactical roguelike. Seeded rooms, telegraphed intents, stackable relics.
const c = document.getElementById('c'), g = c.getContext('2d'), W = 320, H = 180, GW = 16, GH = 9, T = 20;
g.imageSmoothingEnabled = false;
const hpEl = document.getElementById('hp'), depthEl = document.getElementById('depth'), roomEl = document.getElementById('room'), seedEl = document.getElementById('seed'), msg = document.getElementById('msg'), draftEl = document.getElementById('draft');
const fit = () => { const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H))); c.style.width = W * s + 'px'; c.style.height = H * s + 'px'; c.style.left = (innerWidth - W * s) / 2 + 'px'; c.style.top = (innerHeight - H * s) / 2 + 'px'; };
addEventListener('resize', fit); fit();
let audio = null, muted = false;
const beep = (f, d = 0.06) => { if (muted) return; try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), v = audio.createGain(); o.type = 'square'; o.frequency.value = f; v.gain.value = 0.035; o.connect(v).connect(audio.destination); o.start(); o.stop(audio.currentTime + d); } catch (_) {} };
document.getElementById('mute').onclick = (e) => { muted = !muted; e.target.textContent = muted ? 'Sound off' : 'Sound on'; beep(700); };
const mulberry = (s) => () => { s |= 0; s = s + 0x6d2b79f5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const RELICS = [
  { id: 'spark', name: 'Chain Spark', text: 'Strikes jump to a second enemy.' },
  { id: 'vamp', name: 'Vampiric Step', text: 'A kill restores 2 HP.' },
  { id: 'echo', name: 'Echo Strike', text: 'Every second strike hits twice.' },
  { id: 'lens', name: 'Glass Lens', text: '+2 damage, but −2 max HP.' },
  { id: 'frost', name: 'Frost Trail', text: 'Frost holds enemies for a turn.' },
  { id: 'ward', name: 'Warding Step', text: 'Moving grants 1 shield.' },
];
const TYPES = ['Combat', 'Elite', 'Treasure', 'Rest', 'Boss'];
const S = { seed: 0, rng: Math.random, depth: 1, room: 0, grid: [], p: { x: 2, y: 4, hp: 20, mhp: 20, atk: 4, shield: 0 }, enemies: [], relics: [], phase: 'play', turns: 0, codex: [] };
try { S.codex = JSON.parse(localStorage.getItem('a2m.voidspire.codex.v1') || '[]'); } catch (_) {}
const key = (x, y) => y * GW + x;
const hud = () => { hpEl.textContent = 'HP ' + S.p.hp + '/' + S.p.mhp + (S.p.shield ? ' +' + S.p.shield : ''); depthEl.textContent = 'Depth ' + S.depth; roomEl.textContent = S.phase === 'draft' ? 'Relic draft' : TYPES[S.room]; seedEl.textContent = 'Seed ' + S.seed; };
function newRun(seed) {
  S.seed = seed == null ? Math.floor(Math.random() * 99999) : seed; S.rng = mulberry(S.seed); S.depth = 1; S.room = 0; S.relics = []; S.turns = 0; S.phase = 'play';
  S.p = { x: 2, y: 4, hp: 20, mhp: 20, atk: 4, shield: 0 }; build(); hud(); msg.textContent = 'Depth 1. Bump an enemy to strike. Watch the red telegraphs.';
}
function build() {
  S.grid = Array.from({ length: GH }, (_, y) => Array.from({ length: GW }, (_, x) => x === 0 || y === 0 || x === GW - 1 || y === GH - 1 ? '#' : (S.rng() < 0.08 ? '#' : '.')));
  S.p.x = 2; S.p.y = 4; S.grid[4][2] = '.';
  const type = TYPES[S.room], n = type === 'Boss' ? 1 : type === 'Rest' ? 0 : type === 'Treasure' ? 1 : 1 + Math.floor(S.rng() * (type === 'Elite' ? 3 : 2));
  S.enemies = [];
  for (let i = 0; i < n; i++) {
    let x, y, guard = 0; do { x = 4 + Math.floor(S.rng() * (GW - 6)); y = 1 + Math.floor(S.rng() * (GH - 2)); } while ((S.grid[y][x] !== '.' || Math.abs(x - S.p.x) + Math.abs(y - S.p.y) < 3) && guard++ < 60);
    const boss = type === 'Boss', elite = type === 'Elite';
    const e = { x, y, hp: boss ? 24 + S.depth * 4 : elite ? 14 : 7 + S.depth * 2, max: 0, atk: boss ? 6 : elite ? 5 : 3, intent: null, frost: 0, boss };
    e.max = e.hp; S.enemies.push(e);
  }
  for (const e of S.enemies) telegraph(e);
}
function telegraph(e) { e.intent = (S.rng() < 0.5 || Math.abs(e.x - S.p.x) > Math.abs(e.y - S.p.y)) ? [S.p.x, S.p.y] : [e.x, e.y === S.p.y ? S.p.y : S.p.y + Math.sign(S.p.y - e.y)]; }
function has(r) { return S.relics.includes(r); }
function strike(e, first) {
  let dmg = S.p.atk + (has('lens') ? 2 : 0) + (has('echo') && S.turns % 2 === 0 && first ? S.p.atk : 0);
  e.hp -= dmg; beep(420);
  if (has('spark')) { const other = S.enemies.find((o) => o !== e && o.hp > 0); if (other) other.hp -= Math.ceil(dmg / 2); }
  if (e.hp <= 0 && has('vamp')) S.p.hp = Math.min(S.p.mhp, S.p.hp + 2);
  if (e.hp <= 0 && has('frost')) for (const o of S.enemies) if (o.hp > 0) o.frost = 1;
}
function afterPlayer() {
  S.turns++;
  if (!S.enemies.some((e) => e.hp > 0)) { if (S.room === TYPES.length - 1) { S.depth++; S.room = -1; } S.room++; if (S.room >= 0) draft(); return; }
  for (const e of S.enemies) {
    if (e.hp <= 0) continue;
    if (e.frost) { e.frost--; telegraph(e); continue; }
    const [tx, ty] = e.intent || [S.p.x, S.p.y];
    if (tx === S.p.x && ty === S.p.y) { const d = Math.max(1, e.atk - (has('ward') ? 1 : 0)); S.p.hp -= Math.max(0, d - S.p.shield); S.p.shield = 0; beep(170); }
    else { e.x += Math.sign(S.p.x - e.x); e.y += Math.sign(S.p.y - e.y); if (S.grid[e.y] && S.grid[e.y][e.x] === '#') { e.x -= Math.sign(S.p.x - e.x); e.y -= Math.sign(S.p.y - e.y); } }
    telegraph(e);
  }
  if (S.p.hp <= 0) { S.phase = 'dead'; msg.textContent = 'The spire took you at depth ' + S.depth + '. New run to try another seed.'; }
  hud(); draw();
}
function draft() {
  const pool = RELICS.filter((r) => !S.relics.includes(r.id)); const picks = [];
  for (let i = 0; i < 3 && pool.length; i++) picks.push(pool.splice(Math.floor(S.rng() * pool.length), 1)[0]);
  S.phase = 'draft'; draftEl.style.display = 'flex'; draftEl.innerHTML = '<strong>Choose one relic for this run</strong>';
  for (const r of picks) { const b = document.createElement('button'); b.type = 'button'; b.textContent = r.name + ' — ' + r.text; b.onclick = () => { S.relics.push(r.id); if (!S.codex.includes(r.id)) { S.codex.push(r.id); try { localStorage.setItem('a2m.voidspire.codex.v1', JSON.stringify(S.codex)); } catch (_) {} } draftEl.style.display = 'none'; S.phase = 'play'; build(); hud(); draw(); msg.textContent = r.name + ' joined the run. Relics found: ' + S.codex.length + '/' + RELICS.length + '.'; }; draftEl.appendChild(b); }
  build(); hud(); draw();
}
function move(dx, dy) {
  if (S.phase !== 'play') return;
  const x = S.p.x + dx, y = S.p.y + dy; if (S.grid[y] && S.grid[y][x] === '#') return;
  const e = S.enemies.find((o) => o.x === x && o.y === y && o.hp > 0);
  if (e) { strike(e, true); if (has('ward')) S.p.shield = Math.min(3, S.p.shield + 1); }
  else { S.p.x = x; S.p.y = y; if (has('ward')) S.p.shield = Math.min(3, S.p.shield + 1); }
  afterPlayer();
}
function skill(n) {
  if (S.phase !== 'play') return;
  if (n === 1) { const e = S.enemies.find((o) => o.hp > 0); if (!e) return; strike(e, true); msg.textContent = 'Chain spark fired. It jumps to a second enemy when you own Chain Spark.'; }
  if (n === 2) { for (const e of S.enemies) e.frost = 1; msg.textContent = 'Frost holds every enemy for one turn.'; }
  if (n === 3) { S.p.hp = Math.min(S.p.mhp, S.p.hp + 5); msg.textContent = 'Mended 5 HP.'; }
  beep(560); afterPlayer();
}
function draw() {
  g.fillStyle = '#0a0f22'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const t = S.grid[y][x]; g.fillStyle = t === '#' ? '#2b3a6b' : '#141a35'; g.fillRect(x * T, y * T, T, T); }
  for (const e of S.enemies) if (e.hp > 0) { if (e.intent) { g.strokeStyle = '#ff6b7e'; g.lineWidth = 2; g.strokeRect(e.intent[0] * T + 2, e.intent[1] * T + 2, T - 4, T - 4); } g.fillStyle = e.boss ? '#ff6b7e' : '#a58bff'; g.fillRect(e.x * T + 4, e.y * T + 4, T - 8, T - 8); g.fillStyle = '#0a0f22'; g.fillRect(e.x * T + 6, e.y * T + 6, T - 12, 2); }
  g.fillStyle = '#f4d58d'; g.fillRect(S.p.x * T + 5, S.p.y * T + 5, T - 10, T - 10);
  g.fillStyle = '#e8e6f5'; g.font = '11px monospace'; g.fillText('Relics: ' + (S.relics.length ? S.relics.join(', ') : 'none'), 4, 12);
}
addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (k === 'arrowup' || k === 'w') move(0, -1); if (k === 'arrowdown' || k === 's') move(0, 1); if (k === 'arrowleft' || k === 'a') move(-1, 0); if (k === 'arrowright' || k === 'd') move(1, 0);
  if (k === '1' || k === '2' || k === '3') skill(Number(k)); });
c.addEventListener('pointerdown', (e) => { if (S.phase !== 'play') return; const r = c.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * W / T), y = Math.floor((e.clientY - r.top) / r.height * H / T); const dx = x - S.p.x, dy = y - S.p.y; if (Math.abs(dx) + Math.abs(dy) === 1) move(dx, dy); });
document.getElementById('new').onclick = () => { newRun(); };
newRun();
