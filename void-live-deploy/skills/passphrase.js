/**
 * passphrase skill — generate a memorable passphrase from common words.
 * "generate a passphrase", "make a password", "secure passphrase of 4 words".
 * Empty surface stays empty: only when asked for a passphrase or password.
 */
const WORDS = ['apple', 'river', 'stone', 'cloud', 'light', 'forest', 'ocean', 'mountain', 'star', 'wind', 'fire', 'earth', 'moon', 'sun', 'tree', 'bird', 'fish', 'book', 'key', 'door', 'path', 'bridge', 'hill', 'lake', 'sky'];

export function makePassphrase(n = 4) {
  const words = [];
  for (let i = 0; i < n; i++) words.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  return words.join('-');
}

export function isPassphrase(text) {
  return /passphrase|password|secure phrase|random password|make a phrase/i.test(String(text || ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = String(text || '').match(/(\d+)\s*words?/);
  const n = m ? Math.min(8, Math.max(3, +m[1])) : 4;
  const phrase = makePassphrase(n);
  showPage((p) => {
    p.innerHTML = '<h2>Passphrase</h2><p style="font-size:22px;font-family:monospace">' + esc(phrase) + '</p><div class="sub">say “another passphrase” for a new one</div>';
  });
  return 'passphrase';
}

export default {
  name: 'passphrase',
  examples: ['generate a passphrase', 'make a password', 'secure passphrase of 4 words'],
  nearMisses: ['what is a password', 'password manager', 'forgot my password'],
  match(lower, text) { return isPassphrase(text); },
  run,
  suite() {
    const p = makePassphrase(3);
    return { ok: typeof p === 'string' && p.split('-').length === 3 && isPassphrase('generate a passphrase') && !isPassphrase('what is a password') };
  },
};
