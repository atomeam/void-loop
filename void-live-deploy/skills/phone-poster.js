/**
 * phone-poster skill: auto-generate promotional posters for phone-cut (vertical short) films.
 * "make a phone-cut poster", "promotional poster for phone film", "phone cut films poster".
 * Draws a 9:16 story poster in the browser from a simple title. Empty stage stays empty.
 */
export function phonePosterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:make|create|draw|generate)\s+)?(?:an?\s+)?(?:promo(?:tional)?\s+)?(?:phone[- ]?cut\s+)?(?:film\s+)?poster(?:\s+for\s+(?:the\s+)?(?:phone[- ]?cut\s+)?film)?$/.test(t);
}

function drawStory(title) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a12'; g.fillRect(0, 0, 1080, 1920);
  const glow = g.createRadialGradient(540, 800, 0, 540, 800, 900);
  glow.addColorStop(0, 'rgba(255,80,140,0.3)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = '#fff'; g.font = 'bold 72px system-ui'; g.textAlign = 'center';
  g.fillText(title || 'PHONE CUT', 540, 900);
  g.font = '32px system-ui'; g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillText('VERSE FILMS · vertical short', 540, 1000);
  g.font = '24px system-ui'; g.fillText('a-to-mind.com/films', 540, 1800);
  return c;
}

function run(text, api) {
  if (!phonePosterOf(text)) return 'none';
  const { showPage } = api;
  const title = 'PHONE-CUT FILM';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Phone-cut promotional poster</h2><img class="pp" alt="poster" style="max-width:100%;max-height:50vh;display:block;margin:12px auto;border-radius:8px"><div class="src">Drawn in this browser. Nothing uploaded.</div>';
  });
  if (!el) return 'phone-poster';
  const img = el.querySelector('.pp');
  img.src = drawStory(title).toDataURL('image/png');
  return 'phone-poster';
}

export function suite() {
  const ok = phonePosterOf('make a phone-cut poster') && !phonePosterOf('what is a poster');
  return { ok, got: ok ? '' : 'match failed' };
}

export default {
  name: 'phone-poster',
  examples: ['make a phone-cut poster', 'promotional poster for phone film', 'phone cut films poster'],
  nearMisses: ['what is a poster', 'film poster sizes'],
  match(lower, text) { return phonePosterOf(text); },
  run,
  suite
};
