/**
 * phone-posters skill — auto-generates promotional posters for phone-cut (vertical short) Verse films.
 * "phone cut films poster", "promo poster for the newest phone film", "auto generate phone story poster".
 * Uses existing film metadata (films.js) and poster card words (poster.js). Empty surface stays empty: no new stage things.
 * Asked by Verse (growth-inbox open row, 2026-10-15).
 */
import { filmMeta } from './films.js';
import { filmCard } from './poster.js';

export function phonePosterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:auto\s+)?(?:generate|make|create)\s+(?:a\s+)?(?:promo(?:tional)?\s+)?(?:phone(?:\s+cut)?\s+)?(?:film\s+)?poster(?:\s+for\s+(?:the\s+)?(?:newest|latest|phone(?:\s+cut)?\s+)?films?)?$/.test(t)) return { which: 'newest' };
  if (/^phone\s+cut\s+films?\s+(?:poster|promo)$/.test(t)) return { which: 'newest' };
  return null;
}

async function run(text, api) {
  const hit = phonePosterOf(text);
  if (!hit) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone story poster</h2><div class="sub">looking up the newest film…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    const all = (j.films || []).map(filmMeta);
    const meta = all[0];
    if (!api._pageStill(el)) return 'phone-posters';
    if (!meta) {
      el.innerHTML = '<h2>Phone story poster</h2><p>No Verse films found just now.</p>';
      return 'phone-posters';
    }
    const card = filmCard(meta);
    el.innerHTML = '<h2>Phone story poster for ' + esc(card.title) + '</h2>'
      + '<div class="sub">9:16 phone story size for promo. Drawn in this browser; nothing uploaded. Full print sizes: say "film poster".</div>'
      + '<p><b>' + esc(card.title) + '</b></p><pre style="white-space:pre-wrap">' + esc(card.text) + '</pre>'
      + '<div class="src">From /api/films</div>';
    return 'phone-posters';
  } catch (err) {
    if (!api._pageStill(el)) return 'phone-posters';
    el.innerHTML = '<h2>Phone story poster</h2><p>Could not read the films just now.</p>';
    return 'phone-posters';
  }
}

export default {
  name: 'phone-posters',
  examples: ['phone cut films poster', 'auto generate promo poster for the newest film', 'phone story poster'],
  nearMisses: ['make this a poster', 'film poster', 'films', 'order a poster'],
  match(lower, text) { return !!phonePosterOf(text); },
  run,
  suite() {
    const hit = phonePosterOf('phone cut films poster');
    const ok = !!hit && hit.which === 'newest' && phonePosterOf('hello') === null && phonePosterOf('make this a poster') === null;
    return { ok, got: hit ? 'newest' : 'miss' };
  },
};
