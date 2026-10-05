/**
 * book skill — a book or an author from Open Library (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "books by Octavia Butler", "book called Dune", "isbn 9780441172719".
 */
export function bookOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:isbn[:\s-]*)((?:\d-?){9,16}\d)$/i);
  if (m) return { q: m[1].replace(/-/g, ''), isbn: true };
  // "books like dune", "books similar to the hobbit": the book's own subject, other books on it
  m = t.match(/^(?:(?:recommend|suggest|give\s+me)\s+)?(?:some\s+)?(?:books?|novels?|reads?)\s+(?:like|similar\s+to)\s+(.{2,80})$/i);
  if (m) return { q: m[1].replace(/^the\s+/i, ''), isbn: false, like: true };
  m = t.match(/^(?:(?:a|some|any)\s+)?(?:books?\s+by|novels?\s+by|find\s+(?:the\s+)?book|book\s+called)\s+(.{2,80})$/i);
  if (m && !/^(?:a|the)\s+book$/.test(m[1])) return { q: m[1].replace(/^the\s+/i, ''), isbn: false };
  return null;
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = bookOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Books</h2><div class="sub">…</div>'; });
  try {
    let subject = '';
    if (q.like) { // the book first, then its most specific subject
      const b = await fetch('https://openlibrary.org/search.json?limit=1&fields=title,subject&q=' + encodeURIComponent(q.q)).then((r) => r.json());
      const subs = ((b && b.docs && b.docs[0] && b.docs[0].subject) || []).filter((s) => !/^(fiction|general|accessible book|protected daisy|in library|large type books|open library staff picks|english fiction|american fiction)/i.test(s));
      subject = subs[0] || '';
      if (!subject) throw 0;
    }
    const url = q.isbn
      ? 'https://openlibrary.org/isbn/' + encodeURIComponent(q.q) + '.json'
      : subject ? 'https://openlibrary.org/search.json?limit=8&subject=' + encodeURIComponent(subject)
      : 'https://openlibrary.org/search.json?limit=5&q=' + encodeURIComponent(q.q);
    const j = await fetch(url).then((r) => r.json());
    if (!api._pageStill(el)) return 'book';
    const same = (x) => String(x || '').toLowerCase().replace(/^the\s+/, '') === q.q.toLowerCase();
    const docs = q.isbn ? (j && j.title ? [j] : []) : ((j && j.docs) || []).filter((d) => d.title && !(q.like && same(d.title)));
    if (!docs.length) throw 0;
    const rows = docs.slice(0, 5).map((d) => {
      const title = d.title;
      const who = (d.author_name || d.authors || []).map((a) => (typeof a === 'string' ? a : a.name)).filter(Boolean).slice(0, 3).join(', ');
      const year = d.first_publish_year || (d.publish_date || '');
      const key = d.key || '';
      const href = key ? 'https://openlibrary.org' + key : 'https://openlibrary.org/isbn/' + encodeURIComponent(q.q);
      return '<li><a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(title) + '</a>'
        + (who ? ' · ' + esc(who) : '') + (year ? ' · ' + esc(String(year)) : '') + '</li>';
    }).join('');
    el.innerHTML = '<h2>' + esc(q.isbn ? 'ISBN ' + q.q : q.like ? 'Books like ' + q.q : q.q) + '</h2>' + (subject ? '<div class="sub">On the same subject: ' + esc(subject) + '</div>' : '') + '<ul>' + rows + '</ul>'
      + '<div class="src">Source: <a href="https://openlibrary.org/search?q=' + encodeURIComponent(q.q) + '" target="_blank" rel="noopener">Open Library</a></div>';
    return 'book';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Books</h2><p>Open Library didn\'t answer. Try the title again in a moment.</p>';
    return 'none';
  }
}
export default {
  name: 'book',
  examples: ['books by octavia butler', 'book called dune', 'isbn 9780441172719', 'find the book the left hand of darkness', 'books like dune'],
  nearMisses: ['what is a book', 'book a table', 'how to write a book', 'map of a library'],
  match(lower, text) { return !!bookOf(text); },
  run
};
