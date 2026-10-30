// tests for tools/tower-self.mjs (Versus by itself): the families a site can join, the pick, the row's words, the page, the offline list, the judge,
// the page guard, and that the loop runs without Claude: neither its workflow nor any file it runs or imports mentions Anthropic or the Claude brain.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sentences, parseAnswer, familiesOf, pickCandidates, validTexts, fallbackTexts, brandTokens, slugFor, variantHtml, swWith, judgeRows, guardOf, reportLine, sharesWords, textOf, MARK, RETRY_DAYS } from './tower-self.mjs';
import { FLOORS, LANES, LANE_PAGES, passingRows } from '../void-live-deploy/lib/tower.js';
import { SELF_SITES } from '../void-live-deploy/lib/self-sites.js';
import { SITE_PAGES } from '../void-live-deploy/lib/tool-sites.js';
import { probeFor } from './tower-probes.mjs';

const root = new URL('..', import.meta.url).pathname;
const colour = () => familiesOf().find((f) => f.id === 'colour');

test('the loop runs without Claude: its workflow and every file it runs or imports name neither Anthropic nor the Claude brain', () => {
  // any mention counts, except a key pattern the secret scan looks for (it finds such keys; it never calls anyone)
  const seen = new Set(['tools/tower-self.test.mjs']), bad = [], CLAUDE = /anthropic|claude-brain/i;
  const visit = (rel) => {
    if (seen.has(rel)) return; seen.add(rel); const file = path.join(root, rel); if (!fs.existsSync(file)) return;
    const src = fs.readFileSync(file, 'utf8'), lines = src.split('\n').filter((l) => CLAUDE.test(l) && !(rel === 'tools/secret-scan.mjs' && /\bsk-|style sk-|key/i.test(l))); if (lines.length) bad.push(rel + ': ' + lines[0].trim().slice(0, 80));
    if (/\.(?:mjs|js)$/.test(rel)) for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*|^import\s*)['"](\.{1,2}\/[^'"]+)['"]/gm)) visit(path.normalize(path.join(path.dirname(rel), m[1])));
  };
  const wf = '.github/workflows/tower-self.yml'; visit(wf);
  for (const m of fs.readFileSync(path.join(root, wf), 'utf8').matchAll(/tools\/[\w.-]+\.(?:mjs|sh)/g)) visit(m[0]);
  for (const sh of [...seen].filter((r) => r.endsWith('.sh'))) for (const m of fs.readFileSync(path.join(root, sh), 'utf8').matchAll(/tools\/[\w.-]+\.mjs/g)) visit(m[0]);
  assert.ok(seen.size > 10, 'the import graph was walked (' + seen.size + ' files)');
  assert.deepEqual(bad, [], 'files of the tower-self loop that mention Anthropic or the Claude brain');
});

test('a family is a floor with a page that can be copied and a probe that knows the answer on that page', () => {
  const fams = familiesOf(), ids = fams.map((f) => f.id);
  for (const id of ['colour', 'calculator', 'unit converter', 'word count', 'gradient']) assert.ok(ids.includes(id), id);
  for (const id of ['is it', 'image boards', 'codebase', 'shopping', 'pdf', 'travel']) assert.ok(!ids.includes(id), id + ' is not a family');
  for (const f of fams) { assert.match(f.base, /^\/[a-z0-9-]+\/$/); assert.ok(f.does.length > 20, f.id + ' says what its page does'); }
  assert.ok(sharesWords(colour(), 'ANYCOLOR ID: find any color by hex code'));
  assert.ok(!sharesWords(colour(), 'Web hosting and domains in Norway'));
});

test('the pick: easiest frontier sites first, never a floor, a blocked site or one tried lately; a site no floor covered comes back later', () => {
  const frontier = { sites: [{ site: 'b.test', hardness: 30 }, { site: 'a.test', hardness: 10 }, { site: 'c.test', hardness: 20, blocked: 'wall' }, { site: 'colorzilla.com', hardness: 1 }, { site: 'd.test', hardness: 40 }] };
  const at = Date.parse('2026-10-26T00:00:00Z');
  assert.deepEqual(pickCandidates(frontier, {}, { at }).map((x) => x.host), ['a.test', 'b.test', 'd.test']);
  const state = { sites: { 'a.test': { at: '2026-10-25T00:00:00Z', outcome: 'built' }, 'b.test': { at: '2026-10-25T00:00:00Z', outcome: 'no-family' }, 'd.test': { at: '2026-01-01T00:00:00Z', outcome: 'no-family' } } };
  assert.deepEqual(pickCandidates(frontier, { sites: { 'a.test': { at: '2026-10-25T00:00:00Z', outcome: 'not-judged' } } }, { at }).map((x) => x.host)[0], 'a.test', 'a site the model never judged is read again');
  assert.deepEqual(pickCandidates(frontier, state, { at }).map((x) => x.host), ['d.test'], 'no-family comes back after ' + RETRY_DAYS + ' days');
  assert.equal(pickCandidates(frontier, {}, { at, max: 1 }).length, 1);
});

