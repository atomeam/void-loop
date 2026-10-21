/**
 * promo-poster skill — auto-generates promotional posters for phone-cut Verse films (growth inbox).
 * "phone cut poster", "promo poster for the newest film", "make a phone poster".
 * Shows a styled promotional card with film meta from /api/films, client-side only. Empty surface stays empty.
 */
import { filmMeta } from './films.js';

export function wantsPromo(lower) {
  const t = String(lower || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:make|generate|create|show)?\s*(?:a\s+)?(?:phone(?:\s*cut)?\s+)?(?:promo(?:tional)?\s+)?poster(?:\s+for\s+(?:the\s+)?(?:newest\s+)?film)?$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone promo poster</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'promo-poster';
    const meta = filmMeta((j.films || [])[0] || {});
    el.innerHTML = '<h2>Phone promo · ' + esc(meta.title || 'VERSE FILMS') + '</h2>'
      + '<div style="aspect-ratio:9/16;max-width:280px;margin:12px auto;background:linear-gradient(160deg,#14102a,#07070d);border-radius:16px;padding:20px;color:#fff;text-align:center">'
      + '<div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.7">VERSE FILMS</div>'
      + '<h3 style="margin:12px 0;font-size:22px">' + esc(meta.title || 'Now showing') + '</h3>'
      + '<div style="opacity:.8">' + esc(meta.day || '') + '</div>'
      + '<div style="margin-top:20px;font-size:13px">Watch free at a-to-mind.com/films</div>'
      + '</div>'
      + '<p class="src">Auto-generated promotional poster for phone-cut films. Drawn here; nothing uploaded.</p>';
  } catch (_) {
    el.innerHTML = '<h2>Phone promo poster</h2><p>The films could not be read just now. Try again in a minute.</p>';
  }
  return 'promo-poster';
}

export default {
  name: 'promo-poster',
  examples: ['phone cut poster', 'promo poster for the newest film', 'make a phone poster'],
  nearMisses: ['make this a poster', 'film poster', 'what is a poster', 'hello'],
  match(lower) { return wantsPromo(lower); },
  run,
  suite() {
    return { ok: wantsPromo('phone cut poster') && wantsPromo('promo poster for the newest film') && !wantsPromo('hello world') };
  },
};
