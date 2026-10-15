/**
 * phone-poster skill — phone-cut films auto-generate promotional posters.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone poster for the newest film", "make a phone-cut poster", "promo poster for miss-board-4".
 * Builds on poster.js filmCard and STORY size. Empty surface stays empty.
 */
import { filmMeta } from './films.js';
import { filmCard, layoutPoster } from './poster.js';

export function phonePosterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^order\b/.test(t)) return null;
  const m = t.match(/^(?:(?:make|create|draw|print|give me|generate)\s+)?(?:a\s+)?(?:phone[- ]?cut\s+)?(?:promo(?:tional)?\s+)?poster\s+(?:for|of)\s+(?:the\s+)?(?:newest\s+|latest\s+)?(?:film\s+)?([a-z0-9][a-z0-9-]{2,60}(?:-\d+)?)?$/);
  if (m && m[1]) return { which: m[1] };
  if (/^(?:phone[- ]?cut\s+)?(?:promo(?:tional)?\s+)?film\s+poster$/.test(t) || /make a phone[- ]?cut poster/.test(t)) return { which: 'newest' };
  return null;
}

function run(text, api) {
  const want = phonePosterOf(text);
  if (!want) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">…</div>'; });
  (async () => {
    try {
      const j = await fetch('/api/films').then((r) => r.json());
      const all = (j.films || []).map(filmMeta);
      const meta = want.which === 'newest' ? all[0] : all.find((f) => f.experiment === want.which || f.id === want.which);
      if (!api._pageStill || !api._pageStill(el)) return;
      if (!meta) {
        el.innerHTML = '<h2>Phone-cut promotional poster</h2><p>No matching V01D film. Say <b>film metadata</b> to list them.</p>';
        return;
      }
      const card = filmCard(meta);
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
      const g = c.getContext('2d');
      g.fillStyle = '#07070b'; g.fillRect(0, 0, 1080, 1920);
      const measure = (t, size) => { g.font = `400 ${size}px system-ui`; return g.measureText(t).width; };
      const L = layoutPoster(card, 1080, 1920, measure);
      for (const l of L.lines) { g.font = `${l.weight} ${l.size}px system-ui`; g.fillStyle = '#f2f2f7'; g.fillText(l.text, l.x, l.y); }
      el.innerHTML = '<h2>Phone-cut poster · ' + esc(card.title) + '</h2><img alt="poster" style="max-width:100%;max-height:60vh" src="' + c.toDataURL() + '"><div class="src">9:16 phone story · drawn in this browser</div>';
    } catch (_) {
      if (api._pageStill && api._pageStill(el)) el.innerHTML = '<h2>Phone-cut promotional poster</h2><p>Could not load films just now.</p>';
    }
  })();
  return 'phone-poster';
}

export default {
  name: 'phone-poster',
  examples: ['phone poster for the newest film', 'make a phone-cut poster', 'promo poster for the film', 'generate phone promotional poster'],
  nearMisses: ['film poster', 'make this a poster', 'movie poster'],
  match(lower, text) { return !!phonePosterOf(text); },
  run,
  suite() {
    return { ok: !!phonePosterOf('phone poster for the newest film') && phonePosterOf('hello') === null };
  },
};
