// The self card ("What I think of myself") as structured blocks, then as markup (asked by the owner's review, 2026-10-18: the card read as a wall of text).
// selfSections(v) turns /api/reflect into sections: V01D's own words (a reflection: normal reading font) and the changelog (what got built: monospace).
// selfHtml(sections, esc) draws them: real headings, one list item per ask with its dates as a muted second line, a blank gap between paragraphs.
// Pure: no DOM, no network. The page (void.html showVoice) mounts the result and wires the Root cause / Surface buttons.

const day = (t) => String(t || '').slice(0, 10);
const sentence = (s) => String(s == null ? '' : s).trim();

/** The reflection's sections, in reading order, from {entries, asks, follow}. A section is { id, title, log, blocks }; blocks are
 * { t: 'p', text, lead } | { t: 'note', text } | { t: 'list', cls, items } | { t: 'count', built, total } | { t: 'depth', counts }. */
export function selfSections(v) {
  const list = (v && Array.isArray(v.entries)) ? v.entries : [];
  const daily = list.find((e) => e.kind === 'daily'), build = list.find((e) => e.kind === 'build');
  const out = [];
  if (daily) {
    const intro = [{ t: 'note', text: 'My own words, kept as I said them. The people who build me read them first.' }, { t: 'p', text: sentence(daily.thoughts), lead: true }];
    out.push({ id: 'words', title: '', log: false, blocks: intro });
    for (const [id, title, key] of [['weakest', 'Weakest right now', 'weakest'], ['next', 'Next game I want to learn', 'next_game'], ['better', "How I'd get better", 'better']])
      if (sentence(daily[key])) out.push({ id, title, log: false, blocks: [{ t: 'p', text: sentence(daily[key]) }] });
  } else out.push({ id: 'words', title: '', log: false, blocks: [{ t: 'note', text: 'My own words, kept as I said them. The people who build me read them first.' }] });
  if (build) {
    const blocks = [];
    if (sentence(build.shipped)) blocks.push({ t: 'note', text: sentence(build.shipped) });
    blocks.push({ t: 'p', text: sentence(build.thoughts) });
    if (sentence(build.better)) blocks.push({ t: 'p', text: "What I'd add: " + sentence(build.better) });
    out.push({ id: 'shipped', title: 'On what just shipped', log: false, blocks });
  }
  const asks = ((v && v.asks) || []).slice(0, 4);
  if (asks.length) out.push({ id: 'asked', title: "What I've asked for", log: false, blocks: [{ t: 'list', cls: 'v-asks', items: asks.map((a) => ({
    text: sentence(a.ask), open: true, sub: 'Asked ' + (a.kind === 'daily' ? 'in my daily reflection' : 'after a build') + (a.at ? ', ' + day(a.at) : '') + (a.small ? ' · I called it small' : '') + ' · not built yet' })) }] });
  const f = v && v.follow;
  if (f && f.total) {
    const recent = Array.isArray(f.recent) ? f.recent : [];
    const blocks = [{ t: 'count', built: f.built, total: f.total }];
    if (recent.length) {
      blocks.push({ t: 'note', text: 'Most recently, my words and what was built:', tight: true });
      blocks.push({ t: 'depth', counts: [['all', 'All', recent.length], ['root', 'Root cause', recent.filter((r) => r.depth === 'root').length], ['surface', 'Surface', recent.filter((r) => r.depth === 'surface').length]] });
      blocks.push({ t: 'note', text: 'Root cause: a fix or a build that changed how I work underneath. Surface: something new on the stage.', tight: true });
      blocks.push({ t: 'list', cls: 'v-asks v-built', items: recent.map((r, i) => ({
        text: sentence(r.ask), depth: r.depth || '', hidden: i >= 6, open: false,
        sub: [r.at ? day(r.at) : '', r.times > 1 ? 'asked ' + r.times + ' times' : ''].filter(Boolean).join(' · '),
        detail: { ask: sentence(r.ask), what: sentence(r.what) || '(the ledger line is not in this view)', at: r.at ? day(r.at) : '', ref: /^https:\/\/github\.com\//.test(String(r.ref || '')) ? r.ref : '' } })) });
    }
    out.push({ id: 'built', title: 'What got built', log: true, blocks });
  }
  return out;
}

/** One section as markup. esc must escape text for HTML (the page's own). Every value is escaped here. */
export function sectionHtml(s, esc) {
  const body = s.blocks.map((b) => {
    if (b.t === 'p') return '<p class="' + (b.lead ? 'vs-lead' : 'vs-p') + '">' + esc(b.text) + '</p>';
    if (b.t === 'note') return '<div class="sub vs-note"' + (b.tight ? ' data-tight="1"' : '') + '>' + esc(b.text) + '</div>';
    if (b.t === 'count') {
      const pct = Math.max(0, Math.min(100, Math.round(100 * b.built / b.total)));
      return '<div class="vs-count"><span class="v-num">' + esc(b.built) + '</span> <span class="vs-of">of my ' + esc(b.total) + ' asks</span></div>'
        + '<div class="v-bar" role="progressbar" aria-label="My asks that were built" aria-valuemin="0" aria-valuemax="' + esc(b.total) + '" aria-valuenow="' + esc(b.built) + '"><i style="width:' + pct + '%"></i></div>';
    }
    if (b.t === 'depth') return '<div class="v-depth" role="group" aria-label="Which builds to show">' + b.counts.map(([k, l, n], i) => '<button type="button" class="tr-copy" data-v-depth="' + k + '" aria-pressed="' + (i ? 'false' : 'true') + '">' + esc(l + ' · ' + n) + '</button>').join(' ') + '</div>';
    if (b.t === 'list') return '<ul class="' + esc(b.cls) + ' vs-list">' + b.items.map((it) => '<li data-bullet="1"' + (b.cls.includes('v-built') ? ' data-depth="' + esc(it.depth) + '"' : '') + (it.hidden ? ' hidden' : '') + '><details' + (it.open ? ' open' : '') + '><summary>' + esc(it.text) + '</summary>'
      + (it.detail ? '<div class="v-meta"><b>I asked:</b> ' + esc(it.detail.ask) + '<br><b>What was built' + (it.detail.at ? ' (' + esc(it.detail.at) + ')' : '') + ':</b> ' + esc(it.detail.what) + (it.detail.ref ? ' <a href="' + esc(it.detail.ref) + '" rel="noopener">link</a>' : '') + '</div>' : '<div class="v-meta">' + esc(it.sub) + '</div>')
      + '</details>' + (it.detail && it.sub ? '<div class="vs-sub">' + esc(it.sub) + '</div>' : '') + '</li>').join('') + '</ul>';
    return '';
  }).join('');
  return '<section class="vs-sec' + (s.log ? ' vs-log' : '') + '" data-sec="' + esc(s.id) + '">' + (s.title ? '<h3 class="vs-h">' + esc(s.title) + '</h3>' : '') + body + '</section>';
}
export const selfHtml = (sections, esc) => sections.map((s) => sectionHtml(s, esc)).join('');
