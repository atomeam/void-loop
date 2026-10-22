/**
 * tower skill — "the tower", "verse tower", "which sites have you beaten": the only-site-you-need ladder (lib/tower.js). A vertical stack
 * of floors, each one real site named in plain text as a comparison (no logos or brand styling, no affiliation implied), easiest at the
 * bottom. Beaten floors glow, the current fight shows its progress, higher floors are dim. A floor is beaten only when every aspect is
 * verified better by a head-to-head check against the live site (tools/tower-gate.mjs, tower.evidence.json). Tapping a floor shows the
 * Verse skills on it, N of M aspects beaten, what Verse still loses on and what is unverified. Real data only: read from this site.
 */
import { tower, towerLine } from '../lib/tower.js';

const ASK_RE = /^(?:(?:show|open)(?:\s+me)?\s+)?(?:the\s+|your\s+)?(?:verse(?:'s)?\s+)?tower$|^which\s+sites\s+have\s+you\s+beaten$|^what\s+sites\s+have\s+you\s+beaten$/;
export const towerOf = (text) => ASK_RE.test(String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
const get = async (u) => { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? r.json() : null; } catch (_) { return null; } };

export function towerHtml(t, esc) {
  const floors = t.floors.slice().reverse().map((f) => {
    const glow = f.state === 'beaten' ? 'box-shadow:0 0 14px #b07ce8;border-color:#b07ce8;opacity:1' : f.state === 'current' ? 'border-color:#e86cb8;opacity:1' : 'opacity:.45';
    const bar = '<i style="display:block;height:4px;border-radius:2px;background:linear-gradient(90deg,#e86cb8,#b07ce8);width:' + Math.round(100 * f.n / f.m) + '%"></i>';
    return '<button class="tower-floor" data-floor="' + f.floor + '" data-state="' + f.state + '" style="display:block;width:100%;text-align:left;margin:3px 0;padding:6px 8px;border:1px solid #3a3550;border-radius:8px;background:#0d0b14;color:#eee;font:inherit;overflow-wrap:anywhere;' + glow + '">'
      + '<b aria-hidden="true" style="display:inline-block;width:1.4em;text-align:center">' + esc(f.glyph) + '</b> ' + esc(f.floor + '. ' + f.site) + ' <small>(' + esc(f.label.toLowerCase()) + ')</small>'
      + (f.state === 'current' ? ' <span aria-label="Verse is here">◆ Verse</span>' : '') + '<span style="float:right">' + esc(f.n + ' of ' + f.m + ' aspects beaten') + '</span>' + bar + '</button>';
  }).join('');
  return '<h3 style="margin:0 0 4px">The tower</h3><div class="tower-line">' + esc(towerLine(t)) + '</div><div class="tower-stack" style="max-width:560px">' + floors + '</div>'
    + '<div class="tower-detail" aria-live="polite" style="margin-top:6px;overflow-wrap:anywhere"></div>'
    + '<div class="src" style="opacity:.7;font-size:.85em">Sites are named in plain text only as a comparison; Verse is not affiliated with any of them. A floor counts as beaten only when every aspect is verified better in a head-to-head check against the live site.</div>';
}
export function detailText(f) {
  return f.n + ' of ' + f.m + ' aspects beaten on ' + f.site + '. Verse skills here: ' + (f.skills.length ? f.skills.join(', ') : 'none yet') + '. '
    + (f.lost.length ? 'Still loses on: ' + f.lost.join(', ') + '. ' : '') + (f.regressed.length ? 'Regressed: ' + f.regressed.join(', ') + '. ' : '')
    + 'Left to beat: ' + (f.left.length ? f.left.join(', ') : 'nothing') + '.';
}

async function run(text, api) {
  if (!towerOf(text)) return 'none';
  const { showPage, esc, say } = api;
  const [inv, ev] = await Promise.all([get('/lap.items.json'), get('/tower.evidence.json')]);
  const t = tower((inv && inv.onlySite) || [], (ev && ev.floors) || {});
  showPage((el) => {
    el.classList.add('tower-card'); el.innerHTML = towerHtml(t, esc);
    const out = el.querySelector('.tower-detail');
    el.addEventListener('click', (e) => { const b = e.target.closest('.tower-floor'); if (!b) return; const f = t.floors.find((x) => x.floor === +b.dataset.floor); if (f) out.textContent = detailText(f); });
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
  run, towerOf, towerHtml, detailText,
};
