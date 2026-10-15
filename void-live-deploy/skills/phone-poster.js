/**
 * phone-poster skill — phone-cut films skill auto-generates promotional posters.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "generate phone poster", "phone-cut film poster", "auto poster for the newest phone film".
 * Uses the existing film poster layout from poster.js (9:16 story size for phone-cut films).
 * Empty surface stays empty.
 */
import { filmPosterOf, filmCard, STORY, layoutPoster } from './poster.js';

export function phoneOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:auto[-\s]?generate\s+)?(?:phone[-\s]?cut\s+)?(?:film\s+)?(?:promo(?:tional)?\s+)?poster(?:\s+for\s+(?:the\s+)?(?:newest\s+|latest\s+)?(?:phone[-\s]?cut\s+)?films?)?$|^generate\s+(?:a\s+)?phone\s+poster$|^phone\s+poster\s+for\s+(?:the\s+)?newest\s+film$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!phoneOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film poster</h2><p>Generating a promotional poster for the newest phone-cut film…</p>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    const all = (j.films || []).map((f) => ({ id: f.id, day: (f.at || '').slice(0, 10), experiment: (String(f.id || '').match(/^\d{8}-(.+?)-r\d+$/) || [])[1] || '', title: f.title || '', tags: f.tags || [], source: '', watch: 'https://a-to-mind.com/films/' }));
    const meta = all[0];
    if (!meta) {
      el.innerHTML = '<h2>Phone-cut film poster</h2><p>No films yet. The phone-cut films are made daily by the record workflow.</p>';
      return 'phone-poster';
    }
    const card = filmCard(meta);
    el.innerHTML = '<h2>Phone-cut film poster</h2><p>From ' + esc(card.title) + '</p><canvas id="pp" width="' + STORY.px[0] + '" height="' + STORY.px[1] + '" style="max-width:100%;border-radius:8px"></canvas><p class="src">9:16 phone story size, matching the phone-cut films. Drawn in this browser.</p>';
    const c = el.querySelector('#pp');
    const g = c.getContext('2d');
    g.fillStyle = '#07070b'; g.fillRect(0, 0, c.width, c.height);
    const measure = (t, size) => { g.font = size + 'px sans-serif'; return g.measureText(t).width; };
    const L = layoutPoster(card, c.width, c.height, measure);
    for (const l of L.lines) {
      g.font = l.weight + ' ' + l.size + 'px sans-serif';
      g.fillStyle = l.mark ? 'rgba(255,255,255,0.45)' : '#f2f2f7';
      g.fillText(l.text, l.x, l.y);
    }
    return 'phone-poster';
  } catch (_) {
    if (api._pageStill && !api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Phone-cut film poster</h2><p>Could not read the films just now. Try again in a minute.</p>';
    return 'phone-poster';
  }
}

export default {
  name: 'phone-poster',
  examples: ['generate phone poster', 'phone-cut film poster', 'auto poster for the newest phone film', 'promotional poster for phone-cut films'],
  nearMisses: ['make this a poster', 'film poster', 'what is a phone poster', 'order a poster'],
  match(lower, text) { return phoneOf(text); },
  run,
  suite() {
    return { ok: phoneOf('generate phone poster') && phoneOf('phone-cut film poster') && !phoneOf('make this a poster') && !phoneOf('hello') };
  },
};
