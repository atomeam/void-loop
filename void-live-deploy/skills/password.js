/**
 * password skill — generate a strong random password in this browser (nothing sent, nothing stored)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "generate a password", "make me a strong password", "password 16 characters", "random password"
 */
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGIT = '0123456789';
const SYMBOL = '!@#$%^&*_-+=';

export function passwordOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:(?:generate|make|create|give\s+me|show\s+me)\s+(?:me\s+)?(?:a\s+|an\s+)?)?(?:strong\s+|random\s+|secure\s+)?password(?:\s+(?:of\s+|with\s+)?(\d{1,2})\s*(?:characters?|chars?|letters?)?)?$/);
  if (!m) return null;
  const len = m[1] ? Math.max(8, Math.min(64, parseInt(m[1], 10))) : 16;
  return { len };
}

export function makePassword(len = 16) {
  const pools = [LOWER, UPPER, DIGIT, SYMBOL];
  const all = pools.join('');
  const chars = [];
  // ensure at least one from each pool
  for (const p of pools) chars.push(p[Math.floor(Math.random() * p.length)]);
  for (let i = chars.length; i < len; i++) chars.push(all[Math.floor(Math.random() * all.length)]);
  // shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function run(text, api) {
  const want = passwordOf(text);
  if (!want) return 'none';
  const { showPage, esc } = api;
  const pw = makePassword(want.len);
  showPage((el) => {
    el.innerHTML = '<h2>A strong password</h2>'
      + '<p style="font-size:28px;font-family:ui-monospace,monospace;letter-spacing:1px;word-break:break-all;background:#111;padding:12px;border-radius:8px">' + esc(pw) + '</p>'
      + '<div class="sub">' + want.len + ' characters · mixed case, numbers, symbols · generated here, never sent or stored</div>'
      + '<p style="color:#8a8a8a;font-size:13px">Copy it now. Refreshing or closing the card discards it. Use a password manager for anything that matters.</p>'
      + '<div class="src">Client-side only · as of Oct 2026</div>';
  });
  return 'password';
}

export default {
  name: 'password',
  examples: ['generate a password', 'make me a strong password', 'password 16 characters', 'random password', 'create a password'],
  nearMisses: ['what is a strong password', 'password tips', 'how to remember passwords', 'my password is'],
  match(lower, text) { return !!passwordOf(text); },
  run,
  suite() {
    const p16 = makePassword(16);
    const ok = passwordOf('generate a password') && passwordOf('password 20 characters') && !passwordOf('what is a password')
      && p16.length === 16 && /[a-z]/.test(p16) && /[A-Z]/.test(p16) && /\d/.test(p16) && /[!@#$%^&*_\-+=]/.test(p16);
    return { ok, got: ok ? 'parsed and generated mixed' : 'failed parse or charset' };
  },
};
