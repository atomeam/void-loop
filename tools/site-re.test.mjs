// tools/site-re.mjs on a fixture page and bundle, no network and no browser: what the code and the loaded page say, the report's shape and
// determinism, walls recorded as walls, nothing but short facts kept, and the fold into the features files that never touches people's sections.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scrubPersonal, noiseOf, visit, scanEntry, codeFacts, htmlFacts, controlsOf, manifestFacts, swFacts, robotsFacts, sitemapFacts, blockedOf, reportOf, candidatesOf, mergeRe, rowOf, ROW_NOTE, clip, bareUrl, fileOf, slugOf, dueOf, entriesOf, writeReport, mergeAll, servicesOf } from './site-re.mjs';
import { mergeAuto, putMine, nextJobs } from './feature-scan.mjs';
import { secretsIn } from './secret-scan.mjs';
import { findPersonal } from '../void-live-deploy/lib/privacy.js';
const findPersonalIn = (text) => text.split('\n').flatMap((l) => findPersonal(l));

// a made-up photo tool: its marketing page names three features, its bundle holds more
const BUNDLE = `!function(){var p=new URLSearchParams(location.search);var q=p.get("lang"),z=p.get("zoom");
document.addEventListener("keydown",function(e){if(e.key==="Escape")close();if(e.ctrlKey&&e.key==="z")undo();if(e.key==="ArrowLeft")prev();if(e.key==="ArrowRight")next();if(e.keyCode===32)toggle()});
var shortcuts={a:"ctrl+shift+s",b:"Mod-k"};
fetch("/api/v2/convert",{method:"POST"});var ws=new WebSocket("wss://live.fixture-tool.test/socket");
var flags={enableBatchMode:true,showBetaPanel:false};localStorage.getItem("fx.theme");localStorage.setItem("fx.recent",1);indexedDB.open("fx-library");
canvas.toBlob(cb,"image/webp",.8);a.download="export.zip";var ok=[".jpg",".png",".heic",".tiff"];var L=["en","de","fr","es","ja","pt-BR"];
if(navigator.share){navigator.share({files:f})}window.print();window.showSaveFilePicker&&0;new Worker("w.js");navigator.serviceWorker.register("/sw.js");
window.addEventListener("beforeinstallprompt",x);window.addEventListener("drop",d);matchMedia("(prefers-color-scheme: dark)");
var r=[{path:"/batch",c:1},{path:"/settings",c:2}];fetch("https://api.stripe.com/v1/tokens");var t="https://www.w3.org/2000/svg";
}();\n//# sourceMappingURL=app.js.map`;
const HTML = `<!doctype html><html lang="en"><head><title>Fixture Photo Tool</title><link rel="manifest" href="/app.webmanifest"><link rel="alternate" hreflang="de" href="/de/"><link rel="alternate" hreflang="fr" href="/fr/">
<link rel="alternate" type="application/rss+xml" href="/feed.xml"><link rel="search" type="application/opensearchdescription+xml" href="/os.xml"><meta property="og:title" content="x"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#000">
<link rel="stylesheet" href="/app.css"><script src="/app.js" type="module"></script><script src="https://www.googletagmanager.com/gtag/js"></script></head><body><a href="#main">Skip</a>
<button aria-label="Open files" accesskey="o">Open</button><input type="file" accept=".jpg,.heic,image/*" multiple capture><input type="color"><input type="range"><div draggable="true" role="menu"></div><div aria-live="polite"></div>
<iframe src="https://www.youtube-nocookie.com/embed/x"></iframe><a href="/x.png" download>Save</a></body></html>`;
const MANIFEST = { name: 'Fixture', display: 'standalone', icons: [{}, {}], shortcuts: [{ name: 'New batch' }], share_target: { action: '/share', method: 'POST', enctype: 'multipart/form-data', params: { files: [{ name: 'f', accept: ['image/*'] }] } }, file_handlers: [{ action: '/', accept: { 'image/jpeg': ['.jpg'] } }] };
const got = () => ({ url: 'https://fixture-tool.test/', final: 'https://fixture-tool.test/', status: 200, date: '2026-10-26', html: { mobile: HTML, desktop: HTML }, controls: { mobile: ['Open', 'Menu'], desktop: ['Open', 'Batch'] },
  assets: [{ url: 'https://fixture-tool.test/app.js?v=9', kind: 'js', bytes: BUNDLE.length, text: BUNDLE }, { url: 'https://www.googletagmanager.com/gtag/js', kind: 'js', bytes: 90000, text: 'navigator.share();new Worker("t.js");window.print()' }, { url: 'https://fixture-tool.test/app.css', kind: 'css', bytes: 200, text: '@media print{a{}}@media (prefers-color-scheme:dark){a{}}' }],
  manifest: MANIFEST, sw: { url: 'https://fixture-tool.test/sw.js', text: 'importScripts("workbox");precacheAndRoute(self.__WB_MANIFEST);self.addEventListener("fetch",f);self.addEventListener("push",p);' }, robots: 'User-agent: *\nDisallow: /admin/\nDisallow: /private\nSitemap: https://fixture-tool.test/sitemap.xml',
  sitemap: '<urlset><url><loc>https://fixture-tool.test/</loc></url><url><loc>https://fixture-tool.test/guides/a</loc></url><url><loc>https://fixture-tool.test/guides/b</loc></url></urlset>',
  requests: ['https://fixture-tool.test/api/v2/convert?token=abc&mode=1'], websockets: ['wss://live.fixture-tool.test/socket?id=7'], storage: { local: ['fx.theme', 'fx.recent'], session: [], idb: ['fx-library'] } });

