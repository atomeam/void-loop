/**
 * phone-cut-posters skill — auto-generates promotional posters for phone-cut films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite() }
 * "phone cut film poster", "promotional poster for newest film", "auto poster for phone film".
 * Uses /api/films (no key). Draws a simple 9:16 story poster in the browser. Empty surface stays empty.
 */
import { filmMeta } from './films.js';

export function phonePosterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:make|create|generate|auto)\s+)?(?:a\s+)?(?:phone[- ]?cut\s+)?(?:promotional\s+)?poster\s+(?:for\s+)?(?:the\s+)?(?:newest\s+|latest\s+)?(?:phone[- ]?cut\s+)?films?$/.test(t)
    || /phone[- ]?cut\s+film\s+poster/.test(t);
}

function drawStory(meta) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  g.fillStyle = '#07070b'; g.fillRect(0, 0, 1080, 1920);
  const glow = g.createRadialGradient(540, 700, 0, 540, 700, 900);
  glow.addColorStop(0, 'rgba(255,72,120,0.35)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = '#fff'; g.font = '700 72px system-ui, sans-serif';
  const title = String(meta.title || 'V01D FILMS').replace(/\s*\|.*$/, '').slice(0, 40);
  g.fillText(title, 80, 400);
  g.font = '400 36px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillText('Phone-cut promo · Watch free', 80, 500);
  g.fillText('a-to-mind.com/films', 80, 1700);
  return c;
}

async function run(text, api) {
  const { showPage, esc, _pageStill } = api;
  if (!phonePosterOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film poster</h2><div class="sub">generating…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (_pageStill && !_pageStill(el)) return 'phone-cut-posters';
    const films = (j.films || []).map(filmMeta);
    const meta = films[0];
    if (!meta) {
      el.innerHTML = '<h2>Phone-cut film poster</h2><p>No films yet. Try again later.</p>';
      return 'phone-cut-posters';
    }
    const canvas = drawStory(meta);
    el.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">' + esc(meta.title || 'Newest film') + '</div>'
      + '<img alt="Phone story poster" style="max-width:100%;max-height:60vh;border-radius:12px;margin:12px auto;display:block" src="' + canvas.toDataURL('image/png') + '">'
      + '<div class="src">Generated in the browser from /api/films. Nothing uploaded.</div>';
    return 'phone-cut-posters';
  } catch (_) {
    if (_pageStill && !_pageStill(el)) return 'none';
    el.innerHTML = '<h2>Phone-cut film poster</h2><p>Could not load films just now.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-cut-posters',
  examples: ['phone cut film poster', 'promotional poster for newest film', 'auto poster for phone film', 'make a phone-cut poster'],
  nearMisses: ['films', 'make this a poster', 'film poster', 'best movies'],
  match(lower, text) { return phonePosterOf(text); },
  run,
  suite() {
    return { ok: phonePosterOf('phone cut film poster') && !phonePosterOf('hello') };
  },
};
