/**
 * tower skill — Versus, the only-site-you-need ladder where Verse fights real sites: "versus", "verse versus", "which sites have you beaten"
 * open it, and "the tower", "verse tower" still do. The ladder is lib/tower.js. The site Verse is
 * on now at the top with each of its aspects, every conquered site under it, nothing above (the queue has no end). Each site is named in
 * plain text as a comparison (no logos or brand styling, no affiliation implied). A site is conquered only when every aspect is verified
 * better by a head-to-head check against the live site (tools/tower-gate.mjs, tower.evidence.json). Tapping a site shows N of M aspects
 * beaten, what Verse still loses on and what is unverified. Real data only: read from this site.
 */
import { tower, towerLine, fatalityOf, hostOf, learnedOf } from '../lib/tower.js?v=ladder-50';
import { faceSvg, verseFace } from '../lib/avatar.js';

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
  + '.tw-who{font-weight:700;font-size:12px;text-align:center;overflow-wrap:anywhere;max-width:100%}.tw-bar{display:flex;gap:2px;width:100%;max-width:120px;height:6px}.tw-bar i{flex:1;border-radius:2px;background:#4a4658}.tw-bar i[data-k=v]{background:#a98bff;box-shadow:0 0 4px #a98bff}.tw-bar i[data-k=s]{background:#ff7a6a;box-shadow:0 0 4px #ff7a6a}.tw-bar-n{font-size:11px;opacity:.8}'
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
/** one row per aspect: where Verse stands (won / lost / open), the word for it, the numbers, when it was measured. Pure. */
export const matchRows = (f) => aspectRows(f).map((r) => { const e = (f.ev || {})[r.a]; return { ...r, say: r.v === 'open' ? (e && SAY[e.verdict] && e.verdict !== 'worse' ? SAY[e.verdict] : 'not measured yet') : SAY[e && e.verdict] || r.v, nums: nums(e), at: (e && e.at) || '' }; });
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
export const siteFace = (f, size = 56) => (f && f.icon && /^tower\.icons\/[\w.-]+$/.test(f.icon) ? '<img class="tw-logo" src="/' + f.icon + '" alt="" width="' + size + '" height="' + size + '" loading="lazy" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:contain;background:#fff;padding:' + Math.round(size / 10) + 'px;box-sizing:border-box">' : faceSvg(siteSeed(f), { size, facing: 'left' }));
/** the VS splash for the current fight: Verse's mark left, the site's fighter right, names in plain text under them, an energy bar each (Verse's
 *  lit by the aspects it has won or is equal-and-better on, the site's by the aspects Verse still loses, the unmeasured grey). Pure. */
export function vsHtml(f, esc, { enter = true } = {}) {
  const m = Math.max(1, f.m || 0), n = Math.max(0, f.n || 0), lost = (f.lost || []).length;
  const bar = (k, lit) => '<span class="tw-bar" aria-hidden="true">' + Array.from({ length: m }, (_, i) => '<i' + (i < lit ? ' data-k="' + k + '"' : '') + '></i>').join('') + '</span>';
  return '<div class="tw-vs' + (enter ? ' tw-in' : '') + '" role="group" aria-label="' + esc('Verse versus ' + f.site + ': Verse ahead on ' + n + ' of ' + m + ' aspects, ' + f.site + ' on ' + lost) + '">'
    + '<div class="tw-side tw-v">' + verseFace({ size: 56 }) + '<span class="tw-who">Verse</span>' + bar('v', n) + '<span class="tw-bar-n">' + n + ' of ' + m + '</span></div>'
    + '<div class="tw-vsmark" aria-hidden="true">VS</div>'
    + '<div class="tw-side tw-s">' + siteFace(f, 56) + '<span class="tw-who">' + esc(f.site) + '</span>' + bar('s', lost) + '<span class="tw-bar-n">' + lost + ' of ' + m + '</span></div></div>';
}
/** the awareness rows: one per aspect (the verdict in a word, the measured numbers), then when it was measured and what is next. Pure. */
const rowsHtml = (f, esc, now) => '<ul class="tw-aspects">' + matchRows(f).map((r) => '<li data-v="' + r.v + '"><span>' + MARK[r.v] + ' ' + esc(r.a) + '<span class="tw-say">' + esc(r.say) + '</span></span>' + (r.nums ? '<span class="tw-num">' + esc(r.nums) + '</span>' : '') + '</li>').join('') + '</ul>'
  + '<div class="tw-meta">' + esc(metaLine(f, now)) + '</div>';
