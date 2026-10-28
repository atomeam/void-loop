// The obituaries honesty gate (owner, 2026-10-28: "be sure that our sites are actually better or have a plan to be better in every way").
// A memorial on /obituaries/ says "beaten" only when the tower gate passed every aspect (9 of 9 or more, with evidence) AND the site's
// feature inventory in docs/PARITY has no missing, partial or unreviewed row; every obituary site has an inventory and a cited history.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { obituaryStatus, siteSlug, GATE_MIN, hasMemorial } from '../void-live-deploy/lib/obituary.js';
import { root, floorsBySite, inventory, codeOnly } from './parity.mjs';
import { slugOf } from './site-history.mjs';
import { CATALOG, GENERIC } from './parity-catalog.mjs';

const DEP = path.join(root, 'void-live-deploy');
const parity = JSON.parse(fs.readFileSync(path.join(DEP, 'parity.json'), 'utf8')).sites;
const won = { beaten: true, n: 9, m: 9 };
const clean = { pct: 100, have: 10, partial: 0, missing: 0, unreviewed: 0, total: 10, gaps: [] };

test('beaten only when the 9-of-9 gate and the full inventory both hold', () => {
  assert.equal(GATE_MIN, 9);
  assert.equal(obituaryStatus(won, clean).state, 'beaten');
  assert.equal(obituaryStatus(won, clean).pct, 100);
  assert.equal(obituaryStatus({ beaten: true, n: 11, m: 11 }, clean).beaten, true);
  for (const [f, r, why] of [
    [won, null, /no feature inventory/],
    [won, { ...clean, missing: 1, pct: 95 }, /1 missing feature$/],
    [won, { ...clean, partial: 2, pct: 90 }, /2 partly built/],
    [won, { ...clean, unreviewed: 1, pct: 100 }, /not compared yet/],
    [{ beaten: true, n: 8, m: 8 }, clean, /tower gate is 8 of 8/],
    [{ beaten: true, n: 8, m: 9 }, clean, /tower gate/],
    [{ beaten: false, n: 9, m: 9 }, clean, /tower gate/],
    [null, null, /tower gate/],
  ]) {
    const s = obituaryStatus(f, r);
    assert.equal(s.beaten, false); assert.equal(s.state, 'in progress');
    assert.ok(s.why.some((w) => why.test(w)), JSON.stringify(s.why));
    assert.ok(s.pct < 100, 'an unfinished site never reads 100%');
  }
});

test('the page and the tools name a site by the same slug', async () => {
  for (const s of await floorsBySite()) assert.equal(siteSlug(s.site), slugOf(s.site), s.site);
  assert.equal(siteSlug('https://www.Random.org/'), 'random.org'); assert.equal(siteSlug('Google Translate'), 'google-translate');
});

test('every obituary site has a feature inventory and a cited history', async () => {
  const sites = (await floorsBySite()).filter((s) => s.floors.some((f) => hasMemorial(f)));
  assert.ok(sites.length > 50, 'the tower has its obituaries: ' + sites.length);
  const noParity = sites.filter((s) => !fs.existsSync(path.join(root, 'docs/PARITY', s.slug + '.md')) || !parity[s.slug]);
  assert.deepEqual(noParity.map((s) => s.slug), [], 'run node tools/parity.mjs --write');
  const noHistory = sites.filter((s) => !fs.existsSync(path.join(root, 'docs/HISTORY', s.slug + '.md')));
  assert.deepEqual(noHistory.map((s) => s.slug), [], 'run node tools/site-history.mjs --missing, then node tools/parity.mjs --write');
});

