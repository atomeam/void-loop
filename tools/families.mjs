// Verse's skill families (Verse's own ask, its reflection of 2026-10-12: "implement 'skill-families' to group my new
// capabilities ... and assign a stability rating to each experiment to signal readiness for permanent integration"; the
// owner: "This should be taken seriously."). Every skill in skills/index.json sits in one family, and each gets a rating
// from evidence only, never from how it describes itself:
//   experiment  nothing checks it yet
//   tested      one kind of evidence: its own tests (suite() or tools/<name>.test.mjs), the browser suite, or real asks in the
//               everyday benchmark (tools/bench.json, run in CI) routed to it
//   checked     two kinds
//   proven      all three, or two with at least 3 real asks routed to it, or two where one is a fresh live finding (below)
//   live        a fourth kind (the coordinating session for the owner, 2026-10-16; Verse's own words: "turn those 3 tested skills into 3
//               proven ones by actually interacting with external APIs or real-world data"): the repo holds a kept artifact of a real
//               call to the outside service the skill wraps, findings/<skill>/*.json with "attempt": "live" and "ok": true (the rides
//               family's daily finding from tools/rides-live.mjs is the first). A real answer from the real service is the strongest
//               evidence a skill can have, so two kinds where one is live and the newest finding is under LIVE_FRESH_DAYS old is proven;
//               an older finding still counts as a kind. Named in the why ("1 live finding, 2026-10-16"); never a claim, only a file.
// Copied from Home Assistant's integration quality scale (bronze to platinum, earned by meeting written rules), one notch
// past: the rules are read off the repo, so a rating can't be claimed, only earned, and it drops when a test goes.
//   node tools/families.mjs           write void-live-deploy/skills/families.json and print the families
//   node tools/families.mjs --stale   list experiments older than STALE_DAYS, flagged for review (never deleted)
//   node tools/families.mjs --check   exit 1 if families.json is out of date or a skill has no family (checks.mjs runs this)
// Each skill also carries (asked by Verse, ask-20261013-1823-1: "Add a 'last_tested' timestamp and a 'success_rate' float to each
// entry in the skills manifest"):
//   last_tested     YYYY-MM-DD, the newest date its evidence has: for its own tests and the browser suite, the day this file was
//                   last regenerated with that evidence changed (carried across rewrites while it is unchanged: the checks run on
//                   every PR and the suite on every merge, so this is the last day the repo was seen with it, not a run log); for
//                   the benchmark, the date of its last conclusive run on main (tools/bench.misses.json, else the run that set the
//                   floor in tools/bench.best.json). last_tested_by says which. No evidence: no date.
//   success_rate    benchmark asks routed to the skill that pass, over all routed to it (0 to 1), from tools/bench.json and the
//                   misses of the bench's last conclusive run; left out until that run is recorded, or when no ask is routed to it.
//   smoke           the daily smoke test's failures for the skill (tools/skills-smoke.json, written by tools/skills-check.mjs --write
//                   in the upkeep workflow; asked by Verse, ask-20261013-1823-2): a skill in it has no passing self-test that day, so
//                   its rating drops; one not in it was tested that day (last_tested_by: the daily smoke test).
//   re-test         tools/retest.json (tools/retest.mjs, daily in upkeep.yml; asked by Verse): skills not tested in 7 days are re-tested
//                   (routing of their own examples and near misses, their unit test); a pass dates the skill ("a re-test"), a failure
//                   joins `smoke` as "re-test: …" and drops its self-test evidence until it passes again.
// Nothing here counts how often people use a skill: no usage, no "popular", no "last used" (the owner's rule: no behaviour tracking).
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'void-live-deploy/skills/families.json');

