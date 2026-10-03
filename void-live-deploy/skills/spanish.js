/**
 * spanish skill — answer this ask in Spanish (plan item 9, Void in other languages)
 * Uses the translator already in Void (Google gtx, MyMemory fallback, no key).
 * Does not publish, rename, or send. Empty surface stays empty until asked.
 * "answer me in Spanish", "answer me in Spanish: what is a void".
 */
const READY = 'Puedo responder en español. Escribe la pregunta después de dos puntos.';

export function spanishOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:please\s+)?(?:answer(?:\s+me|\s+this)?|reply(?:\s+to\s+me)?|respond(?:\s+to\s+me)?)\s+in\s+spanish(?:\s*:\s*(.{1,240}))?$/i)
    || t.match(/^(?:por favor\s+)?(?:contéstame|contestame|respóndeme|respondeme|háblame|hablame)\s+en\s+español(?:\s*:\s*(.{1,240}))?$/i);
  if (!m) return null;
  return { q: (m[1] || '').trim() };
}

export function spanishReady() {
  return READY;
}

async function toSpanish(q) {
  let out = '';
  try {
    const g = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=es&q=' + encodeURIComponent(q)).then((x) => x.json());
    out = (g[0] || []).map((s) => s[0]).join('');
  } catch (_) {}
  if (!out) {
    try {
      const r = await fetch('https://api.mymemory.translated.net/get?mt=1&q=' + encodeURIComponent(q) + '&langpair=en|es').then((x) => x.json());
      out = r && r.responseStatus === 200 && r.responseData && r.responseData.translatedText;
      if (!out && r && Array.isArray(r.matches)) {
        const best = r.matches.filter((x) => x && x.translation && String(x.translation).trim()).sort((a, b) => (+b.match || 0) - (+a.match || 0) || (+b.quality || 0) - (+a.quality || 0))[0];
        out = best ? String(best.translation).trim() : '';
      }
    } catch (_) {}
  }
  return out || '';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const hit = spanishOf(text);
  if (!hit) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>En español</h2>'; });
  if (!hit.q) {
    el.innerHTML = '<h2>En español</h2><p>' + esc(READY) + '</p>'
      + '<div class="src">Spanish reply. Nothing is published.</div>';
    return 'spanish';
  }
  const out = await toSpanish(hit.q);
  if (!api._pageStill(el)) return 'spanish';
  const line = out || 'No pude traducir eso ahora. Pregunta otra vez en un momento.';
  el.innerHTML = '<h2>En español</h2><div class="sub">' + esc(hit.q) + '</div>'
    + '<p style="font-size:28px;font-weight:300;line-height:1.3">' + esc(line) + '</p>'
    + '<div class="src">Uses the translator already in Void (Google Translate, MyMemory if needed). Nothing is published.</div>';
  return 'spanish';
}

export default {
  name: 'spanish',
  examples: ['answer me in Spanish', 'answer me in Spanish: what is a void', 'reply in Spanish', 'contéstame en español', 'answer this in Spanish: where is the library'],
  nearMisses: ['translate hello to Spanish', 'good morning in Spanish', 'what is Spanish', 'answer me in French'],
  spanishOf,
  spanishReady,
  match(lower, text) { return !!spanishOf(text); },
  run
};
