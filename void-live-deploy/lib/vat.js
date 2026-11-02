// VAT engine: integer kopeck arithmetic with a strict half-up rounding rule.
// The VAT amount is rounded half up to a whole kopeck, and the other side of the pair is derived
// by addition or subtraction so net + vat = gross always holds exactly.

const MAX_AMOUNT = 10n ** 15n;
const MAX_RATE = 10000n;

function toBigInt(value, kind) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value)) {
    if (value < 0 || value > Number.MAX_SAFE_INTEGER) return null;
    return BigInt(value);
  }
  return null;
}

function normalizeAmount(value) {
  const v = toBigInt(value, 'amount');
  if (v === null || v < 0n || v > MAX_AMOUNT) return null;
  return v;
}

function normalizeRate(value) {
  const v = toBigInt(value, 'rate');
  if (v === null || v < 0n || v > MAX_RATE) return null;
  return v;
}

function roundHalfUp(numerator, denominator) {
  const q = numerator / denominator;
  const r = numerator % denominator;
  return (r * 2n >= denominator) ? q + 1n : q;
}

export const DEFAULT_RATE = 2200n;

export const RATE_PRESETS = [
  { id: '0', rate: 0n, note: 'zero rate' },
  { id: '10', rate: 1000n, note: '10% rate' },
  { id: '20', rate: 2000n, note: 'shipments before 2026-01-01 and corrections to them.' },
  { id: '22', rate: 2200n, note: 'standard rate since 2026-01-01.' },
];

export function vatFromNet(netKop, bp) {
  const net = normalizeAmount(netKop);
  const rate = normalizeRate(bp);
  if (net === null) return { error: 'invalid-amount' };
  if (rate === null) return { error: 'invalid-rate' };
  const vat = rate === 0n ? 0n : roundHalfUp(net * rate, 10000n);
  const gross = net + vat;
  return { net, vat, gross };
}

export function vatFromGross(grossKop, bp) {
  const gross = normalizeAmount(grossKop);
  const rate = normalizeRate(bp);
  if (gross === null) return { error: 'invalid-amount' };
  if (rate === null) return { error: 'invalid-rate' };
  if (rate === 0n) return { net: gross, vat: 0n, gross };
  const vat = roundHalfUp(gross * rate, 10000n + rate);
  const net = gross - vat;
  return { net, vat, gross };
}

export function parseAmount(v) {
  return normalizeAmount(v);
}

export function parseRate(v) {
  return normalizeRate(v);
}

export function money(v, locale) {
  if (v === null || v === undefined) return '';
  const abs = v < 0n ? -v : v;
  const integer = abs / 100n;
  const fraction = abs % 100n;
  const sign = v < 0n ? '-' : '';
  const f = fraction.toString().padStart(2, '0');
  return `${sign}${integer}.${f}`;
}

export function compute(s) {
  if (s.mode === 'add') return vatFromNet(s.amount, s.rate);
  return vatFromGross(s.amount, s.rate);
}

export function rateText(r) {
  if (r === 0n) return '0';
  const p = (r * 100n) / 10000n;
  if (p % 100n === 0n) return String(p / 100n);
  return String(Number(p) / 100);
}
