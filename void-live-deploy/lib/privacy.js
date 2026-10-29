// Privacy guard (owner, 2026-10-15: "make Verse the best at keeping secrets ever made"). Personal data is redacted before
// anything is stored or logged: keys and tokens (lib/automation-fix.js redact), then emails, phone numbers, IP addresses,
// card-like numbers and street-style handles become placeholders. Pure; the miss board, the answer cache key and every
// log line run through redactPersonal. tools/privacy-scan.mjs uses findPersonal to block commits that would carry them.
import { redact } from './automation-fix.js';

export const PATTERNS = [
  ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email]'],
  ['ipv4', /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, '[ip]'],
  ['ipv6', /\b(?:[0-9a-f]{1,4}:){4,7}[0-9a-f]{1,4}\b/gi, '[ip]'],
  ['card', /\b(?:\d[ -]?){13,16}\b/g, '[number]'],
  ['phone', /(?:\+\d{1,3}[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[phone]'],
  ['token', /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{8,}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bxox[abprs]-[A-Za-z0-9-]{10,}\b|\bAKIA[A-Z0-9]{16}\b/g, '[redacted]'],
];

/** text -> text with keys, emails, phones, IPs and card numbers replaced by placeholders */
export function redactPersonal(text) {
  let s = redact(String(text || ''));
  for (const [, re, ph] of PATTERNS) s = s.replace(re, ph);
  return s;
}

// placeholders and documentation ranges that are fine to commit
const ALLOWED = /@(x\.com|y\.com|domain\.com|email\.com|example\.(com|org|net)|a-to-mind\.com|users\.noreply\.github\.com|mail\.grokbot\.com)$|^(127\.0\.0\.1|0\.0\.0\.0|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.|10\.|192\.168\.)|^555|^\+?1?[\s.-]?\(?555/i;

/** text -> [{ kind, at }] for personal data that is not a placeholder (value never returned) */
export function findPersonal(text) {
  const out = [], s = String(text || '');
  for (const [kind, re] of PATTERNS) {
    for (const m of s.matchAll(re)) {
      const v = m[0].trim();
      if (ALLOWED.test(v) || /(.)\1{5,}/.test(v.replace(/\D/g, ''))) continue;
      if (kind === 'card' && (!luhn(v) || /[a-z]-$/i.test(s.slice(Math.max(0, m.index - 5), m.index)) || /^\d{8}-?\d{4}/.test(v.replace(/ /g, '')))) continue;
      if (/\bask-$/.test(s.slice(Math.max(0, m.index - 4), m.index))) continue;
      if (kind === 'ipv4' && /^\d+\.\d+\.\d+\.\d+$/.test(v) && /\d+\.\d+\.\d+\.\d+\.\d/.test(s.slice(m.index, m.index + v.length + 3))) continue;
      // a standard's clause ("section 4.25.7.2", "§ 1.2.3.4", "clause 5.1.2.3") is a section number, not an address (lists run 2, 2026-10-21)
      if (kind === 'ipv4' && /(?:\bsections?|\bclauses?|\bsec\.|\bpara(?:graph)?|§)\s*$/i.test(s.slice(Math.max(0, m.index - 12), m.index))) continue;
      out.push({ kind, at: m.index });
    }
  }
  return out;
}

export function luhn(v) {
  const d = String(v).replace(/\D/g, ''); let sum = 0;
  for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; }
  return d.length >= 13 && sum % 10 === 0;
}
