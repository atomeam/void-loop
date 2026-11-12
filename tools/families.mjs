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
  { id: 'make', name: 'Making things', for: 'figures, 3D models, prints, drawings and parts', skills: ['imgfit', 'photo-tools', 'converter', 'sprite-sheet', 'gradient', 'color', 'fakeuser', 'textgen', 'forge', 'make', 'music', 'rap', 'music-tools', 'figure', 'figures', 'zoom-figure', 'figure-can', 'cartoon', 'image-gen', 'video-gen', 'walker', 'part', 'together', 'gears', 'motorbody', 'printedmotor', 'magnetize', 'print-file', 'print-download', 'inventory', 'splat', 'poster', 'draw', 'shape', 'image', 'throw-off', 'swarm', 'vector-field-mind', 'living-cards-mind', 'flow-canvas', 'attention-field-mind', 'verse-brain', 'rts', 'nca-mind', 'resonance-mind', 'swarm-mind', 'agent-fluid-memory-orbs', 'doodle-mind', 'echo-field', 'resonant-membrane', 'mind-field-mode', 'tilt-arena-mode', 'tilt-mode', 'gaze-chase', 'gpu-swarm', 'hand-arena', 'veto-council', 'stigmergy-board', 'stl-check', 'term-orbits', 'palette'] },
  { id: 'games', name: 'Games', for: 'board games, card games, arcade and puzzle games and play: one picker ("games"), one Verse strength, one 3D stage', skills: ['wheel', 'coin', 'yesno', 'aggravation', 'sorry', 'connect4', 'tictactoe', 'othello', 'mancala', 'chess', 'checkers', 'go', 'monopoly', 'battleship', 'poker', 'fireworks', 'rack', 'arcade', 'eightball', 'ringer', 'quiz', 'challenge', 'pong', 'snake', 'null-sweep', 'merge-void', 'dim-void', 'void-breaker', 'duel', 'rally', 'gamebox', 'merge', 'zorbleflux', 'random', 'shuffle', 'emoji', 'emoji-combos', 'hangman', 'wordladder', 'rps', 'speed-tests', 'math-quiz', 'groups'] },
  { id: 'sky', name: 'Sky and earth', for: 'weather, the sky tonight, places and time zones', skills: ['flights', 'baggage', 'sky', 'moontonight', 'aurora-tonight', 'eclipse', 'meteors', 'constellation', 'weather', 'air', 'uv', 'quake', 'pollen', 'skycard', 'suntimes', 'moon', 'night-sky', 'place', 'worldtime', 'distance', 'country'] },
  { id: 'time', name: 'Time', for: 'timers, clocks, calendars and reminders', skills: ['is-it', 'calendar-file', 'ritual-template', 'timer', 'stopwatch', 'clock', 'countdown', 'event-countdown', 'show-countdown', 'calendar', 'today', 'remind', 'holidays', 'routine', 'deadlines', 'shortcut', 'time-math', 'busy-blocks', 'date-calc', 'date-grid'] },
  { id: 'numbers', name: 'Numbers and money', for: 'sums, unit conversions, loans, savings, prices and home projects', skills: ['baseconv', 'toolkit', 'open-tool', 'calc', 'vat', 'convert', 'loan', 'rentbuy', 'savings', 'fuel', 'drive-share', 'tip', 'crypto', 'stocks', 'markets', 'grades', 'util', 'my-device', 'counter', 'room', 'walls', 'home', 'appraise', 'calc-more', 'formulas', 'dev-tools', 'snippet', 'sums', 'uuid', 'password'] },
  { id: 'body', name: 'Body and mind', for: 'sleep, cycles, food, heart and calm', skills: ['sleep', 'ovulation', 'period', 'pregnancy', 'nutrition', 'food', 'eat', 'recipe', 'heart', 'breath', 'feelings', 'health-habits', 'pointing-arrow', 'noise'] },
  { id: 'words', name: 'Words and the world', for: 'definitions, translation, news, books, shows, videos and sport', skills: ['repo', 'gh-file', 'digest', 'movie', 'pick-for-me', 'video', 'video-play', 'hear', 'define', 'technical-context', 'words', 'spanish', 'translate', 'palindrome', 'news', 'podcast-search', 'local-stations', 'joke', 'riddle', 'compliment', 'quote', 'fact', 'proverb', 'magic8', 'swaps', 'film-metadata', 'media-pick', 'book', 'show', 'sport', 'scores', 'sports-browse', 'fantasy', 'pdf-card', 'pdf-tools', 'kanban-board', 'coral', 'senolytic', 'trialwatch', 'releasenotes', 'writing-aids', 'text-tools', 'morse', 'ascii', 'leet', 'lorem', 'study-cards'] },
  { id: 'life', name: 'Out in the world', for: 'food delivery, rides and Waymo, remote jobs, social feeds and dating', skills: ['rides', 'work', 'social', 'boards', 'fanfic', 'dating', 'service-health'] },
  { id: 'stage', name: 'The stage', for: 'notes, lists, links and how the stage looks and is arranged', skills: ['telemetry-route', 'bridge', 'file-sorter', 'sticky', 'photos', 'notebook', 'notes-fill', 'calendar-fill', 'recipes-fill', 'generators-fill', 'terminal', 'notepad', 'pulse', 'friction', 'collide', 'bench', 'link', 'kept', 'list', 'tab', 'group', 'layer', 'label', 'dismiss', 'lock', 'light-look', 'dark-look', 'recent', 'showcase', 'type-filter', 'collectible', 'fly', 'riot', 'mutate', 'sudden-death', 'overload', 'extinction', 'feud', 'oracle', 'crowd', 'unkeepable', 'spectators', 'negative-summons', 'echo-disagrees', 'near-choir', 'minimap', 'ask-clipboard', 'habit-ring', 'recipe-stack', 'constellation-weaver', 'forge-table', 'night-ritual', 'archive-of-one', 'codex', 'echo-chamber', 'time-capsule', 'whisper-network', 'sheaf-check', 'spectral-review', 'task-diagram', 'gauge-feedback', 'eigenwork', 'homotopy-edit', 'plan-stability', 'anneal-ambition', 'partial-answer', 'draft-triad', 'stale-work', 'certainty-budget', 'interrupt-priority', 'causal-scars', 'counterfactual-draft', 'witness-claims', 'task-board', 'template-list', 'error-garden', 'idea-certificate', 'noun-heat', 'hunting-question', 'contradiction-lamp', 'ask-diff', 'family-gravity', 'deep-work', 'soundscape', 'stage-print', 'note-tools', 'outline-note', 'csv-table', 'qr-scan', 'list-tools', 'list-templates', 'stage-arrange', 'stage-style', 'stage-organize', 'accessibility-modes', 'stage-find', 'dismissed-pile', 'bookmarks', 'stage-export', 'copy-stack', 'stage-image', 'media-object', 'backdrop'] },
  { id: 'self', name: 'Verse itself', formerly: ['V01D', 'Void'], for: 'how Verse grows, what it wants, what it can do and sell, and acting on your behalf', skills: ['lab', 'team-chat', 'tower', 'studios', 'dependency-health', 'backlog-digest', 'remediation-velocity', 'guide', 'growth', 'v01d-fixes', 'merges', 'goal', 'intent', 'different', 'know', 'state', 'memory', 'watch', 'status', 'system-status', 'systems-monitor', 'incident', 'actions', 'automations', 'proposal', 'services', 'delivery-pack', 'monitor-pack', 'verify-pack', 'business-clarify', 'system-blueprint', 'client-handoff', 'system-handoff', 'full-handoff', 'proposal-pack', 'heavy-lift-map', 'ownership-map', 'store', 'share', 'web4', 'invite', 'local-inference', 'rebuild-map', 'films', 'app', 'family-health', 'incident-autopsy', 'fix-audit', 'deps', 'fringe-to-skill', 'skill-eclipse', 'miss-jobs', 'ask-immune', 'four-channels', 'stakes-phase', 'own-parts', 'about-skill', 'similar', 'approve-card', 'memory-graph', 'memory-preview', 'wants', 'podcast', 'connect-pack', 'client-intake', 'client-status-pack', 'delivery-board', 'status-digest', 'faucet', 'handoff-checklist', 'reuse-pack', 'ownership-pack', 'client-brief', 'client-offer', 'automation-pack', 'automation-status', 'lift-summary', 'time-saved', 'reliability-pack', 'docs-pack', 'feedback-loop', 'progress-report', 'system-slice'] },
  { id: 'decide', name: 'Deciding', for: 'ranked lists, pros and cons, votes, elimination, pairwise choices and sorting boards', skills: ['decide-cards', 'decision-matrix', 'triangulate'] },
  { id: 'safety-play', name: 'Safety and small delights', for: 'privacy and trust tools (hide numbers, redact, panic, a casual PIN lock) and opt-in delights (confetti, dust, stamps, tape, a tour)', skills: ['advice', 'pwcheck', 'safety-kit', 'photo-scrub', 'stage-fx', 'card-play'] },
];
import { readOrder } from './skills-index.mjs';
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
    // a test may also load the skill from the skills folder it names ("resolve(dir, 'suntimes.js')" in a file that points dir at void-live-deploy/skills, a
