// Fills /songs/?title=&artist= so the page plays a preview with scripts off.
import { findTrack } from '../../lib/hear.js';
import { songFields } from '../../lib/songs.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function block(track) {
  if (!track) return '<p>That recording is not in the song search.</p>';
  return '<h2>' + esc(track.title) + '</h2><p>' + esc(track.artist) + '</p><audio controls src="' + esc(track.preview) + '"></audio>';
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (!url.searchParams.has('title') && !url.searchParams.has('artist')) return context.next();
  const fields = songFields(url.searchParams.get('title') || '', url.searchParams.get('artist') || '');
  const asset = await context.next();
  let html = await asset.text();
  if (fields.ok) {
    html = html.replace(/(id="title"[^>]*\bvalue=")[^"]*/, '$1' + esc(fields.title));
    html = html.replace(/(id="artist"[^>]*\bvalue=")[^"]*/, '$1' + esc(fields.artist));
  }
  let note = '';
  let body = '';
  if (!fields.ok) note = fields.reason === 'long' ? 'That line is too long.' : 'Type a song and who plays it.';
  else {
    try {
      const track = await findTrack(fields.title, fields.artist);
      body = block(track);
    } catch (_) { note = 'The song search did not answer just now. Try again in a moment.'; }
  }
  html = html.replace('<div id="out" aria-live="polite"></div>', '<div id="out" aria-live="polite">' + body + '</div>');
  if (note) html = html.replace('<p id="err" role="status"></p>', '<p id="err" role="status">' + esc(note) + '</p>');
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
