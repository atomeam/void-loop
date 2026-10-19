/**
 * phone-cut skill — auto-generates promotional posters for phone-cut (vertical) films.
 * "phone-cut poster", "promo poster for phone film", "make a phone-cut poster".
 * Pure client-side canvas; nothing uploaded. Empty stage stays empty.
 * Uses a simple vertical layout inspired by existing poster skill.
 */
export function isPhoneCut(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:make|create|generate|auto)\s+)?(?:a\s+)?(?:promo(?:tional)?\s+)?(?:phone[\s-]?cut|vertical|phone\s+story)\s+(?:poster|film\s+poster)$/.test(t) || t === 'phone-cut poster';
}

function makePoster() {
  // simple vertical 9:16 canvas
  const w = 1080, h = 1920;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#07070b'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2f2f7'; g.font = 'bold 80px ui-sans-serif, system-ui';
  g.fillText('VERSE FILMS', 80, 200);
  g.font = '40px ui-sans-serif, system-ui';
  g.fillText('Phone-cut promo', 80, 300);
  g.fillText('Watch free at a-to-mind.com/films', 80, 400);
  return c.toDataURL('image/png');
}

async function run(text, api) {
  if (!isPhoneCut(text)) return 'none';
  const { showPage } = api;
  const src = makePoster();
  showPage((p) => {
    p.innerHTML = '<h2>Phone-cut promotional poster</h2><img src="' + src + '" alt="Phone-cut poster" style="max-width:100%;max-height:50vh;display:block;margin:8px auto;border-radius:6px"><div class="sub">Drawn in this browser. Nothing uploaded.</div>';
  });
  return 'phone-cut';
}

export default {
  name: 'phone-cut',
  examples: ['phone-cut poster', 'make a phone-cut poster', 'promo poster for phone film'],
  nearMisses: ['what is a poster', 'film poster', 'make this a poster'],
  match(lower, text) { return isPhoneCut(text); },
  run,
  suite() {
    const ok = isPhoneCut('phone-cut poster') && isPhoneCut('make a phone-cut poster') && !isPhoneCut('what is a poster');
    return { ok, got: 'phone-cut match ok' };
  },
};
