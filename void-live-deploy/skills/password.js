/**
 * password skill — generate a random secure password
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "generate a password", "random password", "make a secure password of 16 characters"
 */
export function isPassword(text) {
  return /^(?:please\s+)?(?:(?:generate|make|create|give\s+me)\s+(?:a\s+)?(?:random\s+|secure\s+)?password(?:\s+of\s+\d+\s+characters?)?|random\s+password|password\s+please)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function generate(len = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const m = /of\s+(\d+)\s+characters?/.exec(String(text || '').toLowerCase());
  const len = m ? Math.min(64, Math.max(8, +m[1])) : 16;
  const pw = generate(len);
  showPage((p) => {
    p.innerHTML = '<h2>Password</h2>'
      + '<p style="font-size:24px;font-family:monospace;word-break:break-all;background:rgba(255,255,255,.05);padding:12px;border-radius:8px">' + esc(pw) + '</p>'
      + '<div class="sub">' + len + ' characters. Copy it now — it is not stored.</div>'
      + '<div class="sub">say “another password” or “password of 20 characters” for one more</div>';
  });
  return 'password';
}

export default {
  name: 'password',
  examples: ['generate a password', 'random password', 'make a secure password of 16 characters', 'password of 20 characters'],
  nearMisses: ['what is a password', 'forgot password', 'change my password'],
  match(lower, text) { return isPassword(text); },
  run,
  suite() {
    const ok = isPassword('generate a password') && isPassword('random password') && !isPassword('what is a password');
    return { ok, got: 'match works' };
  }
};
