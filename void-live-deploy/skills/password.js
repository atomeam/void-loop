/**
 * password skill — generate a secure random password (local only, nothing sent)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "generate a password", "random password", "make me a password".
 */
export function isPassword(text) {
  return /^(?:please\s+)?(?:(?:generate|make|create|give\s+me)\s+(?:a\s+|another\s+)?(?:secure\s+|random\s+|strong\s+)?password|(?:another|a|random|secure|strong)\s+password|password(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function generatePassword(len = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let pw = '';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) pw += chars[arr[i] % chars.length];
  return pw;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const pw = generatePassword();
  showPage((p) => {
    p.innerHTML = '<h2>A password</h2><p style="font-family:monospace;font-size:20px;background:#1a1a1e;padding:12px;border-radius:8px;word-break:break-all">' + esc(pw) + '</p><div class="sub">16 characters, mixed case, numbers and symbols. Generated in this browser; nothing is sent or stored. Say “another password” for a new one.</div>';
  });
  return 'password';
}

export default {
  name: 'password',
  examples: ['generate a password', 'random password', 'make me a password', 'another password'],
  nearMisses: ['what is a password', 'password manager', 'forgot my password'],
  match(lower, text) { return isPassword(text); },
  run,
  suite() {
    const ok = isPassword('generate a password') && isPassword('random password') && !isPassword('password manager');
    return { ok, got: 'match works' };
  }
};
