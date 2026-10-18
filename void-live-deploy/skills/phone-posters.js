/**
 * phone-posters skill — auto-generates promotional posters for phone-cut films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone cut film posters", "generate promo posters for phone films", "phone-cut posters".
 * Builds on filmMeta and poster layout from existing skills. Empty surface stays empty.
 */
import { filmMeta } from './films.js';
import { filmCard } from './poster.js';

export function phonePostersOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:auto[- ]?generate|make|create|show)\s+(?:promotional\s+)?(?:posters?\s+for\s+)?(?:phone[- ]?cut\s+)?(?:films?|shorts?)\s*(?:posters?)?$|^phone[- ]?cut\s+film\s+posters?$|^promo\s+posters?\s+for\s+phone\s+films?$/i.test(t);
}

async function run(text, api) {
  if (!phonePostersOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film posters</h2><div class="sub">looking up recent films…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'phone-posters';
    const films = (j.films || []).slice(0, 3).map(filmMeta);
    if (!films.length) {
      el.innerHTML = '<h2>Phone-cut film posters</h2><p>No films yet. Say <b>films</b> to see them.</p>';
      return 'phone-posters';
    }
    let html = '<h2>Phone-cut film posters</h2><div class="sub">Auto-generated promo posters (phone story size) for recent films</div>';
    for (const meta of films) {
      const card = filmCard(meta);
      html += '<div class="vfilm-card" style="margin:10px 0;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.1)"><b>' + esc(card.title) + '</b><div class="sub">' + esc(card.text.split('\n')[0]) + '</div><p>Phone story poster ready (1080×1920)</p></div>';
    }
    html += '<div class="src">From /api/films · uses existing poster layout</div>';
    el.innerHTML = html;
    return 'phone-posters';
  } catch (_) {
    if (api._pageStill && !api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Phone-cut film posters</h2><p>The films could not be read just now. Try again in a minute.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-posters',
  examples: ['phone cut film posters', 'generate promo posters for phone films', 'phone-cut posters', 'auto generate promotional posters for phone-cut films'],
  nearMisses: ['films', 'film poster', 'make this a poster', 'movie posters'],
  match(lower, text) { return phonePostersOf(text); },
  run,
  suite() {
    return { ok: !!phonePostersOf('phone cut film posters') && !phonePostersOf('films') && !phonePostersOf('hello') };
  },
};
