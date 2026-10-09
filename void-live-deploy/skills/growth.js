/**
 * growth skill — "growth" / "how have you grown": Void's growth ledger (void.growth.json, BASE.md), newest first.
 * The ledger is append-only: every session that changes what Void can do adds one line with `node tools/grow.mjs`, and the
 * next deploy makes it summonable here. Kinds: grow (a new thing), build (better at one), fix, retire, idea and finding
 * (the idea stream, not built yet). Filter by kind; 40 at a time. Read from this site only; nothing is sent or kept.
 */
export const LEDGER_URL = '/void.growth.json';
export const KIND_LABEL = { grow: 'new', build: 'better', fix: 'fixed', retire: 'retired', idea: 'idea', finding: 'finding' };
const KIND_COLOR = { grow: '#3fbf6a', build: '#5b8def', fix: '#e0a24a', retire: '#8a8a92', idea: '#b07ce8', finding: '#4ac0c8' };
export const PAGE_SIZE = 40;

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/[’]/g, "'").replace(/\s+/g, ' ');
const ASK_RE = /^(?:(?:show|open|summon|give)(?:\s+me)?\s+)?(?:the\s+|your\s+)?(?:void(?:'s)?\s+)?growth(?:\s+(?:ledger|log|panel|history))?$|^(?:how\s+(?:have\s+you|has\s+void)\s+grown|how\s+did\s+(?:you|void)\s+grow|what\s+(?:have\s+you|has\s+void)\s+learned\s+lately|what'?s\s+new\s+(?:in|with)\s+void)$/;
export function growthOf(text) { return ASK_RE.test(CLEAN(text)); }

/** Newest first, optionally one kind only; entries without a valid time sink to the end. */
export function ordered(list, kind) {
  const t = (e) => { const n = Date.parse(e && e.at); return isNaN(n) ? -Infinity : n; };
  return (Array.isArray(list) ? list : []).filter((e) => e && typeof e.what === 'string' && (!kind || e.kind === kind))
    .map((e, i) => [e, i]).sort((a, b) => t(b[0]) - t(a[0]) || b[1] - a[1]).map((p) => p[0]);
}

/** { total, since, byKind: { grow: n, … } } */
export function summary(list) {
  const all = ordered(list), byKind = {};
  for (const e of all) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  const last = all[all.length - 1];
  return { total: all.length, since: last && !isNaN(Date.parse(last.at)) ? last.at.slice(0, 10) : '', byKind };
}

export function growthHtml(esc, list, kind, shown) {
  const s = summary(list), rows = ordered(list, kind), n = Math.min(shown || PAGE_SIZE, rows.length);
  const chip = (k, label, count) => '<button type="button" data-kind="' + k + '" style="margin:0 6px 6px 0;padding:3px 10px;border-radius:12px;border:1px solid '
    + (k === (kind || '') ? '#ddd' : '#444') + ';background:' + (k === (kind || '') ? '#2a2a30' : 'transparent') + ';color:inherit;font:inherit;font-size:13px;cursor:pointer">'
    + esc(label) + ' ' + count + '</button>';
  const chips = chip('', 'all', s.total) + Object.keys(KIND_LABEL).filter((k) => s.byKind[k]).map((k) => chip(k, KIND_LABEL[k], s.byKind[k])).join('');
  let day = '';
  const items = rows.slice(0, n).map((e) => {
    const d = String(e.at || '').slice(0, 10), head = d !== day ? '<h3 style="margin:14px 0 4px;font-size:14px;color:#8a8a92">' + esc(d || 'undated') + '</h3>' : '';
    day = d;
    const what = e.what.length > 320
      ? '<details><summary style="cursor:pointer">' + esc(e.what.slice(0, 300).replace(/\s+\S*$/, '')) + '…</summary>' + esc(e.what) + '</details>'
      : esc(e.what);
    return head + '<div style="margin:0 0 10px;line-height:1.45"><div style="font-size:12px;color:#8a8a92"><span style="color:' + (KIND_COLOR[e.kind] || '#aaa') + '">'
      + esc(KIND_LABEL[e.kind] || e.kind || '') + '</span> · ' + esc(e.by || '') + (e.ref && /^https:\/\//.test(e.ref) ? ' · <a href="' + esc(e.ref) + '" target="_blank" rel="noopener">link</a>' : '') + '</div>'
      + what + '</div>';
  }).join('');
  return '<h2>How Void has grown</h2><div class="sub">' + s.total + ' changes' + (s.since ? ' since ' + esc(s.since) : '') + ', newest first</div>'
    + '<div style="margin:8px 0 2px">' + chips + '</div>'
    + (rows.length ? items : '<p style="color:#8a8a92">Nothing here yet.</p>')
    + (rows.length > n ? '<button type="button" data-more="1" style="margin-top:6px;padding:4px 12px;border-radius:12px;border:1px solid #444;background:transparent;color:inherit;font:inherit;cursor:pointer">show ' + Math.min(PAGE_SIZE, rows.length - n) + ' more</button>' : '')
    + '<div class="src">From <a href="' + LEDGER_URL + '" target="_blank" rel="noopener">void.growth.json</a>, an append-only ledger: every change to what Void can do adds one line.</div>';
}

export async function loadLedger(fetchFn = (u, o) => fetch(u, o)) {
  const r = await fetchFn(LEDGER_URL, { cache: 'no-cache' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const list = await r.json();
  if (!Array.isArray(list)) throw new Error('the ledger is not a list');
  return list;
}

async function run(text, api) {
  if (!growthOf(text)) return 'none';
  const { showPage, esc, _pageStill } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>How Void has grown</h2><div class="sub">reading the ledger…</div>'; });
  let list;
  try { list = await loadLedger(); }
  catch (e) { if (!_pageStill || _pageStill(el)) el.innerHTML = '<h2>How Void has grown</h2><p>The ledger could not be read just now (' + esc((e && e.message) || String(e)) + '). Ask again in a moment.</p>'; return 'none'; }
  if (_pageStill && !_pageStill(el)) return 'growth';
  let kind = '', shown = PAGE_SIZE;
  const draw = () => { el.innerHTML = growthHtml(esc, list, kind, shown); };
  el.addEventListener('click', (ev) => {
    const b = ev.target && ev.target.closest && ev.target.closest('button[data-kind],button[data-more]');
    if (!b) return;
    if (b.hasAttribute('data-more')) shown += PAGE_SIZE; else { kind = b.getAttribute('data-kind') || ''; shown = PAGE_SIZE; }
    draw();
  });
  draw();
  return 'growth';
}

// checked by tools/skills-check.mjs on every run: the page's maths on made-up entries
export function suite() {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const list = [{ at: '2026-10-01T10:00:00Z', by: 'a', kind: 'grow', what: 'one' }, { at: '2026-10-03T10:00:00Z', by: 'b', kind: 'fix', what: 'two <b>' },
    { at: '2026-10-02T10:00:00Z', by: 'c', kind: 'grow', what: 'three' }];
  const o = ordered(list).map((e) => e.what).join(','), s = summary(list), h = growthHtml(esc, list, 'grow', 40);
  const ok = o === 'two <b>,three,one' && s.total === 3 && s.since === '2026-10-01' && s.byKind.grow === 2 && !h.includes('two') && h.includes('three') && !growthHtml(esc, list, '', 40).includes('<b>');
  return { ok, got: ok ? '' : o + ' ' + JSON.stringify(s) };
}

export default {
  name: 'growth',
  examples: ['growth', 'void growth', "void's growth", 'show growth', 'show me the growth ledger', 'how have you grown', 'how has void grown', "what's new with void"],
  nearMisses: ['economic growth', 'growth rate of india', 'growth mindset', 'hair growth', 'how do plants grow', 'what is growth', 'grow a tree', 'population growth'],
  growthOf,
  suite,
  match(lower, text) { return growthOf(text); },
  run,
};
