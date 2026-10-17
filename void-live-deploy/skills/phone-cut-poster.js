/**
 * phone-cut-poster skill — auto-generates promotional posters for phone-cut films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone-cut film poster for inception", "promotional poster for phone-cut films", "auto-generate poster for phone cut movie".
 * Renders a simple poster card (title, tagline, colors) from the film name. Empty surface stays empty.
 * Uses no external service. Asked by Void (ask-20261014-2134-3).
 */
export function filmOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:phone[-\s]?cut\s+(?:film\s+)?poster\s+(?:for|of)\s+(.+)|promotional\s+poster\s+for\s+phone[-\s]?cut\s+(?:films?|movies?)|auto-generate\s+poster\s+for\s+phone\s+cut\s+(?:movie|film)\s*(.*))$/i)
    || t.match(/^(?:make|generate|create)\s+(?:a\s+)?(?:promo(?:tional)?\s+)?poster\s+for\s+(?:the\s+)?(?:phone[-\s]?cut\s+)?(?:film\s+|movie\s+)?(.+)$/i);
  return m ? (m[1] || m[2] || 'untitled').trim() : null;
}

function posterHtml(esc, film) {
  const title = film.replace(/\b\w/g, (c) => c.toUpperCase());
  const tag = 'Phone-cut. Vertical. Made for the small screen.';
  const colors = ['#1a1a2e', '#16213e', '#0f3460', '#e94560'];
  return `<div class="poster" style="background:linear-gradient(160deg,${colors[0]},${colors[2]});color:#fff;padding:32px 24px;border-radius:16px;text-align:center;max-width:360px;margin:0 auto;box-shadow:0 8px 32px rgba(0,0,0,.4)">
    <div style="font-size:11px;letter-spacing:3px;opacity:.7;margin-bottom:12px">V01D FILMS · PHONE-CUT</div>
    <h3 style="margin:0 0 8px;font-size:28px;font-weight:700;line-height:1.1">${esc(title)}</h3>
    <div style="font-size:14px;opacity:.85;margin:12px 0 20px">${esc(tag)}</div>
    <div style="height:2px;background:${colors[3]};width:60px;margin:0 auto 16px"></div>
    <div style="font-size:12px;opacity:.6">a-to-mind.com/films · free</div>
  </div>`;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const film = filmOf(text) || 'your film';
  showPage((el) => {
    el.innerHTML = '<h2>Phone-cut poster</h2><div class="sub">for ' + esc(film) + '</div>' + posterHtml(esc, film)
      + '<div class="src">Generated on the stage · no upload · empty until you ask</div>';
  });
  return 'phone-cut-poster';
}

export function suite() {
  const ok = filmOf('phone-cut film poster for inception') === 'inception'
    && filmOf('promotional poster for phone-cut films') !== null
    && filmOf('films') === null
    && filmOf('poster for my wall') === null;
  return { ok, got: ok ? '' : 'filmOf mismatch' };
}

export default {
  name: 'phone-cut-poster',
  examples: [
    'phone-cut film poster for inception',
    'promotional poster for phone-cut films',
    'auto-generate poster for phone cut movie'
  ],
  nearMisses: ['films', 'poster for my wall'],
  suite,
  match(lower, text) { return !!filmOf(text || lower); },
  run
};
