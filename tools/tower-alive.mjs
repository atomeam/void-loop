// The tower's liveness guard (owner, 2026-11-04: "i think the site we are up against in the tower redirects to controlhosting.net"): before a
// rival is measured or counted, its http and https addresses are opened in an ordinary browser and followed through every redirect, the
// server's, a meta refresh and a script's. A rival whose final page is on another domain (a parked or hosting page), that errors on both, or
// that shows a parked-domain page is marked gone/parked in void-live-deploy/tower.gone.json with a log entry; the gate skips it and the target
// moves on to the next site. No human step: a rival that comes back is taken off the list on the next check.
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
/** both addresses to the verdict. Gone when either ends on another domain or is parked (the domain was handed elsewhere), or when neither loads.
 *  One scheme erroring while the other serves the real site (emojigraph.org: http 500, https 200) stays alive, with a note. Pure. */
export function judge(rival, opened) {
  const r = opened.map((o) => ({ o, j: judgeOne(rival, o) }));
  const hijack = r.find((x) => x.j.kind === 'moved' || x.j.kind === 'parked');
  if (hijack) return { alive: false, status: 'parked', why: hijack.j.why, final: hijack.o.final || null, checks: r.map((x) => x.j.why) };
  const good = r.find((x) => x.j.ok);
  if (!good) return { alive: false, status: 'gone', why: r.map((x) => x.j.why).join('; '), final: null, checks: r.map((x) => x.j.why) };
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
    return { url, final: p.url(), status, text };
  } catch (e) { return { url, error: String(e && e.message || e).split('\n')[0] }; } finally { await ctx.close().catch(() => {}); }
}
/** a rival host checked on http and https */
export async function check(b, rival, opts = {}) {
  const urls = opts.urls || ['https://' + rival + '/', 'http://' + rival + '/'];
  const opened = []; for (const u of urls) opened.push(await open(b, u, opts));
  return { rival, at: new Date().toISOString(), ...judge(rival, opened) };
}
/** the gone list after a round of checks: gone rivals added with a log entry, rivals that came back taken off (logged too). Pure. */
export function fold(old, results, at) {
  const gone = { ...((old && old.gone) || {}) }, log = ((old && old.log) || []).slice(-200);
  for (const r of results) {
    if (!r.alive) { if (!gone[r.rival]) log.push({ at, rival: r.rival, status: r.status, why: r.why }); gone[r.rival] = { status: r.status, since: (gone[r.rival] && gone[r.rival].since) || at, checked: at, why: r.why, final: r.final }; }
    else if (gone[r.rival]) { log.push({ at, rival: r.rival, status: 'back', why: r.why }); delete gone[r.rival]; }
  }
  return { about: 'Rivals the tower skips because their site is gone, parked or moved to another domain (tools/tower-alive.mjs). Re-checked on every run.', gone, log };
}
/** the gone list on disk ({} when none) and whether a floor id or host is on it */
export const readGone = (file = GONE_FILE) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')).gone || {}; } catch (_) { return {}; } };
export const isGone = (idOrHost, gone = readGone()) => { const h = rivalHost(idOrHost); return !!h && Object.keys(gone).some((g) => ownHost(h, g)); };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || process.env.VOID_TEST_BROWSER || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const args = process.argv.slice(2), add = args.includes('--write');
  let rivals = args.filter((a) => a !== '--write').map(rivalHost).filter(Boolean);
  const write = add || !rivals.length;
  if (write) {
    const { LANE_PAGES, hostOf } = await import('../void-live-deploy/lib/tower.js');
    const t = (() => { try { return JSON.parse(fs.readFileSync(path.join(SITE, 'tower.target.json'), 'utf8')); } catch (_) { return {}; } })();
    rivals = [...new Set([...rivals, ...Object.keys(readGone()), rivalHost(t.id), ...(t.passed || []).map((r) => rivalHost(r.id)), ...Object.keys(LANE_PAGES).filter((k) => hostOf(k) === k).map(rivalHost)].filter(Boolean))];
  }
  const results = []; for (const r of rivals) { const x = await check(b, r); results.push(x); console.log((x.alive ? 'alive ' : x.status.padEnd(6)) + ' ' + r + ': ' + x.checks.join(' | ')); }
  await b.close();
  if (write) {
    let old = {}; try { old = JSON.parse(fs.readFileSync(GONE_FILE, 'utf8')); } catch (_) {}
    const next = fold(old, results, new Date().toISOString());
    if (Object.keys(next.gone).length || (old.log || []).length) fs.writeFileSync(GONE_FILE, JSON.stringify(next, null, 1) + '\n');
  }
}
