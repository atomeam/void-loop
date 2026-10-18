// The self card ("What I think of myself") as structured blocks, then as markup (asked by the owner's review, 2026-10-18: the card read as a wall of text).
// selfSections(v) turns /api/reflect into sections: V01D's own words (a reflection: normal reading font) and the changelog (what got built: monospace).
// selfHtml(sections, esc) draws them: real headings, one list item per ask with its dates as a muted second line, a blank gap between paragraphs.
// Pure: no DOM, no network. The page (void.html showVoice) mounts the result and wires the Root cause / Surface buttons.

const day = (t) => String(t || '').slice(0, 10);
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

/** The reflection's sections, in reading order, from {entries, asks, follow}. A section is { id, title, log, blocks }; blocks are
 * { t: 'quote', text, cite } | { t: 'slot', attr } | { t: 'sub', text } | { t: 'p', text, lead } | { t: 'note', text } | { t: 'list', cls, items } | { t: 'count', built, total } | { t: 'depth', counts };
 * a titled section may carry a count for its heading ("6 waiting", "30 of 70 asks"). */
export function selfSections(v) {
  const list = (v && Array.isArray(v.entries)) ? v.entries : [];
  const daily = list.find((e) => e.kind === 'daily'), build = list.find((e) => e.kind === 'build');
  const out = [];
  // the owner's redesign (2026-10-18, "its still ugly"): V01D's own paragraph is a quotation and the only thing open; everything else is a closed
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
  const asks = ((v && v.asks) || []).slice(0, 12);
  if (asks.length) out.push({ id: 'asked', title: "What I've asked for", count: asks.length + ' waiting', log: false, blocks: [{ t: 'list', cls: 'v-asks', items: asks.map((a, i) => ({
    text: sentence(a.ask), open: i < FOLD, more: i >= FOLD, sub: 'Asked ' + (a.kind === 'daily' ? 'in my daily reflection' : 'after a build') + (a.at ? ', ' + day(a.at) : '') + (a.small ? ' · I called it small' : '') + ' · not built yet' })) }] });
  const f = v && v.follow;
  if (f && f.total) {
    const recent = Array.isArray(f.recent) ? f.recent : [];
    const blocks = [{ t: 'count', built: f.built, total: f.total }];
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
  // with no script, and its text stays in the saved card whether it is open or not; every block starts closed, so V01D's own words are read first
  if (!s.title) return '<section class="vs-sec' + (s.log ? ' vs-log' : '') + '" data-sec="' + esc(s.id) + '">' + body + '</section>';
  return secOpen(s.id, s.title, esc, false, s.count, s.log) + body + '</details>';
}
/** a section heading: its title and, muted, its count ("6 waiting", "30 of 70 asks"). */
export const secHead = (title, esc, count = '') => '<h3 class="vs-h">' + esc(title) + (count ? ' <span class="vs-n">(' + esc(count) + ')</span>' : '') + '</h3>';
/** a titled collapsible block, opened (the page's own Correct me and Talk to me use it too); close it with '</details>'. */
export const secOpen = (id, title, esc, open = false, count = '', log = false) => '<details class="vs-sec' + (log ? ' vs-log' : '') + '" data-sec="' + esc(id) + '"' + (open ? ' open' : '') + '><summary class="vs-sum">' + secHead(title, esc, count) + '</summary>';
export const selfHtml = (sections, esc) => sections.map((s) => sectionHtml(s, esc)).join('');
