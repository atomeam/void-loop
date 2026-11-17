// Verse JRPG: a small, full-screen 16-bit style role-playing game. No third-party IP, no network assets.
// Chapter data is served from /data/jrpg-chapters.json so #work can append acts without changing this engine.
const c = document.getElementById('c'), g = c.getContext('2d'), W = 320, H = 180, T = 16;
g.imageSmoothingEnabled = false;
const msg = document.getElementById('msg'), place = document.getElementById('place');
const fit = () => { const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H))); c.style.width = W * s + 'px'; c.style.height = H * s + 'px'; c.style.left = (innerWidth - W * s) / 2 + 'px'; c.style.top = (innerHeight - H * s) / 2 + 'px'; };
addEventListener('resize', fit); fit();
if (matchMedia('(pointer:coarse)').matches || innerWidth < 720) document.getElementById('pad').style.display = 'grid';

let audio = null, muted = false;
const beep = (f = 440, d = 0.08) => { if (muted) return; try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), v = audio.createGain(); o.type = 'square'; o.frequency.value = f; v.gain.value = 0.05; o.connect(v).connect(audio.destination); o.start(); o.stop(audio.currentTime + d); } catch (_) {} };
document.getElementById('mute').onclick = (e) => { muted = !muted; e.target.textContent = muted ? 'Sound off' : 'Sound on'; beep(660); };

const S = { chapter: null, map: 'town', x: 2, y: 1, party: [], enemy: null, mode: 'world', lines: [], line: 0, pops: [], flags: {}, step: 0, menu: 0, holding: false };
const fresh = () => S.party = [{ name: 'Kite', hp: 30, mhp: 30, mp: 10, mmp: 10, atk: 6, def: 2, spd: 8, lvl: 1, xp: 0 }, { name: 'Moth', hp: 24, mhp: 24, mp: 14, mmp: 14, atk: 5, def: 1, spd: 9, lvl: 1, xp: 0 }];
const active = () => S.party.find((p) => p.hp > 0);
const say = (t) => { msg.textContent = t; };
const key = 'a2m.jrpg.save.v1';

function save() { try { localStorage.setItem(key, JSON.stringify({ map: S.map, x: S.x, y: S.y, party: S.party, flags: S.flags, chapter: S.chapter && S.chapter.id })); beep(880); say('Saved on this device.'); } catch (_) { say('This browser did not allow saving.'); } }
function load(d) { try { const j = d || JSON.parse(localStorage.getItem(key) || 'null'); if (!j || !j.party) { say('No save found.'); return; } Object.assign(S, { map: j.map, x: j.x, y: j.y, party: j.party, flags: j.flags || {} }); say('Save loaded — ' + S.map + '.'); beep(720); } catch (_) { say('That save could not be read.'); } }
document.getElementById('save').onclick = save;
document.getElementById('load').onclick = () => load();
document.getElementById('export').onclick = async () => { const s = btoa(JSON.stringify({ map: S.map, x: S.x, y: S.y, party: S.party, flags: S.flags })); try { await navigator.clipboard.writeText(s); say('Save string copied (' + s.length + ' chars).'); } catch (_) { say('Save string: ' + s.slice(0, 70) + '…'); } };

