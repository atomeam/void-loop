// Fills /qr/?text= so the page draws a code with scripts off.
import { qrMatrix, qrSvg } from '../../lib/qr.js';
import { qrPageText } from '../../lib/qr-page.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (!url.searchParams.has('text')) return context.next();
  const page = qrPageText(url.searchParams.get('text'));
  const asset = await context.next();
  let html = await asset.text();
  const value = page.ok ? page.text : String(url.searchParams.get('text') || '').slice(0, 500);
  html = html.replace('<textarea id="text" name="text" rows="3" maxlength="500" spellcheck="false" autocomplete="off"></textarea>', '<textarea id="text" name="text" rows="3" maxlength="500" spellcheck="false" autocomplete="off">' + esc(value) + '</textarea>');
  let picture = '';
  let note = '';
  let line = '';
  if (!page.ok) note = page.reason === 'long' ? 'That line is too long for one code.' : '';
  else {
    const code = qrMatrix(page.text);
    if (!code) note = 'That line is too long for one code.';
    else {
      picture = qrSvg(code, { margin: 4, label: 'QR code' });
      line = 'Version ' + code.version + ', level ' + code.ecl;
    }
  }
  html = html.replace('<div id="out" aria-live="polite"></div>', '<div id="out" aria-live="polite">' + picture + '</div>');
  if (line) html = html.replace('<p id="meta"></p>', '<p id="meta">' + esc(line) + '</p>');
  if (note) html = html.replace('<p id="err" role="status"></p>', '<p id="err" role="status">' + esc(note) + '</p>');
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
