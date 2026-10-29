// tools/feature-scan.mjs, the pure parts: which links are read, features from a page's own words, the file merge that never touches people's
// sections, has/partial/missing against Verse's text, the gaps queued once each in the tower's order, and the gate's feature facts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickLinks, robotsAllows, pageProblem, nameOf, heuristicFeatures, parseModelFeatures, compare, gapsOf, mergeAuto, putMine, planOf, nextJobs, jobOf, floorsOf, messagesOf } from './feature-scan.mjs';
import { FLOORS, hostOf } from '../void-live-deploy/lib/tower.js';
import { keywordsOf, showsFeature, factsFromFile, featureSlug, withFeatureFacts, probeFor } from './tower-probes.mjs';

test('links: same site only, the feature, pricing, how, FAQ, help and about pages first, no sign-in, legal or files, at most max', () => {
  const links = [
    { href: '/features', text: 'Features' }, { href: 'https://www.example.com/pricing', text: 'Plans' }, { href: '/login', text: 'Log in' },
    { href: 'https://other.com/features', text: 'Features' }, { href: '/privacy', text: 'Privacy policy' }, { href: '/faq#top', text: 'FAQ' },
    { href: '/about', text: 'About us' }, { href: '/blog/post', text: 'A post' }, { href: '/help/guide.pdf', text: 'Help (PDF)' }, { href: '/features/', text: 'All features' },
    { href: 'mailto:x@example.com', text: 'help' }, { href: '/how-it-works', text: 'See it' }, { href: '/', text: 'Home' },
  ];
  const got = pickLinks('https://example.com/', links, 6).map((u) => new URL(u).pathname);
  assert.deepEqual(got, ['/features', '/pricing', '/how-it-works', '/faq', '/about']);
  assert.equal(pickLinks('https://example.com/', links, 2).length, 2);
  assert.deepEqual(pickLinks('not a url', links), []);
});

test('robots.txt: the * group, the longest rule, Allow on a tie, wildcards and $', () => {
  const txt = 'User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\nAllow: /private/open\nDisallow: /*.php$\n';
  assert.equal(robotsAllows(txt, '/'), true);
  assert.equal(robotsAllows(txt, '/private/x'), false);
  assert.equal(robotsAllows(txt, '/private/open/1'), true);
  assert.equal(robotsAllows(txt, '/a.php'), false);
  assert.equal(robotsAllows('', '/anything'), true);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /', '/features'), false);
});

test('page problems: parked, a near-empty stub, a sign-in wall; a real page is fine', () => {
  assert.match(pageProblem({ text: 'example.org — This domain is for sale! Make an offer today.' + ' x'.repeat(100) }), /parked/);
  assert.match(pageProblem({ text: 'Redirecting…' }), /nearly empty/);
  assert.match(pageProblem({ text: 'Welcome back. Sign in to continue. Email Password Forgot password? Create an account and start writing.' + ' .'.repeat(40), headings: ['Sign in'], items: [] }), /sign-in wall/);
  assert.equal(pageProblem({ text: 'Notes that sync. '.repeat(60), headings: ['Write', 'Share', 'Search'], items: ['Markdown', 'Tags', 'Export'] }), null);
});

test('heuristic features: headings, items, buttons and pricing rows, navigation and noise left out, no repeats, paid from pricing', () => {
  assert.equal(nameOf('Log in'), ''); assert.equal(nameOf('How do I export?'), ''); assert.equal(nameOf('$4.99 / month'), ''); assert.equal(nameOf('✓ Export to PDF.'), 'Export to PDF');
  assert.equal(nameOf('10 results per click'), '10 results per click');
  const f = heuristicFeatures([
    { url: 'https://n.com/', headings: ['Write anywhere', 'Features'], items: ['Export to PDF', 'Markdown support', 'Export to PDF'], buttons: ['Sign up', 'Share a note'], rows: [] },
    { url: 'https://n.com/pricing', pricing: true, headings: ['Unlimited history'], items: ['Version history — Pro, $4/month'], buttons: [], rows: ['Offline mode\tFree\tIncluded'] },
  ]);
  assert.deepEqual(f.map((x) => x.name), ['Write anywhere', 'Unlimited history', 'Export to PDF', 'Markdown support', 'Version history — Pro, $4/month', 'Share a note', 'Offline mode']);
  assert.equal(f.find((x) => /Version history/.test(x.name)).paid, true);
  assert.equal(f.find((x) => x.name === 'Export to PDF').paid, false);
});

