// edge-cache-live: the edge cache for answers (lib/answer-edge.js) checked on the live site, from outside. It asks the same
// stable question twice and expects the second reply from the colo's cache (x-verse-cache: HIT), and it checks that a personal
// ask, a signed request and a fresh request are never served from it. .github/workflows/edge-cache-live.yml runs it by hand.
//   node tools/edge-cache-live.mjs [origin]     default https://a-to-mind.com; exit 1 when a rule does not hold
// Five answer calls a run; a reference ask is answered from the D1 or edge cache after the first, so it costs about one model call.
const ELEMENTS = ['hydrogen', 'helium', 'lithium', 'carbon', 'nitrogen', 'oxygen', 'neon', 'sodium', 'iron', 'copper', 'silver', 'gold'];

/** a stable reference ask for the day, so repeat runs on one day find the copy. Pure. */
export function stableAsk(now = new Date()) {
  return 'what is the atomic number of ' + ELEMENTS[Math.floor(now.getTime() / 864e5) % ELEMENTS.length];
}

/** the calls of one run: name, ask, extra headers, query, and the marks each may show. Pure. */
export function plan(ask) {
  return [
    { name: 'first', ask, headers: {}, query: '', may: ['MISS', 'HIT'] },
    { name: 'repeat', ask, headers: {}, query: '', may: ['HIT'] },
    { name: 'personal', ask: 'what is my favourite colour', headers: {}, query: '', may: ['BYPASS'] },
    { name: 'signed', ask, headers: { authorization: 'Bearer edge-cache-live-check' }, query: '', may: ['BYPASS'] }, // void-review: ok (a made-up bearer that opens nothing: any bearer must close the cache)
    { name: 'fresh', ask, headers: {}, query: '?fresh=1', may: ['REFRESH'] },
  ];
}

/** the verdict for the rows of a run ({ name, status, mark, timing, fields }): { ok, lines }. Pure. */
export function judge(rows) {
  const lines = [];
  let ok = true;
  const first = rows.find((r) => r.name === 'first');
  // an answer the edge may not store (a field outside the answer fields, or not a 200) is never a HIT: say so instead of failing on it
  const unstorable = first && (first.status !== 200 || (first.fields || []).some((f) => !['answer', 'sources', 'at', 'route', 'near', 'pic', 'fuzzy', 'name', 'desc', 'series', 'cached'].includes(f)));
  for (const r of rows) {
    const want = plan('')[['first', 'repeat', 'personal', 'signed', 'fresh'].indexOf(r.name)];
    let may = want ? want.may : [];
    if (r.name === 'repeat' && unstorable) may = ['MISS'];
    const good = may.includes(r.mark);
    if (!good) ok = false;
    lines.push((good ? 'ok   ' : 'FAIL ') + r.name + ': status ' + r.status + ', x-verse-cache ' + (r.mark || '(none)') + (r.timing ? ', server-timing ' + r.timing : '') + (good ? '' : ' (expected ' + may.join(' or ') + ')'));
  }
  if (unstorable) lines.push('note: the first answer is not one the edge may store (status ' + first.status + ', fields ' + (first.fields || []).join(', ') + '), so the repeat is a MISS by design');
  return { ok, lines };
}

async function call(origin, c) {
  const res = await fetch(origin + '/api/answer' + c.query, { method: 'POST', headers: { 'content-type': 'application/json', ...c.headers }, body: JSON.stringify({ ask: c.ask }) });
  let fields = [];
  try { fields = Object.keys(await res.json()); } catch (_) {}
  return { name: c.name, status: res.status, mark: res.headers.get('x-verse-cache'), timing: res.headers.get('server-timing'), fields };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const origin = (process.argv[2] || 'https://a-to-mind.com').replace(/\/$/, '');
  const ask = stableAsk();
  console.log('edge cache on ' + origin + ', ask: ' + ask);
  const rows = [];
  for (const c of plan(ask)) rows.push(await call(origin, c));
  const { ok, lines } = judge(rows);
  for (const l of lines) console.log(l);
  process.exit(ok ? 0 : 1);
}
