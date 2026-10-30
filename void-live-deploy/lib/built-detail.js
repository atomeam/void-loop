// What's built / improved, family by family (owner, 2026-10-21: "I need to see in better detail what is built or improved for everything
// in Verse"; "never vague categories: name the specific skill and exactly what changed"). Read from the ledger (void.growth.json) and the
// families (skills/families.json) only: an entry lands under every skill whose name its words or its "try" ask name, as whole words; an entry
// that names no skill is kept under "Across Verse". Nothing is invented: each line is the ledger's own words, its date, its kind and its PR.
import { depthOf } from './voice.js';

const esc0 = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// a line is filed under a skill only when it names that skill explicitly (owner, 2026-10-21: 'merge' got Monopoly and PR-merge lines, 'image'
// and 'part' were junk buckets): its phrases' skills, a skill file it names (skills/<id>.js), the line opening with the id ("forge: ...",
// "forge family"), "the <id> skill", or a hyphenated id as a whole word. Plain dictionary words are never matched loosely.
const escRe = (n) => String(n).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const reOf = (name) => { const n = escRe(name);
  return new RegExp((/-/.test(n) ? '(^|[^a-z0-9-])' + n + '(?![a-z0-9-])|' : '') + 'skills/' + n + '\\.js|^' + n + '(?::| family)|(^|[^a-z0-9-])(?:the )?' + n + ' skill\\b'); };
const KINDS = /^(?:fix|build|grow|retire|tune|polish)$/;
/** the PR number a ledger line names (its ref, or "(#123)" / "PR #123" in its words), or null. Pure. */
export function prOf(x) {
  const m = /#(\d{2,6})\b/.exec(String((x && x.ref) || '') + ' ' + String((x && x.what) || ''));
  return m ? +m[1] : null;
}
/** a ledger line is specific when it names what changed in words: at least 6 words and 30 characters, and not a bare count
 *  ("Sky and earth +1", "3 skills improved"). Pure. */
export function specific(what) {
  const s = String(what || '').trim();
  if (s.length < 30 || s.split(/\s+/).length < 6) return false;
  if (/^[\w\s&]+[+-]\d+\s*$/.test(s) || /^\d+\s+(skills?|asks?|things?|items?)\s+(built|improved|added|fixed)\.?$/i.test(s)) return false;
  return true;
}
/** { families: [{ id, name, skills: [{ name, items }] , n }], across: items, total }: items newest first, each { at, day, kind, depth, what, show, pr }. Pure. */
export function builtByFamily(ledger, fam, limit = 40) {
  const L = (Array.isArray(ledger) ? ledger : []).filter((x) => x && typeof x.what === 'string' && x.what.trim() && KINDS.test(String(x.kind || '')))
    .slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const F = fam && Array.isArray(fam.families) ? fam.families : [];
  const skills = F.flatMap((f) => (f.skills || []).filter((s) => s && s.name && String(s.name).length > 2).map((s) => ({ fam: f, name: String(s.name), re: reOf(s.name) })));
  // a hardening line with its phrases reads as the phrases themselves; under a skill, only the phrases that open that skill (the whole
  // batch under every skill it named read as nine copies of one line: owner's self-card screenshot, 2026-10-24)
  const words = (x, only) => { const ps = Array.isArray(x.phrases) ? x.phrases.filter((p) => !only || p.skill === only) : [];
    return ps.length ? 'New phrases: ' + ps.map((p) => '\u201c' + p.ask + '\u201d now opens ' + p.skill).join('; ') : x.what.trim(); };
  const item = (x, only) => ({ at: x.at, day: String(x.at || '').slice(0, 10), kind: x.kind, depth: depthOf(x.kind), what: words(x, only), show: x.show || '', pr: prOf(x) });
  const by = new Map(), across = [];
  for (const x of L) {
    const text = x.what.toLowerCase(), named = new Set((Array.isArray(x.phrases) ? x.phrases : []).map((p) => p.skill));
    const hit = named.size ? skills.filter((s) => named.has(s.name)) : skills.filter((s) => s.re.test(text));
    if (!hit.length) { across.push(item(x)); continue; }
    // one change is listed once under its skill: two hardening runs that started before either merged both logged the same phrases
    // (owner's review, 2026-10-30: converter, rap, uuid and team-chat each showed one "New phrases" line twice on 2026-10-29); the newest stays
    for (const s of hit) { const k = s.fam.id + '|' + s.name; if (!by.has(k)) by.set(k, { fam: s.fam, name: s.name, items: [] }); const it = item(x, s.name); if (!by.get(k).items.some((o) => o.what === it.what)) by.get(k).items.push(it); }
  }
  const families = F.map((f) => {
    const sk = [...by.values()].filter((v) => v.fam === f).map((v) => ({ name: v.name, items: v.items.slice(0, limit) }))
      .sort((a, b) => String(b.items[0].at).localeCompare(String(a.items[0].at)));
    return { id: f.id, name: f.name, skills: sk, n: sk.reduce((k, s) => k + s.items.length, 0) };
  }).filter((f) => f.n);
  return { families, across: across.slice(0, limit), total: L.length };
}
const REPO = 'https://github.com/atomeam/void-loop/pull/';
const line = (it, esc) => '<li data-depth="' + esc(it.depth || '') + '"><b>' + esc(it.day) + '</b> · ' + esc(it.depth === 'root' ? 'root cause' : it.depth === 'surface' ? 'surface' : it.kind)
  + ' · ' + esc(it.what) + (it.show ? ' <span class="vs-n">(' + esc(it.show) + ')</span>' : '') + (it.pr ? ' · <a href="' + REPO + it.pr + '" target="_blank" rel="noopener">PR #' + it.pr + '</a>' : '') + '</li>';
/** the section's HTML: one block per family, one heading per skill, every line whole (no cut words). Pure. */
export function builtDetailHtml(r, esc = esc0) {
  if (!r || (!r.families.length && !r.across.length)) return '';
  let h = '<details class="vs-sec" data-sec="built-detail"><summary class="vs-sum"><h3 class="vs-h">What\'s built and improved, skill by skill <span class="vs-n">' + esc(r.total) + ' ledger lines</span></h3></summary>';
  for (const f of r.families) {
    h += '<details class="vs-sec vs-fam"><summary class="vs-sum"><h4 class="vs-h4">' + esc(f.name) + ' <span class="vs-n">' + esc(f.n) + '</span></h4></summary>';
    for (const s of f.skills) h += '<div class="vs-skill"><div class="vs-h4">' + esc(s.name) + '</div><ul class="vs-list vs-detail">' + s.items.map((it) => line(it, esc)).join('') + '</ul></div>';
    h += '</details>';
  }
  if (r.across.length) h += '<details class="vs-sec vs-fam"><summary class="vs-sum"><h4 class="vs-h4">Across Verse <span class="vs-n">' + esc(r.across.length) + '</span></h4></summary><ul class="vs-list vs-detail">' + r.across.map((it) => line(it, esc)).join('') + '</ul></details>';
  return h + '<div class="src">Source: void.growth.json (the ledger) and skills/families.json; each line is the ledger\'s own words.</div></details>';
}