test('the model: a strict JSON answer is read and cut to size; anything else is null (the heuristic reads the site)', () => {
  assert.deepEqual(parseModelFeatures('Here: {"features":[{"name":"Dice roller","detail":"Rolls 3d6.","paid":false},{"name":"dice  roller","detail":"again"},{"name":"Team plan","detail":"x","paid":true}]}'),
    [{ name: 'Dice roller', detail: 'Rolls 3d6.', paid: false }, { name: 'Team plan', detail: 'x', paid: true }]);
  assert.equal(parseModelFeatures('no json here'), null); assert.equal(parseModelFeatures('{"features":[]}'), null); assert.equal(parseModelFeatures('{"features": [oops]}'), null);
  const m = messagesOf('n.com', [{ url: 'https://n.com/', text: 'a'.repeat(5000) }, { url: 'https://n.com/faq', text: 'b'.repeat(5000) }]);
  assert.equal(m.length, 2); assert.ok(m[1].content.length < 6500, 'each page at most 3000 characters');
});

test('has, partial and missing against Verse\'s words, with the words as evidence; keys dropped', () => {
  assert.deepEqual(keywordsOf('Save favourite names'), ['save', 'favourite', 'name']); assert.deepEqual(keywordsOf('Seeded randomness'), ['seed', 'random']);
  const verse = 'Keep your favourite results. Copy all. Share link. Seed 7. Works offline.';
  assert.equal(showsFeature('Copy / share results', verse).verse, 'has');
  assert.equal(showsFeature('Save favourite names', verse).verse, 'partial');
  assert.equal(showsFeature('Dice roller', verse).verse, 'missing');
  assert.equal(showsFeature({ name: 'Dark mode', shows: 'prefers-color-scheme|dark' }, 'dark theme').verse, 'has');
  const c = compare([{ name: 'Dice roller', detail: '', paid: false }, { name: 'Copy results', detail: 'gh' + 'p_' + 'Q7mZ'.repeat(9), paid: false }], verse, '/generators/'); // secret-scan: ok
  assert.equal(c.length, 1); assert.equal(c[0].verse, 'missing'); assert.match(c[0].verse_evidence, /\/generators\/ shows none of its words; not "dice", "roller"/);
  assert.equal(compare([{ name: 'X tool', detail: '' }], '', '/x/')[0].verse, 'unchecked');
});

const HAND = { floor: 'random generators', verse_page: '/generators/', researched: '2026-10-25', sites: { 'perchance.org': { leader: true, sources: ['s'], features: [{ name: 'Plain lists', verse: 'partial' }, { name: 'Dice roller', verse: 'missing', detail: 'd' }] } }, union_gaps: ['people wrote this'], verse_extra: ['and this'] };
const FLOOR = { id: 'random generators', slug: 'random-generators', page: '/generators/', sites: [{ id: 'random generators', url: 'https://perchance.org/', host: 'perchance.org', leader: true }, { id: 'random generators: rangen.co.uk', url: 'https://rangen.co.uk/', host: 'rangen.co.uk' }] };
const SCAN = { 'rangen.co.uk': { url: 'https://rangen.co.uk/', scanned: '2026-10-26', method: 'heuristic', features: [{ name: 'Name generator', detail: '', paid: false, verse: 'has' }, { name: 'Dice roller', detail: '', paid: false, verse: 'missing' }] } };

