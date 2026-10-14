// Void's skill families (Void's own ask, its reflection of 2026-10-12: "implement 'skill-families' to group my new
// capabilities ... and assign a stability rating to each experiment to signal readiness for permanent integration"; the
// owner: "This should be taken seriously."). Every skill in skills/index.json sits in one family, and each gets a rating
// from evidence only, never from how it describes itself:
//   experiment  nothing checks it yet
//   tested      one kind of evidence: its own tests (suite() or tools/<name>.test.mjs), the browser suite, or real asks in the
//               everyday benchmark (tools/bench.json, run in CI) routed to it
//   checked     two kinds
//   proven      all three, or two with at least 3 real asks routed to it
// Copied from Home Assistant's integration quality scale (bronze to platinum, earned by meeting written rules), one notch
// past: the rules are read off the repo, so a rating can't be claimed, only earned, and it drops when a test goes.
//   node tools/families.mjs           write void-live-deploy/skills/families.json and print the families
//   node tools/families.mjs --check   exit 1 if families.json is out of date or a skill has no family (checks.mjs runs this)
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'void-live-deploy/skills/families.json');

// what each family is for, in Void's words to a visitor, and its skills (a new skill must be placed here: --check fails)
export const FAMILIES = [
  { id: 'make', name: 'Making things', for: 'figures, 3D models, prints, drawings and parts', skills: ['forge', 'make', 'figure', 'figures', 'zoom-figure', 'figure-can', 'cartoon', 'part', 'together', 'gears', 'motorbody', 'printedmotor', 'magnetize', 'print-file', 'print-download', 'inventory', 'splat', 'poster', 'draw', 'shape', 'image', 'throw-off'] },
  { id: 'games', name: 'Games', for: 'board games, card games and play', skills: ['aggravation', 'sorry', 'connect4', 'tictactoe', 'othello', 'mancala', 'chess', 'checkers', 'go', 'monopoly', 'battleship', 'poker', 'fireworks', 'rack', 'eightball', 'ringer', 'quiz', 'challenge'] },
  { id: 'sky', name: 'Sky and earth', for: 'weather, the sky tonight, places and time zones', skills: ['sky', 'moontonight', 'aurora-tonight', 'eclipse', 'meteors', 'constellation', 'weather', 'air', 'uv', 'quake', 'pollen', 'sky-card', 'suntimes', 'moon', 'night-sky', 'place', 'worldtime', 'distance', 'country'] },
  { id: 'time', name: 'Time', for: 'timers, clocks, calendars and reminders', skills: ['timer', 'clock', 'countdown', 'show-countdown', 'calendar', 'today', 'remind', 'holidays', 'work', 'routine'] },
  { id: 'numbers', name: 'Numbers and money', for: 'sums, unit conversions, loans, savings, prices and home projects', skills: ['calc', 'convert', 'loan', 'savings', 'fuel', 'tip', 'crypto', 'grades', 'util', 'counter', 'room', 'walls', 'home'] },
  { id: 'body', name: 'Body and mind', for: 'sleep, cycles, food, heart and calm', skills: ['sleep', 'ovulation', 'period', 'pregnancy', 'nutrition', 'food', 'heart', 'breath', 'feelings'] },
  { id: 'words', name: 'Words and the world', for: 'definitions, translation, news, books, shows and sport', skills: ['define', 'words', 'spanish', 'translate', 'news', 'joke', 'recipe', 'book', 'show', 'sport', 'pdf-card', 'coral', 'senolytic', 'trialwatch', 'releasenotes'] },
  { id: 'stage', name: 'The stage', for: 'notes, lists, links and how the stage looks and is arranged', skills: ['sticky', 'notepad', 'link', 'kept', 'list', 'tab', 'group', 'layer', 'label', 'dismiss', 'lock', 'light-look', 'dark-look', 'recent', 'showcase'] },
  { id: 'self', name: 'Void itself', for: 'how Void grows, what it wants, what it can do and sell, and acting on your behalf', skills: ['growth', 'goal', 'intent', 'different', 'memory', 'watch', 'status', 'incident', 'actions', 'automations', 'proposal', 'services', 'share', 'invite', 'local-inference', 'rebuild-map', 'films', 'app'] },
];
export const TIERS = ['experiment', 'tested', 'checked', 'proven'];

