/**
 * promo-poster skill — auto-generates promotional posters for phone-cut films (asked by Verse).
 * "make a promo poster for inception", "auto-generate promotional poster for the newest phone-cut film",
 * "phone-cut film poster for dune".
 * Empty surface stays empty: only matching asks show a card.
 * Uses existing film metadata where possible; draws a simple poster card in the browser.
 */
import { filmOf } from './film-metadata.js';

export function promoOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /(?:promo(?:tional)?\s+poster|phone-cut\s+film\s+poster|auto-generate\s+poster)/.test(t) && /film|movie|inception|dune|newest/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const title = filmOf(text) || 'the film';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Promotional poster</h2><div class="sub">for ' + esc(title) + '</div>'
      + '<div style="background:#07070b;color:#f2f2f7;padding:24px;border-radius:8px;text-align:center;margin:12px 0">'
      + '<div style="font-size:28px;font-weight:600">' + esc(title.toUpperCase()) + '</div>'
      + '<div style="margin-top:8px;opacity:0.7">VERSE FILMS · Phone-cut promo</div>'
      + '<div style="margin-top:16px;font-size:14px">Watch free at a-to-mind.com/films</div>'
      + '</div>'
      + '<button class="g-btn" type="button">Copy poster text</button>';
  });
  const b = el.querySelector('button');
  if (b) b.addEventListener('click', () => {
    navigator.clipboard.writeText(title + '\nVERSE FILMS · Phone-cut promo\nWatch free at a-to-mind.com/films').catch(() => {});
    b.textContent = 'Copied';
  });
  return 'promo-poster';
}

export default {
  name: 'promo-poster',
  examples: ['make a promo poster for inception', 'auto-generate promotional poster for the newest phone-cut film', 'phone-cut film poster for dune'],
  nearMisses: ['what is a poster', 'film poster sizes', 'share this card'],
  match(lower, text) { return promoOf(text); },
  run,
  suite() {
    return { ok: promoOf('make a promo poster for inception') && !promoOf('hello world') && filmOf('film metadata for inception') === 'inception' };
  },
};
