// The tower's liveness guard (owner, 2026-11-04: "i think the site we are up against in the tower redirects to controlhosting.net"): before a
// rival is measured or counted, its http and https addresses are opened in an ordinary browser and followed through every redirect, the
// server's, a meta refresh and a script's. A rival whose final page is on another domain (a parked or hosting page), that errors on both, or
// that shows a parked-domain page is marked gone/parked in void-live-deploy/tower.gone.json with a log entry; the gate skips it and the target
// moves on to the next site. A 200 whose whole page refuses everyone and carries nothing to use ("Sorry, This Page Can't Be Accessed", owner
// 2026-11-07: oneyeard.com stood the Tower on one) is gone too: the page was removed (a real 401/403/429 is a bot wall only some visitors meet,
// and stays alive). No human step: a rival that comes back is taken off the list on the next check.
//   node tools/tower-alive.mjs            re-check the current target and every LANE_PAGES rival, write tower.gone.json, move a gone target on
//   node tools/tower-alive.mjs <host>...  check these hosts only and print the verdicts (nothing written)
//   node tools/tower-alive.mjs --write <host>...  the full re-check plus these hosts, written
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), SITE = path.join(ROOT, 'void-live-deploy');
export const GONE_FILE = path.join(SITE, 'tower.gone.json');
export const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
// the words of a parked or for-sale domain page and of a hosting company's placeholder
export const PARKED = /\b(?:this domain (?:is|may be) (?:for sale|parked)|domain (?:is )?parked|parked (?:free|domain|by)|buy this domain|the domain [\w.-]+ is for sale|domain for sale|this site can(?:'|’)t be reached|account (?:has been )?suspended|default (?:web )?page|future home of|coming soon[^.]{0,40}hosting|sedoparking|parkingcrew|bodis|hugedomains|dan\.com)\b/i;
const bare = (h) => String(h || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
/** the rival's own domain from a floor id, a host or an address ('emoji combos: emojigraph.org' -> 'emojigraph.org'). Pure. */
export function rivalHost(x) {
  const s = String(x || '').trim();
  try { if (/^https?:\/\//i.test(s)) return bare(new URL(s).hostname); } catch (_) {}
  const m = s.match(/([a-z0-9-]+(?:\.[a-z0-9-]+)+)\s*\/?$/i); return m ? bare(m[1]) : '';
}
/** true when host is the rival's own domain or one of its subdomains (m.site.com, www). Pure. */
export const ownHost = (host, rival) => { const h = bare(host), r = bare(rival); return !!h && !!r && (h === r || h.endsWith('.' + r)); };
/** one opened address: { url, final, status, text, error } to { ok, why }. Pure. */
export function judgeOne(rival, o) {
  if (!o || o.error) return { ok: false, kind: 'error', why: (o && o.url || '') + ' did not load: ' + String(o && o.error || 'no answer').slice(0, 120) };
  let fh = ''; try { fh = new URL(o.final).hostname; } catch (_) {}
  if (!ownHost(fh, rival)) return { ok: false, kind: 'moved', why: o.url + ' ends on ' + (fh || o.final) + ', not ' + rival };
  if (o.status >= 400 && ![401, 403, 429].includes(o.status)) return { ok: false, kind: 'error', why: o.url + ' answered ' + o.status };
  if (PARKED.test(String(o.text || '').slice(0, 4000)) && String(o.text || '').length < 3000) return { ok: false, kind: 'parked', why: o.url + ' is a parked-domain page' };
  return { ok: true, why: o.url + ' -> ' + o.final + ' (' + o.status + ')' };
}
// A non-site (owner, 2026-11-06: the tower stood on id5-sync.com, an ad-tracker sync endpoint whose whole home page is the line "This is ID5.",
// as "the next site Verse has not beaten"): a host that answers on its own domain with a page that has nothing on it to use (no control, no
// link, no form, no frame or canvas, a line of text at most) is a machine endpoint, not a site a person uses. Verse lacks none of its features
// (there are none), so it is settled as a non-site with the evidence of the fetch, logged in tower.gone.json, and the tower moves on. Only a
// host Verse has no page for is judged this way (icanhazip.com's one line is a service Verse answers at /ip, and stays a real fight).
export const NON_SITE_CHARS = 160;
const STILL_LOADING = /\b(?:loading|enable javascript|please wait|checking your browser|just a moment|redirecting)\b/i;
const NON_SITE_KINDS = [
  [/(?:^|[.-])(?:detectportal|portal-detection|connectivity(?:check)?|captive|generate[_-]?204|nmcheck|msftconnecttest|msftncsi)(?:[.-]|$)|(?:^|[.-])portal[.-]detection(?:[.-]|$)/i, 'a connectivity check'],
  [/(?:^|[.-])(?:sync|usersync|cookiesync|pixel|beacon|tracker|track(?:ing)?|adserver|adserv|ads|adsrv|analytics|metrics|telemetry|collect|log|stats|tag|tags|match|cm|id)(?:[.-]|\d|$)|sync|pixel|beacon|track|analytic|telemetry/i, 'an ad-tracking or sync endpoint'],
  [/(?:^|[.-])(?:cdn\w*|static\w*|assets?|media|img\w*|edge|cache)(?:[.-]|\d|$)|cdn/i, 'a CDN or asset host'],
];
/** what a non-site is for, from its host and its text: a connectivity check, an ad-tracking or sync endpoint, a CDN host, else a stub. Pure. */
export function nonSiteKind(host, text = '') {
  const h = bare(host);
  for (const [re, kind] of NON_SITE_KINDS) if (re.test(h)) return kind;
  return /^(?:success|ok|1|true)$/i.test(String(text).trim()) ? 'a connectivity check' : 'an inert stub page';
}
/** an opened page that is a non-site: { kind, why } with the evidence, or null. Needs the page's shape (open() reads it). Pure. */
export function nonSiteOf(rival, o) {
  const s = o && o.shape; if (!s || o.error || !(o.status >= 200 && o.status < 400)) return null;
  let fh = ''; try { fh = new URL(o.final).hostname; } catch (_) {}
  if (!ownHost(fh, rival)) return null;
  const text = String(s.sample || '').replace(/\s+/g, ' ').trim();
  if (s.controls || s.links || s.forms || s.frames || s.canvas || !s.chars || s.chars > NON_SITE_CHARS || STILL_LOADING.test(text)) return null;
  const kind = nonSiteKind(rival, text);
  return { kind, why: o.url + ' (' + o.status + ') shows ' + s.chars + ' character' + (s.chars === 1 ? '' : 's') + ' of text ("' + text.slice(0, 80) + '"), 0 controls, 0 links, 0 forms and ' + (s.bytes || 0) + ' bytes of page: ' + kind + ', not a site a person uses; Verse lacks none of its features' };
}
// An access-refusal stub (owner, 2026-11-07: oneyeard.com stood the Tower on "Sorry, This Page Can't Be Accessed", a 200 whose whole page is
// "Sorry, your access is refused due to security reasons..." with a back button and nothing to use): the page was removed, so the rival is gone,
// cleared from monitoring and the aspect counts, and the target moves on to a live site. Only a 2xx answer on the rival's own host counts — a
// real 401/403/429 refusal is a bot wall and stays alive — and a page a person can still use (a working control or link, a form, a frame, real
// text) or a challenge still loading is never read as removed.
export const REFUSED = /sorry,? this page can(?:'|’)t be accessed|(?:your )?access (?:is|was|has been) refused|access denied|you (?:do not|don(?:'|’)t) have (?:permission|authori[sz]ation) to (?:access|view)|safeguard pagebot/i;
/**
 * an opened page that is an access-refusal stub: { why } with the evidence, or null. Pure. (a javascript: href is not a link: `usable` in the
 * shape counts what a person can work.)
 */
export function refusedOf(rival, o) {
  const s = o && o.shape; if (!s || o.error || !(o.status >= 200 && o.status < 300)) return null;
  let fh = ''; try { fh = new URL(o.final).hostname; } catch (_) {}
  if (!ownHost(fh, rival)) return null;
  const text = (String(o.text || '') + ' ' + String(s.sample || '')).replace(/\s+/g, ' ').trim();
  if (!REFUSED.test(text) || STILL_LOADING.test(text)) return null;
  const usable = s.usable === undefined ? s.controls : s.usable;
  if (usable || s.forms || s.frames || !s.chars || s.chars > 500) return null;
  return { why: o.url + ' (' + o.status + ') answers an access-refusal stub ("' + String(s.sample || '').replace(/\s+/g, ' ').trim().slice(0, 80) + '"): 0 usable controls and ' + s.chars + ' characters of text — the page has been removed' };
}
/** both addresses to the verdict. Gone when either ends on another domain or is parked (the domain was handed elsewhere), when neither loads,
 *  or when every address that loaded is an access-refusal stub (refusedOf).
 *  One scheme erroring while the other serves the real site (emojigraph.org: http 500, https 200) stays alive, with a note. Pure. */
export function judge(rival, opened, { nonSite = false } = {}) {
  const r = opened.map((o) => ({ o, j: judgeOne(rival, o) }));
  const hijack = r.find((x) => x.j.kind === 'moved' || x.j.kind === 'parked');
  if (hijack) return { alive: false, status: 'parked', why: hijack.j.why, final: hijack.o.final || null, checks: r.map((x) => x.j.why) };
  const good = r.find((x) => x.j.ok);
  if (!good) return { alive: false, status: 'gone', why: r.map((x) => x.j.why).join('; '), final: null, checks: r.map((x) => x.j.why) };
  // an access-refusal stub on every address that loaded (the page removed, the refusal served to anyone at 200): gone, before any non-site read
  const ref = r.filter((x) => x.j.ok).map((x) => refusedOf(rival, x.o));
  if (ref.length && ref.every(Boolean)) return { alive: false, status: 'gone', kind: 'an access-refusal stub page', why: ref[0].why, final: good.o.final, checks: r.map((x) => x.j.why), shape: good.o.shape };
  // a non-site is judged on every address that loaded: one with something to use on it (a real page on http, a stub on https) is a site
  const ns = nonSite ? r.filter((x) => x.j.ok).map((x) => nonSiteOf(rival, x.o)) : [];
  if (ns.length && ns.every(Boolean)) return { alive: false, status: 'non-site', kind: ns[0].kind, why: ns[0].why, final: good.o.final, checks: r.map((x) => x.j.why), shape: good.o.shape };
  return { alive: true, status: 'alive', why: good.j.why, final: good.o.final, checks: r.map((x) => x.j.why) };
}
/** opens one address in the browser and waits out redirects by meta refresh and script: the address it settles on, its status and text */
export async function open(b, url, { settle = 4000, timeout = 30000 } = {}) {
  const ctx = await b.newContext({ userAgent: UA, locale: 'en-US', ignoreHTTPSErrors: false });
  try {
    const p = await ctx.newPage(); let status = 0;
    p.on('response', (r) => { if (r.request().isNavigationRequest() && r.frame() === p.mainFrame()) status = r.status(); });
    const res = await p.goto(url, { waitUntil: 'load', timeout }); if (res && !status) status = res.status();
    // a meta refresh or a script may move the page after load: wait until the address has held still for `settle` ms (at most 3 hops)
    for (let i = 0; i < 4; i++) { const at = p.url(); await p.waitForTimeout(settle); await p.waitForLoadState('load', { timeout }).catch(() => {}); if (p.url() === at) break; }
    const text = await p.evaluate(() => (document.title || '') + '\n' + (document.body ? document.body.innerText : '')).catch(() => '');
    // the page's shape, for a non-site (nonSiteOf): what there is on it to use, read from the rendered page
    const shape = await p.evaluate(() => {
      const n = (q) => document.querySelectorAll(q).length, t = (document.body ? document.body.innerText : '').trim();
      // what a person can work: a href that only runs script (javascript:history.back()) or points at the page itself (#) is not a real link
      const realLinks = [...document.querySelectorAll('a[href]')].filter((a) => !/^\s*(?:javascript:|#)/i.test(a.getAttribute('href') || '')).length;
      return { chars: t.length, sample: t.slice(0, 200), controls: n('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=textbox],[onclick],[contenteditable=""],[contenteditable=true]'), usable: n('button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=textbox],[onclick],[contenteditable=""],[contenteditable=true]') + realLinks, links: n('a[href]'), forms: n('form'), frames: n('iframe,frame,embed,object'), canvas: n('canvas'), scripts: n('script'), bytes: document.documentElement.outerHTML.length };
    }).catch(() => null);
    return { url, final: p.url(), status, text, shape };
  } catch (e) { return { url, error: String(e && e.message || e).split('\n')[0] }; } finally { await ctx.close().catch(() => {}); }
}
/** a rival host checked on http and https */
export async function check(b, rival, opts = {}) {
  const urls = opts.urls || ['https://' + rival + '/', 'http://' + rival + '/'];
  const opened = []; for (const u of urls) opened.push(await open(b, u, opts));
  return { rival, at: new Date().toISOString(), ...judge(rival, opened, opts) };
}
/** the gone list after a round of checks: gone rivals added with a log entry, rivals that came back taken off (logged too). Pure. */
export function fold(old, results, at) {
  const gone = { ...((old && old.gone) || {}) }, log = ((old && old.log) || []).slice(-200);
  for (const r of results) {
    if (!r.alive) { if (!gone[r.rival] || gone[r.rival].status !== r.status) log.push({ at, rival: r.rival, status: r.status, why: r.why, ...(r.kind ? { kind: r.kind } : {}), ...(r.shape ? { shape: r.shape } : {}) }); gone[r.rival] = { status: r.status, since: (gone[r.rival] && gone[r.rival].since) || at, checked: at, why: r.why, final: r.final, ...(r.kind ? { kind: r.kind } : {}), ...(r.shape ? { shape: r.shape } : {}) }; }
    else if (gone[r.rival]) { log.push({ at, rival: r.rival, status: 'back', why: r.why }); delete gone[r.rival]; }
  }
  return { about: 'Rivals the tower skips because their site is gone, parked or moved to another domain, or is a non-site (a tracker, sync, CDN or connectivity endpoint with nothing on its home page to use), each with the evidence of a real fetch (tools/tower-alive.mjs). Re-checked on every run.', gone, log };
}
/** the gone list on disk ({} when none) and whether a floor id or host is on it */
export const readGone = (file = GONE_FILE) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')).gone || {}; } catch (_) { return {}; } };
export const isGone = (idOrHost, gone = readGone()) => { const h = rivalHost(idOrHost); return !!h && Object.keys(gone).some((g) => ownHost(h, g)); };

// the open sites at the front of the queue, the target first, as the tower orders them from the published files (the same call tower-target
// makes): each run checks this many ahead, so a run of non-sites at the front is settled in one pass and the target lands on a real site
export const NEXT_CHECKED = 6;
async function frontOfQueue(k) {
  try {
    const { tower, towerArgs } = await import('../void-live-deploy/lib/tower.js'), { overlay, readFloorDir } = await import('./tower-files.mjs');
    const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(SITE, f), 'utf8')); } catch (_) { return null; } };
    const tg = rd('tower.target.json') || {}, ev = overlay(rd('tower.evidence.json') || { floors: {} }, readFloorDir());
    const t = tower(...towerArgs((rd('lap.items.json') || {}).onlySite || [], { ev, fr: rd('tower.frontier.json'), rk: rd('tower.rank.json'), sz: rd('tower.size.json'), tg, ft: rd('tower.features.json'), gn: rd('tower.gone.json') }));
    return t.floors.filter((f) => !f.beaten && !f.cleared).slice(0, k);
  } catch (e) { console.log('::warning::the queue could not be read: ' + String(e && e.message || e).slice(0, 160)); return []; }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || process.env.VOID_TEST_BROWSER || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const args = process.argv.slice(2), add = args.includes('--write');
  let rivals = args.filter((a) => a !== '--write').map(rivalHost).filter(Boolean);
  const write = add || !rivals.length;
  let stubs = new Set(); // the hosts a non-site verdict may be given to: pageless sites at the front of the queue, and the non-sites already found
  if (write) {
    const { LANE_PAGES, hostOf } = await import('../void-live-deploy/lib/tower.js');
    const t = (() => { try { return JSON.parse(fs.readFileSync(path.join(SITE, 'tower.target.json'), 'utf8')); } catch (_) { return {}; } })();
    const front = await frontOfQueue(NEXT_CHECKED);
    stubs = new Set([...front.filter((f) => !f.page).map((f) => rivalHost(f.url || f.site || f.id)), ...Object.entries(readGone()).filter(([, g]) => g.status === 'non-site').map(([h]) => h)].filter(Boolean));
    rivals = [...new Set([...rivals, ...Object.keys(readGone()), rivalHost(t.id), ...front.map((f) => rivalHost(f.url || f.site || f.id)), ...(t.passed || []).map((r) => rivalHost(r.id)), ...Object.keys(LANE_PAGES).filter((k) => hostOf(k) === k).map(rivalHost)].filter(Boolean))];
  }
  const results = []; for (const r of rivals) { const x = await check(b, r, { nonSite: stubs.has(r) }); results.push(x); console.log((x.alive ? 'alive ' : x.status.padEnd(6)) + ' ' + r + ': ' + (x.status === 'non-site' ? x.why : x.checks.join(' | '))); }
  await b.close();
  if (write) {
    let old = {}; try { old = JSON.parse(fs.readFileSync(GONE_FILE, 'utf8')); } catch (_) {}
    const next = fold(old, results, new Date().toISOString());
    if (Object.keys(next.gone).length || (old.log || []).length) fs.writeFileSync(GONE_FILE, JSON.stringify(next, null, 1) + '\n');
  }
}
