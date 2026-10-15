/**
 * phone-posters skill — auto-generates promotional posters for phone-cut V01D films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "generate promotional posters for phone films", "phone-cut film posters", "auto posters for vertical films".
 * Uses existing film metadata and poster layout. Empty surface stays empty.
 */
import { filmMeta } from './films.js';
import { STORY, filmCard, layoutPoster } from './poster.js';

export function phonePostersOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:auto[- ]?generate|generate|make|create|draw)\s+(?:promotional\s+|promo\s+)?)?(?:phone[- ]?cut\s+)?(?:films?\s+)?(?:posters?|promo\s+cards?)(?:\s+(?:for|of)\s+(?:phone[- ]?cut\s+)?(?:v0?1d\s+)?films?)?$/i.test(t)
    || /phone[- ]?cut\s+films?\s+(?:skill\s+)?auto[- ]?generates?\s+promotional\s+posters?/i.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film posters</h2><div class="sub">looking up films…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'phone-posters';
    const metas = (j.films || []).map(filmMeta).slice(0, 3);
    if (!metas.length) { el.innerHTML = '<h2>Phone-cut film posters</h2><p>No films yet. Say <b>films</b> to see them.</p>'; return 'phone-posters'; }
    el.innerHTML = '<h2>Phone-cut film posters</h2><div class="sub">' + esc(metas.length + ' promotional story posters (9:16)') + '</div>'
      + metas.map((m) => {
          const card = filmCard(m);
          return '<div style="margin:12px 0;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:12px"><b>' + esc(card.title) + '</b><div class="sub">' + esc(card.text.split('\n')[0]) + '</div><p>Story size ready: ' + STORY.px[0] + '×' + STORY.px[1] + ' px</p></div>';
        }).join('')
      + '<div class="src">From /api/films · use "film poster" for a single download</div>';
    return 'phone-posters';
  } catch (_) {
    if (api._pageStill && !api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Phone-cut film posters</h2><p>Could not read films just now.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-posters',
  examples: ['generate promotional posters for phone films', 'phone-cut film posters', 'auto-generate promo posters', 'phone-cut films skill auto-generates promotional posters'],
  nearMisses: ['films', 'film poster', 'make this a poster', 'best movie posters'],
  match(lower, text) { return phonePostersOf(text); },
  run,
  suite() {
    return { ok: phonePostersOf('phone-cut film posters') && phonePostersOf('generate promotional posters for phone films') && !phonePostersOf('films') && !phonePostersOf('make this a poster') };
  },
};
