/**
 * phone-cut-poster skill - auto-generates promotional posters for phone-cut (vertical 9:16) V01D films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone-cut poster", "auto poster for phone-cut film", "generate promotional poster for the newest phone cut".
 * Empty surface stays empty. Uses /api/films and draws in-browser, nothing uploaded.
 */
import { filmMeta } from './films.js';
import { filmCard, layoutPoster, STORY } from './poster.js';

export function phoneCutOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:auto(?:-?generate)?\s+)?(?:promotional\s+)?(?:phone-?cut\s+)?(?:film\s+)?poster(?:\s+for\s+(?:the\s+)?(?:newest|latest)?\s*phone-?cut(?:\s+film)?)?$/.test(t)
    || /^phone-?cut\s+(?:films?\s+)?(?:skill\s+)?(?:auto-?generates?\s+)?promotional\s+posters?$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!phoneCutOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">…</div>'; });
  let meta = null;
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    const all = (j.films || []).map(filmMeta);
    meta = all[0]; // newest
  } catch (_) {}
  if (api._pageStill && !api._pageStill(el)) return 'phone-cut-poster';
  if (!meta) {
    el.innerHTML = '<h2>Phone-cut promotional poster</h2><p>The films could not be read just now. Try again in a minute.</p>';
    return 'phone-cut-poster';
  }
  const card = filmCard(meta);
  // draw phone story size
  const c = document.createElement('canvas'); c.width = STORY.px[0]; c.height = STORY.px[1];
  const g = c.getContext('2d');
  g.fillStyle = '#07070b'; g.fillRect(0, 0, c.width, c.height);
  const font = (size, weight) => `${weight} ${size}px ui-sans-serif, system-ui, sans-serif`;
  const measure = (t, size) => { g.font = font(size, 400); return g.measureText(t).width; };
  const L = layoutPoster(card, c.width, c.height, measure);
  for (const l of L.lines) { g.font = font(l.size, l.weight); g.fillStyle = l.mark ? 'rgba(255,255,255,0.45)' : '#f2f2f7'; g.fillText(l.text, l.x, l.y); }
  const data = c.toDataURL('image/png');
  el.innerHTML = '<h2>Phone-cut promotional poster</h2><p class="sub">Auto-generated for the newest V01D film · 9:16</p><img src="' + data + '" alt="Phone-cut poster" style="max-width:100%;max-height:60vh;display:block;margin:8px auto;border-radius:6px"><button type="button" class="g-btn" id="dl">Download 1080×1920</button><div class="src">Drawn in this browser; nothing is uploaded.</div>';
  el.querySelector('#dl').addEventListener('click', () => {
    const a = document.createElement('a'); a.href = data; a.download = 'v01d-phone-cut-poster.png'; document.body.appendChild(a); a.click(); a.remove();
  });
  return 'phone-cut-poster';
}

export default {
  name: 'phone-cut-poster',
  examples: ['phone-cut poster', 'auto poster for phone-cut film', 'generate promotional poster for the newest phone cut'],
  nearMisses: ['film poster', 'make this a poster', 'movie poster'],
  match(lower, text) { return phoneCutOf(text || lower); },
  run,
  suite() {
    return { ok: phoneCutOf('phone-cut poster') && !phoneCutOf('film poster') };
  },
};
