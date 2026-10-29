/**
 * map skill — the assimilation map (row 2 of the skill-file contract).
 * Contract: { name, examples, match(lower, text), run(text, api) }
 * api: { showPage, esc, say, reportMiss, loopLog }
 * Shows the map of how everything already built is being rebuilt as Verse.
 * Mirrors domains\void.assimilate.md (kept light: names + status, no paths).
 */
import { GAMES } from './rack.js';
// brought up to date 2026-10-14 (the growth card listed this skill as the one nothing checks; its rows still read as of
// 2026-09-25); each status names the skill or tool that makes it true, and tools/test_void.mjs checks the rows against them
const MAP = [
  { n: 1, p: 'AutoSalvage + Lab Board', f: 'what people ask that Verse cannot answer yet becomes work', s: 'live (the miss board; a miss asked 3 times becomes a build job, lib/learn.js)' },
  { n: 2, p: 'AI edit engine', f: 'a new skill in plain words, built, checked against every existing skill, live on its own', s: 'live (skill files, tools/new-skill.mjs, the builders and the benchmark)' },
  { n: 3, p: 'Aether dispatcher + bridge', f: '"do this for me" tasks that keep running, with an approve card when a step needs you', s: 'live (automations and watch skills)' },
  { n: 4, p: 'Treaty / ledger / glassbox', f: '"what did you do today": Verse\'s own recent actions', s: 'live (today skill)' },
  { n: 5, p: 'Real Work Board / Job Finder', f: '"find me work as a …": real listings with a check-yourself line', s: 'live (work skill)' },
  { n: 6, p: 'Inventory orchestrator', f: '"already built" rows so agents reuse before rebuilding', s: 'live (inventory skill)' },
  { n: 7, p: 'intent-canvas', f: 'grouping and layers on the stage', s: 'live (group and layer skills)' },
  { n: 8, p: 'Slack ops log', f: 'what the agents are doing', s: 'live (the agent log; the status card shows the build)' },
  { n: 9, p: 'HomeBase / dashboards', f: 'board, agent log and live checks on one summoned page', s: 'live (status card)' },
  { n: 10, p: 'Player Two', f: '"play a game": games on the stage against Verse', s: 'live (the game rack: ' + GAMES.length + ' games)' }, // counted from skills/rack.js, so a new boxed game never leaves this row stale
  { n: 11, p: 'Wikipedia / Wiktionary / Open-Meteo', f: 'answers from open sources, better than the source', s: 'live (articles, define, words, weather)' },
  { n: 12, p: 'Calculation page', f: 'percentages, units, dates, currency', s: 'live (2026-09-25)' },
  { n: 13, p: 'Entering your own Verse', f: 'silent entry on first keep; personal look saved per browser; public surface stays plain', s: 'live (2026-09-25)' },
];
export { MAP };

function run(text, api) {
  const { showPage, esc, reportMiss, loopLog } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>The map</h2><div class="sub">…</div>'; });
  const rows = MAP.map((r) =>
    '<li><b>' + esc(r.p) + '</b> — <span style="color:#9a9a9a">' + esc(r.f) + '</span> <span style="color:#6a6a6a">· ' + esc(r.s) + '</span></li>'
  ).join('');
  el.innerHTML = '<h2>The map</h2>'
    + '<div class="sub">Everything already built, being rebuilt as Verse — one thing, nothing thrown out.</div>'
    + '<ul>' + rows + '</ul>'
    + '<div class="src">Esc or click the void to close.</div>';
  if (loopLog) loopLog({ domain: 'void.map', ask: text, score: 'pass', note: 'map' });
  return 'rebuild-map';
}

export default {
  name: 'rebuild-map',
  examples: ['show the map', 'what is the map', 'the map', "what's being built"],
  match(lower, text) {
    if (/\bmap\s+of\s+(?!everything)/.test(lower)) return false;
    return /\b(show\s+(me\s+)?(the\s+)?map|the\s+map|what\s+is\s+the\s+map|what'?s\s+(on\s+)?the\s+map|what\s+are\s+you\s+building|what'?s\s+being\s+built|map\s+of\s+everything)\b/.test(lower);
  },
  run
};