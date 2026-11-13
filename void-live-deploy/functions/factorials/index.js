// Fills /factorials/?n= so the page answers with scripts off.
import { factorialOf } from '../../lib/factorials.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (!url.searchParams.has('n')) return context.next();
  const result = factorialOf(url.searchParams.get('n'));
  const asset = await context.next();
  let html = await asset.text();
  const shown = result.ok ? String(result.n) : '';
  html = html.replace(/(id="n"[^>]*\bvalue=")[^"]*/, '$1' + esc(shown));
  const body = result.ok
    ? '<h2>' + esc(result.n + '! = ' + result.value) + '</h2><p>' + esc(result.n === 0 ? '0! is 1.' : result.n + '! is the product of every whole number from 1 to ' + result.n + '.') + '</p>'
    : '';
  const note = result.ok ? '' : 'Type a whole number from 0 to 20.';
  html = html.replace('<div id="out" aria-live="polite"></div>', '<div id="out" aria-live="polite">' + body + '</div>');
  if (note) html = html.replace('<p id="err" role="status"></p>', '<p id="err" role="status">' + esc(note) + '</p>');
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
