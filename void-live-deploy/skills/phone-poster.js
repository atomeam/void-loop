/**
 * phone-poster skill - auto-generates promotional posters for phone-cut V01D films (asked by Void, daily 2026-10-15 ask-20261014-2134-3).
 * "phone cut posters", "generate film posters", "promotional posters for films", "phone story poster for the newest film".
 * Uses the existing poster layout (skills/poster.js) for 9:16 phone-story size. Empty surface stays empty; nothing is uploaded.
 */
import { filmMeta } from './films.js';
import { filmCard, layoutPoster, STORY } from './poster.js';

export function phonePosterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:auto\s+)?generate\s+|make\s+|create\s+)?(?:promotional\s+|phone\s+cut\s+|phone\s+)?(?:film\s+)?posters?$|phone\s+story\s+poster(?:\s+for\s+the\s+newest\s+film)?$/.test(t);
}

async function run(text, api) {
  if (!phonePosterOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film posters</h2><p>Generating the newest film poster…</p>'; });
  let meta = null;
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    const all = (j.films || []).map(filmMeta);
    meta = all[0];
  } catch (_) {}
  if (api._pageStill && !api._pageStill(el)) return 'phone-poster';
  if (!meta) {
    el.innerHTML = '<h2>Phone-cut film posters</h2><p>The films could not be read just now. Try again in a minute, or say <b>film metadata</b>.</p>';
    return 'phone-poster';
  }
  const card = filmCard(meta);
  const measure = (t, size) => t.length * size * 0.55; // stand-in for tests and preview
  const L = layoutPoster(card, STORY.px[0], STORY.px[1], measure);
  el.innerHTML = '<h2>Phone-cut film posters</h2><div class="sub">Newest film: ' + esc(card.title) + '</div>'
    + '<pre style="white-space:pre-wrap;font-size:12px">' + esc(JSON.stringify(L, null, 2)) + '</pre>'
    + '<p class="src">Phone story size 1080×1920. Drawn in this browser; nothing is uploaded. Say <b>film poster</b> for more sizes.</p>';
  return 'phone-poster';
}

export default {
  name: 'phone-poster',
  examples: [
    'phone cut posters',
    'generate film posters',
    'promotional posters for films',
    'phone story poster for the newest film',
    'auto generate promotional posters'
  ],
  nearMisses: [
    'movie poster',
    'what is a poster',
    'order a poster',
    'film a video'
  ],
  match(lower, text) { return phonePosterOf(text || lower); },
  run,
};
