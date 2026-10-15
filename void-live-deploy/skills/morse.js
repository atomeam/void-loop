/**
 * morse skill - persistent interactive Morse code translator on the stage (new idea, growth inbox).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "morse code", "morse converter", "translate to morse", "morse for hello".
 * Card stays after reload; type in either box, it converts both ways. Pure encode/decode tested in suite.
 */
const CODE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.', ' ': '/' };
const REV = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
export function encode(text) {
  return String(text || '').toLowerCase().split('').map((c) => CODE[c] || (c === ' ' ? '/' : '')).filter(Boolean).join(' ');
}
export function decode(morse) {
  return String(morse || '').trim().split(/\s+/).map((s) => REV[s] || (s === '/' ? ' ' : '')).join('');
}
export function askOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:close|remove|delete|hide)\s+(?:the\s+)?morse(?:\s+code)?(?:\s+card)?(?:\s+please)?$/.test(t)) return { close: true };
  const m = t.match(/^(?:(?:open|show|make|add|give|put)\s+)?(?:a\s+|the\s+|my\s+)?(?:morse(?:\s+code)?(?:\s+(?:converter|card|translator))?)(?:\s+(?:for|of)\s+(.+))?$/);
  if (m) return { open: true, text: m[1] || '' };
  if (/^morse(?:\s+code)?$/.test(t) || /^translate\s+(?:to\s+)?morse$/.test(t)) return { open: true };
  return null;
}
function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card morse-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(360px, calc(100vw - 20px))';
  const FIELD = 'background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:6px 8px;font:inherit;color-scheme:dark;width:100%;box-sizing:border-box;margin:4px 0';
  const stop = (n) => { n.addEventListener('pointerdown', (e) => e.stopPropagation()); n.addEventListener('keydown', (e) => e.stopPropagation()); return n; };
  const head = document.createElement('div'); head.className = 'g-head';
  head.innerHTML = '<span class="g-title">Morse</span><span class="g-sub">stays here · type in either box</span>';
  const textIn = stop(document.createElement('textarea')); textIn.className = 'morse-text'; textIn.placeholder = 'Plain text'; textIn.setAttribute('aria-label', 'Plain text'); textIn.style.cssText = FIELD + 'height:60px;resize:vertical';
  const morseIn = stop(document.createElement('textarea')); morseIn.className = 'morse-code'; morseIn.placeholder = 'Morse code'; morseIn.setAttribute('aria-label', 'Morse code'); morseIn.style.cssText = FIELD + 'height:60px;resize:vertical;font-family:monospace';
  const src = document.createElement('div'); src.className = 'src'; src.style.cssText = 'margin-top:6px;font-size:11px;opacity:.7'; src.textContent = 'International Morse · / for word space';
  el.append(head, textIn, morseIn, src);
  const keep = () => { th.text = textIn.value; th.morse = morseIn.value; stageApi.save(); };
  textIn.addEventListener('input', () => { morseIn.value = encode(textIn.value); keep(); });
  morseIn.addEventListener('input', () => { textIn.value = decode(morseIn.value); keep(); });
  textIn.value = th.text || 'hello';
  morseIn.value = th.morse || encode(textIn.value);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}
const cards = (api) => Object.values(api.stage.things()).filter((t) => t && t.kind === 'morse');
function run(text, api) {
  const q = askOf(text);
  if (!q) return 'none';
  if (q.close) {
    const c = cards(api);
    if (!c.length) { api.say('There is no Morse card on the stage · ask "morse code" to open one'); return 'morse'; }
    for (const t of c) delete api.stage.things()[t.id];
    api.stage.save(); api.stage.render(); api.say('Morse card put away'); return 'morse';
  }
  const set = { text: q.text || 'hello' };
  const mine = cards(api)[0];
  if (mine) { Object.assign(mine, set); api.stage.save(); api.stage.render(); if (api.stage.center) api.stage.center(mine.id); }
  else api.summon('morse', Object.assign({ center: true }, set));
  api.say((mine ? 'Your Morse card' : 'A Morse card') + ' is on the stage · type in either box; it stays after a reload');
  return 'morse';
}
export default {
  name: 'morse',
  examples: ['morse code', 'morse converter', 'open a morse card', 'morse for hello', 'translate to morse', 'close the morse'],
  nearMisses: ['morse code alphabet', 'what is morse', 'sos in morse'],
  match(lower, text) { return !!askOf(text || lower); },
  run,
  stageKinds: { morse: { mount } },
  suite() { return encode('hello') === '.... . .-.. .-.. ---' && decode('.... . .-.. .-.. ---') === 'hello'; },
};
