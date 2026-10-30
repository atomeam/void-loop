// Text tools (owner, 2026-10-18, "tools pack 9": a pasted list of simple text and editing things). ONE table of transforms, TOOLS, below:
// a new transform is one line there (id, card title, the ways to ask for it, the function). Everything is pure and device-local:
// the text never leaves the page. skills/text-tools.js turns an ask into a result card with a copy button.
// An ask is "<what to do>: <the text>" ("sort these lines: pear ⏎ apple ⏎ fig"); the page's one-line box keeps a paste's line breaks
// as " ⏎ ", so those are line breaks here too. A few distinctive tools also take the text straight after the verb ("slugify Hello World").

const MAX = 50000, MAXLINES = 600;
/** HTML-escape a value before it goes into markup. Pure. */
export const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lines = (s) => s.split('\n');
const nonblank = (l) => l.trim() !== '';
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : /s$/.test(w) ? 'es' : 's');
const cmp = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true }) || (a < b ? -1 : a > b ? 1 : 0);

/** the words of a text (letters and digits, with inner apostrophes and hyphens). Pure. */
export const wordsOf = (s) => String(s).match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
const ABBR = /(?:\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|no)|\be\.g|\bi\.e)\.$/i;
/** the sentences of a text; a full stop after Mr., Dr., e.g. and the like does not end one. Pure. */
export function sentencesOf(s) {
  const parts = (String(s).replace(/\s+/g, ' ').trim().match(/.+?(?:[.!?]+["')\]”’]*(?=\s|$)|$)/g) || []).map((x) => x.trim()).filter(Boolean), out = [];
  for (const p of parts) { if (out.length && ABBR.test(out[out.length - 1])) out[out.length - 1] += ' ' + p; else out.push(p); }
  return out.filter((x) => /[\p{L}\p{N}]/u.test(x));
}
/** paragraphs: blocks split by blank lines. Pure. */
export const paragraphsOf = (s) => String(s).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

const STOP = new Set('a an the and or but if of to in on at by for with from as is are was were be been it its this that these those i you he she we they me my your our their not no so do does did have has had will would can could should than then there here which who what when where how all any some into out up about over also just very more most such'.split(' '));
/** [[word, count], …], most often first, then A to Z; `skipStop` leaves the common little words out. Pure. */
export function frequency(s, skipStop = false) {
  const m = new Map();
  for (const w of wordsOf(s.toLowerCase())) if (!(skipStop && STOP.has(w))) m.set(w, (m.get(w) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]));
}
const letters = (s) => Array.from(String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()).filter((c) => /\p{L}|\p{N}/u.test(c)).sort().join('');

/** word wrap each line at `n` columns; a word longer than that stays whole on its own line. Pure. */
export function wrap(s, n = 80) {
  n = Math.max(10, Math.min(500, n | 0 || 80));
  return lines(s).map((line) => {
    if (line.length <= n) return line;
    const ind = line.match(/^\s*/)[0], out = []; let cur = '';
    for (const w of line.trim().split(/\s+/)) { if (!cur) cur = w; else if ((ind + cur + ' ' + w).length <= n) cur += ' ' + w; else { out.push(ind + cur); cur = w; } }
    out.push(ind + cur);
    return out.join('\n');
  }).join('\n');
}
const unwrap = (s) => s.split(/\n\s*\n/).map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean).join(' ')).join('\n\n');

/** the lines of two boxes side by side: "- only in the first", "+ only in the second", "  in both". Pure. */
export function lineDiff(a, b) {
  const x = lines(a), y = lines(b), n = x.length, m = y.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) { if (x[i] === y[j]) { out.push('  ' + x[i]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push('- ' + x[i++]); else out.push('+ ' + y[j++]); }
  while (i < n) out.push('- ' + x[i++]);
  while (j < m) out.push('+ ' + y[j++]);
  return out;
}
/** two boxes split on a line of --- or === (or |||); null when there is only one. Pure. */
export function twoBoxes(s) {
  const p = String(s).split(/\n[ \t]*(?:-{3,}|={3,}|\|\|\|)[ \t]*\n|[ \t]+\|\|\|[ \t]+/);
  return p.length >= 2 ? [p[0], p.slice(1).join('\n')] : null;
}
const NEED2 = { text: '', note: 'Put the two boxes apart with a line of --- (three dashes) between them.' };

const shiftLetters = (s, k) => s.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - b + k) % 26 + 26) % 26 + b); });
const mapLines = (s, f) => lines(s).map(f).join('\n');
const wrapEach = (s, a, b) => mapLines(s, (l) => (l.trim() ? a + l + b : l));
const COMMENT = { python: '# ', py: '# ', ruby: '# ', shell: '# ', bash: '# ', sh: '# ', yaml: '# ', yml: '# ', toml: '# ', perl: '# ', r: '# ', sql: '-- ', lua: '-- ', haskell: '-- ', ada: '-- ', vim: '" ', tex: '% ', latex: '% ', matlab: '% ', lisp: '; ', clojure: '; ', scheme: '; ', asm: '; ', ini: '; ', bat: 'REM ', basic: "' ", vb: "' " };
const BLOCK = { html: ['<!-- ', ' -->'], xml: ['<!-- ', ' -->'], css: ['/* ', ' */'], markdown: ['<!-- ', ' -->'], md: ['<!-- ', ' -->'] };
const ADJ = 'amber brave bright calm clever cosmic crisp curious daring eager elegant fierce gentle golden graceful hidden humble jolly keen lively lucky mellow mighty misty nimble noble patient playful polished proud quiet radiant rustic silent silver sleepy smooth snowy solid sparkling steady stormy sunny swift tender tidy velvet vivid warm whimsical wise witty zesty'.split(' ');
const FIRST = 'Alex Avery Blake Casey Dana Drew Eden Emery Finley Harper Jamie Jordan Kai Logan Morgan Noor Parker Quinn Reese Riley Robin Rowan Sam Sasha Skyler Taylor'.split(' ');
const LAST = 'Archer Bell Brooks Carter Dalton Ellis Fisher Grant Hayes Ingram Jensen Keller Lane Marsh Nolan Ortiz Palmer Quincy Reyes Sutton Tanner Vance Walsh Wells Young Zhang'.split(' ');
const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];
const pad2 = (n) => String(n).padStart(2, '0');
const stamp = (kind, now) => kind === 'iso' ? now.toISOString() : kind === 'time' ? pad2(now.getHours()) + ':' + pad2(now.getMinutes()) : now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());

