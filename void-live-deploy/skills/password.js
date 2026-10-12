/**
 * password skill - generate a random password
 * "generate a password", "make me a password", "random password"
 */
function isPassword(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  return /^(?:please\s+)?(?:generate\s+(?:a\s+)?password|make\s+(?:me\s+)?(?:a\s+)?password|random\s+password|create\s+(?:a\s+)?password)$/.test(t);
}

function generate(len = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function run(text, api) {
  const { showPage, esc } = api;
  const pw = generate();
  showPage((el) => {
    el.innerHTML = '<h2>Password</h2><p style="font-size:24px;font-family:monospace;word-break:break-all">' + esc(pw) + '</p>'
      + '<div class="sub">copy it now; it is not saved. say “generate a password” for another</div>'
      + '<div class="src">Source: local random · as of 2026-10</div>';
  });
  return 'password';
}

export default {
  name: 'password',
  examples: ['generate a password', 'make me a password', 'random password'],
  nearMisses: ['what is a password', 'password manager', 'forgot my password'],
  match(lower, text) { return isPassword(text); },
  run,
  suite() { return { ok: isPassword('generate a password') && !isPassword('what is a password') }; }
};
