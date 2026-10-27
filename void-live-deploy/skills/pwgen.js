/**
 * pwgen skill — generate a random password
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "generate a password", "make a strong password", "random password 16".
 */
export function isPwgen(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/^(?:please\s+|can you\s+|could you\s+)/i, '');
  return /^(?:generate|make|create|give\s+me)\s+(?:a\s+|me\s+a\s+)?(?:strong\s+|random\s+)?password(?:\s+\d{1,2})?$/i.test(t);
}

function lengthOf(text) {
  const m = /password\s+(\d{1,2})/i.exec(text);
  return m ? Math.min(32, Math.max(8, +m[1])) : 16;
}

function generate(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let out = '';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

function run(text, api) {
  const { showPage, esc } = api;
  const len = lengthOf(text);
  const pw = generate(len);
  showPage((p) => {
    p.innerHTML = '<h2>Password</h2><p style="font-size:24px;font-family:monospace;letter-spacing:.04em;word-break:break-all">' + esc(pw) + '</p>'
      + '<div class="sub">' + len + ' characters · copy it now, it is not stored</div>'
      + '<div class="sub">say “generate a password 20” for another length</div>';
  });
  return 'pwgen';
}

export default {
  name: 'pwgen',
  examples: ['generate a password', 'make a strong password', 'random password 16', 'give me a password'],
  nearMisses: ['password check', 'is this password strong', 'login'],
  match(lower, text) { return isPwgen(text); },
  run,
  suite() {
    const ok = isPwgen('generate a password') && isPwgen('make a strong password 20') && !isPwgen('password check');
    return { ok, got: 'match works' };
  }
};
