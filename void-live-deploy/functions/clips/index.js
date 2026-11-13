// Fills /clips/?q= from the public film archive so the page answers with scripts off.
import { hitsOf } from '../../lib/video.js';
import { archiveSearch, clipQuery } from '../../lib/clips.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function block(hits) {
  if (!hits.length) return '<p>Nothing matched that title.</p>';
  const first = hits[0];
  const frame = '<iframe src="https://archive.org/embed/' + esc(first.id) + '" title="' + esc(first.title || 'Clip') + '" allowfullscreen></iframe>';
  const items = hits.map((h) => '<li>' + esc(h.title || h.id) + (h.channel ? ' · ' + esc(h.channel) : '') + '</li>').join('');
  return frame + '<ul>' + items + '</ul>';
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (!url.searchParams.has('q')) return context.next();
  const page = clipQuery(url.searchParams.get('q'));
  const asset = await context.next();
  let html = await asset.text();
  const shown = page.ok ? page.text : '';
  html = html.replace(/(id="q"[^>]*\bvalue=")[^"]*/, '$1' + esc(shown));
  let note = '';
  let body = '';
  if (!page.ok) note = page.reason === 'long' ? 'That title is too long.' : 'Type a short title.';
  else {
    try {
      const r = await fetch(archiveSearch(page.text), { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('status');
      body = block(hitsOf('archive', await r.json()));
    } catch (_) { note = 'The film archive did not answer just now. Try again in a moment.'; }
  }
  html = html.replace('<div id="out" aria-live="polite"></div>', '<div id="out" aria-live="polite">' + body + '</div>');
  if (note) html = html.replace('<p id="err" role="status"></p>', '<p id="err" role="status">' + esc(note) + '</p>');
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
