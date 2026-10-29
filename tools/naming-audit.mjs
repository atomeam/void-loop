// The naming audit (owner, 2026-10-26: "every future floor measurement entirely bulletproof"): the completeness checklist
// reads a page the way a visitor does, so a feature the page HAS but never NAMES in words counts as missing. Two floors lost
// completeness exactly that way (the coin's flip counter, the base64 decoder) and were only found by a gate run.
//
// This check answers, for every floor that has a features file, one question: does the page say what its checklist credits it
// with? It runs the gate's own matcher (tools/tower-probes.mjs showsFeature) over the page's own text, so the audit and the gate
// can never disagree.
//
//   node tools/naming-audit.mjs            report every unnamed feature from each page's own HTML, exit 0 (advisory)
//   node tools/naming-audit.mjs --rendered the same audit over the page as a browser draws it (the gate's own view: a feature
//   node tools/naming-audit.mjs --check    exit 1 when a page no longer names a feature the gate's last measurement credits it with
//                                          (tower.evidence.json: a feature its completeness row does not list as lacking)
//                                          a script renders counts as named here, never in the static read)
//   node tools/naming-audit.mjs --json     the findings as JSON, for a workflow or a ledger
//
// A page's text here is its own HTML with scripts and styles removed: the words a visitor reads before any script runs. A page
// that draws its features only after a script (a client-rendered grid) reads as unnamed here even when it names them on screen;
// that is why the default run is advisory and the check is the ratchet, not the report.
//
// What the check fails on (2026-10-29: it failed on every run, since it counted a feature Verse does not have yet as one it stopped
// naming): only drift. A feature the gate already records as lacking is a known gap, reported by the completeness aspect itself; a
// features file whose floors were never measured for completeness credits nothing yet. Both are still listed, never failed on.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { factsFromFile, showsFeature, withFeatureFacts, probeFor, featureSlug } from './tower-probes.mjs';
import { FLOORS } from '../void-live-deploy/lib/tower.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(root, 'void-live-deploy');
const FEATURES = path.join(root, 'domains', 'features');

