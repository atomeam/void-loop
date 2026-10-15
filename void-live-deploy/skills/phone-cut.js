/**
 * phone-cut skill — auto-generates promotional posters for phone-cut (vertical 9:16) films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone cut film poster", "auto generate promotional posters for phone cut films", "make a phone-cut poster".
 * Draws a 1080x1920 story poster in the browser for the newest V01D film (or a sample). Empty surface stays empty.
 */
import { filmMeta } from './films.js';

export function phoneCutOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /(?:phone.?cut|vertical)\s+(?:film\s+)?poster|auto.?generate\s+(?:promotional\s+)?posters?\s+(?:for\s+)?phone.?cut|promotional\s+posters?\s+for\s+phone.?cut\s+films?/.test(t);
}

function drawStory(title, subtitle) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  g.fillStyle = '#07070b'; g.fillRect(0, 0, 1080, 1920);
  const glow = g.createRadialGradient(540, 700, 0, 540, 700, 900);
  glow.addColorStop(0, 'rgba(255,61,127,0.3)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = '#f2f2f7';
  g.font = '600 72px ui-sans-serif, system-ui, sans-serif';
  g.fillText((title || 'V01D FILMS').slice(0, 28), 80, 400);
  g.font = '400 36px ui-sans-serif, system-ui, sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.fillText((subtitle || 'Now showing · free at a-to-mind.com/films').slice(0, 48), 80, 500);
  g.font = '400 28px ui-sans-serif, system-ui, sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillText('a-to-mind.com', 80, 1800);
  return c;
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!phoneCutOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">drawing…</div>'; });
  let title = 'V01D FILMS', sub = 'Phone-cut · Now showing';
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    const meta = (j.films || []).map(filmMeta)[0];
    if (meta) {
      title = String(meta.title || meta.experiment || 'V01D FILMS').replace(/\s*\|.*$/, '').trim();
      sub = 'V01D FILMS · ' + (meta.day || 'daily') + ' · free';
    }
  } catch (_) {}
  if (api._pageStill && !api._pageStill(el)) return 'phone-cut';
  const canvas = drawStory(title, sub);
  el.innerHTML = '<h2>Phone-cut promotional poster</h2><p>For the newest film (or sample). 1080×1920 story size. Drawn here; nothing uploaded.</p><img alt="Phone-cut poster" style="max-width:100%;max-height:50vh;display:block;margin:8px auto;border-radius:8px" src="' + canvas.toDataURL('image/png') + '"><div class="src">Source: newest V01D film metadata when available</div>';
  return 'phone-cut';
}

export default {
  name: 'phone-cut',
  examples: ['phone cut film poster', 'auto generate promotional posters for phone cut films', 'make a phone-cut poster', 'promotional poster for phone-cut films'],
  nearMisses: ['make this a poster', 'film poster', 'best films of 2025', 'how do I film a video'],
  match(lower, text) { return phoneCutOf(text); },
  run,
  suite() {
    return { ok: phoneCutOf('phone cut film poster') && !phoneCutOf('hello world') };
  },
};
