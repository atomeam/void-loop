// Fills /qr/?text= so the page draws a code with scripts off.
import { qrMatrix, qrSvg, qrHex } from '../../lib/qr.js';
import { qrPageText } from '../../lib/qr-page.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function setValue(html, id, value) {
  return html.replace(new RegExp('(<[^>]*\\bid="' + id + '"[^>]*\\bvalue=")[^"]*', 'i'), '$1' + esc(value));
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (!url.searchParams.has('text')) return context.next();
  const page = qrPageText(url.searchParams.get('text'));
  const asset = await context.next();
  let html = await asset.text();
  const value = page.ok ? page.text : String(url.searchParams.get('text') || '').slice(0, 500);
  const dark = qrHex(url.searchParams.get('dark'), '#000000');
  const light = qrHex(url.searchParams.get('light'), '#ffffff');
  html = html.replace(/(<textarea\b[^>]*\bid="text"[^>]*>)[\s\S]*?(<\/textarea>)/i, '$1' + esc(value) + '$2');
  html = setValue(html, 'dark', dark);
  html = setValue(html, 'light', light);
  let picture = '';
  let note = '';
  let line = '';
  if (!page.ok) note = page.reason === 'long' ? 'That line is too long for one code.' : '';
  else {
    const code = qrMatrix(page.text);
    if (!code) note = 'That line is too long for one code.';
    else {
      picture = qrSvg(code, { margin: 4, label: 'QR code', dark, light });
      line = 'Version ' + code.version + ', level ' + code.ecl;
    }
  }
  html = html.replace(/(<div\b[^>]*\bid="out"[^>]*>)[\s\S]*?(<\/div>)/i, '$1' + picture + '$2');
  if (line) html = html.replace(/(<p\b[^>]*\bid="meta"[^>]*>)[\s\S]*?(<\/p>)/i, '$1' + esc(line) + '$2');
  if (note) html = html.replace(/(<p\b[^>]*\bid="err"[^>]*>)[\s\S]*?(<\/p>)/i, '$1' + esc(note) + '$2');
  if (picture) {
    const file = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(picture);
    html = html.replace(/(<a\b[^>]*\bid="svgdl"[^>]*)(>)/i, (tag, open, end) => (/\bhref="/.test(open) ? open.replace(/\bhref="[^"]*"/, 'href="' + file + '"') : open.replace('<a', '<a href="' + file + '"')) + end);
  }
  const share = '/qr/?text=' + encodeURIComponent(value) + '&dark=' + encodeURIComponent(dark) + '&light=' + encodeURIComponent(light);
  html = html.replace(/(<a\b[^>]*\bid="share"[^>]*\bhref=")[^"]*/i, '$1' + share);
  html = html.replace(/(<a\b[^>]*\bid="share"[^>]*>)[\s\S]*?(<\/a>)/i, '$1' + esc(share) + '$2');
  if (page.ok) {
    const hand = '/text-diff/?changed=' + encodeURIComponent(page.text);
    html = html.replace(/<a\b[^>]*\bdata-base="\/text-diff\/"[^>]*>/i, (tag) => tag.includes('href="') ? tag.replace(/\bhref="[^"]*"/, 'href="' + hand + '"') : tag.replace('<a', '<a href="' + hand + '"'));
  }
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
