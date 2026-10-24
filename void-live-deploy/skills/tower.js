/**
 * tower skill — "the tower", "verse tower", "which sites have you beaten": the only-site-you-need ladder (lib/tower.js). A vertical stack
 * of floors, each one real site named in plain text as a comparison (no logos or brand styling, no affiliation implied), easiest at the
 * bottom. Beaten floors glow, the current fight shows its progress, higher floors are dim. A floor is beaten only when every aspect is
 * verified better by a head-to-head check against the live site (tools/tower-gate.mjs, tower.evidence.json). Tapping a floor shows the
 * Verse skills on it, N of M aspects beaten, what Verse still loses on and what is unverified. Real data only: read from this site.
 */
import { tower, towerLine } from '../lib/tower.js?v=ladder-35';

const ASK_RE = /^(?:(?:show|open)(?:\s+me)?\s+)?(?:the\s+|your\s+)?(?:verse(?:'s)?\s+)?tower$|^which\s+sites\s+have\s+you\s+beaten$|^what\s+sites\s+have\s+you\s+beaten$|^(?:the\s+)?conquered(?:\s+sites)?$|^who\s+(?:have\s+we|has\s+verse|did\s+(?:we|verse))\s+(?:beaten|beat|conquered|run\s+through)$/;
export const towerOf = (text) => ASK_RE.test(String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
const get = async (u) => { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? r.json() : null; } catch (_) { return null; } };

// The tower as a fighting-game ladder (owner, 2026-10-24: "a mk style visual tower, easy to see the level we were on, who we passed and who's
// ahead"): the final boss at the top, floor 1 at the bottom. A defeated site is struck through and stamped; the one Verse is fighting glows,
// says YOU ARE HERE and shows its health bar (one segment per aspect, a segment drains for each one Verse beats); the ones ahead are locked.
const MK_CSS = '<style>.vpage:has(.mk) .vc-art{display:none}.mk{max-width:520px;margin:0 auto}.mk-head{text-align:center;font:900 22px/1 Impact,system-ui,sans-serif;letter-spacing:.18em;color:#ffd166;text-shadow:0 0 12px rgba(255,120,60,.6);margin:2px 0 4px}'
  + '.mk-score{text-align:center;font-size:13px;opacity:.85;margin-bottom:8px;letter-spacing:.06em}.mk-stack{max-height:min(44vh,330px);overflow-y:auto;padding:2px 4px;scrollbar-width:thin}'
  + '.mk-stack .tower-floor{display:grid;grid-template-columns:2.2em 1fr auto;grid-template-areas:"no name tag" "no count count";align-items:center;gap:0 8px;width:100%;text-align:left;margin:4px 0;padding:7px 10px;border:2px solid #3a3550;border-radius:6px;background:linear-gradient(#15121f,#0b0910);color:#eee;font:inherit;cursor:pointer;position:relative;overflow-wrap:anywhere}'
  + '.mk-no{grid-area:no;font:900 22px/1 Impact,system-ui,sans-serif;opacity:.5;text-align:center}.mk-name{grid-area:name;font-weight:800;letter-spacing:.06em;text-transform:uppercase;font-size:14px}'
  + '.mk-tag{grid-area:tag;font:900 11px/1 Impact,system-ui,sans-serif;letter-spacing:.16em;padding:3px 7px;border-radius:3px}.mk-count{grid-area:count;font-size:11px;opacity:.65;margin-top:2px}'
  + '.tower-floor[data-state=beaten]{border-color:#7a2630;background:linear-gradient(#1b0d12,#0e070a);opacity:.8}.tower-floor[data-state=beaten] .mk-name{text-decoration:line-through;text-decoration-thickness:2px;text-decoration-color:#ff4560;opacity:.6}'
  + '.tower-floor[data-state=beaten] .mk-tag{color:#ff4560;border:2px solid #ff4560;transform:rotate(-6deg)}.tower-floor[data-state=beaten] .mk-no{color:#ff4560;opacity:.8}'
  + '.tower-floor[data-state=current]{border-color:#ffd166;background:linear-gradient(#2a1c10,#150d07);box-shadow:0 0 18px rgba(255,170,60,.55);animation:mk-pulse 1.1s ease-in-out infinite;padding:11px 10px}'
  + '.tower-floor[data-state=current] .mk-name{font-size:17px;color:#fff}.tower-floor[data-state=current] .mk-tag{background:#ffd166;color:#2a1604}.tower-floor[data-state=current] .mk-no{opacity:1;color:#ffd166;font-size:28px}'
  + '.mk-hp{grid-column:1/-1;display:flex;gap:2px;margin-top:6px}.mk-hp i{flex:1;height:9px;background:#e0364f;border-radius:1px}.mk-hp i.gone{background:#2a2433}.mk-vs{grid-column:1/-1;font-size:11px;letter-spacing:.14em;color:#ffd166;margin-top:5px}'
  + '.tower-floor[data-state=ahead]{opacity:.55}.tower-floor[data-state=ahead] .mk-tag{color:#8a86a0;border:1px solid #3a3550}.tower-floor[data-state=ahead][data-boss=yes]{opacity:.9;border-color:#6a2a8a}.tower-floor[data-state=ahead][data-boss=yes] .mk-tag{color:#e8a8ff;border-color:#a04ad0}'
  + '@keyframes mk-pulse{50%{box-shadow:0 0 30px rgba(255,200,80,.9)}}@media (prefers-reduced-motion:reduce){.tower-floor[data-state=current]{animation:none}}</style>';
/** the stack scrolled so the floor Verse is on sits in the middle (call after drawing). */
export function centerOnYou(root) {
  const stack = root && root.querySelector('.mk-stack'), cur = stack && stack.querySelector('[data-state="current"]');
  if (stack && cur) stack.scrollTop = Math.max(0, cur.offsetTop - stack.offsetTop - stack.clientHeight / 2 + cur.offsetHeight / 2);
}
export function towerHtml(t, esc) {
  const rows = t.floors.slice().reverse().map((f) => {
    const boss = f.floor === t.total && f.state === 'ahead' ? ' data-boss="yes"' : '';
    const tag = f.state === 'beaten' ? (f.fatality ? 'FATALITY' : 'DEFEATED') : f.state === 'current' ? '▶ YOU ARE HERE' : boss ? 'FINAL BOSS' : 'LOCKED';
    const hp = f.state === 'current' ? '<span class="mk-vs">VERSE  VS  ' + esc(f.site.toUpperCase()) + '</span><span class="mk-hp" role="img" aria-label="' + esc(f.site + ' has ' + (f.m - f.n) + ' of ' + f.m + ' health left') + '">'
      + Array.from({ length: f.m }, (_, i) => '<i' + (i < f.n ? ' class="gone"' : '') + '></i>').join('') + '</span>' : '';
    return '<button class="tower-floor" data-id="' + esc(f.id) + '" data-floor="' + f.floor + '" data-state="' + f.state + '"' + boss + '>'
      + '<span class="mk-no" aria-hidden="true">' + esc(f.floor) + '</span><span class="mk-name">' + esc(f.site) + '</span><span class="mk-tag">' + esc(tag) + '</span>'
      + '<span class="mk-count">' + esc(f.n + ' of ' + f.m + ' aspects beaten') + '</span>' + hp + '</button>';
  }).join('');
  const done = t.floors.filter((f) => f.beaten).length;
  return MK_CSS + '<div class="mk"><div class="mk-head">THE TOWER</div><div class="mk-score tower-line">' + esc(done + ' defeated · ' + (t.total - done) + ' to go · floor ' + Math.min(t.marker, t.total) + ' of ' + t.total) + '</div>'
    + '<div class="mk-stack tower-stack">' + rows + '</div><div class="tower-detail" aria-live="polite" style="margin-top:6px;overflow-wrap:anywhere;font-size:13px"></div>'
    + '<div class="src" style="opacity:.7;font-size:.85em">Sites are named in plain text only as a comparison; Verse is not affiliated with any of them. A site falls only when every aspect is measured head to head or judged better by a person who used both; Verse never awards itself one. <a href="/conquered/" target="_blank" rel="noopener">Full screen</a></div></div>';
}
export function detailText(f) {
  // only what is true and measured: the beaten count, Verse's own page for the job, what it loses on, and what nobody has measured yet
  const open = f.left.filter((a) => !f.lost.includes(a));
  return f.n + ' of ' + f.m + ' aspects beaten on ' + f.site + '. ' + (f.page ? 'Verse\'s page for it: a-to-mind.com' + f.page.replace(/\?.*$/, '') + '. ' : '')
    + (f.lost.length ? 'Loses on: ' + f.lost.join(', ') + '. ' : '') + (open.length ? 'Not measured yet: ' + open.join(', ') + '. ' : 'Nothing left to beat. ') + (f.fatality ? 'FATALITY: ' + f.fatality + '.' : '');
}

/** what moved between two towers, in words: the marker, a beaten floor, an aspect count. Pure. */
export function changes(prev, next) {
  const out = [];
  if (!prev || !next) return out;
  if (next.marker !== prev.marker) out.push('The marker moved to floor ' + Math.min(next.marker, next.total) + '.');
  for (const f of next.floors) {
    const was = prev.floors.find((x) => x.id === f.id); if (!was) continue;
    if (f.beaten && !was.beaten) out.push(f.site + ' is beaten.');
    else if (was.beaten && !f.beaten) out.push(f.site + ' slipped.');
    else if (f.n !== was.n) out.push(f.site + ': ' + f.n + ' of ' + f.m + ' aspects.');
  }
  return out;
}
const POLL_MS = () => (typeof window !== 'undefined' && window.__towerPollMs) || 30000;
const load = async () => { const [inv, ev] = await Promise.all([get('/lap.items.json'), get('/tower.evidence.json')]); return tower((inv && inv.onlySite) || [], (ev && ev.floors) || {}); };

async function run(text, api) {
  if (!towerOf(text)) return 'none';
  const { showPage, esc, say } = api;
  let t = await load(), timer = null, onVis = null;
  const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  showPage((el) => {
    el.classList.add('tower-card');
    el.innerHTML = '<div class="tw-root"></div><div class="tw-live" aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"></div><div class="tw-updated" style="text-align:center;font-size:11px;opacity:.55;margin-top:6px"></div>';
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
  examples: ['the tower', 'verse tower', 'which sites have you beaten', 'show the tower', 'open your tower'],
  nearMisses: ['eiffel tower', 'tower of hanoi', 'how tall is the tower', 'tower defense game', 'cell tower near me'],
  match(lower, text) { return towerOf(text || lower); },
  run, towerOf, towerHtml, detailText, changes,
};
