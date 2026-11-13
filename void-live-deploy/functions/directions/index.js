// Fills /directions/?from=&to= so the page answers with scripts off.
import { drive } from '../../lib/drive.js';
import { tripFields, tripLine } from '../../lib/directions-page.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (!url.searchParams.has('from') && !url.searchParams.has('to')) return context.next();
  const fields = tripFields(url.searchParams.get('from') || '', url.searchParams.get('to') || '');
  const asset = await context.next();
  let html = await asset.text();
  if (fields.ok) {
    html = html.replace(/(id="from"[^>]*\bvalue=")[^"]*/, '$1' + esc(fields.from));
    html = html.replace(/(id="to"[^>]*\bvalue=")[^"]*/, '$1' + esc(fields.to));
  }
  let note = '';
  let body = '';
  if (!fields.ok) note = fields.reason === 'long' ? 'That place name is too long.' : 'Type where you start and where you are going.';
  else {
    try {
      const trip = await drive(fields.from, fields.to);
      if (!trip.ok) note = /could not find/.test(trip.error) ? (fields.from + ' or ' + fields.to) + ' is not on the map.' : 'No driving route between those places.';
      else body = '<h2>' + esc(trip.from.name) + ' to ' + esc(trip.to.name) + '</h2><p>' + esc(tripLine(trip)) + '</p>';
    } catch (_) { note = 'The map did not answer just now. Try again in a moment.'; }
  }
  html = html.replace('<div id="out" aria-live="polite"></div>', '<div id="out" aria-live="polite">' + body + '</div>');
  if (note) html = html.replace('<p id="err" role="status"></p>', '<p id="err" role="status">' + esc(note) + '</p>');
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
