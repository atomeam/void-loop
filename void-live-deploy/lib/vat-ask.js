import { parseAmount, parseRate, DEFAULT_RATE } from './vat.js';

const MAX = 80;

function splitRate(text) {
  const t = String(text || '').trim();
  const m = /(?:^|[\s,;(])(\d{1,3}(?:[.,]\d+)?)\s*%/.exec(t);
  if (!m) return { amount: t, rate: null };
  const rate = parseRate(m[1]);
  const amount = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
  return { amount, rate };
}

export function vatStateOf(text) {
  const t = String(text || '').replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim();
  if (!t || t.length > MAX) return null;
  const rules = [
    [/^(?:ндс|vat)\s+(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:от|из|с|of|on|from)\s+(.+)$/i, 'extract'],
    [/^(?:выделить|вычленить|извлечь|выдели|вычти)\s+(?:ндс\s+)?(?:из\s+)?(.+)$/i, 'extract'],
    [/^(?:начислить|начисли|добавить|добавь)\s+(?:ндс\s+)?(?:на\s+|к\s+)?(.+)$/i, 'add'],
    [/^(?:please\s+)?(?:remove|extract|take|deduct|subtract)\s+(?:the\s+)?vat\s+(?:from|of|out of)\s+(.+)$/i, 'extract'],
    [/^(?:please\s+)?(?:add|plus|include|put)\s+(?:the\s+)?vat\s+(?:to|on|into)\s+(.+)$/i, 'add'],
    [/^(?:please\s+)?(?:remove|extract|strip)\s+(.+?)\s+(?:minus|without|ex)[\s-]*vat$/i, 'extract'],
    [/^(?:please\s+)?(?:add|plus)\s+(.+?)\s+(?:plus|with|including|incl\.?)[\s-]*vat$/i, 'add'],
    [/^(.+?)\s+(?:minus|without|ex)[\s-]*vat$/i, 'extract'],
    [/^(.+?)\s+(?:plus|with|including|incl\.?)[\s-]*vat$/i, 'add'],
    [/^(.+?)\s+без[\s-]*ндс$/i, 'extract'],
    [/^(.+?)\s+с[\s-]*ндс$/i, 'add'],
  ];

  for (const [re, mode] of rules) {
    const r = re.exec(t);
    if (!r) continue;
    // "ндс 22% от 1000" names the rate first: its rule has two groups, the rate and then the sum (2026-11-03: it read 22 as the sum)
    const { amount, rate } = r[2] != null ? { amount: r[2], rate: parseRate(r[1]) } : splitRate(r[1]);
    const n = parseAmount(amount);
    if (n == null) continue;
    return { amount: n, rate: rate == null ? DEFAULT_RATE : rate, mode };
  }
  return null;
}

export function vatAskOf(text) {
  const t = String(text || '').replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim();
  if (!t || t.length > MAX) return '';
  if (/^(?:ндс\s*калькулятор|калькулятор\s*ндс|vat\s*calculator|vat\s*calc)$/i.test(t)) return '/vat/';
  const s = vatStateOf(t);
  if (!s) return '';
  const q = new URLSearchParams();
  q.set('sum', String(s.amount));
  if (s.rate !== DEFAULT_RATE) q.set('rate', String(s.rate));
  if (s.mode === 'add') q.set('mode', 'add');
  return '/vat/?' + q.toString();
}
