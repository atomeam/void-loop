// cssmin: a safe CSS minifier for the converter card (skills/util.js, kind 'cssmin'). It removes comments (a /*! note is kept),
// folds white space, drops the space around { } ; , inside ( ) and around a declaration's colon, drops the space around > ~ + between selectors (never
// inside parentheses, so calc(1px + 2px) keeps its spaces), and drops the last ; before a }. Strings and url() are kept exactly.
// It never renames, merges or reorders rules, so the CSS works the same. Pure: no DOM. tools/csv-json-css-min.test.mjs tests it.

const TIGHT = new Set(['{', '}', ';', ',']);

/** CSS text to { css, before, after } (sizes in bytes of UTF-8). Pure. */
export function minifyCss(text) {
  const s = String(text == null ? '' : text);
  let out = '', depth = 0, space = false, decl = false;
  const push = (c) => {
    const last = out[out.length - 1];
    if (space && out && !TIGHT.has(c) && !TIGHT.has(last) && last !== ':' && last !== '(' && c !== ')' && !(c === ':' && decl) && !(depth === 0 && /[>~+]/.test(c + last))) out += ' ';
    space = false; out += c;
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2), stop = end < 0 ? s.length : end + 2;
      if (s[i + 2] === '!') { push(s.slice(i, stop)); }
      else space = true;
      i = stop - 1; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < s.length && s[j] !== c && s[j] !== '\n') j += s[j] === '\\' ? 2 : 1;
      push(s.slice(i, j + 1)); i = j; continue;
    }
    if (/url\(/i.test(s.slice(i, i + 4)) && !/[\w-]/.test(s[i - 1] || '')) {
      const end = s.indexOf(')', i), stop = end < 0 ? s.length : end + 1;
      const inner = s.slice(i + 4, stop - 1).trim();
      push(s.slice(i, i + 3) + '(' + inner + ')'); i = stop - 1; continue;
    }
    if (/\s/.test(c)) { space = true; continue; }
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    if (c === '}' && out.endsWith(';')) out = out.slice(0, -1);
    // a colon in a declaration ("color : red") loses the space before it; one in a selector ("a :hover") keeps it
    if (c === ':') { const rest = s.slice(i, i + 4000).search(/[;{}]/); decl = rest >= 0 && s[i + rest] !== '{'; }
    push(c);
  }
  const css = out.trim();
  const bytes = (t) => new TextEncoder().encode(t).length;
  return { css, before: bytes(s), after: bytes(css) };
}
