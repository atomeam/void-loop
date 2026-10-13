/**
 * morse skill — convert to/from Morse code (no key; pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "morse for hello", "convert hello to morse", "what is .... . .-.. .-.. ---", "morse code for SOS".
 */
const TO = { a:'.-', b:'-...', c:'-.-.', d:'-..', e:'.', f:'..-.', g:'--.', h:'....', i:'..', j:'.---', k:'-.-', l:'.-..', m:'--', n:'-.', o:'---', p:'.--.', q:'--.-', r:'.-.', s:'...', t:'-', u:'..-', v:'...-', w:'.--', x:'-..-', y:'-.--', z:'--..', '1':'.----', '2':'..---', '3':'...--', '4':'....-', '5':'.....', '6':'-....', '7':'--...', '8':'---..', '9':'----.', '0':'-----', ' ':'/' };
const FROM = Object.fromEntries(Object.entries(TO).map(([k, v]) => [v, k]));
function toMorse(text) {
  return String(text || '').toLowerCase().split('').map((c) => TO[c] || (c === ' ' ? '/' : '')).filter(Boolean).join(' ');
}
function fromMorse(code) {
  return String(code || '').trim().split(/\s+/).map((s) => FROM[s] || '').join('');
}
function parseMorse(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const to = t.match(/(?:morse(?:\s+code)?\s+(?:for|of)\s+|to\s+morse(?:\s+code)?\s+|convert\s+)(.+)/i) || t.match(/(.+)\s+(?:in|to)\s+morse/i);
  if (to && /[a-z0-9]/i.test(to[1])) return { to: to[1].trim() };
  const from = t.match(/(?:what\s+is\s+|decode\s+|from\s+morse\s+)?([.\- /]+)/i);
  if (from && /[.\-]/.test(from[1]) && fromMorse(from[1])) return { from: from[1].trim() };
  if (/^morse(?:\s+code)?$/i.test(t)) return { to: 'hello' };
  return null;
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = parseMorse(text);
  if (!q) return 'none';
  if (q.to) {
    const r = toMorse(q.to);
    showPage((p) => { p.innerHTML = '<h2>Morse</h2><div style="font-size:28px;font-weight:300;line-height:1.4;margin:8px 0;letter-spacing:2px">' + esc(r) + '</div><div class="sub">' + esc(q.to) + ' in Morse code</div>'; });
  } else {
    const r = fromMorse(q.from);
    showPage((p) => { p.innerHTML = '<h2>Morse</h2><div style="font-size:36px;font-weight:300;margin:8px 0">' + esc(r) + '</div><div class="sub">' + esc(q.from) + ' decoded</div>'; });
  }
  return 'morse';
}
export function suite() {
  const h = toMorse('hi');
  const back = fromMorse(h);
  return { ok: h === '.... ..' && back === 'hi', got: h + ' -> ' + back };
}
export default {
  name: 'morse',
  examples: ['morse for hello', 'convert SOS to morse', 'what is .... . .-.. .-.. ---', 'morse code'],
  nearMisses: ['what is morse', 'morse history', 'sam morse'],
  match(lower, text) { return !!parseMorse(text); },
  run,
  suite
};
