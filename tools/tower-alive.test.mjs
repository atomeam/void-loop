// tools/tower-alive.mjs: rivals that redirect off their own domain, error out or are parked are dropped; fixture redirects served locally
import test from 'node:test'; import assert from 'node:assert/strict'; import http from 'node:http'; import fs from 'node:fs';
import { judge, judgeOne, rivalHost, ownHost, fold, isGone, check, nonSiteOf, nonSiteKind } from './tower-alive.mjs';
import { settledHtml } from '../void-live-deploy/skills/tower.js';
import { advance } from './tower-target.mjs';
import { historyOf, fileOf } from './assimilated.mjs';

test('rivalHost and ownHost', () => {
  assert.equal(rivalHost('emoji combos: emojigraph.org'), 'emojigraph.org');
  assert.equal(rivalHost('https://www.unitingchurch.org.au/x'), 'unitingchurch.org.au');
  assert.ok(ownHost('www.onlineconverter.com', 'onlineconverter.com'));
  assert.ok(!ownHost('controlhosting.net', 'unitingchurch.org.au'));
  assert.ok(!ownHost('evilonlineconverter.com', 'onlineconverter.com'));
});
test('the real case: unitingchurch.org.au 301s to controlhosting.net and http is 500: parked', () => {
  const j = judge('unitingchurch.org.au', [{ url: 'https://unitingchurch.org.au/', final: 'https://controlhosting.net/', status: 200, text: 'controlhosting.net - Powered by Electricity' }, { url: 'http://unitingchurch.org.au/', error: 'net::ERR_HTTP_RESPONSE_CODE_FAILURE' }]);
  assert.equal(j.alive, false); assert.equal(j.status, 'parked'); assert.match(j.why, /controlhosting\.net/);
});
test('control: emojigraph.org https 200 with http 500 stays alive', () => {
  const j = judge('emojigraph.org', [{ url: 'https://emojigraph.org/', final: 'https://emojigraph.org/', status: 200, text: 'Emojigraph emoji combos and meanings'.repeat(50) }, { url: 'http://emojigraph.org/', error: 'net::ERR_HTTP_RESPONSE_CODE_FAILURE' }]);
  assert.equal(j.alive, true);
});
test('both addresses erroring is gone; a bot wall (403) is not; a parked page is parked', () => {
  assert.equal(judge('x.com', [{ url: 'https://x.com/', final: 'https://x.com/', status: 503 }, { url: 'http://x.com/', error: 'refused' }]).status, 'gone');
  assert.equal(judgeOne('x.com', { url: 'https://x.com/', final: 'https://x.com/', status: 403, text: 'Just a moment' }).ok, true);
  assert.equal(judge('x.com', [{ url: 'https://x.com/', final: 'https://x.com/', status: 200, text: 'This domain is for sale! Buy this domain' }]).status, 'parked');
});
test('fold logs a drop once and takes back a rival that returns', () => {
  const a = fold({}, [{ rival: 'a.org', alive: false, status: 'parked', why: 'moved' }], 't1');
  const b = fold(a, [{ rival: 'a.org', alive: false, status: 'parked', why: 'moved' }], 't2');
  assert.equal(b.log.length, 1); assert.equal(b.gone['a.org'].since, 't1');
  const c = fold(b, [{ rival: 'a.org', alive: true, why: 'ok' }], 't3');
  assert.deepEqual(c.gone, {}); assert.equal(c.log.at(-1).status, 'back');
  assert.ok(isGone('church: www.a.org', a.gone)); assert.ok(!isGone('b.org', a.gone));
});
test('a gone target gives way at once and is taken off passed; the next live site takes over', () => {
  const gone = { 'dead.org': { status: 'parked', why: 'https://dead.org/ ends on controlhosting.net' } };
  const floors = [{ id: 'dead.org', n: 3, m: 9 }, { id: 'also: dead.org', n: 1 }, { id: 'live.com', n: 1, m: 9 }];
  const { file, why } = advance({ id: 'dead.org', since: '2026-11-04', passed: [{ id: 'also: dead.org' }, { id: 'old.com' }] }, floors, '2026-11-04', gone);
  assert.equal(file.id, 'live.com'); assert.match(why, /parked/); assert.deepEqual(file.passed.map((r) => r.id), ['old.com']);
  assert.ok(file.skipped.some((s) => s.id === 'dead.org'));
});
test('a parked site never counts as passed or assimilated', () => {
  const state = { sites: { 'dead.org': { outcome: 'passed', at: '2026-11-04T00:00:00Z' }, 'live.com': { outcome: 'passed', at: '2026-11-04T00:00:00Z' } } };
  const before = fileOf(historyOf({ state })).counts, after = fileOf(historyOf({ state, gone: { 'dead.org': { why: 'moved' } } })).counts;
  assert.equal(after.parked, 1); assert.ok(after.passed < before.passed || after.assimilated < before.assimilated || before.passed + before.assimilated === 0);
});
test('the repo drops unitingchurch.org.au as parked', () => {
  const g = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/tower.gone.json', import.meta.url))).gone;
  assert.equal(g['unitingchurch.org.au'].status, 'parked');
  const row = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/assimilated.json', import.meta.url))).sites.find((r) => r.site === 'unitingchurch.org.au');
  assert.equal(row.outcome, 'parked');
});

