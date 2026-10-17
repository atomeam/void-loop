/**
 * phone-poster skill — promotional posters for phone-cut (vertical short) films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "promotional poster for inception", "phone cut film poster for the matrix", "make a phone poster for space odyssey".
 * Generates a simple vertical 9:16 poster preview in the browser (canvas). Empty surface stays empty.
 * Uses no external API; the film title is taken from the ask. Nothing is uploaded.
 */
export function filmOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:(?:make|create|generate|draw)\s+)?(?:a\s+)?(?:promotional|promo|phone(?:[- ]cut)?|vertical)\s+(?:film\s+)?poster\s+(?:for|of)\s+(.+)$/i)
    || t.match(/^(?:phone(?:[- ]cut)?\s+films?\s+)?poster\s+(?:for|of)\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function drawPoster(title) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  g.fillStyle = '#07070b'; g.fillRect(0, 0, 1080, 1920);
  const glow = g.createRadialGradient(540, 700, 0, 540, 700, 900);
  glow.addColorStop(0, 'rgba(120,130,255,0.22)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = '#f2f2f7';
  g.font = 'bold 72px ui-sans-serif, system-ui, sans-serif';
  g.textAlign = 'center';
  const lines = []; let cur = '';
  for (const w of title.toUpperCase().split(/\s+/)) {
    const next = cur ? cur + ' ' + w : w;
    if (g.measureText(next).width < 900 || !cur) cur = next; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  let y = 420;
  for (const l of lines.slice(0, 4)) { g.fillText(l, 540, y); y += 90; }
  g.font = '36px ui-sans-serif, system-ui, sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillText('PHONE-CUT · V01D FILMS', 540, 1700);
  g.font = '28px ui-sans-serif, system-ui, sans-serif';
  g.fillText('a-to-mind.com', 540, 1780);
  return c;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const title = filmOf(text);
  if (!title) return 'none';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Phone-cut promotional poster</h2><p class="sub">for “' + esc(title) + '”</p><img class="poster-preview" alt="Vertical poster" style="max-width:100%;max-height:60vh;display:block;margin:12px auto;border-radius:8px"><p class="src">Drawn in this browser. Nothing is uploaded. Download the 1080×1920 PNG for stories.</p>';
  });
  if (!el) return 'phone-poster';
  const c = drawPoster(title);
  el.querySelector('.poster-preview').src = c.toDataURL('image/png');
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = 'Download 1080×1920 PNG';
  b.style.cssText = 'margin:8px auto;display:block;padding:8px 16px;border-radius:8px;border:1px solid #444;background:transparent;color:inherit;cursor:pointer';
  b.addEventListener('click', () => c.toBlob((blob) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'v01d-phone-poster-' + title.replace(/[^a-z0-9]+/gi, '-').slice(0, 40) + '.png';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png'));
  el.appendChild(b);
  return 'phone-poster';
}

export default {
  name: 'phone-poster',
  examples: ['promotional poster for inception', 'phone cut film poster for the matrix', 'make a phone poster for space odyssey'],
  nearMisses: ['make this a poster', 'film poster', 'what is a poster', 'order a poster'],
  match(lower, text) { return !!filmOf(text); },
  run,
  suite() {
    return { ok: filmOf('promotional poster for inception') === 'inception' && filmOf('hello') === null };
  },
};
