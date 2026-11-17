// game-audit: a CI gate over Verse's cabinet games. Every game in the arcade ladder has a manifest row with
// version, visuals, audio, progression, fps_check, last_upgraded_at, fullscreen and controls. Games marked
// full-screen must actually carry the implementation (DPR-scaled canvas, a fullscreen control, keyboard + touch);
// games still played as cards are reported, not silently passed off as full-screen.
//   node tools/game-audit.mjs          fail on a broken manifest or a claimed-but-missing full-screen game
//   node tools/game-audit.mjs --report also list the games still waiting for the full-screen retrofit
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES } from '../void-live-deploy/lib/ladder.js';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const FIELDS = ['version', 'visuals', 'audio', 'progression', 'fps_check', 'last_upgraded_at', 'fullscreen', 'controls'];
const ARCADE = 'void-live-deploy/arcade/app.js', ARCADE_HTML = 'void-live-deploy/arcade/index.html', CONTROLS = 'void-live-deploy/lib/studio-play.js', JRPG = 'void-live-deploy/games/jrpg/app.js';
const need = (p, bits, why) => { const t = read(p); return bits.filter((b) => !t.includes(b)).map((b) => p + ' is missing ' + b + ' (' + why + ')'); };

/** the full-screen games with their own page under /games/. */
export function gamePages() {
  const dir = resolve(root, 'void-live-deploy/games');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => existsSync(resolve(dir, n, 'app.js')));
}

/** pure validation of one manifest object against the ladder ids and the /games/ pages. */
export function check(manifest, ids = GAMES, extra = []) {
  const bad = [], pending = [];
  const rows = (manifest && manifest.games) || {};
  const allowed = new Set([...ids, ...extra]);
  for (const id of allowed) {
    const m = rows[id];
    if (!m) { bad.push('no manifest row for ' + id); continue; }
    for (const f of FIELDS) if (m[f] === undefined || m[f] === '') bad.push(id + ': missing ' + f);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(m.last_upgraded_at || ''))) bad.push(id + ': last_upgraded_at must be YYYY-MM-DD');
    if (m.fullscreen === false) pending.push(id);
  }
  for (const id of Object.keys(rows)) if (!allowed.has(id)) bad.push('manifest names an unknown game ' + id);
  return { bad, pending };
}

export function checkSources() {
  const arcade = need(ARCADE, ['getContext(', 'devicePixelRatio', 'requestFullscreen'], 'full-screen canvas');
  const controls = need(CONTROLS, ['keydown', 'pointerdown', 'AudioContext'], 'keyboard, touch and audio controls');
  const html = need(ARCADE_HTML, ['100vw', '100vh'], 'full-viewport stage');
  const jrpg = need(JRPG, ['imageSmoothingEnabled = false', 'keydown', 'pointerdown', 'mute', 'requestAnimationFrame'], 'pixel canvas, touch and audio');
  return [...arcade, ...controls, ...html, ...jrpg];
}

function main(argv) {
  if (!existsSync(resolve(root, 'data/game-manifest.json'))) { console.log('FAIL game-audit: data/game-manifest.json is missing'); return 1; }
  const pages = gamePages();
  const { bad, pending } = check(JSON.parse(read('data/game-manifest.json')), GAMES, pages);
  bad.push(...checkSources());
  if (argv.includes('--report')) for (const id of pending) console.log('pending full-screen retrofit: ' + id);
  if (bad.length) { console.log('FAIL game-audit: ' + bad.join(', ')); return 1; }
  console.log('ok game-audit: ' + (GAMES.length + pages.length) + ' games have a manifest' + (pending.length ? ', ' + pending.length + ' still played as cards' : ', all full-screen'));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
