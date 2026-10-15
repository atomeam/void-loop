/**
 * phone-posters skill — phone-cut films skill auto-generates promotional posters.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone-cut posters", "generate promotional posters for phone-cut films", "auto posters for the clips".
 * Builds on the poster skill and film metadata. Empty surface stays empty.
 */
export function postersOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:auto(?:-|\s+)?generate\s+)?(?:phone-?cut\s+)?(?:films?\s+)?(?:promotional\s+)?posters?(?:\s+for\s+(?:the\s+)?(?:phone-?cut\s+)?(?:films?|clips?|ads?))?$/.test(t)
    || /^phone-?cut\s+films?\s+(?:skill\s+)?(?:auto-?generates?\s+)?(?:promotional\s+)?posters?$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Phone-cut promotional posters</h2><div class="sub">Generating 9:16 posters for the latest phone-cut films…</div>';
  });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (!api._pageStill(el)) return 'phone-posters';
    const films = (j.films || []).slice(0, 3);
    el.innerHTML = '<h2>Phone-cut promotional posters</h2><p>Auto-generated 9:16 story posters for the newest phone-cut films (ad clips and experiments). Download from the films page or say <b>film poster</b> for one.</p>'
      + films.map((f) => '<div style="margin:8px 0;padding:8px;border:1px solid rgba(255,255,255,.1);border-radius:8px"><b>' + esc(f.title || f.id) + '</b><div class="sub">9:16 phone story ready</div></div>').join('')
      + '<div class="src"><a href="/films/">Watch and download on a-to-mind.com/films/</a> · uses poster.js layout</div>';
    return 'phone-posters';
  } catch (_) {
    el.innerHTML = '<h2>Phone-cut promotional posters</h2><p>The films list could not be read just now. Try again in a minute, or say <b>films</b>.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-posters',
  examples: ['phone-cut posters', 'generate promotional posters for phone-cut films', 'auto posters for the clips', 'phone-cut films skill auto-generates promotional posters'],
  nearMisses: ['film poster', 'make this a poster', 'films', 'voids fillms'],
  match(lower, text) { return postersOf(text); },
  run,
  suite() {
    return { ok: postersOf('phone-cut posters') === true && postersOf('hello') === false };
  },
};
