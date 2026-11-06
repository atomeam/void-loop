// Verse's job leverage and overlap check (owner, 2026-11-06: "make sure verse is not causing overlap" and "make sure the jobs are actually
// moving us forward and the highest leverage moves always, never busywork for the sake of nothing"). Pure. It adds to lib/team-priorities.js
// scoreOf (impact ÷ effort × confidence): what a job unblocks (a red main, a stuck pull request), what it earns (the paid x402 services),
// the smallest Versus site first (tower.size.json controls), and a penalty for a repeat of work already shipped and for pure churn. And it
// gives each job a scope (its files, pages, pull requests, #work thread and target) so functions/api/team.js handOut never hands two seats
// the same work, and its sweep gives back the later of two overlapping jobs with the reason in #work.
import { askKey, kindOf } from './team.js';

export const REPEAT_DAYS = 14; // a job that asks again for what shipped this long ago is a repeat
const GENERIC = /^(feature|heal|flake|gap|versus|will|voice|review|novelty|auto):(team|ask|want)-[\w-]+$/; // a target that is only its job's own id says nothing about scope
const FILE = /\b((?:void-live-deploy|tools|docs|lib|functions|skills|team|\.github)\/[\w./-]+\.(?:m?js|json|ya?ml|html|css|md|txt))\b/g;
const PR = /(?:\bpull\/|\bPR\s*#?|(?:^|[\s(])#)(\d{3,5})\b/gi;
const THREAD = /\bthread\s*#?\s*(\d{1,7})\b/gi;
const PAGE = /(?:a-to-mind\.com)?(\/[a-z0-9][a-z0-9-]{1,40}\/)(?![\w-]*\.)/gi;
const NOT_PAGES = new Set(['/api/', '/lib/', '/tools/', '/docs/', '/functions/', '/skills/', '/team/', '/issues/', '/pull/', '/actions/', '/runs/', '/blob/', '/tree/', '/main/', '/void-live-deploy/']);
const INCOME = /\b(x402|paid|wallet|usdc|payment|pay ?per|402|store|checkout|gumroad|price|pricing|subscribe|sale|revenue|multiverse|membership|paypal)\b/i;
const UNBLOCK = /\b(main (?:is )?red|red main|main green|keep main green|unblock|blocked|merge (?:gate|queue|train)|suite gate|automerge|stuck (?:pr|pull)|deploy (?:fails|failed|is red)|broken deploy)\b/i;
const CHURN = /\b(wording|reword|typo|rename|spacing|padding|colou?r of|font size|whitespace|lint|prettier|comment(?:s)? only|tidy|cosmetic)\b/i;

/** what a job touches: files, pages, pull requests, #work threads, and its target when the target names something. -> ['file:..', 'page:..', ..] */
export function scopeOf(j) {
  const ask = String(j && j.ask || ''), target = String(j && j.target || ''), out = new Set();
  for (const m of ask.matchAll(FILE)) out.add('file:' + m[1].replace(/^void-live-deploy\//, ''));
  for (const m of ask.matchAll(THREAD)) out.add('thread:' + Number(m[1]));
  const rest = ask.replace(THREAD, ' '), bare = rest.replace(/https?:\/\/(?!(?:www\.)?a-to-mind\.com)\S+/gi, (u) => (/\/pull\/\d+/.test(u) ? ' pull/' + /\/pull\/(\d+)/.exec(u)[1] + ' ' : ' ')).replace(FILE, ' ');
  for (const m of bare.matchAll(PR)) out.add('pr:' + Number(m[1]));
  for (const m of bare.matchAll(PAGE)) { const p = m[1].toLowerCase(); if (!NOT_PAGES.has(p)) out.add('page:' + p); }
  if (target && !GENERIC.test(target) && target.includes(':')) out.add('target:' + target.toLowerCase());
  const k = askKey(ask); if (k.length >= 24) out.add('ask:' + k);
  return [...out];
}
/** the first thing two jobs both touch, or null. A job never overlaps itself. */
export function overlapOf(a, b) {
  if (!a || !b || a.id === b.id) return null;
  const sa = new Set(scopeOf(a));
  return scopeOf(b).find((k) => sa.has(k)) || null;
}
/** a scope key as people read it */
export const scopeWord = (k) => { const [t, ...r] = String(k).split(':'), v = r.join(':');
  return t === 'file' ? 'the file ' + v : t === 'page' ? 'the page ' + v : t === 'pr' ? 'pull request #' + v : t === 'thread' ? '#work thread ' + v : t === 'target' ? 'the same target (' + v + ')' : 'the same ask'; };

/** a job that would redo shipped work: the same ask, or the same named target, closed done or live within REPEAT_DAYS. -> reason or null.
 *  done: void_queue rows { id, ask, target, state, updated } */
export function repeatOf(j, done = [], now = Date.now()) {
  const k = askKey(j.ask), t = String(j.target || '').toLowerCase(), named = t && !GENERIC.test(t) && t.includes(':');
  for (const d of done || []) {
    if (!d || d.id === j.id || !['done', 'live'].includes(d.state)) continue;
    const at = Date.parse(d.updated || d.at || ''); if (Number.isFinite(at) && now - at > REPEAT_DAYS * 864e5) continue;
    if ((k.length >= 24 && askKey(d.ask) === k) || (named && String(d.target || '').toLowerCase() === t)) return 'a repeat of ' + d.id + ', already shipped';
  }
  return null;
}
/** the fewest controls first: a Versus job's rival site from tower.size.json. -> { controls, host } or null */
function sizeOf(j, size) {
  const m = /versus:(?:floor-)?([^\s:]+)/i.exec(String(j.target || '')); if (!m || !size || !size.sites) return null;
  const s = size.sites[m[1].toLowerCase()]; return s && Number.isFinite(s.controls) ? { controls: s.controls, host: m[1] } : null;
}

/** the leverage parts for one job. ev: { main: { red, checks }, done: [rows], size: tower.size.json }.
 *  -> { add: [[impact, why]], mult: [[factor, why]], busywork: reason|null } */
export function leverageOf(j, ev = {}, now = Date.now()) {
  const kind = kindOf(j.target), ask = String(j.ask || ''), add = [], mult = [], red = !!(ev.main && ev.main.red);
  if (red && kind === 'heal') add.push([10, 'unblocks: main is red and this heals a check']);
  else if (UNBLOCK.test(ask)) add.push([red ? 9 : 6, 'unblocks: ' + (red ? 'main is red, ' : '') + 'it clears the merge path']);
  if (INCOME.test(ask) || kind === 'paid') add.push([8, 'income: it touches what Verse sells (the x402 services, the store)']);
  const sz = sizeOf(j, ev.size);
  if (sz) add.push([Math.max(2, 8 - Math.log10(1 + sz.controls) * 2), 'smallest first: ' + sz.host + ' has ' + sz.controls + ' control' + (sz.controls === 1 ? '' : 's')]);
  const rep = repeatOf(j, ev.done, now);
  if (rep) mult.push([0.1, rep]);
  if (red && kind === 'flake' && !(ev.main.checks || []).some((c) => ask.toLowerCase().includes(String(c).toLowerCase().slice(0, 40)))) mult.push([0.5, 'churn: a flaky test that is not what turned main red']);
  if (CHURN.test(ask) && !add.length) mult.push([0.5, 'churn: a cosmetic change with nothing measured behind it']);
  return { add, mult, busywork: rep };
}