test('the row\'s words: never the site, never what the page does not do, never markup or a key; the family page\'s own words otherwise', () => {
  const fam = colour(), baseText = textOf(fs.readFileSync(path.join(root, 'void-live-deploy/color/index.html'), 'utf8')) + ' ' + fam.does;
  const good = { name: 'Colour names and codes', h1: 'Colour names and codes', intro: 'Type a colour as hex, RGB or a name and get its nearest name, every model, tints and shades.', does: 'Type a colour as hex, RGB, HSL or a name and get its nearest name, every model, tints and shades.', asks: ['color name finder', 'hex color names', 'what color is this'], slug: 'hex-names' };
  const ok = validTexts(good, { host: 'anycolorid.com', baseText, fam }); assert.ok(!ok.problem, ok.problem); assert.equal(ok.slug, 'hex-names');
  assert.match(validTexts({ ...good, name: 'AnyColorID clone' }, { host: 'anycolorid.com', baseText, fam }).problem, /names anycolorid/);
  assert.match(validTexts({ ...good, intro: good.intro + ' Better than colorhexa.com.' }, { host: 'anycolorid.com', baseText, fam }).problem, /names a site/);
  assert.match(validTexts({ ...good, does: 'Upload photographs, translate subtitles, schedule meetings and invoices automatically.' }, { host: 'x.com', baseText, fam }).problem, /does not do/);
  assert.match(validTexts({ ...good, intro: good.intro + ' <script>x</script>' }, { host: 'x.com', baseText, fam }).problem, /markup/);
  assert.deepEqual(brandTokens('www.any-color-id.com'), ['www', 'any-color-id', 'any', 'color'].filter((w) => w !== 'www'));
  const fb = fallbackTexts(fam); assert.ok(fb.intro.length > 30 && fb.name.length > 3);
  assert.equal(slugFor('hex-names', fam, () => false), '/color/hex-names/');
  assert.equal(slugFor('hex-names', fam, (p) => p === '/color/hex-names/'), '/color/hex-names-2/');
  assert.equal(slugFor('Not A Slug!', fam, () => false), '/color/colour-picker-tool/');
});

test('the page is its family\'s page with its own title, preview words, headline and intro; the offline list gains it once', () => {
  const base = '<!doctype html>\n<html><head><title>Colour · Verse</title>\n<meta name="description" content="old">\n<meta property="og:url" content="https://a-to-mind.com/color/">\n<!-- seo -->\nX\n<!-- /seo -->\n</head><body><h1>Colour</h1>\n<p class="intro">old intro</p><!-- asks -->\nY\n<!-- /asks --></body></html>';
  const row = { path: '/color/hex-names/', name: 'Colour names & codes', h1: 'Colour names', intro: 'Find a name.', does: 'Names for colours.' };
  const h = variantHtml(base, row);
  assert.ok(h.includes(MARK)); assert.match(h, /<title>Colour names &amp; codes · Verse<\/title>/); assert.match(h, /name="description" content="Names for colours\."/);
  assert.match(h, /og:url" content="https:\/\/a-to-mind\.com\/color\/hex-names\/"/); assert.match(h, /<h1>Colour names<\/h1>\n  <p class="intro">Find a name\.<\/p>/);
  assert.ok(!h.includes('old intro') && !h.includes('<!-- seo -->') && !h.includes('<!-- asks -->')); assert.match(h, /og:title/);
  assert.equal(variantHtml(h, row), h, 'written again it is the same page');
  const sw = "const TOOLS = ['/a/', '/b/'];\nconst X = 1;";
  assert.equal(swWith(sw, '/c/'), "const TOOLS = ['/a/', '/b/', '/c/'];\nconst X = 1;"); assert.equal(swWith(swWith(sw, '/c/'), '/c/'), swWith(sw, '/c/'));
  assert.match(fs.readFileSync(path.join(root, 'void-live-deploy/sw.js'), 'utf8'), /const TOOLS = \[[^\]]*\];/, 'sw.js still holds its offline list on one line');
});

test('the judge: offline and sharing have templates, every other lost or unmeasured row becomes a job with the gate\'s evidence', () => {
  const f = { id: 'colour: x.test', page: '/color/x/?c=ff5733', extra: [] };
  const ev = { speed: { verdict: 'better', evidence: 'e' }, offline: { verdict: 'worse', evidence: 'Verse 0 vs 1' }, sharing: { verdict: 'worse', evidence: 'Verse 3 of 4' }, mobile: { verdict: 'worse', evidence: 'Verse 12 px' } };
  const j = judgeRows(f, ev, "const TOOLS = ['/a/'];");
  assert.deepEqual(j.fixes, ['offline', 'sharing']); assert.ok(j.jobs.some((x) => x.aspect === 'mobile' && /12 px/.test(x.evidence))); assert.ok(j.jobs.some((x) => x.aspect === 'accuracy' && /not measured/.test(x.evidence)));
  assert.ok(!judgeRows(f, ev, "const TOOLS = ['/color/x/'];").fixes.includes('offline'), 'a page already in the list is not fixed again');
  assert.match(reportLine([{ host: 'x.test', family: 'colour', page: '/color/x/', n: 8, m: 12 }], 'y.test'), /^Versus: took on x\.test \(colour, \/color\/x\/\), surpassed 8 of 12 rows; next y\.test$/);
});

