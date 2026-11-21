// House loops: one job each. Pure. The runner is tools/house-loops.mjs. Games and Echo Vault's page are left alone.
import { tierFor } from './agent-core.js';

export const PAUSE_MS = 6 * 3600e3;
export const FAIL_STREAK = 3;
export const HANDS_OFF = /\/(?:arcade|echo-vault|games|lab)(?:\/|$)|debris-field/;

export const LOOPS = Object.freeze([
  { id: 'links', name: 'Broken links', what: 'Checks live addresses and adds a redirect when a plain name already has a home.', hourUtc: 1, minuteUtc: 7, minutes: 3 },
  { id: 'health', name: 'Page health', what: 'Reads a live page for language, a picture with no alt text, and a security header.', hourUtc: 3, minuteUtc: 17, minutes: 3 },
  { id: 'speed', name: 'Page speed', what: 'Times the home page and the progress page.', hourUtc: 5, minuteUtc: 27, minutes: 2 },
  { id: 'twins', name: 'Duplicate pages', what: 'Finds two pages that share a heading.', hourUtc: 7, minuteUtc: 37, minutes: 3 },
  { id: 'plain', name: 'Plain words', what: 'Puts the page description under a heading that has no sentence.', hourUtc: 9, minuteUtc: 47, minutes: 3 },
  { id: 'fresh', name: 'Data freshness', what: 'Reads the date on a dataset and names the loop that refreshes it.', hourUtc: 11, minuteUtc: 57, minutes: 2 },
  { id: 'seo', name: 'Search tags', what: 'Adds a title from the heading when a page has none.', hourUtc: 13, minuteUtc: 13, minutes: 3 },
  { id: 'coverage', name: 'Test coverage', what: 'Names the next library file no test mentions.', hourUtc: 15, minuteUtc: 23, minutes: 3 },
  { id: 'deps', name: 'Dependencies', what: 'Names a high or critical advisory. It does not bump a package.', hourUtc: 17, minuteUtc: 33, minutes: 4 },
  { id: 'handoff', name: 'Page handoff', what: 'Names the next page pair that share data and are not connected.', hourUtc: 19, minuteUtc: 43, minutes: 4 },
  { id: 'next-tool', name: 'Next free tool', what: 'Names the growth loop\'s top pick, or the oldest open gap when the loop has none.', hourUtc: 21, minuteUtc: 53, minutes: 2 },
]);

export const LINK_FIXES = Object.freeze([
  { path: '/reading-list', to: '/echo-vault/?entry=paper-notes', why: 'a reading list with no tool opens its Echo Vault entry' },
  { path: '/reading-list/', to: '/echo-vault/?entry=paper-notes', why: 'a reading list with no tool opens its Echo Vault entry' },
]);
export const DATASETS = Object.freeze([
  { id: 'btc-candles', file: 'void-live-deploy/trading-bots/data/BTC-USD.json', everyDays: 2, owner: 'trading-bots-data.yml' },
  { id: 'eth-candles', file: 'void-live-deploy/trading-bots/data/ETH-USD.json', everyDays: 2, owner: 'trading-bots-data.yml' },
]);

const cron = (l) => l.minuteUtc + ' ' + l.hourUtc + ' * * *';
export const scheduleOf = (l) => 'daily at ' + String(l.hourUtc).padStart(2, '0') + ':' + String(l.minuteUtc).padStart(2, '0') + ' UTC';
export const laneForCron = (expr) => LOOPS.find((l) => cron(l) === String(expr || '').trim()) || null;

