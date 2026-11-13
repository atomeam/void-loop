// A song title and the person who plays it, for the songs page. Pure.

const clean = (raw, max) => {
  const text = String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > max) return { ok: false, reason: 'long' };
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\s'".,:!?&-]*$/u.test(text)) return { ok: false, reason: 'odd' };
  return { ok: true, text };
};

export function songFields(title, artist) {
  const t = clean(title, 80);
  const a = clean(artist, 60);
  if (!t.ok) return t.reason === 'empty' && a.ok ? { ok: false, reason: 'empty' } : t;
  if (!a.ok) return a;
  return { ok: true, title: t.text, artist: a.text };
}
