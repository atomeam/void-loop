// Search the tome (asked by Verse: "Implement a 'search' input on the book cover that allows me to jump directly to a specific skill's page",
// "Implement a 'search the tome' feature that allows me to find specific asks or skills by keyword without leaving the parchment view",
// "Implement a 'Search the Tome' search bar that stays docked at the top of the parchment view"). Pure: the pages of skills/guide.json in,
// the best pages out; skills/guide.js draws the bar and jumps with go(n). It reads the book's own words (title, name, line, examples,
// lore) and nothing else, so it can never find a page the book does not have.
const norm = (s) => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const KINDS = new Set(['skill', 'game', 'mini']);

/** the pages that match `query`, best first: [{ n, title, kind, chapter, hint }] (hint: the ask or line that matched). Pure. */
export function searchBook(book, query, max = 8) {
  const q = norm(query); if (q.length < 2) return [];
  const words = q.split(' ').filter(Boolean), out = [];
  for (const p of (book && book.pages) || []) {
    if (!p || !KINDS.has(p.kind)) continue;
    const title = norm(p.title), name = norm(p.name), line = norm(p.line), flavor = norm(p.flavor);
    const examples = (p.examples || []).map((e) => [norm(e), e]);
    let score = 0, hint = '';
    if (name === q || title === q) score += 100;
    else if (title.startsWith(q) || name.startsWith(q)) score += 70;
    else if (title.includes(q) || name.includes(q)) score += 50;
    const ex = examples.find(([n]) => n === q) || examples.find(([n]) => n.includes(q));
    if (ex) { score += ex[0] === q ? 60 : 40; hint = ex[1]; }
    if (line.includes(q)) { score += 25; hint = hint || p.line; }
    if (!score && words.length > 1) { // every word somewhere on the page
      const all = [title, name, line, flavor, ...examples.map((e) => e[0])].join(' ');
      if (words.every((w) => all.includes(w))) { score = 20; const e2 = examples.find(([n]) => words.every((w) => n.includes(w))); hint = e2 ? e2[1] : p.line || ''; }
    }
    if (!score && flavor.includes(q)) score = 10;
    if (score) out.push({ n: p.n, title: p.title || p.name, kind: p.kind, chapter: p.chapter, hint: String(hint || '').slice(0, 90), score });
  }
  return out.sort((a, b) => b.score - a.score || a.n - b.n).slice(0, max).map(({ score, ...r }) => r);
}

/** the bar's CSS: docked at the top of the screen over the dim, parchment-and-ink to match the book. */
export const SEARCH_CSS = [
  '.tome-search{position:absolute;top:max(10px,1.6vh);left:50%;transform:translateX(-50%);width:min(440px,calc(100vw - 24px));z-index:9;font-family:inherit}',
  '.tome-search input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:9px 14px;border-radius:999px;border:1px solid rgba(214,179,92,.55);background:rgba(36,23,13,.88);color:#f0e3c4;outline:none;box-shadow:0 6px 24px rgba(0,0,0,.5)}',
  '.tome-search input::placeholder{color:rgba(232,214,178,.6);font-style:italic}.tome-search input:focus{border-color:rgba(240,214,140,.95)}',
  '.tome-hits{list-style:none;margin:6px 0 0;padding:4px;border-radius:14px;background:#e6d5ae;color:#2b1b0e;box-shadow:0 14px 40px rgba(0,0,0,.6);max-height:min(46vh,340px);overflow:auto}.tome-hits:empty{display:none}',
  '.tome-hits li{margin:0}.tome-hits button{all:unset;box-sizing:border-box;display:block;width:100%;padding:7px 12px;border-radius:10px;cursor:pointer;font-size:15px}',
  '.tome-hits button:hover,.tome-hits button:focus-visible,.tome-hits li.on button{background:rgba(120,70,20,.18)}.tome-hits small{display:block;font-style:italic;color:#6d4c2a;font-size:12.5px}.tome-hits em{float:right;font-style:normal;font-size:12px;color:#6d4c2a}',
].join('');
