// Fills /meanings/?word= from /api/meanings so the page answers with scripts off.
import { cleanWord } from '../../lib/meanings.js';
import { answer } from '../api/meanings.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function block(word, senses) {
  if (!senses.length) return '<p>“' + esc(word) + '” is not in the dictionary.</p>';
  const body = senses.map((s) => (s.pos ? '<p>' + esc(s.pos) + '</p>' : '') + '<ol>' + s.defs.map((d) => '<li>' + esc(d) + '</li>').join('') + '</ol>' + (s.ex ? '<p>“' + esc(s.ex) + '”</p>' : '')).join('');
  const href = 'https://en.wiktionary.org/wiki/' + encodeURIComponent(word.replace(/ /g, '_'));
  return '<h2>' + esc(word) + '</h2>' + body + '<p class="src">Source: <a href="' + href + '" rel="noopener">Dictionary entry</a></p>';
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const word = cleanWord(url.searchParams.get('word') || '');
  if (!word) return context.next();
  const asset = await context.next();
  let html = await asset.text();
  html = html.replace(/(id="word"[^>]*\bvalue=")[^"]*/, '$1' + esc(word));
  const api = new URL('/api/meanings', url);
  api.searchParams.set('word', word);
  let note = '';
  let filled = '';
  try {
    const res = await answer(new Request(api, { headers: context.request.headers }), context.env);
    const data = await res.json();
    if (!res.ok || data.error) note = data.error || 'The dictionary did not answer just now. Try again in a moment.';
    else filled = block(data.word || word, data.senses || []);
  } catch (_) { note = 'The dictionary did not answer just now. Try again in a moment.'; }
  html = html.replace('<div id="out" aria-live="polite"></div>', '<div id="out" aria-live="polite">' + (note ? '' : filled) + '</div>');
  if (note) html = html.replace('<p id="err" role="status"></p>', '<p id="err" role="status">' + esc(note) + '</p>');
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
