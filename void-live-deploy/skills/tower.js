/**
 * tower skill — Versus, the only-site-you-need ladder where Verse assimilates real sites: "versus", "verse versus", "which sites have you beaten"
 * open it, and "the tower", "verse tower" still do. The ladder is lib/tower.js. The site Verse is
 * on now at the top with each of its aspects, every conquered site under it, nothing above (the queue has no end). Each site is named in
 * plain text as a comparison (no logos or brand styling, no affiliation implied). A site is conquered only when every aspect is verified
 * better by a head-to-head check against the live site (tools/tower-gate.mjs, tower.evidence.json). Tapping a site shows N of M aspects
 * beaten, what Verse still loses on and what is unverified. Real data only: read from this site.
 */
import { tower, towerLine, towerArgs, fatalityOf, hostOf, learnedOf, easeLine } from '../lib/tower.js?v=ladder-66';
import { badgeText } from '../lib/gate-badge.js?v=ladder-55';
// each floor's gate badge (lib/gate-badge.js): [Gate: Code], [Gate: Partner] or [Gate: License], and a regulated floor's stage
const gateTag = (f, esc) => f.badge ? '<span class="tw-gate" title="' + esc(f.badge.why + (f.badge.stageWhy ? '; stage ' + f.badge.stage + ': ' + f.badge.stageWhy : '')) + '" style="font-size:11px;opacity:.8;margin-left:6px">' + esc(badgeText(f.badge)) + '</span>' : '';
import { faceSvg, verseFace } from '../lib/avatar.js';
import { bySize, sizeOf, rankLabel, words } from '../lib/tower-rank.js';
import { bytesLabel, weightBand } from '../lib/tower-weight.js';