/** a skill's rating from its evidence: { suite, browser, bench } -> tier and the reason in words. Pure. */
export function ratingOf(ev) {
  const why = [];
  if (ev.suite) why.push('a self-test');
  if (ev.browser) why.push(ev.browser + ' browser-suite mention' + (ev.browser > 1 ? 's' : ''));
  if (ev.bench) why.push(ev.bench + ' real ask' + (ev.bench > 1 ? 's' : '') + ' in the benchmark');
  // three kinds of evidence: its own tests, the browser suite, real asks routed to it (the benchmark runs in CI on main)
  const kinds = [!!ev.suite, ev.browser > 0, ev.bench > 0].filter(Boolean).length;
  const tier = kinds === 3 || (kinds === 2 && ev.bench >= 3) ? 'proven' : kinds === 2 ? 'checked' : kinds === 1 ? 'tested' : 'experiment';
  return { tier, why: why.length ? why.join(', ') : 'nothing checks it yet' };
}

/** every skill's evidence, read off the repo: its self-test, the browser suite, the benchmark */
export function evidence(names, read = (p) => readFileSync(resolve(root, p), 'utf8'), listTests = () => readdirSync(resolve(root, 'tools')).filter((f) => f.endsWith('.test.mjs'))) {
  const suiteText = read('tools/test_void.mjs') + '\n' + read('tools/test_3d.mjs') + '\n' + read('tools/test_extension.mjs'), bench = JSON.parse(read('tools/bench.json')); // the browser suites
  // the asks the everyday benchmark got wrong on its last clean run on main (tools/bench.misses.json, "ask -> what it gave"),
  // for the growth card's friction line (Void's ask: "a 'friction' indicator ... which skills are currently failing")
  let missed = []; try { const m = JSON.parse(read('tools/bench.misses.json')); missed = Array.isArray(m && m.misses) ? m.misses.map((x) => String(x).replace(/\s+->\s+[^>]*$/, '').toLowerCase()) : []; } catch (_) {}
  const unitTexts = listTests().map((f) => { try { return read('tools/' + f); } catch (_) { return ''; } });
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const out = {};
  for (const n of names) {
    let src = ''; try { src = read('void-live-deploy/skills/' + n + '.js'); } catch (_) {}
    // the browser suites: a check or a section named after the skill ("weather: …", "3d: chess and checkers"), or one naming its
    // file or route; a longer name may sit anywhere in the label ("how Void is different: …"), a short one ("go", "tab") only at
    // its start. One pattern, so a mention counts once.
    const word = esc(n).replace(/-/g, '[ -]');
    const label = n.length >= 6 ? '[^\'"`]{0,60}\\b' : '(?:3d:\\s*)?(?:[a-z]+ and )?';
    const browser = (suiteText.match(new RegExp('skills/' + esc(n) + '\\.js|skill:' + esc(n) + '\\b|(?:check|want)\\(\\s*[\'"`]' + label + word + '\\b', 'gi')) || []).length;
    // its own tests: suite() in the skill, or a unit test in tools/ that imports the skill's file
    const unit = unitTexts.some((t) => new RegExp('skills/' + esc(n) + '(?:-rules)?\\.js[\'"`]').test(t)); // a game's rules are often their own file
    // real asks: a benchmark ask whose wanted answer is this skill ("skill:weather", or "calc" / "calc|answer" for the core ones)
    const routed = bench.filter((b) => b && typeof b.want === 'string' && b.want.split('|').some((w) => w === 'skill:' + n || w === n)).length;
    const wants = (b) => b && typeof b.want === 'string' && b.want.split('|').some((w) => w === 'skill:' + n || w === n);
    const failing = [...new Set(bench.filter((b) => wants(b) && missed.includes(String(b.ask).toLowerCase())).map((b) => b.ask))];
    out[n] = { suite: unit || /\bsuite\s*\(\s*\)\s*\{/.test(src), browser, bench: routed, ...(failing.length ? { failing } : {}) };
  }
  return out;
}

/** the families with each skill rated, the counts, and any skill no family holds. Pure, given the evidence. */
export function build(names, ev) {
  const placed = new Set(FAMILIES.flatMap((f) => f.skills));
  const families = FAMILIES.map((f) => {
    const skills = f.skills.filter((n) => names.includes(n)).map((n) => { const e = ev[n] || {}, x = { name: n, ...ratingOf(e) }; if (e.failing && e.failing.length) x.failing = e.failing.slice(0, 3); return x; }); // failing: bench asks it got wrong
    const count = Object.fromEntries(TIERS.map((t) => [t, skills.filter((s) => s.tier === t).length]));
    return { id: f.id, name: f.name, for: f.for, count, skills };
  });
  const totals = Object.fromEntries(TIERS.map((t) => [t, families.reduce((n, f) => n + f.count[t], 0)]));
  return { families, totals, unplaced: names.filter((n) => !placed.has(n)), missing: [...placed].filter((n) => !names.includes(n)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/index.json'), 'utf8'));
  const b = build(names, evidence(names));
  const json = JSON.stringify({ note: 'Void\'s skill families and how far each skill is checked (tools/families.mjs; ratings from evidence only)', totals: b.totals, families: b.families }, null, 1) + '\n';
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
