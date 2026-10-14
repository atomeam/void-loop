/**
 * password skill — a random strong password (no key; pure local)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "generate a password", "make a strong password", "random password", "a 16 character password".
 */
const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*_-+=';
export function isPassword(text) {
  return /^(?:please\s+)?(?:generate|make|create|give\s+me|pick)\s+(?:me\s+)?(?:a\s+|another\s+)?(?:strong\s+|secure\s+|random\s+)?password(?:\s+(?:of\s+)?(?:\d+|sixteen|twelve|twenty)\s*(?:chars?|characters)?)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

export function lengthOf(text) {
  const m = String(text || '').match(/(\d+)\s*(?:char|character)/i);
  if (m) return Math.min(64, Math.max(8, parseInt(m[1], 10)));
  if (/sixteen/i.test(text)) return 16;
  if (/twelve/i.test(text)) return 12;
  if (/twenty/i.test(text)) return 20;
  return 16;
}

export function generate(len = 16, rnd = Math.random) {
  let s = '';
  for (let i = 0; i < len; i++) s += CHARS[Math.floor(rnd() * CHARS.length)];
  return s;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const len = lengthOf(text);
  const pw = generate(len);
  showPage((p) => {
    p.innerHTML = '<h2>A password</h2><p style="font-size:22px;font-family:ui-monospace,monospace;letter-spacing:1px;background:#111;padding:12px 16px;border-radius:8px;word-break:break-all">' + esc(pw) + '</p><div class="sub">' + len + ' characters · say “another password” for a new one</div><p style="color:#8a8a8a;font-size:14px">Random local characters. Copy it somewhere safe; this page forgets it.</p>';
  });
  return 'password';
}

export default {
  name: 'password',
  examples: ['generate a password', 'make a strong password', 'random password', 'a 16 character password'],
  nearMisses: ['what is a password', 'password manager', 'change my password', 'define password'],
  match(lower, text) { return isPassword(text); },
  run,
  suite() {
    const matched = isPassword('generate a password') && isPassword('make a strong password') && !isPassword('what is a password');
    const len = lengthOf('a 20 character password');
    const g = generate(4, () => 0);
    return { ok: matched && len === 20 && g === 'aaaa', got: matched ? len + '/' + g : 'match failed' };
  }
};