// the real case (owner, 2026-11-06): the tower stood on id5-sync.com, whose home page is the one line "This is ID5."
const id5 = (shape = {}) => ({ url: 'https://id5-sync.com/', final: 'https://id5-sync.com/', status: 200, text: '\nThis is ID5.', shape: { chars: 12, sample: 'This is ID5.', controls: 0, links: 0, forms: 0, frames: 0, canvas: 0, scripts: 0, bytes: 64, ...shape } });
test('id5-sync.com is settled as a non-site with the evidence of the fetch; the target moves on in the same run', () => {
  const j = judge('id5-sync.com', [id5(), { ...id5(), url: 'http://id5-sync.com/' }], { nonSite: true });
  assert.equal(j.alive, false); assert.equal(j.status, 'non-site'); assert.equal(j.kind, 'an ad-tracking or sync endpoint');
  assert.match(j.why, /12 characters of text \("This is ID5\."\), 0 controls, 0 links, 0 forms/); assert.match(j.why, /Verse lacks none of its features/);
  const gone = fold({}, [{ rival: 'id5-sync.com', ...j }], 't1').gone;
  assert.equal(gone['id5-sync.com'].status, 'non-site'); assert.equal(gone['id5-sync.com'].shape.controls, 0);
  const { file, why } = advance({ id: 'id5-sync.com', since: '2026-11-06' }, [{ id: 'dalyfeds.com', n: 0, m: 12 }], '2026-11-06', gone);
  assert.equal(file.id, 'dalyfeds.com'); assert.match(why, /^settled id5-sync\.com as a non-site/);
  assert.deepEqual(file.settled.map((x) => x.id), ['id5-sync.com']); assert.ok(!(file.passed || []).some((r) => r.id === 'id5-sync.com'));
  assert.match(settledHtml(file, (x) => x), /Settled: id5-sync\.com \(ad-tracking or sync endpoint, not a site\)/);
});
test('a non-site needs every sign: a link, a control, a form, a frame, more text, a loading screen or no own host keeps it a site', () => {
  assert.equal(nonSiteOf('id5-sync.com', id5()).kind, 'an ad-tracking or sync endpoint');
  for (const s of [{ links: 1, controls: 1 }, { controls: 1 }, { forms: 1 }, { frames: 1 }, { canvas: 1 }, { chars: 900 }, { chars: 0, sample: '' }, { sample: 'Loading...' }]) assert.equal(nonSiteOf('id5-sync.com', id5(s)), null, JSON.stringify(s));
  assert.equal(nonSiteOf('id5-sync.com', { ...id5(), final: 'https://elsewhere.com/' }), null);
  assert.equal(nonSiteOf('id5-sync.com', { ...id5(), status: 500 }), null);
  // only a pageless host at the front of the queue is judged this way: icanhazip.com's one line is a service Verse answers at /ip
  assert.equal(judge('icanhazip.com', [{ url: 'https://icanhazip.com/', final: 'https://icanhazip.com/', status: 200, text: '1.2.3.4', shape: { chars: 7, sample: '1.2.3.4', controls: 0, links: 0, forms: 0, frames: 0, canvas: 0 } }]).alive, true);
  // a stub on one scheme and a real page on the other is a site
  assert.equal(judge('id5-sync.com', [id5(), { ...id5({ links: 4, controls: 4, chars: 900 }), url: 'http://id5-sync.com/' }], { nonSite: true }).alive, true);
});
test('what a non-site is for, from its host and text', () => {
  assert.equal(nonSiteKind('firefox-portal-detection.com', 'success'), 'a connectivity check');
  assert.equal(nonSiteKind('cdn.example.net', 'x'), 'a CDN or asset host');
  assert.equal(nonSiteKind('quiet-domain.org', 'hello'), 'an inert stub page');
});

