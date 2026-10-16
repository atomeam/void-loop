/**
 * phone-cut skill — auto-generates promotional posters for phone-cut films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone cut film poster for inception", "generate promo poster for phone film matrix".
 * Uses free iTunes Search for metadata, draws a simple vertical poster in the browser.
 * Empty surface stays empty.
 */
export function filmOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:phone[-\s]?cut\s+)?(?:film|movie)\s+(?:promo(?:tional)?\s+)?poster\s+(?:for|of)\s+(.+)$/i)
    || t.match(/^(?:auto[-\s]?generate|generate|make|create)\s+(?:a\s+)?(?:promo(?:tional)?\s+)?poster\s+(?:for|of)\s+(?:the\s+)?(?:phone[-\s]?cut\s+)?(?:film|movie)\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function drawPoster(title, year, genre) {
  const c = document.createElement('canvas');
  c.width = 540; c.height = 960;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a12'; g.fillRect(0, 0, 540, 960);
  const glow = g.createRadialGradient(270, 400, 0, 270, 400, 500);
  glow.addColorStop(0, 'rgba(255,60,120,0.4)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 540, 960);
  g.fillStyle = '#fff';
  g.font = 'bold 48px ui-sans-serif, system-ui';
  g.textAlign = 'center';
  g.fillText(title.slice(0, 28), 270, 420);
  g.font = '24px ui-sans-serif, system-ui';
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillText((year || '') + (genre ? ' · ' + genre : ''), 270, 480);
  g.font = '18px ui-sans-serif, system-ui';
  g.fillText('Phone-cut promo · a-to-mind.com', 270, 900);
  return c.toDataURL('image/png');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = filmOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut poster</h2><div class="sub">looking up “' + esc(q) + '”…</div>'; });
  try {
    const r = await fetch('https://itunes.apple.com/search?term=' + encodeURIComponent(q) + '&entity=movie&limit=1&media=movie');
    if (!api._pageStill(el)) return 'phone-cut';
    const data = await r.json();
    const f = (data.results || [])[0];
    const title = f ? f.trackName : q;
    const year = f && f.releaseDate ? f.releaseDate.slice(0, 4) : '';
    const genre = f ? f.primaryGenreName : '';
    const img = drawPoster(title, year, genre);
    el.innerHTML = '<h2>Phone-cut poster · ' + esc(title) + '</h2>'
      + '<img src="' + img + '" alt="Promo poster" style="max-width:100%;max-height:50vh;display:block;margin:12px auto;border-radius:8px">'
      + '<div class="src">Drawn in this browser from iTunes Search (no key). Empty surface stays empty.</div>';
    return 'phone-cut';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Phone-cut poster</h2><p>The film service did not answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-cut',
  examples: ['phone cut film poster for inception', 'generate promo poster for phone film the matrix', 'auto-generate promotional poster for phone-cut film dune'],
  nearMisses: ['films', 'make this a poster', 'film discovery for inception', 'how do I film a video'],
  match(lower, text) { return !!filmOf(text); },
  run,
  suite() {
    return { ok: filmOf('phone cut film poster for inception') === 'inception' && filmOf('hello world') === null };
  },
};
