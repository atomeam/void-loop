/**
 * phone-poster skill — auto-generates a simple promotional phone-story poster card for a film title (local, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone poster for Inception", "promo poster for Dune", "phone-cut poster".
 */
export function isPhonePoster(text) {
  return /^(?:please\s+)?(?:(?:make\s+(?:a\s+|the\s+)?)?(?:phone(?:-cut)?|promo(?:tional)?)\s+poster(?:\s+for\s+(.+))?|poster\s+for\s+the\s+film\s+(.+))$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const m = String(text).match(/(?:for|film)\s+(.+)/i);
  const title = m ? m[1].trim() : 'Untitled Film';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Phone promo poster</h2><div style="width:180px;height:320px;background:linear-gradient(180deg,#111 0%,#333 100%);color:#fff;border-radius:12px;padding:16px;margin:12px auto;display:flex;flex-direction:column;justify-content:space-between;font-family:sans-serif"><div style="font-size:11px;opacity:.7">VERSE FILMS</div><div style="font-size:22px;font-weight:700;text-align:center">' + esc(title.toUpperCase()) + '</div><div style="font-size:10px;opacity:.6;text-align:center">Now showing · a-to-mind.com/films</div></div><div class="sub">9:16 phone-story size · say another for a new title</div>';
  });
  return 'phone-poster';
}

export default {
  name: 'phone-poster',
  examples: ['phone poster for Inception', 'promo poster for Dune', 'phone-cut poster', 'poster for the film Arrival'],
  nearMisses: ['what is a phone poster', 'print poster', 'film list'],
  match(lower, text) { return isPhonePoster(text); },
  run,
  suite() {
    const ok = isPhonePoster('phone poster for Inception') && isPhonePoster('promo poster') && !isPhonePoster('what is a poster');
    return { ok, got: 'match works' };
  }
};
