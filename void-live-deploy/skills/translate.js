/**
 * translate skill — a word or phrase in another language, with a link to the full translator for 100 languages (Google gtx, MyMemory fallback, no key)
 * Contract: { name, examples, match(lower, text), run(text, api) }
 */
import { bandMini } from '../lib/card-mini.js';
import { isIt } from './is-it.js';
import { STAGE_LANGS, cardText } from '../lib/translate-card.js';
const LANGS = STAGE_LANGS;
const LANG_RE = Object.keys(LANGS).join('|');
// the French way of asking, and its language names: "comment dit-on bonjour en anglais" (the outcome exam asks it)
const FR_LANGS = {
  anglais: 'english', français: 'french', francais: 'french', espagnol: 'spanish', allemand: 'german', italien: 'italian',
  portugais: 'portuguese', japonais: 'japanese', chinois: 'chinese', coréen: 'korean', coreen: 'korean', russe: 'russian',
  arabe: 'arabic', hindi: 'hindi', néerlandais: 'dutch', neerlandais: 'dutch', turc: 'turkish', polonais: 'polish',
  suédois: 'swedish', suedois: 'swedish', grec: 'greek', hébreu: 'hebrew', hebreu: 'hebrew', thaï: 'thai', thai: 'thai',
  vietnamien: 'vietnamese', ukrainien: 'ukrainian', roumain: 'romanian', hongrois: 'hungarian', finnois: 'finnish',
  danois: 'danish', norvégien: 'norwegian', norvegien: 'norwegian', catalan: 'catalan', croate: 'croatian', serbe: 'serbian',
  bulgare: 'bulgarian', latin: 'latin', gallois: 'welsh', irlandais: 'irish', swahili: 'swahili', persan: 'persian'
};

function parse(text) {
  const t = text.trim().replace(/[?!.]+$/, '');
  let m = t.match(new RegExp('^(?:please\\s+)?translate\\s+["“]?(.+?)["”]?\\s+(?:from\\s+(' + LANG_RE + ')\\s+)?(?:to|into|in)\\s+(' + LANG_RE + ')$', 'i'));
  // the translate page's card (lib/translate-card.js cardAsk): its text as base64url, read back only when it is that exact code
  if (m) return { q: cardText(m[1]) ?? m[1], from: m[2], to: m[3] };
  // "comment dit-on bonjour en anglais", "comment dire bonjour": the words in French, the answer in the language named (English when none is)
  m = t.match(/^comment\s+(?:dit[- ]on|dire|se\s+dit|on\s+dit)\s+["“]?(.+?)["”]?(?:\s+en\s+([a-zà-ÿ-]+))?$/i);
  if (m) {
    const raw = String(m[2] || 'anglais').toLowerCase();
    const to = FR_LANGS[raw] || (LANGS[raw] ? raw : 'english');
    return { q: m[1], to };
  }
  // no language named ("translate spring"): a word can mean more than one thing and a phrase can be said several ways, so the card asks which
  m = t.match(/^(?:please\s+)?translate\s+["“]?(.+?)["”]?$/i);
  if (m && m[1] && !/\s+(?:to|into)\s+\S+$/i.test(m[1])) return { q: m[1], to: null };
  m = t.match(new RegExp('^how\\s+(?:do|would)\\s+(?:you|i|we)\\s+say\\s+["“]?(.+?)["”]?\\s+in\\s+(' + LANG_RE + ')$', 'i'));
  if (m) return { q: m[1], to: m[2] };
  // "is it christmas in french": a yes-or-no day question asked for its word in that language (skills/is-it.js), not a phrase to translate
  if (isIt(t)) return null;
  // "the longest word in english", "most common letter in english": a question about the language, not a translation
  if (/^(?:what\s+is\s+)?(?:the\s+)?(?:longest|shortest|most\s+common|hardest|oldest|newest|first|last)\s+\w+(?:\s+\w+)?\s+in\s+/i.test(t)) return null;
  m = t.match(new RegExp('^what\\s+is\\s+["“]?(.+?)["”]?\\s+in\\s+(' + LANG_RE + ')$', 'i'))
   || t.match(new RegExp('^["“]?(.+?)["”]?\\s+in\\s+(' + LANG_RE + ')$', 'i'));
  if (m) return { q: m[1], to: m[2] };
  m = t.match(new RegExp('^(?:what(?:[\'’]?s|\\s+is)\\s+)?(?:the\\s+)?(' + LANG_RE + ')\\s+(?:word\\s+)?for\\s+["“]?(.+?)["”]?$', 'i'));
  if (m) return { q: m[2], to: m[1] };
  return null;
}

