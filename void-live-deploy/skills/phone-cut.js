/**
 * phone-cut skill — promotional phone-story posters for V01D films (uses the film list and poster drawing already live)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone cut films", "make phone posters for films", "phone-cut posters"
 * Empty surface stays empty until asked.
 */
export function phoneCutOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:make|generate|show|create)\s+(?:me\s+)?)?(?:phone[-\s]?cut\s+(?:films?\s+)?(?:posters?|promos?)|promotional\s+phone\s+posters?|phone\s+story\s+posters?\s+for\s+films?)$/.test(t);
}

function run(text, api) {
  if (!phoneCutOf(text)) return 'none';
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = '<h2>Phone-cut film posters</h2>'
      + '<p>V01D films already have phone-story posters. Say <b>film poster</b> or <b>make a poster for the newest film</b> and pick the phone story size.</p>'
      + '<p>Each film gets a 1080×1920 promo image drawn in this browser. Nothing is uploaded.</p>'
      + '<div class="src">Uses skills/poster.js film posters · as of Oct 2026</div>';
  });
  return 'phone-cut';
}

export default {
  name: 'phone-cut',
  examples: ['phone cut films', 'make phone posters for films', 'phone-cut posters'],
  nearMisses: ['phone films', 'cut a phone video', 'poster'],
  match(lower, text) { return phoneCutOf(text); },
  run,
  suite() {
    const ok = phoneCutOf('phone cut films') && phoneCutOf('phone-cut posters') && !phoneCutOf('phone');
    return { ok, got: ok ? 'matched phone-cut asks' : 'failed' };
  },
};