function tile(ch) { return ch === '#' ? '#2b3a6b' : ch === '~' ? '#2f6fa8' : '#4b5b8c'; }
function sprite(x, y, kind, frame) {
  const body = kind === 'hero' ? '#f4d58d' : kind === 'npc' ? '#b9a7ff' : kind === 'boss' ? '#ff6b7e' : '#a8d8ff';
  g.fillStyle = '#101426'; g.fillRect(x + 3, y + 2, 10, 3);
  g.fillStyle = body; g.fillRect(x + 4, y + 5, 8, 7);
  g.fillStyle = '#202840'; g.fillRect(x + 5 + (frame % 2), y + 12, 2, 3); g.fillRect(x + 9 - (frame % 2), y + 12, 2, 3);
  g.fillStyle = '#fff'; g.fillRect(x + 5, y + 7, 2, 2); g.fillRect(x + 9, y + 7, 2, 2);
}
function drawWorld() {
  const rows = S.chapter.maps[S.map], t = Math.floor(S.step / 12) % 2;
  g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) { const ch = rows[y][x]; g.fillStyle = tile(ch); g.fillRect(x * T, y * T, T, T); if (ch === 'C') { g.fillStyle = '#c98b3a'; g.fillRect(x * T + 4, y * T + 6, 8, 7); } if (ch === '>') { g.fillStyle = '#7aa7ff'; g.fillRect(x * T + 3, y * T + 4, 10, 10); } if (ch === 'B') sprite(x * T, y * T, 'boss', t); }
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === 'N') sprite(x * T, y * T, 'npc', 0);
  sprite(S.x * T, S.y * T, 'hero', t);
  g.fillStyle = '#e8e6f5'; g.font = '12px monospace'; g.fillText('CH ' + S.chapter.id + ' · ' + S.chapter.title, 4, 12);
}
function drawBattle() {
  g.fillStyle = '#141026'; g.fillRect(0, 0, W, H);
  g.fillStyle = S.enemy.boss ? '#7b2336' : '#233a6b'; g.fillRect(0, 60, W, 70);
  sprite(228, 62, S.enemy.boss ? 'boss' : 'enemy', Math.floor(S.step / 10) % 2);
  g.fillStyle = '#fff'; g.font = '13px monospace'; g.fillText(S.enemy.name, 150, 56);
  const p = active(); if (!p) return;
  g.fillStyle = '#e8e6f5'; g.fillText(p.name + '  LV' + p.lvl, 8, 100);
  g.fillStyle = '#333'; g.fillRect(8, 106, 110, 7); g.fillStyle = '#5fd39a'; g.fillRect(8, 106, 110 * Math.max(0, p.hp / p.mhp), 7);
  g.fillStyle = '#333'; g.fillRect(8, 117, 110, 7); g.fillStyle = '#7aa7ff'; g.fillRect(8, 117, 110 * Math.max(0, p.mp / p.mmp), 7);
  const cmds = ['Attack', 'Skill (3 MP)', 'Potion', 'Defend'];
  cmds.forEach((s, i) => { g.fillStyle = i === S.menu ? '#a58bff' : '#2b3a6b'; g.fillRect(8 + i * 74, 142, 70, 24); g.fillStyle = '#fff'; g.font = '11px monospace'; g.fillText(s, 12 + i * 74, 158); });
  for (const q of S.pops) { g.fillStyle = '#ffd27a'; g.font = 'bold 15px monospace'; g.fillText(q.t, q.x, q.y); }
}
function frame() { S.step++; S.pops = S.pops.filter((q) => (q.y -= 0.5) > 0); if (S.mode === 'battle') drawBattle(); else drawWorld(); requestAnimationFrame(frame); }
function pop(t, x = 200, y = 90) { S.pops.push({ t, x, y }); }

function battle(e) { S.enemy = { ...e, hp: e.hp, max: e.hp, phase: 1 }; S.mode = 'battle'; S.menu = 0; say(e.name + ' blocks the way. Choose a command.'); beep(220); }
function win() { const e = S.enemy, xp = e.xp || 20; for (const p of S.party) { if (p.hp <= 0) continue; p.xp += xp; if (p.xp >= p.lvl * 20) { p.xp -= p.lvl * 20; p.lvl++; p.mhp += 6; p.hp = p.mhp; p.atk++; say(p.name + ' reached level ' + p.lvl + '!'); } }
  if (e.boss) { S.flags.ch1done = true; say('Chapter 1 complete — the signal stops. New chapters can be appended to the chapter file.'); }
  S.enemy = null; S.mode = 'world'; beep(880); }
