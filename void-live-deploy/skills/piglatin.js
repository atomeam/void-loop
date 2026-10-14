/**
 * piglatin skill — turn words into Pig Latin (no key; pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "pig latin for hello world", "hello world in pig latin", "translate this is fun to pig latin".
 * Vowel-start words get "ay"; others move the leading consonants to the end and add "ay".
 * Fun word play, not a language. Empty surface stays empty (page card only).
 */
export function pigLatin(text) {
  return String(text || '').trim().split(/(\s+)/).map((part) => {
    if (!/[a-z]/i.test(part)) return part;
    const m = part.match(/^([^a-z]*)([a-z]+)(.*)$/i);
    if (!m) return part;
    const pre = m[1], word = m[2], post = m[3];
    const lower = word.toLowerCase();
    const vowels = 'aeiou';
    if (vowels.includes(lower[0])) return pre + word + 'ay' + post;
    const consMatch = lower.match(/^[^aeiou]+/);
    if (!consMatch) return pre + word + 'ay' + post;
    const cons = consMatch[0];
    const rest = word.slice(cons.length);
    return pre + rest + cons + 'ay' + post;
  }).join('');
}

/** the text to translate, or null. Pure. */
export function pigOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!/pig\s*latin/i.test(t)) return null;
  if (/what\s+is\s+pig\s*latin|define\s+pig\s*latin|history\s+of\s+pig\s*latin|pig\s+farm|latin\s+language/i.test(t)) return null;
  let m = t.match(/^(?:pig\s*latin\s+(?:for|of|on)\s+)(.+)$/i);
  if (m) return m[1].trim();
  m = t.match(/^(.+?)\s+in\s+pig\s*latin$/i);
  if (m) return m[1].trim();
  m = t.match(/^(?:translate|convert|turn|say|write)\s+(.+?)\s+(?:to|into)\s+pig\s*latin$/i);
  if (m) return m[1].trim();
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const src = pigOf(text);
  if (!src) return 'none';
  const out = pigLatin(src);
  showPage((p) => {
    p.innerHTML = '<h2>Pig Latin</h2><div class="sub">' + esc(src) + '</div>'
      + '<div style="font-size:28px;font-weight:300;line-height:1.4;margin:8px 0;word-break:break-word">' + esc(out) + '</div>'
      + '<p style="color:#8a8a8a">Words that start with a vowel get “ay”; others move the starting consonants to the end and add “ay”. Fun word play, not a language.</p>';
  });
  return 'piglatin';
}

export default {
  name: 'piglatin',
  examples: ['pig latin for hello world', 'hello world in pig latin', 'translate this is fun to pig latin'],
  nearMisses: ['what is pig latin', 'pig farm near me', 'latin language', 'define pig latin'],
  match(lower, text) { return !!pigOf(text || lower); },
  run,
  suite() {
    const a = pigLatin('hello') === 'ellohay' && pigLatin('apple') === 'appleay' && pigLatin('hello world') === 'ellohay orldway';
    const b = pigOf('pig latin for hello') === 'hello' && pigOf('hello world in pig latin') === 'hello world' && !pigOf('what is pig latin');
    const ok = a && b;
    return { ok, got: ok ? 'pass' : JSON.stringify({ a, b, pig: pigLatin('hello world'), of: pigOf('pig latin for hello') }) };
  }
};
