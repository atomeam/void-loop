/**
 * phone-poster skill — auto-generates promotional posters for V01D films, phone-cut (9:16).
 * "make a phone poster for the newest film", "phone-cut promotional poster", "generate promo poster for film miss-board-4".
 * Uses film metadata from /api/films. Draws in this browser. Empty surface stays empty.
 */
import { filmMeta } from './films.js';

export function phonePosterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:make|generate|create|draw)\s+(?:a\s+)?(?:phone[-\s]?cut\s+)?(?:promo(?:tional)?\s+)?poster\s+(?:for\s+)?(?:the\s+)?(?:newest\s+)?(?:v01d\s+|void\s+)?films?$/.test(t)) return { which: 'newest' };
  if (/phone[-\s]?cut\s+(?:promo(?:tional)?\s+)?poster|promo(?:tional)?\s+poster\s+for\s+(?:phone|films?)/.test(t)) return { which: 'newest' };
  const m = t.match(/poster\s+for\s+(?:the\s+)?film\s+([a-z0-9][a-z0-9-]{2,40})/);
  if (m && /phone|promo|promotional|cut/.test(t)) return { which: m[1] };
  return null;
}

function drawPhone(meta) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  g.fillStyle = '#07070b'; g.fillRect(0, 0, 1080, 1920);
  const glow = g.createRadialGradient(540, 700, 0, 540, 700, 900);
  glow.addColorStop(0, 'rgba(255,61,127,0.35)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = '#fff'; g.font = '700 72px ui-sans-serif, system-ui, sans-serif';
  g.fillText('V01D FILMS', 80, 280);
  g.font = '600 56px ui-sans-serif, system-ui, sans-serif';
  const title = String(meta.title || meta.experiment || 'Now showing').slice(0, 40);
  g.fillText(title, 80, 420);
  g.font = '400 36px ui-sans-serif, system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.8)';
  g.fillText('An AI built this by itself', 80, 520);
  g.fillText('Watch free · a-to-mind.com/films', 80, 1680);
  return c;
}

async function run(text, api) {
  const want = phonePosterOf(text);
  if (!want) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film poster</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'phone-poster';
    const all = (j.films || []).map(filmMeta);
    const meta = want.which === 'newest' ? all[0] : all.find((f) => f.experiment === want.which || f.id === want.which);
    if (!meta) { el.innerHTML = '<h2>Phone-cut film poster</h2><p>No matching film just now.</p>'; return 'phone-poster'; }
    const c = drawPhone(meta);
    el.innerHTML = '<h2>Phone-cut promo · ' + esc(meta.title || meta.experiment) + '</h2><img src="' + c.toDataURL('image/png') + '" alt="Phone poster" style="max-width:100%;max-height:60vh;border-radius:12px"><p class="src">Drawn here. Nothing uploaded.</p>';
    return 'phone-poster';
  } catch (_) {
    if (api._pageStill && !api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Phone-cut film poster</h2><p>Could not read the films just now.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-poster',
  examples: ['make a phone poster for the newest film', 'phone-cut promotional poster', 'generate promo poster for film'],
  nearMisses: ['make this a poster', 'film metadata', 'films'],
  match(lower, text) { return !!phonePosterOf(text); },
  run,
  suite() {
    const hit = phonePosterOf('make a phone poster for the newest film');
    return { ok: !!hit && hit.which === 'newest' && phonePosterOf('hello') === null };
  },
};
