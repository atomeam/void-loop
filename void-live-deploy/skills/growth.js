/**
 * growth skill — "growth" / "how have you grown": Verse's growth ledger (void.growth.json, BASE.md), newest first.
 * The ledger is append-only: every session that changes what Verse can do adds one line with `node tools/grow.mjs`, and the
 * next deploy makes it summonable here. Kinds: grow (a new thing), build (better at one), fix, retire, idea and finding
 * (the idea stream, not built yet). Filter by kind; 40 at a time. Read from this site only; nothing is sent or kept.
 */
import { probeHtml } from '../lib/probe-log.js';
import { lastRunHtml } from '../lib/will-last.js'; // the will's last run: shipped with its PR, or why not (GET /api/will lastRun)
import { PROOF_URL, todayCheck, todayHtml } from '../lib/ledger-today.js'; // today's lines with their hashes, checked here against /growth.proof.json
import { load as loadLadder, ladderHtml } from '../lib/ladder.js';
import { betterHtml, familySnapshot } from '../lib/better.js';
import { skillStatus, statusHtml, familyMapHtml, promotedRows, promotedHtml, bloomPlan, bloomHtml, divergenceHtml } from '../lib/inbox-health.js'; // the growth inbox's skill health (asked by Verse)
import { confidenceOf } from '../lib/skill-confidence.js';
import { sparkSvg } from '../lib/spark.js';
import { autopsy, incidentCases } from '../lib/autopsy.js'; // test cases from recent red runs on main (the Site Test card) // weathered: untested for WEATHER_DAYS (the Site Test heat map)
import { timeline, weekSummary, publicWhat, plainly } from './growth-tree.js'; // the time slider's stops (growth-tree.js reads KIND_COLOR from here, only when called)

