/**
 * password skill — generate a strong random password (no key, pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite() }
 * "generate a password", "strong password", "password of 16 characters".
 */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
function generate(len = 16) {
  let out = '';
  for (let i = 0; i < len; i++) out += CHARS[Math.floor(Math.random() * CHARS.length)];
  return out;
}
function isPassword(text) {
  return /^(?:generate|make|create|give\s+me)\s+(?:a\s+|an\s+)?(?:strong\s+|random\s+)?password(?:\s+(?:of\s+)?(\d+)\s*(?:characters?|chars?)?)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
async function run(text, api) {
  const { showPage, esc } = api;
  const m = String(text || '').match(/(\d+)/);
  const len = m ? Math.min(64, Math.max(8, +m[1])) : 16;
  const pw = generate(len);
  showPage((p) => {
    p.innerHTML = '<h2>Password</h2><p style="font-size:24px;font-family:monospace;letter-spacing:1px">' + esc(pw) + '</p><div class="sub">' + len + ' characters · copy it now</div><div class="src">Generated locally · as of Oct 2026</div>';
  });
  return 'password';
}
function suite() {
  const ok = isPassword('generate a password') && isPassword('password of 12 characters') && !isPassword('what is a password');
  return { ok, got: ok ? 'matched examples' : 'missed' };
}
export default {
  name: 'password',
  examples: ['generate a password', 'strong password', 'password of 16 characters'],
  nearMisses: ['what is a password', 'password manager', 'change my password'],
  match(lower, text) { return isPassword(text); },
  run,
  suite
};