test('merge: people\'s file keeps every section and gets the scan under auto; no file becomes a whole file with source auto', () => {
  const before = JSON.stringify(HAND), m = mergeAuto(HAND, FLOOR, SCAN, '2026-10-26');
  assert.equal(JSON.stringify(HAND), before, 'the input is not changed');
  for (const k of Object.keys(HAND)) assert.deepEqual(m[k], HAND[k], k + ' untouched');
  assert.deepEqual(Object.keys(m.auto.sites), ['rangen.co.uk']); assert.deepEqual(m.auto.gaps, [{ name: 'Dice roller', sites: ['rangen.co.uk'] }]); assert.equal(m.auto.scanned, '2026-10-26');
  const again = mergeAuto(m, FLOOR, { 'perchance.org': { scanned: '2026-10-27', features: [] } }, '2026-10-27');
  assert.deepEqual(Object.keys(again.auto.sites).sort(), ['perchance.org', 'rangen.co.uk'], 'a later scan of other sites adds to the block');
  const own = mergeAuto(null, FLOOR, SCAN, '2026-10-26');
  assert.equal(own.source, 'auto'); assert.equal(own.floor, 'random generators'); assert.deepEqual(own.sites, SCAN); assert.equal(own.gaps.length, 1); assert.deepEqual(own.auto.queued, []);
});

test('landing: a run\'s block folded into the file as it stands on main keeps newer scans, every queued job and people\'s sections', () => {
  const onMain = { ...HAND, auto: { scanned: '2026-10-27', sites: { 'perchance.org': { scanned: '2026-10-27', features: [] } }, queued: [{ target: 'feature:a' }] } };
  const mine = { auto: { scanned: '2026-10-26', sites: { ...SCAN, 'perchance.org': { scanned: '2026-10-20', features: [{ name: 'old', verse: 'missing' }] } }, queued: [{ target: 'feature:b' }] } };
  const out = putMine(onMain, mine);
  assert.deepEqual(out.sites, HAND.sites); assert.deepEqual(out.union_gaps, HAND.union_gaps);
  assert.equal(out.auto.sites['perchance.org'].scanned, '2026-10-27', 'the newer scan stays'); assert.ok(out.auto.sites['rangen.co.uk']);
  assert.deepEqual(out.auto.queued.map((q) => q.target), ['feature:a', 'feature:b']); assert.equal(out.auto.scanned, '2026-10-27');
  const own = mergeAuto(null, FLOOR, SCAN, '2026-10-26');
  assert.deepEqual(putMine(null, { file: own }), own, 'no file on main: the run\'s whole file');
  const handMeanwhile = putMine(HAND, { file: own });
  assert.equal(handMeanwhile.source, undefined, 'people wrote the file meanwhile: theirs stays'); assert.deepEqual(Object.keys(handMeanwhile.auto.sites), ['rangen.co.uk']);
});

test('plan: no file scans every site, a file only the sites it lacks, stale files oldest first, in the tower\'s order, capped', () => {
  const floors = [FLOOR, { id: 'calendar', slug: 'calendar', sites: [{ id: 'calendar', url: 'https://calendar.google.com/', host: 'calendar.google.com', leader: true }] }];
  const files = { 'random-generators': HAND };
  const p = planOf({ floors, files, order: ['calendar', 'random generators: rangen.co.uk', 'random generators'], missing: true });
  assert.deepEqual(p.map((x) => [x.floor.id, x.sites.map((s) => s.host)]), [['calendar', ['calendar.google.com']], ['random generators', ['rangen.co.uk']]]);
  assert.equal(planOf({ floors, files, missing: true, maxSites: 1 }).reduce((n, x) => n + x.sites.length, 0), 1);
  const now = Date.parse('2026-12-01');
  assert.deepEqual(planOf({ floors, files, stale: 30, now }).map((x) => x.sites.length), [2], 'a stale floor is scanned whole');
  assert.deepEqual(planOf({ floors, files: { 'random-generators': { ...HAND, auto: { scanned: '2026-11-20' } } }, stale: 30, now }), [], 'a recent scan is fresh');
});

