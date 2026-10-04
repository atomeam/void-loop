/**
 * translate skill — Google gtx, MyMemory fallback, no key
 * Contract: { name, examples, match(lower, text), run(text, api) }
 */
const LANGS = {
  english:'en', spanish:'es', french:'fr', german:'de', italian:'it', portuguese:'pt', dutch:'nl',
  russian:'ru', ukrainian:'uk', polish:'pl', czech:'cs', greek:'el', turkish:'tr', arabic:'ar',
  hebrew:'he', hindi:'hi', bengali:'bn', urdu:'ur', japanese:'ja', korean:'ko', chinese:'zh-CN',
  mandarin:'zh-CN', cantonese:'zh-TW', vietnamese:'vi', thai:'th', indonesian:'id', malay:'ms',
  filipino:'tl', tagalog:'tl', swedish:'sv', norwegian:'no', danish:'da', finnish:'fi',
  hungarian:'hu', romanian:'ro', swahili:'sw', persian:'fa', farsi:'fa', irish:'ga', welsh:'cy',
  latin:'la', hawaiian:'haw', catalan:'ca', croatian:'hr', serbian:'sr', bulgarian:'bg'
};
const LANG_RE = Object.keys(LANGS).join('|');

function parse(text) {
  const t = text.trim().replace(/[?!.]+$/, '');
  let m = t.match(new RegExp('^(?:please\\s+)?translate\\s+["“]?(.+?)["”]?\\s+(?:from\\s+(' + LANG_RE + ')\\s+)?(?:to|into|in)\\s+(' + LANG_RE + ')$', 'i'));
  if (m) return { q: m[1], from: m[2], to: m[3] };
  m = t.match(new RegExp('^how\\s+(?:do|would)\\s+(?:you|i|we)\\s+say\\s+["“]?(.+?)["”]?\\s+in\\s+(' + LANG_RE + ')$', 'i'));
  if (m) return { q: m[1], to: m[2] };
  // "the longest word in english", "most common letter in english": a question about the language, not a translation
  if (/^(?:what\s+is\s+)?(?:the\s+)?(?:longest|shortest|most\s+common|hardest|oldest|newest|first|last)\s+\w+(?:\s+\w+)?\s+in\s+/i.test(t)) return null;
  m = t.match(new RegExp('^what\\s+is\\s+["“]?(.+?)["”]?\\s+in\\s+(' + LANG_RE + ')$', 'i'))
   || t.match(new RegExp('^["“]?(.+?)["”]?\\s+in\\s+(' + LANG_RE + ')$', 'i'));
  if (m) return { q: m[1], to: m[2] };
  m = t.match(new RegExp('^(' + LANG_RE + ')\\s+for\\s+["“]?(.+?)["”]?$', 'i'));
  if (m) return { q: m[2], to: m[1] };
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const p = parse(text);
  if (!p) return 'none';
  const to = LANGS[p.to.toLowerCase()], from = p.from ? LANGS[p.from.toLowerCase()] : 'en';
  const el = showPage((pg) => { pg.innerHTML = '<h2>' + esc(p.q) + '</h2><div class="sub">→ ' + esc(p.to) + ' …</div>'; });
  try {
    let out = '', via = 'google';
    try {
      const g = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=' + (p.from ? from : 'auto') + '&tl=' + to + '&q=' + encodeURIComponent(p.q)).then((x) => x.json());
      out = (g[0] || []).map((s) => s[0]).join('');
    } catch (_) {}
    if (!out) {
      const r = await fetch('https://api.mymemory.translated.net/get?mt=1&q=' + encodeURIComponent(p.q) + '&langpair=' + from + '|' + to).then((x) => x.json());
      out = r && r.responseStatus === 200 && r.responseData && r.responseData.translatedText; via = 'mymemory';
      // MyMemory sometimes leaves translatedText empty and puts the answer in matches: take the best-rated one
      if (!out && r && Array.isArray(r.matches)) {
        const best = r.matches.filter((x) => x && x.translation && String(x.translation).trim()).sort((a, b) => (+b.match || 0) - (+a.match || 0) || (+b.quality || 0) - (+a.quality || 0))[0];
        out = best ? String(best.translation).trim() : '';
      }
    }
    if (!api._pageStill(el)) return 'translate';
    if (!out) throw 0;
    el.innerHTML = '<div class="sub">' + esc(p.q) + ' · ' + esc(p.to.charAt(0).toUpperCase() + p.to.slice(1).toLowerCase()) + '</div>'
      + '<div class="tr-out" style="font-size:40px;font-weight:300;line-height:1.2;margin:8px 0">' + esc(out) + '</div>'
      + '<button type="button" class="tr-copy" aria-label="copy the translation">copy</button>'
      + '<div class="src">Source: ' + (via === 'google' ? '<a href="https://translate.google.com/" target="_blank" rel="noopener">Google Translate</a>' : '<a href="https://mymemory.translated.net/" target="_blank" rel="noopener">MyMemory</a>') + '</div>';
    const btn = el.querySelector('.tr-copy');
    if (btn) btn.addEventListener('click', async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(out); ok = true; } catch (_) {
        try { const ta = document.createElement('textarea'); ta.value = out; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (__) {}
      }
      btn.textContent = ok ? 'copied' : 'select it to copy'; if (api.say) api.say(ok ? 'copied' : '');
      setTimeout(() => { btn.textContent = 'copy'; }, 1600);
    });
    return 'translate';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>' + esc(p.q) + '</h2><p>The translator didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'translate',
  examples: ['translate hello to Spanish', 'how do you say thank you in Japanese', 'good morning in French', 'what is cat in German'],
  match(lower, text) { return !!parse(text); },
  run
};
