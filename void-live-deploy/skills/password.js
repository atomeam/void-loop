/**
 * password skill — generate a secure random password (local, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "generate a password", "make me a password", "secure password".
 */
export function isPassword(text) {
  return /^(?:please\s+)?(?:(?:generate|make|create|give\s+me)\s+(?:a|another|one\s+more)\s+(?:secure\s+|strong\s+)?password|(?:another|a|random|secure|strong)\s+password|password(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function generatePassword(len = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let p = '';
  for (let i = 0; i < len; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
  return p;
}

function run(text, api) {
  const { showPage, esc } = api;
  const pw = generatePassword();
  showPage((el) => {
    el.innerHTML = '<h2>A secure password</h2><p style="font-size:22px;font-family:monospace;letter-spacing:1px">' + esc(pw) + '</p><div class="sub">16 characters, mixed case, numbers and symbols. Say “another password” for a new one.</div><div class="src">Generated locally in your browser. Never sent anywhere.</div>';
  });
  return 'password';
}

export default {
  name: 'password',
  examples: ['generate a password', 'make me a password', 'secure password', 'another password'],
  nearMisses: ['what is a password', 'password manager', 'forgot my password'],
  match(lower, text) { return isPassword(text); },
  run,
  suite() {
    const ok = isPassword('generate a password') && isPassword('secure password') && !isPassword('password manager');
    return { ok, got: 'match works' };
  }
};
