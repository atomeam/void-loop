// The text a visitor puts on the QR page. Pure. A line past 500 characters is refused
// so the page never builds a huge code.

export const QR_PAGE_MAX = 500;

export function qrPageText(raw) {
  const text = String(raw == null ? '' : raw).replace(/\r\n/g, '\n').trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > QR_PAGE_MAX) return { ok: false, reason: 'long' };
  return { ok: true, text };
}