export function dueLanes(loops, now, houseAt = {}, windowMs = 3 * 3600e3) {
  const d = new Date(now), out = [];
  for (const lane of loops || []) {
    const slot = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), lane.hourUtc, lane.minuteUtc || 0);
    if (now < slot || now >= slot + windowMs) continue;
    if ((houseAt[lane.id] || 0) >= slot) continue;
    out.push(lane);
  }
  return out;
}
export function workerLane(hour, loops = LOOPS) {
  const hit = (loops || []).find((l) => l.hourUtc === hour);
  const live = ['links', 'health', 'speed'];
  return hit && live.includes(hit.id) ? hit.id : live[((hour % 24) + 24) % live.length];
}
export function backoff(state, now) {
  const s = state || { fails: 0, pauseUntil: 0 };
  if (s.pauseUntil && now < s.pauseUntil) return { run: false, status: 'Paused until ' + new Date(s.pauseUntil).toISOString().slice(0, 16).replace('T', ' ') + ' UTC. It starts again on its own.' };
  return { run: true, status: '' };
}
export function noteResult(state, ok, now) {
  if (ok) return { fails: 0, pauseUntil: 0 };
  const fails = (state && state.fails || 0) + 1;
  return { fails, pauseUntil: fails >= FAIL_STREAK ? now + PAUSE_MS : 0 };
}
export function redirectAdds(text, statuses, fixes = LINK_FIXES, targetExists = true) {
  if (!targetExists) return [];
  const have = String(text || ''), out = [];
  for (const f of fixes) {
    if (!statuses || statuses[f.path] !== 404) continue;
    const rule = f.path + ' ' + f.to + ' 301';
    if (have.includes(rule) || out.includes(rule)) continue;
    out.push(rule);
  }
  return out;
}
export function withRedirects(text, lines, why) {
  if (!lines || !lines.length) return String(text || '');
  return String(text || '').replace(/\s*$/, '') + '\n# ' + (why || 'a plain name opens the page that already exists') + '\n' + lines.join('\n') + '\n';
}
const descOf = (html) => { const m = String(html || '').match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
export function h1Text(html) { const m = String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : ''; }
export function plainPatch(html) {
  const src = String(html || ''), h = src.search(/<h1\b/i);
  if (h < 0) return '';
  const after = src.slice(h), end = after.search(/<\/h1>/i);
  if (end < 0) return '';
  const tag = after.slice(0, end + 5);
  if (/clip\s*:|position\s*:\s*absolute|visually-hidden|sr-only/i.test(tag)) return '';
  if (/<p[\s>]/i.test(after.slice(end, end + 1500))) return '';
  const desc = descOf(src);
  if (desc.length < 40 || desc.length > 240 || /https?:|<\w/.test(desc)) return '';
  return src.slice(0, h) + tag + '\n  <p class="note">' + desc.replace(/</g, '') + '</p>' + src.slice(h + tag.length);
}
export function healthOf(html, headers) {
  const src = String(html || '');
  const get = headers && typeof headers.get === 'function' ? (k) => headers.get(k) : (k) => headers && headers[String(k || '').toLowerCase()];
  const imgs = [...src.matchAll(/<img\b[^>]*>/gi)];
  return { lang: /<html\b[^>]*\blang=/i.test(src), missingAlt: imgs.filter((m) => !/\balt=/i.test(m[0])).length, csp: !!(get && get('content-security-policy')) };
}
export function langPatch(html) {
  const src = String(html || '');
  if (/<html\b[^>]*\blang=/i.test(src) || !/<html\b/i.test(src)) return '';
  return src.replace(/<html\b/i, '<html lang="en"');
}
export function speedLine(samples) {
  const rows = samples || [];
  if (!rows.length) return 'No page answered.';
  return rows.map((s) => s.path + ' answered ' + (s.status || 'nothing') + ' in ' + (s.ms < 2000 ? 'under 2 seconds' : Math.round(s.ms / 1000) + ' seconds') + ', ' + Math.round((s.bytes || 0) / 1024) + ' KB').join('. ') + '.';
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function twinGroups(pages) {
  const by = new Map();
  for (const p of pages || []) {
    const h = norm(p.h1);
    if (h.length < 12 || HANDS_OFF.test(p.path || '')) continue;
    if (!by.has(h)) by.set(h, []);
    by.get(h).push(p.path);
  }
  return [...by.entries()].filter(([, ps]) => new Set(ps).size > 1).map(([h1, paths]) => ({ h1, paths: [...new Set(paths)] }));
}
export function ageDays(asOf, today) {
  const a = Date.parse(asOf + 'T00:00:00Z'), b = Date.parse(today + 'T00:00:00Z');
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 864e5) : null;
}
export function staleSets(rows, today) {
  return (rows || []).map((r) => ({ ...r, age: ageDays(r.asOf, today) })).filter((r) => r.age != null && r.age > r.everyDays);
}
export function seoPatch(html) {
  const src = String(html || ''), h1 = h1Text(src);
  if (!h1 || /<title>[^<]+<\/title>/i.test(src) || !/<head\b/i.test(src)) return '';
  return src.replace(/<head[^>]*>/i, (m) => m + '\n<title>' + h1.replace(/[<>"]/g, '') + ' · Verse</title>');
}
export function nextGap(md) {
  for (const line of String(md || '').split('\n')) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|[^|]*\|[^|]*\|\s*open\s*\|/);
    if (m) return { n: Number(m[1]), ask: m[2].trim() };
  }
  return null;
}
export function topHandoff(gaps, skip = /\/(?:lab|arcade|echo-vault|games)(?:\/|$)/) {
  return (gaps || []).find((g) => g && !skip.test(g.from || '') && !skip.test(g.to || '')) || null;
}
export function directPatch(audit) {
  const v = audit && audit.vulnerabilities || {};
  for (const [name, row] of Object.entries(v)) {
    if (!row || !row.isDirect || (row.severity !== 'high' && row.severity !== 'critical')) continue;
    const fix = row.fixAvailable;
    if (!fix || fix === true || fix.isSemVerMajor || (fix.name && fix.name !== name)) continue;
    return { name, version: String(fix.version || '') };
  }
  return null;
}
export function advisoryCount(audit) {
  return Object.values((audit && audit.vulnerabilities) || {}).filter((r) => r && (r.severity === 'high' || r.severity === 'critical')).length;
}
/** Free stack first. The strong tier only after a free miss, and only when the infrastructure pot holds a month of it. */
export function payTier({ freeFailed = false, infraCents = 0 } = {}) {
  if (!freeFailed) return { use: 'free', paidCents: 0, note: 'Free model stack. No treasury spend.' };
  const t = tierFor(infraCents);
  if (t.name === 'strong') return { use: 'paid', paidCents: null, note: 'The free models did not answer. The strong tier is paid from the treasury infrastructure pot, which keeps 500 cents for a month of it. This run does not meter neurons per call.' };
  return { use: 'held', paidCents: 0, note: 'The free models did not answer. The treasury does not hold a month of the strong tier, so this run stops.' };
}
export function costOf(loop, extra = {}) {
  return {
    runner: extra.runner || 'actions',
    minutes: extra.minutes != null ? extra.minutes : (loop && loop.minutes) || 0,
    paidCents: extra.paidCents === undefined ? 0 : extra.paidCents,
    note: extra.note || 'No model call. GitHub Actions on a public repo, so standard runner minutes are not billed. The figure is still the time a runner is held.',
  };
}
export function sameFinding(a, b) { return !!a && !!b && a.last === b.last && a.status === b.status; }
export function blankLoop(loop) {
  return { id: loop.id, name: loop.name, what: loop.what, schedule: scheduleOf(loop), status: 'Waiting for its first run.', last: '', cost: costOf(loop, { note: 'Not run yet.' }), state: { fails: 0, pauseUntil: 0 } };
}
export function blankLog(loops = LOOPS) {
  const list = loops || LOOPS;
  return { note: 'What Verse is doing. Each file is one job. A paid cent is treasury money after the free models are used up.', estimate: { actionsMinutesMonth: list.reduce((n, l) => n + l.minutes, 0) * 30, worker: 'hourly, free' }, loops: list.map(blankLoop) };
}
