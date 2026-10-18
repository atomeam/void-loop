// The fast checks an hourly run makes before it opens a PR, in one go: fringe ledger, every-skill collisions,
// calendar parser, the cross-sense board draft, the board reader's redaction, and the full everyday benchmark (against tools/bench.best.json).
// The full browser suite (tools/test_void.mjs) still runs in CI.
//   node tools/checks.mjs                 prints one line per check (always in the same order), exit 1 if any fails
//   node tools/checks.mjs --only <words>  only the checks whose name has one of the words (a check is named in its output line)
//   node tools/checks.mjs --skip-browser  leave out the checks that open a browser (BROWSER below)
// The pure checks (no browser, no network, no heavy lock) run side by side, up to one per core (4 at most; one fewer while a browser
// check runs); the browser checks run one after another beside them, each taking the heavy lock itself (tools/heavy.mjs).
// The slowest five and the wall time print after the list (owner, 2026-10-18: "how can we speed this all up?").
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conflictMarkers } from '../void-live-deploy/lib/code-review.js';
import { makeGate, poolSize, runNode, slowest, fmtMs } from './pool.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), skipBrowser = args.includes('--skip-browser');
const only = args.includes('--only') ? args.slice(args.indexOf('--only') + 1).filter((a) => !a.startsWith('--')).join(' ').toLowerCase().split(/\s+/).filter(Boolean) : [];
// the scripts below that open a browser (they take the heavy lock themselves): everything else is pure and goes in the pool
const BROWSER = new Set(['draft-check.mjs', 'perf3d.test.mjs', 'test_extension.mjs', 'test_glyphs.mjs', 'test_sky.mjs']);
let browserRunning = 0;
const gate = makeGate(() => poolSize(browserRunning > 0));
const root = resolve(here, '..');
// run a script: pure ones wait for a pool slot; a browser one starts at once (the heavy lock queues it). r.ms is the time it ran, not the wait.
const run = (a, browser = false) => { const go = async () => { const t = Date.now(); const r = await runNode(a, { cwd: root }); r.ms = Date.now() - t; return r; }; return browser ? go() : gate(go); };
const last = (r) => r.out[r.out.length - 1] || '';
// every check is a job: [name, browser?, async () => [ok, line, ms?]]; the report keeps the order they were added in
const jobs = [];
const add = (name, fn, browser = false) => { jobs.push({ name, fn, browser }); };
const addScript = (name, file, extra = [], browser = BROWSER.has(file)) => add(name, async () => { const r = await run([resolve(here, file), ...extra], browser); return [r.ok, last(r), r.ms]; }, browser);
// The tests, one per line: add yours on its own line (a single long line made every two PRs that added a test conflict).
for (const [name, file] of [
  ['fringe', 'fringe.mjs'],
  ['stage-pack-b', 'stage-pack-b.test.mjs'],
  ['everything', 'everything.test.mjs'],
  ['fringe-notes', 'fringe.test.mjs'],
  ['stage-pack-d', 'stage-pack-d.test.mjs'],
  ['upgrades', 'upgrades.test.mjs'],
  ['collide', 'collide.test.mjs'],
  ['stage-pack-e', 'stage-pack-e.test.mjs'],
  ['stage-pack-g', 'stage-pack-g.test.mjs'],
  ['taste', 'taste.test.mjs'],
  ['stage-pack-c', 'stage-pack-c.test.mjs'],
  ['shows', 'shows.test.mjs'],
  ['lab-use', 'lab-use.test.mjs'],
  ['site-teach', 'site-teach.test.mjs'],
  ['untested-unit', 'untested.test.mjs'],
  ['typo-audit', 'typo-audit.test.mjs'],
  ['label', 'label.test.mjs'],
  ['void-seal', 'void-seal.test.mjs'],
  ['collectible', 'collectible.test.mjs'],
  ['mcp-registry', 'mcp-registry.test.mjs'],
  ['support', 'support.test.mjs'],
  ['doc-drift-unit', 'doc-drift.test.mjs'],
  ['ask-text', 'ask-text.test.mjs'],
  ['fuzzy', 'fuzzy.test.mjs'],
  ['near-miss', 'near-miss.test.mjs'],
  ['context-check', 'context-check.test.mjs'],
  ['word-math', 'word-math.test.mjs'],
  ['swarm', 'swarm.test.mjs'],
  ['upkeep', 'upkeep.test.mjs'],
  ['films', 'films.test.mjs'],
  ['store-gap', 'store-gap.test.mjs'],
  ['film-share', 'film-share.test.mjs'],
  ['appraise', 'appraise.test.mjs'],
  ['launch-fixes', 'launch-fixes.test.mjs'],
  ['price-lock', 'price-lock.test.mjs'],
  ['reinvest', 'reinvest.test.mjs'],
  ['store', 'store.test.mjs'],
  ['pay-share', 'pay-share.test.mjs'],
  ['alt-pay', 'alt-pay.test.mjs'],
  ['keeper', 'keeper.test.mjs'],
  ['privacy-guard', 'privacy-guard.test.mjs'],
  ['site-test', 'site-test.test.mjs'],
  ['product-tail', 'product-tail.test.mjs'],
  ['product-gap', 'product-gap.test.mjs'],
  ['owner-account', 'owner-account.test.mjs'],
  ['automations-seed', 'automations-seed.test.mjs'],
  ['rebuild-map', 'rebuild-map.test.mjs'],
  ['record', 'record.test.mjs'],
  ['film-sound', 'film-sound.test.mjs'],
  ['hero-view', 'hero-view.test.mjs'],
  ['rts', 'rts.test.mjs'],
  ['routed', 'routed.test.mjs'],
  ['better', 'better.test.mjs'],
  ['youtube', 'youtube.test.mjs'],
  ['skills', 'skills-check.mjs'],
  ['new-skill', 'new-skill.test.mjs'],
  ['stage-pack-h', 'stage-pack-h.test.mjs'],
  ['stage-pack-i', 'stage-pack-i.test.mjs'],
  ['frontier', 'frontier.test.mjs'],
  ['map-sync', 'map-sync.test.mjs'],
  ['map-coverage', 'map-coverage.test.mjs'],
  ['finish', 'finish.test.mjs'],
  ['flakes', 'flakes.test.mjs'],
  ['next', 'next.test.mjs'],
  ['calendar', 'test_calendar.mjs'],
  ['glyphs', 'test_glyphs.mjs'],
  ['perf3d', 'perf3d.test.mjs'],
  ['review', 'review.test.mjs'],
  ['figures', 'figures.test.mjs'],
  ['scene3d-detail', 'scene3d.test.mjs'],
  ['shard', 'shard.test.mjs'],
  ['motorbody', 'motorbody.test.mjs'],
  ['incident', 'incident.test.mjs'],
  ['incident-log', 'incident-log.test.mjs'],
  ['cite', 'cite.test.mjs'],
  ['showcase', 'showcase.test.mjs'],
  ['fix-pages', 'fix-pages.test.mjs'],
  ['review-bench', 'review-bench.test.mjs'],
  ['honest', 'honest.test.mjs'],
  ['cron-gate', 'cron-gate.test.mjs'],
  ['autofix', 'automation-fix.test.mjs'],
  ['overrides', 'review-overrides.test.mjs'],
  ['offer', 'review-offer.test.mjs'],
  ['targets', 'targets.test.mjs'],
  ['releasenotes', 'releasenotes.test.mjs'],
  ['intent', 'intent.test.mjs'],
  ['revert-target', 'revert-target.test.mjs'],
  ['status', 'status.test.mjs'],
  ['growth', 'growth.test.mjs'],
  ['deadlines', 'deadlines.test.mjs'],
  ['growth-tree', 'growth-tree.test.mjs'],
  ['own-parts', 'own-parts.test.mjs'],
  ['review-learn', 'review-learn.test.mjs'],
  ['bench-floor', 'bench-floor.test.mjs'],
  ['tagteam', 'tagteam.test.mjs'],
  ['bench-load', 'bench-load.test.mjs'],
  ['merge-main', 'merge-main.test.mjs'],
  ['revert-records', 'revert-records.test.mjs'],
  ['prepush', 'prepush.test.mjs'],
  ['astro', 'astro.test.mjs'],
  ['openapi', 'openapi-check.mjs'],
  ['openapi-check', 'openapi-check.test.mjs'],
  ['where', 'where.test.mjs'],
  ['food', 'food.test.mjs'],
  ['films-live', 'films-live.test.mjs'],
  ['appraise-live', 'appraise-live.test.mjs'],
  ['swaps', 'swaps.test.mjs'],
  ['cook-flow', 'cook-flow.test.mjs'],
  ['words', 'words.test.mjs'],
  ['weather-match', 'weather-match.test.mjs'],
  ['body-asks', 'body-asks.test.mjs'],
  ['bmi', 'bmi.test.mjs'],
  ['meals', 'meals.test.mjs'],
  ['worldtime-parse', 'worldtime-parse.test.mjs'],
  ['country-parse', 'country-parse.test.mjs'],
  ['sky-skills', 'sky-skills.test.mjs'],
  ['sky-world', 'sky-world.test.mjs'],
  ['sky', 'test_sky.mjs'],
  ['take', 'take.test.mjs'],
  ['sorry', 'sorry.test.mjs'],
  ['voice', 'voice.test.mjs'],
  ['pr-ready', 'pr-ready.test.mjs'],
  ['review-api', 'review-api.test.mjs'], ['review-pr', 'review-pr.test.mjs'],
  ['go', 'go.test.mjs'],
  ['monopoly', 'monopoly.test.mjs'],
  ['battleship', 'battleship.test.mjs'],
  ['poker', 'poker.test.mjs'],
  ['fireworks', 'fireworks.test.mjs'],
  ['connect4', 'connect4.test.mjs'],
  ['duel-rules', 'duel-rules.test.mjs'],
  ['rules-engine', 'rules-engine.test.mjs'],
  ['arcade', 'arcade.test.mjs'],
  ['zorbleflux', 'zorbleflux.test.mjs'],
  ['field-kit', 'field-kit.test.mjs'],
  ['vector-field', 'vector-field.test.mjs'],
  ['field-cards', 'field-cards.test.mjs'],
  ['field-attention', 'field-attention.test.mjs'],
  ['field-nca', 'field-nca.test.mjs'],
  ['field-resonance', 'field-resonance.test.mjs'],
  ['field-swarm', 'field-swarm.test.mjs'],
  ['stage-camera', 'stage-camera.test.mjs'],
  ['operating-laws', 'operating-laws.test.mjs'],
  ['vendor-three', 'vendor-three.test.mjs'],
  ['explainers', 'explainers.test.mjs'],
  ['learning', 'learning.test.mjs'],
  ['goal', 'goal.test.mjs'],
  ['forge', 'forge.test.mjs'],
  ['sky-math', 'sky-math.test.mjs'],
  ['misses-snapshot', 'misses-snapshot.test.mjs'],
  ['night-sky', 'night-sky.test.mjs'],
  ['sky-card', 'sky-card.test.mjs'],
  ['learn', 'learn.test.mjs'],
  ['learn-draft', 'learn-draft.test.mjs'],
  ['patch-guard', 'patch-guard.test.mjs'],
  ['learn-e2e', 'learn.e2e.test.mjs'],
  ['refusal', 'refusal.test.mjs'],
  ['private', 'private.test.mjs'],
  ['model-bench', 'model-bench.test.mjs'],
  ['model-switch', 'model-switch.test.mjs'],
  ['bench-route', 'bench-route.test.mjs'],
  ['poster', 'poster.test.mjs'],
  ['speak', 'speak.test.mjs'],
  ['secret-scan', 'secret-scan.test.mjs'],
  ['next-skill', 'next-skill.test.mjs'],
  ['share', 'share.test.mjs'],
  ['advance', 'advance.test.mjs'],
  ['gaps', 'gaps.test.mjs'],
  ['propose-fix', 'propose-fix.test.mjs'],
  ['claude-brain', 'claude-brain.test.mjs'],
  ['probe-asks', 'probe-asks.test.mjs'],
  ['drive', 'drive.test.mjs'],
  ['voice-reply', 'voice-reply.test.mjs'],
  ['rating-note', 'rating-note.test.mjs'],
  ['book-face', 'book-face.test.mjs'],
  ['merges', 'merges.test.mjs'],
  ['probe-log', 'probe-log.test.mjs'],
  ['v01d-fixes', 'v01d-fixes.test.mjs'],
  ['rides-live', 'rides-live.test.mjs'],
  ['sky', 'sky.test.mjs'],
  ['inventory', 'inventory.test.mjs'],
  ['print-file', 'print-file.test.mjs'],
  ['aurora', 'aurora.test.mjs'],
  ['drone', 'drone.test.mjs'],
  ['cf-scope', 'cf-scope.test.mjs'],
  ['mirror', 'mirror.test.mjs'],
  ['digest-proposal', 'digest-proposal.test.mjs'],
  ['splat', 'splat.test.mjs'],
  ['routines', 'routines.test.mjs'],
  ['mcp', 'mcp.test.mjs'],
  ['trial-changes', 'trial-changes.test.mjs'],
  ['reef-changes', 'reef-changes.test.mjs'],
  ['heat-dose', 'heat-dose.test.mjs'],
  ['pdf-qa', 'pdf-qa.test.mjs'],
  ['arena', 'arena.test.mjs'],
  ['calc', 'calc.test.mjs'],
  ['timer', 'timer.test.mjs'],
  ['clock', 'clock.test.mjs'],
  ['list', 'list.test.mjs'],
  ['stage pack a', 'stage-pack-a.test.mjs'],
  ['math transplants', 'math-transplants.test.mjs'],
  ['thought laws', 'thought-laws.test.mjs'],
  ['tools pack 2', 'tools-pack-2.test.mjs'],
  ['tools pack 11 dates', 'date-pack.test.mjs'],
  ['stage pack j', 'stage-pack-j.test.mjs'],
  ['stage pack l', 'stage-pack-l.test.mjs'],
  ['tools pack 1', 'tools-pack-1.test.mjs'],
  ['text tools', 'text-tools.test.mjs'],
  ['tools pack 10', 'tools-pack-10.test.mjs'],
  ['stage tools', 'stage-tools.test.mjs'],
  ['together', 'together.test.mjs'],
  ['tools pack 6', 'tools-pack-6.test.mjs'],
  ['plan', 'plan.test.mjs'],
  ['chess thinking', 'chess-thinking.test.mjs'],
  ['shared routines', 'shared-routines.test.mjs'],
  ['automations', 'automations.test.mjs'],
  ['actions', 'actions.test.mjs'],
  ['ringer', 'ringer.test.mjs'],
  ['queue', 'queue.test.mjs'],
  ['actions-card', 'actions-card.test.mjs'],
  ['services', 'services.test.mjs'], ['sale-jobs', 'sale-jobs.test.mjs'], ['sale-e2e', 'sale-e2e.test.mjs'], ['reply-to-job', 'reply-to-job.test.mjs'], ['email-worker', 'email-worker.test.mjs'], ['rehearsal-route', 'rehearsal-route.test.mjs'], ['email-send', 'email-send.test.mjs'],
  ['proposal', 'proposal.test.mjs'], ['job-draft', 'job-draft.test.mjs'],
  ['memory-card', 'memory-card.test.mjs'],
  ['told-me', 'told-me.test.mjs'],
  ['memory', 'memory.test.mjs'],
  ['live', 'live.test.mjs'],
  ['draft', 'draft.test.mjs'],
  ['drafts', 'draft-check.mjs'],
  ['extension', 'test_extension.mjs'],
  ['placement', 'placement.test.mjs'],
  ['skills-index', 'skills-index.test.mjs'],
  ['moved-check', 'moved-check.test.mjs'],
  ['inbox-health', 'inbox-health.test.mjs'],
  ['skill-use', 'skill-use.test.mjs'],
  ['fringe-novelty', 'fringe-novelty.test.mjs'],
  ['skills-unlisted', 'skills-unlisted.test.mjs'],
  ['skill-family', 'skill-family.test.mjs'],
  ['heavy', 'heavy.test.mjs'],
  ['pool', 'pool.test.mjs'],
  ['clef-probe', 'clef-probe.test.mjs'],
  ['route-bench', 'route-bench.test.mjs'],
  ['models', 'models.test.mjs'],
  ['families', 'families.test.mjs'],
  ['source-reliability', 'source-reliability.test.mjs'],
  ['guide', 'guide.test.mjs'],
  ['web4', 'web4.test.mjs'],
  ['tome', 'tome.test.mjs'],
  ['rule-registry', 'rule-registry.test.mjs'],
  ['card-frame', 'card-frame.test.mjs'],
  ['card-look', 'card-look.test.mjs'],
  ['autopsy-asks', 'autopsy-asks.test.mjs'],
  ['card-kinds', 'card-kinds.test.mjs'],
  ['merge-rules', 'merge-rules.test.mjs'],
  ['merge-route', 'merge-route.test.mjs'],
  ['card-art-route', 'card-art-route.test.mjs'],
  ['react', 'react.test.mjs'],
  ['card-subject', 'card-subject.test.mjs'],
  ['page-picture', 'page-picture.test.mjs'],
  ['card-forge', 'card-forge.test.mjs'],
  ['repo-look', 'repo-look.test.mjs'],
  ['event-date', 'event-date.test.mjs'],
  ['paste-rule', 'paste-rule.test.mjs'],
  ['card-share', 'card-share.test.mjs'],
  ['card-art', 'card-art.test.mjs'],
  ['card-image', 'card-image.test.mjs'],
  ['video', 'video.test.mjs'],
  ['digest', 'digest.test.mjs'],
  ['well-known', 'well-known.test.mjs'],
  ['deps', 'deps.test.mjs'],
  ['review-main', 'review-main.test.mjs'],
  ['stage-pack-f', 'stage-pack-f.test.mjs'],
  ['thinking math', 'thinking-math.test.mjs'],
  ['tools pack 3', 'tools-pack3.test.mjs'],
]) {
  addScript(name, file);
}
// Every script parses, and no text file was re-encoded through a Windows code page (a merge did both to main once:
// a dash turned into three box-drawing letters, lines doubled, a const declared twice, and CI died before running a single test).
add('files', async () => { const files = spawnSync('git', ['ls-files', '*.js', '*.mjs', '*.html', '*.md', '*.json', '*.py', '*.yml'], { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const GARBLED = /\u0393[\u00c7\u00c4]|\u252c[\u2556\u2591\u00aa]|\u251c[\u00ba\u00e9]|\u256c\u00f4/; // the cp437 readings of UTF-8 dashes, dots, quotes
  const garbled = files.filter((f) => GARBLED.test(readFileSync(resolve(root, f), 'utf8')));
  const checked = await Promise.all(files.filter((f) => /\.m?js$/.test(f)).map(async (f) => [f, await run(['--check', resolve(root, f)])]));
  const broken = checked.filter(([, r]) => !r.ok).map(([f]) => f);
  return [!garbled.length && !broken.length, garbled.length || broken.length
    ? [garbled.length && 'garbled text in ' + garbled.join(', '), broken.length && 'does not parse: ' + broken.join(', ')].filter(Boolean).join('; ')
    : files.length + ' files: clean text, every script parses', checked.reduce((t, [, r]) => t + r.ms, 0)]; });
// nothing installed is ever tracked: a node_modules symlink from a worktree once got committed, and copying that commit
// back replaced the real folder with a link to itself
add('tracked', async () => { const bad = spawnSync('git', ['ls-files', '--', 'node_modules', 'node_modules/*'], { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  return [!bad.length, bad.length ? 'git tracks ' + bad.slice(0, 3).join(', ') + ': git rm --cached it (a worktree runs its own npm ci, never a link)' : 'no installed files tracked']; });
// no conflict marker anywhere in the tree (#291 merged one into the growth ledger): these checks run on the merged head, so a
// merge of main made after they ran is not covered; run them again after merging main, before the push
add('markers', async () => { const marked = [];
  for (const f of spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }).stdout.split('\n').filter(Boolean)) {
    let t = ''; try { t = readFileSync(resolve(root, f), 'utf8'); } catch (_) { continue; }
    if (t.length < 5e6 && !t.includes('\0')) for (const c of conflictMarkers(t)) marked.push(f + ':' + c.line);
  }
  return [!marked.length, marked.length ? 'conflict markers at ' + marked.slice(0, 5).join(', ') + ': settle the merge (node tools/merge-main.mjs) and remove them' : 'no conflict markers in the tree']; });
// every bundled file the page or a skill loads by path is in the tree (issue #757: a merge dropped vendor/three-r180/build and
// vendor/pdfjs build, the CDN kept serving a cached copy, and any fresh URL got the HTML fallback: "Failed to load module script")
add('vendor', async () => { const gone = new Set();
  for (const f of spawnSync('git', ['ls-files', 'void.html', 'void-live-deploy/skills/*.js', 'void-live-deploy/lib/*.js'], { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter(Boolean))
    for (const m of readFileSync(resolve(root, f), 'utf8').matchAll(/['"`](\/vendor\/[^'"`\s?#]+\.(?:m?js|wasm|css|json))['"`]/g)) { try { readFileSync(resolve(root, 'void-live-deploy' + m[1])); } catch (_) { gone.add(f + ' -> ' + m[1]); } }
  return [!gone.size, gone.size ? 'bundled file missing: ' + [...gone].slice(0, 4).join(', ') + ' (restore it from git history)' : 'every bundled file the page loads is in the tree']; });
// no perspective grid floor on the stage (owner 2026-10-15: "the ugly every-AI-website grid"); docs/design.md "Never"
add('no-grid-floor', async () => { const css = readFileSync(resolve(here, '..', 'void.html'), 'utf8'); const bad = [...css.matchAll(/\{[^{}]*repeating-linear-gradient[^{}]*rotateX\([^{}]*\}/g)].filter((m) => !/\.vpage|\.thing|card/.test(m[0]));
  return [!bad.length, bad.length ? 'a perspective grid floor is back in void.html (design.md forbids it)' : 'no perspective grid floor']; });
// the bench and the deploy serve void-live-deploy/index.html: an edit to void.html that was not copied there is tested stale, silently
add('copies', async () => { const read = (f) => readFileSync(resolve(here, '..', f), 'utf8').replace(/\r\n/g, '\n'), src = read('void.html');
  const stale = ['void-live-deploy/index.html', 'void-live-deploy/void.html'].filter((f) => read(f) !== src);
  return [!stale.length, stale.length ? stale.join(' and ') + ' differ from void.html: cp void.html void-live-deploy/index.html && cp void.html void-live-deploy/void.html' : 'void.html and both deploy copies match']; });
// skills/index.json is generated from skills/order/ (tools/skills-index.mjs): a skill added without its order file, or an order file
// without the index rewritten, is caught here, not on the page
// every line this branch adds, in every file type, holds no real key (tools/secret-scan.mjs; owner, 2026-10-15: "make V01D the best
// at keeping secrets ever made"): the review skips docs and data, and a pasted key in a log is the likeliest leak
addScript('secrets', 'secret-scan.mjs', ['--base', 'origin/main']);
addScript('index', 'skills-index.mjs', ['--check']);
// a new skill whose examples another skill also takes is a merge waiting to happen (tools/skill-overlap.mjs; owner 2026-10-15)
addScript('overlap', 'skill-overlap.mjs', ['--check']);
// every skill sits in a skill family and families.json says how far each is checked (tools/families.mjs, Void's own ask)
addScript('families-json', 'families.mjs', ['--check']);
// the dependency map (skills/deps.json, tools/deps.mjs; asked by Void) is read off the import lines and kept current like families.json
// a check keyed on a name the page lost to skills/ fails on every run (the published-page check, #545): found before it ships (asked by Void)
addScript('moved-check', 'moved-check.mjs');
addScript('deps-json', 'deps.mjs', ['--check']);
// the book (skills/guide.json) names every skill, game and miniature on one page each; stale or a skill on no page fails (tools/guide.mjs)
addScript('guide-json', 'guide.mjs', ['--check']);
// the MCP skill tools (lib/mcp-skills.js) are the ten proven read-only skills with the most evidence, as the ratings now say (asked by Void)
addScript('mcp-skills', 'mcp-skills.mjs', ['--check']);
// stale docs (docs/multipliers.md #4): a doc may not newly name a repo file that does not exist
addScript('doc-drift', 'doc-drift.mjs', ['--check']);
// the untested-code ratchet (docs/multipliers.md #3): no new lib/ or skills/ file without a test that names it
// letter reversals in the skills' metadata (asked by Void: a typo audit in the builder's CI; tools/typo-audit.mjs, allow-list tools/typo-audit.json)
addScript('typos', 'typo-audit.mjs', ['--check']);
addScript('untested', 'untested.mjs', ['--check']);
// VOID_SKIP_BENCH (the same switch tools/test_void.mjs honours): the benchmark is not a merge gate (owner, 2026-10-09, the suite split in
// domains/void.frontier.md); CI runs it as its own job (.github/workflows/bench.yml) and reports the number on the PR, and a drop below
// the floor is a fix PR, never a wait. Without the variable this row replays it as before.
if (process.env.VOID_SKIP_BENCH) add('bench', async () => [true, 'skipped: CI runs it (bench.yml)']);
else add('bench', async () => { const r = await run([resolve(here, 'bench.mjs'), '--score'], true); let b = null; try { b = JSON.parse(r.out.filter((l) => l.startsWith('{')).pop()); } catch (_) {} // stderr is merged in: the JSON is the last line that starts with {
  const best = JSON.parse(readFileSync(resolve(here, 'bench.best.json'), 'utf8'));
  const ok = !!b && b.score >= best.score && b.total >= best.total; // score counts a miss that passed alone as a pass and lists only the ones that reproduce alone (tools/bench-load.mjs): below the floor is a real failure, load or not
  return [ok, b ? `${b.inconclusive ? b.note + ' - ' : ''}${b.score}/${b.total} (floor ${best.score})${b.cached ? ' (nothing it reads changed since the passing run at ' + b.cached + '; not replayed: --fresh forces it)' : ''}${b.wrong.length ? ' wrong: ' + b.wrong.join(' | ') : ''}` : r.out.slice(-2).join(' '), r.ms]; }, true);
add('misses', async () => { // the board reader must drop anything key-like before it prints (tools/misses.mjs)
  const { redact } = await import('./misses.mjs');
  const cases = [['unlock abcdEFGH12345678zz', null], ['my key is Zx9kQ2mP7vR4tY8wL3nB', null], ['mail sam@example.com', 'mail [email]'],
    ['call 555-123-4567', 'call [number]'], ['weather in kyoto', 'weather in kyoto'], ['define antidisestablishmentarianism', 'define antidisestablishmentarianism']];
  const bad = cases.filter(([a, want]) => redact(a) !== want);
  return [!bad.length, bad.length ? 'redact wrong for: ' + bad.map((c) => c[0]).join(' | ') : cases.length + ' redaction cases ok']; });
add('noise', async () => { // test traffic (probe, ping, test) never becomes a miss or a want, and real questions about probes still do (lib/noise.js, tools/will.py)
  const { isNoise } = await import('../void-live-deploy/lib/noise.js');
  const py = (await import('node:fs')).readFileSync(new URL('./will.py', import.meta.url), 'utf8').includes('NOISE.match(');
  const cases = [['probe', true], ['ping', true], ['research probe', true], ['test', true], ['how do space probes work', false], ['probe the moon', false], ['weather in paris', false]];
  const bad = cases.filter(([a, want]) => isNoise(a) !== want);
  return [!bad.length && py, !py ? 'tools/will.py no longer uses the noise list' : bad.length ? 'noise wrong for: ' + bad.map((c) => c[0]).join(' | ') : cases.length + ' noise cases ok (miss board and will)']; });

// Run them: the browser checks one after another in their own lane from the start, the pure ones through the gate beside them.
// A check that throws fails with its message; the report below is in the order the checks were added, whatever finished first.
const wanted = jobs.filter((j) => (!skipBrowser || !j.browser) && (!only.length || only.some((w) => j.name.toLowerCase().includes(w))));
const t0 = Date.now(), results = new Array(wanted.length), timings = [];
const exec = async (j, i) => { const s = Date.now(); let r; try { r = await j.fn(); } catch (e) { r = [false, 'check crashed: ' + (e && e.message || e)]; }
  results[i] = [j.name, r[0], r[1]]; timings.push({ name: j.name, ms: r[2] ?? Date.now() - s, browser: j.browser }); };
const lane = wanted.reduce((p, j, i) => (j.browser ? p.then(async () => { browserRunning++; try { await exec(j, i); } finally { browserRunning--; gate.poke(); } }) : p), Promise.resolve());
await Promise.all([lane, ...wanted.map((j, i) => (j.browser ? null : exec(j, i)))]);
const wall = Date.now() - t0;
if (process.env.VOID_SKIP_BENCH && !only.length && !skipBrowser && !results.some(([n, , l]) => n === 'bench' && /^skipped/.test(l))) results.push(['self', false, 'VOID_SKIP_BENCH is set but the bench row did not say skipped']);
for (const [n, ok, line] of results) console.log((ok ? (/^inconclusive/.test(line) ? 'inconclusive ' : 'ok   ') : 'FAIL ') + n.padEnd(9) + line);
{ const pure = timings.filter((t) => !t.browser), br = timings.filter((t) => t.browser);
  console.log(`\n${results.length} checks in ${fmtMs(wall)} (${pure.length} pure, up to ${poolSize(false)} at once: ${fmtMs(pure.reduce((t, x) => t + x.ms, 0))} of work; ${br.length} browser: ${fmtMs(br.reduce((t, x) => t + x.ms, 0))})`);
  console.log('slowest: ' + slowest(timings).map((t) => `${t.name}${t.browser ? ' (browser)' : ''} ${fmtMs(t.ms)}`).join(', ')); }
process.exit(results.every((r) => r[1]) ? 0 : 1);
