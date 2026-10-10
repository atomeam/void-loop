/**
 * growth skill — "growth" / "how have you grown": Void's growth ledger (void.growth.json, BASE.md), newest first.
 * The ledger is append-only: every session that changes what Void can do adds one line with `node tools/grow.mjs`, and the
 * next deploy makes it summonable here. Kinds: grow (a new thing), build (better at one), fix, retire, idea and finding
 * (the idea stream, not built yet). Filter by kind; 40 at a time. Read from this site only; nothing is sent or kept.
 */
import { timeline, weekSummary } from './growth-tree.js'; // the time slider's stops (growth-tree.js reads KIND_COLOR from here, only when called)

export const LEDGER_URL = '/void.growth.json';
export const KIND_LABEL = { grow: 'new', build: 'better', fix: 'fixed', retire: 'retired', idea: 'idea', finding: 'finding' };
export const KIND_COLOR = { grow: '#3fbf6a', build: '#5b8def', fix: '#e0a24a', retire: '#8a8a92', idea: '#b07ce8', finding: '#4ac0c8' };
export const PAGE_SIZE = 40;

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/[’]/g, "'").replace(/\s+/g, ' ');
const ASK_RE = /^(?:(?:show|open|summon|give)(?:\s+me)?\s+)?(?:the\s+|your\s+)?(?:void(?:'s)?\s+)?growth(?:\s+(?:ledger|log|panel|history))?$|^(?:how\s+(?:have\s+you|has\s+void)\s+grown|how\s+did\s+(?:you|void)\s+grow|what\s+(?:have\s+you|has\s+void)\s+learned\s+lately|what'?s\s+new\s+(?:in|with)\s+void)$/;
export function growthOf(text) { return ASK_RE.test(CLEAN(text)); }
// "what can you do now that you couldn't last week?": the same card, opening on the last 7 days (weekSummary) with the tree
// set to a week ago, so this week's tips grow in as it answers
const WEEK = '(?:last week|a week ago|the last week|the past week|this week|in the last week|over the last week|over the past week|since last week|in the past week|in a week)';
const WEEK_RE = new RegExp('^(?:what (?:can|could) you do now that you (?:couldn\'?t|could not|can\'?t|cannot)(?: do)?(?: ' + WEEK + '| before)'
  + '|what(?:\'?s| is| has)? (?:new|changed)(?: (?:with|about|in) (?:you|void))? ' + WEEK
  + '|what (?:have you|has void|did you) (?:learned|learnt|learn|added|add|built|build|shipped|ship|gained|gain|got better at|get better at) ' + WEEK
  + '|how (?:have you|has void) (?:grown|changed|improved) ' + WEEK
  + '|(?:void|your) (?:week|growth this week|last week))$');
export function weekOf(text) { return WEEK_RE.test(CLEAN(text)); }

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

export function growthHead(esc, list) {
  const s = summary(list);
  return '<h2>How Void has grown</h2><div class="sub">' + s.total + ' changes' + (s.since ? ' since ' + esc(s.since) : '') + ', newest first</div>';
}

/** One entry as the tree's readout shows it, when a branch is touched. */
export function entryHtml(esc, e) {
  if (!e) return '';
  return '<div style="font-size:12px;color:#8a8a92"><span style="color:' + (KIND_COLOR[e.kind] || '#aaa') + '">' + esc(KIND_LABEL[e.kind] || e.kind || '') + '</span> · ' + esc(String(e.at || '').slice(0, 10))
    + ' · ' + esc(e.by || '') + (e.ref && /^https:\/\//.test(e.ref) ? ' · <a href="' + esc(e.ref) + '" target="_blank" rel="noopener">link</a>' : '') + '</div>' + esc(e.what);
}

export function growthHtml(esc, list, kind, shown, { head = true } = {}) {
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
  return (head ? growthHead(esc, list) : '')
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
  const week = weekOf(text);
  if (!week && !growthOf(text)) return 'none';
  const { showPage, esc, _pageStill } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>How Void has grown</h2><div class="sub">reading the ledger…</div>'; });
  let list;
  try { list = await loadLedger(); }
  catch (e) { if (!_pageStill || _pageStill(el)) el.innerHTML = '<h2>How Void has grown</h2><p>The ledger could not be read just now (' + esc((e && e.message) || String(e)) + '). Ask again in a moment.</p>'; return 'none'; }
  if (_pageStill && !_pageStill(el)) return 'growth';
  let kind = '', shown = PAGE_SIZE;
  el.innerHTML = growthHead(esc, list);
  const w = week ? weekSummary(list) : null;
  if (w) el.insertAdjacentHTML('beforeend', weekHtml(esc, w));
  const body = document.createElement('div');
  const draw = () => { body.innerHTML = growthHtml(esc, list, kind, shown, { head: false }); };
  plantTree(el, api, list, w ? { from: w.until } : {});
  el.appendChild(body);
  body.addEventListener('click', (ev) => {
    const b = ev.target && ev.target.closest && ev.target.closest('button[data-kind],button[data-more]');
    if (!b) return;
    if (b.hasAttribute('data-more')) shown += PAGE_SIZE; else { kind = b.getAttribute('data-kind') || ''; shown = PAGE_SIZE; }
    draw();
  });
  draw();
  return 'growth';
}

/** The week, in plain words, at the top of the card ("what can you do now that you couldn't last week?"). */
export function weekHtml(esc, w) {
  if (!w.total) return '<div class="growth-week" style="margin:8px 0 4px">' + esc(w.text) + '</div>';
  const groups = w.groups.filter((g) => g.kind !== 'idea' && g.kind !== 'finding');
  return '<div class="growth-week" style="margin:8px 0 6px;line-height:1.45"><p style="margin:0 0 6px">Since ' + esc(w.since) + ', ' + w.total + ' change' + (w.total === 1 ? '' : 's') + ': '
    + w.groups.map((g) => '<span style="color:' + (KIND_COLOR[g.kind] || '#aaa') + '">' + g.count + ' ' + esc(g.label) + '</span>').join(', ') + '.</p>'
    + groups.map((g) => '<div style="margin:0 0 6px"><b style="font-weight:600">' + esc(g.label[0].toUpperCase() + g.label.slice(1)) + ':</b> ' + g.items.map(esc).join('; ')
      + (g.count > g.items.length ? ' <span style="color:#8a8a92">and ' + (g.count - g.items.length) + ' more below</span>' : '') + '</div>').join('') + '</div>';
}

// The card's figure (two-part summons; frontier #3): the ledger as a tree (skills/mini/growthtree.js), one branch per
// entry, under the title; touch a branch to read its entry here. Where 3D can't run, the card is the ledger alone.
export const TREE_KEY = 'growth-tree';
function plantTree(el, api, list, { from } = {}) {
  const stage = api.stage;
  if (!stage || typeof stage.miniature !== 'function' || typeof document === 'undefined') return;
  const slot = document.createElement('div'); slot.className = 'growth-tree'; slot.style.cssText = 'height:300px;margin:6px 0 4px';
  // the time slider: the first entry alone, then every day to today (skills/growth-tree.js timeline)
  const stops = timeline(list), when = document.createElement('div'); when.className = 'growth-when'; when.style.cssText = 'display:flex;align-items:center;gap:10px;margin:0 0 6px;font-size:13px;color:#8a8a92';
  const range = document.createElement('input'); range.type = 'range'; range.min = '0'; range.max = String(Math.max(0, stops.length - 1)); range.step = '1'; range.value = range.max;
  if (from) { const i = stops.reduce((k, st, j) => (Date.parse(st.until) <= Date.parse(from) ? j : k), 0); range.value = String(i); } // a week ago, then grown to today
  range.setAttribute('aria-label', 'Grow the tree as it stood on a past day'); range.style.cssText = 'flex:1;min-width:0;accent-color:#a0805a';
  const day = document.createElement('span'); day.className = 'growth-day'; day.style.cssText = 'white-space:nowrap;font-variant-numeric:tabular-nums';
  when.append(range, day);
  const said = document.createElement('div'); said.className = 'growth-picked'; said.style.cssText = 'min-height:18px;margin:0 0 8px;line-height:1.45;font-size:13px;color:#8a8a92';
  const hint = 'One branch for every change, the oldest at the trunk, the newest at the tips; its berries are its kind. Touch a branch to read it.';
  said.textContent = hint;
  el.append(slot, when, said);
  let selected = null, self = null;
  const at = () => stops[+range.value] || null, today = () => +range.value >= stops.length - 1;
  const showDay = () => { const s = at(); day.textContent = s ? (today() ? 'today, ' : +range.value === 0 ? 'the first change, ' : '') + s.day + ' · ' + s.count + (s.count === 1 ? ' change' : ' changes') : ''; };
  // what is not grown yet shows only today: the think tank's open tracks (faint) and the claim being built (glowing)
  // one mount at a time: a second call while the first is still loading three.js would build a second tree under the same key
  let queue = null;
  const mount = () => (queue = (queue || Promise.resolve()).catch(() => {}).then(() => stage.miniature(slot, 'growthtree', { entries: list, until: today() ? null : at() && at().until, tracks: today() && self ? self.tracks : null, building: today() && self ? self.building : null, selected, onPick, onPickGhost },
    { key: TREE_KEY, place: 'inside', label: 'Void’s growth as a tree: one branch per change; touch a branch to read it' })));
  function onPick(index) {
    const e = list[index]; if (!e) return;
    selected = index; said.style.color = ''; said.innerHTML = entryHtml(api.esc, e);
    mount().catch(() => {});
  }
  function onPickGhost(g) {
    said.style.color = '';
    said.textContent = g.kind === 'building' ? 'Building now: ' + (g.item ? g.item + ' (' + g.what + ')' : g.what) : 'Not grown yet: ' + g.what + ', a track the think tank is working on' + (g.at ? ' (last advanced ' + g.at + ')' : '') + '.';
  }
  range.addEventListener('input', () => { showDay(); selected = null; said.style.color = '#8a8a92'; said.textContent = hint; mount().catch(() => {}); });
  range.addEventListener('pointerdown', (e) => e.stopPropagation()); // dragging the slider is not dragging the card
  showDay();
  mount().then(() => { // asked about the week: once the tree stands as it was a week ago, grow it to today (at once under reduced motion)
    if (!from || today()) return;
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => { if (!el.isConnected) return; range.value = range.max; showDay(); mount().catch(() => {}); }, still ? 0 : 1200);
  }).catch(() => { slot.remove(); when.remove(); said.remove(); });
  fetch('/self.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && (j.tracks || j.building)) { self = j; if (today()) mount().catch(() => {}); } }).catch(() => {});
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
  examples: ['growth', 'void growth', "void's growth", 'show growth', 'show me the growth ledger', 'how have you grown', 'how has void grown', "what's new with void",
    "what can you do now that you couldn't last week", "what's new since last week", 'what have you learned this week', 'how have you grown this week'],
  nearMisses: ['economic growth', 'growth rate of india', 'growth mindset', 'hair growth', 'how do plants grow', 'what is growth', 'grow a tree', 'population growth',
    'what can you do', 'what can i do this week', "what's new in tech this week", 'what changed in the law last week', 'what did i do last week', 'what can you do with python'],
  weekOf,
  growthOf,
  suite,
  match(lower, text) { return growthOf(text) || weekOf(text); },
  run,
};
