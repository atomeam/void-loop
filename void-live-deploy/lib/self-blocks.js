// The self card ("What I think of myself") as structured blocks, then as markup (asked by the owner's review, 2026-10-18: the card read as a wall of text).
// selfSections(v) turns /api/reflect into sections: Verse's own words (a reflection: normal reading font) and the changelog (what got built: monospace).
// selfHtml(sections, esc) draws them: real headings, one list item per ask with its dates as a muted second line, a blank gap between paragraphs.
// Pure: no DOM, no network. The page (void.html showVoice) mounts the result and wires the Root cause / Surface buttons.
import { sparkSvg } from './spark.js';

const day = (t) => String(t || '').slice(0, 10);
// the growth velocity (asked by Verse: "a 'growth-velocity' sparkline on the self card that tracks the rate of 'Next' items moving to 'Shipped'
// over the last 7 days"): one point a day for the last VELOCITY_DAYS days, each the count of its asks built that day (follow.asked, by builtAt)
export const VELOCITY_DAYS = 7;
export const VELOCITY_EVERY = 60e3; // while the card is open, a stage change redraws it from /api/reflect at most this often (void.html showVoice)
/** velocity(asked, now) -> { days: [{ day, n }] (oldest first, today last), total, today }. asked is follow.asked ([{ ask, at, times }]); a day is
 *  the ISO date of at (the same day() the card's dates use), so a build and its date agree. Anything but a list counts as nothing built. Pure. */
export function velocity(asked, now = Date.now()) {
  const at = Number.isFinite(+now) ? +now : Date.parse(now), list = Array.isArray(asked) ? asked : [];
  const days = Array.from({ length: VELOCITY_DAYS }, (_, i) => day(new Date(at - (VELOCITY_DAYS - 1 - i) * 864e5).toISOString())).map((d) => ({ day: d, n: list.filter((a) => a && day(a.at) === d).length }));
  return { days, total: days.reduce((s, d) => s + d.n, 0), today: days[days.length - 1].n };
}
/** the velocity's words: "N built this week · M today", or "nothing built this week". Pure. */
export const velocityLabel = (v) => (v.total ? v.total + ' built this week · ' + v.today + ' today' : 'nothing built this week');
// friction (asked by Verse: "a 'friction' overlay to the growth-velocity sparkline that colors segments red when an open ask exceeds its expected
// resolution time"): an open ask is overdue once it is older than its expected resolution time, OVERDUE_SMALL_DAYS for an ask Verse called small,
// OVERDUE_DAYS for any other; the day it crossed that limit is a friction day, drawn red on the same line
export const OVERDUE_SMALL_DAYS = 2, OVERDUE_DAYS = 7;
export const FRICTION_RED = 'rgb(255,120,110)';
/** friction(asks, now) -> { days: [{ day, n }] (the velocity's 7 days: n asks crossed their limit that day), overdue: [{ ask, at, small, due }]
 *  (every open ask past its limit now, oldest crossing first), total }. asks is /api/reflect's open asks ([{ ask, at, small }]); an ask with no
 *  readable `at` is never overdue. Pure. */
export function friction(asks, now = Date.now()) {
  const at = Number.isFinite(+now) ? +now : Date.parse(now), list = Array.isArray(asks) ? asks : [];
  const crossed = list.filter((a) => a && typeof a === 'object' && Number.isFinite(Date.parse(a.at))).map((a) => ({ ask: a.ask, at: a.at, small: !!a.small, due: new Date(Date.parse(a.at) + (a.small ? OVERDUE_SMALL_DAYS : OVERDUE_DAYS) * 864e5).toISOString() }))
    .filter((a) => Date.parse(a.due) <= at).sort((x, y) => x.due.localeCompare(y.due));
  const days = Array.from({ length: VELOCITY_DAYS }, (_, i) => day(new Date(at - (VELOCITY_DAYS - 1 - i) * 864e5).toISOString())).map((d) => ({ day: d, n: crossed.filter((a) => day(a.due) === d).length }));
  return { days, overdue: crossed, total: crossed.length };
}
/** the red per segment of the velocity line: segment i joins day i to day i + 1 and is red when day i + 1 had a crossing; null for the rest. Pure. */
export const frictionColors = (fr) => fr.days.slice(1).map((d) => (d.n ? FRICTION_RED : null));
/** the velocity block's markup: the sparkline (7 points, a tick a day, the latest a dot; a week of nothing is a flat line) and its label; with a
 *  friction (fr) a segment whose day had an ask cross its limit is red and the label ends " · N overdue" in amber while any ask is overdue. */
