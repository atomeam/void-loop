// What Verse knows, searched (owner, 2026-11-03: "make it into a more functional usable brain"). The pure half of /brain/'s Knows view:
// brain/knows.json (tools/brain-knows.mjs) plus the live wants (/api/will) as one list of items, and a search over it. No DOM here.
export const KINDS = Object.freeze([
  ['all', 'Everything'], ['want', 'Wants'], ['skill', 'Skills'], ['page', 'Pages'], ['site', 'Sites it took on'], ['lesson', 'Lessons'], ['did', 'What it did'],
]);
export const LABEL = Object.freeze({ want: 'Want', got: 'Built want', skill: 'Skill', page: 'Page', site: 'Site', lesson: 'Lesson', did: 'Did' });

/** the will's answer as items: the wants it holds now first, then the ones it got (built). Pure. */
export function wantsOf(will) {
  const w = (will && Array.isArray(will.wants) ? will.wants : []).map((x, i) => ({ k: 'want', id: 'want-' + i, t: x.i_want || x.title || '', d: [x.because, x.evidence].filter(Boolean).join(' · '), src: x.source || x.kind || '', at: will.at || '' }));
  const g = (will && Array.isArray(will.got) ? will.got : []).map((x, i) => ({ k: 'want', got: true, id: 'got-' + i, t: x.i_want || x.title || '', d: [x.what, x.builtAt ? 'built ' + x.builtAt : ''].filter(Boolean).join(' · '), at: x.builtAt || '' }));
  return [...w, ...g].filter((x) => x.t);
}

const norm = (s) => String(s == null ? '' : s).toLowerCase();
export const termsOf = (q) => [...new Set(norm(q).match(/[\p{L}\p{N}][\p{L}\p{N}'./-]*/gu) || [])];

/** how well an item meets every term: 0 when any term is missing; a term in the title or id counts most. Pure. */
export function scoreOf(item, terms) {
  if (!terms.length) return 1;
  const head = norm(item.t) + ' ' + norm(item.id), body = norm(item.d) + ' ' + norm((item.ex || []).join(' ')) + ' ' + norm(item.st) + ' ' + norm(item.u) + ' ' + norm(item.src);
  let s = 0;
  for (const t of terms) {
    if (head.includes(t)) s += head.split(/[^\p{L}\p{N}]+/u).includes(t) ? 4 : 3;
    else if (body.includes(t)) s += 1;
    else return 0;
  }
  return s;
}

/** the items of `kind` that meet the query, best first (ties keep the file's order: newest first for wants, sites and commits). Pure. */
export function search(items, query = '', kind = 'all') {
  const terms = termsOf(query), out = [];
  (items || []).forEach((it, i) => { if (kind !== 'all' && it.k !== kind) return; const s = scoreOf(it, terms); if (s > 0) out.push([s, i, it]); });
  out.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  return out.map((x) => x[2]);
}

/** how many items of each kind meet the query. Pure. */
export function countsOf(items, query = '') {
  const terms = termsOf(query), c = { all: 0 };
  for (const it of items || []) if (scoreOf(it, terms) > 0) { c[it.k] = (c[it.k] || 0) + 1; c.all++; }
  return c;
}

/** where an item leads: its page, else asking Verse about it on the stage. Pure. */
export const hrefOf = (it) => (it && it.u ? it.u : '/?q=' + encodeURIComponent(it && it.k === 'skill' && it.ex && it.ex[0] ? it.ex[0] : (it && it.t) || ''));