/** the whole matchup on its own, for a page outside the card (/compare/): the splash, the rows and the awareness line, with the styles. Pure. */
export const matchupHtml = (f, esc, { enter = true, now = Date.now() } = {}) => TW_CSS + '<div class="tw">' + vsHtml(f, esc, { enter }) + rowsHtml(f, esc, now) + '</div>';
/** the stack scrolled to its top, where the current site is (call after drawing). */
export function centerOnYou(root) { const stack = root && root.querySelector('.tw-stack'); if (stack) stack.scrollTop = 0; }
/** the floors as Versus in 3D wants them (skills/mini/tower.js): id, site, state, n of m, Verse's page. Pure. */
export const miniFloors = (t) => t.floors.map((f) => ({ id: f.id, site: f.site, state: f.state, n: f.n, m: f.m, page: f.page ? f.page.replace(/\?.*$/, '') : '' }));
export function towerHtml(t, esc, { mini = false, enter = true, now = Date.now() } = {}) {
  const cur = t.floors.find((f) => f.state === 'current'), won = t.floors.filter((f) => f.state === 'beaten').reverse(); // the newest conquest right under the current site
  // the current site's row is the matchup: one line per aspect with the verdict in a word and the measured numbers, then when and what is next
  // a surpassed site's row is a div, not a button, so a copied or saved card keeps it (lib/card-share.js leaves buttons out; owner, 2026-10-25: "theres no way to see the 24 surpassed")
  const row = (f) => (f.state === 'beaten' ? '<div class="tower-floor" role="button" tabindex="0" data-id="' + esc(f.id) + '" data-floor="' + f.floor + '" data-state="beaten">' : '<button class="tower-floor" data-id="' + esc(f.id) + '" data-floor="' + f.floor + '" data-state="' + f.state + '">')
    + (f.state === 'beaten' ? '<span class="tw-face">' + siteFace(f, 24) + '</span>' : '')
    + '<span class="tw-name">' + esc(f.site) + '</span><span class="tw-count">' + esc(f.state === 'beaten' ? 'surpassed' : f.n + ' of ' + f.m + ' aspects ahead') + '</span>'
    + (f.state === 'current' ? rowsHtml(f, esc, now) : '') + (f.state === 'beaten' ? '</div>' : '</button>');
  // the site and Verse's own page side by side (owner, 2026-10-25: "its ok for Verse to have links to the site its going against as well as links to its
  // own version for easy side by side compare"): one line under each floor, the site in a new tab, Verse's page in this one
  const links = (f) => (f.url || f.page ? '<div class="tw-links"' + (f.state === 'beaten' ? '' : ' data-share-skip') + ' style="display:flex;gap:10px;margin:-2px 0 6px 10px;font-size:12px;opacity:.85">'
    + (f.url ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener noreferrer">' + esc(f.site) + ' ↗</a>' : '')
    + (f.page ? '<a href="' + esc(f.page) + '">Verse\'s page ' + esc(String(f.page).replace(/\?.*$/, '')) + '</a>' : '')
    + '<a href="/compare/?floor=' + esc(encodeURIComponent(f.id)) + '">side by side</a></div>' : '');
  // the fight in words for a saved or copied card (lib/card-share.js leaves buttons out, and the aspect list is inside the floor's button):
  // hidden from sight and from screen readers, who have the list itself
  const fight = cur ? cur.site + ': ' + cur.n + ' of ' + cur.m + ' aspects ahead.' + (cur.left.length ? ' Still to pass: ' + cur.left.join(', ') + '.' : '') + (won.length ? ' Surpassed: ' + won.map((f) => f.site).join(', ') + '.' : '') : '';
  return TW_CSS + '<div class="tw"><div class="tw-head">Versus</div><div class="tw-score tower-line">' + esc(t.beaten + ' surpassed' + (cur ? ' · working on: ' + cur.site : '')) + '</div>'
    + (cur ? vsHtml(cur, esc, { enter }) : '')
    + (mini ? '<div class="tw-mini" data-share-skip style="height:' + (typeof innerWidth === 'number' && Math.min(innerWidth, innerHeight) < 560 ? 200 : 240) + 'px;margin:8px 0 4px"></div>' : '')
    + (fight ? '<div class="tw-fight" aria-hidden="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">' + esc(fight) + '</div>' : '')
    + '<div class="tw-stack tower-stack">' + (cur ? row(cur) + links(cur) : '') + (won.length ? '<p class="tw-wonhead" style="margin:8px 0 2px;font-size:13px"><b>Surpassed (' + won.length + ')</b></p>' : '') + won.map((f) => row(f) + links(f)).join('') + '</div>'
    // the host of Versus in 3D (owner, 2026-10-25: "some things are missing, like a 3d tower"): the card mounts skills/mini/tower.js into it after each draw
 + takeHtml(t, esc)
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
  return '<div class="tw-take" style="margin-top:8px;font-size:13px;line-height:1.45"><b>Verse\'s take</b>' + (k.now ? '<p style="margin:4px 0">' + esc(k.now) + '</p>' : '')
    + (k.learned.length ? '<p style="margin:6px 0 2px"><b>What each site taught me</b></p><ul style="margin:0;padding-left:18px">' + k.learned.map((x) => '<li><i>' + esc(x.site) + '</i>: ' + esc(x.text) + '</li>').join('') + '</ul>' : '') + '</div>'; };
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
const load = async () => { const [inv, ev, fr] = await Promise.all([get('/lap.items.json'), get('/tower.evidence.json'), get('/tower.frontier.json')]); const t = tower((inv && inv.onlySite) || [], (ev && ev.floors) || {}, fr, (ev && ev.icons) || null); stale = staleOf(ev, t); return t; };

async function run(text, api) {
  if (!towerOf(text)) return 'none';
  const { showPage, esc, say } = api;
  let t = await load(), timer = null, onVis = null;
  const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  showPage((el) => {
    el.classList.add('tower-card');
    el.innerHTML = '<div class="tw-root"></div><div class="tw-live" data-share-skip aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"></div><div class="tw-updated" style="text-align:center;font-size:11px;opacity:.55;margin-top:6px"></div>';
    const root = el.querySelector('.tw-root'), live = el.querySelector('.tw-live'), stamp = el.querySelector('.tw-updated');
    let picked = 0, shown = false, mini = !!(api.stage && api.stage.miniature);
    const miniKey = 'tower:' + Date.now().toString(36);
    const pick = (f) => { if (!f) return; picked = f.floor; const det = root.querySelector('.tower-detail'); if (det) det.textContent = detailText(f); };
    const draw = (flash) => {
      const keep = root.querySelector('.mk-stack'), was = keep ? keep.scrollTop : -1; // a redraw keeps where the person scrolled to; the first draw centres on the fight
      root.innerHTML = towerHtml(t, esc, { mini, enter: !root.dataset.drawn }); root.dataset.drawn = '1'; stamp.textContent = 'updated ' + clock(); // the VS entrance plays on the first paint only
      if (was >= 0) root.querySelector('.mk-stack').scrollTop = was; else { centerOnYou(root); setTimeout(() => centerOnYou(root), 80); } // again once the card has its size
      if (picked) { const f = t.floors.find((x) => x.floor === picked); if (f) root.querySelector('.tower-detail').textContent = detailText(f); }
      // Versus in 3D (skills/mini/tower.js): the same key moves the live one into the fresh host and hands it the new floors; tapping a floor picks it
      const host = root.querySelector('.tw-mini');
      if (host) api.stage.miniature(host, 'tower', { floors: miniFloors(t), onFloor: (id) => pick(t.floors.find((x) => x.id === id)) }, { key: miniKey, label: 'Versus in 3D: ' + t.beaten + ' floors surpassed; tap a floor to read it; drag to look around', ground: 'none' })
        .catch(() => { mini = false; host.remove(); });
      (flash || []).forEach((id) => { const b = root.querySelector('[data-id="' + id + '"]'); if (b && b.animate) b.animate([{ background: '#6a3d9a' }, { background: '' }], 1800); });
    };
    el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.tower-floor[role=button]')) { e.preventDefault(); e.target.closest('.tower-floor').click(); } });
    el.addEventListener('click', (e) => { const b = e.target.closest('.tower-floor'); if (!b) return; picked = +b.dataset.floor; const f = t.floors.find((x) => x.floor === picked); if (f) root.querySelector('.tower-detail').textContent = detailText(f); });
    draw();
    const stop = () => { if (timer) clearInterval(timer); timer = null; if (onVis) document.removeEventListener('visibilitychange', onVis); };
    const refresh = async () => {
      if (el.classList.contains('on')) shown = true; else if (shown || !el.isConnected) return stop(); // closed: the page drops 'on', then leaves
      if (document.visibilityState === 'hidden') return; // a hidden tab waits; coming back refreshes at once
      const next = await load(), moved = changes(t, next);
      t = next;
      draw(next.floors.filter((f) => moved.some((m) => m.startsWith(f.site))).map((f) => f.id));
      if (moved.length) live.textContent = moved.join(' ');
      // this copy of the page is older than the file it reads: say so, with a reload, instead of a count that stays behind
      if (stale) { let n = root.querySelector('.tw-stale'); if (!n) { n = document.createElement('div'); n.className = 'tw-stale'; n.setAttribute('data-share-skip', ''); n.style.cssText = 'margin:6px 0;padding:6px 10px;border:1px solid #c9b6ff;border-radius:10px;font-size:13px'; root.prepend(n); }
        n.innerHTML = 'A newer Verse is live: ' + stale + ' more site' + (stale === 1 ? '' : 's') + ' measured than this page knows. <button type="button" class="tw-reload" style="font:inherit;font-size:13px;padding:2px 10px;border-radius:999px">Reload</button>';
        n.querySelector('.tw-reload').addEventListener('click', () => location.reload()); }
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
  run, towerOf, towerHtml, detailText, changes, verseTake, vsHtml, matchupHtml, matchRows, metaLine,
};
