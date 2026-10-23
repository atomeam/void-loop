/**
 * password skill — generate a random password locally (no key, empty surface stays empty)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "generate a password", "new password", "password please".
 */
export function isPassword(text) {
  return /^(?:please\s+)?(?:generate\s+(?:a\s+|me\s+a\s+)?password|(?:new|random|strong)\s+password|password(?:\s+please)?|make\s+a\s+password)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function generatePassword(len = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let pw = '';
  for (let i = 0; i < len; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const pw = generatePassword();
  showPage((p) => {
    p.innerHTML = '<h2>A password</h2><p style="font-size:24px;font-family:monospace;letter-spacing:1px">' + esc(pw) + '</p><div class="sub">16 characters · say “new password” for another</div>';
  });
  return 'password';
}

export default {
  name: 'password',
  examples: ['generate a password', 'new password', 'random password', 'strong password'],
  nearMisses: ['what is a password', 'password reset', 'forgot password'],
  match(lower, text) { return isPassword(text); },
  run,
  suite() {
    const ok = isPassword('generate a password') && isPassword('new password') && !isPassword('password reset');
    return { ok, got: 'match works' };
  }
};
