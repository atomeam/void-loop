/**
 * phone-poster skill — phone-cut films skill auto-generates promotional posters.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone cut film poster", "generate promotional poster for newest film", "auto poster for v01d films".
 * Fetches V01D films from /api/films and draws a 9:16 phone story poster in the browser. Empty surface stays empty.
 */
import { filmMeta } from './films.js';

export function phonePosterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:phone[-\s]?cut\s+)?(?:films?\s+)?(?:auto[-\s]?generate\s+)?(?:promotional\s+)?poster(?:s)?(?:\s+for\s+(?:the\s+)?(?:newest\s+)?films?)?$/.test(t)
    || /^(?:generate|make|create|auto)\s+(?:a\s+)?(?:phone[-\s]?cut\s+)?(?:promotional\s+)?poster(?:\s+for\s+(?:the\s+)?(?:newest\s+)?film)?$/.test(t);
}

const STORY = { w: 9, h: 16, name: 'phone story', px: [1080, 1920] };

function layoutPoster({ title, text }, w, h, measure) {
  const margin = Math.round(w * 0.08), inner = w - 2 * margin, lines = [];
  const wrap = (s, size) => {
    const out = []; let cur = '';
    for (const word of String(s).split(/\s+/).filter(Boolean)) {
      const next = cur ? cur + ' ' + word : word;
      if (measure(next, size) <= inner || !cur) cur = next; else { out.push(cur); cur = word; }
    }
    if (cur) out.push(cur);
    return out.map((l) => { while (l.length > 1 && measure(l, size) > inner) l = l.slice(0, -2) + '…'; return l; });
  };
  const titleSize = Math.round(w * 0.07), bodySize = Math.round(w * 0.028), markSize = Math.round(w * 0.016);
  let y = margin + titleSize;
  for (const l of wrap(title || 'V01D', titleSize).slice(0, 3)) { lines.push({ text: l, size: titleSize, x: margin, y, weight: 600 }); y += titleSize * 1.15; }
  y += bodySize * 1.2;
  const foot = h - margin, last = foot - markSize * 3;
  for (const para of String(text || '').split(/\n+/).map((p) => p.trim()).filter(Boolean)) {
    for (const l of wrap(para, bodySize)) {
      if (y > last) break;
      lines.push({ text: l, size: bodySize, x: margin, y, weight: 400 }); y += bodySize * 1.45;
    }
    y += bodySize * 0.6;
  }
  lines.push({ text: 'a-to-mind.com', size: markSize, x: margin, y: foot, weight: 400, mark: true });
  return { margin, lines };
}

function draw(card, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#07070b'; g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.7);
  glow.addColorStop(0, 'rgba(120,130,255,0.16)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
  const font = (size, weight) => `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  const measure = (t, size) => { g.font = font(size, 400); return g.measureText(t).width; };
  const L = layoutPoster(card, w, h, measure);
  for (const l of L.lines) { g.font = font(l.size, l.weight); g.fillStyle = l.mark ? 'rgba(255,255,255,0.45)' : '#f2f2f7'; g.fillText(l.text, l.x, l.y); }
  return c;
}

function filmCard(meta) {
  const title = String(meta.title || meta.experiment || 'V01D FILMS').replace(/\s*\|.*$/, '').trim() || 'V01D FILMS';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(meta.day || '') ? new Date(meta.day + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
  return { title, text: 'V01D FILMS · Now showing' + (day ? ' · ' + day : '') + '\nAn AI built this experiment by itself and filmed it.\nWatch free at a-to-mind.com/films' };
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!phonePosterOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">generating for newest film…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    const all = (j.films || []).map(filmMeta);
    const meta = all[0];
    if (!meta) { el.innerHTML = '<h2>Phone-cut promotional poster</h2><p>No films yet. Ask again later.</p>'; return 'phone-poster'; }
    if (api._pageStill && !api._pageStill(el)) return 'phone-poster';
    const card = filmCard(meta);
    const [pw, ph] = STORY.px, k = 900 / ph;
    const preview = draw(card, Math.round(pw * k), 900).toDataURL('image/png');
    el.innerHTML = '<h2>Phone-cut promotional poster</h2><p>For: ' + esc(card.title) + '</p><img src="' + preview + '" alt="Phone poster" style="max-width:100%;max-height:46vh;display:block;margin:8px auto;border-radius:6px">'
      + '<button type="button" class="poster-dl" style="margin:8px 0;padding:6px 14px;border-radius:8px;border:1px solid #444;background:transparent;color:inherit;cursor:pointer">Download phone story (1080×1920)</button>'
      + '<div class="src">Drawn in this browser from /api/films. Nothing uploaded.</div>';
    el.querySelector('.poster-dl').addEventListener('click', () => draw(card, 1080, 1920).toBlob((blob) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'v01d-phone-poster.png';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png'));
    return 'phone-poster';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Phone-cut promotional poster</h2><p>The films could not be read just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-poster',
  examples: ['phone cut film poster', 'generate promotional poster for newest film', 'auto poster for v01d films'],
  nearMisses: ['film poster', 'make this a poster', 'posters'],
  match(lower, text) { return phonePosterOf(text); },
  run,
  suite() {
    return { ok: phonePosterOf('phone cut film poster') && !phonePosterOf('hello') };
  },
};
