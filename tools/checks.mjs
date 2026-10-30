// The fast checks an hourly run makes before it opens a PR, in one go: fringe ledger, every-skill collisions,
// calendar parser, the cross-sense board draft, the board reader's redaction, and the full everyday benchmark (against tools/bench.best.json).
// The full browser suite (tools/test_void.mjs) still runs in CI.
//   node tools/checks.mjs                 prints one line per check (always in the same order), exit 1 if any fails
//   node tools/checks.mjs --only <words>  only the checks whose name has one of the words (a check is named in its output line)
//   node tools/checks.mjs --skip-browser  leave out the checks that open a browser (BROWSER below)
//   node tools/checks.mjs --changed       only the checks that cover what this branch changed (tools/checks-changed.mjs: the structural ones
//                                         always, a test when its file, an import of it or a file named like it changed; ignored in CI, where
//                                         main runs everything). A builder's pre-push check: VOID_SKIP_BENCH=1 node tools/checks.mjs --changed
// The pure checks (no browser, no network, no heavy lock) run side by side, up to one per core (4 at most; one fewer while a browser
// check runs); the browser checks run one after another beside them, each taking the heavy lock itself (tools/heavy.mjs).
// The slowest five and the wall time print after the list (owner, 2026-10-18: "how can we speed this all up?").
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conflictMarkers } from '../void-live-deploy/lib/code-review.js';
import { makeGate, poolSize, runNode, slowest, fmtMs } from './pool.mjs';
import { inlineScripts } from './inline-scripts.mjs';
import { select as selectChanged, changedFiles, readDeps, REACHES_ALL } from './checks-changed.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), skipBrowser = args.includes('--skip-browser');
const inCI = !!(process.env.CI || process.env.GITHUB_ACTIONS), changedMode = args.includes('--changed') && !inCI;
if (args.includes('--changed') && inCI) console.log('--changed ignored in CI: main runs everything');
// the changed files --changed selects by (committed against origin/main and uncommitted); null when git cannot say, and then everything runs
const changedList = changedMode ? changedFiles() : null;
// --changed narrows a whole-tree check to the changed files too, unless one of them reaches everything (a narrow run would parse one file after a workflow change)
const narrowToChanged = !!(changedList && !changedList.some((f) => REACHES_ALL.test(f)));
const only = args.includes('--only') ? args.slice(args.indexOf('--only') + 1).filter((a) => !a.startsWith('--')).join(' ').toLowerCase().split(/\s+/).filter(Boolean) : [];
// the scripts below that open a browser (they take the heavy lock themselves): everything else is pure and goes in the pool
// the two browser checks that take most of a run (persona-playtest ~5 min, perf3d ~5 min) run here only when a file they cover changed
// against main, with --all, or in CI; every merge to main runs both in verify.yml (owner, 2026-10-23: "are the 11 minute checks neccassary")
const ALL = args.includes('--all') || !!process.env.CI;
const ONLY_WHEN = {
  // the extension's two browser cases: the extension, the tab card, the page
  'test_extension.mjs': /^extension\/|void\.html$|skills\/tab\.js|lib\/(?:extension|tab|stale-tab)|test_extension/,
  // the sky world in a real browser: the sky skills, the sky lib, the page
  'test_sky.mjs': /void\.html$|skills\/(?:sky|night-sky|sky-card|moon|moontonight|suntimes|aurora|constellation|meteors|eclipse)|lib\/sky|test_sky/,
  // the cross-sense board draft
  'test_glyphs.mjs': /sensory-substitution|test_glyphs/,
  // the card art on pixels: the art, the forge, the miniatures, the page
  'art-pixels.mjs': /art|skills\/mini\/|card-forge|\.svg$|void\.html$|art-pixels/,
  'perf3d.test.mjs': /(?:^|\/)(?:mini\/|vendor\/|models\/)|scene3d|figures3d|fig3d|perf3d|three/,
  'persona-playtest.mjs': /skills\/(?:chess|checkers|go|othello|connect4|monopoly|battleship|poker|fireworks|mancala|aggravation|ringer|sorry|tictactoe|pong|snake|rack|gamebox|duel|rally|zorbleflux|arcade|game[\w-]*|side-card)\.js|lib\/game|persona-playtest/,
  // glitch titles in a real browser (~3 min): a rule may be a function of the path. A script matters only when it holds a glitch letter
  // (<span class="gl ...">: skills/films.js and skills/is-it.js today, any file that gains one tomorrow); the styles are the page's
  // every page doing its own job in a real browser (tools/real-pages.mjs): only the pages this branch changed, so a page edit is tested there
  'real-pages.mjs': /(?:^|\/)index\.html$|real-pages/,
  // the page-to-page handoffs built from docs/HANDOFF-GAPS.md, played end to end in a browser (tools/handoff-e2e.mjs)
  'handoff-e2e.mjs': /void-live-deploy\/(?:(?:bpm|metronome|chords|piano|calendar|time|weather|flights|local|fantasy)\/|lib\/(?:flights-|local-media|fantasy))|handoff/,
  'glitch-titles.mjs': (f) => /void\.html$|glitch-titles|films\/index\.html$/.test(f) || (/\.js$/.test(f) && /class=["'`]gl[\s"'`w]/.test(readText(f))),
};
const readText = (f) => { try { return readFileSync(resolve(here, '..', f), 'utf8'); } catch (_) { return ''; } }; // a deleted file is no title
const covers = (rule, f) => (typeof rule === 'function' ? rule(f) : rule.test(f));
let changed; // the files this branch changed against main, read once when first asked (root is set further down)
const changedVsMain = () => {
  if (changed !== undefined) return changed;
  const git = (a) => spawnSync('git', a, { cwd: resolve(here, '..'), encoding: 'utf8' });
  const base = git(['merge-base', 'HEAD', 'origin/main']).stdout.trim();
  if (!base) return (changed = null); // no main to compare with: run everything
  return (changed = [...new Set([git(['diff', '--name-only', base]).stdout, git(['diff', '--name-only', '--cached']).stdout].join('\n').split('\n').filter(Boolean))]);
};
/** why a slow check is skipped this run, or '' when it runs. */
const skipWhy = (file) => (ALL || !ONLY_WHEN[file] || !changedVsMain() || changedVsMain().some((f) => covers(ONLY_WHEN[file], f)) ? '' : 'skipped: nothing it covers changed (verify.yml runs it on main; --all runs it here)');
const BROWSER = new Set(['art-pixels.mjs', 'draft-check.mjs', 'perf3d.test.mjs', 'test_extension.mjs', 'test_glyphs.mjs', 'test_sky.mjs', 'glitch-titles.mjs', 'persona-playtest.mjs', 'real-pages.mjs', 'handoff-e2e.mjs', 'fanfic-first-writer.test.mjs', 'fresh-scripts.test.mjs']);
let browserRunning = 0;
const gate = makeGate(() => poolSize(browserRunning > 0));
const root = resolve(here, '..');
// run a script: pure ones wait for a pool slot; a browser one starts at once (the heavy lock queues it). r.ms is the time it ran, not the wait.
const run = (a, browser = false) => { const go = async () => { const t = Date.now(); const r = await runNode(a, { cwd: root }); r.ms = Date.now() - t; return r; }; return browser ? go() : gate(go); };
const last = (r) => r.out[r.out.length - 1] || '';
// every check is a job: { name, browser?, fn: async () => [ok, line, ms?], file? }; the report keeps the order they were added in.
// file is the script it runs (tools/<file>): --changed reads a test's imports from it; a check with no file of its own is structural (always on)
const jobs = [];
const add = (name, fn, browser = false, file) => { jobs.push({ name, fn, browser, file }); };
// a failed script says which cases failed (its first FAIL lines), not only its last line: a flaky browser case was "36/37 passed" with no way to tell which (2026-10-18)
const failLines = (r) => (r.ok ? '' : r.out.filter((l) => /^FAIL /.test(l)).slice(0, 2).map((l) => l.slice(0, 300)).join(' || '));
const addScript = (name, file, extra = [], browser = BROWSER.has(file)) => skipWhy(file) ? add(name, async () => [true, skipWhy(file)], false, file) : add(name, async () => { const r = await run([resolve(here, file), ...extra], browser); const f = failLines(r); return [r.ok, f ? f + ' || ' + last(r) : last(r), r.ms]; }, browser, file);
// The tests, one per line: add yours on its own line (a single long line made every two PRs that added a test conflict).
for (const [name, file] of [
  ['walker', 'walker.test.mjs'],
  ['handoff-scan', 'handoff-scan.test.mjs'],
  ['handoff-e2e', 'handoff-e2e.mjs'],
  ['backdrop', 'backdrop.test.mjs'],
  ['fringe', 'fringe.mjs'],
  ['telemetry-route', 'telemetry-route.test.mjs'],
  ['about-skill', 'about-skill.test.mjs'],
  ['local-inference', 'local-inference.test.mjs'],
  ['grades', 'grades.test.mjs'],
  ['ritual', 'ritual.test.mjs'],
  ['podcast', 'podcast.test.mjs'],
  ['live-revert', 'live-revert.test.mjs'],
  ['progress-chart', 'progress-chart.test.mjs'],
  ['loop-parts', 'loop-parts.test.mjs'],
  ['wiped-files', 'wiped-files.test.mjs'],
  ['translate', 'translate.test.mjs'],
  ['translate-extras', 'translate-extras.test.mjs'],
  ['parity', 'parity.test.mjs'],
  ['gate-land', 'gate-land.test.mjs'],
  ['recipes', 'recipes.test.mjs'],
  ['scores', 'scores.test.mjs'],
  ['reports', 'reports.test.mjs'],
  ['fantasy', 'fantasy.test.mjs'],
  ['matchgfx', 'matchgfx.test.mjs'],
  ['podcasts', 'podcasts.test.mjs'],
  ['boards', 'boards.test.mjs'],
  ['fanfic', 'fanfic.test.mjs'],
  ['rap', 'rap.test.mjs'],
  ['rap-sound', 'rap-sound.test.mjs'],
  ['rap-ears', 'rap-ears.test.mjs'],
  ['rap-kit', 'rap-kit.test.mjs'],
  ['rap-piano', 'rap-piano.test.mjs'],
  ['emoji-combos', 'emoji-combos.test.mjs'],
  ['local-media', 'local-media.test.mjs'],
  ['world-tv', 'world-tv.test.mjs'], // the free channels beyond the local ones on /local/ (owner: "also find all free channels worldwide and add")
  ['fanfic-hits', 'fanfic-hits.test.mjs'],
  ['fanfic-first-writer', 'fanfic-first-writer.test.mjs'],
  ['team', 'team.test.mjs'],
  ['naming-audit', 'naming-audit.test.mjs'],
  ['music-tools', 'music-tools.test.mjs'],
  ['flights', 'flights.test.mjs'],
  ['job-board', 'job-board.test.mjs'],
  ['lane-pages', 'lane-pages.test.mjs'],
  ['calendar', 'calendar.test.mjs'],
  ['generators', 'generators.test.mjs'],
  ['listgen', 'listgen.test.mjs'],
  ['image-gen', 'image-gen.test.mjs'],
  ['video-gen', 'video-gen.test.mjs'],
  ['generators-hub', 'generators-hub.test.mjs'],
  ['gallery', 'gallery.test.mjs'],
  ['character', 'character.test.mjs'],
  ['story', 'story.test.mjs'],
  ['comments', 'comments.test.mjs'],
  ['gen-data', 'gen-data.test.mjs'],
  ['daily-art', 'daily-art.test.mjs'],
  ['daily-photo', 'daily-photo.test.mjs'],
  ['notes', 'notes.test.mjs'],
  ['chat-notes', 'chat-notes.test.mjs'],
  ['note-extras', 'note-extras.test.mjs'],
  ['chat-calendar', 'chat-calendar.test.mjs'],
  ['chat-fill-skills', 'chat-fill-skills.test.mjs'],
  ['chat-recipes', 'chat-recipes.test.mjs'],
  ['chat-generators', 'chat-generators.test.mjs'],
  ['floor-kit', 'floor-kit.test.mjs'],
  ['decision-matrix-narrow', 'decision-matrix-narrow.test.mjs'],
  ['memory-preview', 'memory-preview.test.mjs'],
  ['decide-cards', 'decide-cards.test.mjs'],
  ['list-starters-family', 'list-starters-family.test.mjs'],
  ['verse-name', 'verse-name.test.mjs'],
  ['stage-out-family', 'stage-out-family.test.mjs'],
  ['shop-family', 'shop-family.test.mjs'],
  ['mail-handoff', 'mail-handoff.test.mjs'],
  ['value-drift', 'value-drift.test.mjs'], ['friendly-openers', 'friendly-openers.test.mjs'],
  ['rooms-family', 'rooms-family.test.mjs'],
  ['mind-field', 'mind-field.test.mjs'],
  ['tilt-arena', 'tilt-arena.test.mjs'],
  ['match-history', 'match-history.test.mjs'],
  ['wants', 'wants.test.mjs'],
  ['fix-audit', 'fix-audit.test.mjs'],
  ['social', 'social.test.mjs'],
  ['stage-pack-b', 'stage-pack-b.test.mjs'],
  ['error-garden-incidents', 'error-garden-incidents.test.mjs'],
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
  ['tools pack 8', 'tools-pack-8.test.mjs'],
  ['mcp-registry', 'mcp-registry.test.mjs'],
  ['support', 'support.test.mjs'],
  ['selfcheck', 'selfcheck.test.mjs'], // Verse's check of its own pages: the judge, the report, /api/selfcheck and the status card's section
  ['dark-pages', 'dark-pages.test.mjs'], // every page stays deep space in a light-mode browser too
  ['doc-drift-unit', 'doc-drift.test.mjs'],
  ['ask-text', 'ask-text.test.mjs'],
  ['fuzzy', 'fuzzy.test.mjs'],
  ['near-miss', 'near-miss.test.mjs'],
  ['miss-robot', 'miss-robot.test.mjs'],
  ['media-music', 'media-music.test.mjs'],
  ['photo-library', 'photo-library.test.mjs'],
  ['context-check', 'context-check.test.mjs'],
  ['word-math', 'word-math.test.mjs'],
  ['swarm', 'swarm.test.mjs'],
  ['upkeep', 'upkeep.test.mjs'],
  ['films', 'films.test.mjs'],
  ['film-discovery', 'film-discovery.test.mjs'],
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
  ['job-link', 'job-link.test.mjs'],
  ['build-miss', 'build-miss.test.mjs'],
  ['flakes', 'flakes.test.mjs'],
  ['next', 'next.test.mjs'],
  ['calendar', 'test_calendar.mjs'],
  ['glyphs', 'test_glyphs.mjs'],
  ['glitch-titles', 'glitch-titles.mjs'],
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
  ['sitemap', 'sitemap.test.mjs'],
  ['lab-import', 'lab-import.test.mjs'],
  ['beacon', 'beacon-pages.test.mjs'],
  ['traffic', 'traffic.test.mjs'],
  ['indexnow', 'indexnow.test.mjs'],
  ['seo', 'seo.test.mjs'],
  ['seo-audit-unit', 'seo-audit.test.mjs'],
  ['shrink-images', 'shrink-images.test.mjs'],
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
  ['family-logs', 'family-logs.test.mjs'],
  ['spark', 'spark.test.mjs'],
  ['self-blocks', 'self-blocks.test.mjs'],
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
  ['country-wikidata', 'country-wikidata.test.mjs'], // the country card's live source is Wikidata since REST Countries retired its keyless API (issue #1063)
  ['words-family', 'words-family.test.mjs'], // Words and the world: joke, news, book, show, sport, senolytic, video-play checked like a person meets them (Verse's ask)
  ['sky-skills', 'sky-skills.test.mjs'],
  ['sky-world', 'sky-world.test.mjs'],
  ['sky', 'test_sky.mjs'],
  ['take', 'take.test.mjs'],
  ['chess-replay', 'chess-replay.test.mjs'],
  ['sorry', 'sorry.test.mjs'],
  ['voice', 'voice.test.mjs'],
  ['pr-ready', 'pr-ready.test.mjs'],
  ['rea-study', 'rea-study.test.mjs'], ['study-engine', 'study-engine.test.mjs'], ['studies-api', 'studies-api.test.mjs'],
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
  ['motion-throttle', 'motion-throttle.test.mjs'],
  ['field-kit', 'field-kit.test.mjs'],
  ['vector-field', 'vector-field.test.mjs'],
  ['field-cards', 'field-cards.test.mjs'],
  ['field-attention', 'field-attention.test.mjs'],
  ['field-nca', 'field-nca.test.mjs'],
  ['field-resonance', 'field-resonance.test.mjs'],
  ['field-swarm', 'field-swarm.test.mjs'],
  ['orb-field', 'orb-field.test.mjs'], // the memory orbs' bridge to the shared field: no field, null and nothing changes; skills/field.js gives free slots only
  ['orb-memories', 'orb-memories.test.mjs'], // the memory orbs show Verse's memories: a brain's told words where it holds them, other cards' slots, the fluid pulled to them
  ['verse-brain', 'brain.test.mjs'], // Verse Brain: the workspace, twenty-two organs, attention, imagination, the mind layers, kept knowledge
  ['brain-remembers', 'brain-remembers.test.mjs'], // Verse Brain keeps its working memory and attention across a reload, through the shared field
  ['brain-synapses', 'brain-synapses.test.mjs'], // F217's spiking eye: dopamine teaches it, it runs in the brain, its wiring is kept, old records still load
  ['brain-creature', 'brain-creature.test.mjs'], // F304's Lenia creature: it follows a moving target, it learns by online evolution, it runs in the brain, its genome is kept
  ['brain-painter', 'brain-painter.test.mjs'], // F322's look as a program: programs stay valid numbers, evolution beats random search with the same budget, it runs in the brain, its programs are kept
  ['brain-hearing', 'brain-hearing.test.mjs'], // F299's hummed notes: it hears pitch as notes, learns tunes it heard and guesses the next note, runs in the brain, its counts are kept
  ['brain-gardener', 'brain-gardener.test.mjs'], // F215's codec retina gardener: its coder tells still from noise, it keeps more patches at the edge of chaos than the same brain watching, its gardening is kept
  ['brain-grower', 'brain-grower.test.mjs'], // F453's L-system plant: valid grammars, evolution beats random search on held brain states, it bends toward attention, feeds the tissue, is kept
  ['brain-formula', 'brain-formula.test.mjs'], // F451's evolved formula of the tissue: valid trees, tested skill above "nothing changes", evolution beats random search, it feeds the tissue, is kept
  ['brain-current', 'brain-current.test.mjs'], // F447's lattice-Boltzmann flow and evolved swimmers: mass and momentum kept, evolution beats random search and drifters, your drag stirs it, it is kept
  ['brain-grains', 'brain-grains.test.mjs'], // F456's granular grains: genes passed on touch from the nearer lander beat random passing and none, it runs in the brain, it is kept
  ['brain-pool', 'brain-pool.test.mjs'], // F459's SPH pool: a tiny network that sets viscosity, stiffness and kernel size beats the best constant setting and random search, follows the slosh, runs in the brain, is kept
  ['brain-map', 'brain-map.test.mjs'], // /brain/'s live map: every light, spark and line of its feed is a real turn, write or change in the brain's state
  ['brain-trace', 'brain-trace.test.mjs'], // the NCA drafts' cellular automaton: its tuned rule holds where the focus was and lets it go, beats the drafts' rule and random search, runs in the brain, is kept
  ['brain-dream', 'brain-dream.test.mjs'], // the brain's dreams: each fix, job and idea comes from something it read or holds, names it, is posted once by Verse, owner only, inside its limits
  ['brain-everywhere', 'brain-everywhere.test.mjs'], // the brain on every page: /visit.js loads lib/brain-everywhere.js, so a page reads and writes the one brain of the browser, keeps writes when none runs, and starts one only with the lock
  ['brain-host', 'brain-host.test.mjs'], // Verse uses its brain on every page: it hears every ask, learns what you ask next, ranks the ask box by it (measured against newest-first) and answers "what are you thinking?"
  ['brain-glow', 'brain-glow.test.mjs'], // a reload keeps what Verse Brain was just told: its lit ideas come back as bright as they were, dimmed by the time away
  ['shared-field', 'shared-field.test.mjs'], // the shared field (skills/field.js): its API, and Verse Brain feeling other skills' slots and publishing numbers only
  ['field-fluid-orbs', 'field-fluid-orbs.test.mjs'], // F-321: orientation leans the flow, a peak spawns an orb, seal then load gives the same SHA-256
  ['stage-camera', 'stage-camera.test.mjs'],
  ['star-parallax', 'star-parallax.test.mjs'],
  ['operating-laws', 'operating-laws.test.mjs'],
  ['vendor-three', 'vendor-three.test.mjs'],
  ['sw-3d-cache', 'sw-3d-cache.test.mjs'], // the worker never keeps HTML as a 3D file; three.js at a path no edge holds (issue #1114)
  ['fresh-scripts', 'fresh-scripts.test.mjs'], // a deploy reaches a returning browser's scripts on every page: sw.js asks again for each script, visit.js asks again after load where no worker is in control
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
  ['public-quotes', 'public-quotes.test.mjs'],
  ['report-to-growth', 'report-to-growth.test.mjs'],
  ['notebook', 'notebook.test.mjs'],
  ['null-sweep', 'null-sweep.test.mjs'],
  ['merge-void', 'merge-void.test.mjs'],
  ['dim-void', 'dim-void.test.mjs'],
  ['void-breaker', 'void-breaker.test.mjs'],
  ['art-score', 'art-score.test.mjs'],
  ['art-pixels', 'art-pixels.test.mjs'],
  ['bench-concurrency', 'bench-concurrency.test.mjs'],
  ['lacks', 'lacks.test.mjs'],
  ['game-kit', 'game-kit.test.mjs'],
  ['studio-skills', 'studio-skills.test.mjs'],
  ['writing-proof', 'writing-proof.test.mjs'],
  ['arcade-rack', 'arcade-rack.test.mjs'],
  ['reflect-totals', 'reflect-totals.test.mjs'],
  ['grow-clock', 'grow-clock.test.mjs'],
  ['topic-from', 'topic-from.test.mjs'],
  ['card-cycle', 'card-cycle.test.mjs'],
  ['word-sweep', 'word-sweep.test.mjs'],
  ['topic-from', 'topic-from.test.mjs'],
  ['card-cycle', 'card-cycle.test.mjs'],
  ['word-sweep', 'word-sweep.test.mjs'],
  ['telemetry-live', 'telemetry-live.test.mjs'],
  ['deploy-smoke', 'deploy-smoke.test.mjs'],
  ['grow-gate', 'grow-gate.test.mjs'],
  ['grow-self', 'grow-self.test.mjs'],
  ['refresh-tool', 'refresh.test.mjs'],
  ['what-skills', 'what-skills.test.mjs'],
  ['reflect', 'reflect.test.mjs'],
  ['terminal', 'terminal.test.mjs'],
  ['ledger-proof', 'ledger-proof.test.mjs'],
  ['ledger-today', 'ledger-today.test.mjs'],
  ['will-last', 'will-last.test.mjs'],
  ['approval-gate', 'approval-gate.test.mjs'],
  ['shared-chain', 'shared-chain.test.mjs'],
  ['confirm-line-strict', 'confirm-line-strict.test.mjs'],
  ['churn', 'churn.test.mjs'],
  ['coder-route', 'coder-route.test.mjs'],
  ['will-guard', 'will-guard.test.mjs'],
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
  ['list goal', 'list-goal.test.mjs'],
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
  ['tools pack 7', 'tools-pack-7.test.mjs'],
  ['tools pack 5', 'tools-pack-5.test.mjs'],
  ['together', 'together.test.mjs'],
  ['tools pack 6', 'tools-pack-6.test.mjs'],
  ['plan', 'plan.test.mjs'],
  ['chess thinking', 'chess-thinking.test.mjs'],
  ['shared routines', 'shared-routines.test.mjs'],
  ['automations', 'automations.test.mjs'],
  ['approve-card', 'approve-card.test.mjs'],
  ['actions', 'actions.test.mjs'],
  ['ringer', 'ringer.test.mjs'],
  ['queue', 'queue.test.mjs'],
  ['conductor', 'conductor.test.mjs'],
  ['verse-job', 'verse-job.test.mjs'],
  ['tower-size', 'tower-size.test.mjs'],
  ['history-coverage', 'history-coverage.test.mjs'],
  ['tower-target', 'tower-target.test.mjs'],
  ['actions-card', 'actions-card.test.mjs'],
  ['services', 'services.test.mjs'], ['sale-jobs', 'sale-jobs.test.mjs'], ['sale-e2e', 'sale-e2e.test.mjs'], ['reply-to-job', 'reply-to-job.test.mjs'], ['email-worker', 'email-worker.test.mjs'], ['rehearsal-route', 'rehearsal-route.test.mjs'], ['email-send', 'email-send.test.mjs'],
  ['proposal', 'proposal.test.mjs'], ['job-draft', 'job-draft.test.mjs'],
  ['memory-card', 'memory-card.test.mjs'],
  ['told-me', 'told-me.test.mjs'],
  ['answer-edge', 'answer-edge.test.mjs'],
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
  ['memory-graph', 'memory-graph.test.mjs'],
  ['fringe-novelty', 'fringe-novelty.test.mjs'],
  ['skills-unlisted', 'skills-unlisted.test.mjs'],
  ['skill-family', 'skill-family.test.mjs'],
  ['heavy', 'heavy.test.mjs'],
  ['pool', 'pool.test.mjs'],
  ['checks-changed', 'checks-changed.test.mjs'], // which checks --changed runs (structural: the runner's own selection is proven on every change)
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
  ['game-health', 'game-health.test.mjs'],
  ['completeness', 'completeness.test.mjs'],
  ['lap', 'lap.test.mjs'],
  ['tower', 'tower.test.mjs'],
  ['tower-plan', 'tower-plan.test.mjs'],
  ['tower-self', 'tower-self.test.mjs'],
  ['gate-badge', 'gate-badge.test.mjs'],
  ['tower-mini', 'tower-mini.test.mjs'],
  ['tower-falsepass', 'tower-falsepass.test.mjs'],
  ['avatar', 'avatar.test.mjs'],
  ['tower-verdict', 'tower-verdict.test.mjs'],
  ['site-scout', 'site-scout.test.mjs'],
  ['coins', 'coins.test.mjs'],
  ['easiest-sites', 'easiest-sites.test.mjs'],
  ['gist', 'gist.test.mjs'],
  ['persona-playtest', 'persona-playtest.mjs'],
  ['ics', 'ics.test.mjs'],
  ['lineage', 'lineage.test.mjs'],
  ['remediation-velocity', 'remediation-velocity.test.mjs'],
  ['backlog-digest', 'backlog-digest.test.mjs'],
  ['card-kinds', 'card-kinds.test.mjs'],
  ['scrim', 'scrim.test.mjs'],
  ['merge-rules', 'merge-rules.test.mjs'],
  ['merge-route', 'merge-route.test.mjs'],
  ['card-art-route', 'card-art-route.test.mjs'],
  ['react', 'react.test.mjs'],
  ['tally', 'tally.test.mjs'],
  ['card-subject', 'card-subject.test.mjs'],
  ['page-picture', 'page-picture.test.mjs'],
  ['card-forge', 'card-forge.test.mjs'],
  ['repo-look', 'repo-look.test.mjs'],
  ['event-date', 'event-date.test.mjs'],
  ['paste-rule', 'paste-rule.test.mjs'],
  ['card-share', 'card-share.test.mjs'],
  ['rally', 'rally.test.mjs'],
  ['forge-duel', 'forge-duel.test.mjs'],
  ['gamebox', 'gamebox.test.mjs'],
  ['card-art', 'card-art.test.mjs'],
  ['card-image', 'card-image.test.mjs'],
  ['video', 'video.test.mjs'],
  ['digest', 'digest.test.mjs'],
  ['well-known', 'well-known.test.mjs'],
  ['preload', 'preload.test.mjs'],
  ['pwcheck', 'pwcheck.test.mjs'],
  ['weather-page', 'weather.test.mjs'],
  ['weather-api', 'weather-api.test.mjs'],
  ['baseconv', 'baseconv.test.mjs'],
  ['imgfit', 'imgfit.test.mjs'],
  ['arrange', 'arrange.test.mjs'],
  ['sing', 'sing.test.mjs'],
  ['wiki-look', 'wiki-look.test.mjs'],
  ['colour', 'colour.test.mjs'],
  ['tower-gate', 'tower-gate.test.mjs'],
  ['tower-norival', 'tower-norival.test.mjs'],
  ['tower-merge', 'tower-merge.test.mjs'],
  ['site-icons', 'site-icons.test.mjs'],
  ['gradient', 'gradient.test.mjs'],
  ['wheel', 'wheel.test.mjs'],
  ['prizes', 'prizes.test.mjs'],
  ['ledger', 'ledger.test.mjs'],
  ['handoff', 'handoff.test.mjs'],
  ['fakeuser', 'fakeuser.test.mjs'],
  ['beacon', 'beacon.test.mjs'],
  ['wordcount', 'wordcount.test.mjs'],
  ['stopwatch', 'stopwatch.test.mjs'],
  ['units', 'units.test.mjs'],
  ['calculator', 'calculator.test.mjs'],
  ['fincalc', 'fincalc.test.mjs'],
  ['palettes', 'palettes.test.mjs'],
  ['calculator-models', 'calculator-models.test.mjs'],
  ['zones', 'zones.test.mjs'],
  ['base64', 'base64.test.mjs'],
  ['toolkit', 'toolkit.test.mjs'],
  ['studios', 'studios.test.mjs'], // the tower studios answer their own stage asks (skills/studios.js)
  ['deps', 'deps.test.mjs'],
  ['review-main', 'review-main.test.mjs'],
  ['stage-pack-f', 'stage-pack-f.test.mjs'],
  ['thinking math', 'thinking-math.test.mjs'],
  ['tools pack 3', 'tools-pack3.test.mjs'],
  ['convert-math', 'convert-math.test.mjs'],
  ['calculators', 'calculators.test.mjs'],
  ['formula engine', 'formula-engine.test.mjs'],
  ['formula library', 'formulas.test.mjs'],
  ['shape skill', 'shape-skill.test.mjs'],
  ['battleship skill', 'battleship-skill.test.mjs'],
  ['parody data', 'parody-data.test.mjs'],
  ['music-de', 'music-de.test.mjs'],
  ['inline-scripts', 'inline-scripts.test.mjs'],
]) {
  addScript(name, file);
}
// Every script parses, and no text file was re-encoded through a Windows code page (a merge did both to main once:
// a dash turned into three box-drawing letters, lines doubled, a const declared twice, and CI died before running a single test).
// With --changed only the changed files are read (a garbled or unparsable file comes in with a change): 79 s of parsing becomes a second
add('files', async () => { const tracked = spawnSync('git', ['ls-files', '*.js', '*.mjs', '*.html', '*.md', '*.json', '*.py', '*.yml', ':!archive/repos'] /* early builds kept as found (archive/repos/README.md) */, { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const files = narrowToChanged ? tracked.filter((f) => changedList.includes(f)) : tracked, counted = narrowToChanged ? files.length + ' changed of ' + tracked.length : String(tracked.length);
  const GARBLED = /\u0393[\u00c7\u00c4]|\u252c[\u2556\u2591\u00aa]|\u251c[\u00ba\u00e9]|\u256c\u00f4/; // the cp437 readings of UTF-8 dashes, dots, quotes
  const garbled = files.filter((f) => GARBLED.test(readFileSync(resolve(root, f), 'utf8')));
  // a page's own <script> text is parsed too: an inline module that did not parse took /news/ down (#1741) with every check green
  const tmp = mkdtempSync(resolve(tmpdir(), 'inline-scripts-'));
  const inline = files.filter((f) => /\.html$/.test(f)).flatMap((f) => inlineScripts(readFileSync(resolve(root, f), 'utf8')).map((s, i) => {
    const p = resolve(tmp, f.replace(/[^\w.-]/g, '_') + '.' + i + (s.module ? '.mjs' : '.cjs')); writeFileSync(p, s.code); return [f + ' (inline script ' + s.n + ')', p]; }));
  const checked = await Promise.all([...files.filter((f) => /\.m?js$/.test(f)).map((f) => [f, resolve(root, f)]), ...inline].map(async ([f, p]) => [f, await run(['--check', p])]));
  const broken = checked.filter(([, r]) => !r.ok).map(([f]) => f);
  return [!garbled.length && !broken.length, garbled.length || broken.length
    ? [garbled.length && 'garbled text in ' + garbled.join(', '), broken.length && 'does not parse: ' + broken.join(', ')].filter(Boolean).join('; ')
    : counted + ' files: clean text, every script parses (' + inline.length + ' inline in pages)', checked.reduce((t, [, r]) => t + r.ms, 0)]; });
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
// every line this branch adds, in every file type, holds no real key (tools/secret-scan.mjs; owner, 2026-10-15: "make Verse the best
// at keeping secrets ever made"): the review skips docs and data, and a pasted key in a log is the likeliest leak
addScript('secrets', 'secret-scan.mjs', ['--base', 'origin/main']);
addScript('index', 'skills-index.mjs', ['--check']);
// every module a direct page (/flip/, /g/, /conquered/) imports is preloaded in its head (tools/preload.mjs; owner, 2026-10-24: "speed fixes a
// lot of our other issues and is worth fixing permanently"): an import added without its preload is a waterfall again
addScript('preload-pages', 'preload.mjs', ['--check']);
// the page guard (owner, 2026-10-26: "all sites get a page"): a frontier site that reaches the front of the Versus queue has a page of its own (tools/tower-self.mjs)
addScript('versus-pages', 'tower-self.mjs', ['guard']);
// every page is real (owner, 2026-10-28): each route has a spec in tools/real-pages.mjs (pure), and the pages this branch changed run it in a browser
add('real-pages-list', async () => { const r = await run([resolve(here, 'real-pages.mjs'), '--list']); return [r.ok, last(r), r.ms]; });
addScript('real-pages', 'real-pages.mjs', ['--changed', '--base', 'local']);
// Verse's own SEO tool over every page it serves (tools/seo-audit.mjs, lib/seo-audit.js; owner, 2026-10-26: "Verse uses its own tools"): a missing
// canonical, title, description or share card, a broken internal link, unparsable JSON-LD, a page nothing links to, or one fewer free page leading
// to what Verse sells fails here; the counts in tools/seo-audit.baseline.json only go down
addScript('seo-audit', 'seo-audit.mjs', ['--check']);
// the share pictures in og/ go out through Verse's own photo compressor (tools/shrink-images.mjs, lib/photo-edit.js's palette PNG): one that went in raw fails
addScript('og-shrunk', 'shrink-images.mjs', ['--check']);
addScript('similar', 'similar-index.mjs', ['--check']); // the "what's similar" index of every family's parts (lib/similar-index.js)
addScript('refresh', 'refresh.mjs', ['--check']);
addScript('art', 'art-score.mjs', ['--check']); // the card art, scored from its source: the floor only rises (tools/art-floor.json)
addScript('art-pixels', 'art-pixels.mjs', ['--check']); // the card art as a person sees it, in Chromium (passes with a note when there is no browser) // every committed generated card in one row, with the name of each stale one (deploy.yml regenerates them all)
// a new skill whose examples another skill also takes is a merge waiting to happen (tools/skill-overlap.mjs; owner 2026-10-15)
addScript('overlap', 'skill-overlap.mjs', ['--check']);
// no sentence cut with an ellipsis: the per-file allowance only goes down (tools/no-ellipsis.mjs; owner 2026-10-21)
addScript('no-ellipsis', 'no-ellipsis.mjs', []);
// every skill sits in a skill family and families.json says how far each is checked (tools/families.mjs, Verse's own ask)
addScript('families-json', 'families.mjs', ['--check']);
// the dependency map (skills/deps.json, tools/deps.mjs; asked by Verse) is read off the import lines and kept current like families.json
// a check keyed on a name the page lost to skills/ fails on every run (the published-page check, #545): found before it ships (asked by Verse)
addScript('moved-check', 'moved-check.mjs');
addScript('deps-json', 'deps.mjs', ['--check']);
// the book (skills/guide.json) names every skill, game and miniature on one page each; stale or a skill on no page fails (tools/guide.mjs)
addScript('guide-json', 'guide.mjs', ['--check']);
// the MCP skill tools (lib/mcp-skills.js) are the ten proven read-only skills with the most evidence, as the ratings now say (asked by Verse)
addScript('mcp-skills', 'mcp-skills.mjs', ['--check']);
// stale docs (docs/multipliers.md #4): a doc may not newly name a repo file that does not exist
addScript('doc-drift', 'doc-drift.mjs', ['--check']);
// the untested-code ratchet (docs/multipliers.md #3): no new lib/ or skills/ file without a test that names it
// letter reversals in the skills' metadata (asked by Verse: a typo audit in the builder's CI; tools/typo-audit.mjs, allow-list tools/typo-audit.json)
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
// --changed: the structural checks and the ones whose files, imports or names a changed file touches (tools/checks-changed.mjs); one line says what was left out
const chosen = changedMode ? selectChanged(jobs, changedList, { deps: readDeps() }) : null;
if (chosen) console.log(chosen.line);
const picked = chosen ? new Set(chosen.run) : null;
const wanted = jobs.filter((j) => (!skipBrowser || !j.browser) && (!only.length || only.some((w) => j.name.toLowerCase().includes(w))) && (!picked || picked.has(j)));
const t0 = Date.now(), results = new Array(wanted.length), timings = [];
const exec = async (j, i) => { const s = Date.now(); let r; try { r = await j.fn(); } catch (e) { r = [false, 'check crashed: ' + (e && e.message || e)]; }
  results[i] = [j.name, r[0], r[1]]; timings.push({ name: j.name, ms: r[2] ?? Date.now() - s, browser: j.browser }); };
const lane = wanted.reduce((p, j, i) => (j.browser ? p.then(async () => { browserRunning++; try { await exec(j, i); } finally { browserRunning--; gate.poke(); } }) : p), Promise.resolve());
await Promise.all([lane, ...wanted.map((j, i) => (j.browser ? null : exec(j, i)))]);
const wall = Date.now() - t0;
if (process.env.VOID_SKIP_BENCH && !only.length && !skipBrowser && !results.some(([n, , l]) => n === 'bench' && /^skipped/.test(l))) results.push(['self', false, 'VOID_SKIP_BENCH is set but the bench row did not say skipped']);
for (const [n, ok, line] of results) console.log((ok ? (/^inconclusive/.test(line) ? 'inconclusive ' : 'ok   ') : 'FAIL ') + n.padEnd(9) + line);
{ const pure = timings.filter((t) => !t.browser), br = timings.filter((t) => t.browser);
  console.log(`\n${results.length} checks in ${fmtMs(wall)} (${pure.length} pure, up to ${poolSize(false)} at once: ${fmtMs(pure.reduce((t, x) => t + x.ms, 0))} of work; ${br.length} browser: ${fmtMs(br.reduce((t, x) => t + x.ms, 0))})${chosen ? '; ' + chosen.line.replace(/^--changed: /, '--changed ran ') : ''}`);
  console.log('slowest: ' + slowest(timings).map((t) => `${t.name}${t.browser ? ' (browser)' : ''} ${fmtMs(t.ms)}`).join(', ')); }
process.exit(results.every((r) => r[1]) ? 0 : 1);