test('code: URL parameters, shortcuts, keys, API paths, flags, storage, exports, imports, languages, routes and web APIs, each with a char offset', () => {
  const f = codeFacts(BUNDLE, 'app.js'), v = (l) => l.map((x) => x.v);
  assert.deepEqual(v(f.params), ['lang', 'zoom']); assert.ok(f.params[0].at > 0 && BUNDLE.slice(f.params[0].at).startsWith('p.get("lang")'));
  assert.deepEqual(v(f.chords).sort(), ['ctrl+shift+s', 'mod-k']);
  assert.ok(['Escape', 'z', 'ArrowLeft', 'ArrowRight', 'Space'].every((k) => v(f.keys).includes(k)), v(f.keys).join());
  assert.equal(f.keyHandlers.length, 1);
  assert.ok(v(f.apiPaths).includes('/api/v2/convert'));
  assert.deepEqual(v(f.flags).sort(), ['enableBatchMode', 'showBetaPanel']);
  assert.deepEqual(v(f.storage).sort(), ['fx.recent', 'fx.theme']); assert.deepEqual(v(f.idb), ['fx-library']);
  assert.deepEqual(v(f.blobTypes), ['image/webp']); assert.deepEqual(v(f.downloads), ['export.zip']);
  assert.ok(f.extLists[0].v.includes('.heic')); assert.deepEqual(f.langs, ['en', 'de', 'fr', 'es', 'ja', 'pt-BR']);
  assert.deepEqual(v(f.routes), ['/batch', '/settings']);
  const apis = f.apis.map((a) => a.label); for (const w of ['Share through the system share sheet', 'Print button', 'Background worker threads', 'Drag and drop files or items', 'Follows the system dark mode', 'Save and open files in place (File System Access)']) assert.ok(apis.includes(w), w);
  assert.ok(f.install && f.websocket && f.sourceMap && f.usesLocationSearch); assert.equal(f.sw.url, '/sw.js');
  assert.ok(f.hosts.some((h) => h.host === 'live.fixture-tool.test' && h.ws) && f.hosts.some((h) => h.host === 'api.stripe.com') && !f.hosts.some((h) => /w3\.org/.test(h.host)), 'noise hosts are dropped, sockets marked');
  for (const x of [...f.params, ...f.apiPaths]) assert.equal(BUNDLE.indexOf(x.v) >= 0, true);
});
test('code: an ordinary string, a plain variable or an empty file yields no facts', () => {
  const f = codeFacts('var a=1;function b(c){return c+"hello"}', 'x.js'); for (const k of ['params', 'chords', 'keys', 'apiPaths', 'flags', 'storage', 'downloads', 'routes', 'apis']) assert.equal(f[k].length, 0, k);
  assert.doesNotThrow(() => codeFacts('', 'e.js')); assert.doesNotThrow(() => codeFacts(null));
});
test('page: head tags, inputs and their accept lists, access keys, labels, roles, embeds, and the skip link', () => {
  const h = htmlFacts(HTML, 'https://fixture-tool.test/');
  assert.equal(h.title, 'Fixture Photo Tool'); assert.equal(h.lang, 'en'); assert.equal(h.manifest, 'https://fixture-tool.test/app.webmanifest'); assert.deepEqual(h.hreflang, ['de', 'fr']);
  assert.equal(h.feeds, 1); assert.ok(h.opensearch && h.skipLink && h.live && h.draggable); assert.equal(h.share.og, 1); assert.ok(h.share.twitter);
  assert.deepEqual(h.accepts, ['.jpg,.heic,image/*']); assert.ok(h.inputs.some((i) => i.multiple && i.capture)); assert.deepEqual(h.accesskeys, ['o']); assert.deepEqual(h.ariaLabels, ['Open files']);
  assert.deepEqual(h.iframes, ['www.youtube-nocookie.com']); assert.deepEqual(h.scripts.map((s) => s.src), ['https://fixture-tool.test/app.js', 'https://www.googletagmanager.com/gtag/js']); assert.equal(h.roles.menu, 1);
  assert.equal(h.downloadAttrs, 1); assert.equal(htmlFacts('').title, '');
});
test('controls from the two widths are merged by label with where each shows', () => {
  assert.deepEqual(controlsOf(['Open', 'Menu', ' '], ['Open', 'Batch']), [{ l: 'Batch', w: 'd' }, { l: 'Menu', w: 'm' }, { l: 'Open', w: 'md' }]);
  assert.equal(controlsOf(['x'.repeat(60)]).length, 1); assert.ok(controlsOf(['x'.repeat(60)])[0].l.length <= 40);
});
test('manifest, service worker, robots and sitemap become short facts', () => {
  const m = manifestFacts(MANIFEST); assert.deepEqual(m.shortcuts, ['New batch']); assert.equal(m.shareTarget.method, 'POST'); assert.deepEqual(m.shareTarget.files, ['image/*']); assert.deepEqual(m.fileHandlers, ['.jpg']); assert.equal(manifestFacts(null), null);
  const s = swFacts(got().sw.text); assert.ok(s.workbox && s.precache && s.fetchHandler && s.push && !s.sync); assert.equal(swFacts(''), null);
  assert.deepEqual(robotsFacts(got().robots), { disallow: ['/admin/', '/private'], sitemaps: ['https://fixture-tool.test/sitemap.xml'], crawlDelay: null });
  assert.deepEqual(robotsFacts('User-agent: Googlebot\nDisallow: /g/\n\nUser-agent: *\nCrawl-delay: 5\nDisallow: /x').disallow, ['/x']);
  const sm = sitemapFacts(got().sitemap); assert.equal(sm.urls, 3); assert.deepEqual(sm.sections[0], { s: 'guides', n: 2 }); assert.equal(sitemapFacts(''), null);
});
test('walls are recorded and never worked around: robots, refusal, bot challenge, sign-in, consent; an ordinary page is none', () => {
  assert.equal(blockedOf({ robots: true }).kind, 'robots'); assert.equal(blockedOf({ status: 403 }).kind, 'refused'); assert.equal(blockedOf({ status: 429 }).kind, 'rate-limit'); assert.equal(blockedOf({ status: 503 }).kind, 'down');
  assert.equal(blockedOf({ status: 200, title: 'Just a moment...', text: 'Checking your browser', controls: 1 }).kind, 'anti-bot'); assert.equal(blockedOf({ status: 200, challenge: true, text: 'x' }).kind, 'anti-bot');
  assert.equal(blockedOf({ status: 200, text: 'Sign in to continue', hasPassword: true, controls: 3 }).kind, 'login');
  assert.equal(blockedOf({ status: 200, text: 'We value your privacy. Accept all cookies', controls: 3 }).kind, 'consent');
  assert.equal(blockedOf({ status: 200, title: 'Photos', text: 'Open a photo. '.repeat(60), hasPassword: false, controls: 30 }), null); assert.equal(blockedOf(null), null);
});
test('the report: candidates carry a tag and a coordinate, third-party scripts add services but no features, and it is deterministic', () => {
  const r = reportOf(got()), again = reportOf(got()); assert.deepEqual(r, again, 'same input, same bytes');
  const by = (n) => r.candidates.find((c) => c.name === n); assert.ok(by('URL parameter ?lang'), 'a URL parameter'); assert.match(by('URL parameter ?lang').evidence, /^app\.js@\d+$/); assert.equal(by('URL parameter ?lang').tag, 'read');
  for (const n of ['Keyboard shortcut ctrl+shift+s', 'API path /api/v2/convert', 'Feature flag enableBatchMode', 'Exports as image/webp', 'Route /batch', 'Print button', 'Installable web app (standalone)', 'App shortcut New batch', 'Receives shared files (share target)', 'Works offline (service worker with a precache)', 'Remembers a setting in the browser: fx.theme', 'Live updates over a WebSocket', 'Uses Stripe', 'RSS or Atom feed', 'Skip to content link', 'Several files at once', 'Access key o']) assert.ok(by(n), n + ' in ' + r.candidates.map((c) => c.name).join(' | '));
  assert.equal(by('Feature flag enableBatchMode').tag, 'inferred'); assert.equal(by('Remembers a setting in the browser: fx.theme').tag, 'observed'); assert.match(by('Skip to content link').evidence, /./);
  assert.ok(r.candidates.every((c) => c.name && c.tag && c.evidence !== undefined && ['read', 'observed', 'inferred'].includes(c.tag)) && r.candidates.length <= 60);
  assert.ok(r.services.includes('Google Analytics') && r.services.includes('Stripe') && r.thirdParty.includes('www.googletagmanager.com'));
  assert.equal(r.code.length, 2, 'own bundle and own css keep facts; the tag manager does not'); assert.ok(!r.code.some((c) => /googletagmanager/.test(c.file)));
  assert.ok(r.assets.find((a) => a.f === 'app.js').map && r.assets.some((a) => a.ext), 'source map hint and third-party marks');
  assert.deepEqual(r.requests, ['https://fixture-tool.test/api/v2/convert?mode&token'], 'query names only, never values'); assert.equal(r.websockets[0], 'wss://live.fixture-tool.test/socket?id');
  assert.ok(!JSON.stringify(r).includes('abc&mode'), 'no query value is kept');
  assert.ok(JSON.stringify(r).length < 14000, 'small: ' + JSON.stringify(r).length);
});
test('a blocked site is a small report that says so, with nothing invented', () => {
  const r = reportOf({ url: 'https://walled.test/', date: '2026-10-26', status: 200, blocked: { kind: 'anti-bot', why: 'a bot challenge stood in front of the page' }, assets: [], html: {}, controls: {}, storage: {} });
  assert.equal(r.blocked.kind, 'anti-bot'); assert.equal(r.candidates, undefined); assert.equal(r.assetCount, undefined === r.assetCount ? undefined : 0);
});
test('nothing token-like or long is kept: strings are clipped, a long run is replaced, file names drop query strings', () => {
  assert.equal(clip('word '.repeat(30), 20).length, 20); assert.equal(clip('a'.repeat(100), 20), '[token]'); assert.equal(clip('key ' + 'A1b2'.repeat(12)), 'key [token]');
  assert.equal(fileOf('https://cdn.test/assets/app.123.js?sig=SECRETVALUE', 'site.test'), 'cdn.test/app.123.js'); assert.equal(fileOf('https://site.test/a/b.js', 'site.test'), 'b.js');
  assert.equal(bareUrl('https://api.test/v1/x?key=SECRETVALUE&b=2'), 'https://api.test/v1/x?b&key'); assert.deepEqual(secretsIn(JSON.stringify(reportOf(got()))), []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitere-')); assert.throws(() => writeReport('x', { v: 'AKIA' + 'Q7ZK2M9XPLV4T8WN' }, dir), /secret/, 'a secret-shaped string stops the write'); // secret-scan: ok (assembled in two halves, a made-up shape)
});
test('folding: rows are unbuilt, tagged and cited; a people-written file keeps every section; a builder\'s move off missing survives a rescan', () => {
  const rep = reportOf(got()), people = { floor: 'photos', verse_page: '/photos/', researched: '2026-10-25', sites: { 'x.com': { features: [{ name: 'Keep me', verse: 'has' }] } }, union_gaps: ['a'], auto: { scanned: '2026-10-25', sites: {}, queued: [{ target: 'feature:t' }] } };
  const out = mergeRe(people, { id: 'photos', page: '/photos/' }, 'fixture-tool.test', rep);
  assert.deepEqual({ ...out, re: undefined }, { ...people, re: undefined }, 'every old section is as it was'); assert.deepEqual(people.re, undefined, 'the input is not changed');
  const rows = out.re.sites['fixture-tool.test'].features; assert.ok(rows.length >= 15); assert.ok(rows.every((r) => r.verse === 'missing' && r.verse_evidence === ROW_NOTE && r.found_by === 're' && r.evidence !== undefined));
  assert.deepEqual(rows[0], rowOf(rep.candidates[0]));
  const built = { ...out, re: { ...out.re, sites: { 'fixture-tool.test': { ...out.re.sites['fixture-tool.test'], features: rows.map((r) => (r.name === 'Print button' ? { ...r, verse: 'has', verse_evidence: 'built' } : r)) } } } };
  const again = mergeRe(built, { id: 'photos' }, 'fixture-tool.test', rep), pr = again.re.sites['fixture-tool.test'].features.find((r) => r.name === 'Print button'); assert.equal(pr.verse, 'has'); assert.equal(pr.verse_evidence, 'built');
  assert.deepEqual(mergeRe(again, { id: 'photos' }, 'fixture-tool.test', rep), again, 'idempotent');
  const fresh = mergeRe(null, { id: 'newfloor', page: null }, 'a.test', rep); assert.equal(fresh.source, 'auto'); assert.equal(fresh.researched, null); assert.ok(fresh.re.sites['a.test']);
  const two = mergeRe(out, { id: 'photos' }, 'other.test', reportOf({ ...got(), url: 'https://other.test/', final: 'https://other.test/' })); assert.deepEqual(Object.keys(two.re.sites), ['fixture-tool.test', 'other.test']);
});
test('the feature scan keeps "re" through its own rewrites and queues read and observed rows (not guesses) after the rest', () => {
  const rep = reportOf(got()), withRe = mergeRe({ floor: 'f', source: 'auto', sites: {}, gaps: [], auto: { queued: [] } }, { id: 'f' }, 'fixture-tool.test', rep);
  const merged = mergeAuto(withRe, { id: 'f', page: null }, { 'fixture-tool.test': { url: 'u', scanned: '2026-10-26', features: [] } }, '2026-10-26'); assert.deepEqual(merged.re, withRe.re, 'mergeAuto keeps re');
  assert.deepEqual(putMine(withRe, { file: { ...merged, re: undefined } }).re, withRe.re, 'putMine keeps the newer re on main');
  const floors = [{ id: 'f', slug: 'f', page: null, sites: [{ id: 'f', host: 'fixture-tool.test' }] }], jobs = nextJobs({ order: ['f'], floors, files: { f: withRe }, max: 50 });
  assert.ok(jobs.length > 5 && jobs.every((j) => !/Feature flag/.test(j.feature)), 'inferred rows are not queued'); assert.ok(jobs.some((j) => j.feature === 'Print button'));
});
test('which entries are due: never scanned or 30 days old, smallest site first, at most n; the tower entries are named as the gate names them', () => {
  const entries = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], d = { a: '2026-10-20', b: null, c: '2026-08-01', d: '2026-10-01' };
  assert.deepEqual(dueOf(entries, (e) => d[e.id], { now: Date.parse('2026-10-26'), n: 2 }).map((e) => e.id), ['b', 'c']); assert.deepEqual(dueOf(entries, (e) => d[e.id], { now: Date.parse('2026-10-26') }).map((e) => e.id), ['b', 'c']);
  const all = entriesOf(); for (const id of ['pdf: 10015.io', 'kanban: wekan.fi', 'photos: squoosh.app', 'sports: thesportsdb.com', 'photos: exifeditor.io']) assert.ok(all.find((e) => e.id === id && /^https:\/\//.test(e.url) && e.host), id);
  assert.equal(new Set(all.map((e) => e.slug)).size, all.length, 'one file per entry'); assert.equal(slugOf('pdf: 10015.io'), 'pdf-10015.io'); assert.equal(slugOf('colour codes'), 'colour-codes');
  assert.equal(all.find((e) => e.id === 'photos: exif.tools').featSlug, 'photos', 'a lane site is filed under its floor');
});
test('mergeAll writes only the "re" key of the floor files, and a second run changes nothing', () => {
  const re = fs.mkdtempSync(path.join(os.tmpdir(), 'sitere-re-')), feats = fs.mkdtempSync(path.join(os.tmpdir(), 'sitere-f-')), entries = [{ id: 'kanban: wekan.fi', floor: 'kanban', host: 'wekan.fi', featSlug: 'kanban', page: null }];
  fs.writeFileSync(path.join(feats, 'kanban.json'), JSON.stringify({ floor: 'kanban', sites: { 'trello.com': { features: [] } } }, null, 1) + '\n');
  writeReport('kanban: wekan.fi', reportOf(got()), re); assert.equal(mergeAll({ dir: re, features: feats, entries }), 1);
  const f = JSON.parse(fs.readFileSync(path.join(feats, 'kanban.json'), 'utf8')); assert.deepEqual(Object.keys(f), ['floor', 'sites', 're']); assert.equal(mergeAll({ dir: re, features: feats, entries }), 0);
});
test('servicesOf names the third parties from hosts', () => { assert.deepEqual(servicesOf('www.googletagmanager.com js.stripe.com cdn.jsdelivr.net'), ['Google Analytics', 'Stripe']); });

// the browser side against a fake browser (no Chrome here): the order of the visit, what it keeps, and that a robots.txt that disallows the page stops it
function fakeBrowser({ robots = '', status = 200, body = HTML } = {}) {
  const files = { '/robots.txt': robots, '/app.webmanifest': JSON.stringify(MANIFEST), '/sw.js': got().sw.text, '/sitemap.xml': got().sitemap }, log = [];
  const main = {}, ctxOf = (opt) => {
    const handlers = {}, page = { on: (e, f) => { handlers[e] = f; }, mainFrame: () => main, url: () => 'https://fixture-tool.test/', waitForLoadState: async () => {}, waitForTimeout: async () => {}, content: async () => body,
      goto: async (u) => {
        log.push('goto ' + opt.viewport.width);
        const rq = (type) => ({ resourceType: () => type, frame: () => main, url: () => 'https://fixture-tool.test/api/v2/convert?token=abc' }), rs = (u2, type, buf) => ({ url: () => u2, request: () => rq(type), headers: () => ({ 'x-frame-options': 'DENY' }), status: () => status, body: async () => Buffer.from(buf) });
        handlers.response(rs(u, 'document', body)); handlers.response(rs('https://fixture-tool.test/app.js', 'script', BUNDLE)); handlers.response(rs('https://www.googletagmanager.com/gtag/js', 'script', 'navigator.share()'));
        handlers.request(rq('fetch')); handlers.websocket({ url: () => 'wss://live.fixture-tool.test/socket' });
        return { status: () => status };
      },
      evaluate: async (fn) => (fn.name === 'CONTROLS_JS' ? { rows: ['Open', opt.viewport.width < 800 ? 'Menu' : 'Batch'], password: false, text: 'Open a photo. '.repeat(60), title: 'Fixture', consent: true, challenge: false } : { local: ['fx.theme'], session: [], idb: ['fx-library'], regs: ['https://fixture-tool.test/sw.js'] }) };
    return { newPage: async () => page, serviceWorkers: () => [], close: async () => {}, request: { get: async (u2) => { const p = new URL(u2).pathname; log.push('get ' + p); return files[p] === undefined ? { ok: () => false } : { ok: () => true, text: async () => files[p], headers: () => ({ 'content-type': 'application/xml' }) }; } } };
  };
  return { log, newContext: async (opt) => ctxOf(opt || { viewport: { width: 1280 } }) };
}
test('visit: robots.txt first, two loads, only the page\'s own scripts read, the manifest, worker and sitemap fetched; the report is made of it', async () => {
  const b = fakeBrowser({ robots: 'User-agent: *\nDisallow: /admin/' }), g = await visit(b, 'https://fixture-tool.test/', { date: '2026-10-26' });
  assert.equal(b.log[0], 'get /robots.txt'); assert.equal(b.log.filter((l) => l.startsWith('goto')).length, 2, 'one site, two loads'); assert.ok(b.log.includes('get /app.webmanifest') && b.log.includes('get /sw.js'));
  assert.equal(g.assets.length, 2); assert.ok(g.assets.find((a) => /app\.js/.test(a.url)).text.length > 100); assert.equal(g.assets.find((a) => /googletagmanager/.test(a.url)).text, '', 'a third party\'s script is counted, not read');
  assert.equal(g.blocked, null); assert.ok(g.consent); assert.deepEqual(g.controls, { mobile: ['Open', 'Menu'], desktop: ['Open', 'Batch'] }); assert.equal(g.websockets.length, 2);
  const r = reportOf(g); assert.ok(r.candidates.some((c) => c.name === 'URL parameter ?lang') && r.manifest.shortcuts[0] === 'New batch' && r.serviceWorker.precache && r.consentBanner && r.sitemap.urls === 3);
});
test('visit: a page robots.txt disallows is not loaded at all, and the report says robots', async () => {
  const b = fakeBrowser({ robots: 'User-agent: *\nDisallow: /' }), g = await visit(b, 'https://fixture-tool.test/tools/x');
  assert.equal(g.blocked.kind, 'robots'); assert.ok(!b.log.some((l) => l.startsWith('goto')), 'no page load'); assert.equal(reportOf(g).blocked.kind, 'robots');
});
test('visit: a refusal (403) is recorded as a wall and the candidates stay empty of invented features', async () => {
  const g = await visit(fakeBrowser({ status: 403, body: '<html><title>Denied</title></html>' }), 'https://fixture-tool.test/'); assert.equal(g.blocked.kind, 'refused');
});
test('scanEntry: a site that throws is written as unreachable, never skipped', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitere-s-')), r = await scanEntry({ newContext: async () => { throw new Error('net::ERR_NAME_NOT_RESOLVED'); } }, { id: 'x: gone.test', url: 'https://gone.test/' }, { dir });
  assert.equal(r.blocked.kind, 'unreachable'); assert.ok(fs.existsSync(path.join(dir, 'x-gone.test.json')));
});

test('advertising, tracking and one-page sections are not candidates, at the scan or at the fold', () => {
  const n = (name) => noiseOf({ name }, 'site.test');
  assert.ok(n('Embeds googleads.g.doubleclick.net') && n('Embeds www.google.com') && n('Embeds site.test') && n('Remembers a setting in the browser: google_ama_config') && n('Section /activity/ (1 pages)'));
  assert.ok(!n('Embeds www.youtube-nocookie.com') && !n('Remembers a setting in the browser: fx.theme') && !n('Section /guides/ (2 pages)') && !n('Print layout'));
  const rows = mergeRe(null, { id: 'f' }, 'site.test', { url: 'u', scanned: '2026-10-26', candidates: [{ name: 'Embeds www.google.com', kind: 'embed', tag: 'observed', evidence: 'iframe' }, { name: 'Print layout', kind: 'export', tag: 'read', evidence: 'a.css' }] }).re.sites['site.test'].features;
  assert.deepEqual(rows.map((r) => r.name), ['Print layout']);
});

// a page full of contact details (placeholders in the shapes real ones take; privacy:ok on the lines that show them)
const CONTACT_HTML = `<html lang="en"><head><title>Acme Photo</title></head><body>
<button aria-label="Email: boss@acme-fixture.org">Mail us</button><a href="mailto:press@acme-fixture.org">press@acme-fixture.org</a> <a href="tel:+14155550134">Call 415-555-0134</a>
<button aria-label="Call us +44 20 7946 0958">Call us +44 20 7946 0958</button><button aria-label="Open files">Open</button><p>Visit 221 Baker Street</p><input type="file" accept=".jpg"></body></html>`; // privacy:ok
const CONTACT_JS = `var a="https://api.acme-fixture.org/v1/send?to=boss@acme-fixture.org&x=1";fetch("/api/v1/contact");localStorage.getItem("user.sam@acme-fixture.org");a.download="report-415-555-0134.csv";var c="mailto:ceo@acme-fixture.org";`; // privacy:ok
test('contact details on a rival page never reach the report: emails, phones, mailto/tel links, street addresses, addresses in query strings and file names', () => {
  const r = reportOf({ ...got(), html: { mobile: CONTACT_HTML, desktop: CONTACT_HTML }, controls: { mobile: ['Email: boss@acme-fixture.org', 'Call 415-555-0134', 'Open'], desktop: ['Open'] }, // privacy:ok
    assets: [{ url: 'https://fixture-tool.test/app.js', kind: 'js', bytes: 9, text: CONTACT_JS }], requests: ['https://fixture-tool.test/api/v1/send?to=boss@acme-fixture.org&a@b.co=1', 'https://fixture-tool.test/cdn-cgi/challenge-platform/h/b/orchestrate/jsch/v1?ray=9'], // privacy:ok
    storage: { local: ['user.sam@acme-fixture.org', 'fx.theme'], session: [], idb: [] } }), text = JSON.stringify(r); // privacy:ok
  assert.ok(!/@acme-fixture|@b\.co|415-555|555-0134|7946|Baker Street|mailto:|tel:|boss|press@/i.test(text), 'no contact detail: ' + text.match(/.{25}(?:@acme-fixture|@b\.co|415-555|555-0134|7946|Baker Street|mailto:|tel:|boss|press@).{15}/i));
  assert.ok(text.includes('Open files') && r.controls.some((c) => c.l === 'Open'), 'the feature words stay'); assert.ok(r.candidates.some((c) => /Opens files/.test(c.name)) && r.candidates.some((c) => c.name === 'API path /api/v1/contact'));
  assert.ok(!(r.requests || []).some((q) => /cdn-cgi|@/.test(q)), 'a challenge path and an address in a query are dropped');
  const rows = mergeRe(null, { id: 'f' }, 'fixture-tool.test', r).re.sites['fixture-tool.test'].features; assert.ok(!/[\w.-]+@[a-z][\w-]*\.|555|Baker/i.test(JSON.stringify(rows)), 'nor in the folded rows');
  assert.deepEqual(findPersonalIn(text), [], 'the repo\'s own privacy guard finds nothing in the output');
  for (const [from, to] of [['Email: a@b.org', ''], ['Call 415-555-0134 now', ''], ['visit 221 Baker Street today', 'visit today'], ['mailto:x@y.io', ''], ['Print layout', 'Print layout']]) assert.equal(scrubPersonal(from), to); // privacy:ok
});
