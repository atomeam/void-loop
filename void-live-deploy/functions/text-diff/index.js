// Fills /text-diff/?original=&changed= so the page answers with scripts off.
import { diffTexts, withContext } from '../../lib/textdiff.js';
import { diffSummary, foldText } from '../../lib/text-diff-page.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mark = { del: '−', add: '+', same: ' ' };

function block(rows) {
  const summary = diffSummary(rows);
  if (!summary.ok) return { say: '', note: 'Up to 3000 lines on a side.', diff: '' };
  if (summary.same) return { say: summary.line, note: '', diff: '' };
  const body = withContext(rows).map((r) => {
    if (r.t === 'skip') return '<div data-t="skip">⋯ ' + r.n + ' unchanged line' + (r.n === 1 ? '' : 's') + '</div>';
    const n = r.t === 'add' ? r.b : r.a;
    return '<div data-t="' + r.t + '"><span>' + n + '</span><span>' + mark[r.t] + '</span><span>' + esc(r.s) + '</span></div>';
  }).join('');
  return { say: summary.line, note: '', diff: body };
}

function fill(html, id, value) {
  const open = '<textarea id="' + id + '" name="' + id + '" spellcheck="false">';
  const at = html.indexOf(open);
  if (at < 0) return html;
  const end = html.indexOf('</textarea>', at);
  return html.slice(0, at + open.length) + esc(value) + html.slice(end);
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (!url.searchParams.has('original') && !url.searchParams.has('changed')) return context.next();
  const a = url.searchParams.get('original') || '';
  const b = url.searchParams.get('changed') || url.searchParams.get('text') || url.searchParams.get('q') || '';
  const mode = { lower: url.searchParams.get('case') === '1', space: url.searchParams.get('space') === '1' };
  const asset = await context.next();
  let html = await asset.text();
  html = fill(html, 'original', a);
  html = fill(html, 'changed', b);
  for (const [id, on] of [['fold-case', mode.lower], ['fold-space', mode.space]]) {
    if (!on) continue;
    html = html.replace(new RegExp('(<input\\b[^>]*\\bid="' + id + '"[^>]*)>', 'i'), (tag, open) => (/\bchecked\b/.test(open) ? tag : open.replace('<input', '<input checked') + '>'));
  }
  const view = block(diffTexts(foldText(a, mode), foldText(b, mode)));
  html = html.replace('<p id="say" aria-live="polite"></p>', '<p id="say" aria-live="polite">' + esc(view.say) + '</p>');
  html = html.replace('<div id="diff" aria-live="polite"></div>', '<div id="diff" aria-live="polite">' + view.diff + '</div>');
  if (view.note) html = html.replace('<p id="err" role="status"></p>', '<p id="err" role="status">' + esc(view.note) + '</p>');
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