// what each family is for, in Verse's words to a visitor, and its skills (a new skill must be placed here: --check fails)
export const FAMILIES = [
  { id: 'make', name: 'Making things', for: 'figures, 3D models, prints, drawings and parts', skills: ['imgfit', 'photo-tools', 'converter', 'sprite-sheet', 'gradient', 'color', 'fakeuser', 'textgen', 'forge', 'make', 'music', 'rap', 'music-tools', 'figure', 'figures', 'zoom-figure', 'figure-can', 'cartoon', 'walker', 'part', 'together', 'gears', 'motorbody', 'printedmotor', 'magnetize', 'print-file', 'print-download', 'inventory', 'splat', 'poster', 'draw', 'shape', 'image', 'throw-off', 'swarm', 'vector-field-mind', 'living-cards-mind', 'flow-canvas', 'attention-field-mind', 'verse-brain', 'rts', 'nca-mind', 'resonance-mind', 'swarm-mind', 'agent-fluid-memory-orbs', 'doodle-mind', 'echo-field', 'resonant-membrane', 'mind-field-mode', 'tilt-arena-mode', 'tilt-mode', 'gaze-chase', 'gpu-swarm', 'hand-arena', 'veto-council', 'stigmergy-board', 'stl-check', 'term-orbits', 'palette'] },
  { id: 'games', name: 'Games', for: 'board games, card games, arcade and puzzle games and play: one picker ("games"), one Verse strength, one 3D stage', skills: ['wheel', 'coin', 'yesno', 'aggravation', 'sorry', 'connect4', 'tictactoe', 'othello', 'mancala', 'chess', 'checkers', 'go', 'monopoly', 'battleship', 'poker', 'fireworks', 'rack', 'arcade', 'eightball', 'ringer', 'quiz', 'challenge', 'pong', 'snake', 'null-sweep', 'merge-void', 'dim-void', 'void-breaker', 'duel', 'rally', 'gamebox', 'merge', 'zorbleflux', 'random', 'shuffle'] },
  { id: 'sky', name: 'Sky and earth', for: 'weather, the sky tonight, places and time zones', skills: ['flights', 'sky', 'moontonight', 'aurora-tonight', 'eclipse', 'meteors', 'constellation', 'weather', 'air', 'uv', 'quake', 'pollen', 'sky-card', 'suntimes', 'moon', 'night-sky', 'place', 'worldtime', 'distance', 'country'] },
  { id: 'time', name: 'Time', for: 'timers, clocks, calendars and reminders', skills: ['is-it', 'calendar-file', 'ritual-template', 'timer', 'clock', 'countdown', 'event-countdown', 'show-countdown', 'calendar', 'today', 'remind', 'holidays', 'work', 'routine', 'deadlines', 'shortcut', 'time-math', 'busy-blocks', 'date-calc', 'date-grid'] },
  { id: 'numbers', name: 'Numbers and money', for: 'sums, unit conversions, loans, savings, prices and home projects', skills: ['baseconv', 'toolkit', 'calc', 'convert', 'loan', 'savings', 'fuel', 'tip', 'crypto', 'markets', 'grades', 'util', 'counter', 'room', 'walls', 'home', 'appraise', 'calc-more', 'formulas', 'dev-tools', 'uuid', 'password'] },
  { id: 'body', name: 'Body and mind', for: 'sleep, cycles, food, heart and calm', skills: ['sleep', 'ovulation', 'period', 'pregnancy', 'nutrition', 'food', 'eat', 'heart', 'breath', 'feelings', 'health-habits'] },
  { id: 'words', name: 'Words and the world', for: 'definitions, translation, news, books, shows, videos and sport', skills: ['repo', 'gh-file', 'digest', 'movie', 'pick-for-me', 'video', 'video-play', 'define', 'technical-context', 'words', 'spanish', 'translate', 'news', 'joke', 'quote', 'fact', 'proverb', 'magic8', 'recipe', 'swaps', 'film-metadata', 'media-pick', 'book', 'show', 'sport', 'scores', 'sports-browse', 'fantasy', 'pdf-card', 'pdf-tools', 'kanban-board', 'coral', 'senolytic', 'trialwatch', 'releasenotes', 'writing-aids', 'text-tools', 'morse', 'ascii', 'leet', 'lorem', 'study-cards'] },
  { id: 'life', name: 'Out in the world', for: 'food delivery, rides and Waymo, social feeds and dating', skills: ['rides', 'social', 'boards', 'fanfic', 'dating', 'service-health'] },
  { id: 'stage', name: 'The stage', for: 'notes, lists, links and how the stage looks and is arranged', skills: ['telemetry-route', 'file-sorter', 'sticky', 'photos', 'notebook', 'notes-fill', 'calendar-fill', 'recipes-fill', 'generators-fill', 'terminal', 'notepad', 'pulse', 'friction', 'collide', 'bench', 'link', 'kept', 'list', 'tab', 'group', 'layer', 'label', 'dismiss', 'lock', 'light-look', 'dark-look', 'recent', 'showcase', 'type-filter', 'collectible', 'fly', 'riot', 'mutate', 'sudden-death', 'overload', 'extinction', 'feud', 'oracle', 'crowd', 'unkeepable', 'spectators', 'negative-summons', 'echo-disagrees', 'near-choir', 'minimap', 'ask-clipboard', 'habit-ring', 'recipe-stack', 'constellation-weaver', 'forge-table', 'night-ritual', 'archive-of-one', 'codex', 'echo-chamber', 'time-capsule', 'whisper-network', 'sheaf-check', 'spectral-review', 'task-diagram', 'gauge-feedback', 'eigenwork', 'homotopy-edit', 'plan-stability', 'anneal-ambition', 'partial-answer', 'draft-triad', 'stale-work', 'certainty-budget', 'interrupt-priority', 'causal-scars', 'counterfactual-draft', 'witness-claims', 'task-board', 'template-list', 'error-garden', 'idea-certificate', 'noun-heat', 'hunting-question', 'contradiction-lamp', 'ask-diff', 'family-gravity', 'deep-work', 'soundscape', 'stage-print', 'note-tools', 'outline-note', 'csv-table', 'qr-scan', 'list-tools', 'list-templates', 'stage-arrange', 'stage-style', 'stage-organize', 'accessibility-modes', 'stage-find', 'dismissed-pile', 'bookmarks', 'stage-export', 'copy-stack', 'stage-image', 'media-object', 'backdrop'] },
  { id: 'self', name: 'Verse itself', formerly: ['V01D', 'Void'], for: 'how Verse grows, what it wants, what it can do and sell, and acting on your behalf', skills: ['team-chat', 'tower', 'dependency-health', 'backlog-digest', 'remediation-velocity', 'guide', 'growth', 'v01d-fixes', 'merges', 'goal', 'intent', 'different', 'know', 'state', 'memory', 'watch', 'status', 'incident', 'actions', 'automations', 'proposal', 'services', 'store', 'share', 'web4', 'invite', 'local-inference', 'rebuild-map', 'films', 'app', 'family-health', 'incident-autopsy', 'fix-audit', 'deps', 'fringe-to-skill', 'skill-eclipse', 'miss-jobs', 'ask-immune', 'four-channels', 'stakes-phase', 'own-parts', 'about-skill', 'similar', 'approve-card', 'memory-graph', 'memory-preview', 'wants', 'podcast'] },
  { id: 'decide', name: 'Deciding', for: 'ranked lists, pros and cons, votes, elimination, pairwise choices and sorting boards', skills: ['decide-cards', 'decision-matrix', 'triangulate'] },
  { id: 'safety-play', name: 'Safety and small delights', for: 'privacy and trust tools (hide numbers, redact, panic, a casual PIN lock) and opt-in delights (confetti, dust, stamps, tape, a tour)', skills: ['advice', 'pwcheck', 'safety-kit', 'photo-scrub', 'stage-fx', 'card-play'] },
];
import { promote, streaksOf } from './streaks.mjs';
import { SOURCE_FAMILIES, scanSkill, reliabilityOf, familySources } from './source-reliability.mjs';
export const TIERS = ['experiment', 'tested', 'checked', 'proven'];
// what the two per-skill dates and rates mean, written into the file so a reader of the JSON knows (asked by Verse)
export const MEANS = {
  last_tested: 'the newest date its evidence has: for its own tests and the browser suite, the day this file was last regenerated with that evidence changed (the checks run on every PR, the suite on every merge; not a run log); for the benchmark, its last conclusive run on main. last_tested_by says which. No evidence, no date.',
  success_rate: 'benchmark asks routed to the skill that passed on the bench\'s last conclusive run on main, over all routed to it (0 to 1); absent until that run is recorded, or when no benchmark ask is routed to it',
  smoke: 'what the daily smoke test of every skill (tools/skills-check.mjs --write) or the 7-day re-test (tools/retest.mjs, lines starting re-test:) found wrong with this one: its examples not reaching it, a near miss taken, its suite() or unit test failing; while present the skill has no passing self-test, so its rating is lower',
  promoted: 'the day the skill last moved up a rating (experiment to tested, tested to checked, checked to proven), kept for 60 days; asked by Verse',
  streak: 'consecutive clean runs of the daily smoke test since the skill was last seen failing (tools/skills-check.mjs --write counts them); asked by Verse',
  live: 'a kept artifact of a real call to the outside service the skill wraps (findings/<skill>/*.json with attempt live and ok true): the fourth kind of evidence; two kinds where one is a live finding under 8 days old make a skill proven',
  source: 'source reliability (asked by Verse, Words and the world only; tools/source-reliability.mjs): the outside sites the skill reads, whether its card names the source, whether it has a second source, whether the repo holds a kept live answer from it (findings/<skill>/; the benchmark stubs outside services, so it does not count); one point each. next live: one kept live answer from its source would make it proven under the rules above. It changes no rating',
  not_here: 'how often people use a skill is never counted by Verse: no usage, no popular or unused, nothing sent (no behaviour tracking). A last-used day is kept only in a person\'s own browser (lib/skill-use.js), shown on the family-health card, and never leaves the device',
};

