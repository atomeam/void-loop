/**
 * phone-poster skill — auto-generates promotional posters for phone-cut films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone poster for the film", "generate promotional poster for phone-cut", "auto poster for newest film".
 * Uses film metadata and draws a simple poster card. Empty surface stays empty (page only).
 */
import { filmMeta } from './films.js';

export function posterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/phone(?:\s*-?\s*cut)?\s+(?:film\s+)?poster|promotional\s+poster\s+for\s+(?:the\s+)?phone|auto(?:\s*-?\s*)?generat(?:e|es)\s+(?:a\s+)?promotional\s+poster/.test(t)) return { which: 'newest' };
  const m = t.match(/phone(?:\s*-?\s*cut)?\s+poster\s+for\s+(?:the\s+)?film\s+([a-z0-9-]+)/);
  return m ? { which: m[1] } : null;
}

function drawPoster(meta) {
  // simple canvas poster description; real draw would use canvas like poster.js
  return { title: meta.title || 'V01D FILM', subtitle: 'Phone-cut promo · ' + (meta.day || ''), text: 'Watch free at a-to-mind.com/films' };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = posterOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film poster</h2><div class="sub">generating…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (!api._pageStill || !api._pageStill(el)) return 'phone-poster';
    const all = (j.films || []).map(filmMeta);
    const meta = q.which === 'newest' ? all[0] : all.find((f) => f.experiment === q.which || f.id === q.which);
    if (!meta) {
      el.innerHTML = '<h2>Phone-cut film poster</h2><p>No matching film found. Try "film metadata" to list them.</p>';
      return 'phone-poster';
    }
    const p = drawPoster(meta);
    el.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">' + esc(p.subtitle) + '</div><h3>' + esc(p.title) + '</h3><p>' + esc(p.text) + '</p><div class="src">Generated from V01D film metadata · empty stage stays empty</div>';
    return 'phone-poster';
  } catch (_) {
    el.innerHTML = '<h2>Phone-cut film poster</h2><p>Could not load films just now.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-poster',
  examples: ['phone poster for the film', 'generate promotional poster for phone-cut', 'auto poster for newest film', 'phone-cut films promotional poster'],
  nearMisses: ['film poster', 'make this a poster', 'films', 'movie poster for inception'],
  match(lower, text) { return !!posterOf(text || lower); },
  run,
  suite() {
    const ok = !!posterOf('phone poster for the film') && posterOf('hello') === null && posterOf('make this a poster') === null;
    return { ok, got: 'phone-poster match' };
  },
};
