// The scripts written inside a page's own <script> tags. `node --check` reads only .js and .mjs files, so a syntax error in a page's
// inline module reached main unseen and broke /news/ (#1741, fixed in #1750): the files check parses these too, from here.
/** each inline script of an html text that a browser runs as JavaScript, as { n, module, code }. Pure.
 *  n counts from 1 in page order; code is padded with blank lines so an error's line number is the page's own line.
 *  A script with src, or of another type (json, importmap, ld+json, a template), is left out. */
export function inlineScripts(html) {
  const out = [];
  let n = 0;
  for (const m of String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    n++;
    const attrs = m[1];
    if (/(?:^|\s)src\s*=/i.test(attrs)) continue;
    const type = ((attrs.match(/(?:^|\s)type\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '').toLowerCase();
    const module = type === 'module';
    if (!module && type && !/^(?:text|application)\/(?:x-)?(?:java|ecma)script$/.test(type)) continue;
    const start = m.index + m[0].indexOf('>') + 1; // where the script's own text starts
    out.push({ n, module, code: '\n'.repeat((String(html).slice(0, start).match(/\n/g) || []).length) + m[2] });
  }
  return out;
}
