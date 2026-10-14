/**
 * primes skill — is a number prime, or list primes up to a limit (no key; pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "is 17 a prime number", "is 15 prime", "primes under 50", "list primes up to 30".
 * Trial division up to sqrt; lists capped at 200 so a big ask stays fast.
 * Empty surface stays empty (page card only).
 */
export function isPrime(n) {
  n = Math.abs(Math.floor(Number(n)));
  if (!Number.isFinite(n) || n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

/** primes from 2 up to limit (inclusive), capped. Pure. */
export function primesUpTo(limit, cap = 200) {
  const lim = Math.min(Math.abs(Math.floor(Number(limit))) || 0, 10000);
  const out = [];
  for (let i = 2; i <= lim && out.length < cap; i++) if (isPrime(i)) out.push(i);
  return out;
}

/** { kind: 'check', n } or { kind: 'list', limit } or null. Pure. */
export function primeOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!/prime/i.test(t)) return null;
  if (/what\s+is\s+a\s+prime|define\s+prime|prime\s+minister|prime\s+time|amazon\s+prime/i.test(t)) return null;
  let m = t.match(/^(?:is\s+)?(\d{1,8})\s+(?:a\s+)?prime(?:\s+number)?$/i);
  if (m) return { kind: 'check', n: +m[1] };
  m = t.match(/^(?:list\s+|show\s+|give\s+me\s+)?primes?\s+(?:under|up\s+to|to|below|<=?\s*)\s*(\d{1,6})$/i);
  if (m) return { kind: 'list', limit: +m[1] };
  m = t.match(/^(?:the\s+)?primes?\s+(?:less\s+than|under)\s+(\d{1,6})$/i);
  if (m) return { kind: 'list', limit: +m[1] };
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = primeOf(text);
  if (!q) return 'none';
  if (q.kind === 'check') {
    const yes = isPrime(q.n);
    showPage((p) => {
      p.innerHTML = '<h2>Is ' + esc(String(q.n)) + ' prime?</h2>'
        + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + (yes ? 'Yes' : 'No') + '</div>'
        + '<p style="color:#8a8a8a">' + (yes ? 'No divisors other than 1 and itself.' : 'It has a divisor other than 1 and itself.') + ' Checked by trial division.</p>';
    });
  } else {
    const list = primesUpTo(q.limit);
    showPage((p) => {
      p.innerHTML = '<h2>Primes up to ' + esc(String(q.limit)) + '</h2>'
        + '<div class="sub">' + list.length + (list.length === 1 ? ' prime' : ' primes') + (list.length >= 200 ? ' (showing the first 200)' : '') + '</div>'
        + '<div style="font-size:18px;line-height:1.5;margin:8px 0;word-break:break-word">' + esc(list.join(', ')) + '</div>'
        + '<p style="color:#8a8a8a">Trial division. Ask for a smaller limit if you want them all.</p>';
    });
  }
  return 'primes';
}

export default {
  name: 'primes',
  examples: ['is 17 a prime number', 'is 15 prime', 'primes under 50', 'list primes up to 30'],
  nearMisses: ['what is a prime number', 'prime minister', 'amazon prime', 'prime time'],
  match(lower, text) { return !!primeOf(text || lower); },
  run,
  suite() {
    const a = isPrime(17) && !isPrime(15) && !isPrime(1) && isPrime(2) && primesUpTo(10).join(',') === '2,3,5,7';
    const b = primeOf('is 17 a prime number') && primeOf('is 17 a prime number').n === 17 && primeOf('primes under 50').limit === 50 && !primeOf('what is a prime number');
    const ok = a && b;
    return { ok, got: ok ? 'pass' : JSON.stringify({ a, b }) };
  }
};
