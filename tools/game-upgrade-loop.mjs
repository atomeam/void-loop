#!/usr/bin/env node
// The game upgrade loop: ranks the cabinet's full-screen games by weakest polish area, then prints targeted
// upgrade `job:` specs and the missing genres worth building next. It WRITES NOTHING and opens no PR here:
// the #work queue / grow-self.yml decides what to act on. Every spec is bounded to one game or one genre.
//   node tools/game-upgrade-loop.mjs [--n 3] [--self-test]
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const MANIFEST = resolve(root, 'data/game-manifest.json');
const NOW = () => Date.now();

/** polish score: lower means more in need of an upgrade. Pure. */
export function polish(row, now = NOW()) {
  const days = Math.max(0, Math.floor((now - Date.parse((row && row.last_upgraded_at) || '1970-01-01')) / 864e5));
  const weak = [['visuals', /card|plain|generic/i], ['audio', /none|silent/i], ['progression', /none|ladder only/i]];
  let score = 100 - Math.min(60, days);
  for (const [field, pattern] of weak) if (!row || !row[field] || pattern.test(String(row[field]))) score -= 12;
  if (row && row.fps_check === false) score -= 10;
  return Math.max(0, score);
}

export const GENRES = ['action-platformer', 'tactical-strategy', 'tower-defense', 'racing', 'puzzle-adventure', 'rhythm', 'space-sim'];

/** one bounded job for a game's weakest area. Pure. */
export function upgradeSpec(id, row) {
  const area = !row.audio || /none/i.test(String(row.audio)) ? 'audio' : !row.visuals || /card|plain/i.test(String(row.visuals)) ? 'visuals' : 'progression';
  const what = area === 'audio' ? 'add WebAudio music and sound cues with a mute toggle' : area === 'visuals' ? 'replace generic art with topic-matched pixel art and a clean HUD' : 'add a new mechanic, stage or boss and keep progress on this device';
  return `job: upgrade ${id} (${area})\nSPEC (follow strictly — change only what this asks):\n1. ${what}.\n2. Keep the full-viewport canvas, the relaxed readable pace and the existing device save working.\n3. Add a targeted test, run node tools/pre-pr.mjs and VOID_SKIP_BENCH=1 node tools/checks.mjs --changed, and open one PR to main with label automerge.`;
}

/** one bounded job for a genre Verse has not built yet. Pure. */
export function genreSpec(genre) {
  return `job: build a full-screen Verse ${genre} game\nSPEC (follow strictly — change only what this asks):\n1. Verse's own version at /games/${genre}/: an integer-scaled full-viewport canvas with keyboard, pointer and touch controls and WebAudio with mute.\n2. Fun and easy from the first minute, with a relaxed readable pace and progression that stays on this device.\n3. Register it in data/game-manifest.json, docs/MAP.md and a tools/real-pages.mjs spec; run node tools/pre-pr.mjs and VOID_SKIP_BENCH=1 node tools/checks.mjs --changed; open one PR to main with label automerge.`;
}

/** the ranked work: upgrades first, then missing genres. Pure. */
export function plan(manifest, n = 3) {
  const rows = (manifest && manifest.games) || {};
  const full = Object.entries(rows).filter(([, r]) => r && r.fullscreen === true);
  const upgrades = full.map(([id, row]) => ({ id, row, score: polish(row) })).sort((a, b) => a.score - b.score).slice(0, n);
  const built = Object.keys(rows).join(' ') + ' ' + upgrades.map((u) => u.id).join(' ');
  const genres = GENRES.filter((g) => !new RegExp(g.replace('-', '.*')).test(built));
  return { upgrades, genres };
}

function selfTest() {
  const m = { games: { a: { fullscreen: true, visuals: 'card frame', audio: 'none', progression: 'ladder', fps_check: false, last_upgraded_at: '2026-01-01' }, b: { fullscreen: false, visuals: 'pixel', audio: 'WebAudio', progression: 'save', fps_check: true, last_upgraded_at: '2026-11-17' } } };
  const p = plan(m, 1);
  if (p.upgrades.length !== 1 || p.upgrades[0].id !== 'a') throw new Error('plan: the weakest full-screen game should come first');
  if (!/audio/.test(upgradeSpec('a', m.games.a))) throw new Error('upgrade spec: missing weakest area');
  if (!/job: build/.test(genreSpec('racing'))) throw new Error('genre spec: missing job');
  console.log('ok game-upgrade-loop: ranking, upgrade spec and genre spec (offline)');
  return 0;
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest();
  if (!existsSync(MANIFEST)) { console.log('FAIL game-upgrade-loop: data/game-manifest.json is missing'); return 1; }
  const n = Math.max(1, Math.min(5, Number(argv[argv.indexOf('--n') + 1]) || 3));
  const { upgrades, genres } = plan(JSON.parse(readFileSync(MANIFEST, 'utf8')), n);
  console.log('# game upgrade loop — planned, nothing queued or written\n');
  for (const u of upgrades) console.log('## ' + u.id + ' — polish ' + u.score + '\n' + upgradeSpec(u.id, u.row) + '\n');
  for (const g of genres.slice(0, n)) console.log('## new genre: ' + g + '\n' + genreSpec(g) + '\n');
  console.log('# end of plan');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c)).catch((e) => { console.error('game-upgrade-loop: ' + (e.message || e)); process.exit(1); });
