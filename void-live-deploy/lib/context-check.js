// The extension's context check (asked by Verse, domains/void.voice.md, 2026-10-14: "Implement a lightweight 'context-check' skill
// that allows the extension version of me to identify the dominant data type on the current page (text, image, or table) and
// suggest a matching skill."). The extension counts what the tab holds (extension/page.js voidReadTab: how many characters of
// text, how many real pictures, how many table rows and cells; counts only, never the page's words), the page decides the
// dominant kind here and the tab card (skills/tab.js) suggests one skill for it. Pure; tests in tools/context-check.test.mjs.
const n = (x) => (Number.isFinite(+x) && +x > 0 ? Math.floor(+x) : 0);

/** the counts the extension read -> 'table' | 'image' | 'text' | '' (too little of anything to call) */
export function contentOf(c) {
  if (!c || typeof c !== 'object') return '';
  const text = n(c.text), images = n(c.images), rows = n(c.rows), cells = n(c.cells);
  // a table: three rows or more with real cells, and the table's cells carry a fair share of the page's text (about 60 characters a cell or less)
  if (rows >= 3 && cells >= 6 && cells * 60 >= text) return 'table';
  // pictures: a page with little text around at least one large picture, or several large pictures with not much more
  if ((images >= 1 && text < 400) || (images >= 3 && text < 1500)) return 'image';
  if (text >= 200) return 'text';
  return '';
}

// one skill for each kind: what the tab card offers (a draft button it already has, or an ask the page runs)
export const SUGGESTIONS = {
  text: { kind: 'mostly text', skill: 'summary', intent: 'summary', line: 'draft for me: summary' },
  image: { kind: 'mostly pictures', skill: 'appraise', ask: 'what is this worth', line: 'what is this worth (a photo of it)' },
  table: { kind: 'mostly a table', skill: 'list', ask: 'make a list', line: 'make a list to check off' },
};

/** the dominant kind -> { kind, skill, line, intent | ask } or null */
export const suggestFor = (content) => (Object.prototype.hasOwnProperty.call(SUGGESTIONS, content) ? { ...SUGGESTIONS[content] } : null);

/** the line under the tab's title (esc: the page's HTML escaper): the kind seen and one thing to try */
export function suggestionHtml(esc, content) {
  const s = suggestFor(content);
  if (!s) return '';
  const link = s.ask ? '<a href="#" data-ask="' + esc(s.ask) + '">' + esc(s.line) + '</a>' : '<a href="#" class="tab-suggest" data-intent="' + esc(s.intent) + '">' + esc(s.line) + '</a>';
  return '<div class="tab-context" style="margin:0 0 8px;color:var(--muted);font-size:12px">' + esc(s.kind) + ' · try ' + link + '</div>';
}
