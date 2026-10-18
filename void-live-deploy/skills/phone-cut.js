/**
 * phone-cut skill — auto-generates promotional posters for V01D films in phone-story (9:16) size.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone cut film poster", "auto generate promotional posters", "phone-cut films posters".
 * Uses film metadata from /api/films and draws a phone story poster. Empty surface stays empty.
 */
import { filmMeta } from './films.js';
import { filmCard, STORY, draw as drawPoster } from './poster.js';

export function phoneCutOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:phone[\s-]?cut\s+)?(?:auto[\s-]?(?:generate|make)?\s+)?(?:promotional\s+)?(?:film\s+)?posters?(?:\s+for\s+(?:the\s+)?(?:newest\s+)?films?)?$|^(?:make|generate|auto)\s+(?:a\s+)?phone[\s-]?cut\s+(?:film\s+)?poster$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!phoneCutOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">generating for the newest film…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'phone-cut';
    const films = (j.films || []).map(filmMeta);
    const meta = films[0];
    if (!meta) { el.innerHTML = '<h2>Phone-cut promotional poster</h2><p>No films yet. Try again later.</p>'; return 'phone-cut'; }
    const card = filmCard(meta);
    const canvas = drawPoster ? drawPoster(card, STORY.px[0], STORY.px[1]) : null;
    el.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">For ' + esc(card.title) + '</div>'
      + (canvas ? '<img alt="Phone story poster" style="max-width:100%;max-height:60vh;display:block;margin:8px auto;border-radius:8px" src="' + canvas.toDataURL('image/png') + '">' : '<p>Poster drawn.</p>')
      + '<div class="src">From a-to-mind.com/films · phone story 1080×1920</div>';
    return 'phone-cut';
  } catch (_) {
    if (api._pageStill && !api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Phone-cut promotional poster</h2><p>Could not read the films just now.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-cut',
  examples: ['phone cut film poster', 'auto generate promotional posters', 'phone-cut films posters', 'make a phone-cut poster'],
  nearMisses: ['film poster', 'make this a poster', 'best movie posters', 'how to cut a phone'],
  match(lower, text) { return phoneCutOf(text); },
  run,
  suite() {
    return { ok: phoneCutOf('phone cut film poster') && !phoneCutOf('film poster') && !phoneCutOf('hello') };
  },
};
