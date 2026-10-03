/**
 * map skill — the assimilation map (row 2 of the skill-file contract).
 * Contract: { name, examples, match(lower, text), run(text, api) }
 * api: { showPage, esc, say, reportMiss, loopLog }
 * Shows the map of how everything already built is being rebuilt as Void.
 * Mirrors domains\void.assimilate.md (kept light: names + status, no paths).
 */
const MAP = [
  { n: 1, p: 'AutoSalvage + Lab Board', f: 'misses now; next: approve / reject / build this per row', s: 'v1 live (misses)' },
  { n: 2, p: 'AI edit engine', f: 'someone asks Void for a new skill in plain words; it builds, checks every existing skill still works, and goes live on its own', s: 'step 1 live (skill files), biggest win' },
  { n: 3, p: 'Aether dispatcher + bridge', f: '"do this for me" tasks that keep running, with an approve card when a step needs you', s: 'not started' },
  { n: 4, p: 'Treaty / ledger / glassbox', f: '"what did you do today" — a page of Void\'s own recent actions with sources', s: 'live (today skill)' },
  { n: 5, p: 'Real Work Board / Job Finder', f: '"find me work as a …" — real listings with a check-yourself line', s: 'live (work / Remotive)' },
  { n: 6, p: 'Inventory orchestrator', f: 'feeds the board "already built" rows so agents reuse before rebuilding', s: 'not started' },
  { n: 7, p: 'intent-canvas', f: 'grouping + layers on the stage', s: 'queued' },
  { n: 8, p: 'Slack ops log', f: 'void.agents.log.md today; later a "what are the agents doing" page', s: 'log live' },
  { n: 9, p: 'HomeBase / dashboards', f: 'board + agent log + live checks on one summoned page', s: 'partly (board)' },
  { n: 10, p: 'Player Two', f: '"play a game" — a small game on the stage', s: 'not started' },
  { n: 11, p: 'Wikipedia / Wiktionary / Open-Meteo', f: 'answers from open sources, better than the source', s: 'live / weather ready' },
  { n: 12, p: 'Calculation page', f: 'percentages, units, dates, currency', s: 'live (2026-09-25)' },
  { n: 13, p: 'Entering your own Void', f: 'silent entry on first keep; personal look saved per browser; public surface stays plain', s: 'live (2026-09-25)' },
];

function run(text, api) {
  const { showPage, esc, reportMiss, loopLog } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>The map</h2><div class="sub">…</div>'; });
  const rows = MAP.map((r) =>
    '<li><b>' + esc(r.p) + '</b> — <span style="color:#9a9a9a">' + esc(r.f) + '</span> <span style="color:#6a6a6a">· ' + esc(r.s) + '</span></li>'
  ).join('');
  el.innerHTML = '<h2>The map</h2>'
    + '<div class="sub">Everything already built, being rebuilt as Void — one thing, nothing thrown out.</div>'
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