// fixture redirects in a real browser: every *.test host maps to a local server that answers by Host
const exe = process.env.CHROME_PATH || process.env.VOID_TEST_BROWSER || '/usr/bin/google-chrome';
test('browser: server, meta-refresh and script redirects off the domain are caught; the own site passes', { skip: !fs.existsSync(exe) }, async () => {
  const srv = http.createServer((q, s) => {
    const h = String(q.headers.host).split(':')[0], to = (u) => { s.writeHead(301, { location: u }); s.end(); }, page = (b, c = 200) => { s.writeHead(c, { 'content-type': 'text/html' }); s.end('<!doctype html><title>t</title><body>' + b + '</body>'); };
    const park = 'http://parking.test:' + port + '/';
    if (h === 'parking.test') return page('controlhosting.net - Powered by Electricity');
    if (h === 'own.test') return page('<h1>Real tool</h1>' + 'useful '.repeat(600));
    if (h === 'www.own2.test') return page('<h1>Real</h1>' + 'useful '.repeat(600));
    if (h === 'own2.test') return to('http://www.own2.test:' + port + '/');
    if (h === 'moved.test') return to(park);
    if (h === 'meta.test') return page('<meta http-equiv="refresh" content="0;url=' + park + '">wait');
    if (h === 'js.test') return page('<script>setTimeout(function(){location.href="' + park + '"},300)</script>wait');
    if (h === 'err.test') return page('boom', 500);
    if (h === 'sync.test') return page('This is ID5.');
    page('?', 404);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); var port = srv.address().port;
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--host-resolver-rules=MAP *.test 127.0.0.1'] });
  try {
    const at = (h) => ({ urls: ['http://' + h + ':' + port + '/'], settle: 800, timeout: 10000 });
    for (const h of ['moved.test', 'meta.test', 'js.test']) { const r = await check(b, h, at(h)); assert.equal(r.alive, false, h); assert.equal(r.status, 'parked', h); assert.match(r.final, /parking\.test/, h); }
    assert.equal((await check(b, 'err.test', at('err.test'))).status, 'gone');
    assert.equal((await check(b, 'own.test', at('own.test'))).alive, true);
    assert.equal((await check(b, 'own2.test', at('own2.test'))).alive, true);
    const ns = await check(b, 'sync.test', { ...at('sync.test'), nonSite: true }); assert.equal(ns.status, 'non-site'); assert.equal(ns.shape.controls, 0); assert.equal(ns.shape.chars, 12);
    assert.equal((await check(b, 'own.test', { ...at('own.test'), nonSite: true })).alive, true);
  } finally { await b.close(); srv.close(); }
});
