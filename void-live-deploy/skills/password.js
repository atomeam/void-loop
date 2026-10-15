/**
 * password skill: "generate a password", "make a password", "password generator".
 * Shows a summoned page with a client-side generated password. Empty surface stays empty.
 * Nothing is sent; regenerate on the page.
 */
export function passwordOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:(?:generate|make|create|give me)\s+(?:a\s+|an\s+|me\s+)?(?:strong\s+|secure\s+|random\s+)?password|password\s+(?:generator|maker))$/.test(t) ||
         /^new\s+password$/.test(t);
}

function generate(len = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function run(text, api) {
  const { showPage } = api;
  if (!passwordOf(text)) return 'none';
  const pw = generate();
  showPage((p) => {
    p.innerHTML = '<h2>Password</h2><div class="sub">generated in this browser</div><p style="font-size:24px;font-family:monospace;word-break:break-all;margin:20px 0;padding:12px;background:rgba(0,0,0,.3);border-radius:8px">' + pw + '</p><p class="src">Nothing is sent. Ask again for a new one.</p>';
  });
  return 'password';
}

export default {
  name: 'password',
  examples: ['generate a password', 'make a password', 'password generator', 'new password'],
  nearMisses: ['what is a password', 'password strength', 'login'],
  match(lower, text) { return passwordOf(text || lower); },
  run,
  suite() {
    return { ok: passwordOf('generate a password') && passwordOf('password generator') && !passwordOf('hello') };
  },
};
