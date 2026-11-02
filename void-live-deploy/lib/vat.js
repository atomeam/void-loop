// VAT engine: integer kopeck arithmetic with a strict half-up rounding rule.
// The VAT amount is rounded half up to a whole kopeck, and the other side of the pair is derived
// by addition or subtraction so net + vat = gross always holds exactly.

export const DEFAULT_RATE = 2000n;

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

export function compute(netKop, grossKop, bp) {
  const netRes = vatFromNet(netKop, bp);
  if (!netRes.error) return netRes;
  const grossRes = vatFromGross(grossKop, bp);
  if (!grossRes.error) return grossRes;
  return { error: 'inconsistent' };
}

export function parseAmount(text) {
  const clean = String(text || '').replace(/[^0-9.-]/g, '');
  if (!clean || clean === '-' || clean === '.') return null;
  const val = parseFloat(clean);
  if (isNaN(val)) return null;
  const kop = BigInt(Math.round(val * 100));
  return kop >= 0n ? kop : null;
}

export function parseRate(text) {
  const clean = String(text || '').replace(/[^0-9.]/g, '');
  if (!clean) return null;
  const val = parseFloat(clean);
  if (isNaN(val)) return null;
  const rate = BigInt(Math.round(val * 100));
  return rate >= 0n ? rate : null;
}

export function money(kop, locale) {
  const val = Number(kop) / 100;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

export function rateText(rate) {
  return (Number(rate) / 100).toFixed(0);
}
