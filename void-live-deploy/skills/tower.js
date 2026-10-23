/**
 * tower skill — "the tower", "verse tower", "which sites have you beaten": the only-site-you-need ladder (lib/tower.js). A vertical stack
 * of floors, each one real site named in plain text as a comparison (no logos or brand styling, no affiliation implied), easiest at the
 * bottom. Beaten floors glow, the current fight shows its progress, higher floors are dim. A floor is beaten only when every aspect is
 * verified better by a head-to-head check against the live site (tools/tower-gate.mjs, tower.evidence.json). Tapping a floor shows the
 * Verse skills on it, N of M aspects beaten, what Verse still loses on and what is unverified. Real data only: read from this site.
 */
import { tower, towerLine } from '../lib/tower.js?v=ladder-35';

const ASK_RE = /^(?:(?:show|open)(?:\s+me)?\s+)?(?:the\s+|your\s+)?(?:verse(?:'s)?\s+)?tower$|^which\s+sites\s+have\s+you\s+beaten$|^what\s+sites\s+have\s+you\s+beaten$/;
export const towerOf = (text) => ASK_RE.test(String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
const get = async (u) => { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? r.json() : null; } catch (_) { return null; } };

export function towerHtml(t, esc) {
  const floors = t.floors.slice().reverse().map((f) => {
    const glow = f.state === 'beaten' ? 'box-shadow:0 0 14px #b07ce8;border-color:#b07ce8;opacity:1' : f.state === 'current' ? 'border-color:#e86cb8;opacity:1' : 'opacity:.45';
    const bar = '<i style="display:block;height:4px;border-radius:2px;background:linear-gradient(90deg,#e86cb8,#b07ce8);width:' + Math.round(100 * f.n / f.m) + '%"></i>';
    return '<button class="tower-floor" data-id="' + esc(f.id) + '" data-floor="' + f.floor + '" data-state="' + f.state + '" style="display:block;width:100%;text-align:left;margin:3px 0;padding:6px 8px;border:1px solid #3a3550;border-radius:8px;background:#0d0b14;color:#eee;font:inherit;overflow-wrap:anywhere;' + glow + '">'
      + '<b aria-hidden="true" style="display:inline-block;width:1.4em;text-align:center">' + esc(f.glyph) + '</b> ' + esc(f.floor + '. ' + f.site) + ' <small>(' + esc(f.label.toLowerCase()) + ')</small>'
      + (f.state === 'current' ? ' <span aria-label="Verse is here">◆ Verse</span>' : '') + '<span style="float:right">' + esc(f.n + ' of ' + f.m + ' aspects beaten') + '</span>' + bar + '</button>';
  }).join('');
  return '<h3 style="margin:0 0 4px">The tower</h3><div class="tower-line">' + esc(towerLine(t)) + '</div><div class="tower-stack" style="max-width:560px">' + floors + '</div>'
    + '<div class="tower-detail" aria-live="polite" style="margin-top:6px;overflow-wrap:anywhere"></div>'
    + '<div class="src" style="opacity:.7;font-size:.85em">Sites are named in plain text only as a comparison; Verse is not affiliated with any of them. A floor falls when Verse\'s scout calls it, or when every aspect is measured or judged better.</div>';
}
export function detailText(f) {
  return f.n + ' of ' + f.m + ' aspects beaten on ' + f.site + '. Verse skills here: ' + (f.skills.length ? f.skills.join(', ') : 'none yet') + '. '
    + (f.lost.length ? 'Still loses on: ' + f.lost.join(', ') + '. ' : '') + (f.regressed.length ? 'Regressed: ' + f.regressed.join(', ') + '. ' : '')
    + 'Left to beat: ' + (f.left.length ? f.left.join(', ') : 'nothing') + '.';
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
      root.innerHTML = towerHtml(t, esc); stamp.textContent = 'updated ' + clock();
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
