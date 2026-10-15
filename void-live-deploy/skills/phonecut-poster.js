/**
 * phonecut-poster skill — phone-cut films skill auto-generates promotional posters.
 * Consumes film-metadata JSON to generate 9:16 phone-story promotional layouts.
 * "make a phone cut poster for the newest film", "promotional poster for v01d films".
 * Empty surface stays empty. Uses existing filmMeta and poster drawing where possible.
 */
import { filmMeta } from './films.js';
import { STORY, filmCard, layoutPoster } from './poster.js';

export function phoneCutOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^order\b/.test(t)) return null;
  const m = t.match(/^(?:(?:make|create|generate|auto.?generate)\s+)?(?:an?\s+)?(?:phone.?cut|phone.?story|promotional|promo)\s+(?:film\s+)?poster(?:\s+(?:for|of)\s+(?:the\s+)?(?:newest|latest|v01d|void)?\s*films?)?$/i)
    || t.match(/^phone.?cut\s+films?\s+(?:skill\s+)?(?:auto.?generate\s+)?(?:promotional\s+)?posters?$/i);
  return m ? { which: 'newest' } : null;
}

function drawPhone(card) {
  const [w, h] = STORY.px;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#07070b'; g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, Math.max(w, h) * 0.6);
  glow.addColorStop(0, 'rgba(255,61,127,0.22)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
  const font = (size, weight) => `${weight} ${size}px ui-sans-serif, system-ui, sans-serif`;
  const measure = (t, size) => { g.font = font(size, 400); return g.measureText(t).width; };
  const L = layoutPoster(card, w, h, measure);
  for (const l of L.lines) {
    g.font = font(l.size, l.weight);
    g.fillStyle = l.mark ? 'rgba(255,255,255,0.5)' : '#f2f2f7';
    g.fillText(l.text, l.x, l.y);
  }
  return c;
}

async function run(text, api) {
  const want = phoneCutOf(text);
  if (!want) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">generating from film metadata…</div>'; });
  let meta = null;
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    const all = (j.films || []).map(filmMeta);
    meta = all[0];
  } catch (_) {}
  if (api._pageStill && !api._pageStill(el)) return 'phonecut-poster';
  if (!meta) {
    el.innerHTML = '<h2>Phone-cut promotional poster</h2><p>No film metadata just now. Try <b>film metadata</b> or again in a moment.</p>';
    return 'phonecut-poster';
  }
  const card = filmCard(meta);
  const preview = drawPhone(card);
  el.innerHTML = '<h2>Phone-cut promotional poster</h2><p class="sub">From the newest V01D film · ' + esc(card.title) + '</p>'
    + '<img class="poster-preview" alt="Phone-cut poster" style="max-width:100%;max-height:50vh;display:block;margin:8px auto;border-radius:8px" src="' + preview.toDataURL('image/png') + '">'
    + '<button type="button" class="poster-size">Download 9:16 phone story (1080×1920)</button>'
    + '<div class="src">Generated from film metadata. Drawn in this browser; nothing uploaded.</div>';
  el.querySelector('button').addEventListener('click', () => {
    preview.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'v01d-phonecut-poster-1080x1920.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  });
  return 'phonecut-poster';
}

export default {
  name: 'phonecut-poster',
  examples: ['make a phone cut poster for the newest film', 'promotional poster for v01d films', 'phone-cut films skill auto-generates promotional posters'],
  nearMisses: ['make this a poster', 'film poster', 'order a poster'],
  match(lower, text) { return !!phoneCutOf(text); },
  run,
  suite() {
    return { ok: !!phoneCutOf('make a phone cut poster for the newest film') && phoneCutOf('hello') === null };
  },
};