function enemyTurn() { const p = active(), e = S.enemy; if (!p || !e) return; let d = Math.max(1, e.atk + (e.phase === 2 ? 3 : 0) - p.def + (S.defending ? 3 : 0)); p.hp = Math.max(0, p.hp - d); pop('-' + d, 40, 118); beep(140); S.defending = false; if (!active()) { say('Your party cannot continue. Load a save to try again.'); S.mode = 'world'; S.enemy = null; } }
function command() {
  const p = active(), e = S.enemy; if (!p || !e) return;
  if (S.menu === 0) { const d = Math.max(1, p.atk - e.def); e.hp -= d; pop('-' + d); beep(420); }
  if (S.menu === 1) { if (p.mp >= 3) { p.mp -= 3; const d = Math.max(2, 9 + p.atk - e.def); e.hp -= d; pop('-' + d); beep(560); } else say('Not enough MP.'); }
  if (S.menu === 2) { if (p.hp < p.mhp) { p.hp = Math.min(p.mhp, p.hp + 12); pop('+12', 40, 118); beep(660); } else say(p.name + ' is already at full health.'); }
  if (S.menu === 3) { S.defending = true; say(p.name + ' braces for the next hit.'); }
  if (e.hp <= 0 && e.boss && e.phase === 1 && e.max > 30) { e.phase = 2; e.hp = Math.floor(e.max / 2); e.atk += 3; say(e.name + ' changes form!'); beep(180); return; }
  if (e.hp <= 0) { win(); return; }
  enemyTurn(); say(e.name + ' has ' + Math.max(0, e.hp) + ' HP. ' + (p.name + ' ' + p.hp + '/' + p.mhp + ' HP'));
}
function talk() {
  const rows = S.chapter.maps[S.map], at = (x, y) => (rows[y] || '')[x];
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const ch = at(S.x + dx, S.y + dy); if (ch === 'N') { S.lines = S.chapter.dialogue.N; S.line = 0; say(S.lines[0]); beep(520); return true; }
    if (ch === 'C') { rows[S.y + dy] = rows[S.y + dy].split('').map((v, i) => i === S.x + dx ? '.' : v).join(''); const p = active(); p.atk++; say('A small battery. ' + p.name + ' gained 1 ATK.'); beep(780); return true; }
    if (ch === 'B') { if (S.flags.ch1done) { say('The tower is quiet now.'); return true; } battle({ ...S.chapter.boss, boss: true }); return true; } }
  return false;
}
function step(dx, dy) {
  const rows = S.chapter.maps[S.map], nx = S.x + dx, ny = S.y + dy, ch = (rows[ny] || '')[nx];
  if (!ch || ch === '#' || ch === '~') return;
  S.x = nx; S.y = ny; place.textContent = S.map;
  if (ch === '>') { S.map = S.map === 'town' ? 'road' : 'town'; S.x = S.map === 'town' ? 18 : 1; S.y = S.map === 'town' ? 5 : 1; place.textContent = S.map; say('Entered ' + S.map + '.'); return; }
  if (S.map === 'road' && !S.flags.ch1done && Math.random() < 0.06) { const e = S.chapter.enemies[Math.floor(Math.random() * S.chapter.enemies.length)]; battle(e); }
}
addEventListener('keydown', (e) => {
  const k = e.key; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
  if (S.mode === 'battle') { if (k === 'ArrowLeft') S.menu = (S.menu + 3) % 4; if (k === 'ArrowRight') S.menu = (S.menu + 1) % 4; if (k === 'Enter' || k === ' ') command(); return; }
  if (S.lines.length) { if (k === 'Enter' || k === ' ') { S.line++; if (S.line >= S.lines.length) { S.lines = []; say('Move on. Arrows to walk, Enter to talk.'); } else say(S.lines[S.line]); } return; }
  if (k === 'ArrowUp') step(0, -1); if (k === 'ArrowDown') step(0, 1); if (k === 'ArrowLeft') step(-1, 0); if (k === 'ArrowRight') step(1, 0);
  if (k === 'Enter' || k === ' ') talk();
});
for (const b of document.querySelectorAll('#pad button')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); dispatchEvent(new KeyboardEvent('keydown', { key: b.dataset.k })); });

fetch('/data/jrpg-chapters.json').then((r) => r.json()).then((d) => {
  S.chapter = d.chapters[0]; fresh(); const q = S.chapter.spawn; S.map = q.map; S.x = q.x; S.y = q.y; place.textContent = S.map; frame(); say('Chapter 1 — ' + S.chapter.title + '. Arrows to move, Enter to talk.');
}).catch(() => { say('The chapter file could not be read. Reload to try again.'); });
