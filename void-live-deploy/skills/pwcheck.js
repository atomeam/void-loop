/**
 * pwcheck skill: "how secure is my password" (owner, 2026-10-24: back to the easy sites; the data's easiest real tool was howsecureismypassword.net).
 * A card with one box: type a password and see how long it would take to guess, why, and what to change, all worked out on this device (lib/pwcheck.js);
 * nothing is sent, and the box is a password field with autocomplete off. An optional button asks the Have I Been Pwned list whether it has leaked, sending
 * only the first 5 characters of its SHA-1. The full page is /password-strength/.
 * A password typed INTO THE ASK is never read: asks are logged, so an ask that looks like it carries one (digits, symbols or a long sentence) is answered
 * with a warning that never repeats it.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { check, leakCount, MAX_LEN } from '../lib/pwcheck.js';
import { bandMini } from '../lib/card-mini.js';

// "how secure is my password", "is hunter2 a good password" (answered with a warning, never read), "is my password strong?", "check my password strength", "test the strength of my password", "how long would it take to crack my password"
const ASKS = /^(?:please\s+)?(?:(?:how|is)\s+(?:secure|strong|safe|good)\b.*\bpassword\b|how\s+\w+\s+is\s+my\s+password|is\s+(?:my|this|the|our)\s+(?:\w+\s+)?(?:password|passcode)\s+(?:strong|secure|safe|good|ok|okay|any\s+good)(?:\s+enough)?|is\s+\S+(?:\s+\S+){0,3}\s+(?:a\s+)?(?:good|strong|secure|safe|decent)\s+(?:password|passcode)|(?:check|test|rate|grade)\s+(?:the\s+)?(?:strength\s+of\s+)?(?:my|a|the)?\s*password(?:\s+strength)?|(?:password|passcode)\s+(?:strength|checker|check|tester)|how\s+long\s+(?:to|would\s+it\s+take\s+to)\s+crack\b.*\bpassword\b|can\s+you\s+check\s+my\s+password)\s*[?.!]*$/i;
const NOT = /\b(?:generate|generator|make|create|suggest|reset|forgot|forget|change|manager|recover|save|store|hash|encrypt)\b/i;

/** true for an ask that wants the checker. Pure. */
export const matches = (text) => { const t = String(text || '').trim(); return ASKS.test(t) && !NOT.test(t); };
/** true when an ask may carry a password itself (digits, symbols or a long sentence): it is never shown or repeated. Pure. */
export const carries = (text) => String(text || '').trim().split(/\s+/).length > 9 || /[\d@#$%^&*()_+=<>{}[\]\\|~`"]/.test(String(text || ''));

function run(text, api) {
  const { showPage } = api, warn = carries(text);
  let lock = null; // the 3D padlock follows the rating as you type: open while weak, shut once strong (skills/mini/padlock.js)
  const card = showPage((el) => {
    el.dataset.cardKind = 'Password check';
    el.innerHTML = '<h2>How secure is my password?</h2>' // void-review: ok (constant markup: nothing from the ask is put in)
      + (warn ? '<p class="pw-warn" role="alert"><b>Do not type a real password into the ask box:</b> asks are kept in this browser’s history. Use the box below instead; it stays on this device.</p>' : '')
      + '<p>Type it here. It is worked out on this device and never sent anywhere.</p>'
      + '<p><input class="pw-in" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="' + MAX_LEN + '" aria-label="Password to check" placeholder="Password" style="font:inherit;width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid currentColor;border-radius:8px;background:transparent;color:inherit"></p>'
      + '<p><label style="font-size:13px"><input type="checkbox" class="pw-show"> show it</label></p>'
      + '<div class="pw-out" aria-live="polite"></div>'
      + '<p><button type="button" class="pw-leak">Has it leaked?</button> <a href="/password-strength/" class="pw-full">Open the full page</a> <span class="pw-leakmsg" role="status"></span></p>'
      + '<div class="src">An estimate, made here: ordinary words and patterns are priced the way a guesser would try them. The leak check sends only the first 5 characters of a fingerprint of the password.</div>'; 
    const q = (s) => el.querySelector(s), inp = q('.pw-in'), out = q('.pw-out'), msg = q('.pw-leakmsg');
    for (const ev of ['pointerdown', 'keydown']) for (const b of el.querySelectorAll('input,button,a')) b.addEventListener(ev, (e) => e.stopPropagation());
    q('.pw-show').addEventListener('change', (e) => { inp.type = e.target.checked ? 'text' : 'password'; });
    const draw = () => {
      const r = check(inp.value); msg.textContent = ''; out.textContent = ''; if (lock) lock.update({ score: r.length ? r.score : 0 }); if (!r.length) return;
      const line = (t, b) => { const p = document.createElement('p'); p.style.margin = '6px 0'; if (b) { const s = document.createElement('b'); s.textContent = b; p.append(s, ' '); } p.append(t); out.appendChild(p); };
      line('A login that allows 100 tries a second: ' + r.online + '.', r.label + '.'); line('A stolen list cracked offline at 10 billion tries a second: ' + r.offline + '.');
      for (const t of r.reasons) line(t); for (const t of r.tips) line(t);
    };
    inp.addEventListener('input', draw);
    q('.pw-leak').addEventListener('click', async () => {
      if (!inp.value) { msg.textContent = 'Type one first.'; return; } msg.textContent = 'Asking…';
      const n = await leakCount(inp.value);
      msg.textContent = n === null ? 'Could not reach the leak list just now.' : n > 0 ? 'It has leaked: it is in known breaches ' + n.toLocaleString('en') + ' times. Do not use it anywhere.' : 'Not in the known leaks (that does not make it strong).';
    });
    setTimeout(() => { try { inp.focus(); } catch (_) { /* a card with no focus */ } }, 50);
  });
  bandMini(api, card, 'padlock', { score: 0 }, '3D padlock: open until the password is strong').then((h) => { lock = h; });
  return 'pwcheck';
}

export default {
  name: 'pwcheck',
  examples: ['how secure is my password', 'is my password strong', 'check my password strength', 'test the strength of my password', 'how long would it take to crack my password'],
  nearMisses: ['generate a password', 'make me a password', 'forgot my password', 'reset my password', 'password manager', 'change my password'],
  match(lower, text) { return matches(text || lower); },
  run
};