/** the words a visitor reads in a page's own HTML: scripts, styles and tags removed, whitespace collapsed. Pure. */
export function pageWords(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** the URL the gate reads for a floor: its probe's ask, else the page itself. Pure. */
export function urlFor(floor, page) {
  const probe = probeFor(floor) || {};
  const ask = probe.ask && (probe.ask.verse || (typeof probe.ask === 'string' ? probe.ask : ''));
  return ask || probe.verse || page || ''; // a probe names its URL as ask.verse or as its own verse; the gate reads either
}

/** a features file's page on disk: { file, page, html, words } or { file, page, missing: true }. Pure. */
export function readFloor(file, siteDir = SITE) {
  let spec;
  try { spec = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return { file, error: 'unreadable' }; }
  const id = path.basename(file, '.json');
  const page = String(spec.verse_page || (FLOORS.find((f) => f.id === id) || {}).page || '').trim();
  if (!page || !/^\//.test(page)) return { file, error: 'no verse_page' };
  const disk = path.join(siteDir, page.replace(/^\//, '').replace(/\/$/, ''), 'index.html');
  if (!fs.existsSync(disk)) return { file, page, missing: true };
  const html = fs.readFileSync(disk, 'utf8');
  return { file, page, html, words: pageWords(html) };
}

/** the floor's completeness checklist exactly as the gate builds it (the probe's facts plus its file's first six), each fact matched
 *  against the page's words: [{ floor, feature, lacking }] for the ones the page never names. Pure. */
export function auditFloor(read, words = null, id = null) {
  if (!read || read.error || read.missing) return [];
  if (words == null && !read.words) return [];
  const floor = id || path.basename(read.file, '.json');
  const probe = withFeatureFacts(probeFor(floor) || { facts: [] }, floor);
  const text = words == null ? read.words : words;
  const out = [];
  for (const [name, fn] of probe.facts || []) {
    let ok = false;
    try { ok = typeof fn === 'function' ? !!fn(text) : (fn && fn.test ? fn.test(text) : false); } catch (_) { ok = false; }
    if (!ok) out.push({ floor, feature: name, lacking: [] });
  }
  return out;
}

/** the whole audit: [{ floor, page, unnamed: [...] }] over every features file. Pure. */
export function audit(siteDir = SITE, featuresDir = FEATURES) {
  const rows = [];
  for (const f of fs.readdirSync(featuresDir).filter((x) => x.endsWith('.json')).sort()) {
    const read = readFloor(path.join(featuresDir, f), siteDir);
    const floor = path.basename(f, '.json');
    rows.push({ floor, page: read.page || '', url: urlFor(floor, read.page), unnamed: auditFloor(read) });
  }
  return rows;
}

/** what the gate's last measurement records Verse as lacking, per features file: { slug: Set of ', a, b, ' lists }. A slug is here only
 *  when at least one of its floors has a completeness row (an empty set: measured, lacking nothing). Pure. */
export function lackingBySlug(evidence) {
  const out = {};
  for (const [floor, row] of Object.entries((evidence && evidence.floors) || {})) {
    const c = row && row.completeness; if (!c) continue;
    const set = out[featureSlug(floor)] || (out[featureSlug(floor)] = new Set());
    const m = /\(Verse lacks: ([\s\S]*?)(?:; site lacks: [\s\S]*)?\)$/.exec(String(c.evidence || ''));
    if (m && m[1] !== 'none') set.add(', ' + m[1].toLowerCase() + ', ');
  }
  return out;
}

/** the audit's rows split by what the gate credits: drift (credited by the last measurement, now unnamed: the check fails on these),
 *  known (the gate already records it as lacking) and unmeasured (no completeness row for the file's floors yet). Pure. */
export function splitByCredit(rows, lacking) {
  return rows.map((r) => {
    const lists = lacking[r.floor], known = (u) => !!lists && [...lists].some((t) => t.includes(', ' + String(u.feature).toLowerCase() + ', '));
    return { ...r, drift: lists ? r.unnamed.filter((u) => !known(u)) : [], known: lists ? r.unnamed.filter(known) : [], unmeasured: lists ? [] : r.unnamed };
  });
}

/** every kept page as a browser draws it: { '/flights/': text }. One browser, one server, page by page. Impure (a browser). */
export async function renderedText(pages, siteDir = SITE, live = '') {
  const http = await import('node:http'), fsP = await import('node:fs');
  const { chromium } = await import('playwright-core');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const server = live ? { address: () => ({ port: 0 }), close() {} } : http.createServer((req, res) => {
    let u; try { u = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { res.writeHead(400); return res.end(); }
    if (u === '/') u = '/index.html';
    let f = path.join(siteDir, u);
    if (f.startsWith(siteDir) && fsP.existsSync(f) && fsP.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!f.startsWith(siteDir) || !fsP.existsSync(f) || fsP.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fsP.createReadStream(f).pipe(res);
  }).listen(0);
  const base = live ? live : 'http://127.0.0.1:' + server.address().port + '/';
  const exe = [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, '/usr/bin/google-chrome', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium'].find((x) => x && fsP.existsSync(x));
  const browser = await chromium.launch({ executablePath: exe });
  const out = {};
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'en-US' });
    for (const page of pages) {
      const p = await ctx.newPage();
      try {
        await p.goto(live ? live.replace(/\/$/, '') + (page.startsWith('/') ? page : '/' + page) : base + page.replace(/^\//, ''), { waitUntil: 'load', timeout: 20000 });
        // let the page's own script draw its first screen: a page whose rows come from its own fetch (weather: a place, then its forecast)
        // names them only once that fetch answers, which a fixed 1.6 s missed on the live run (2026-10-29), so wait for the network to go quiet
        await p.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await p.waitForTimeout(600);
        out[page] = await p.evaluate(() => document.body.innerText).catch(() => '');
      } catch (_) { out[page] = ''; }
      await p.close().catch(() => {});
    }
    await ctx.close().catch(() => {});
  } finally { await browser.close().catch(() => {}); server.close(); }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const check = process.argv.includes('--check'), json = process.argv.includes('--json');
  const rows = audit();
  if (process.argv.includes('--rendered')) {
    const pages = [...new Set(rows.map((r) => r.url).filter(Boolean))];
    const text = await renderedText(pages, SITE, process.argv.includes('--live') ? 'https://a-to-mind.com' : '');
    for (const r of rows) {
      if (!r.url || !(r.url in text)) continue;
      r.unnamed = auditFloor({ file: path.join(FEATURES, r.floor + '.json') }, text[r.url], r.floor);
    }
  }
  let evidence = null; try { evidence = JSON.parse(fs.readFileSync(path.join(SITE, 'tower.evidence.json'), 'utf8')); } catch (_) { evidence = null; }
  const split = splitByCredit(rows, lackingBySlug(evidence));
  const flagged = split.filter((r) => r.unnamed.length);
  const total = flagged.reduce((n, r) => n + r.unnamed.length, 0), drift = split.reduce((n, r) => n + r.drift.length, 0);
  if (json) { console.log(JSON.stringify({ floors: rows.length, flagged: flagged.length, features: total, drift, rows: flagged }, null, 1)); }
  else {
    for (const r of flagged) {
      console.log(r.floor + ' (' + r.page + ')');
      for (const [k, list] of [['NO LONGER NAMED', r.drift], ['known gap', r.known], ['not measured yet', r.unmeasured]]) for (const u of list) console.log('    ' + k + ': ' + u.feature);
    }
    if (flagged.length) console.log('');
    if (process.argv.includes('--rendered') && !process.argv.includes('--live')) console.log('(a page whose rows come from its own api shows its pre-fetch state to a local server: run with --live for the page the gate reads)');
    console.log(flagged.length + ' of ' + rows.length + ' floors have a feature their page never names (' + total + ' features); ' + drift + ' of them the gate credits the page with');
  }
  // a workflow shows each drifted page as an annotation, so the reason is on the run without its log
  if (process.env.GITHUB_ACTIONS) for (const r of split.filter((x) => x.drift.length)) console.log('::error title=naming: ' + r.floor + '::' + r.page + ' no longer names: ' + r.drift.map((u) => u.feature).join('; '));
  // advisory by default: the picture, not a red. --check fails only on drift (see the header).
  process.exit(check && drift > 0 ? 1 : 0);
}
