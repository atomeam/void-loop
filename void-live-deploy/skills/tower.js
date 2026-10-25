/**
 * tower skill — "the tower", "verse tower", "which sites have you beaten": the only-site-you-need ladder (lib/tower.js). The site Verse is
 * on now at the top with each of its aspects, every conquered site under it, nothing above (the queue has no end). Each site is named in
 * plain text as a comparison (no logos or brand styling, no affiliation implied). A site is conquered only when every aspect is verified
 * better by a head-to-head check against the live site (tools/tower-gate.mjs, tower.evidence.json). Tapping a site shows N of M aspects
 * beaten, what Verse still loses on and what is unverified. Real data only: read from this site.
 */
import { tower, towerLine, fatalityOf } from '../lib/tower.js?v=ladder-44';

const ASK_RE = /^(?:(?:show|open)(?:\s+me)?\s+)?(?:the\s+|your\s+)?(?:verse(?:'s)?\s+)?tower$|^(?:which|what)\s+sites\s+have\s+you\s+(?:beaten|surpassed|passed)$|^(?:the\s+)?surpassed(?:\s+sites)?$|^(?:the\s+)?conquered(?:\s+sites)?$|^who\s+(?:have\s+we|has\s+verse|did\s+(?:we|verse))\s+(?:beaten|beat|conquered|run\s+through)$/;
export const towerOf = (text) => ASK_RE.test(String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
const get = async (u) => { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? r.json() : null; } catch (_) { return null; } };

// The tower, plain (owner, 2026-10-24: "current target at the top, conquered sites stacked underneath, and nothing rendered above it"; "drop
// the fighting-game gimmicks"): the site Verse is on now, with each of its aspects and where it stands, and under it every site already
// conquered. The queue past the current site is not drawn: it has no end.
const TW_CSS = '<style>.vpage:has(.tw) .vc-art{display:none}.tw{max-width:520px;margin:0 auto}.tw-head{text-align:center;font-weight:700;font-size:17px;margin:2px 0}'
  + '.tw-score{text-align:center;font-size:13px;opacity:.75;margin-bottom:8px}.tw-stack{max-height:min(48vh,360px);overflow-y:auto;padding:2px}'
  + '.tw-stack .tower-floor{display:block;width:100%;text-align:left;margin:4px 0;padding:8px 10px;border:1px solid #3a3550;border-radius:6px;background:#14121b;color:#eee;font:inherit;cursor:pointer;overflow-wrap:anywhere}'
  + '.tw-name{font-weight:700}.tw-count{font-size:12px;opacity:.7;margin-left:6px}.tower-floor[data-state=current]{border-color:#c9b6ff;padding:10px 12px}.tower-floor[data-state=current] .tw-name{font-size:16px}'
  + '.tw-aspects{list-style:none;margin:6px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:2px 10px;font-size:12px}.tw-aspects li[data-v=won]{color:#8fe3a8}.tw-aspects li[data-v=lost]{color:#ff8a8a}.tw-aspects li[data-v=open]{opacity:.6}'
  + '.tower-floor[data-state=beaten]{opacity:.75}.tower-floor[data-state=beaten] .tw-name{text-decoration:line-through}</style>';
const MARK = { won: '✓', lost: '✗', open: '·' };
/** each aspect of a site and where Verse stands on it: won, lost or not measured yet. Pure. */
export const aspectRows = (f) => (f.aspects || []).map((a) => ({ a, v: f.lost.includes(a) ? 'lost' : f.left.includes(a) ? 'open' : 'won' }));
/** the stack scrolled to its top, where the current site is (call after drawing). */
export function centerOnYou(root) { const stack = root && root.querySelector('.tw-stack'); if (stack) stack.scrollTop = 0; }
export function towerHtml(t, esc) {
  const cur = t.floors.find((f) => f.state === 'current'), won = t.floors.filter((f) => f.state === 'beaten').reverse(); // the newest conquest right under the current site
  const row = (f) => '<button class="tower-floor" data-id="' + esc(f.id) + '" data-floor="' + f.floor + '" data-state="' + f.state + '">'
    + '<span class="tw-name">' + esc(f.site) + '</span><span class="tw-count">' + esc(f.state === 'beaten' ? 'surpassed' : f.n + ' of ' + f.m + ' aspects ahead') + '</span>'
    + (f.state === 'current' ? '<ul class="tw-aspects">' + aspectRows(f).map((r) => '<li data-v="' + r.v + '">' + MARK[r.v] + ' ' + esc(r.a) + '</li>').join('') + '</ul>' : '') + '</button>';
  // the site and Verse's own page side by side (owner, 2026-10-25: "its ok for Verse to have links to the site its going against as well as links to its
  // own version for easy side by side compare"): one line under each floor, the site in a new tab, Verse's page in this one
  const links = (f) => (f.url || f.page ? '<div class="tw-links" style="display:flex;gap:10px;margin:-2px 0 6px 10px;font-size:12px;opacity:.85">'
    + (f.url ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener noreferrer">' + esc(f.site) + ' ↗</a>' : '')
    + (f.page ? '<a href="' + esc(f.page) + '">Verse\'s page ' + esc(String(f.page).replace(/\?.*$/, '')) + '</a>' : '')
    + '<a href="/compare/?floor=' + esc(encodeURIComponent(f.id)) + '">side by side</a></div>' : '');
  // the fight in words for a saved or copied card (lib/card-share.js leaves buttons out, and the aspect list is inside the floor's button):
  // hidden from sight and from screen readers, who have the list itself
  const fight = cur ? cur.site + ': ' + cur.n + ' of ' + cur.m + ' aspects ahead.' + (cur.left.length ? ' Still to pass: ' + cur.left.join(', ') + '.' : '') + (won.length ? ' Surpassed: ' + won.map((f) => f.site).join(', ') + '.' : '') : '';
  return TW_CSS + '<div class="tw"><div class="tw-head">The tower</div><div class="tw-score tower-line">' + esc(t.beaten + ' surpassed' + (cur ? ' · working on: ' + cur.site : '')) + '</div>'
    + (fight ? '<div class="tw-fight" aria-hidden="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">' + esc(fight) + '</div>' : '')
    + '<div class="tw-stack tower-stack">' + (cur ? row(cur) + links(cur) : '') + won.map((f) => row(f) + links(f)).join('') + '</div><div class="tower-detail" aria-live="polite" style="margin-top:6px;overflow-wrap:anywhere;font-size:13px"></div>' + takeHtml(t, esc)
    + '<div class="src" style="opacity:.7;font-size:.85em">Sites are named in plain text only as a comparison; Verse is not affiliated with any of them. <a href="/conquered/" target="_blank" rel="noopener">Full screen</a></div></div>';
}
/** Verse's take, from what is measured and what was built, never invented (owner, 2026-10-24: a take on the current opponent, and "include its
 *  take on what its learned and absorbed from all the fights so far"): the fight now (its page, what it leads on, what is left, the killshot)
 *  and one line per conquered site from the floor's `learned`. { now, learned: [{ site, text }] }. Pure. */
export function verseTake(t) {
  const cur = t.floors.find((f) => f.state === 'current'), won = t.floors.filter((f) => f.state === 'beaten' && (f.learned || fatalityOf(f))).reverse(); // a conquest with no lesson written yet still shows, by its killshot
  let now = '';
  if (cur) {
    const lead = cur.aspects.filter((a) => !cur.left.includes(a)), open = cur.left.filter((a) => !cur.lost.includes(a));
    now = (cur.page ? 'My page for ' + cur.site + ' is a-to-mind.com' + cur.page.replace(/\?.*$/, '') + '. ' : 'I answer ' + cur.site + '\'s job on the stage; it has no page of mine yet. ')
      + (lead.length ? 'I lead on ' + lead.join(', ') + '. ' : 'Nothing is measured in my favour yet. ')
      + (cur.lost.length ? 'I lose on ' + cur.lost.join(', ') + ', so that comes first. ' : '') + (open.length ? 'Still to prove: ' + open.join(', ') + '.' : '')
      + (fatalityOf(cur) ? ' The edge I am building: ' + fatalityOf(cur) + '.' : '');
  }
  return { now, learned: won.map((f) => ({ site: f.site, text: f.learned || 'Verse\'s edge: ' + fatalityOf(f) })) };
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
const load = async () => { const [inv, ev, fr] = await Promise.all([get('/lap.items.json'), get('/tower.evidence.json'), get('/tower.frontier.json')]); return tower((inv && inv.onlySite) || [], (ev && ev.floors) || {}, fr); };

async function run(text, api) {
  if (!towerOf(text)) return 'none';
  const { showPage, esc, say } = api;
  let t = await load(), timer = null, onVis = null;
  const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  showPage((el) => {
    el.classList.add('tower-card');
    el.innerHTML = '<div class="tw-root"></div><div class="tw-live" data-share-skip aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"></div><div class="tw-updated" style="text-align:center;font-size:11px;opacity:.55;margin-top:6px"></div>';
    const root = el.querySelector('.tw-root'), live = el.querySelector('.tw-live'), stamp = el.querySelector('.tw-updated');
    let picked = 0, shown = false;
    const draw = (flash) => {
      const keep = root.querySelector('.mk-stack'), was = keep ? keep.scrollTop : -1; // a redraw keeps where the person scrolled to; the first draw centres on the fight
      root.innerHTML = towerHtml(t, esc); stamp.textContent = 'updated ' + clock();
      if (was >= 0) root.querySelector('.mk-stack').scrollTop = was; else { centerOnYou(root); setTimeout(() => centerOnYou(root), 80); } // again once the card has its size
      if (picked) { const f = t.floors.find((x) => x.floor === picked); if (f) root.querySelector('.tower-detail').textContent = detailText(f); }
      (flash || []).forEach((id) => { const b = root.querySelector('[data-id="' + id + '"]'); if (b && b.animate) b.animate([{ background: '#6a3d9a' }, { background: '' }], 1800); });
    };
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
  about: 'The tower: real sites as floors, and how many aspects of each Verse has verified it beats.',
  examples: ['the tower', 'verse tower', 'which sites have you surpassed', 'show the tower', 'open your tower'],
  nearMisses: ['eiffel tower', 'tower of hanoi', 'how tall is the tower', 'tower defense game', 'cell tower near me'],
  match(lower, text) { return towerOf(text || lower); },
  run, towerOf, towerHtml, detailText, changes, verseTake,
};
