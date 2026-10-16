/**
 * promo-poster skill — auto-generates promotional posters for V01D phone-cut films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "promo poster for the newest film", "phone poster for miss-board-4", "generate promotional poster".
 * Uses film metadata from /api/films (via films.js filmMeta). Draws a 9:16 phone story in the browser.
 * Empty surface stays empty.
 */
import { filmMeta } from './films.js';

export function promoOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:(?:make|generate|create|auto-generate)\s+)?(?:an?\s+)?(?:promo(?:tional)?\s+|phone(?:-cut)?\s+)?poster\s+(?:for|of)\s+(?:the\s+)?(?:newest\s+|latest\s+)?(?:v01d\s+|void\s+)?films?(?:\s+([a-z0-9-]+))?$/)
    || t.match(/^(?:promo\s+poster|phone\s+poster)$/);
  return m ? (m[1] || 'newest') : null;
}

function drawPhonePoster(card) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  g.fillStyle = '#07070b'; g.fillRect(0, 0, 1080, 1920);
  const glow = g.createLinearGradient(0, 0, 0, 1920);
  glow.addColorStop(0, 'rgba(255,72,120,0.4)'); glow.addColorStop(1, 'rgba(90,110,255,0.3)');
  g.fillStyle = glow; g.fillRect(0, 0, 1080, 1920);
  g.font = 'bold 72px ui-sans-serif, system-ui';
  g.fillStyle = '#f2f2f7';
  g.fillText(card.title.slice(0, 40), 80, 400);
  g.font = '36px ui-sans-serif, system-ui';
  g.fillStyle = 'rgba(255,255,255,0.8)';
  const lines = card.text.split('\n');
  lines.forEach((l, i) => g.fillText(l.slice(0, 50), 80, 520 + i * 50));
  g.font = '28px ui-sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillText('a-to-mind.com/films', 80, 1800);
  return c;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const which = promoOf(text);
  if (!which) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Promo poster for a V01D film</h2><div class="sub">loading…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    const all = (j.films || []).map(filmMeta);
    const meta = which === 'newest' ? all[0] : all.find((f) => f.experiment === which || f.id === which);
    if (!api._pageStill || !api._pageStill(el)) return 'promo-poster';
    if (!meta) {
      el.innerHTML = '<h2>Promo poster</h2><p>No matching V01D film found. Try "film metadata" to list them.</p>';
      return 'promo-poster';
    }
    const card = { title: meta.title || 'V01D FILMS', text: 'Now showing · ' + (meta.day || '') + '\nAn AI built this. Watch free.' };
    const canvas = drawPhonePoster(card);
    el.innerHTML = '<h2>Promo poster · ' + esc(meta.title || which) + '</h2>'
      + '<img src="' + canvas.toDataURL('image/png') + '" alt="Phone promo poster" style="max-width:100%;max-height:50vh;border-radius:8px;margin:8px 0">'
      + '<p class="sub">9:16 phone story, drawn in this browser. Nothing uploaded.</p>'
      + '<button type="button" class="dl">Download PNG</button>';
    el.querySelector('.dl').addEventListener('click', () => {
      canvas.toBlob((blob) => {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'v01d-promo-poster.png';
        document.body.appendChild(a); a.click(); a.remove();
      }, 'image/png');
    });
    return 'promo-poster';
  } catch (_) {
    if (api._pageStill && api._pageStill(el)) el.innerHTML = '<h2>Promo poster</h2><p>The films could not be read just now.</p>';
    return 'none';
  }
}

export default {
  name: 'promo-poster',
  examples: ['promo poster for the newest film', 'generate promotional poster', 'phone poster for the film', 'auto-generate a poster for the latest film'],
  nearMisses: ['make this a poster', 'film poster', 'best movie posters', 'how to make a poster'],
  match(lower, text) { return !!promoOf(text); },
  run,
  suite() {
    return { ok: promoOf('promo poster for the newest film') === 'newest' && promoOf('hello') === null };
  },
};