test('no obituary reads beaten while its inventory has a gap', async () => {
  for (const s of await floorsBySite()) for (const f of s.floors.filter((x) => hasMemorial(x))) {
    const r = parity[s.slug], st = obituaryStatus(f, r);
    if (st.beaten) { assert.equal(r.missing + r.partial + r.unreviewed, 0, s.slug); assert.equal(r.have, r.total, s.slug); assert.ok(f.n === f.m && f.m >= 9, s.slug); }
    else assert.ok(st.why.length, s.slug);
  }
  for (const [k, r] of Object.entries(parity)) {
    assert.equal(r.have + r.partial + r.missing + r.unreviewed, r.total, k);
    assert.equal(r.pct, r.total ? Math.round(100 * (r.have + r.partial / 2) / r.total) : 0, k);
  }
});

test('every row of an inventory carries its evidence', () => {
  const dir = path.join(root, 'docs/PARITY');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md') && x !== 'README.md')) {
    const md = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.match(md, /\*\*Match: \d+%\*\*/, f);
    for (const line of md.split('\n').filter((l) => /^\| .+ \| (have|partial|missing|unreviewed) \|/.test(l))) {
      const c = line.split(' | ');
      if (c[2] === 'have' || c[2] === 'partial') assert.match(c[4], /void-live-deploy\/\S+:\d+ `/, f + ': ' + c[0]);
      assert.ok(c[3] && c[3].trim(), f + ': no evidence on the original for ' + c[0]);
    }
  }
});

test('every history fact links its source, and an unknown says so', () => {
  const dir = path.join(DEP, 'history');
  const files = fs.readdirSync(dir).filter((x) => x.endsWith('.json'));
  assert.ok(files.length > 50);
  for (const f of files) {
    const h = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const e of h.events) {
      if (e.u) assert.match(e.t, /unknown/, f);
      else assert.match(e.s, /^https:\/\/(en\.wikipedia\.org|www\.wikidata\.org|web\.archive\.org)\//, f + ': ' + e.t);
    }
    for (const [y, u] of h.snaps) { assert.match(y, /^\d{4}$/); assert.match(u, /^https:\/\/web\.archive\.org\/web\/\d+/); }
  }
});

test('the probes read code, not titles or comments', () => {
  const html = '<head><title>Copy and translate</title></head><body><input accept="image/*"><!-- history --><button id="copy">Copy</button><script>// conversation mode\nconst a = 1; /* handwriting */</script>';
  const t = codeOnly(html, false);
  assert.ok(!/Copy and translate|history|conversation|handwriting/.test(t)); assert.ok(/id="copy">Copy/.test(t));
  assert.equal(t.split('\n').length, html.split('\n').length, 'line numbers survive');
  const scan = inventory({ slug: 'x', site: 'x', url: 'https://x', floors: [{ page: '/nowhere-page/' }] }, { status: 403, hits: {}, surface: [] });
  assert.ok(scan.rows.some((r) => r.status === 'unreviewed'), 'a blocked scan is never clean');
  assert.ok(Object.keys(CATALOG).length > 30 && GENERIC.some((r) => r[7] === 'unreviewed'));
});

test('the inventories and timelines are current (node tools/parity.mjs --write)', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'tools/parity.mjs'), '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('a memorial stays up when the gate adds an aspect it has not measured yet, and reads in progress until it does', () => {
  const clean = { pct: 100, have: 10, partial: 0, missing: 0, unreviewed: 0, total: 10, gaps: [] };
  const won = (a) => ({ verdict: 'better', evidence: a });
  const f = { beaten: false, measured: true, n: 12, m: 13, lost: [], left: ['wider use'], ev: { speed: won('x') } };
  assert.equal(hasMemorial(f), true);
  const st = obituaryStatus(f, clean); assert.equal(st.beaten, false); assert.match(st.why[0], /has not measured wider use yet \(12 of 13/);
  assert.equal(hasMemorial({ ...f, ev: { 'wider use': { verdict: 'worse' } } }), false, 'measured and lost: no memorial');
  assert.equal(hasMemorial({ ...f, lost: ['speed'] }), false); assert.equal(hasMemorial({ ...f, n: 5 }), false); assert.equal(hasMemorial({ ...f, measured: false }), false);
  assert.equal(hasMemorial({ beaten: true, n: 13, m: 13 }), true);
});