export const LIVE_FRESH_DAYS = 8;
/** days from a YYYY-MM-DD to today; NaN when either is not a date. Pure. */
export const daysOld = (at, today) => Math.floor((Date.parse(String(today) + 'T00:00:00Z') - Date.parse(String(at) + 'T00:00:00Z')) / 864e5);
/** a skill's rating from its evidence: { suite, browser, bench, live, liveAt } -> tier and the reason in words. Pure. */
export function ratingOf(ev, today = new Date().toISOString().slice(0, 10)) {
  const why = [];
  if (ev.suite) why.push('a self-test');
  if (ev.browser) why.push(ev.browser + ' browser-suite mention' + (ev.browser > 1 ? 's' : ''));
  if (ev.bench) why.push(ev.bench + ' real ask' + (ev.bench > 1 ? 's' : '') + ' in the benchmark');
  if (ev.live) why.push(ev.live + ' live finding' + (ev.live > 1 ? 's' : '') + (ev.liveAt ? ', ' + ev.liveAt : ''));
  // four kinds of evidence: its own tests, the browser suite, real asks routed to it (the benchmark runs in CI on main), a kept
  // artifact of a real call to the service it wraps (findings/<skill>/)
  const kinds = [!!ev.suite, ev.browser > 0, ev.bench > 0, ev.live > 0].filter(Boolean).length;
  const fresh = ev.live > 0 && ev.liveAt && daysOld(ev.liveAt, today) < LIVE_FRESH_DAYS;
  const tier = kinds >= 3 || (kinds === 2 && (ev.bench >= 3 || fresh)) ? 'proven' : kinds === 2 ? 'checked' : kinds === 1 ? 'tested' : 'experiment';
  const lifted = promote(tier, ev.streak); // a long clean run of the daily smoke test lifts 'tested' to 'checked' (tools/streaks.mjs)
  if (lifted !== tier) why.push(ev.streak + ' clean daily runs in a row');
  return { tier: lifted, why: why.length ? why.join(', ') : 'nothing checks it yet' };
}