test('the page guard flags a frontier site at the front of the queue with no page, and nothing else', () => {
  const ev = Object.fromEntries(FLOORS.map((f) => [f.id, passingRows(f, { evidence: 'e' })])); // every aspect, journeys with their steps and controls
  assert.deepEqual(guardOf(ev, { sites: [{ site: 'easy.test', hardness: 1 }] }), ['easy.test'], 'every floor beaten: the frontier site is at the front and has no page');
  const real = JSON.parse(fs.readFileSync(path.join(root, 'void-live-deploy/tower.evidence.json'), 'utf8')).floors;
  assert.deepEqual(guardOf(real, { sites: [{ site: 'easy.test', hardness: 99 }] }, 1), [], 'the current fight is a floor');
});

test('every self-built site is a lane site with its own page, the page its probe measures, a row in the tool table and a folder', () => {
  for (const r of SELF_SITES) {
    const f = FLOORS.find((x) => x.id === r.lane); assert.ok(f, r.lane + ' is a floor'); assert.equal(f.lane, r.family); assert.equal(f.page, r.page); assert.equal(LANE_PAGES[r.lane], r.page);
    assert.ok(LANES[r.family].includes(r.url)); assert.ok(SITE_PAGES.some((p) => p.path === r.path)); assert.equal(probeFor(r.lane).verse, r.page);
    if (r.ask) assert.equal(probeFor(r.lane).ask.verse, r.ask);
    const html = fs.readFileSync(path.join(root, 'void-live-deploy', r.path, 'index.html'), 'utf8'); assert.ok(html.includes(MARK), r.path); assert.ok(html.includes('<h1') && html.includes(r.h1.replace(/&/g, '&amp;')), r.path);
    assert.doesNotMatch(r.name + r.h1 + r.intro + r.does + r.asks.join(' ') + r.path, /\.(?:com|org|net|io)\b/i, r.path + ' names no site');
  }
});

test('the loop\'s model route takes the owner\'s questions only in shape: system and user messages, bounded', async () => {
  const { bodyOf } = await import('../void-live-deploy/functions/api/tower-self.js');
  assert.equal(bodyOf({ messages: [{ role: 'user', content: 'which floor?' }] }).max, 900);
  assert.equal(bodyOf({ messages: [{ role: 'assistant', content: 'x' }] }), null);
  assert.equal(bodyOf({ messages: [{ role: 'user', content: 'x'.repeat(24001) }] }), null);
  assert.equal(bodyOf({ messages: Array(5).fill({ role: 'user', content: 'x' }) }), null);
  assert.equal(bodyOf({ messages: [{ role: 'user', content: 'x' }], max_tokens: 99999 }).max, 2000);
});

test('the model\'s answer is found however it is wrapped', () => {
  assert.equal(parseAnswer('{"family":"colour","why":"x"}').family, 'colour');
  assert.equal(parseAnswer('Thinking {about} it.\n```json\n{"family":"none","why":"a shop"}\n```').family, 'none');
  assert.equal(parseAnswer(JSON.stringify({ response: { family: 'calculator' } })).family, 'calculator');
  assert.equal(parseAnswer('no json here'), null);
});

test('words are cut at a sentence, and an ask meets its family by the stem of its words', () => {
  assert.equal(sentences('One two three. Four five six seven eight nine ten eleven twelve.', 30), 'One two three.');
  assert.ok(!/,$/.test(sentences('a, '.repeat(200), 50)));
  assert.equal(sentences('Type a value and every unit updates at once,', 320), 'Type a value and every unit updates at once.'); // a row cut before the sentence ended (/convert/unit-converter/)
  const conv = familiesOf().find((f) => f.id === 'unit converter'); assert.ok(sharesWords(conv, 'convert km to miles'));
});

test('a reason is cut at a whole word, never mid-word (Versus job mvoxd09y: "a niche professional servic")', async () => {
  const { clipWords } = await import('./tower-self.mjs');
  const why = 'The website is a B2B service for protecting digital marketing campaigns from bad traffic and spy tools, which is a niche professional service';
  assert.equal(clipWords(why, 160), why);
  assert.equal(clipWords(why, 140), why.replace(/ service$/, ''));
  assert.equal(clipWords('one, two, three', 9), 'one, two');
  assert.equal(clipWords('  short  ', 140), 'short');
});
