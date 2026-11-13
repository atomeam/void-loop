// The text a visitor puts on the QR page. Pure. A line past 500 characters is refused
// so the page never builds a huge code.

export const QR_PAGE_MAX = 500;

export function qrPageText(raw) {
  const text = String(raw == null ? '' : raw).replace(/\r\n/g, '\n').trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > QR_PAGE_MAX) return { ok: false, reason: 'long' };
  return { ok: true, text };
}

const wifiEsc = (s) => String(s || '').replace(/([\\;,:"])/g, '\\$1');

/** the Wi-Fi text a phone reads from a code. Security is WPA, WEP, or nopass. Pure. */
export function qrWifi(name, password, security) {
  const auth = security === 'WEP' || security === 'nopass' ? security : 'WPA';
  return 'WIFI:T:' + auth + ';S:' + wifiEsc(name) + ';P:' + (auth === 'nopass' ? '' : wifiEsc(password)) + ';;';
}

/** a small contact card (vCard 3) from a name, a phone, and an email. Pure. */
export function qrContact(name, phone, email) {
  const line = (s) => String(s || '').replace(/[\r\n]/g, ' ').trim();
  const rows = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + line(name)];
  if (line(phone)) rows.push('TEL:' + line(phone));
  if (line(email)) rows.push('EMAIL:' + line(email));
  rows.push('END:VCARD');
  return rows.join('\n');
}
