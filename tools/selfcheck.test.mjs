// Verse's check of its own pages (lib/selfcheck.js, tools/self-check.mjs, functions/api/selfcheck.js, the status card's section): what makes a
// page broken, the report, what the API keeps, and the card's words. A page is broken only for what it was seen to do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageProblems, reportOf, cleanReport, pagesHtml, luminance, KINDS } from '../void-live-deploy/lib/selfcheck.js';
import { pathsOf, ownError, linkPaths, summaryOf } from './self-check.mjs';
import { onRequestGet, onRequestPost, KEY } from '../void-live-deploy/functions/api/selfcheck.js';

const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fine = { path: '/color/', status: 200, errors: [], failed: [], text: 'Colour codes: pick a colour and copy it', bg: 'rgb(5, 5, 5)', toolRow: true, deadLinks: [] };

test('a page that opens, shows text on the dark stage and is tied to the other tools has nothing wrong', () => {
  assert.deepEqual(pageProblems(fine), []);
});
test('what counts: a page that does not open stops there; errors, failed files, no text, a white page, dead links, old words, no tool row', () => {
  assert.deepEqual(pageProblems({ ...fine, status: 404 }).map((p) => p.kind), ['status']);
  const k = pageProblems({ ...fine, errors: ['TypeError: x is undefined'], failed: [{ url: '/api/news?s=1', status: 500 }], text: ' ', bg: 'rgb(255, 255, 255)', toolRow: false, deadLinks: [{ url: '/gone/', status: 404 }] }).map((p) => p.kind);
  assert.deepEqual(k, ['script', 'request', 'empty', 'light', 'link', 'unwired']);
  assert.match(pageProblems({ ...fine, text: 'Verse will fight any site' })[0].why, /fight/);
  assert.equal(pageProblems({ ...fine, path: '/', toolRow: false }).length, 0, 'the stage is not a tool page');
  assert.equal(pageProblems({ ...fine, path: '/lab/x/', toolRow: false }).length, 0, 'lab pages are experiments');
  assert.equal(pageProblems({ ...fine, path: '/fix/zapier-403-forbidden/', toolRow: false }).length, 0, 'the services pages link to each other');
  assert.equal(pageProblems({ ...fine, path: '/llms.txt', toolRow: false }).length, 0, 'a file the sitemap lists is not a page');
  assert.equal(pageProblems({ ...fine, path: '/store/', toolRow: false }).length, 0, 'the store is Verse\'s own page');
  assert.equal(pageProblems({ ...fine, path: '/emojis/', toolRow: false })[0].kind, 'unwired', 'a tool page still needs its row');
  assert.equal(pageProblems({ ...fine, path: '/films/', toolRow: false }).length, 0, 'Verse\'s own films and podcast are not tools');
  assert.equal(pageProblems({ ...fine, bg: 'rgba(0, 0, 0, 0)' }).length, 0, 'transparent is not light');
  assert.equal(pageProblems({ ...fine, path: '/', text: '↵', controls: 4 }).length, 0, 'the front page is one box to type in: not empty');
});
test('luminance: white is bright, the void is dark, an unreadable colour is null', () => {
  assert.ok(luminance('rgb(255, 255, 255)') > 0.9); assert.ok(luminance('rgb(5, 5, 5)') < 0.01); assert.equal(luminance('nonsense'), null);
});
test('the report: counts, serious pages first, capped, and honest about how many were opened', () => {
  const r = reportOf([{ path: '/b/', problems: [{ kind: 'unwired', why: 'x' }] }, { path: '/a/', problems: [{ kind: 'status', why: 'answers 500' }] }, { path: '/c/', problems: [] }], { at: '2026-10-30T04:00:00Z', sha: 'abcdef1234567890', of: 5 });
  assert.equal(r.checked, 3); assert.equal(r.of, 5); assert.equal(r.fine, 1); assert.equal(r.broken, 2); assert.equal(r.serious, 1);
  assert.deepEqual(r.pages.map((p) => p.path), ['/a/', '/b/']); assert.equal(r.sha, 'abcdef123456');
  assert.deepEqual(cleanReport(r), { ...r, at: '2026-10-30T04:00:00.000Z' }, 'a report it made survives the API unchanged');
});
test('the API keeps only a report: unknown kinds and odd paths are dropped, a non-report is refused', () => {
  assert.equal(cleanReport({ pages: [] }), null); assert.equal(cleanReport(null), null);
  const c = cleanReport({ at: '2026-10-30T04:00:00Z', checked: 2, pages: [{ path: 'http://x', problems: [] }, { path: '/a/', problems: [{ kind: 'evil', why: 'x' }, { kind: 'link', why: 'y'.repeat(500) }] }], kinds: { evil: 3, link: 1 } });
  assert.deepEqual(c.pages.map((p) => p.path), ['/a/']); assert.deepEqual(c.pages[0].problems.map((p) => p.kind), ['link']); assert.ok(c.pages[0].problems[0].why.length <= 160);
  assert.deepEqual(c.kinds, { link: 1 });
});
test('the route: anyone reads the newest report; only the owner writes one', async () => {
  const kv = new Map(), env = { READ_TOKEN: 'secret-scan: ok-owner', MISSES: { get: async (k, t) => (kv.has(k) ? (t === 'json' ? JSON.parse(kv.get(k)) : kv.get(k)) : null), put: async (k, v) => kv.set(k, v) } };
  assert.equal((await (await onRequestGet({ env })).json()).report, null);
  const rep = reportOf([{ path: '/a/', problems: [{ kind: 'status', why: 'answers 500' }] }], { at: '2026-10-30T04:00:00Z' });
  const post = (auth) => onRequestPost({ env, request: new Request('https://a-to-mind.com/api/selfcheck', { method: 'POST', headers: auth ? { authorization: 'Bearer ' + auth } : {}, body: JSON.stringify({ report: rep }) }) });
  assert.equal((await post('')).status, 401); assert.equal((await post('wrong')).status, 401); assert.ok(!kv.has(KEY));
  const ok = await post('secret-scan: ok-owner'); assert.equal(ok.status, 200); assert.equal((await ok.json()).broken, 1);
  assert.equal((await (await onRequestGet({ env })).json()).report.pages[0].path, '/a/');
});
test('the card section: says when and how it was checked, links each page, escapes, and says so before the first run', () => {
  const r = reportOf([{ path: '/a/', problems: [{ kind: 'script', why: '<b>boom</b>' }] }, { path: '/b/', problems: [] }], { at: '2026-10-30T04:00:00Z', sha: 'abc1234def', how: 'opened in headless Chrome after the deploy' });
  const h = pagesHtml(r, esc, Date.parse('2026-10-30T04:10:00Z'));
  assert.match(h, /1 of 2 pages broken/); assert.doesNotMatch(h, /need a fix/, 'all the pages that need a fix are broken: the count is said once');
  const mixed = reportOf([{ path: '/a/', problems: [{ kind: 'status', why: 'x' }] }, { path: '/b/', problems: [{ kind: 'unwired', why: 'y' }] }, { path: '/c/', problems: [] }], { at: '2026-10-30T04:00:00Z' });
  assert.match(pagesHtml(mixed, esc), /2 of 3 pages need a fix \(1 broken\)/);
  assert.match(pagesHtml(reportOf([{ path: '/b/', problems: [{ kind: 'unwired', why: 'y' }] }], { at: '2026-10-30T04:00:00Z' }), esc), /1 of 1 pages need a fix</); assert.match(h, /10 min ago on abc1234/); assert.match(h, /opened in headless Chrome/);
  assert.match(h, /<a href="\/a\/">/); assert.ok(h.includes('&lt;b&gt;boom')); assert.ok(!h.includes('<b>boom'));
  assert.match(pagesHtml(null, esc), /Not checked yet/);
  assert.match(pagesHtml(reportOf([{ path: '/b/', problems: [] }], { at: '2026-10-30T04:00:00Z' }), esc), /all 1 pages fine/);
  assert.ok(Object.keys(KINDS).length >= 8);
});
test('the crawler: sitemap paths of this site only, each once; its own errors; link paths without the API', () => {
  assert.deepEqual(pathsOf('<loc>https://a-to-mind.com/</loc><loc>https://a-to-mind.com/x/</loc><loc>https://evil.com/y/</loc><loc>https://a-to-mind.com/x/</loc>', 'https://a-to-mind.com'), ['/', '/x/']);
  assert.equal(ownError('Failed to load resource: the server responded with a status of 404'), false); assert.equal(ownError('Uncaught TypeError: x'), true);
  assert.deepEqual(linkPaths(['/a/?q=1#z', 'https://a-to-mind.com/b/', 'https://other.com/c', '/api/news', '/@adam'], 'https://a-to-mind.com'), ['/a/', '/b/']);
  assert.match(summaryOf(reportOf([{ path: '/a/', problems: [{ kind: 'status', why: 'answers 500' }] }], { at: 'x' })), /`\/a\/`: does not open: answers 500/);
});