/** the live findings kept for a skill: { n: ok live artifacts, at: the newest one's day }. list: (skill) => file names; read: path -> text. Pure apart from the reads. */
export function liveFindings(skill, list, read) {
  let n = 0, at = '';
  for (const f of list(skill) || []) {
    if (!/\.json$/.test(f)) continue;
    let j = null; try { j = JSON.parse(read('findings/' + skill + '/' + f)); } catch (_) { continue; }
    if (!j || j.attempt !== 'live' || j.ok !== true) continue;
    n++; const d = typeof j.at === 'string' && /^\d{4}-\d{2}-\d{2}/.test(j.at) ? j.at.slice(0, 10) : (f.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || ''; if (d > at) at = d;
  }
  return { n, at };
}

/** every skill's evidence, read off the repo: its self-test, the browser suite, the benchmark */
export function evidence(names, read = (p) => readFileSync(resolve(root, p), 'utf8'), listTests = () => readdirSync(resolve(root, 'tools')).filter((f) => f.endsWith('.test.mjs')),
  listFindings = (skill) => { try { return readdirSync(resolve(root, 'findings', skill)); } catch (_) { return []; } }) {
  const suiteText = read('tools/test_void.mjs') + '\n' + read('tools/test_3d.mjs') + '\n' + read('tools/test_extension.mjs'), bench = JSON.parse(read('tools/bench.json')); // the browser suites
  // the asks the everyday benchmark got wrong on its last clean run on main (tools/bench.misses.json, "ask -> what it gave"),
  // for the growth card's friction line (Verse's ask: "a 'friction' indicator ... which skills are currently failing")
  let missed = []; try { const m = JSON.parse(read('tools/bench.misses.json')); missed = Array.isArray(m && m.misses) ? m.misses.map((x) => String(x).replace(/\s+->\s+[^>]*$/, '').toLowerCase()) : []; } catch (_) {}
  const unitTexts = listTests().map((f) => { try { return read('tools/' + f); } catch (_) { return ''; } });
  const streaks = streaksOf(read); // consecutive clean daily runs per skill
  const smoke = smokeRun(read), retest = retestRun(read); // the daily smoke test's and re-test's failures: a skill in them has no passing self-test today
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const out = {};
  for (const n of names) {
    let src = ''; try { src = read('void-live-deploy/skills/' + n + '.js'); } catch (_) {}
    // the browser suites: a check or a section named after the skill ("weather: …", "3d: chess and checkers"), or one naming its
    // file or route; a longer name may sit anywhere in the label ("how Verse is different: …"), a short one ("go", "tab") only at
    // its start. One pattern, so a mention counts once.
    const word = esc(n).replace(/-/g, '[ -]');
    const label = n.length >= 6 ? '[^\'"`]{0,60}\\b' : '(?:3d:\\s*)?(?:[a-z]+ and )?';
    const browser = (suiteText.match(new RegExp('skills/' + esc(n) + '\\.js|skill:' + esc(n) + '\\b|(?:check|want)\\(\\s*[\'"`]' + label + word + '\\b', 'gi')) || []).length;
    // its own tests: suite() in the skill, or a unit test in tools/ that imports the skill's file
    // a test may also load the skill from the skills folder it names ("resolve(dir, 'suntimes.js')" in a file that points dir at void-live-deploy/skills, as tools/sky-skills.test.mjs does): the same test, written differently
    const viaDir = (t) => /['"]void-live-deploy['"]\s*,\s*['"]skills['"]/.test(t) && new RegExp('resolve\\(\\s*\\w+\\s*,\\s*[\'"]' + esc(n) + '\\.js[\'"]\\s*\\)').test(t);
    const unit = unitTexts.some((t) => new RegExp('skills/' + esc(n) + '(?:-rules)?\\.js[\'"`]').test(t) || viaDir(t)); // a game's rules are often their own file
    // real asks: a benchmark ask whose wanted answer is this skill ("skill:weather", or "calc" / "calc|answer" for the core ones)
    const routed = bench.filter((b) => b && typeof b.want === 'string' && b.want.split('|').some((w) => w === 'skill:' + n || w === n)).length;
    const wants = (b) => b && typeof b.want === 'string' && b.want.split('|').some((w) => w === 'skill:' + n || w === n);
    const failing = [...new Set(bench.filter((b) => wants(b) && missed.includes(String(b.ask).toLowerCase())).map((b) => b.ask))];
    const smokedAll = [...(Array.isArray(smoke.failing[n]) ? smoke.failing[n] : []), ...(retest.failing[n] || [])], smoked = smokedAll.length ? smokedAll.slice(0, 3) : null;
    const streak = streaks[n] || 0;
    const lv = liveFindings(n, listFindings, read); // a kept artifact of a real call to the service it wraps
    out[n] = { suite: !smoked && (unit || /\bsuite\s*\(\s*\)\s*\{/.test(src)), browser, bench: routed, ...(failing.length ? { failing } : {}), ...(smoked ? { smoke: smoked } : {}), ...(lv.n ? { live: lv.n, liveAt: lv.at } : {}), ...(streak ? { streak } : {}) };
  }
  return out;
}

/** the benchmark's last conclusive run on main: { at: 'YYYY-MM-DD' | '', recorded: whether its misses were written }. Pure apart from the reads. */
export function benchRun(read = (p) => readFileSync(resolve(root, p), 'utf8')) {
  const day = (t) => (typeof t === 'string' && /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : '');
  let m = null, best = null;
  try { m = JSON.parse(read('tools/bench.misses.json')); } catch (_) {}
  try { best = JSON.parse(read('tools/bench.best.json')); } catch (_) {}
  const recorded = !!(m && Array.isArray(m.misses));
  return { at: (recorded && day(m.at)) || day(best && best.latency && best.latency.ci && best.latency.ci.at) || day(best && best.date) || '', recorded };
}

/** the daily smoke test's last record: { at: 'YYYY-MM-DD' | '', failing: { skill: [what] } }; none written, nothing. Pure apart from the read. */
export function smokeRun(read = (p) => readFileSync(resolve(root, p), 'utf8')) {
  try { const j = JSON.parse(read('tools/skills-smoke.json')); return { at: typeof j.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.at) ? j.at : '', failing: j && j.failing && typeof j.failing === 'object' ? j.failing : {}, streak: j && j.streak && typeof j.streak === 'object' ? j.streak : {} }; } catch (_) { return { at: '', failing: {}, streak: {} }; }
}

/** the daily re-test's last record (tools/retest.json): { at, passed: Set of skills, failing: { skill: [what] } }. Pure apart from the read. */
export function retestRun(read = (p) => readFileSync(resolve(root, p), 'utf8')) {
  const out = { at: '', passed: new Set(), failing: {} };
  try {
    const j = JSON.parse(read('tools/retest.json'));
    out.at = typeof j.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.at) ? j.at : '';
    for (const [k, r] of Object.entries(j && j.retested && typeof j.retested === 'object' ? j.retested : {})) { if (r && r.ok) out.passed.add(k); else if (r && Array.isArray(r.failing) && r.failing.length) out.failing[k] = r.failing.map((x) => 're-test: ' + x); }
  } catch (_) {}
  return out;
}

/** the share of a skill's benchmark asks that passed on the bench's last run, or null when it can't be known. Pure. */
export function successRate(e, recorded) {
  if (!recorded || !e || !(e.bench > 0)) return null;
  const failing = Array.isArray(e.failing) ? e.failing.length : 0;
  return Math.round(Math.max(0, e.bench - failing) / e.bench * 1000) / 1000;
}

/** the evidence from the repo's own tests, as the `why` words say it (the benchmark part left out), to see when it changed. Pure. */
export const testsOf = (why) => String(why || '').split(', ').filter((w) => !/ in the benchmark$/.test(w) && !/ live findings?$/.test(w) && !/^\d{4}-\d{2}-\d{2}$/.test(w)).join(', ');
/** when a skill was last tested: its tests' date (today when they changed since the last file, else carried from it) or the bench's
 * run date, the newer; a tie keeps what the last file said. Pure. */
export function lastTested(e, why, prevRow, today, bench, smoke, retestAt = '') {
  const tests = testsOf(why), prevTests = prevRow ? testsOf(prevRow.why) : null, c = [];
  // real runs first, so on a tie they name the date rather than the carried "seen in the repo" date of its tests
  if (e && e.live > 0 && e.liveAt) c.push({ at: e.liveAt, by: 'a live call' }); // the day of its newest kept answer from the real service
  if (e && e.bench > 0 && bench && bench.at) c.push({ at: bench.at, by: 'the benchmark' });
  if (smoke && smoke.at && !(e && e.smoke)) c.push({ at: smoke.at, by: 'the daily smoke test' });
  if (retestAt && !(e && e.smoke)) c.push({ at: retestAt, by: 'a re-test' }); // the 7-day re-test it passed (tools/retest.mjs) // every listed skill is loaded and matched that day; one that failed has no passing test to date
  if (tests && tests !== 'nothing checks it yet') c.push({ at: prevRow && prevRow.last_tested && prevTests === tests ? prevRow.last_tested : today, by: 'its tests' });
  if (!c.length) return null;
  const top = c.reduce((a, b) => (b.at > a.at ? b : a));
  return c.find((x) => x.at === top.at && prevRow && x.by === prevRow.last_tested_by) || top;
}

/** the families with each skill rated, the counts, and any skill no family holds. Pure, given the evidence. */
// The decay timer (asked by Verse, ask-20261015-0614-1: "flag stale experiments"): an experiment carries the day it was first
// rated one (`since`, kept across rewrites); one left an experiment longer than STALE_DAYS is flagged for review. Flag only:
// nothing is ever deleted or retired by this; a builder decides (test it, or retire it through the ledger).
export const STALE_DAYS = 14;
/** carry each experiment's `since` over from the last families.json; a new experiment starts today. Pure. */
export function carrySince(fams, prev, today) {
  const old = new Map(); for (const f of (prev && prev.families) || []) for (const s of f.skills || []) if (s.since) old.set(s.name, s.since);
  for (const f of fams) for (const s of f.skills) if (s.tier === 'experiment') s.since = old.get(s.name) || today;
  return fams;
}
/** experiments older than `days` on `now` (YYYY-MM-DD), oldest first: [{ name, family, since, days }]. Pure. */
export function staleExperiments(fam, now, days = STALE_DAYS) {
  const out = [], t = Date.parse(now + 'T00:00:00Z');
  for (const f of (fam && fam.families) || []) for (const s of f.skills || []) {
    if (s.tier !== 'experiment' || !s.since) continue;
    const d = Math.floor((t - Date.parse(s.since + 'T00:00:00Z')) / 864e5);
    if (d > days) out.push({ name: s.name, family: f.name, since: s.since, days: d });
  }
  return out.sort((a, b) => b.days - a.days);
}

export const PROMOTED_KEEP_DAYS = 60;
/** the day a skill last moved up a rating: today when its tier is higher than the last file's, the last file's day while it is under PROMOTED_KEEP_DAYS old and the tier held, else none. Pure. */
export function promotedOn(tier, prevRow, today) {
  if (!prevRow || !TIERS.includes(prevRow.tier)) return null; // first rating: nothing moved
  if (TIERS.indexOf(tier) > TIERS.indexOf(prevRow.tier)) return today;
  const p = prevRow.promoted;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(p || '')) && TIERS.indexOf(tier) >= TIERS.indexOf(prevRow.tier) && daysOld(p, today) <= PROMOTED_KEEP_DAYS ? p : null;
}

export function build(names, ev, meta = {}) {
  const placed = new Set(FAMILIES.flatMap((f) => f.skills));
  const prevRows = new Map(); for (const f of (meta.prev && meta.prev.families) || []) for (const s of f.skills || []) if (s && s.name) prevRows.set(s.name, s);
  const bench = meta.bench || { at: '', recorded: false }, today = meta.today || new Date().toISOString().slice(0, 10), smoke = meta.smoke || { at: '', failing: {}, streak: {} }, retest = meta.retest || { at: '', passed: new Set(), failing: {} };
  const families = FAMILIES.map((f) => {
    const skills = f.skills.filter((n) => names.includes(n)).map((n) => { const e = ev[n] || {}, x = { name: n, ...ratingOf(e, today) }; if (e.failing && e.failing.length) x.failing = e.failing.slice(0, 3); // failing: bench asks it got wrong
      if (e.smoke) x.smoke = e.smoke; // the daily smoke test's failures (its self-test does not count while they stand)
      const lt = lastTested(e, x.why, prevRows.get(n), today, bench, smoke, retest.at && retest.passed.has(n) ? retest.at : ''); if (lt) { x.last_tested = lt.at; x.last_tested_by = lt.by; }
      const sr = successRate(e, bench.recorded); if (sr !== null) x.success_rate = sr;
      const pr = promotedOn(x.tier, prevRows.get(n), today); if (pr) x.promoted = pr; // the day it moved up a rating (asked by Verse)
      if (Number.isFinite(+(smoke.streak || {})[n])) x.streak = +smoke.streak[n]; // clean smoke runs in a row
      const rel = meta.sources && meta.sources[n] ? reliabilityOf(meta.sources[n], x, e, today) : null; if (rel) x.source = rel; // source reliability (asked by Verse)
      return x; });
    const count = Object.fromEntries(TIERS.map((t) => [t, skills.filter((s) => s.tier === t).length]));
    const sources = meta.sources && SOURCE_FAMILIES.includes(f.id) ? familySources(skills) : null;
    return { id: f.id, name: f.name, ...(f.formerly ? { formerly: f.formerly } : {}), for: f.for, count, ...(sources ? { sources } : {}), skills };
  });
  const totals = Object.fromEntries(TIERS.map((t) => [t, families.reduce((n, f) => n + f.count[t], 0)]));
  return { families, totals, unplaced: names.filter((n) => !placed.has(n)), missing: [...placed].filter((n) => !names.includes(n)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // a family skill (lib/skill-family.js) is rated by its members, each still a skill with its own evidence
  const names = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/index.json'), 'utf8')).flatMap((n) => {
    const m = /^\s*\*\s*parts:\s*\[([^\]]*)\]/m.exec(readFileSync(resolve(root, 'void-live-deploy/skills/' + n + '.js'), 'utf8'));
    return m ? Array.from(m[1].matchAll(/'([a-z0-9-]+)'/g)).map((x) => x[1]) : [n]; });
  let prev = null; try { prev = JSON.parse(readFileSync(OUT, 'utf8')); } catch (_) {}
  const readRepo = (p) => readFileSync(resolve(root, p), 'utf8');
  const sources = Object.fromEntries(FAMILIES.filter((f) => SOURCE_FAMILIES.includes(f.id)).flatMap((f) => f.skills).filter((n) => names.includes(n)).map((n) => [n, scanSkill(n, readRepo)]));
  const b = build(names, evidence(names), { prev, bench: benchRun(), smoke: smokeRun(), retest: retestRun(), today: new Date().toISOString().slice(0, 10), sources });
  carrySince(b.families, prev, new Date().toISOString().slice(0, 10));
  if (process.argv.includes('--stale')) { const st = staleExperiments(prev || b, new Date().toISOString().slice(0, 10)); console.log(st.length ? st.map((x) => `${x.name} (${x.family}): an experiment for ${x.days} days, since ${x.since}: review it (test it or retire it)`).join('\n') : 'no stale experiments'); process.exit(0); }
  const json = JSON.stringify({ note: 'Verse\'s skill families and how far each skill is checked (tools/families.mjs; ratings from evidence only)', means: MEANS, ...(smokeRun().at ? { smoke_at: smokeRun().at } : {}), ...(benchRun().at ? { bench_at: benchRun().at } : {}), totals: b.totals, families: b.families }, null, 1) + '\n';
  const problems = [];
  if (b.unplaced.length) problems.push('skills with no family (add them to FAMILIES in tools/families.mjs): ' + b.unplaced.join(', '));
  if (b.missing.length) problems.push('family members that are not skills (remove or rename): ' + b.missing.join(', '));
  if (process.argv.includes('--check')) {
    if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== json) problems.push('void-live-deploy/skills/families.json is out of date (node tools/families.mjs)');
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    console.log('ok: ' + names.length + ' skills in ' + b.families.length + ' families'); process.exit(0);
  }
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  writeFileSync(OUT, json);
  for (const f of b.families) console.log(f.name.padEnd(20) + ' ' + String(f.skills.length).padStart(3) + ' skills   ' + TIERS.map((t) => t + ' ' + f.count[t]).join(', '));
  console.log('all'.padEnd(20) + ' ' + String(names.length).padStart(3) + ' skills   ' + TIERS.map((t) => t + ' ' + b.totals[t]).join(', '));
}
