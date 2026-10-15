/**
 * phone-cut skill — auto-generates promotional posters for phone-cut (vertical 9:16) V01D films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone-cut film poster", "auto generate promo poster for phone cut", "phone cut films skill".
 * Reuses film metadata; draws a 1080x1920 story poster in the browser. Empty surface stays empty.
 */
import { filmMeta } from './films.js';

export function phoneCutOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:auto[\s-]?generate[\s-]?|make[\s-]?|create[\s-]?)?(?:promotional[\s-]?|promo[\s-]?)?poster[\s-]?(?:for[\s-]?)?(?:the[\s-]?)?(?:phone[\s-]?cut|phonecut|vertical)[\s-]?(?:films?|videos?)?$|^phone[\s-]?cut[\s-]?(?:films?[\s-]?)?skill$/i.test(t) ||
    /phone[\s-]?cut.*poster|poster.*phone[\s-]?cut/i.test(t);
}

async function run(text, api) {
  if (!phoneCutOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film poster</h2><div class="sub">generating promotional poster…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (!api._pageStill(el)) return 'phone-cut';
    const films = (j.films || []).map(filmMeta);
    const meta = films[0];
    if (!meta) {
      el.innerHTML = '<h2>Phone-cut film poster</h2><p>No films yet. Check back after the next daily film.</p>';
      return 'phone-cut';
    }
    const title = (meta.title || 'V01D FILMS').replace(/\s*\|.*$/, '').trim();
    const day = meta.day || '';
    // Simple canvas poster 1080x1920
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const g = c.getContext('2d');
    g.fillStyle = '#0a0a12'; g.fillRect(0, 0, 1080, 1920);
    const grad = g.createLinearGradient(0, 0, 0, 1920);
    grad.addColorStop(0, 'rgba(255,61,127,0.4)'); grad.addColorStop(1, 'rgba(90,110,255,0.3)');
    g.fillStyle = grad; g.fillRect(0, 0, 1080, 1920);
    g.fillStyle = '#fff'; g.font = 'bold 72px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(title.slice(0, 30), 540, 400);
    g.font = '32px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillText('Phone-cut · 9:16', 540, 500);
    if (day) g.fillText(day, 540, 560);
    g.font = '24px system-ui, sans-serif';
    g.fillText('Watch free at a-to-mind.com/films', 540, 1700);
    const url = c.toDataURL('image/png');
    el.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">Auto-generated for the newest film: ' + esc(title) + '</div>' +
      '<img src="' + url + '" alt="Phone-cut poster" style="max-width:100%;max-height:60vh;display:block;margin:12px auto;border-radius:12px">' +
      '<button type="button" class="poster-dl">Download 1080×1920</button>' +
      '<div class="src">Drawn in this browser · nothing uploaded</div>';
    el.querySelector('.poster-dl').addEventListener('click', () => {
      const a = document.createElement('a'); a.href = url; a.download = 'v01d-phone-cut-poster.png';
      document.body.appendChild(a); a.click(); a.remove();
    });
    return 'phone-cut';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Phone-cut film poster</h2><p>Could not load films just now. Try again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-cut',
  examples: ['phone-cut film poster', 'auto generate promotional poster for phone cut', 'phone cut films skill'],
  nearMisses: ['film poster', 'make this a poster', 'phone', 'cut film'],
  match(lower, text) { return !!phoneCutOf(text); },
  run,
  suite() {
    return { ok: !!phoneCutOf('phone-cut film poster') && !phoneCutOf('hello world') };
  },
};