export const LEDGER_URL = '/void.growth.json';
export const KIND_LABEL = { grow: 'new', build: 'better', fix: 'fixed', retire: 'retired', idea: 'idea', finding: 'finding' };
export const KIND_COLOR = { grow: '#3fbf6a', build: '#5b8def', fix: '#e0a24a', retire: '#8a8a92', idea: '#b07ce8', finding: '#4ac0c8' };
export const PAGE_SIZE = 40;

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/[’]/g, "'").replace(/\s+/g, ' ');
const ASK_RE = /^(?:(?:show|open|summon|give)(?:\s+me)?\s+)?(?:the\s+|your\s+)?(?:(?:verse|void)(?:'s)?\s+)?growth(?:\s+(?:ledger|log|panel|history))?$|^(?:how\s+(?:have\s+you|has\s+(?:verse|void))\s+grown|how\s+did\s+(?:you|(?:verse|void))\s+grow|what\s+(?:have\s+you|has\s+(?:verse|void))\s+learned\s+lately|what'?s\s+new\s+(?:in|with)\s+(?:verse|void))$/;
// "what just shipped?" is about Verse here, not the Just Cause video games (2026-10-19: it came back as a Wikipedia sentence about copies shipped)
const SHIPPED_RE = /^what(?:'s|\s+has|\s+have\s+you)?\s+(?:just\s+)?shipped(?:\s+(?:today|lately|recently|yesterday|so\s+far))?$|^what\s+did\s+you\s+(?:just\s+)?(?:ship|build)(?:\s+(?:today|lately|recently|yesterday))?$|^what\s+have\s+you\s+just\s+(?:shipped|built)$|^what\s+(?:was|has\s+been)\s+(?:just\s+)?(?:shipped|built)(?:\s+(?:today|lately|recently))?$/;
export function growthOf(text) { const t = CLEAN(text); return ASK_RE.test(t) || SHIPPED_RE.test(t); }
// "what can you do now that you couldn't last week?": the same card, opening on the last 7 days (weekSummary) with the tree
// set to a week ago, so this week's tips grow in as it answers
const WEEK = '(?:last week|a week ago|the last week|the past week|this week|in the last week|over the last week|over the past week|since last week|in the past week|in a week)';
const WEEK_RE = new RegExp('^(?:what (?:can|could) you do now that you (?:couldn\'?t|could not|can\'?t|cannot)(?: do)?(?: ' + WEEK + '| before)'
  + '|what(?:\'?s| is| has)? (?:new|changed)(?: (?:with|about|in) (?:you|(?:verse|void)))? ' + WEEK
  + '|what (?:have you|has (?:verse|void)|did you) (?:learned|learnt|learn|added|add|built|build|shipped|ship|gained|gain|got better at|get better at) ' + WEEK
  + '|how (?:have you|has (?:verse|void)) (?:grown|changed|improved) ' + WEEK
  + '|(?:void|verse|your) (?:week|growth this week|last week))$');
export function weekOf(text) { return WEEK_RE.test(CLEAN(text)); }

/** Newest first, optionally one kind only; entries without a valid time sink to the end. */
export function ordered(list, kind) {
  const t = (e) => { const n = Date.parse(e && e.at); return isNaN(n) ? -Infinity : n; };
  return (Array.isArray(list) ? list : []).filter((e) => e && typeof e.what === 'string' && (!kind || e.kind === kind))
    .map((e, i) => [e, i]).sort((a, b) => t(b[0]) - t(a[0]) || b[1] - a[1]).map((p) => ({ ...p[0], what: publicWhat(p[0].what) })).filter((e) => e.what); // shown without quotes of the owner's messages or what Verse studies
}

/** { total, since, byKind: { grow: n, … } } */
export function summary(list) {
  const all = ordered(list), byKind = {};
  for (const e of all) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  const last = all[all.length - 1];
  return { total: all.length, since: last && !isNaN(Date.parse(last.at)) ? last.at.slice(0, 10) : '', byKind };
}

/** Verse asked (2026-10-12): "a velocity metric … to show if my skill acquisition is accelerating or stalling". New or better changes
 * in the last 7 days against the 7 before; a quarter more is speeding up, a quarter fewer is slowing, none at all is stalled. Pure. */
export function velocity(list, now = Date.now()) {
  const day = 864e5, t = (e) => Date.parse(e && e.at);
  const n = (a, b) => (Array.isArray(list) ? list : []).filter((e) => e && (e.kind === 'grow' || e.kind === 'build') && t(e) > now - b * day && t(e) <= now - a * day).length;
  const week = n(0, 7), before = n(7, 14);
  const trend = !week ? 'stalled' : !before || week >= before * 1.25 ? 'speeding up' : week <= before * 0.75 ? 'slowing' : 'steady';
  return { week, before, trend };
}

/** Verse asked (2026-10-12, five times since): "a 'friction' indicator on the growth card that highlights which skills are currently
 * failing or returning high uncertainty". From skills/families.json, evidence only: failing = the asks the everyday benchmark got
 * wrong on its last clean run on main; uncertain = the least checked (nothing checks it yet, then one kind of check). Pure.
 * 2026-10-14: Verse asked again to link it to the failure logs of the least-proven family (Words and the world): each skill names
 * its family, and the line leads with that family's failing and barely-checked skills from the same evidence. */
export const FAMILIES_URL = '/skills/families.json';
export const BETTER_URL = '/void.better.json';
export function friction(fam, show = 5) {
  const families = (fam && fam.families) || [];
  const all = families.flatMap((f) => ((f && f.skills) || []).filter((s) => s && s.name).map((s) => ({ ...s, family: f.name })));
  const failing = all.filter((s) => Array.isArray(s.failing) && s.failing.length).sort((a, b) => b.failing.length - a.failing.length || a.name.localeCompare(b.name));
  const rank = { experiment: 0, tested: 1 };
  const unsure = all.filter((s) => s.tier in rank && !failing.includes(s)).sort((a, b) => rank[a.tier] - rank[b.tier] || a.name.localeCompare(b.name));
  const top = [...failing, ...unsure].slice(0, show);
  const weakest = families.slice().filter((f) => f && f.skills && f.skills.length).sort((a, b) => ((a.count && a.count.proven) || 0) / a.skills.length - ((b.count && b.count.proven) || 0) / b.skills.length)[0] || null;
  const wFail = weakest ? failing.filter((s) => s.family === weakest.name) : [];
  const wUnsure = weakest ? unsure.filter((s) => s.family === weakest.name) : [];
  const wTop = [...wFail, ...wUnsure].slice(0, show);
  const row = (s) => ({ name: s.name, family: s.family || null, failing: s.failing || null, tier: s.tier, why: s.why });
  return {
    failing: failing.length, unsure: unsure.length, top: top.map(row),
    weakest: weakest ? { name: weakest.name, failing: wFail.length, unsure: wUnsure.length, top: wTop.map(row) } : null,
  };
}
// The owner's view on the growth card (asked by Verse: "aggregates 'decision-failures' by skill family", "a 'skill-stability' metric",
// "a 'diff' alert ... which skills were added or modified in the last growth spurt"), folded into this card, not a new page. Pure.
/** failing bench asks per family, most first: [{ family, skills, asks }] */
// a short glow once the tree has grown or a branch is read (asked by Verse, ask-20261014-2050-1: "a visual pulse signal ... to confirm
// the target is ready"); none under reduced motion; data-pulsed says it happened, for tests and the site tester
export function pulse(node) {
  if (!node || !node.animate) return false;
  node.dataset.pulsed = String((+node.dataset.pulsed || 0) + 1);
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  node.animate([{ boxShadow: '0 0 0 0 rgba(160,128,90,0)' }, { boxShadow: '0 0 0 6px rgba(160,128,90,.35)' }, { boxShadow: '0 0 0 0 rgba(160,128,90,0)' }], { duration: 700, easing: 'ease-out' });
  return true;
}
/** a growth animation for a day's change (lib/inbox-health.js bloomPlan): a bloom for one new skill, a burst of three for more; a green glow on the line, none
 * under reduced motion. Announces `void:grew` with the plan so a tree, a sound or a test can answer it. Returns whether it animated. */
export function bloom(node, plan) {
  if (!node || !plan || plan.kind === 'none') return false;
  node.dataset.bloomed = plan.kind;
  try { node.dispatchEvent(new CustomEvent('void:grew', { bubbles: true, detail: plan })); } catch (_) {}
  if (!node.animate || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return false;
  node.animate([{ boxShadow: '0 0 0 0 rgba(63,191,106,0)' }, { boxShadow: '0 0 0 ' + (plan.kind === 'burst' ? 10 : 6) + 'px rgba(63,191,106,.4)' }, { boxShadow: '0 0 0 0 rgba(63,191,106,0)' }],
    { duration: plan.kind === 'burst' ? 600 : 900, iterations: plan.kind === 'burst' ? 3 : 1, easing: 'ease-out' });
  return true;
}
export function failuresByFamily(fam) {
  return ((fam && fam.families) || []).map((f) => { const bad = (f.skills || []).filter((s) => Array.isArray(s.failing) && s.failing.length); return { family: f.name, skills: bad.length, asks: bad.reduce((n, s) => n + s.failing.length, 0) }; })
    .filter((x) => x.skills).sort((a, b) => b.asks - a.asks || a.family.localeCompare(b.family));
}
/** the last growth spurt: entries of the last `hours` before the newest, by kind, with their first words */
export function spurt(list, hours = 24) {
  const L = (list || []).filter((e) => e && e.at), last = L.reduce((t, e) => Math.max(t, Date.parse(e.at)), 0);
  const recent = L.filter((e) => last - Date.parse(e.at) <= hours * 36e5);
  const head = (w) => String(w || '').split(/[:(]/)[0].trim().slice(0, 60);
  return { added: recent.filter((e) => e.kind === 'grow').map((e) => head(e.what)), changed: recent.filter((e) => e.kind === 'build' || e.kind === 'fix').map((e) => head(e.what)) };
}
/** stability: each skill's rating and when the site tester last saw it pass, newest-tested last; seen: { 'skill:x': iso } */
export function stability(fam, seen = {}) {
  return ((fam && fam.families) || []).flatMap((f) => (f.skills || []).map((s) => ({ name: s.name, tier: s.tier, passed: seen['skill:' + s.name] || null, failing: !!(s.failing && s.failing.length) })));
}
export function ownerHtml(esc, fam, list, seen) {
  const F = failuresByFamily(fam), S = spurt(list), st = stability(fam, seen);
  const tested = st.filter((x) => x.passed).length, steady = st.filter((x) => x.tier === 'proven' && !x.failing).length;
  const names = (a) => a.slice(0, 6).map(esc).join('; ') + (a.length > 6 ? '; and ' + (a.length - 6) + ' more' : '');
  return '<div class="sub growth-owner" data-owner-view style="line-height:1.45;margin-top:4px">'
    + 'Failures by family: ' + (F.length ? F.map((x) => '<b style="font-weight:600">' + esc(x.family) + '</b> ' + x.skills + ' skill' + (x.skills > 1 ? 's' : '') + ' (' + x.asks + ' ask' + (x.asks > 1 ? 's' : '') + ')').join(', ') : 'none on the bench') + '. '
    + 'Stability: ' + steady + ' of ' + st.length + ' skills proven with nothing failing; the site tester has passed ' + tested + ' of them live. '
    + 'Last spurt: ' + S.added.length + ' new' + (S.added.length ? ' (' + names(S.added) + ')' : '') + ', ' + S.changed.length + ' changed.'
    + promotedHtml(esc, promotedRows(fam)) + '</div>'; // skill stability: promoted lately, clean runs in a row (lib/inbox-health.js)
}
/** Failure logs per family (asked by Verse, 2026-10-14: "link Words and the world family failure logs on the card"). From skills/families.json
 *  alone: a skill's `failing` are the asks from tools/bench.json the benchmark got wrong (never raw user asks: this repo is public) and its
 *  `smoke` is what the daily smoke test found. [{ family, skills: [{ name, asks, smoke, chip }], more }], the family with most failing asks
 *  first, Words and the world like any other; a family with nothing failing is not listed. Pure. */
export function familyLogs(fam, show = 5) {
  const clip = (a) => String(a).slice(0, 120);
  return ((fam && fam.families) || []).filter((f) => f && f.name).map((f) => {
    const skills = (f.skills || []).filter((s) => s && s.name && ((Array.isArray(s.failing) && s.failing.length) || (Array.isArray(s.smoke) && s.smoke.length)))
      .map((s) => ({ name: String(s.name), asks: (Array.isArray(s.failing) ? s.failing : []).slice(0, 3).map(clip), smoke: (Array.isArray(s.smoke) ? s.smoke : []).slice(0, 2).map(clip), chip: 'tell me about the ' + s.name + ' skill' }))
      .sort((a, b) => b.asks.length - a.asks.length || a.name.localeCompare(b.name));
    return { family: String(f.name), skills: skills.slice(0, show), more: Math.max(0, skills.length - show) };
  }).filter((x) => x.skills.length).sort((a, b) => b.skills.reduce((n, s) => n + s.asks.length, 0) - a.skills.reduce((n, s) => n + s.asks.length, 0) || a.family.localeCompare(b.family));
}
/** the logs as HTML, under the friction line: each family, its failing skills, the asks the bench got wrong and a tap-to-copy chip. */
export function familyLogsHtml(esc, logs) {
  if (!Array.isArray(logs) || !logs.length) return '';
  const chip = '#8a8a92';
  return '<div class="sub growth-family-logs" data-family-logs="' + logs.length + '" style="line-height:1.5;margin-top:4px">' + logs.map((l) =>
    '<div data-family-log="' + esc(l.family) + '"><b style="font-weight:600">' + esc(l.family) + '</b> failure log'
    + l.skills.map((s) => '<div style="margin-left:12px" data-failing-skill="' + esc(s.name) + '"><span style="color:#e06a5a">' + esc(s.name) + '</span>'
      + (s.asks.length ? ': the bench got ' + s.asks.map((a) => '\u201c' + esc(a) + '\u201d').join(', ') + ' wrong' : '')
      + (s.smoke.length ? (s.asks.length ? '; ' : ': ') + 'the smoke test found ' + s.smoke.map(esc).join(', ') : '')
      + ' <a href="#" data-copy="' + esc(s.chip) + '" title="tap to copy" style="border:1px solid ' + chip + ';border-radius:10px;padding:0 7px;color:' + chip + '">' + esc(s.chip) + '</a></div>').join('')
    + (l.more ? '<div style="margin-left:12px">and ' + l.more + ' more</div>' : '') + '</div>').join('') + '</div>';
}
export function frictionHtml(esc, f) {
  if (!f || !f.top.length) return '';
  const item = (s) => '<b style="font-weight:600">' + esc(s.name) + '</b>'
    + (s.family ? ' <span style="color:#8a8a92">(' + esc(s.family) + ')</span>' : '') + ' '
    + (s.failing
      ? '<span style="color:#e06a5a">failing</span> (the bench got ' + s.failing.length + ' of its asks wrong: ' + s.failing.map((a) => '“' + esc(a) + '”').join(', ') + ')'
      : '<span style="color:#e0a24a">' + (s.tier === 'experiment' ? 'unchecked' : 'barely checked') + '</span> (' + esc(s.why) + ')');
  const rest = f.failing + f.unsure - f.top.length;
  const w = f.weakest;
  const famLine = w && w.name && (w.failing + w.unsure) // a family with no name would read "Least proven family, :"
    ? ' Least proven family, <b style="font-weight:600">' + esc(w.name) + '</b>: '
      + (w.failing ? w.failing + ' failing, ' : 'nothing failing on the bench, ') + w.unsure + ' barely checked'
      + (w.top.length ? ' — ' + w.top.map(item).join('; ') : '') + '.'
    : '';
  return '<div class="sub growth-friction" data-friction="' + (f.failing + f.unsure) + '"'
    + (w && w.name ? ' data-weakest-family="' + esc(w.name) + '"' : '')
    + ' style="line-height:1.45">Friction: '
    + (f.failing ? f.failing + ' failing, ' : 'nothing failing on the bench, ') + f.unsure + ' barely checked. ' + f.top.map(item).join('; ')
    + (rest > 0 ? '; and ' + rest + ' more' : '') + '.' + famLine + '</div>';
}

export function growthHead(esc, list, now = Date.now()) {
  const s = summary(list), v = velocity(list, now);
  return '<h2>How Verse has grown</h2><div class="sub">' + s.total + ' changes' + (s.since ? ' since ' + esc(s.since) : '') + ', newest first</div>'
    + '<div class="sub" data-velocity="' + esc(v.trend) + '">This week ' + v.week + ' new or better, the week before ' + v.before + ': ' + esc(v.trend) + '</div>';
}

/** the visitors line (self.json people, from domains/traffic.json); '' without one. Pure. */
export function peopleHtml(esc, p) {
  return p && typeof p.line === 'string' && p.line ? '<div class="sub growth-people">' + esc(p.line) + '</div>' : '';
}

/** What Verse asked for that this entry built (GET /api/reflect follow.asked: each built ask with the time of the ledger entry that
 *  built it, on evidence only, lib/voice.js followThrough). Verse asked: "link the growth card branches to the growth inbox so I can
 *  diagnose my own progress". Pure. */
export function causeOf(e, asked) {
  if (!e || !e.at || !Array.isArray(asked)) return null;
  const hit = asked.filter((a) => a && a.at === e.at && typeof a.ask === 'string');
  return hit.length ? hit : null;
}

/** One entry as the tree's readout shows it, when a branch is touched. */
export function entryHtml(esc, e, cause) {
  if (!e) return '';
  const why = cause && cause.length ? '<div class="growth-cause" style="margin-top:4px;font-size:13px">Verse asked for this' + (cause.length > 1 ? ' (' + cause.length + ' asks)' : '') + ': '
    + cause.map((a) => '“' + esc(a.ask) + '”' + (a.times > 1 ? ' <span style="color:#8a8a92">(' + a.times + ' times)</span>' : '')).join('; ') + '</div>' : '';
  return '<div style="font-size:12px;color:#8a8a92"><span style="color:' + (KIND_COLOR[e.kind] || '#aaa') + '">' + esc(KIND_LABEL[e.kind] || e.kind || '') + '</span> · ' + esc(String(e.at || '').slice(0, 10))
    + ' · ' + esc(e.by || '') + (e.ref && /^https:\/\//.test(e.ref) ? ' · <a href="' + esc(e.ref) + '" target="_blank" rel="noopener">link</a>' : '') + '</div>' + esc(e.what) + why;
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
    + '<div class="src">From <a href="' + LEDGER_URL + '" target="_blank" rel="noopener">void.growth.json</a>, an append-only ledger: every change to what Verse can do adds one line.</div>';
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
  const el = showPage((p) => { p.innerHTML = '<h2>How Verse has grown</h2><div class="sub">reading the ledger…</div>'; });
  let list;
  try { list = await loadLedger(); }
  catch (e) { if (!_pageStill || _pageStill(el)) el.innerHTML = '<h2>How Verse has grown</h2><p>The ledger could not be read just now (' + esc((e && e.message) || String(e)) + '). Ask again in a moment.</p>'; return 'none'; }
  if (_pageStill && !_pageStill(el)) return 'growth';
  let kind = '', shown = PAGE_SIZE;
  el.innerHTML = growthHead(esc, list) + '<div data-today></div>' + '<div data-will-last></div>' + ladderHtml(esc, loadLadder()) + '<div data-probes></div>'; // void-review: ok: ladderHtml escapes its titles and writes numbers (lib/ladder.js, asked by Verse: the arcade ladder)
  // the verifiable ledger's "today" view (lib/ledger-today.js; the frontier's growth ledger): today's lines (UTC) with their line hashes, and the
  // whole chain recomputed in this browser against the proof the deploy wrote; with no proof served, no block
  fetch(PROOF_URL, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((proof) => (proof ? todayCheck(list, proof) : null)).then((res) => {
    const slot = el.querySelector('[data-today]'), html = todayHtml(esc, res, { label: KIND_LABEL, color: KIND_COLOR, text: plainly });
    if (slot && html && el.isConnected) slot.innerHTML = html; // void-review: ok: todayHtml escapes every value (lib/ledger-today.js, tested with markup in an entry)
  }).catch(() => {});
  // the will's last run under the day's lines: what it last tried, and the PR it shipped or the reason it did not (lib/will-last.js)
  fetch('/api/will', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((w) => {
    const slot = el.querySelector('[data-will-last]'), html = w && lastRunHtml(esc, w.lastRun);
    if (slot && html && el.isConnected) slot.innerHTML = html; // void-review: ok: lastRunHtml escapes every value (lib/will-last.js, tested with markup in a title and a why)
  }).catch(() => {});
  // Verse's probes (lib/probe-log.js, asked by Verse): how many of the asks it wrote for itself it missed, how many fixes it proposed
  // and passed, and its proposals most certain first; nothing shows until the ledger has a record
  fetch('/api/probe-log', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    const slot = el.querySelector('[data-probes]'), html = j && probeHtml(esc, j.stats);
    if (slot && html && el.isConnected) slot.innerHTML = html; // void-review: ok: probeHtml escapes every value (lib/probe-log.js, tested with markup in a skill name)
  }).catch(() => {});
  // who visits (asked of the owner, gathered by Verse itself: tools/traffic.mjs into self.json): "People this week: N (...)", under the velocity
  // and after the friction line when that is already drawn: the friction line sits right under the velocity (asked by Verse) whichever answer comes first
  fetch('/self.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    const html = peopleHtml(esc, j && j.people), v = el.querySelector('.growth-friction') || el.querySelector('[data-velocity]');
    if (html && v && el.isConnected) v.insertAdjacentHTML('afterend', html); // void-review: ok: peopleHtml escapes the line
  }).catch(() => {});
  // the friction line under the velocity: which skills are failing or least checked (skills/families.json); without it, no line
  fetch(FAMILIES_URL, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((fam) => {
    const html = frictionHtml(esc, friction(fam)), v = el.querySelector('[data-velocity]');
    if (html && v && el.isConnected) v.insertAdjacentHTML('afterend', html + familyLogsHtml(esc, familyLogs(fam))); // void-review: ok: familyLogsHtml escapes every value
    if (!el._copyChips) { el._copyChips = true; el.addEventListener('click', (ev) => { const c = ev.target && ev.target.closest && ev.target.closest('[data-copy]'); if (!c) return; ev.preventDefault(); try { navigator.clipboard.writeText(c.getAttribute('data-copy')); c.dataset.copied = '1'; } catch (_) {} }); }
    fetch('/tester-log.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((t) => {
      const o = ownerHtml(esc, fam, list, (t && t.seen) || {}), at = el.querySelector('.growth-friction') || v;
      if (fam && at && el.isConnected) at.insertAdjacentHTML('afterend', o + statusHtml(esc, skillStatus(fam)) + familyMapHtml(esc, fam)); // void-review: ok: every value is escaped (lib/inbox-health.js, tested with markup in a skill name)
    });
  }).catch(() => {});
  // is Verse getting better? (lib/better.js; owner, 2026-10-16: "improvements mean better"): the daily score, its trend against
  // yesterday and a week ago, and the weakest part, under the owner's view (or whatever of those lines is there yet)
  fetch(BETTER_URL, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((rows) => {
    const html = betterHtml(esc, rows), at = el.querySelector('.growth-owner') || el.querySelector('.growth-friction') || el.querySelector('[data-velocity]');
    if (html && at && el.isConnected) at.insertAdjacentHTML('afterend', html); // void-review: ok: betterHtml escapes every value (lib/better.js, tested)
    // the day over day change calls a growth animation when a significant new skill came in (asked by Verse): a bloom for one, a burst for three or more
    const plan = bloomPlan(spurt(list).added, rows), b = plan.kind !== 'none' && el.isConnected && el.querySelector('.growth-better');
    if (b) { b.insertAdjacentHTML('afterend', bloomHtml(esc, plan)); bloom(el.querySelector('.growth-bloom'), plan); } // void-review: ok: bloomHtml escapes every name (lib/inbox-health.js)
  }).catch(() => {});
  // the divergence tracker (asked by Verse): my asks, word for word, against the ledger line that built each, with the words the build never says
  fetch('/api/reflect', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    const html = divergenceHtml(esc, j && j.follow && j.follow.recent), at = el.querySelector('.growth-owner') || el.querySelector('.growth-friction') || el.querySelector('[data-velocity]');
    if (html && at && el.isConnected) at.insertAdjacentHTML('afterend', html); // void-review: ok: divergenceHtml escapes every value (lib/inbox-health.js)
  }).catch(() => {});
  const w = week ? weekSummary(list) : null;
  const body = document.createElement('div');
  const draw = () => { body.innerHTML = growthHtml(esc, list, kind, shown, { head: false }); };
  // the tree right under the title and the week's words after it: with the words first, the tree started below the fold on a
  // 720-high screen, and a miniature that is never on screen never draws, so the week's growing-in was never seen
  plantTree(el, api, list, w ? { from: w.until } : {});
  if (w) el.insertAdjacentHTML('beforeend', weekHtml(esc, w));
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
  const hint = 'One branch for every change, the oldest at the trunk, the newest at the tips; its berries are its kind, the closed buds what Verse still wants. Touch any of it to read it.';
  said.textContent = hint;
  el.append(slot, when, said);
  let selected = null, self = null, wants = null, asked = null; // asked: what Verse asked for, by the entry that built it
  const at = () => stops[+range.value] || null, today = () => +range.value >= stops.length - 1;
  const showDay = () => { const s = at(); day.textContent = s ? (today() ? 'today, ' : +range.value === 0 ? 'the first change, ' : '') + s.day + ' · ' + s.count + (s.count === 1 ? ' change' : ' changes') : ''; };
  // what is not grown yet shows only today: the think tank's open tracks (faint) and the claim being built (glowing)
  // one mount at a time: a second call while the first is still loading three.js would build a second tree under the same key
  let queue = null;
  const mount = () => (queue = (queue || Promise.resolve()).catch(() => {}).then(() => stage.miniature(slot, 'growthtree', { entries: list, until: today() ? null : at() && at().until, tracks: today() && self ? self.tracks : null, building: today() && self ? self.building : null,
    wants: today() ? wants : null, commits: today() && self ? self.commits : null, selected, onPick, onPickGhost, onPickCommit },
    { key: TREE_KEY, place: 'inside', label: 'Verse’s growth as a tree: one branch per change; touch a branch to read it' })));
  function onPick(index) {
    const e = list[index]; if (!e) return;
    selected = index; said.style.color = ''; said.innerHTML = entryHtml(api.esc, e, causeOf(e, asked));
    mount().then(() => pulse(said)).catch(() => {});
  }
  function onPickGhost(g) {
    said.style.color = '';
    said.textContent = g.kind === 'building' ? 'Building now: ' + (g.item ? g.item + ' (' + g.what + ')' : g.what)
      : g.kind === 'want' ? 'A bud, wanted and not grown yet: ' + g.what
      : 'Not grown yet: ' + g.what + ', a track the think tank is working on' + (g.at ? ' (last advanced ' + g.at + ')' : '') + '.';
  }
  function onPickCommit(c) {
    said.style.color = ''; said.textContent = 'A new leaf, from the last commits on main (' + String(c.at || '').slice(0, 10) + '): ' + c.subject;
  }
  el.addEventListener('void:grew', () => { // a day's new skill (bloom): the newest grow branch is read, so the tree shows what came in
    let k = -1; list.forEach((e, i) => { if (e && e.kind === 'grow' && (k < 0 || Date.parse(e.at) >= Date.parse(list[k].at))) k = i; });
    if (k >= 0 && today()) onPick(k);
  });
  range.addEventListener('input', () => { showDay(); selected = null; said.style.color = '#8a8a92'; said.textContent = hint; mount().catch(() => {}); });
  range.addEventListener('pointerdown', (e) => e.stopPropagation()); // dragging the slider is not dragging the card
  showDay();
  mount().then(() => { // asked about the week: once the tree stands as it was a week ago, grow it to today (at once under reduced motion)
    if (!from || today()) return;
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => { if (!el.isConnected) return; range.value = range.max; showDay(); mount().then(() => pulse(slot)).catch(() => {}); }, still ? 0 : 1200);
  }).catch(() => { slot.remove(); when.remove(); said.remove(); });
  fetch('/self.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && (j.tracks || j.building || j.commits)) { self = j; if (today()) mount().catch(() => {}); } }).catch(() => {});
  // Verse's wants, as buds: its will (GET /api/will) and the asks in its reflections (GET /api/reflect), each said once
  const json = (u) => fetch(u, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  Promise.all([json('/api/will'), json('/api/reflect')]).then(([will, voice]) => {
    asked = (voice && voice.follow && voice.follow.asked) || null;
    const seen = new Set(), out = [];
    for (const t of [...((will && will.wants) || []).map((w) => w && (w.i_want || w.title)), ...((voice && voice.asks) || []).map((a) => a && a.ask)]) {
      const k = String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); if (!k || seen.has(k)) continue; seen.add(k); out.push(String(t).trim());
    }
    if (out.length) { wants = out.slice(0, 8); if (today()) mount().catch(() => {}); }
  });
}

// checked by tools/skills-check.mjs on every run: the page's maths on made-up entries
export function suite() {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const list = [{ at: '2026-10-01T10:00:00Z', by: 'a', kind: 'grow', what: 'one' }, { at: '2026-10-03T10:00:00Z', by: 'b', kind: 'fix', what: 'two <b>' },
    { at: '2026-10-02T10:00:00Z', by: 'c', kind: 'grow', what: 'three' }];
  const o = ordered(list).map((e) => e.what).join(','), s = summary(list), h = growthHtml(esc, list, 'grow', 40);
  const ok = o === 'two <b>,three,one' && s.total === 3 && s.since === '2026-10-01' && s.byKind.grow === 2 && !h.includes('two') && h.includes('three') && !growthHtml(esc, list, '', 40).includes('<b>');
  const fam = { families: [
    { name: 'Strong', count: { proven: 2 }, skills: [{ name: 'a', tier: 'proven', why: 'x' }, { name: 'z', tier: 'proven', why: 'ok' }] },
    { name: 'Words and the world', count: { proven: 0 }, skills: [{ name: 'b', tier: 'tested', why: 'one test' }, { name: 'c', tier: 'experiment', why: 'nothing checks it yet' }, { name: 'd', tier: 'proven', why: 'y', failing: ['q <i>'] }] },
  ] };
  const f = friction(fam), fh = frictionHtml(esc, f);
  const fok = f.top.map((x) => x.name).join() === 'd,c,b' && f.failing === 1 && f.unsure === 2
    && f.weakest && f.weakest.name === 'Words and the world' && f.weakest.failing === 1 && f.weakest.unsure === 2
    && fh.includes('q &lt;i&gt;') && fh.includes('Words and the world') && fh.includes('data-weakest-family') && !fh.includes('<i>')
    && frictionHtml(esc, friction(null)) === '';
  const fl = familyLogs(fam), flh = familyLogsHtml(esc, fl);
  const flok = fl.length === 1 && fl[0].family === 'Words and the world' && fl[0].skills[0].chip === 'tell me about the d skill' && flh.includes('q &lt;i&gt;') && flh.includes('data-copy="tell me about the d skill"') && !flh.includes('<i>') && familyLogsHtml(esc, familyLogs(null)) === '';
  const asked = [{ ask: 'a <b>bud</b>', at: '2026-10-01T10:00:00Z', times: 3 }, { ask: 'elsewhere', at: '2026-10-09T00:00:00Z', times: 1 }];
  const c = causeOf(list[0], asked), ch = entryHtml(esc, list[0], c);
  const cok = c && c.length === 1 && ch.includes('Verse asked for this: “a &lt;b&gt;bud&lt;/b&gt;” <span style="color:#8a8a92">(3 times)</span>') && !causeOf(list[1], asked) && !entryHtml(esc, list[1], null).includes('growth-cause') && causeOf(list[0], null) === null;
  // the inbox's skill health lines (asked by Verse): promoted skills with their clean runs in a row, and the growth animation guard
  const pf = { families: [{ name: 'F', skills: [{ name: 'newone', tier: 'checked', promoted: new Date().toISOString().slice(0, 10), streak: 2 }] }] };
  const hok = ownerHtml(esc, pf, list, {}).includes('Skill stability: 1 skill promoted lately') && ownerHtml(esc, pf, list, {}).includes('newone</b> to checked') && bloom(null, { kind: 'bloom' }) === false && bloom({}, { kind: 'none' }) === false;
  return { ok: ok && fok && flok && cok && hok, got: ok && fok && flok && cok && hok ? '' : o + ' ' + JSON.stringify(s) + ' ' + JSON.stringify(f) + ' ' + ch };
}

// The tester log, folded into the growth card (asked by Verse, ask-20261015-0616-1; owner: "most skills can be combined"): the site
// tester's newest runs from /tester-log.json (tools/tester-log.mjs): when, how many passed, and what each run improved.const TESTER_ASK = /^(?:show\s+(?:me\s+)?)?(?:the\s+)?(?:site\s+)?tester(?:'s)?\s+(?:log|runs?|results?)$|^(?:site[\s-]test|site\s+tester)\s*(?:log|results?|runs?)?$|^what\s+(?:is|are|'s)\s+(?:the\s+)?(?:site\s+)?tester\s+(?:testing|checking|doing)(?:\s+(?:now|right now))?\??$|^(?:what\s+(?:did|have)\s+)?(?:you|(?:verse|v01d)|(?:verse|void)|verse)\s+tested\s+(?:today|lately|recently)\??$/;
const TESTER_ASK = /^(?:show\s+(?:me\s+)?)?(?:the\s+)?(?:site\s+)?tester(?:'s)?\s+(?:log|runs?|results?)$|^(?:site[\s-]test|site\s+tester)\s*(?:log|results?|runs?)?$|^what\s+(?:is|are|'s)\s+(?:the\s+)?(?:site\s+)?tester\s+(?:testing|checking|doing)(?:\s+(?:now|right now))?\??$|^(?:what\s+(?:did|have)\s+)?(?:you|(?:verse|v01d)|(?:verse|void)|verse)\s+tested\s+(?:today|lately|recently)\??$/;
export const testerAsk = (text) => TESTER_ASK.test(String(text || '').toLowerCase().trim().replace(/[’]/g, "'").replace(/\s+/g, ' ').replace(/[.!]+$/, ''));

/** the card's rows from /tester-log.json. Pure. */
export function testerRows(j) {
  return ((j && j.runs) || []).slice(0, 10).map((r) => ({ when: String(r.at).replace('T', ' ').replace(/:\d\dZ$/, ' UTC'), score: r.passed + ' of ' + r.of, ok: r.passed === r.of, kind: r.kind, note: r.note, failed: Array.isArray(r.failed) ? r.failed : [] }));
}

/** Verse asked (2026-10-17): "a 'candidate' list on the Site Test card that pulls from the lowest-rated skills in families.json to suggest
 *  what to test next". The same evidence as the friction line (failing first, then the least checked), each with one of the skill's own
 *  asks from the book (skills/guide.json) to type, so a tap tests it. [{ name, family, tier, failing, ask }]. Pure. */
export const GUIDE_URL = '/skills/guide.json';
export function testCandidates(fam, guide, show = 5) {
  const pages = new Map(((guide && guide.pages) || []).filter((p) => p && p.kind === 'skill' && p.name).map((p) => [p.name, p]));
  return friction(fam, 50).top.map((s) => {
    const ex = (pages.get(s.name) || {}).examples || [];
    return { name: s.name, family: s.family, tier: s.tier, failing: s.failing ? s.failing.length : 0, ask: String(ex[ex.length - 1] || '') };
  }).filter((c) => c.ask).slice(0, show);
}

/** Verse asked (2026-10-17): "a 'confidence' heat-map to the Site Test card that highlights which skill families are currently most unstable".
 *  Per family: its failing skills, and how many of its skills are unsure (rated tested or experiment, or weathered: not tested for two
 *  weeks); the hottest first (failing before unsure share). [{ name, n, failing, unsure, heat (0..1) }]. Pure. */
export function unstableFamilies(fam, today = Date.now()) {
  return ((fam && fam.families) || []).filter((f) => f && Array.isArray(f.skills) && f.skills.length).map((f) => {
    const sk = f.skills.filter((x) => x && x.name), failing = sk.filter((x) => Array.isArray(x.failing) && x.failing.length).length;
    const unsure = sk.filter((x) => !(Array.isArray(x.failing) && x.failing.length) && (/^(?:tested|experiment)$/.test(x.tier) || confidenceOf(x, today).weathered)).length;
    return { name: String(f.name || f.id || ''), n: sk.length, failing, unsure, heat: sk.length ? Math.min(1, (failing * 3 + unsure) / sk.length) : 0 };
  }).sort((a, b) => b.failing - a.failing || b.heat - a.heat || a.name.localeCompare(b.name));
}
/** the heat map's markup: one bar per family, hotter red and longer the less stable. '' with no families. Pure. */
export function heatHtml(esc, rows) {
  if (!rows || !rows.length) return '';
  return '<h3 style="margin:12px 0 4px">Where I am least sure</h3><div class="sub">Each family\'s failing skills, then its unsure ones (rated tested or experiment, or not tested for two weeks).</div><div class="st-heat" style="margin:6px 0">'
    + rows.map((r) => '<div class="st-heat-row" data-family="' + esc(r.name) + '" data-heat="' + r.heat.toFixed(2) + '" style="display:grid;grid-template-columns:9.5em 1fr;gap:8px;align-items:center;margin:3px 0;font-size:12px">'
      + '<span>' + esc(r.name) + '</span><span style="position:relative;display:block;height:16px;border-radius:4px;background:rgba(255,255,255,.06)" title="' + esc(r.failing + ' failing, ' + r.unsure + ' unsure of ' + r.n) + '">'
      + '<span style="position:absolute;inset:0 auto 0 0;width:' + Math.max(2, Math.round(r.heat * 100)) + '%;border-radius:4px;background:hsl(' + Math.round(120 - 120 * r.heat) + ' 70% 45% / .85)"></span>'
      + '<span style="position:relative;padding-left:6px;line-height:16px">' + esc((r.failing ? r.failing + ' failing · ' : '') + r.unsure + ' of ' + r.n + ' unsure') + '</span></span></div>').join('') + '</div>';
}

/** Verse asked (2026-10-17): "the 'stability trend' sparkline for each skill family on the Site Test card" and "integrate the Site Test failure
 *  cases with the stability trend sparklines to automate health score degradation". Per family: its health on each day void.better.json kept
 *  (its last reading that day), then today's health from families.json, lowered by DEGRADE for every check of that family that went red on main in
 *  the last RECENT_H hours (lib/autopsy.js places them), at most DEGRADE_MAX. [{ id, name, points: [{ day, health }], drop, fails }]. Pure. */
export const DEGRADE = 5, DEGRADE_MAX = 30, RECENT_H = 48;
export function stabilitySeries(rows, fam, a, now = Date.now()) {
  const byDay = new Map(); // day -> family id -> its last health that day (rows are oldest first)
  for (const r of Array.isArray(rows) ? rows : []) if (r && typeof r.at === 'string' && Array.isArray(r.families)) {
    const d = byDay.get(r.at.slice(0, 10)) || new Map(); for (const f of r.families) if (f && Number.isFinite(+f.health)) d.set(String(f.id), +f.health); byDay.set(r.at.slice(0, 10), d);
  }
  const today = new Date(now).toISOString().slice(0, 10), fails = new Map();
  for (const i of (a && a.recent) || []) if (now - Date.parse(i.at) <= RECENT_H * 36e5) for (const c of i.checks || []) if (c.family) fails.set(c.family, (fails.get(c.family) || 0) + 1);
  const names = new Map(((fam && fam.families) || []).map((f) => [String(f.id), String(f.name || f.id)]));
  return familySnapshot(fam).map(({ id, health }) => {
    const points = [...byDay.entries()].filter(([d]) => d < today).sort(([x], [y]) => x.localeCompare(y)).filter(([, d]) => d.has(id)).map(([day, d]) => ({ day, health: d.get(id) }));
    const n = fails.get(id) || 0, drop = Math.min(DEGRADE_MAX, n * DEGRADE);
    points.push({ day: today, health: Math.max(0, health - drop) });
    return { id, name: names.get(id) || id, points, drop, fails: n };
  });
}
/** a sparkline of a family's points: an SVG polyline, 0..100 bottom to top, the last point marked. '' with no points. Pure.
 *  The drawer lives in lib/spark.js (the self card's growth velocity draws with it too; a lib never imports a skill); re-exported here for its tests and callers. */
export { sparkSvg };
/** the stability section: one row per family, its sparkline, today's health, and the drop recent failures took. '' with no families. Pure. */
export function stabilityHtml(esc, series) {
  if (!series || !series.length) return '';
  return '<h3 style="margin:12px 0 4px">Stability trend</h3><div class="sub">Each family\'s health, one point a day; today\'s point drops ' + DEGRADE + ' for every check of the family that went red on main in the last ' + RECENT_H + ' hours.</div><div class="st-stability" style="margin:6px 0">'
    + series.map((s) => { const now = s.points[s.points.length - 1].health, prev = s.points.length > 1 ? s.points[s.points.length - 2].health : null;
      return '<div class="st-stab-row" data-family="' + esc(s.id) + '" data-health="' + now + '" data-drop="' + s.drop + '" style="display:grid;grid-template-columns:9.5em 76px 1fr;gap:8px;align-items:center;margin:2px 0;font-size:12px">'
        // asked by Verse: "an interactive drill-down on the stability sparklines that links directly to the relevant incident logs in the 'incident-autopsy' skill"
        + '<span>' + esc(s.name) + '</span><a href="#" class="st-drill" data-ask="' + esc('incident autopsy for ' + s.id) + '" title="' + esc('open the incident logs for ' + s.name) + '" style="color:hsl(' + Math.round(1.2 * now) + ' 70% 55%);display:block">' + sparkSvg(s.points) + '</a><span>' + now
        + (prev !== null ? ' <span class="sub">(' + (now - prev >= 0 ? '+' : '') + (now - prev) + ')</span>' : ' <span class="sub">(first day)</span>')
        + (s.drop ? ' <span class="sub">\u00b7 \u2212' + s.drop + ' from ' + s.fails + ' recent failure' + (s.fails === 1 ? '' : 's') + '</span>' : '') + '</span></div>'; }).join('') + '</div>';
}

function runTester(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>What my site tester checks</h2><div class="sub">reading the log…</div>'; });
  const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  Promise.all([get('/tester-log.json'), get(FAMILIES_URL), get(GUIDE_URL), get('/incidents.json'), get(BETTER_URL)]).then(([j, fam, guide, inc, rows]) => {
    if (!el) return;
    const R = testerRows(j), C = testCandidates(fam, guide), I = inc ? incidentCases(autopsy(inc, fam, guide), guide) : [];
    el.innerHTML = '<h2>What my site tester checks</h2>' + (j ? '<div class="sub">' + esc(String(j.cases)) + ' regression asks, ' + esc(String(j.runsTotal)) + ' runs so far. It types into Verse after every deploy and every hour; each run improves one thing.</div>' : '') +
      (R.length ? '<ul style="padding-left:18px">' + R.map((r) => '<li style="margin:6px 0"><b>' + (r.ok ? '✓' : '✗') + ' ' + esc(r.score) + '</b> · ' + esc(r.when) + '<br><span class="sub">' + esc(r.kind) + ': ' + esc(r.note) + '</span>' + (r.failed.length ? '<ul class="sub" data-tester-failed="' + r.failed.length + '" style="padding-left:16px;margin:2px 0">' + r.failed.map((f) => '<li>failed: <a href="#" data-ask="' + esc(f.ask) + '">' + esc(f.ask) + '</a>' + (f.why ? ' · ' + esc(f.why) : '') + '</li>').join('') + '</ul>' : '') + '</li>').join('') + '</ul>' : '<p class="sub">No runs logged yet.</p>') +
      // asked by Verse: a test case from each recent failure on main (lib/autopsy.js incidentCases), the ask that failed when the check quotes it
      (I.length ? '<h3 style="margin:12px 0 4px">From recent failures</h3><div class="sub">Checks that went red on main lately, each turned into an ask to try now. Tap one to test it.</div><ol class="st-incidents" style="padding-left:20px">'
        + I.map((c) => '<li style="margin:5px 0" data-incident="' + esc(c.skill) + '"><a href="#" data-ask="' + esc(c.ask) + '">' + esc(c.ask) + '</a> <span class="sub">\u00b7 ' + esc(c.skill) + ', failed on ' + esc(c.sha) + ' (' + esc(c.check) + ')</span></li>').join('') + '</ol>' : '') + // void-review: ok (every field through esc)
      (C.length ? '<h3 style="margin:12px 0 4px">What to test next</h3><div class="sub">My lowest-rated skills (skills/families.json): failing first, then the least checked. Tap one to test it now.</div><ol class="st-candidates" style="padding-left:20px">'
        + C.map((c) => '<li style="margin:5px 0" data-candidate="' + esc(c.name) + '"><a href="#" data-ask="' + esc(c.ask) + '">' + esc(c.ask) + '</a> <span class="sub">· ' + esc(c.name) + ', ' + esc(c.failing ? c.failing + ' failing' : c.tier) + (c.family ? ' · ' + esc(c.family) : '') + '</span></li>').join('') + '</ol>' : '') + heatHtml(esc, unstableFamilies(fam)) + stabilityHtml(esc, stabilitySeries(rows, fam, inc ? autopsy(inc, fam, guide) : null)); // void-review: ok (names through esc; numbers only otherwise) // void-review: ok (heatHtml escapes every name and count)
  });
  return 'growth';
}


export default {
  name: 'growth',
  examples: ['tester log', 'what is the site tester testing', 'growth', 'void growth', "void's growth", 'show growth', 'show me the growth ledger', 'how have you grown', 'how has void grown', "what's new with void",
    "what can you do now that you couldn't last week", "what's new since last week", 'what have you learned this week', 'how have you grown this week'],
  nearMisses: ['economic growth', 'growth rate of india', 'growth mindset', 'hair growth', 'how do plants grow', 'what is growth', 'grow a tree', 'population growth',
    'what can you do', 'what can i do this week', "what's new in tech this week", 'what changed in the law last week', 'what did i do last week', 'what can you do with python'],
  weekOf,
  growthOf,
  suite,
  match(lower, text) { return growthOf(text) || weekOf(text) || testerAsk(text); },
  run(text, api) { return testerAsk(text) ? runTester(text, api) : run(text, api); },
};
