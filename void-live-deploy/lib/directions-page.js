// Two place names for the directions page. Pure.

const clean = (raw) => {
  const text = String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > 80) return { ok: false, reason: 'long' };
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\s'".,-]*$/u.test(text)) return { ok: false, reason: 'odd' };
  return { ok: true, text };
};

export function tripFields(from, to) {
  const a = clean(from);
  const b = clean(to);
  if (!a.ok) return a;
  if (!b.ok) return b.reason === 'empty' ? { ok: false, reason: 'empty' } : b;
  return { ok: true, from: a.text, to: b.text };
}

/** one line for a route that came back. Pure. */
export function tripLine(route) {
  if (!route || !route.ok) return '';
  const minutes = route.minutes === 1 ? '1 minute' : route.minutes + ' minutes';
  return minutes + ', ' + route.km + ' km. Road time with no live traffic.';
}
