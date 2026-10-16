/**
 * film-promo skill: "phone cut film poster", "auto promo poster", "promotional poster for the newest film" — auto-generates a phone-story promotional poster for a V01D film.
 * Reads the newest film's metadata (/api/films) and draws a 9:16 phone promo poster in this browser. Empty surface stays empty: no film, no poster.
 * Asked by Void (ask-20261014-2134-3): phone-cut films skill auto-generates promotional posters.
 */
import { filmMeta } from './films.js';
import { filmCard, STORY, layoutPoster } from './poster.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK_RE = /^(?:(?:make|create|draw|give|auto(?:-?generate)?|generate)\s+)?(?:an?\s+)?(?:phone(?:\s+cut|\s+story)?\s+)?(?:promo(?:tional)?\s+)?poster\s+(?:for\s+(?:the\s+)?(?:newest\s+)?(?:v01d\s+)?films?|for\s+films|of\s+the\s+newest\s+film)$|^(?:phone\s+cut\s+films?\s+(?:skill\s+)?(?:auto(?:-?generates?)?\s+)?(?:promo(?:tional)?\s+)?posters?)$/;
export function filmPromoOf(text) { return ASK_RE.test(CLEAN(text)); }

function drawPhone(card) {
  const [w, h] = STORY.px;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#07070b'; g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, Math.max(w, h) * 0.65);
  glow.addColorStop(0, 'rgba(255,72,120,0.28)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
  const font = (size, weight) => `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  const measure = (t, size) => { g.font = font(size, 400); return g.measureText(t).width; };
  const L = layoutPoster(card, w, h, measure);
  for (const l of L.lines) { g.font = font(l.size, l.weight); g.fillStyle = l.mark ? 'rgba(255,255,255,0.45)' : '#f2f2f7'; g.fillText(l.text, l.x, l.y); }
  return c;
}

async function run(text, api) {
  if (!filmPromoOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone promo poster</h2><div class="sub">\u2026</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    const all = (j.films || []).map(filmMeta);
    const meta = all[0];
    if (api._pageStill && !api._pageStill(el)) return 'film-promo';
    if (!meta) { el.innerHTML = '<h2>Phone promo poster</h2><p>No V01D film yet. Say <b>films</b> to see the page.</p>'; return 'film-promo'; }
    const card = filmCard(meta);
    const c = drawPhone(card);
    el.innerHTML = '<h2>Phone promo poster</h2><p class="sub">For the newest film: ' + esc(card.title) + '</p>'
      + '<img class="poster-preview" alt="Phone promo poster" style="max-width:100%;max-height:46vh;display:block;margin:8px auto;border-radius:6px" src="' + c.toDataURL('image/png') + '">'
      + '<button type="button" class="poster-size">Download the phone story (1080\u00d71920 px)</button>'
      + '<div class="src">Drawn in this browser from the film metadata. Nothing is uploaded. Empty stage stays empty.</div>';
    el.querySelector('button').addEventListener('click', () => c.toBlob((blob) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'v01d-film-promo-1080x1920.png';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png'));
  } catch (_) {
    el.innerHTML = '<h2>Phone promo poster</h2><p>The films could not be read just now. Try again in a minute.</p>';
  }
  return 'film-promo';
}

export default {
  name: 'film-promo',
  examples: ['phone cut film poster', 'auto promo poster for the newest film', 'promotional poster for films', 'generate phone promo poster'],
  nearMisses: ['make this a poster', 'film poster', 'best films', 'how to make a poster'],
  match(lower, text) { return filmPromoOf(text); },
  run,
  suite() {
    const ok = filmPromoOf('phone cut film poster') && filmPromoOf('auto promo poster for the newest film') && !filmPromoOf('make this a poster') && !filmPromoOf('best films of 2025');
    return { ok, got: ok ? 'matched' : 'missed' };
  },
};