// Versus (owner, 2026-10-25: "the tower rename is easy its versus"): "versus", "verse versus", "the versus", "show me versus" open it, and every
// ask that said "tower" still does
const ASK_RE = /^(?:(?:show|open)(?:\s+me)?\s+)?(?:the\s+|your\s+)?(?:verse(?:'s)?\s+)?(?:tower|versus)$|^(?:which|what)\s+sites\s+have\s+you\s+(?:beaten|surpassed|passed)$|^(?:the\s+)?surpassed(?:\s+sites)?$|^(?:the\s+)?conquered(?:\s+sites)?$|^who\s+(?:have\s+we|has\s+verse|did\s+(?:we|verse))\s+(?:beaten|beat|conquered|run\s+through)$/;
export const towerOf = (text) => ASK_RE.test(String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
const get = async (u) => { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? r.json() : null; } catch (_) { return null; } };

// The tower, plain (owner, 2026-10-24: "current target at the top, conquered sites stacked underneath, and nothing rendered above it"): the site
// Verse is on now, with each of its aspects and where it stands, and under it every site already conquered. The queue past the current site is
// not drawn: it has no end. The fight itself is a VS splash (owner, 2026-10-25: "each site and verse should have an avatar face for the battle";
// "something visual to hype it up"): Verse's atom-galaxy mark and the site's drawn fighter (lib/avatar.js: never its logo) face off across a
// slanted split, an energy bar under each (the aspects it is winning), and under the splash the matchup rows, one per aspect, with the measured
// numbers, when they were measured and what comes next (owner: "shows the matchup and how aware we are of what is happening").
const TW_CSS = '<style>.vpage:has(.tw) .vc-art{display:none}.tw{max-width:520px;margin:0 auto}.tw-head{text-align:center;font-weight:700;font-size:17px;margin:2px 0}'
  + '.tw-score{text-align:center;font-size:13px;opacity:.75;margin-bottom:8px}.tw-stack{overflow-y:auto;padding:2px}'
  + '.tw-stack .tower-floor{display:block;width:100%;text-align:left;margin:4px 0;padding:8px 10px;border:1px solid #3a3550;border-radius:6px;background:#14121b;color:#eee;font:inherit;cursor:pointer;overflow-wrap:anywhere}'
  + '.tw-name{font-weight:700}.tw-count{font-size:12px;opacity:.7;margin-left:6px}.tower-floor[data-state=current]{border-color:#c9b6ff;padding:10px 12px}.tower-floor[data-state=current] .tw-name{font-size:16px}'
  + '.tw-aspects{list-style:none;margin:6px 0 0;padding:0;font-size:13px}.tw-aspects li{display:flex;justify-content:space-between;gap:8px;padding:1px 0;border-bottom:1px solid #221e30}.tw-aspects li[data-v=won]{color:#8fe3a8}.tw-aspects li[data-v=lost]{color:#ff8a8a}.tw-aspects li[data-v=open]{opacity:.6}'
  + '.tw-say{opacity:.8;font-size:12px;margin-left:4px}.tw-num{white-space:nowrap;opacity:.9;font-variant-numeric:tabular-nums}.tw-meta{font-size:12px;opacity:.75;margin-top:5px}'
  + '.tower-floor[data-state=beaten]{opacity:.75}.tower-floor[data-state=beaten] .tw-name{text-decoration:line-through}.tw-face{display:inline-block;vertical-align:middle;margin-right:6px;line-height:0}.tw-face svg{width:24px;height:24px}'
  // the VS splash: Verse's corner violet, the challenger's crimson, a pale slanted split between them
  + '.tw-vs{position:relative;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;padding:10px 8px 8px;margin:4px 0 8px;border-radius:10px;overflow:hidden;border:1px solid #3a3550;background:linear-gradient(104deg,#2a1a4a 0 48.5%,#e9dcc0 48.5% 51.5%,#4a1420 51.5% 100%)}'
  + '.tw-side{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0}.tw-side svg{width:56px;height:56px}.tw-side.tw-v svg{filter:drop-shadow(0 0 7px rgba(190,140,255,.75))}.tw-side.tw-s svg{filter:drop-shadow(0 0 7px rgba(255,110,90,.65))}'
  + '.tw-who{font-weight:700;font-size:12px;text-align:center;overflow-wrap:anywhere;max-width:100%}.tw-bar{display:flex;gap:2px;width:100%;max-width:120px;height:6px}.tw-bar i{flex:1;border-radius:2px;background:#4a4658}.tw-bar i[data-k=v]{background:#a98bff;box-shadow:0 0 4px #a98bff}.tw-bar i[data-k=s]{background:#ff7a6a;box-shadow:0 0 4px #ff7a6a}.tw-bar-n{font-size:11px;opacity:.8}.tw-barnote{font-size:11px;opacity:.8;text-align:center;margin:4px 0 2px}'
  + '.tw-vsmark{font-weight:900;font-size:24px;font-style:italic;color:#fff;text-shadow:0 0 8px #ffd36a,0 0 18px #ff6a3d;letter-spacing:1px;padding:0 4px}'
  // the entrance: the two slide in from their corners, the VS pops, a flash fades (400 ms, once); none of it when motion is reduced
  + '.tw-in .tw-v{animation:tw-l .4s ease-out}.tw-in .tw-s{animation:tw-r .4s ease-out}.tw-in .tw-vsmark{animation:tw-pop .4s ease-out}.tw-in::after{content:"";position:absolute;inset:0;background:#fff;pointer-events:none;animation:tw-flash .4s ease-out forwards}'
  + '@keyframes tw-l{from{transform:translateX(-40px);opacity:0}}@keyframes tw-r{from{transform:translateX(40px);opacity:0}}@keyframes tw-pop{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.3)}100%{transform:scale(1)}}@keyframes tw-flash{from{opacity:.7}to{opacity:0}}'
  + '@media (prefers-reduced-motion:reduce){.tw-vs *,.tw-vs::after{animation:none!important}.tw-in::after{display:none}}</style>';
const MARK = { won: '✓', lost: '✗', open: '·' };
/** each aspect of a site and where Verse stands on it: won, lost or not measured yet. Pure. */
export const aspectRows = (f) => (f.aspects || []).map((a) => ({ a, v: f.lost.includes(a) ? 'lost' : f.left.includes(a) ? 'open' : 'won' }));
// the matchup, from the evidence rows the floor carries (lib/tower.js `ev`, written by tools/tower-gate.mjs): nothing measured here, nothing invented
const SAY = { better: 'won', 'equal-and-better': 'equal and better', equal: 'equal, not yet better', worse: 'lost' };
/** the measured numbers of one evidence row as "95 ms vs 132 ms" (the unit read off the gate's own wording), or '' when it has none. Pure. */
export function nums(r) {
  if (!r || !Number.isFinite(+r.verse) || !Number.isFinite(+r.best)) return '';
  const m = /^Verse(?: \([^)]*\))? -?[\d.]+( ms| px| of \d+| %)?/.exec(String(r.evidence || '')), u = m && m[1] ? m[1] : '';
  return r.verse + u + ' vs ' + r.best + u;
}
// a row the gate judged against its default bar because the site turned the gate away (tools/tower-gate.mjs "vs the bar (<site> unreachable)")
// is not a measure of the site (2026-10-29): the card says "default bar" on it and does not credit the site with it
export const onBar = (e) => !!e && / vs the bar \(/.test(String(e.evidence || ''));
const barSay = (e) => e.verdict === 'worse' ? 'below the default bar' : 'not measured: the site turned the gate away';
/** one row per aspect: where Verse stands (won / lost / open), the word for it, the numbers, when it was measured. Pure. */
export const matchRows = (f) => aspectRows(f).map((r) => {
  const e = (f.ev || {})[r.a], say = r.v === 'open' ? (e && SAY[e.verdict] && e.verdict !== 'worse' ? SAY[e.verdict] : 'not measured yet') : SAY[e && e.verdict] || r.v;
  return { ...r, say: onBar(e) ? barSay(e) : say, nums: nums(e), at: (e && e.at) || '', bar: onBar(e) };
});
/** when a floor was last measured: the newest `at` of its rows, or ''. Pure. */
export const lastAt = (f) => Object.values(f.ev || {}).map((r) => String((r && r.at) || '')).filter((s) => Number.isFinite(Date.parse(s))).sort().pop() || '';
/** a time in words: just now, 12 minutes ago, 3 hours ago, 2 days ago, else the date. Pure. */
export function ago(iso, now = Date.now()) {
  const t = Date.parse(iso); if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (now - t) / 1000), unit = (n, w) => n + ' ' + (n === 1 ? w : w + 's') + ' ago';
  if (s < 90) return 'just now'; if (s < 5400) return unit(Math.round(s / 60), 'minute'); if (s < 129600) return unit(Math.round(s / 3600), 'hour'); if (s < 1209600) return unit(Math.round(s / 86400), 'day');
  return 'on ' + new Date(t).toISOString().slice(0, 10);
}
/** the awareness line under the rows: when the floor was last measured and what comes next. Pure. */
export const metaLine = (f, now = Date.now()) => { const at = lastAt(f);
  return (at ? 'last measured ' + ago(at, now) : f.measured ? 'last measured: time not recorded' : 'not measured yet') + ' · next: ' + (f.lost && f.lost.length ? f.lost[0] + ' (Verse loses on it, so it comes first)' : 'the gate re-measures on the next deploy'); };
const siteSeed = (f) => hostOf(f.url) || hostOf(f.site) || String(f.site || f.id || '');
/** the site's fighter at a size, facing Verse. Pure. */
// the site's own logo (owner, 2026-10-25: "ive asked for the silly faces to be replaced by logos of the sites"): the icon the gate kept
// (tower.icons/), else the site's favicon from a favicon service by its host; the drawn fighter only if that picture will not load
export const logoUrl = (f) => (f && f.icon && /^tower\.icons\/[\w.-]+$/.test(f.icon) ? '/' + f.icon : 'https://www.google.com/s2/favicons?sz=128&domain=' + encodeURIComponent(siteSeed(f)));
// no faces, logos only (owner, 2026-10-25: "no faces logo only"): if no logo loads, the site's first letter on a plain disc
const letterDisc = (f, size) => '<span style="display:inline-grid;place-items:center;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:#fff;color:#15131c;font:700 ' + Math.round(size * 0.5) + 'px system-ui,sans-serif">' + String(siteSeed(f) || '?').charAt(0).toUpperCase() + '</span>';
export const siteFace = (f, size = 56) => '<span class="tw-logo-wrap" style="display:inline-block;width:' + size + 'px;height:' + size + 'px;line-height:0;vertical-align:middle"><img class="tw-logo" src="' + logoUrl(f) + '" alt="" width="' + size + '" height="' + size + '" loading="lazy" referrerpolicy="no-referrer" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:contain;background:#fff;padding:' + Math.round(size / 8) + 'px;box-sizing:border-box" onerror="this.outerHTML=this.dataset.fb" data-fb="' + letterDisc(f, size).replace(/"/g, '&quot;') + '"></span>';
/** the VS splash for the current fight: Verse's mark left, the site's fighter right, names in plain text under them, an energy bar each (Verse's
 *  lit by the aspects it has won or is equal-and-better on, the site's by the aspects Verse still loses, the unmeasured grey). Pure. */
export function vsHtml(f, esc, { enter = true } = {}) {
  const m = Math.max(1, f.m || 0), n = Math.max(0, f.n || 0), ev = f.ev || {};
  // the site's side counts only what was measured on the site; a loss against the default bar is Verse short of the bar, not the site ahead
  const lost = (f.lost || []).filter((a) => !onBar(ev[a])).length, onB = (f.aspects || []).filter((a) => onBar(ev[a])).length;
  const note = onB ? onB + ' of ' + m + ' aspects are not measured: ' + f.site + ' turned the gate away, so they are not counted for either side' : '';
  const bar = (k, lit) => '<span class="tw-bar" aria-hidden="true">' + Array.from({ length: m }, (_, i) => '<i' + (i < lit ? ' data-k="' + k + '"' : '') + '></i>').join('') + '</span>';
  return '<div class="tw-vs' + (enter ? ' tw-in' : '') + '" role="group" aria-label="' + esc('Verse versus ' + f.site + ': Verse ahead on ' + n + ' of ' + m + ' aspects, ' + f.site + ' on ' + lost + (note ? '; ' + note : '')) + '">'
    + '<div class="tw-side tw-v">' + '<img class="tw-logo" src="/verse-logo.webp" alt="" width="56" height="56" style="width:56px;height:56px;border-radius:50%">' + '<span class="tw-who">Verse</span>' + bar('v', n) + '<span class="tw-bar-n">' + n + ' of ' + m + '</span></div>'
    + '<div class="tw-vsmark" aria-hidden="true">VS</div>'
    + '<div class="tw-side tw-s">' + siteFace(f, 56) + '<span class="tw-who">' + esc(f.site) + '</span>' + bar('s', lost) + '<span class="tw-bar-n">' + lost + ' of ' + m + '</span></div></div>'
    + (note ? '<div class="tw-barnote">' + esc(note) + '</div>' : '');
}
/** the awareness rows: one per aspect (the verdict in a word, the measured numbers), then when it was measured and what is next. Pure. */
const rowsHtml = (f, esc, now) => '<ul class="tw-aspects">' + matchRows(f).map((r) => '<li data-v="' + r.v + '"><span>' + MARK[r.v] + ' ' + esc(r.a) + '<span class="tw-say' + (r.say === 'not measured yet' ? ' tw-nm' : '') + '">' + esc(r.say) + '</span></span>' + (r.nums ? '<span class="tw-num">' + esc(r.nums) + '</span>' : '') + '</li>').join('') + '</ul>'
  + '<div class="tw-meta">' + esc(metaLine(f, now)) + '</div>';
/** the whole matchup on its own, for a page outside the card (/compare/): the splash, the rows and the awareness line, with the styles. Pure. */
export const matchupHtml = (f, esc, { enter = true, now = Date.now() } = {}) => TW_CSS + '<div class="tw">' + vsHtml(f, esc, { enter }) + rowsHtml(f, esc, now) + '</div>';
/** the stack scrolled to its top, where the current site is (call after drawing). */
export function centerOnYou(root) { const stack = root && root.querySelector('.tw-stack'); if (stack) stack.scrollTop = 0; }
/** the floors as Versus in 3D wants them (skills/mini/tower.js): id, site, state, n of m, Verse's page. Pure. */
export const miniFloors = (t) => t.floors.map((f) => ({ id: f.id, site: f.site, state: f.state, n: f.n, m: f.m, page: f.page ? f.page.replace(/\?.*$/, '') : '' }));
// Versus by size (owner, 2026-10-26): each row says how big the site is (its place among the million most visited, tools/tower-rank.mjs), and
// "By size" lists every site smallest first (unranked, then the biggest rank number down to the leaders), the order a builder should take them in
const SIZE_CSS = '<style>.tw-stack .tower-floor[data-state=current]>.tw-size{display:none}.tw-sort{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:2px 0 6px;min-height:44px}.tw-sortbtn{min-height:44px;padding:0 14px;border:1px solid #3a3550;border-radius:6px;background:#14121b;color:#eee;font:inherit;cursor:pointer}.tw-sortbtn[aria-pressed=true]{border-color:#c9b6ff;background:#2a1a4a}'
  + '.tw-sortnote{font-size:12px;opacity:.7;flex:1 1 200px}.tw-sizelist .tw-size,.tw-sizelist .tw-count{margin-left:0;white-space:nowrap}.tw-size{font-size:12px;opacity:.85;margin-left:6px;font-variant-numeric:tabular-nums;white-space:nowrap}.tw-sizelist{list-style:none;margin:0;padding:0}.tw-sizelist li{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;padding:6px 8px;border-bottom:1px solid #221e30;overflow-wrap:anywhere}.tw-sizelist li[data-state=beaten] .tw-name{text-decoration:line-through;opacity:.75}.tw-sizelist li[data-state=current]{border-left:3px solid #c9b6ff}.tw-sizelist .tw-sidebyside,.tw-sizelist .tw-page{margin-left:8px;font-size:12px}</style>';
const prefStore = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { return null; } };
const SORT_KEY = 'a2m.void.tower.bysize';
/** the remembered choice of the "By size" view (default off), never throwing. */
export const readBySize = () => { try { const s = prefStore(); return !!s && s.getItem(SORT_KEY) === '1'; } catch (_) { return false; } };
export const saveBySize = (on) => { try { const s = prefStore(); if (s) s.setItem(SORT_KEY, on ? '1' : '0'); } catch (_) { /* private window or blocked storage: the choice just is not kept */ } };
const pageLang = () => { try { return (typeof document !== 'undefined' && document.documentElement.lang) || (typeof navigator !== 'undefined' && navigator.language) || 'en'; } catch (_) { return 'en'; } };
/** the "By size" list: every site, smallest first, with its size and where it stands. Pure. */
/** an entry's own Verse page as a link ("Verse's page /flights/"), or "no Verse page yet" when it has none. Pure. */
export const pageLink = (f, esc) => (f && f.page ? '<a class="tw-page" href="' + esc(f.page) + '">Verse\'s page ' + esc(String(f.page).replace(/\?.*$/, '')) + '</a>' : '<span class="tw-page tw-nopage">no Verse page yet</span>');
export function sizeListHtml(t, esc, lang = 'en') {
  const rk = t.rank || {}, w = words(lang), ranks = rk.ranks || {}, order = rk.order || {};
  return '<ol class="tw-sizelist" aria-label="' + esc(w.bySizeOn) + '">' + bySize(t.floors, ranks, order).map((f) => '<li data-id="' + esc(f.id) + '" data-state="' + f.state + '"><span class="tw-name">' + esc(f.site) + '</span><span class="tw-size" title="' + esc(w.rank + (order[f.id] != null ? ' (' + w.hand + ')' : '')) + '">' + esc(rankLabel(sizeOf(f.id, ranks, order), lang)) + '</span>'
    + '<span class="tw-count">' + esc(f.state === 'beaten' ? 'surpassed' : 'Verse ahead on ' + f.n + ' of ' + f.m + ' aspects') + '</span>' + gateTag(f, esc) + pageLink(f, esc) + '<a class="tw-sidebyside" href="/compare/?floor=' + esc(encodeURIComponent(f.id)) + '">side by side</a></li>').join('') + '</ol>';
}
/** the plan block (tower.plan.json, made by tools/tower-plan.mjs from the tower-plan block in docs/NEXT.md; owner, 2026-10-28: "move backwards
 *  to easier sites"): what is worked on now, the next easiest floors and the far-future ones, each joined with the gate's own numbers from
 *  tower() so the card never says more than the evidence. A floor the plan names that the tower does not know is left out. Pure. */
export function planOf(t, plan) {
  if (!plan || !t || !t.floors) return null;
  const by = new Map(t.floors.map((f) => [f.id, f]));
  const pickRows = (list) => (Array.isArray(list) ? list : []).map((x) => (x && by.get(x.id) ? { f: by.get(x.id), why: String(x.why || '') } : null)).filter(Boolean);
  const out = { now: pickRows(plan.now), next: pickRows(plan.next), far: pickRows(plan.far), skipped: (Array.isArray(plan.skipped) ? plan.skipped : []).filter((x) => x && x.site) };
  return out.now.length || out.next.length || out.far.length ? out : null;
}
const planCount = (f) => (f.state === 'beaten' ? 'surpassed' : 'Verse ahead on ' + f.n + ' of ' + f.m + ' aspects · not beaten yet');
export function planHtml(p, esc) {
  if (!p) return '';
  const li = (r, i) => '<li data-id="' + esc(r.f.id) + '" data-state="' + esc(r.f.state) + '" style="margin:1px 0">' + (i != null ? '<b>' + (i + 1) + '.</b> ' : '') + '<span class="tw-name">' + esc(r.f.site) + '</span> <span class="tw-plan-id" style="opacity:.75">(' + esc(r.f.id) + ')</span> · <span class="tw-count">' + esc(planCount(r.f)) + '</span>' + (r.f.page ? ' · <a href="' + esc(r.f.page) + '">Verse\'s page</a>' : '') + '</li>';
  const block = (cls, head, rows, numbered) => rows.length ? '<div class="' + cls + '"><p style="margin:8px 0 2px;font-size:13px"><b>' + esc(head) + '</b></p><ul style="margin:0;padding-left:18px;font-size:13px;list-style:' + (numbered ? 'none' : 'disc') + '">' + rows.map((r, i) => li(r, numbered ? i : null)).join('') + '</ul></div>' : '';
  return '<div class="tw-plan" style="margin:6px 0 8px">'
    + block('tw-plan-now', 'Working on now', p.now, false)
    + block('tw-plan-next', 'Next easiest (' + p.next.length + ')', p.next, true)
    + block('tw-plan-far', 'Far future, not beaten', p.far, false)
    + (p.skipped.length ? '<p class="tw-plan-skip" style="margin:4px 0 0;font-size:12px;opacity:.75">Skipped: ' + p.skipped.map((x) => esc(x.site) + (x.why ? ' (' + esc(x.why) + ')' : '')).join('; ') + '</p>' : '')
    + '<p style="margin:4px 0 0;font-size:11px;opacity:.65">The order comes from docs/NEXT.md; the counts come from the gate. A floor is surpassed only on scripted journeys with negative controls.</p></div>';
}
// the card's layout: the target first and big, its weight as chips, the fight, the aspects as a
// compact grid of won / lost / open, three actions, what is up next, the honest surpassed count, and the long takes folded away
const GOOD_CSS = '<style>.tw-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:2px 0 2px}.tw-top .tw-head{margin:0;text-align:left;font-size:20px}'
  + '.tw-pill{font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:#2a2340;border:1px solid #4a3f6b;color:#d9ccff;white-space:nowrap}'
  + '.tw-hero{margin:8px 0;padding:12px;border:1px solid #5b4a8a;border-radius:12px;background:linear-gradient(160deg,#1d1730,#14121b)}.tw-hero-k{font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.65;margin-bottom:6px}'
  + '.tw-hero-row{display:flex;align-items:center;gap:10px;min-width:0}.tw-hero-name{font-size:20px;font-weight:800;overflow-wrap:anywhere;line-height:1.15}.tw-hero-name a{color:inherit;text-decoration:none;border-bottom:1px dotted #8a7cc0}'
  + '.tw-chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 2px}.tw-chip{font-size:12px;padding:3px 9px;border-radius:999px;background:#241f35;border:1px solid #3a3550;font-variant-numeric:tabular-nums}.tw-chip b{font-weight:800}.tw-chip[data-band="0"]{background:#1d3a2a;border-color:#3f7a58;color:#a6f0c0}.tw-chip[data-band="3"]{background:#3a1d1d;border-color:#7a3f3f;color:#ffb3b3}'
  + '.tw-why{margin:8px 0 0;font-size:12px;line-height:1.4;opacity:.78}'
  + '.tw-stack .tower-floor[data-state=current]{background:transparent;border:0;padding:0;margin:6px 0 0}.tw-stack .tower-floor[data-state=current]>.tw-name,.tw-stack .tower-floor[data-state=current]>.tw-count,.tw-stack .tower-floor[data-state=current]>.tw-gate{display:none}'
  + '.tw-stack .tower-floor[data-state=current] .tw-aspects{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:0}.tw-stack .tower-floor[data-state=current] .tw-aspects li{display:block;border:1px solid #2e2942;border-radius:8px;padding:6px 8px;background:#15121f;line-height:1.3;word-break:break-word}'
  + '.tw-stack .tower-floor[data-state=current] .tw-aspects li[data-v=won]{border-color:#2f6b49;background:#12241b}.tw-stack .tower-floor[data-state=current] .tw-aspects li[data-v=lost]{border-color:#7a3f3f;background:#2a1414}'
  + '.tw-stack .tower-floor[data-state=current] .tw-aspects .tw-say{display:block;margin:2px 0 0}.tw-stack .tower-floor[data-state=current] .tw-aspects .tw-num{display:block;margin-top:1px;font-size:11px;white-space:normal}.tw-stack .tower-floor[data-state=current] .tw-meta{margin-top:8px;text-align:center}'
  + '.tw-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.tw-act{flex:1 1 120px;min-height:44px;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 12px;border-radius:10px;border:1px solid #5b4a8a;background:#241f3b;color:#eee;text-decoration:none;font-size:14px;font-weight:600}.tw-act[data-main]{background:#5b3fd0;border-color:#7d63f0}.tw-act[aria-disabled=true]{opacity:.5}'
  + '.tw-next{margin:6px 0 8px}.tw-next ol{list-style:none;margin:4px 0 0;padding:0}.tw-next li{display:flex;justify-content:space-between;gap:8px;padding:6px 8px;border-bottom:1px solid #221e30;font-size:13px}.tw-next li span:last-child{opacity:.7;white-space:nowrap;font-variant-numeric:tabular-nums}'
  + '.tw-empty{margin:6px 0;padding:10px;border:1px dashed #3a3550;border-radius:8px;font-size:13px;opacity:.8}.tw-fold{margin:8px 0;border:1px solid #2e2942;border-radius:8px;padding:2px 10px}.tw-fold>summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:700;font-size:14px}.tw-fold[open]>summary{border-bottom:1px solid #2e2942;margin-bottom:6px}'
  + '.tw-stack .tower-floor[data-state=current] .tw-aspects li[data-v=open]{padding:7px 8px}.tw-stack .tower-floor[data-state=current] .tw-aspects .tw-nm{display:none}'
  + '</style>';
const bandOf = (f) => (f.weight === null || f.weight === undefined ? null : weightBand(f.weight));
/** the target's weight as chips: size, scripts, elements, routes; "not weighed yet" when nothing measured it. Pure. */
export function chipsHtml(f, esc) {
  if (!f.size || f.weight === null || f.weight === undefined) return '<div class="tw-chips"><span class="tw-chip">not weighed yet</span></div>';
  const b = bandOf(f), band = ['1 KB club', 'light', 'medium', 'heavy'][b], plural = (n, w) => '<b>' + n + '</b> ' + w + (n === 1 ? '' : 's');
  return '<div class="tw-chips" title="' + esc('weight = bytes + 2000 per script + 10 per element + 500 per route (lib/tower-weight.js)') + '"><span class="tw-chip" data-band="' + b + '"><b>' + esc(bytesLabel(f.size.bytes)) + '</b> · ' + band + '</span><span class="tw-chip">' + plural(f.size.scripts, 'script') + '</span><span class="tw-chip">' + plural(f.size.nodes, 'element') + '</span><span class="tw-chip">' + plural(f.size.routes, 'route') + '</span></div>';
}
/** the target at the top: its logo and name (a link to the site), its weight, and why it is the one. Pure. */
export function heroHtml(f, esc) {
  return '<div class="tw-hero" data-id="' + esc(f.id) + '"><div class="tw-hero-k">Now assimilating · the easiest site left</div><div class="tw-hero-row">' + siteFace(f, 44) + '<div class="tw-hero-name">' + (f.url ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener noreferrer">' + esc(f.site) + ' ↗</a>' : esc(f.site)) + '</div></div>'
    + chipsHtml(f, esc) + '<p class="tw-why">' + esc('Why this one: ' + easeLine(f) + '.') + '</p></div>';
}
/** three actions for the target: Verse's page (or that it has none yet), side by side, the site itself. Pure. */
export function actionsHtml(f, esc) {
  return '<div class="tw-actions" data-share-skip>' + (f.page ? '<a class="tw-act" data-main href="' + esc(f.page) + '">Open Verse\'s page</a>' : '<span class="tw-act" aria-disabled="true">No Verse page yet</span>')
    + '<a class="tw-act" href="/compare/?floor=' + esc(encodeURIComponent(f.id)) + '">Side by side</a>' + (f.url ? '<a class="tw-act" href="' + esc(f.url) + '" target="_blank" rel="noopener noreferrer">Visit ↗</a>' : '') + '</div>';
}
/** the next easiest sites after the target, from the same order that picks the target (lib/tower.js: size tier, then work left, then a page first). Pure. */
export function nextHtml(t, esc, n = 3) {
  const rows = t.floors.filter((f) => f.state === 'ahead' && !f.defer && !f.farFuture).slice(0, n);
  return rows.length ? '<div class="tw-next" data-share-skip><b style="font-size:13px">Up next</b><ol>' + rows.map((f) => '<li data-id="' + esc(f.id) + '"><span class="tw-name">' + esc(f.site) + '</span><span>' + esc(f.weight !== null && f.size ? bytesLabel(f.size.bytes) + ' · ' : 'not weighed · ') + esc(f.n + ' of ' + f.m + (f.page ? '' : ' · no page')) + '</span></li>').join('') + '</ol></div>' : '';
}
export function towerHtml(t, esc, { mini = false, enter = true, now = Date.now(), bySize: bs = false, lang = pageLang() } = {}) {
  const rk = t.rank || null, ranks = (rk && rk.ranks) || {}, order = (rk && rk.order) || {}, w = words(lang), on = !!(rk && bs);
  const sizeTag = (f) => rk ? '<span class="tw-size" title="' + esc(w.rank) + '">' + esc(rankLabel(sizeOf(f.id, ranks, order), lang)) + '</span>' : '';
  const plan = planOf(t, t.plan);
  const cur = t.floors.find((f) => f.state === 'current'), won = t.floors.filter((f) => f.state === 'beaten').reverse(); // the newest conquest right under the current site
  // the current site's row is the matchup: one line per aspect with the verdict in a word and the measured numbers, then when and what is next
  // a surpassed site's row is a div, not a button, so a copied or saved card keeps it (lib/card-share.js leaves buttons out; owner, 2026-10-25: "theres no way to see the 24 surpassed")
  const row = (f) => (f.state === 'beaten' ? '<div class="tower-floor" role="button" tabindex="0" data-id="' + esc(f.id) + '" data-floor="' + f.floor + '" data-state="beaten">' : '<button class="tower-floor" data-id="' + esc(f.id) + '" data-floor="' + f.floor + '" data-state="' + f.state + '">')
    + (f.state === 'beaten' ? '<span class="tw-face">' + siteFace(f, 24) + '</span>' : '')
    + '<span class="tw-name">' + esc(f.site) + '</span><span class="tw-count">' + esc(f.state === 'beaten' ? 'surpassed' : 'Verse ahead on ' + f.n + ' of ' + f.m + ' aspects') + '</span>' + sizeTag(f) + gateTag(f, esc)
    + (f.state === 'current' ? rowsHtml(f, esc, now) : '') + (f.state === 'beaten' ? '</div>' : '</button>');
  // the site and Verse's own page side by side (owner, 2026-10-25: "its ok for Verse to have links to the site its going against as well as links to its
  // own version for easy side by side compare"): one line under each floor, the site in a new tab, Verse's page in this one
  // every entry names its own Verse page (owner, 2026-10-26: "every site needs a page for side by side"): the page the gate measures it against
  // (lib/tower.js `page`, the same page /compare/ opens beside the site), or, plainly, that it has none yet
  const links = (f) => '<div class="tw-links"' + (f.state === 'beaten' ? '' : ' data-share-skip') + ' style="display:flex;flex-wrap:wrap;gap:4px 10px;margin:-2px 0 6px 10px;font-size:12px;opacity:.85">'
    + (f.url ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener noreferrer">' + esc(f.site) + ' ↗</a>' : '') + pageLink(f, esc)
    + '<a href="/compare/?floor=' + esc(encodeURIComponent(f.id)) + '">side by side</a></div>';
  // the fight in words for a saved or copied card (lib/card-share.js leaves buttons out, and the aspect list is inside the floor's button):
  // hidden from sight and from screen readers, who have the list itself
  const fight = cur ? 'Verse is ahead of ' + cur.site + ' on ' + cur.n + ' of ' + cur.m + ' aspects.' + (cur.left.length ? ' Still to pass: ' + cur.left.join(', ') + '.' : '') + (won.length ? ' Surpassed: ' + won.map((f) => f.site).join(', ') + '.' : '') : '';
  const sortBar = rk ? '<div class="tw-sort" data-share-skip><button type="button" class="tw-sortbtn" aria-pressed="' + on + '" title="' + esc(w.note) + '">' + esc(w.bySize) + '</button>' + (on ? '<span class="tw-sortnote">' + esc(w.note) + '</span>' : '') + '</div>' : '';
  const lastRow = '<div class="tw-sortrow" data-share-skip style="display:flex;justify-content:space-between;align-items:center;gap:8px">' + (rk ? '<button type="button" class="tw-sortbtn" aria-pressed="' + on + '" title="' + esc(w.note) + '">' + esc(w.bySize) + '</button>' + (on ? '<span class="tw-sortnote">' + esc(w.note) + '</span>' : '') : '') + '</div>';
  const empty = '<div class="tw-empty">Nothing surpassed yet. A site counts only when Verse is better than it on every aspect, checked head to head and by scripted journeys.</div>';
  return TW_CSS + GOOD_CSS + (rk ? SIZE_CSS : '') + '<div class="tw"><div class="tw-top"><div class="tw-head">Versus</div></div>'
    + '<div class="tw-score tower-line">' + esc(t.beaten + ' surpassed' + (cur ? ' · easiest site left: ' + cur.site : '')) + '</div>'
    + (cur && !on ? heroHtml(cur, esc) : '') + (cur ? vsHtml(cur, esc, { enter }) : '')
    + (mini ? '<div class="tw-mini" data-share-skip style="height:' + (typeof innerWidth === 'number' && Math.min(innerWidth, innerHeight) < 560 ? 200 : 240) + 'px;margin:8px 0 4px"></div>' : '')
    + (fight ? '<div class="tw-fight" aria-hidden="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">' + esc(fight) + '</div>' : '')
    + '<div class="tw-stack tower-stack">' + (on ? sizeListHtml(t, esc, lang) : '') + (on ? '' : cur ? row(cur) : '') + '</div>'
    + (on || !cur ? '' : actionsHtml(cur, esc)) + (on ? '' : nextHtml(t, esc))
    + (on ? '' : '<div class="tw-won"><p class="tw-wonhead" style="margin:8px 0 2px;font-size:13px"><b>Surpassed (' + won.length + ')</b></p>' + (won.length ? won.map((f) => row(f) + links(f)).join('') : empty) + '</div>')
    + takeHtml(t, esc) + lastRow
    + '<div class="src" style="opacity:.7;font-size:.85em">Sites are named in plain text only as a comparison; Verse is not affiliated with any of them. <a href="/conquered/" target="_blank" rel="noopener">Full screen</a></div></div>';
}
/** Verse's take, from what is measured and what was built, never invented (owner, 2026-10-24: a take on the current opponent, and "include its
 *  take on what its learned and absorbed from all the fights so far"): the fight now (its page, what it leads on, what is left, the killshot)
 *  and one line per conquered site from the floor's `learned`. { now, learned: [{ site, text }] }. Pure. */
export function verseTake(t) {
  const cur = t.floors.find((f) => f.state === 'current'), won = t.floors.filter((f) => f.state === 'beaten' && (learnedOf(f) || fatalityOf(f))).reverse(); // every conquest: its written lesson, else the gate's own numbers (learnedOf), else its killshot
  let now = '';
  if (cur) {
    const lead = cur.aspects.filter((a) => !cur.left.includes(a)), open = cur.left.filter((a) => !cur.lost.includes(a));
    now = (cur.page ? 'My page for ' + cur.site + ' is a-to-mind.com' + cur.page.replace(/\?.*$/, '') + '. ' : 'I answer ' + cur.site + '\'s job on the stage; it has no page of mine yet. ')
      + (lead.length ? 'I lead on ' + lead.join(', ') + '. ' : 'Nothing is measured in my favour yet. ')
      + (cur.lost.length ? 'I lose on ' + cur.lost.join(', ') + ', so that comes first. ' : '') + (open.length ? 'Still to prove: ' + open.join(', ') + '.' : '')
      + (fatalityOf(cur) ? ' The edge I am building: ' + fatalityOf(cur) + '.' : '');
  }
  return { now, learned: won.map((f) => ({ site: f.site, text: learnedOf(f) || 'Verse\'s edge: ' + fatalityOf(f) })) };
}
const takeHtml = (t, esc) => { const k = verseTake(t); if (!k.now && !k.learned.length) return '';
  return (k.now ? '<details class="tw-fold tw-take"><summary>Verse\'s take</summary><p style="margin:4px 0 8px;font-size:13px;line-height:1.45">' + esc(k.now) + '</p></details>' : '')
    + (k.learned.length ? '<details class="tw-fold tw-learned"><summary>What each site taught me (' + k.learned.length + ')</summary><ul style="margin:0 0 8px;padding-left:18px;font-size:13px;line-height:1.45">' + k.learned.map((x) => '<li><i>' + esc(x.site) + '</i>: ' + esc(x.text) + '</li>').join('') + '</ul></details>' : ''); };
export function detailText(f) {
  // only what is true and measured: the beaten count, Verse's own page for the job, what it loses on, and what nobody has measured yet
  const open = f.left.filter((a) => !f.lost.includes(a));
  return f.n + ' of ' + f.m + ' aspects ahead of ' + f.site + '. ' + (f.page ? 'Verse\'s page for it: a-to-mind.com' + f.page.replace(/\?.*$/, '') + '. ' : '')
    + (f.lost.length ? 'Loses on: ' + f.lost.join(', ') + '. ' : '') + (open.length ? 'Not measured yet: ' + open.join(', ') + '. ' : 'Ahead on every aspect. ') + (fatalityOf(f) ? 'Verse\'s edge: ' + fatalityOf(f) + '.' : '');
}

/** what moved between two towers, in words: the marker, a beaten floor, an aspect count. Pure. */
export function changes(prev, next) {
  const out = [];
  if (!prev || !next) return out;
  const now = (t) => (t.floors.find((f) => f.state === 'current') || {}).site;
  if (now(next) !== now(prev) && now(next)) out.push('Now: ' + now(next) + '.');
  for (const f of next.floors) {
    const was = prev.floors.find((x) => x.id === f.id); if (!was) continue;
    if (f.beaten && !was.beaten) out.push(f.site + ' is surpassed.');
    else if (was.beaten && !f.beaten) out.push(f.site + ' slipped.');
    else if (f.n !== was.n) out.push(f.site + ': ' + f.n + ' of ' + f.m + ' aspects.');
  }
  return out;
}
const POLL_MS = () => (typeof window !== 'undefined' && window.__towerPollMs) || 30000;
/** the sites the evidence file names that this (older) copy of the page does not know: a newer Verse is live (owner, 2026-10-25: a tab opened
 *  before the lanes landed kept saying 18 surpassed while the file said 30). Pure. */
export const staleOf = (evidence, t) => { const ids = new Set((t && t.floors || []).map((f) => f.id)); return Object.keys((evidence && evidence.floors) || {}).filter((k) => !ids.has(k)).length; };
let stale = 0;
// a card that is open for hours reads data newer than the code it was loaded with: when the data names a site this copy does not know, the
// card fetches the current ladder itself (a fresh import, never the cached one) and carries on; a site neither copy knows was retired, and
// is ignored. No "reload" notice: the card is live, so it heals instead of asking (owner, 2026-10-26: "it doesnt refresh when reloaded ... it a live card").
let fresh = null;
const freshTower = async () => { try { return fresh || (fresh = await import('../lib/tower.js?fresh=' + Math.floor(Date.now() / 300000))); } catch (_) { return null; } };
const load = async () => { const [inv, ev, fr, rk, pl, sz, tg] = await Promise.all([get('/lap.items.json'), get('/tower.evidence.json'), get('/tower.frontier.json'), get('/tower.rank.json'), get('/tower.plan.json'), get('/tower.size.json'), get('/tower.target.json')]); const args = towerArgs((inv && inv.onlySite) || [], { ev, fr, rk, sz, tg }); let t = tower(...args); stale = staleOf(ev, t); if (stale) { const m = await freshTower(); if (m && m.tower) { t = m.tower(...args); stale = staleOf(ev, t); } } t.rank = (rk && rk.list && rk.ranks) ? rk : null; t.plan = pl && Array.isArray(pl.next) ? pl : null; return t; };

async function run(text, api) {
  if (!towerOf(text)) return 'none';
  const { showPage, esc, say } = api;
  let t = await load(), timer = null, onVis = null;
  const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  showPage((el) => {
    el.classList.add('tower-card');
    el.innerHTML = '<div class="tw-root"></div><div class="tw-live" data-share-skip aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"></div><div class="tw-updated" style="text-align:center;font-size:11px;opacity:.55;margin-top:6px"></div>';
    const root = el.querySelector('.tw-root'), live = el.querySelector('.tw-live'), stamp = el.querySelector('.tw-updated');
    let bySizeOn = readBySize(), picked = 0, shown = false, mini = !!(api.stage && api.stage.miniature);
    const miniKey = 'tower:' + Date.now().toString(36);
    const pick = (f) => { if (!f) return; picked = f.floor; const det = root.querySelector('.tower-detail'); if (det) det.textContent = detailText(f); };
    const draw = (flash) => {
      const keep = root.querySelector('.mk-stack'), was = keep ? keep.scrollTop : -1; // a redraw keeps where the person scrolled to; the first draw centres on the fight
      root.innerHTML = towerHtml(t, esc, { mini, enter: !root.dataset.drawn, bySize: bySizeOn }); root.dataset.drawn = '1'; stamp.textContent = 'updated ' + clock(); // the VS entrance plays on the first paint only
      if (was >= 0) root.querySelector('.mk-stack').scrollTop = was; else { centerOnYou(root); setTimeout(() => centerOnYou(root), 80); } // again once the card has its size
      if (picked) { const f = t.floors.find((x) => x.floor === picked); if (f) root.querySelector('.tower-detail').textContent = detailText(f); }
      // Versus in 3D (skills/mini/tower.js): the same key moves the live one into the fresh host and hands it the new floors; tapping a floor picks it
      const host = root.querySelector('.tw-mini');
      if (host) api.stage.miniature(host, 'tower', { floors: miniFloors(t), onFloor: (id) => pick(t.floors.find((x) => x.id === id)) }, { key: miniKey, label: 'Versus in 3D: ' + t.beaten + ' floors surpassed; tap a floor to read it; drag to look around', ground: 'none' })
        .catch(() => { mini = false; host.remove(); });
      (flash || []).forEach((id) => { const b = root.querySelector('[data-id="' + id + '"]'); if (b && b.animate) b.animate([{ background: '#6a3d9a' }, { background: '' }], 1800); });
    };
    el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.tower-floor[role=button]')) { e.preventDefault(); e.target.closest('.tower-floor').click(); } });
    el.addEventListener('click', (e) => { const sb = e.target.closest('.tw-sortbtn'); if (sb) { bySizeOn = !bySizeOn; saveBySize(bySizeOn); draw(); const nb = root.querySelector('.tw-sortbtn'); if (nb) nb.focus(); return; } const b = e.target.closest('.tower-floor'); if (!b) return; picked = +b.dataset.floor; const f = t.floors.find((x) => x.floor === picked); if (f) root.querySelector('.tower-detail').textContent = detailText(f); });
    draw();
    const stop = () => { if (timer) clearInterval(timer); timer = null; if (onVis) document.removeEventListener('visibilitychange', onVis); };
    const refresh = async () => {
      if (el.classList.contains('on')) shown = true; else if (shown || !el.isConnected) return stop(); // closed: the page drops 'on', then leaves
      if (document.visibilityState === 'hidden') return; // a hidden tab waits; coming back refreshes at once
      const next = await load(), moved = changes(t, next);
      t = next;
      draw(next.floors.filter((f) => moved.some((m) => m.startsWith(f.site))).map((f) => f.id));
      if (moved.length) live.textContent = moved.join(' ');
    };
    timer = setInterval(refresh, POLL_MS());
    onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
  });
  if (say) say(towerLine(t));
  return 'tower';
}

export default {
  name: 'tower',
  about: 'Versus: real sites as floors, and how many aspects of each Verse has verified it beats.',
  examples: ['versus', 'verse versus', 'the versus', 'show me versus', 'the tower', 'verse tower', 'which sites have you surpassed', 'show the tower', 'open your tower'],
  nearMisses: ['eiffel tower', 'tower of hanoi', 'how tall is the tower', 'tower defense game', 'cell tower near me', 'cats versus dogs', 'verse versus google'],
  match(lower, text) { return towerOf(text || lower); },
  run, towerOf, towerHtml, nextHtml, planOf, planHtml, detailText, changes, verseTake, vsHtml, matchupHtml, matchRows, metaLine,
};
