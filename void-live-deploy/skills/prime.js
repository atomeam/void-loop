/**
 * prime skill — is a number prime, or the next prime after one (pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "is 17 prime", "is 1 a prime number", "next prime after 20", "prime after 100".
 */
export function isPrime(n) {
  n = Math.floor(+n); if (n < 2) return false; if (n < 4) return true; if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) if (n % i === 0 || n % (i + 2) === 0) return false;
  return true;
}
export function nextPrime(n) {
  n = Math.floor(+n) + 1; if (n < 2) n = 2; while (!isPrime(n)) n++; return n;
}
export function primeOf(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  let m = t.match(/^(?:is |check if )?(\d{1,12}) (?:a |an )?prime(?: number)?$/);
  if (m) return { n: +m[1], kind: 'is' };
  m = t.match(/^(?:next |the next )?prime (?:after|following|greater than) (\d{1,12})$/) || t.match(/^prime after (\d{1,12})$/);
  if (m) return { n: +m[1], kind: 'next' };
  return null;
}
function run(text, api) {
  const { showPage, esc } = api;
  const q = primeOf(text); if (!q) return 'none';
  if (q.kind === 'is') {
    const yes = isPrime(q.n);
    showPage((p) => { p.innerHTML = '<h2>' + esc(q.n) + '</h2><div style="font-size:40px;font-weight:200;margin:12px 0">' + (yes ? 'Yes, prime' : 'No') + '</div><div class="sub">' + (yes ? 'divisible only by 1 and itself' : 'has a divisor other than 1 and itself') + '</div>'; });
  } else {
    const p = nextPrime(q.n);
    showPage((p) => { p.innerHTML = '<h2>Next prime after ' + esc(q.n) + '</h2><div style="font-size:40px;font-weight:200;margin:12px 0">' + p + '</div>'; });
  }
  return 'prime';
}
export default {
  name: 'prime',
  examples: ['is 17 prime', 'is 1 a prime number', 'next prime after 20', 'prime after 100'],
  nearMisses: ['what is a prime number', 'prime minister of canada', 'is 17 even'],
  match(lower, text) { return !!primeOf(text || lower); },
  run,
  suite() {
    const ok = isPrime(2) && isPrime(17) && isPrime(97) && !isPrime(1) && !isPrime(4) && !isPrime(91) && nextPrime(20) === 23 && nextPrime(1) === 2 && nextPrime(97) === 101;
    return { ok, got: ok ? 'pass' : 'fail' };
  }
};
