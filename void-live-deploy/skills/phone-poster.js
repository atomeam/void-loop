/**
 * phone-poster skill - auto-generates promotional posters for phone-cut films
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone poster for the newest film", "generate a promo poster for miss-board-4", "phone-cut film poster".
 * Draws a 9:16 phone story poster from the film's metadata, nothing uploaded.
 */
import { filmMeta } from './films.js';

export function phonePosterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!/phone|promo|promotional|story/.test(t) || !/poster|film/.test(t)) return null;
  const m = t.match(/(?:for|of)\s+(?:the\s+)?(?:film\s+)?([a-z0-9][a-z0-9-]{2,60}-\d+)/);
  if (m) return { which: m[1] };
  if (/newest|latest|new/.test(t)) return { which: 'newest' };
  return { which: 'newest' };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const want = phonePosterOf(text);
  if (!want) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone promotional poster</h2><p>Generating…</p>'; });
  let meta = null;
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    const all = (j.films || []).map(filmMeta);
    meta = want.which === 'newest' ? all[0] : all.find((f) => f.experiment === want.which || f.id === want.which);
  } catch (_) {}
  if (!meta) {
    el.innerHTML = '<h2>Phone promotional poster</h2><p>No film found. Try <b>film metadata</b> first.</p>';
    return 'phone-poster';
  }
  const title = String(meta.title || meta.experiment || 'VERSE FILM').replace(/\s*\|.*$/, '').trim();
  const day = meta.day || '';
  el.innerHTML = '<h2>Phone promotional poster</h2>'
    + '<div class="sub">' + esc(title) + (day ? ' · ' + esc(day) : '') + '</div>'
    + '<div style="aspect-ratio:9/16;max-width:270px;margin:12px auto;background:#07070b;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#f2f2f7;text-align:center;padding:20px">'
    + '<div><b style="font-size:22px">' + esc(title) + '</b><br><span style="font-size:14px;color:#aaa">VERSE FILMS<br>Phone story promo</span></div></div>'
    + '<p class="src">9:16 phone-cut promotional poster drawn here. Nothing uploaded. Download from the full poster skill for print sizes.</p>';
  return 'phone-poster';
}

export default {
  name: 'phone-poster',
  examples: [
    'phone poster for the newest film',
    'generate a promotional poster for miss-board-4',
    'phone-cut film poster',
    'make a phone story poster for the latest film'
  ],
  nearMisses: [
    'what is a poster',
    'film metadata',
    'order a poster'
  ],
  match(lower, text) { return !!phonePosterOf(text); },
  run
};
