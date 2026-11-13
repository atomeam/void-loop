// n! for a whole number from 0 to 20. 0! is 1. Pure.

export function factorialOf(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!/^\d{1,2}$/.test(text)) return { ok: false, reason: 'odd' };
  const n = Number(text);
  if (n > 20) return { ok: false, reason: 'big' };
  let value = 1n;
  for (let i = 2; i <= n; i++) value *= BigInt(i);
  return { ok: true, n, value: value.toString() };
}