// greetings a visitor asks every day, drawn at once so a slow or refused translator still answers (Google's free endpoint answers 429 in bursts)
const POCKET = {
  es: { hello: 'Hola', 'thank you': 'Gracias', thanks: 'Gracias', 'good morning': 'Buenos días', please: 'Por favor', yes: 'Sí', no: 'No', goodbye: 'Adiós' },
  fr: { hello: 'Bonjour', 'thank you': 'Merci', thanks: 'Merci', 'good morning': 'Bonjour', please: "S'il vous plaît", yes: 'Oui', no: 'Non', goodbye: 'Au revoir' },
  de: { hello: 'Hallo', 'thank you': 'Danke', thanks: 'Danke', 'good morning': 'Guten Morgen', please: 'Bitte', yes: 'Ja', no: 'Nein' },
  it: { hello: 'Ciao', 'thank you': 'Grazie', 'good morning': 'Buongiorno' },
  pt: { hello: 'Olá', 'thank you': 'Obrigado', 'good morning': 'Bom dia' },
  ja: { hello: 'こんにちは', 'thank you': 'ありがとう' },
};
// the other direction for the greetings a visitor asks most: a French or Spanish greeting answered in English even when both translators refuse
const BACK = {
  english: { bonjour: 'Hello', salut: 'Hi', merci: 'Thank you', 'au revoir': 'Goodbye', "s'il vous plaît": 'Please', oui: 'Yes', non: 'No', 'bonne nuit': 'Good night', 'bonsoir': 'Good evening',
    hola: 'Hello', gracias: 'Thank you', adiós: 'Goodbye', 'por favor': 'Please', sí: 'Yes', 'buenos días': 'Good morning' },
};
export function pocketOf(q, toName) {
  const name = String(toName || '').toLowerCase(), code = LANGS[name], text = String(q || '').trim().toLowerCase();
  const back = BACK[name];
  if (back && back[text]) return back[text];
  const table = code && POCKET[code];
  return table ? table[text] || '' : '';
}
async function run(text, api) {
  const { showPage, esc } = api;
  const p = parse(text);
  if (!p) return 'none';
  if (!p.to) { // no language named: ask which, and offer the four most asked for (the full page has all 100)
    const pick = [['Spanish', 'es'], ['French', 'fr'], ['German', 'de'], ['Japanese', 'ja']];
    showPage((pg) => { pg.innerHTML = '<h2>“' + esc(p.q) + '”</h2>'
      + '<div class="sub">No language was named, and “' + esc(p.q) + '” can mean more than one thing, so there is more than one right answer. Which language do you want it in?</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">' + pick.map(([name, code]) => '<a class="g-btn" href="/translate/?q=' + encodeURIComponent(p.q) + '&to=' + code + '">' + name + '</a>').join('') + '</div>'
      + '<div class="sub">Or pick from 100 languages in <a href="/translate/?q=' + encodeURIComponent(p.q) + '">the translator</a>.</div>'; });
    return 'translate';
  }
  const to = LANGS[p.to.toLowerCase()], from = p.from ? LANGS[p.from.toLowerCase()] : 'en';
  const known = pocketOf(p.q, p.to);
  const el = showPage((pg) => { pg.innerHTML = known
    ? '<div class="sub">' + esc(p.q) + ' · ' + esc(p.to) + '</div><div class="tr-out" style="font-size:40px;font-weight:300;line-height:1.2;margin:8px 0">' + esc(known) + '</div>'
    : '<h2>' + esc(p.q) + '</h2><div class="sub">→ ' + esc(p.to) + ' …</div>'; });
  try {
    let out = '', via = 'google';
    try {
      const g = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=' + (p.from ? from : 'auto') + '&tl=' + to + '&q=' + encodeURIComponent(p.q)).then((x) => { if (!x.ok) throw 0; return x.json(); });
      out = (g[0] || []).map((s) => s[0]).join('');
    } catch (_) { out = ''; }
    if (!out) {
      try {
        const r = await fetch('https://api.mymemory.translated.net/get?mt=1&q=' + encodeURIComponent(p.q) + '&langpair=' + from + '|' + to).then((x) => x.json());
        out = r && r.responseStatus === 200 && r.responseData && r.responseData.translatedText; via = 'mymemory';
        // MyMemory sometimes leaves translatedText empty and puts the answer in matches: take the best-rated one
        if (!out && r && Array.isArray(r.matches)) {
          const best = r.matches.filter((x) => x && x.translation && String(x.translation).trim()).sort((a, b) => (+b.match || 0) - (+a.match || 0) || (+b.quality || 0) - (+a.quality || 0))[0];
          out = best ? String(best.translation).trim() : '';
        }
      } catch (_) {} // refused too: the kept greeting below still answers
    }
    if (!out && known) { out = known; via = 'pocket'; }
    if (!api._pageStill(el)) return 'translate';
    if (!out) throw 0;
    el.innerHTML = '<div class="sub">' + esc(p.q) + ' · ' + esc(p.to.charAt(0).toUpperCase() + p.to.slice(1).toLowerCase()) + '</div>'
      + '<div class="tr-out" style="font-size:40px;font-weight:300;line-height:1.2;margin:8px 0">' + esc(out) + '</div>'
      + '<button type="button" class="tr-copy" aria-label="copy the translation">copy</button> <a class="tr-full" href="/translate/?q=' + encodeURIComponent(p.q) + '&to=' + encodeURIComponent(to) + '" style="margin-left:8px">open the translator (100 languages, listen, speak, camera)</a>'
      + '<div class="src">Source: ' + (via === 'pocket' ? 'a kept greeting, shown before the translator answers' : via === 'google' ? '<a href="https://translate.google.com/" target="_blank" rel="noopener">Google Translate</a>' : '<a href="https://mymemory.translated.net/" target="_blank" rel="noopener">MyMemory</a>') + '</div>';
    let light = false; try { const c = navigator.connection; light = !!(c && (c.saveData || /2g/.test(c.effectiveType || ''))) || matchMedia('(max-width: 700px)').matches; } catch (_) {}
    if (!light) bandMini(api, el, 'bubbles', { from: p.q, to: out, lang: p.to.charAt(0).toUpperCase() + p.to.slice(1).toLowerCase() }, '3D speech bubbles: ' + p.q + ' and ' + out); // a wide, fast screen gets the figure; a phone keeps the words
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
  translateOf: parse,
  match(lower, text) { return !!parse(text); },
  run
};
