// The growth ledger's "today" view (the frontier's "absorb and connect every repo": a verifiable growth ledger, "a 'today' view on the page").
// The growth card reads the served ledger (/void.growth.json) and its proof (/growth.proof.json, written last by the deploy with
// tools/ledger-proof.mjs), recomputes the hash chain in the visitor's own browser with the same rule, and shows the day's lines (UTC) with
// their line hashes and whether every line still matches the proof. Nothing is signed: a match shows the served ledger was not altered after
// the proof was made, not who wrote it. Pure but for `sha`, which is passed in (the browser's crypto.subtle by default); nothing is sent or kept.
export const PROOF_URL = '/growth.proof.json';
export const TODAY_LIMIT = 12;

const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
/** an entry as JSON with its keys sorted at every level: the same rule as tools/ledger-proof.mjs canon (a test holds the two together). Pure. */
export const canon = (e) => JSON.stringify(sortKeys(e));

/** sha256 of a text as lower-case hex, with the browser's (or Node's) Web Crypto */
export async function subtleSha(text) {
  const b = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
}

/** the hash of every line, chained as tools/ledger-proof.mjs chainOf does: sha256(previous hash + "\n" + canon(entry)), the first previous hash empty */
export async function chainOf(list, sha = subtleSha) {
  const out = []; let h = '';
  for (const e of Array.isArray(list) ? list : []) { h = await sha(h + '\n' + canon(e)); out.push(h); }
  return out;
}

const dayOf = (e) => (e && typeof e.at === 'string' && /^\d{4}-\d{2}-\d{2}/.test(e.at) ? e.at.slice(0, 10) : '');

/** the stage link that runs a line's `try` phrase, or '' (a phrase of up to 300 characters, as the ledger writes it) */
export const tryLinkOf = (e) => { const t = e && typeof e.try === 'string' ? e.try.replace(/\s+/g, ' ').trim() : ''; return t && t.length <= 300 ? '/?q=' + encodeURIComponent(t) : ''; };

/** check the ledger against its proof, and pick the lines of today (UTC) or, with none today, of the newest day that has lines.
 *  { ok, why, count, root, day, today, rows: [{ n, at, kind, what, hash, tryIt }] newest first, more, tryable (of the day's lines) } */
export async function todayCheck(list, proof, now = new Date(), sha = subtleSha) {
  const l = Array.isArray(list) ? list : [], hashes = await chainOf(l, sha), n = hashes.length;
  let ok = false, why;
  if (!proof || proof.v !== 1 || !Array.isArray(proof.lines)) why = 'no proof to check it against';
  else if (proof.count !== n || proof.lines.length !== n) why = 'the ledger has ' + n + ' lines and the proof counts ' + proof.count;
  else {
    const bad = proof.lines.findIndex((p, i) => !p || p.hash !== hashes[i]);
    if (bad >= 0) why = 'line ' + (bad + 1) + (dayOf(l[bad]) ? ' (' + dayOf(l[bad]) + ')' : '') + ' does not match its proof: it, or a line before it, was changed';
    else if (n && proof.root !== hashes[n - 1]) why = 'the root hash does not match the last line';
    else { ok = true; why = n === 1 ? 'the 1 line matches' : 'all ' + n + ' lines match'; }
  }
  const todayDay = new Date(now).toISOString().slice(0, 10);
  let day = todayDay;
  if (!l.some((e) => dayOf(e) === day)) day = l.reduce((m, e) => (dayOf(e) > m ? dayOf(e) : m), '');
  const all = [];
  l.forEach((e, i) => { if (day && dayOf(e) === day) all.push({ n: i + 1, at: String(e.at), kind: String(e.kind || ''), what: String(e.what || ''), hash: hashes[i], tryIt: tryLinkOf(e) }); });
  all.reverse();
  return { ok, why, count: n, root: n ? hashes[n - 1] : '', day, today: day === todayDay, rows: all.slice(0, TODAY_LIMIT), more: Math.max(0, all.length - TODAY_LIMIT), tryable: all.filter((x) => x.tryIt).length };
}

/** the "today" block on the growth card: the day's lines with their line hashes, and the check against the proof. '' without a result. Pure. */
export function todayHtml(esc, r, { label = {}, color = {}, text = (w) => w } = {}) {
  if (!r || !r.count) return '';
  const head = r.today ? 'Today (UTC, ' + r.day + '): ' + r.rows.length + (r.more ? ' of ' + (r.rows.length + r.more) : '') + ' line' + (r.rows.length + r.more === 1 ? '' : 's')
    : 'Nothing yet today (UTC). The newest day, ' + r.day + ': ' + (r.rows.length + r.more) + ' line' + (r.rows.length + r.more === 1 ? '' : 's');
  const check = r.ok ? 'Checked in this browser: ' + esc(r.why) + ' <a href="/growth.proof.json" target="_blank" rel="noopener">growth.proof.json</a>, root <code title="' + esc(r.root) + '">' + esc(r.root.slice(0, 12)) + '</code>.'
    : 'Checked in this browser: ' + esc(r.why) + '.';
  const items = r.rows.map((x) => '<li style="margin:0 0 4px"><span style="color:' + esc(color[x.kind] || '#aaa') + '">' + esc(label[x.kind] || x.kind) + '</span> '
    + esc(String(text(x.what) || '').replace(/\s+/g, ' ').trim()) + ' <code style="color:#8a8a92" title="line ' + x.n + ': ' + esc(x.hash) + '">' + esc(x.hash.slice(0, 12)) + '</code>'
    + (x.tryIt ? ' <a href="' + esc(x.tryIt) + '" data-try-line="' + x.n + '">try it</a>' : '') + '</li>').join('');
  const all = r.rows.length + (r.more || 0), tryable = r.tryable || 0;
  const proof = all ? ' ' + tryable + ' of ' + all + ' line' + (all === 1 ? '' : 's') + (tryable === 1 ? ' has' : ' have') + ' a phrase you can try on the stage yourself.' : '';
  return '<div class="sub growth-today" data-today="' + r.rows.length + '" data-ledger-ok="' + (r.ok ? '1' : '0') + '" data-tryable="' + tryable + '" style="line-height:1.45;margin-top:6px">'
    + '<div>' + esc(head) + '. ' + check + esc(proof) + '</div>'
    + (items ? '<ul style="margin:4px 0 0;padding-left:18px">' + items + '</ul>' : '')
    + (r.more ? '<div>and ' + r.more + ' more below.</div>' : '') + '</div>';
}
