/**
 * phonecut skill: auto-generates promotional posters for phone-cut films (9:16).
 * "phone cut poster", "auto generate film poster", "promotional poster for the newest film".
 * Reuses film metadata and layout from poster and films. Empty stage stays empty: no card summoned, just the poster page.
 */
import { filmMeta } from './films.js';
import { filmCard } from './poster.js';

const ASK = /^(?:auto[- ]?generate |make |create |show )?(?:a )?(?:phone[- ]?cut |promotional |promo )?(?:film )?poster(?: for (?:the )?(?:newest |latest )?film)?$/i;

export function wantsPhoneCut(lower) {
  return ASK.test(String(lower || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
}

async function run(text, api) {
  if (!wantsPhoneCut(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film poster</h2><div class="sub">Generating…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    const all = (j.films || []).map(filmMeta);
    const meta = all[0];
    if (!meta) { el.innerHTML = '<h2>Phone-cut film poster</h2><p>No films yet.</p>'; return 'phonecut'; }
    const card = filmCard(meta);
    el.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">' + esc(card.title) + '</div><p>' + esc(card.text) + '</p><p class="src">Phone story size 1080×1920. Drawn in this browser like the poster skill. Nothing uploaded.</p>';
  } catch (_) {
    el.innerHTML = '<h2>Phone-cut film poster</h2><p>Could not read the films just now.</p>';
  }
  return 'phonecut';
}

export default {
  name: 'phonecut',
  examples: [
    'phone cut poster',
    'auto generate film poster',
    'promotional poster for the newest film',
    'phone-cut films poster',
  ],
  nearMisses: [
    'make this a poster',
    'film poster',
    'best films',
  ],
  match(lower) { return wantsPhoneCut(lower); },
  run,
};
