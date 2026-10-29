/**
 * password skill — generate a random secure password
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random password", "another password", "password of 20 characters" ("generate a password" is util's)
 */
import { utilOf } from './util.js';

// util is asked first and keeps the asks it already takes ("generate a password"): this one never claims one of them, so the two never overlap
export function isPassword(text) {
  if (utilOf(text)) return false;
  return /^(?:please\s+)?(?:(?:generate|make|create|give\s+me)\s+(?:a\s+|another\s+)?(?:random\s+|secure\s+|strong\s+|new\s+)*password(?:\s+(?:of|with)\s+\d+\s+characters?)?|(?:random|another|new)\s+password(?:\s+(?:of|with)\s+\d+\s+characters?)?|password\s+(?:of|with)\s+\d+\s+characters?|password\s+please)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

export const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
// crypto.getRandomValues, with bytes past the last whole multiple of the alphabet thrown away so no character is likelier than another;
// Math.random only where there is no crypto at all
export function generate(len = 16) {
  const c = globalThis.crypto, n = CHARS.length, cut = 256 - (256 % n);
  let out = '';
  while (out.length < len) {
    if (!c || !c.getRandomValues) { out += CHARS[Math.floor(Math.random() * n)]; continue; }
    for (const b of c.getRandomValues(new Uint8Array(len * 2))) { if (b < cut && out.length < len) out += CHARS[b % n]; }
  }
  return out;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const m = /(?:of|with)\s+(\d+)\s+characters?/.exec(String(text || '').toLowerCase());
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
  // "generate a password" and "make a secure password of 16 characters" reach util first (its padlock card, rank 460); this one takes
  // the asks util leaves: random, another, a length on its own, please
  examples: ['random password', 'another password', 'password of 20 characters', 'random password with 24 characters', 'password please'],
  nearMisses: ['what is a password', 'forgot password', 'change my password'],
  match(lower, text) { return isPassword(text); },
  run,
  suite() {
    const ok = !isPassword('generate a password') && isPassword('random password') && isPassword('another password') && !isPassword('what is a password') && generate(20).length === 20;
    return { ok, got: 'match works' };
  }
};