test('gaps to the queue: the lowest unbeaten floor first, a lane site before its leader, each gap once ever, paid ones never, at most max', () => {
  const files = { 'random-generators': { ...HAND, auto: { sites: { 'rangen.co.uk': { features: [{ name: 'Dice roller', verse: 'missing' }, { name: 'Gold plan', verse: 'missing', paid: true }, { name: 'Lists', verse: 'has' }] } }, queued: [] } } };
  const order = ['random generators: rangen.co.uk', 'random generators'];
  const jobs = nextJobs({ order, floors: [FLOOR], files, max: 3 });
  assert.deepEqual(jobs.map((j) => [j.host, j.feature]), [['rangen.co.uk', 'Dice roller'], ['perchance.org', 'Dice roller']]);
  for (const j of jobs) assert.ok(j.target.length <= 40 && /^feature:/.test(j.target), j.target);
  assert.equal(jobOf('random generators', 'rangen.co.uk', { name: 'dice ROLLER' }).target, jobs[0].target, 'the same gap is the same target');
  files['random-generators'].auto.queued = [{ target: jobs[0].target }];
  assert.deepEqual(nextJobs({ order, floors: [FLOOR], files, max: 3 }).map((j) => j.host), ['perchance.org'], 'queued once ever');
  assert.equal(nextJobs({ order, floors: [FLOOR], files, max: 0 }).length, 0);
  assert.deepEqual(gapsOf({ a: { features: [{ name: 'X', verse: 'missing' }] }, b: { features: [{ name: 'x', verse: 'missing' }, { name: 'Y', verse: 'missing' }] } }), [{ name: 'X', sites: ['a', 'b'] }, { name: 'Y', sites: ['b'] }]);
});

test('floors: the hand-named ones with the leader at the gate\'s address and each lane site at its own', () => {
  const fl = floorsOf().find((f) => f.id === 'docs and notes');
  const lanes = FLOORS.filter((f) => f.lane === 'docs and notes');
  assert.ok(fl.sites[0].leader); assert.equal(fl.sites.length, lanes.length + 1);
  for (const l of lanes) assert.ok(fl.sites.some((s) => s.id === l.id && s.url === l.url && s.host === hostOf(l.url)), l.id + ' at its own address, not the leader\'s');
  assert.ok(!floorsOf().some((f) => /: /.test(f.id)), 'lane sites are filed under their floor');
});

test('the gate: a floor with a features file counts the features Verse has, never one named for what a site lacks', () => {
  assert.equal(featureSlug('translate: deepl.com'), 'translate'); assert.equal(featureSlug('docs and notes'), 'docs-and-notes');
  const file = { sites: { 'b.com': { features: [{ name: 'Dice roller', verse: 'has' }] }, 'a.com': { leader: true, features: [{ name: 'Seeded randomness', verse: 'has' }, { name: 'No sign-up', verse: 'has' }, { name: 'Gallery', verse: 'missing' }] } }, auto: { sites: { 'c.com': { features: [{ name: 'Dice roller', verse: 'has' }, { name: 'Word lists', verse: 'has' }] } } } };
  const facts = factsFromFile(file, 6);
  assert.deepEqual(facts.map(([l]) => l), ['Seeded randomness', 'Dice roller', 'Word lists']);
  assert.equal(facts[0][1]('every result has a seed, random by default'), true); assert.equal(facts[1][1]('nothing here'), false);
  assert.equal(factsFromFile(file, 1).length, 1);
  const p = probeFor('random generators'), withF = withFeatureFacts(p, 'random generators');
  assert.ok(withF.facts.length > p.facts.length, 'the hand file adds facts'); assert.equal(withF.facts.slice(0, p.facts.length).map(([l]) => l).join(), p.facts.map(([l]) => l).join(), 'the probe\'s own facts first, unchanged');
  const dir = new URL('file:///nonexistent-features-dir/'), uc = probeFor('unit converter');
  assert.equal(withFeatureFacts(uc, 'unit converter', 6, dir), uc, 'no file: the probe as it was');
  assert.equal(withFeatureFacts(null, 'random generators'), null, 'no probe: nothing added');
});
