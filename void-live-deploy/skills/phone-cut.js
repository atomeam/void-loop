/**
 * phone-cut skill — auto-generates promotional posters for phone-cut films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone-cut films", "auto-generate promotional posters", "make a phone poster for the newest film".
 * Uses existing films data (/api/films) and canvas drawing. Empty surface stays empty.
 */
import { filmMeta } from './films.js';

export function phoneCutOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /phone-?cut(?:\s+films?)?|auto-?generate\s+(?:promotional\s+)?posters?|promotional\s+posters?\s+for\s+(?:phone-?cut\s+)?films?/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!phoneCutOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">looking up the newest film…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (!api._pageStill(el)) return 'phone-cut';
    const films = (j.films || []).map(filmMeta);
    const meta = films[0];
    if (!meta) {
      el.innerHTML = '<h2>Phone-cut promotional poster</h2><p>No films yet. Try again later.</p>';
      return 'phone-cut';
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1920;
    const g = canvas.getContext('2d');
    g.fillStyle = '#07070b'; g.fillRect(0, 0, 1080, 1920);
    g.fillStyle = '#f2f2f7';
    g.font = '600 72px system-ui, sans-serif';
    g.fillText((meta.title || 'V01D FILMS').slice(0, 40), 80, 300);
    g.font = '400 36px system-ui, sans-serif';
    g.fillText('Watch free at a-to-mind.com/films', 80, 1600);
    const data = canvas.toDataURL('image/png');
    el.innerHTML = '<h2>Phone-cut poster · ' + esc(meta.title || meta.experiment || 'newest') + '</h2><img src="' + data + '" style="max-width:100%;border-radius:12px" alt="phone story poster"><p>1080×1920 phone story, drawn here. Nothing uploaded.</p><div class="src">From /api/films</div>';
    return 'phone-cut';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Phone-cut promotional poster</h2><p>Could not generate just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-cut',
  examples: ['phone-cut films', 'auto-generate promotional posters', 'make a phone poster for the newest film'],
  nearMisses: ['phone films', 'cut the paper', 'posters for sale', 'best phone'],
  match(lower, text) { return phoneCutOf(text); },
  run,
  suite() {
    return { ok: phoneCutOf('phone-cut films') === true && phoneCutOf('hello world') === false };
  },
};
