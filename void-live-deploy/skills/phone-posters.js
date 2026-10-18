/**
 * phone-posters skill — auto-generates promotional posters for phone-cut (vertical/short) V01D films.
 * Contract: { name, examples, nearMisses, match, run, suite }
 * "phone-cut film poster", "generate promo poster for shorts", "phone film posters".
 * Draws a 9:16 phone story poster in-browser from latest film metadata. Empty surface stays empty. No secrets.
 */
import { filmMeta } from './films.js';

export function phonePosterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:generate|make|create|auto-?generate)\s+)?(?:promotional?\s+|promo\s+)?(?:phone-?cut\s+|vertical\s+|short\s+)?(?:film\s+)?posters?(?:\s+for\s+(?:phone-?cut\s+|the\s+)?(?:films?|shorts))?$/.test(t)
    || /phone-?cut films? skill.*posters?/.test(t);
}

function drawPoster(title, day) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a12'; g.fillRect(0, 0, 1080, 1920);
  const glow = g.createRadialGradient(540, 700, 0, 540, 700, 800);
  glow.addColorStop(0, 'rgba(255,80,140,0.25)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = '#fff'; g.font = 'bold 72px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText(title.slice(0, 40), 540, 900);
  g.font = '28px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillText('V01D FILMS · Phone Cut', 540, 1000);
  if (day) g.fillText(day, 540, 1060);
  g.fillText('Watch free at a-to-mind.com/films', 540, 1700);
  return c.toDataURL('image/png');
}

async function run(text, api) {
  if (!phonePosterOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film poster</h2><div class="sub">generating…</div>'; });
  let title = 'V01D Short', day = '';
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    const all = (j.films || []).map(filmMeta);
    if (all[0]) { title = all[0].title || all[0].experiment || title; day = all[0].day || ''; }
  } catch (_) {}
  if (api._pageStill && !api._pageStill(el)) return 'phone-posters';
  const src = drawPoster(title, day);
  el.innerHTML = '<h2>Phone-cut film poster</h2><div class="sub">' + esc(title) + (day ? ' · ' + esc(day) : '') + '</div>'
    + '<img src="' + src + '" alt="Promo poster" style="max-width:100%;max-height:50vh;display:block;margin:12px auto;border-radius:12px">'
    + '<p class="src">Drawn in this browser from the latest V01D film. Nothing uploaded. Download the image if you like.</p>';
  return 'phone-posters';
}

export default {
  name: 'phone-posters',
  examples: ['phone-cut film poster', 'generate promo poster for shorts', 'phone film posters', 'auto-generate promotional posters'],
  nearMisses: ['make this a poster', 'film poster', 'what is a poster', 'movie poster for inception'],
  match(lower, text) { return phonePosterOf(text); },
  run,
  suite() {
    return { ok: phonePosterOf('phone-cut film poster') && !phonePosterOf('hello world') };
  },
};