// ---- markup in and out (copy as Markdown / HTML / plain) ----
const inline = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  .replace(/~~([^~]+)~~/g, '<s>$1</s>').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
/** Markdown (or plain text) to HTML: headings, bullets, paragraphs, bold, italic, code, strike and http(s) links; everything else is escaped. Pure. */
export function toHtml(s) {
  return paragraphsOf(s).map((p) => {
    const ls = lines(p);
    if (ls.every((l) => /^\s*[-*•]\s+/.test(l))) return '<ul>' + ls.map((l) => '<li>' + inline(l.replace(/^\s*[-*•]\s+/, '')) + '</li>').join('') + '</ul>';
    const h = ls[0].match(/^(#{1,3})\s+(.*)$/);
    if (h && ls.length === 1) return '<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>';
    return '<p>' + ls.map(inline).join('<br>') + '</p>';
  }).join('\n');
}
/** HTML to Markdown: the few tags a paste carries (bold, italic, code, links, breaks, paragraphs, headings, bullets); the rest is dropped. Pure. */
export function toMarkdown(s) {
  const pair = (t, mark) => (m, a, i) => (i = String(a).trim()) ? mark + i + mark : '';
  let r = String(s).replace(/<\s*(?:strong|b)\b[^>]*>([\s\S]*?)<\/\s*(?:strong|b)\s*>/gi, pair('', '**')).replace(/<\s*(?:em|i)\b[^>]*>([\s\S]*?)<\/\s*(?:em|i)\s*>/gi, pair('', '*'))
    .replace(/<\s*code\b[^>]*>([\s\S]*?)<\/\s*code\s*>/gi, pair('', '`')).replace(/<\s*(?:s|del|strike)\b[^>]*>([\s\S]*?)<\/\s*(?:s|del|strike)\s*>/gi, pair('', '~~'))
    .replace(/<\s*a\b[^>]*href\s*=\s*["']?(https?:\/\/[^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/\s*a\s*>/gi, (m, u, t) => '[' + t.trim() + '](' + u + ')')
    .replace(/<\s*h([1-3])\b[^>]*>([\s\S]*?)<\/\s*h\1\s*>/gi, (m, n, t) => '#'.repeat(+n) + ' ' + t.trim() + '\n\n').replace(/<\s*li\b[^>]*>/gi, '\n- ').replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/\s*(?:p|div|ul|ol)\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  return r.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** HTML or Markdown to plain text: no tags, no marks; a link keeps its address in brackets. Pure. */
export function toPlain(s) {
  return toMarkdown(s).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)').replace(/^#{1,6}\s+/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/~~([^~]+)~~/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/==([^=]+)==/g, '$1');
}
const MARK = { yellow: '#fff176', green: '#a5d6a7' };
const markUp = (s, c) => '<mark style="background-color:' + MARK[c] + ';color:#000">' + s + '</mark>';

const SPLIT = { comma: ',', semicolon: ';', pipe: '|', space: ' ', tab: '\t', dash: '-', colon: ':', slash: '/' };
const JOIN = { comma: ', ', space: ' ', semicolon: '; ', pipe: ' | ', dash: ' - ', slash: ' / ', tab: '\t', nothing: '', newline: '\n' };
const BRACKETS = { round: '()', paren: '()', parenthes: '()', square: '[]', curly: '{}', brace: '{}', angle: '<>' };
const FILL = '(?:\\s+(?:of|in|for|on|from|to|these|those|this|that|the|my|following|text|lines?|words|list|paragraphs?|below|here|it|selection|selected|please))*';
const T = (id, title, heads, fn, o = {}) => ({ id, title, heads: heads.map((h) => new RegExp('^(?:' + h + ')' + FILL + '$')), fn, body: 'text', ...o });
const LOOSE = '(?!(?:is|was|means|mean|explained|works|vs)\\b)';

/**
 * The table. fn(body, arg, ctx) returns a string, or { text, note, preview }. `heads` are the ways to ask (lower case, no punctuation; a named
 * group `arg` is passed to fn); `body: 'none'` takes no text, `'opt'` takes text or none; `loose` also takes "<verb> <text>" with no colon.
 * Order matters: the first row whose head fits wins, so the narrow ones come before the wide ones.
 */
export const TOOLS = [
  T('upper', 'Uppercase', ['(?:convert\\s+to\\s+|change\\s+to\\s+|make\\s+)?(?:upper\\s?case|all\\s+caps|capitals)'], (s) => s.toUpperCase()),
  T('lower', 'Lowercase', ['(?:convert\\s+to\\s+|change\\s+to\\s+|make\\s+)?lower\\s?case'], (s) => s.toLowerCase()),
  T('toggle', 'Toggle case', ['(?:toggle|swap|invert|flip|reverse)\\s+(?:the\\s+)?case'], (s) => Array.from(s, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('')),
  T('trim-trailing', 'Trailing spaces removed', ['(?:remove|strip|delete|clear|trim)\\s+(?:the\\s+)?trailing\\s+(?:white\\s?space|spaces?)', 'trailing\\s+(?:white\\s?space|spaces?)'], (s) => ({ text: s.replace(/[ \t]+$/gm, ''), note: plural((s.match(/[ \t]+$/gm) || []).length, 'line') + ' had trailing space' })),
  T('trim', 'Trimmed', ['(?:trim|strip)(?:\\s+(?:the\\s+)?(?:white\\s?space|spaces))?', 'remove\\s+(?:extra\\s+|leading\\s+)?(?:white\\s?space|spaces)'], (s) => mapLines(s, (l) => l.trim()).trim()),
  T('dedupe', 'Duplicate lines removed', ['(?:de-?dup(?:e|licate)?|remove\\s+(?:the\\s+)?(?:duplicate|repeated)|drop\\s+(?:the\\s+)?duplicate)\\s*(?:lines)?', 'remove\\s+duplicates?'],
    (s) => { const seen = new Set(), out = []; let n = 0; for (const l of lines(s)) { if (seen.has(l)) { n++; continue; } seen.add(l); out.push(l); } return { text: out.join('\n'), note: n ? plural(n, 'duplicate line') + ' removed, first of each kept' : 'no duplicate lines' }; }),
  T('sort-za', 'Sorted Z to A', ['sort(?:\\s+(?:the|these|my|lines|list|words))*\\s+(?:z\\s*(?:-|–|to)\\s*a|descending|in\\s+reverse(?:\\s+alphabetical)?(?:\\s+order)?|backwards)', 'reverse\\s+sort(?:\\s+lines)?'],
    (s) => ({ text: lines(s).filter(nonblank).sort((a, b) => cmp(b, a)).join('\n'), note: 'blank lines left out' })),
  T('sort-az', 'Sorted A to Z', ['sort(?:\\s+(?:the|these|my|lines|list|words))*(?:\\s+(?:a\\s*(?:-|–|to)\\s*z|alphabetically|ascending|in\\s+alphabetical\\s+order))?', 'alphabeti[sz]e'],
    (s) => ({ text: lines(s).filter(nonblank).sort(cmp).join('\n'), note: 'blank lines left out; numbers sort by value' })),
  T('reverse-lines', 'Lines reversed', ['reverse(?:\\s+the)?(?:\\s+(?:order|line\\s+order))?(?:\\s+of)?\\s+lines?', 'reverse\\s+(?:the\\s+)?line\\s+order', 'flip\\s+(?:the\\s+)?lines?'], (s) => lines(s).reverse().join('\n')),
  T('number', 'Lines numbered', ['(?:add\\s+)?number(?:ed)?\\s+(?:the\\s+)?lines?', 'add\\s+line\\s+numbers?', 'line\\s+numbers?'],
    (s) => { let i = 0; return mapLines(s, (l) => (l.trim() ? ++i + '. ' + l : l)); }),
  T('unnumber', 'Line numbers removed', ['(?:un-?number|remove\\s+(?:the\\s+)?(?:line\\s+)?numbers?(?:\\s+from)?)(?:\\s+(?:the\\s+)?lines?)?', 'strip\\s+(?:the\\s+)?(?:line\\s+)?numbers?'], (s) => mapLines(s, (l) => l.replace(/^\s*\d+\s*[.):\]-]\s?/, ''))),
  T('join', 'Lines joined', ['join(?:\\s+(?:the\\s+)?lines?)?(?:\\s+(?:with|by|using)\\s+(?:a\\s+|an\\s+)?(?<arg>comma|space|semicolon|pipe|dash|slash|tab|nothing|newline))?', 'merge\\s+(?:the\\s+)?lines?(?:\\s+(?:with|by)\\s+(?:a\\s+)?(?<arg>comma|space|semicolon|pipe|dash|slash|tab))?', 'put\\s+(?:it\\s+|them\\s+)?on\\s+one\\s+line'],
    (s, arg) => lines(s).map((l) => l.trim()).filter(Boolean).join(JOIN[arg || 'space'])),
  T('split-newline', 'Split on newline', ['split(?:\\s+(?:on|at|by))?\\s+(?:new\\s?lines?|line\\s+breaks?|returns?)'], (s) => ({ text: JSON.stringify(lines(s).filter(Boolean), null, 1), note: plural(lines(s).filter(Boolean).length, 'item') + ' as a list' })),
  T('split', 'Split', ['split(?:\\s+(?:on|at|by))?\\s+(?:a\\s+|the\\s+)?(?<arg>comma|semicolon|pipe|space|tab|dash|colon|slash)s?', 'split\\s+(?:a\\s+|the\\s+)?(?<arg>comma|semicolon|pipe|space|tab|dash|colon|slash)\\s*(?:separated|list)', 'comma\\s+(?<arg>)separated\\s+to\\s+lines?'],
    (s, arg) => s.split(SPLIT[arg || 'comma']).map((l) => l.trim()).filter(Boolean).join('\n')),
  T('wrap', 'Wrapped', ['(?:word\\s+)?wrap(?:\\s+(?:at|to|after))?(?:\\s+(?<arg>\\d{2,3}))?(?:\\s+(?:columns?|characters?|chars|cols))?'], (s, arg) => wrap(s, +arg || 80), { note: 'wrapped at 80 columns unless you say a number ("wrap at 60")' }),
  T('unwrap', 'Paragraphs unwrapped', ['unwrap(?:\\s+(?:the\\s+)?paragraphs?)?', 'un-?wrap\\s+(?:the\\s+)?text', 'remove\\s+(?:hard\\s+)?line\\s+(?:breaks|wraps)', 'join\\s+(?:the\\s+)?paragraph\\s+lines'], unwrap),
  T('double-space', 'Double-spaced', ['double[\\s-]?space(?:d)?', 'add\\s+(?:a\\s+)?blank\\s+line\\s+between\\s+(?:the\\s+)?lines'], (s) => lines(s).join('\n\n')),
  T('no-blank', 'Blank lines removed', ['(?:remove|delete|strip|drop|clear)\\s+(?:all\\s+|the\\s+|empty\\s+)*(?:blank|empty)\\s+lines?', 'squeeze\\s+(?:blank\\s+)?lines?'], (s) => ({ text: lines(s).filter(nonblank).join('\n'), note: plural(lines(s).filter((l) => !nonblank(l)).length, 'blank line') + ' removed' })),
  T('unindent', 'Unindented', ['(?:un-?indent|outdent|dedent)(?:\\s+(?:by\\s+)?(?<arg>\\d{1,2}))?'], (s, arg) => { const n = Math.min(16, +arg || 4); return mapLines(s, (l) => l.replace(new RegExp('^(?:\\t| {1,' + n + '})'), '')); }),
  T('indent', 'Indented', ['indent(?:\\s+(?:by|with)\\s+(?:(?<arg>\\d{1,2})(?:\\s+spaces?)?|(?<arg2>a\\s+tab|tab)))?'], (s, arg) => { const pre = arg === 'tab' ? '\t' : ' '.repeat(Math.min(16, +arg || 4)); return mapLines(s, (l) => (l.trim() ? pre + l : l)); }),
  T('blockquote', 'Block quote', ['block\\s?quote', 'quote\\s+(?:as\\s+)?(?:a\\s+)?block', 'make\\s+(?:it\\s+)?a\\s+block\\s?quote', 'quote\\s+each\\s+line'], (s) => mapLines(s, (l) => '> ' + l)),
  T('unquote', 'Unquoted', ['un-?quote', 'remove\\s+(?:the\\s+)?quot(?:es|ation\\s+marks)', 'strip\\s+(?:the\\s+)?quot(?:es|ation\\s+marks)'],
    (s) => { let t = mapLines(s, (l) => l.replace(/^\s*>\s?/, '')).trim(); const pairs = ['""', "''", '“”', '‘’', '«»', '``']; for (const p of pairs) if (t.length > 1 && t[0] === p[0] && t[t.length - 1] === p[1]) { t = t.slice(1, -1); break; } return t; }),
  T('quote', 'Quoted', ['quote(?:\\s+(?:it|this|the\\s+text))?', 'put\\s+(?:it\\s+)?in\\s+quot(?:es|ation\\s+marks)', 'wrap\\s+in\\s+quot(?:es|ation\\s+marks)'], (s) => '"' + s.trim() + '"'),
  T('bracket', 'Bracketed', ['(?:wrap\\s+in\\s+|put\\s+in\\s+|add\\s+)?(?<arg>round\\s+|square\\s+|curly\\s+|angle\\s+)?(?:brackets?|parenthes[ie]s|braces)', 'bracket', 'parenthesi[sz]e'],
    (s, arg, ctx) => { const k = (arg || '').trim(), pair = BRACKETS[k] || (ctx && ctx.head && /parenthes/.test(ctx.head) ? '()' : '[]'); return pair[0] + s.trim() + pair[1]; }),
  T('md-bold', 'Bold', ['(?:markdown\\s+|make\\s+(?:it\\s+)?|turn\\s+(?:it\\s+)?(?:in(?:to)?\\s+)?)?bold(?:\\s+text)?'], (s) => wrapEach(s, '**', '**')),
  T('md-italic', 'Italic', ['(?:markdown\\s+|make\\s+(?:it\\s+)?|turn\\s+(?:it\\s+)?(?:in(?:to)?\\s+)?)?italics?(?:\\s+text)?'], (s) => wrapEach(s, '*', '*')),
  T('md-code', 'Code', ['(?:markdown|inline|make\\s+(?:it\\s+)?|turn\\s+(?:it\\s+)?(?:in(?:to)?\\s+)?|as)\\s*code(?:\\s+(?:format|formatting|font))?', 'code\\s+block', 'code\\s+format'], (s) => (lines(s).length > 1 ? '```\n' + s.trim() + '\n```' : '`' + s.trim() + '`')),
  T('md-strike', 'Strikethrough', ['(?:markdown\\s+|make\\s+(?:it\\s+)?|turn\\s+(?:it\\s+)?(?:in(?:to)?\\s+)?)?strike[\\s-]?(?:through|out)?'], (s) => wrapEach(s, '~~', '~~')),
  T('date', 'Date stamp', ['(?:insert\\s+)?(?:the\\s+|a\\s+|today\\s*s\\s+)?(?:date\\s+stamp|datestamp|date\\s+now|today\\s*s\\s+date)', 'insert\\s+(?:the\\s+|today\\s*s\\s+)?date'], (s, a, c) => stamp('date', c.now) + (s ? ' ' + s : ''), { body: 'opt' }),
  T('iso', 'ISO timestamp', ['(?:insert\\s+)?(?:an?\\s+|the\\s+)?iso\\s+(?:8601\\s+)?(?:time\\s?stamp|stamp|date(?:\\s*time)?)', 'insert\\s+(?:an?\\s+|the\\s+)?iso\\s+(?:time\\s?stamp|date)'], (s, a, c) => stamp('iso', c.now) + (s ? ' ' + s : ''), { body: 'opt', note: 'UTC, ISO 8601' }),
  T('time', 'Time stamp', ['(?:insert\\s+)?(?:the\\s+|a\\s+)?(?:time\\s+stamp|timestamp)', 'insert\\s+(?:the\\s+)?(?:current\\s+)?time'], (s, a, c) => stamp('time', c.now) + (s ? ' ' + s : ''), { body: 'opt', note: 'your local time, 24 hour' }),
  T('adjective', 'Random adjective', ['(?:give\\s+me\\s+)?(?:a\\s+|an\\s+|(?<arg>\\d{1,2})\\s+)?random\\s+adjectives?'], (s, arg, c) => Array.from({ length: Math.min(20, +arg || 1) }, () => pick(ADJ, c.rng)).join('\n'), { body: 'none' }),
  T('name', 'Placeholder name', ['(?:give\\s+me\\s+)?(?:a\\s+|an\\s+|(?<arg>\\d{1,2})\\s+)?(?:placeholder|dummy|sample|fake)\\s+names?'], (s, arg, c) => Array.from({ length: Math.min(20, +arg || 1) }, () => pick(FIRST, c.rng) + ' ' + pick(LAST, c.rng)).join('\n'), { body: 'none', note: 'made up, for mock-ups' }),
  T('stats', 'Text statistics', ['(?:text\\s+)?(?:stats|statistics)', 'text\\s+analysis'], (s) => {
    const w = wordsOf(s), sn = sentencesOf(s);
    return { text: ['Characters: ' + Array.from(s).length, 'Characters without spaces: ' + Array.from(s.replace(/\s/g, '')).length, 'Words: ' + w.length, 'Sentences: ' + sn.length, 'Paragraphs: ' + paragraphsOf(s).length, 'Lines: ' + lines(s).length, 'Average sentence: ' + (sn.length ? (w.length / sn.length).toFixed(1) : '0') + ' words'].join('\n') };
  }),
  T('paragraphs', 'Paragraph count', ['(?:count|how\\s+many)\\s+paragraphs?', 'paragraph\\s+count'], (s) => plural(paragraphsOf(s).length, 'paragraph') + ' (blocks split by a blank line)'),
  T('sentences', 'Sentence count', ['(?:count|how\\s+many)\\s+sentences?', 'sentence\\s+count'], (s) => plural(sentencesOf(s).length, 'sentence') + ' (a stop after Mr., Dr. or e.g. does not end one)'),
  T('avg-sentence', 'Average sentence length', ['(?:average|mean|avg)\\s+sentence\\s+length', 'sentence\\s+length'], (s) => { const w = wordsOf(s).length, n = sentencesOf(s).length; return n ? (w / n).toFixed(1) + ' words per sentence (' + w + ' words in ' + plural(n, 'sentence') + ')' : 'no sentences found'; }),
  T('chars', 'Character count', ['count\\s+(?:the\\s+)?(?:characters|chars|letters)', '(?:characters|chars|letters|character)\\s+count'], (s) => plural(Array.from(s).length, 'character') + ' (' + Array.from(s.replace(/\s/g, '')).length + ' without spaces)'),
  T('longest', 'Longest word', ['(?:the\\s+)?longest\\s+word', 'find\\s+(?:the\\s+)?longest\\s+word'], (s) => { const w = wordsOf(s).sort((a, b) => b.length - a.length)[0]; return w ? w + ' (' + plural(Array.from(w).length, 'letter') + ')' : 'no words found'; }),
  T('repeated', 'Repeated words', ['(?:find\\s+|show\\s+)?(?:the\\s+)?(?:repeated|doubled|duplicate)\\s+words?', 'repeated\\s+word\\s+(?:check|finder)'], (s) => {
    const w = wordsOf(s), doubled = []; for (let i = 1; i < w.length; i++) if (w[i].toLowerCase() === w[i - 1].toLowerCase()) doubled.push('"' + w[i - 1] + ' ' + w[i] + '" at word ' + i);
    const again = frequency(s, true).filter(([, n]) => n > 1).slice(0, 10).map(([x, n]) => x + ' ×' + n);
    return (doubled.length ? 'Twice in a row: ' + doubled.join(', ') : 'No word doubled in a row.') + '\n' + (again.length ? 'Used again and again: ' + again.join(', ') : 'No word used more than once (little words left out).');
  }),
  T('tabs-to-spaces', 'Tabs to spaces', ['tabs?\\s+to\\s+spaces?(?:\\s+(?<arg>\\d))?', 'expand\\s+tabs?(?:\\s+(?<arg>\\d))?', 'replace\\s+tabs?\\s+with\\s+(?<arg>\\d)\\s+spaces?'], (s, arg) => s.replace(/\t/g, ' '.repeat(Math.min(8, +arg || 4)))),
  T('spaces-to-tabs', 'Spaces to tabs', ['spaces?\\s+to\\s+tabs?(?:\\s+(?<arg>\\d))?', 'indent\\s+with\\s+tabs', 'replace\\s+(?<arg>\\d)\\s+spaces?\\s+with\\s+(?:a\\s+)?tab'],
    (s, arg) => { const n = Math.max(1, Math.min(8, +arg || 4)); return mapLines(s, (l) => l.replace(/^ +/, (m) => '\t'.repeat(Math.floor(m.length / n)) + ' '.repeat(m.length % n))); }),
  T('smart-quotes', 'Smart quotes on', ['(?:turn\\s+on\\s+|use\\s+|make\\s+|add\\s+|convert\\s+to\\s+)?(?:smart|curly|typographic)\\s+quotes(?:\\s+on)?'],
    (s) => s.replace(/(^|[\s([{—–-])"/g, '$1“').replace(/"/g, '”').replace(/(^|[\s([{—–-])'/g, '$1‘').replace(/'/g, '’')),
  T('straight-quotes', 'Smart quotes off', ['(?:turn\\s+off\\s+|remove\\s+|undo\\s+|convert\\s+to\\s+|use\\s+)?(?:smart|curly|typographic)\\s+quotes\\s+off', '(?:turn\\s+off|remove|undo|straighten)\\s+(?:the\\s+)?(?:smart|curly|typographic)\\s+quotes', 'straight(?:en)?\\s+quotes', 'plain\\s+quotes'],
    (s) => s.replace(/[“”„‟]/g, '"').replace(/[‘’‚‛]/g, "'")),
  T('en-dash', 'En dash', ['(?:insert\\s+)?(?:an?\\s+)?en[\\s-]?dash'], (s) => (s ? s.replace(/(\d)-(?=\d)/g, '$1–').replace(/ - /g, ' – ') : '–'), { body: 'opt', note: 'U+2013, the dash for ranges (1–5)' }),
  T('em-dash', 'Em dash', ['(?:insert\\s+)?(?:an?\\s+)?em[\\s-]?dash'], (s) => (s ? s.replace(/ ?-- ?/g, '—').replace(/ — /g, '—') : '—'), { body: 'opt', note: 'U+2014; in a text, -- becomes —' }),
  T('ellipsis', 'Ellipsis', ['(?:insert\\s+)?(?:an?\\s+)?ellipsis(?:\\s+character)?'], (s) => (s ? s.replace(/\.{3,}/g, '…') : '…'), { body: 'opt', note: 'U+2026; in a text, ... becomes …' }),
  T('nbsp', 'Non-breaking space', ['(?:insert\\s+)?(?:an?\\s+)?(?:nbsp|non[\\s-]?breaking\\s+space|no[\\s-]?break\\s+space)'], (s) => (s ? s.replace(/ /g, ' ') : ' '), { body: 'opt', note: 'U+00A0; in a text, every space becomes one' }),
  T('html', 'As HTML', ['(?:copy\\s+(?:it\\s+)?as|convert\\s+to|turn\\s+into|make\\s+it)\\s+html', 'html'], toHtml),
  T('markdown', 'As Markdown', ['(?:copy\\s+(?:it\\s+)?as|convert\\s+to|turn\\s+into|make\\s+it)\\s+markdown', 'html\\s+to\\s+markdown'], toMarkdown),
  T('plain', 'As plain text', ['(?:copy\\s+(?:it\\s+)?as|paste\\s+as|convert\\s+to|turn\\s+into|make\\s+it)\\s+plain(?:\\s+text)?', 'paste\\s+plain(?:\\s+text)?', 'clear\\s+(?:the\\s+)?formatting', 'strip\\s+(?:the\\s+)?(?:formatting|markdown|html|tags)', 'remove\\s+(?:the\\s+)?(?:formatting|markdown|html\\s+tags)'], toPlain),
  T('unhighlight', 'Highlight removed', ['(?:remove|clear|undo|strip)\\s+(?:the\\s+)?highlight(?:ing|s)?', 'unhighlight'], (s) => s.replace(/<\/?mark\b[^>]*>/gi, '').replace(/==([^=]+)==/g, '$1')),
  T('highlight-green', 'Highlighted green', ['highlight(?:\\s+in)?\\s+green'], (s) => markUp(s, 'green'), { preview: (s) => markUp(esc(s).replace(/\n/g, '<br>'), 'green') }),
  T('highlight', 'Highlighted yellow', ['highlight(?:\\s+in)?(?:\\s+yellow)?'], (s) => markUp(s, 'yellow'), { preview: (s) => markUp(esc(s).replace(/\n/g, '<br>'), 'yellow') }),
  T('comment', 'Commented out', ['comment(?:\\s+out)?(?:\\s+(?:as|in|for|using)\\s+(?<arg>[a-z+#]+))?'], (s, arg) => {
    const k = (arg || '').toLowerCase(), b = BLOCK[k], p = COMMENT[k] || '// ';
    return b ? mapLines(s, (l) => (l.trim() ? b[0] + l + b[1] : l)) : mapLines(s, (l) => (l.trim() ? p + l : l));
  }, { note: '// unless you name a language ("comment out as python")' }),
  T('todo', 'TODO prefix', ['(?:add|put|prefix|mark)\\s+(?:a\\s+|with\\s+)?todo(?:\\s+prefix)?', 'todo\\s+prefix'], (s) => wrapEach(s, 'TODO: ', '')),
  T('fixme', 'FIXME prefix', ['(?:add|put|prefix|mark)\\s+(?:a\\s+|with\\s+)?fixme(?:\\s+prefix)?', 'fixme\\s+prefix'], (s) => wrapEach(s, 'FIXME: ', '')),
  T('version', 'Version suffix', ['(?:add|append|bump)\\s+(?:a\\s+)?(?:version|v)\\s*(?:suffix|number)?', 'version\\s+suffix'],
    (s) => mapLines(s, (l) => { if (!l.trim()) return l; const m = l.match(/^(.*?)(?:-v(\d+))?(\.[A-Za-z0-9]{1,5})?$/); return m[1] + '-v' + (m[2] ? +m[2] + 1 : 2) + (m[3] || ''); }), { note: 'report.docx becomes report-v2.docx; -v2 becomes -v3' }),
  T('slug', 'Slug', ['slugi(?:fy|[sz]e)', 'make\\s+(?:it\\s+|a\\s+)?(?:url\\s+)?slug', '(?:url\\s+)?slug(?:\\s+of)?'],
    (s) => mapLines(s, (l) => l.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')), { loose: new RegExp('^slugi(?:fy|[sz]e)\\s+' + LOOSE + '(?<body>.+)$', 'i') }),
  T('title', 'Title from the first line', ['(?:a\\s+)?title\\s+from\\s+(?:the\\s+)?first\\s+line', 'first\\s+line\\s+(?:as\\s+(?:a\\s+)?)?title', 'make\\s+(?:a\\s+)?title'],
    (s) => { const l = lines(s).map((x) => x.trim()).find(Boolean) || ''; let t = l.replace(/^(?:#{1,6}\s+|[-*•>]\s+|\d+[.)]\s+)/, '').replace(/[\s.,;:!?-]+$/, ''); return t; }),
  T('urls', 'Links found', ['(?:extract|find|get|pull\\s+out|list)\\s+(?:all\\s+|the\\s+)?(?:urls?|links?|web\\s+addresses)'],
    (s) => { const r = (s.match(/\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi) || []).map((u) => u.replace(/[.,;:!?]+$/, '')); return { text: r.join('\n'), note: plural(r.length, 'link') + ' found' }; }),
  T('emails', 'Email addresses found', ['(?:extract|find|get|pull\\s+out|list)\\s+(?:all\\s+|the\\s+)?(?:e-?mails?(?:\\s+addresses)?)'],
    (s) => { const r = s.match(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu) || []; return { text: r.join('\n'), note: plural(r.length, 'address') + ' found' }; }),
  T('numbers', 'Numbers found', ['(?:extract|find|get|pull\\s+out|list)\\s+(?:all\\s+|the\\s+)?numbers'],
    (s) => { const r = s.match(/-?\d+(?:[.,]\d+)*/g) || []; return { text: r.join('\n'), note: plural(r.length, 'number') + ' found' }; }),
  T('mask-phones', 'Phone numbers masked', ['(?:mask|hide|redact|blur|censor)\\s+(?:all\\s+|the\\s+)?(?:phone\\s+)?(?:phones?|phone\\s+numbers?|telephone\\s+numbers?)'], (s) => {
    let n = 0; const text = s.replace(/\+?\d[\d\s().-]{6,}\d/g, (m) => { const d = m.replace(/\D/g, '').length; if (d < 7 || d > 15) return m; n++; let k = 0; return Array.from(m).reverse().map((c) => (/\d/.test(c) ? (++k <= 4 ? c : '*') : c)).reverse().join(''); });
    return { text, note: plural(n, 'number') + ' masked, the last 4 digits kept' };
  }),
  T('mask-emails', 'Email addresses masked', ['(?:mask|hide|redact|blur|censor)\\s+(?:all\\s+|the\\s+)?e-?mails?(?:\\s+addresses)?'], (s) => {
    let n = 0; const text = s.replace(/([\p{L}\p{N}._%+-]+)@([\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,})/gu, (m, a, d) => { n++; return Array.from(a)[0] + '***@' + d; });
    return { text, note: plural(n, 'address') + ' masked, the first letter and the domain kept' };
  }),
  T('rot13', 'ROT13', ['rot[\\s-]?13(?:\\s+(?:encode|decode|cipher))?', '(?:encode|decode|encrypt|decrypt)\\s+(?:in\\s+|with\\s+|using\\s+)?rot[\\s-]?13'], (s) => shiftLetters(s, 13), { loose: new RegExp('^rot[\\s-]?13\\s+' + LOOSE + '(?<body>.+)$', 'i'), note: 'ROT13 is its own undo: run it again to read the text back' }),
  T('caesar', 'Caesar cipher', ['caesar(?:\\s+(?:cipher|shift))?(?:\\s+(?:by\\s+)?(?<arg>-?\\d{1,3}))?', 'shift\\s+(?:the\\s+)?letters?\\s+by\\s+(?<arg>-?\\d{1,3})'], (s, arg) => shiftLetters(s, arg === undefined || arg === '' ? 3 : +arg), { note: 'shifted by 3 unless you say a number ("caesar shift 5"); a negative number undoes it' }),
  T('keep-letters', 'Only letters', ['(?:keep\\s+only|only|just|filter\\s+to|filter\\s+out\\s+all\\s+but)\\s+(?:the\\s+)?(?:letters|alphabet(?:ic)?(?:\\s+characters)?)', 'remove\\s+(?:all\\s+)?(?:digits|numbers|punctuation)', 'letters\\s+only'], (s) => s.replace(/[^\p{L}\s]/gu, '')),
  T('keep-digits', 'Only digits', ['(?:keep\\s+only|only|just|filter\\s+to|filter\\s+out\\s+all\\s+but)\\s+(?:the\\s+)?(?:digits|numbers)', 'remove\\s+(?:all\\s+)?(?:letters|alphabet(?:ic)?(?:\\s+characters)?)', 'digits\\s+only'], (s) => s.replace(/[^\d\n]/g, '')),
  T('anagram', 'Anagram check', ['(?:an\\s+)?anagram(?:\\s+(?:check|checker|test))?', '(?:are|is)\\s+(?:these|they)\\s+anagrams?', 'check\\s+(?:for\\s+)?anagrams?'], (s) => {
    let p = s.split(/\s*(?:\n|\||,)\s*/).map((x) => x.trim()).filter(Boolean);
    if (p.length < 2) p = s.split(/\s+(?:vs\.?|&|and)\s+/i).map((x) => x.trim()).filter(Boolean);
    if (p.length !== 2) return { text: '', note: 'Give me two words or phrases: "anagram: listen, silent".' };
    const [a, b] = [letters(p[0]), letters(p[1])];
    if (a === b && a) return '“' + p[0] + '” and “' + p[1] + '” are anagrams: the same ' + a.length + ' letters.';
    const left = [...a], miss = []; for (const c of b) { const i = left.indexOf(c); if (i < 0) miss.push(c); else left.splice(i, 1); }
    return 'Not anagrams. “' + p[0] + '” has ' + a.length + ' letters, “' + p[1] + '” has ' + b.length + (left.length ? '; only in the first: ' + left.join('') : '') + (miss.length ? '; only in the second: ' + miss.join('') : '') + '.';
  }, { forms: [/^(?:are|is)\s+(.+?)\s+(?:and|&|vs\.?|with)\s+(.+?)\s+(?:an\s+)?anagrams?(?:\s+of\s+each\s+other)?$/i, /^is\s+(.+?)\s+an\s+anagram\s+of\s+(.+)$/i] }),
  T('diff', 'Difference between two boxes', ['diff', 'diff(?:erence)?\\s+between(?:\\s+(?:the\\s+)?(?:two|2)\\s+(?:boxes|texts|lists))?', '(?:compare|diff)\\s+(?:the\\s+)?(?:two|2)\\s+(?:boxes|texts|lists|versions)', 'what\\s+changed\\s+between'], (s) => {
    const b = twoBoxes(s); if (!b) return NEED2;
    if (lines(b[0]).length > MAXLINES || lines(b[1]).length > MAXLINES) return { text: '', note: 'Up to ' + MAXLINES + ' lines in each box.' };
    const d = lineDiff(b[0], b[1]), a = d.filter((x) => x[0] === '+').length, r = d.filter((x) => x[0] === '-').length;
    return { text: d.join('\n'), note: r + ' removed (-), ' + a + ' added (+), ' + d.filter((x) => x[0] === ' ').length + ' the same' };
  }),
  T('common', 'Lines in both boxes', ['(?:common|shared|matching|same|overlapping)\\s+lines?(?:\\s+(?:in|between)\\s+(?:both|the\\s+two)\\s+(?:boxes|texts|lists))?', 'lines\\s+in\\s+both(?:\\s+boxes)?', 'intersection'], (s) => {
    const b = twoBoxes(s); if (!b) return NEED2;
    const y = new Set(lines(b[1]).filter(nonblank)), seen = new Set(), out = []; for (const l of lines(b[0]).filter(nonblank)) if (y.has(l) && !seen.has(l)) { seen.add(l); out.push(l); }
    return { text: out.join('\n'), note: plural(out.length, 'line') + ' in both, in the first box\'s order' };
  }),
  T('unique', 'Unique lines', ['unique\\s+lines?(?:\\s+only)?', 'lines\\s+(?:that\\s+)?(?:appear|occur)\\s+once', 'only\\s+once', 'lines\\s+only\\s+in\\s+one'], (s) => {
    const b = twoBoxes(s);
    if (b) { const x = new Set(lines(b[0]).filter(nonblank)), y = new Set(lines(b[1]).filter(nonblank)); const out = [...x].filter((l) => !y.has(l)).map((l) => '1: ' + l).concat([...y].filter((l) => !x.has(l)).map((l) => '2: ' + l)); return { text: out.join('\n'), note: plural(out.length, 'line') + ' in only one of the two boxes (1 or 2 says which)' }; }
    const c = new Map(); for (const l of lines(s).filter(nonblank)) c.set(l, (c.get(l) || 0) + 1);
    const out = [...c].filter(([, n]) => n === 1).map(([l]) => l); return { text: out.join('\n'), note: plural(out.length, 'line') + ' with no repeat' };
  }),
  T('top-words', 'Top 10 words', ['(?:the\\s+)?top\\s+(?:10|ten)\\s+(?:most\\s+(?:used|common|frequent)\\s+)?words', '(?:most\\s+(?:used|common|frequent))\\s+words'],
    (s) => { const f = frequency(s, true).slice(0, 10); return { text: f.map(([w, n]) => n + '  ' + w).join('\n'), note: 'little words like "the" and "of" left out; "word frequency" counts every word' }; }),
  T('frequency', 'Word frequency', ['word\\s+(?:frequency|frequencies|counts?)', '(?:count|how\\s+often)\\s+(?:each\\s+)?words?(?:\\s+(?:appears?|occurs?|used))?', 'frequency\\s+of\\s+words', 'frequency'],
    (s) => { const f = frequency(s); return { text: f.slice(0, 200).map(([w, n]) => n + '  ' + w).join('\n'), note: plural(f.length, 'different word') + ', most used first' + (f.length > 200 ? ' (first 200 shown)' : '') }; }),
];

const BYID = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
const clean = (s) => String(s || '').replace(/\r\n?/g, '\n').replace(/[ \t]*⏎[ \t]*/g, '\n');
const headOf = (h) => h.toLowerCase().replace(/[’']s\b/g, 's').replace(/[?!.,;]+$/g, '').replace(/^(?:please|pls|hey|ok|okay|can\s+you|could\s+you|would\s+you|will\s+you)\s+/, '').replace(/\s+please$/, '').replace(/\s+/g, ' ').trim();

/** { id, title, arg, body, head } when the ask is one of the text tools, else null. Pure. */
export function textToolOf(text) {
  const s = clean(text).slice(0, MAX + 200);
  if (!s.trim()) return null;
  const nl = s.indexOf('\n'), co = s.indexOf(':'), cuts = [];
  if (co > 0 && co <= 80 && (nl < 0 || co < nl)) cuts.push([s.slice(0, co), s.slice(co + 1).replace(/^[ \t]?\n?/, '')]);
  if (nl > 0) cuts.push([s.slice(0, nl), s.slice(nl + 1)]);
  cuts.push([s, '']);
  for (const [h, b] of cuts) {
    const head = headOf(h);
    if (!head || head.length > 90) continue;
    for (const t of TOOLS) {
      for (const f of t.forms || []) { const m = f.exec(head); if (m) return { id: t.id, title: t.title, arg: '', body: m.slice(1).join('\n'), head }; }
      for (const re of t.heads) {
        const m = re.exec(head);
        if (!m) continue;
        const arg = m.groups ? (m.groups.arg || m.groups.arg2 || '') : '';
        const body = b.length > MAX ? b.slice(0, MAX) : b;
        if (t.body === 'none') { if (body.trim()) continue; return { id: t.id, title: t.title, arg: arg.toLowerCase().replace(/^a\s+/, ''), body: '', head }; }
        if (t.body === 'opt' || body.trim()) return { id: t.id, title: t.title, arg: arg.toLowerCase().replace(/^a\s+/, ''), body: body.trim() ? body : '', head };
      }
    }
  }
  for (const t of TOOLS) if (t.loose) { const m = t.loose.exec(s.trim()); if (m && m.groups.body.trim()) return { id: t.id, title: t.title, arg: '', body: m.groups.body, head: t.id }; }
  return null;
}

/** { title, text, note, preview } for a parsed ask. ctx: { now: Date, rng: () => number }. Pure given ctx. */
export function applyTool(parsed, ctx = {}) {
  const t = BYID[parsed.id];
  if (!t) return null;
  const c = { now: new Date(), rng: Math.random, head: parsed.head, ...ctx };
  let r = t.fn(parsed.body, parsed.arg, c);
  if (typeof r === 'string') r = { text: r };
  return { id: t.id, title: t.title, text: r.text, note: r.note || t.note || '', preview: t.preview && parsed.body ? t.preview(parsed.body) : '' };
}

/** the whole thing for a pasted ask; null when it is not a text tool. Pure given ctx. */
export const runTextTool = (text, ctx) => { const p = textToolOf(text); return p ? applyTool(p, ctx) : null; };