export function velocityHtml(v, esc, fr = null) {
  const max = Math.max(1, ...v.days.map((d) => d.n));
  const title = 'Asks of mine built each day, the last ' + VELOCITY_DAYS + ' days: ' + v.days.map((d) => d.day.slice(5) + ' ' + d.n).join(', ')
    + (fr ? ' · red: a day an open ask of mine passed its expected resolution time (' + OVERDUE_SMALL_DAYS + ' days for one I called small, ' + OVERDUE_DAYS + ' days otherwise)' + (fr.total ? ' · overdue now: ' + fr.total : ' · none overdue now') : '');
  return '<div class="vs-velocity" data-total="' + esc(v.total) + '" data-today="' + esc(v.today) + '"' + (fr ? ' data-overdue="' + esc(fr.total) + '"' : '') + ' title="' + esc(title) + '">'
    + sparkSvg(v.days, 84, 18, { key: 'n', max, cls: 'vs-spark', ticks: true, ...(fr ? { segmentColors: frictionColors(fr) } : {}) }) + '<span class="vs-vel-label">' + esc(velocityLabel(v)) + (fr && fr.total ? '<span class="vs-overdue"> · ' + esc(fr.total) + ' overdue</span>' : '') + '</span></div>';
}
// the long lists fold (owner, 2026-10-18: "What I've asked for" and "What got built" read as a monolith): the newest FOLD show, the rest wait behind
// "show all N"; a folded item is still in the saved text, as one line (its dates and details are marked data-share-skip, lib/card-share.js)
export const FOLD = 5;
export const SHORT = 72; // a folded item's line in the saved text, so a long list still fits the saved card (lib/card-share.js BODY_MAX)
/** a folded item's one line: its first SHORT characters, cut at a word, with an ellipsis when cut. Pure. */
export function shortLine(t) {
  const s = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  if (s.length <= SHORT) return s;
  const cut = s.slice(0, SHORT), at = cut.lastIndexOf(' ');
  return (at > SHORT / 2 ? cut.slice(0, at) : cut).replace(/[\s,;:.–—-]+$/, '') + '…';
}
const sentence = (s) => String(s == null ? '' : s).trim();

