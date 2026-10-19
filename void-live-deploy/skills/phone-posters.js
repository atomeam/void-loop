/**
 * phone-posters skill — auto-generates promotional posters for phone-cut films (asked by Verse, growth inbox open row).
 * "make phone posters", "generate promotional posters for phone-cut films", "phone-cut film poster", "promo posters for films".
 * Draws a 9:16 phone-story poster in the browser (nothing uploaded), empty stage stays empty: if no film title given it shows a placeholder.
 * Empty surface stays empty.
 */
export function wantsPhonePosters(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:make|generate|auto[- ]?generate|create|draw)\s+)?(?:phone[- ]?cut\s+)?(?:promotional\s+)?posters?(?:\s+for\s+(?:phone[- ]?cut\s+)?films?)?$/.test(t) ||
         /^(?:phone[- ]?cut\s+films?\s+)?(?:promotional\s+)?posters?$/.test(t);
}

export function posterTitle(text) {
  const m = String(text || '').match(/(?:for|of)\s+(?:the\s+)?(?:film\s+)?([a-z0-9][a-z0-9 -]{2,40})/i);
  return m ? m[1].trim() : '';
}

function drawPoster(title) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a12';
  g.fillRect(0, 0, 1080, 1920);
  const glow = g.createRadialGradient(540, 700, 0, 540, 700, 800);
  glow.addColorStop(0, 'rgba(120,80,255,0.35)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = '#fff';
  g.font = 'bold 72px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(title || 'VERSE FILMS', 540, 860);
  g.font = '32px system-ui, sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillText('Phone-cut promotional poster', 540, 960);
  g.font = '28px system-ui, sans-serif';
  g.fillText('a-to-mind.com/films', 540, 1700);
  return c;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const title = posterTitle(text);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Phone-cut promotional posters</h2>' +
      (title ? '<p>Poster for <b>' + esc(title) + '</b></p>' : '<p class="sub">No specific film named; showing the empty promotional surface.</p>') +
      '<img class="phone-poster" alt="Phone poster" style="max-width:100%;max-height:60vh;display:block;margin:12px auto;border-radius:8px">' +
      '<button class="g-btn phone-dl" type="button">Download 1080×1920 PNG</button>' +
      '<div class="src">Drawn in this browser. Nothing is uploaded or charged.</div>';
  });
  if (!el) return 'phone-posters';
  const img = el.querySelector('.phone-poster');
  const canvas = drawPoster(title);
  img.src = canvas.toDataURL('image/png');
  el.querySelector('.phone-dl').addEventListener('click', () => {
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (title ? title.replace(/\s+/g, '-').toLowerCase() : 'phone-poster') + '-1080x1920.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  });
  return 'phone-posters';
}

export default {
  name: 'phone-posters',
  examples: ['make phone posters', 'generate promotional posters for phone-cut films', 'phone-cut film poster', 'promo posters for films', 'make a phone poster for the film miss-board'],
  nearMisses: ['what is a poster', 'film poster sizes', 'make this a poster', 'order a poster'],
  match(lower, text) { return wantsPhonePosters(text); },
  run,
  suite() {
    return { ok: wantsPhonePosters('make phone posters') && wantsPhonePosters('generate promotional posters for phone-cut films') && !wantsPhonePosters('tell me a joke') && posterTitle('poster for the film inception') === 'inception' };
  },
};