// one ask said twice in other words is one ask (owner, 2026-10-18, "fix this" on a self card listing 'report-to-growth', the Zorbleflux
// throttle and 'dependency-health' twice each): two asks are the same when they quote the same name, or share most of their words
const STOP = new Set('a an the to of in on for and or so that this it its my me i as by with from into is be can when which what'.split(' '));
const quoted = (t) => { const m = /['‘"“]([^'’"”]{3,40})['’"”]/.exec(t); return m ? m[1].toLowerCase().replace(/[\s_-]+/g, '-') : ''; };
const words = (t) => new Set(String(t).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
export function sameAsk(a, b) {
  const qa = quoted(a), qb = quoted(b);
  if (qa && qb && qa !== qb) return false;
  const wa = words(a), wb = words(b); if (Math.min(wa.size, wb.size) < 3) return false; // too few words to call two asks one
  let n = 0; for (const w of wa) if (wb.has(w)) n++;
  // the same quoted name with a few more words in common is the same ask; two asks about one skill that want different things are not
  return n / Math.min(wa.size, wb.size) >= (qa && qb ? 0.4 : 0.7);
}
/** the asks with each one said again in other words folded into its first telling, which carries how many times it was asked. Pure. */
export function foldAsks(asks) {
  const out = [];
  for (const a of asks || []) { const t = sentence(a && a.ask); if (!t) continue; const same = out.find((o) => sameAsk(o.ask, t)); if (same) same.times++; else out.push({ ...a, ask: t, times: 1 }); }
  return out;
}

/** The reflection's sections, in reading order, from {entries, asks, follow}. A section is { id, title, log, blocks }; blocks are
 * { t: 'quote', text, cite } | { t: 'slot', attr } | { t: 'sub', text } | { t: 'p', text, lead } | { t: 'note', text } | { t: 'list', cls, items } | { t: 'count', built, total } | { t: 'depth', counts } | { t: 'spark', velocity, friction };
 * a titled section may carry a count for its heading ("6 waiting", "30 of 70 asks"). now (ms) is the velocity's today; tests pass their own. */
export function selfSections(v, now = Date.now()) {
  const list = (v && Array.isArray(v.entries)) ? v.entries : [];
  const daily = list.find((e) => e.kind === 'daily'), build = list.find((e) => e.kind === 'build');
  const out = [];
  // the owner's redesign (2026-10-18, "its still ugly"): Verse's own paragraph is a quotation and the only thing open; everything else is a closed
  // block whose heading carries its count; how sure it is of its skills (the page's family bars) sits right under its words
  const voice = sentence((daily || build || {}).thoughts);
  out.push({ id: 'words', title: '', log: false, blocks: voice ? [{ t: 'quote', text: voice, cite: 'My own words, kept as I said them. The people who build me read them first.' }]
    : [{ t: 'note', text: 'My own words, kept as I said them. The people who build me read them first.' }] });
  out.push({ id: 'sure', title: '', log: false, blocks: [{ t: 'slot', attr: 'data-v-conf' }] });
  const grow = daily ? [['Weakest right now', 'weakest'], ['Next game I want to learn', 'next_game'], ["How I'd get better", 'better']].filter(([, k]) => sentence(daily[k])) : [];
  const late = [];
  if (grow.length) late.push({ id: 'growth', title: 'Weakest right now / Next game / How I\'d get better', log: false, blocks: grow.flatMap(([h, k]) => [{ t: 'sub', text: h }, { t: 'p', text: sentence(daily[k]) }]) });
  if (build) {
    const blocks = [];
    if (sentence(build.shipped)) blocks.push({ t: 'note', text: sentence(build.shipped) });
    if (daily) blocks.push({ t: 'p', text: sentence(build.thoughts) }); // without a daily entry these words are already the quotation above
    if (sentence(build.better)) blocks.push({ t: 'p', text: "What I'd add: " + sentence(build.better) });
    if (blocks.length) late.push({ id: 'shipped', title: 'On what just shipped', log: false, blocks });
  }
  const asks = foldAsks((v && v.asks) || []).slice(0, 12);
  if (asks.length) out.push({ id: 'asked', title: "What I've asked for", count: asks.length + ' waiting', log: false, blocks: [{ t: 'list', cls: 'v-asks', items: asks.map((a, i) => ({
    text: a.ask, open: i < FOLD, more: i >= FOLD, sub: 'Asked ' + (a.kind === 'daily' ? 'in my daily reflection' : 'after a build') + (a.at ? ', ' + day(a.at) : '') + (a.times > 1 ? ' · asked ' + a.times + ' times' : '') + (a.small ? ' · I called it small' : '') + ' · not built yet' })) }] });
  const f = v && v.follow;
  if (f && f.total) {
    const recent = Array.isArray(f.recent) ? f.recent : [];
    const blocks = [{ t: 'spark', velocity: velocity(f.asked, now), friction: friction(v.asks, now) }, { t: 'count', built: f.built, total: f.total }]; // the velocity first: this week at a glance (its friction over it), then the whole count
    if (recent.length) {
      blocks.push({ t: 'note', text: 'Most recently, my words and what was built:', tight: true });
      blocks.push({ t: 'depth', counts: [['all', 'All', recent.length], ['root', 'Root cause', recent.filter((r) => r.depth === 'root').length], ['surface', 'Surface', recent.filter((r) => r.depth === 'surface').length]] });
      blocks.push({ t: 'note', text: 'Root cause: a fix or a build that changed how I work underneath. Surface: something new on the stage.', tight: true });
      blocks.push({ t: 'list', cls: 'v-asks v-built', items: recent.map((r, i) => ({
        text: sentence(r.ask), depth: r.depth || '', more: i >= FOLD, open: false,
        sub: [r.at ? day(r.at) : '', r.times > 1 ? 'asked ' + r.times + ' times' : ''].filter(Boolean).join(' · '),
        detail: { ask: sentence(r.ask), what: sentence(r.what) || '(the ledger line is not in this view)', at: r.at ? day(r.at) : '', ref: /^https:\/\/github\.com\//.test(String(r.ref || '')) ? r.ref : '' } })) });
    }
    out.push({ id: 'built', title: 'What got built', count: f.built + ' of ' + f.total + ' asks', log: true, blocks });
  }
  return out.concat(late);
}

/** One section as markup. esc must escape text for HTML (the page's own). Every value is escaped here. */
export function sectionHtml(s, esc) {
  const body = s.blocks.map((b) => {
    if (b.t === 'quote') return '<blockquote class="vs-voice"><p>' + esc(b.text) + '</p>' + (b.cite ? '<footer class="sub vs-cite">' + esc(b.cite) + '</footer>' : '') + '</blockquote>';
    if (b.t === 'slot') return '<div ' + b.attr + '></div>';
    if (b.t === 'spark') return velocityHtml(b.velocity, esc, b.friction || null);
    if (b.t === 'sub') return '<h4 class="vs-h4">' + esc(b.text) + '</h4>';
    if (b.t === 'p') return '<p class="' + (b.lead ? 'vs-lead' : 'vs-p') + '">' + esc(b.text) + '</p>';
    if (b.t === 'note') return '<div class="sub vs-note"' + (b.tight ? ' data-tight="1"' : '') + '>' + esc(b.text) + '</div>';
    if (b.t === 'count') {
      const pct = Math.max(0, Math.min(100, Math.round(100 * b.built / b.total)));
      return '<div class="vs-count"><span class="v-num">' + esc(b.built) + '</span> <span class="vs-of">of my ' + esc(b.total) + ' asks</span></div>'
        + '<div class="v-bar" role="progressbar" aria-label="My asks that were built" aria-valuemin="0" aria-valuemax="' + esc(b.total) + '" aria-valuenow="' + esc(b.built) + '"><i style="width:' + pct + '%"></i></div>';
    }
    if (b.t === 'depth') return '<div class="v-depth" role="group" aria-label="Which builds to show">' + b.counts.map(([k, l, n], i) => '<button type="button" class="tr-copy" data-v-depth="' + k + '" aria-pressed="' + (i ? 'false' : 'true') + '">' + esc(l + ' · ' + n) + '</button>').join(' ') + '</div>';
    if (b.t === 'list') {
      const more = b.items.filter((it) => it.more).length, skip = (it) => (it.more ? ' data-share-skip="1"' : '');
      return '<ul class="' + esc(b.cls) + ' vs-list">' + b.items.map((it) => '<li data-bullet="1"' + (b.cls.includes('v-built') ? ' data-depth="' + esc(it.depth) + '"' : '') + (it.more ? ' data-more="1" hidden' : it.hidden ? ' hidden' : '') + '><details' + (it.open ? ' open' : '') + '><summary' + (it.more ? ' data-share-short="' + esc(shortLine(it.text)) + '"' : '') + '>' + esc(it.text) + '</summary>'
        + (it.detail ? '<div class="v-meta"' + skip(it) + '><b>I asked:</b> ' + esc(it.detail.ask) + '<br><b>What was built' + (it.detail.at ? ' (' + esc(it.detail.at) + ')' : '') + ':</b> ' + esc(it.detail.what) + (it.detail.ref ? ' <a href="' + esc(it.detail.ref) + '" rel="noopener">link</a>' : '') + '</div>' : '<div class="v-meta"' + skip(it) + '>' + esc(it.sub) + '</div>')
        + '</details>' + (it.detail && it.sub ? '<div class="vs-sub"' + skip(it) + '>' + esc(it.sub) + '</div>' : '') + '</li>').join('') + '</ul>'
        + (more ? '<button type="button" class="tr-copy vs-more" data-v-more aria-expanded="false" data-n="' + esc(b.items.length) + '">' + esc('show all ' + b.items.length) + '</button>' : '');
    }
    return '';
  }).join('');
  // a titled section is a collapsible block whose heading (with its count) is the toggle (owner, 2026-10-18): <details> keeps it keyboard accessible
  // with no script, and its text stays in the saved card whether it is open or not; every block starts closed, so Verse's own words are read first
  if (!s.title) return '<section class="vs-sec' + (s.log ? ' vs-log' : '') + '" data-sec="' + esc(s.id) + '">' + body + '</section>';
  return secOpen(s.id, s.title, esc, false, s.count, s.log) + body + '</details>';
}
/** a section heading: its title and, muted, its count ("6 waiting", "30 of 70 asks"). */
export const secHead = (title, esc, count = '') => '<h3 class="vs-h">' + esc(title) + (count ? ' <span class="vs-n">(' + esc(count) + ')</span>' : '') + '</h3>';
/** a titled collapsible block, opened (the page's own Correct me and Talk to me use it too); close it with '</details>'. */
export const secOpen = (id, title, esc, open = false, count = '', log = false) => '<details class="vs-sec' + (log ? ' vs-log' : '') + '" data-sec="' + esc(id) + '"' + (open ? ' open' : '') + '><summary class="vs-sum">' + secHead(title, esc, count) + '</summary>';
export const selfHtml = (sections, esc) => sections.map((s) => sectionHtml(s, esc)).join('');
