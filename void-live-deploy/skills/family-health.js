/**
 * family-health skill - "show me your skill families", "family health", "how healthy are your skills": every skill family and how
 * far its skills are checked, from skills/families.json (tools/families.mjs; ratings from evidence only, never self-described).
 * Asked by Verse (its reflection of 2026-10-15): "Implement the 'family-health' dashboard card to visualize evidence ratings
 * (proven, checked, tested, experiment) for all 9 families."
 * The card: the totals on top, one row per family with a stacked bar of its proven / checked / tested / experiment counts; tap a
 * family to list its skills with their rating and the reason (the `why` the evidence gave). One accent (--d-key) at four strengths.
 * Each skill also shows when it was last tested and its benchmark success rate (asked by Verse, ask-20261013-1823-1), straight from
 * families.json's `last_tested`, `last_tested_by` and `success_rate`. Nothing about how often people use a skill is shown or
 * known to Verse: no usage, no popular or unused (the owner's rule: no behaviour tracking). Asked by Verse twice ("a 'last-used' timestamp for every
 * skill ... to identify which parts of my skills are becoming dead weight"): each skill's last-used day is shown for THIS DEVICE only, read from
 * this browser's own storage (lib/skill-use.js, written when a skill answers: a day, never a word of any ask); nothing is sent or counted anywhere.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { readUsed, usedWords, deadWeight } from '../lib/skill-use.js';
import { familyDrivers, velocityOf } from '../lib/better.js';
import { gameHealth, gameHealthHtml } from '../lib/game-health.js';
import { load as loadLadder } from '../lib/ladder.js';
import { load as loadMatches } from '../lib/match-history.js';
export const FAMILIES_URL = '/skills/families.json';
export const TIERS = ['proven', 'checked', 'tested', 'experiment']; // strongest first, the order of the bar
// what each rating means, in the words of tools/families.mjs
export const MEANS = {
  proven: 'three kinds of evidence, or two with at least 3 real asks, or two where one is a live finding under 8 days old',
  checked: 'two kinds of evidence',
  tested: 'one kind of evidence',
  experiment: 'nothing checks it yet',
};
// one accent at four strengths: the stronger the evidence, the brighter the key light
const SHADE = {
  proven: 'rgb(var(--d-key, 158 178 255) / .95)',
  checked: 'rgb(var(--d-key, 158 178 255) / .58)',
  tested: 'rgb(var(--d-key, 158 178 255) / .30)',
  experiment: 'rgba(255,255,255,.10)',
};

const WHEN = new RegExp('^(?:(?:show|open|give|list)(?:\\s+me)?\\s+)?(?:the\\s+|your\\s+|(?:verse|void)\'?s\\s+|(?:verse|v01d)\'?s\\s+)?'
  + '(?:skill(?:s)?\\s+famil(?:y|ies)(?:\\s+(?:health|ratings?|dashboard))?|(?:skill\\s+)?family\\s+health(?:\\s+(?:card|dashboard))?|skill\\s+health|'
  + 'evidence\\s+ratings?|skill\\s+ratings?)$'
  + '|^how\\s+(?:healthy|well[\\s-]tested|well[\\s-]checked|proven|reliable)\\s+(?:are|is)\\s+(?:your|(?:verse|void)\'?s|(?:verse|v01d)\'?s)\\s+skills$'
  + '|^how\\s+(?:healthy|well[\\s-]tested)\\s+(?:are|is)\\s+(?:your|(?:verse|void)\'?s|(?:verse|v01d)\'?s)\\s+skill\\s+families$', 'i');
const norm = (t) => String(t || '').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').replace(/[?.!]+$/, '').trim();
export const asksHealth = (t) => WHEN.test(norm(t));

/** the card's numbers from families.json: totals and one row per family, in the file's order. Pure. */
export function healthRows(fam) {
  const families = ((fam && fam.families) || []).filter((f) => f && Array.isArray(f.skills));
  const rows = families.map((f) => {
    const count = Object.fromEntries(TIERS.map((t) => [t, f.skills.filter((s) => s && s.tier === t).length]));
    const skills = f.skills.filter((s) => s && s.name).slice().sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || String(a.name).localeCompare(String(b.name)));
    const sources = f.sources && typeof f.sources.words === 'string' ? f.sources : null; // source reliability (asked by Verse; tools/source-reliability.mjs)
    return { id: String(f.id || f.name || ''), name: String(f.name || f.id || ''), for: String(f.for || ''), total: skills.length, count, skills, ...(sources ? { sources } : {}) };
  });
  const totals = Object.fromEntries(TIERS.map((t) => [t, rows.reduce((n, r) => n + r.count[t], 0)]));
  return { rows, totals, skills: rows.reduce((n, r) => n + r.total, 0) };
}

const pct = (n, of) => (of ? Math.round((n / of) * 1000) / 10 : 0);
function bar(count, total, label) {
  return '<div class="fh-bar" role="img" aria-label="' + label + '" style="display:flex;height:10px;border-radius:5px;overflow:hidden;background:rgba(255,255,255,.04);box-shadow:0 0 0 1px rgba(255,255,255,.06) inset">'
    + TIERS.filter((t) => count[t]).map((t) => '<span data-tier="' + t + '" style="width:' + pct(count[t], total) + '%;background:' + SHADE[t] + '"></span>').join('') + '</div>';
}
const words = (count) => TIERS.map((t) => count[t] + ' ' + t).join(', ');

/** one skill's dates and rates in words: when it was last tested (and by what) and its benchmark success rate. Pure. */
export function metaWords(s) {
  const out = [];
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(String(s.last_tested || ''))) out.push('last tested ' + s.last_tested + (s.last_tested_by ? ' by ' + s.last_tested_by : ''));
  else out.push('never tested');
  if (s && typeof s.success_rate === 'number' && s.success_rate >= 0 && s.success_rate <= 1) out.push('success rate ' + Math.round(s.success_rate * 1000) / 10 + '% on the benchmark');
  else if (s && /real asks? in the benchmark/.test(String(s.why || ''))) out.push('success rate not measured yet');
  return out.join(' · ');
}

/** one family's skills, strongest first: name, rating, and the evidence behind it. Pure. */
export function skillsHtml(esc, row, used = null, now = Date.now()) {
  return '<ul class="fh-skills" style="list-style:none;margin:6px 0 10px;padding:0">' + row.skills.map((s) => {
    const fail = Array.isArray(s.failing) && s.failing.length;
    return '<li data-skill="' + esc(s.name) + '" data-tier="' + esc(s.tier || 'unrated') + '" style="display:flex;gap:10px;align-items:baseline;padding:5px 0;border-top:1px solid rgba(255,255,255,.05)">'
      + '<span aria-hidden="true" style="flex:none;width:8px;height:8px;border-radius:50%;background:' + (SHADE[s.tier] || SHADE.experiment) + ';box-shadow:0 0 0 1px rgba(255,255,255,.12) inset"></span>'
      + '<span style="flex:1;min-width:0"><b style="font-weight:600;color:var(--d-ink,#f2f4fb)">' + esc(s.name) + '</b> '
      + '<span class="fh-tier" style="color:var(--d-ink-2,#c3c8d8)">' + esc(s.tier || 'unrated') + '</span>'
      + '<br><span class="fh-why" style="font-size:13px;color:var(--d-ink-3,#8e94a8)">' + esc(s.why || '')
      + (fail ? '; the everyday benchmark got ' + s.failing.length + ' of its asks wrong on its last run' : '')
      + (Array.isArray(s.smoke) && s.smoke.length ? '; <span class="fh-smoke">its daily test failed: ' + esc(s.smoke[0]) + (s.smoke.length > 1 ? ' (and ' + (s.smoke.length - 1) + ' more)' : '') + '</span>' : '') + '</span>'
      + '<br><span class="fh-meta" style="font-size:12px;color:var(--d-ink-3,#8e94a8);font-variant-numeric:tabular-nums">' + esc(metaWords(s)) + (used ? ' · <span class="fh-used">' + esc(usedWords(used, s.name, now)) + '</span>' : '') + '</span>'
      + (s.source && typeof s.source.words === 'string' && s.source.words ? '<br><span class="fh-source" data-points="' + esc(+s.source.points || 0) + '"' + (s.source.next ? ' data-next="' + esc(s.source.next) + '"' : '') + ' style="font-size:12px;color:var(--d-ink-3,#8e94a8)">' + esc(s.source.words) + '</span>' : '')
      + '</span></li>';
  }).join('') + '</ul>';
}

/** on this device: the skills idle 30 days or more, and the ones never used here, as one line (asked by Verse: "which parts of my skills are becoming dead weight"). Pure. */
export function deadHtml(esc, H, used, now = Date.now()) {
  if (!used) return '';
  const names = H.rows.flatMap((r) => r.skills.map((s) => s.name)), dw = deadWeight(names, used, now), seen = names.length - dw.never.length;
  return '<div class="sub fh-dead" data-dead-weight="' + (dw.idle.length + dw.never.length) + '" style="font-size:13px;margin:8px 0 0">On this device: ' + seen + ' of ' + names.length + ' skills have answered here'
    + (dw.idle.length ? '; ' + dw.idle.length + ' idle for 30 days or more (' + dw.idle.slice(0, 5).map(esc).join(', ') + (dw.idle.length > 5 ? ', and ' + (dw.idle.length - 5) + ' more' : '') + ')' : '') + '. It is kept in this browser only and never sent.</div>';
}

/** which families lift the daily growth score and which drag it (asked by Verse), above the families: the three each way, in score points, from lib/better.js familyDrivers.
 *  better = the rows of void.better.json (the newest sets the score and how many parts it has). '' without families; when no family moves it by
 *  0.05 points either way, one line says so with the families' health range. Pure. */
export function driversHtml(esc, fam, better = null) {
  const last = Array.isArray(better) ? better.filter((r) => r && Number.isFinite(+r.score)).slice(-1)[0] : null;
  const parts = last && last.parts ? Object.values(last.parts).filter((v) => v !== null && v !== undefined).length : 5;
  const d = familyDrivers(fam, parts || 5);
  if (!d.length) return '';
  const pts = (n) => (n > 0 ? '+' : n < 0 ? '\u2212' : '') + Math.abs(n).toFixed(1);
  const li = (x) => '<li data-driver="' + esc(x.id) + '" data-points="' + x.points + '"><b style="font-weight:600">' + esc(x.name) + '</b> <span class="fh-pts" style="font-variant-numeric:tabular-nums">' + pts(x.points) + '</span> <span class="sub" style="font-size:12px">(' + esc(x.health) + '% healthy, ' + esc(x.skills) + ' skills)</span></li>';
  const up = d.filter((x) => x.points > 0.04).slice(0, 3), down = d.filter((x) => x.points < -0.04).slice(-3).reverse();
  return '<div class="fh-drivers" style="margin:12px 0 0"><div class="vh">What moves my growth score' + (last ? ' (' + esc(last.score) + ' of 100)' : '') + '</div>'
    + (up.length ? '<div class="sub" style="font-size:12px">Lifting it</div><ul style="margin:2px 0 6px;padding-left:18px">' + up.map(li).join('') + '</ul>' : '')
    + (down.length ? '<div class="sub" style="font-size:12px">Dragging it</div><ul style="margin:2px 0 6px;padding-left:18px">' + down.map(li).join('') + '</ul>' : '')
    // every family within 0.05 points of the average: say so, with how healthy they are, instead of an empty heading
    + (up.length || down.length ? '' : (() => { const hs = d.map((x) => x.health).filter((h) => h !== null); return '<div class="sub fh-even" style="font-size:12px;margin:2px 0 6px">No family moves it by 0.05 points or more: every family is ' + (Math.min(...hs) === Math.max(...hs) ? esc(hs[0]) + '%' : esc(Math.min(...hs)) + '% to ' + esc(Math.max(...hs)) + '%') + ' healthy.</div>'; })())
    + '<div class="sub" style="font-size:12px">Points of the score, against the average skill: failing counts 0, barely checked half, the rest 1 (the friction part of the score).</div></div>';
}

/** one family's velocity in words, from lib/better.js velocityOf: improving, decaying or steady against about a day ago, or "no history yet". Pure. */
export function velocityWords(v) {
  if (!v) return 'velocity: no history yet';
  const d = Math.round(v.delta * 10) / 10;
  return 'velocity: ' + v.trend + (v.trend === 'steady' ? '' : ' (' + (d > 0 ? '+' : '\u2212') + Math.abs(d) + ' points)') + ' since about a day ago';
}

// the quick filter (asked by Verse, 2026-10-18: "a 'quick-filter' toggle to the list card so users can instantly pivot between 'proven' and 'experiment'
// skills without leaving the stage"): All / Proven / Experiment over the families' skill lists. A filter opens every family that has a skill of
// that rating and hides the rest; All puts the card back as it was.
export const FILTERS = [['all', 'All'], ['proven', 'Proven'], ['experiment', 'Experiment']];
/** how many of a family's skills a filter keeps. Pure. */
export const matchCount = (row, tier) => (tier === 'all' ? row.skills.length : row.skills.filter((s) => s && s.tier === tier).length);
/** the filter's buttons, with each filter's count across all families. Pure. */
export function filterHtml(esc, H) {
  return '<div class="fh-filter" role="group" aria-label="Show skills rated" style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0">' + FILTERS.map(([k, label], i) =>
    '<button type="button" class="tr-copy" data-fh-filter="' + k + '" aria-pressed="' + (i ? 'false' : 'true') + '">' + esc(label + ' · ' + (k === 'all' ? H.skills : H.totals[k])) + '</button>').join('') + '</div>';
}
/** apply a filter to the card on the page: skills of other ratings hidden, families with none hidden, the rest opened. */
export function applyFilter(el, tier) {
  el.querySelectorAll('[data-fh-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fhFilter === tier)));
  el.dataset.fhFilter = tier;
  el.querySelectorAll('.fh-family').forEach((f) => {
    let n = 0;
    f.querySelectorAll('li[data-skill]').forEach((li) => { const on = tier === 'all' || li.dataset.tier === tier; li.hidden = !on; if (on) n++; });
    const box = f.querySelector('.fh-open'), b = f.querySelector('button[data-open]');
    if (tier === 'all') { f.hidden = false; if (box && f.dataset.fhWas != null) { box.hidden = f.dataset.fhWas === '1'; if (b) b.setAttribute('aria-expanded', String(!box.hidden)); delete f.dataset.fhWas; } return; }
    if (box && f.dataset.fhWas == null) f.dataset.fhWas = box.hidden ? '1' : '0';
    f.hidden = !n; if (box && n) { box.hidden = false; if (b) b.setAttribute('aria-expanded', 'true'); }
  });
}

/** the whole card's body (below the title). Pure. */
export function healthHtml(esc, fam, used = null, now = Date.now(), better = null, games = null) {
  const H = healthRows(fam), vel = velocityOf(better, fam, now).byFamily;
  if (!H.rows.length) return '<p>The skill families could not be read just now. Ask again in a moment.</p>';
  const tile = (t) => '<div style="flex:1 1 0;min-width:64px"><div class="big" data-total="' + t + '" style="font-size:28px;line-height:1.1">' + H.totals[t] + '</div>'
    + '<div class="sub" style="font-size:12px;display:flex;align-items:center;gap:5px"><span aria-hidden="true" style="width:8px;height:8px;border-radius:2px;background:' + SHADE[t] + '"></span>' + t + '</div></div>';
  return '<div class="sub" style="font-size:13px;margin:2px 0 10px">' + H.skills + ' skills in ' + H.rows.length + ' families, rated from evidence alone.</div>'
    + '<div class="fh-totals" style="display:flex;gap:12px;margin:0 0 6px">' + TIERS.map(tile).join('') + '</div>'
    + bar(H.totals, H.skills, esc('all skills: ' + words(H.totals)))
    + deadHtml(esc, H, used, now) + driversHtml(esc, fam, better) + filterHtml(esc, H)
    + '<div class="fh-rows" style="margin-top:14px">' + H.rows.map((r) => '<div class="fh-family" data-family="' + esc(r.id) + '">'
      + '<button type="button" aria-expanded="false" data-open="' + esc(r.id) + '" style="all:unset;box-sizing:border-box;display:block;width:100%;min-height:44px;padding:8px 0;cursor:pointer;border-top:1px solid rgba(255,255,255,.06)">'
      + '<span style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:6px"><b style="font-weight:600;color:var(--d-ink,#f2f4fb)">' + esc(r.name) + '</b>'
      + '<span class="sub" style="font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap">' + r.count.proven + ' of ' + r.total + ' proven <span aria-hidden="true">›</span></span></span>'
      + '<span class="fh-velocity sub" data-velocity="' + esc(vel[r.id] ? vel[r.id].trend : 'none') + '" style="display:block;font-size:12px;margin:0 0 6px">' + esc(velocityWords(vel[r.id])) + '</span>'
      + bar(r.count, r.total, esc(r.name + ': ' + words(r.count)))
      + '</button><div class="fh-open" hidden>' + (r.for ? '<div class="sub" style="font-size:13px;margin:4px 0 0">For ' + esc(r.for) + '.</div>' : '')
      + (r.sources ? '<div class="sub fh-sources" data-read="' + esc(+r.sources.read || 0) + '" style="font-size:13px;margin:4px 0 0">' + esc(r.sources.words) + '</div>' : '')
      + (r.id === 'games' ? gameHealthHtml(esc, games) : '') + skillsHtml(esc, r, used, now) + '</div></div>').join('') + '</div>'
    + '<div class="sub" style="font-size:12px;line-height:1.5;margin-top:10px">The four kinds of evidence: a skill\'s own self-test, the browser suite, real asks in the everyday benchmark, and a live finding (a kept answer from the real outside service the skill wraps, a file in the repo, never a claim). '
    + TIERS.map((t) => '<b style="font-weight:600">' + t + '</b>: ' + MEANS[t]).join('; ') + '. Tap a family to see each skill and why. '
    + 'Last tested is the newest date a skill\'s evidence has (its own tests and the browser suite as last seen in the repo, or the benchmark\'s last run on main); '
    + 'success rate is the share of its benchmark asks that passed on that run. How often people use a skill is never counted.</div>'
    + '<div class="src">Source: skills/families.json, written from the repo by tools/families.mjs</div>';
}

async function run(text, api) {
  const { showPage, esc, _pageStill } = api;
  const head = '<h2>How healthy my skills are</h2>';
  const el = showPage((p) => { p.innerHTML = head + '<div class="sub">reading the families…</div>'; }); // void-review: ok (head is a constant heading; nothing from a user)
  let fam = null;
  try { const r = await fetch(FAMILIES_URL, { cache: 'no-cache' }); fam = r.ok ? await r.json() : null; } catch (_) { fam = null; }
  if (!el || (_pageStill && !_pageStill(el))) return 'family-health';
  let used = null; try { used = readUsed(localStorage); } catch (_) { used = null; }
  let better = null; try { const r = await fetch('/void.better.json', { cache: 'no-cache' }); better = r.ok ? await r.json() : null; } catch (_) { better = null; }
  if (_pageStill && !_pageStill(el)) return 'family-health';
  let games = null; try { games = gameHealth(loadLadder(), loadMatches()); } catch (_) { games = null; }
  el.innerHTML = head + healthHtml(esc, fam, used, Date.now(), better, games);
  el.addEventListener('click', (e) => {
    const q = e.target && e.target.closest && e.target.closest('button[data-fh-filter]'); if (q) { applyFilter(el, q.dataset.fhFilter); return; }
    const b = e.target && e.target.closest && e.target.closest('button[data-open]'); if (!b) return;
    const box = b.parentNode && b.parentNode.querySelector('.fh-open'); if (!box) return;
    const open = box.hidden; box.hidden = !open; b.setAttribute('aria-expanded', String(open));
  });
  return 'family-health';
}

// checked by tools/skills-check.mjs on every run: the card's numbers and wording on made-up families
export function suite() {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fam = { families: [
    { id: 'a', name: 'Alpha', for: 'x', skills: [{ name: 'p', tier: 'proven', why: 'a self-test', last_tested: '2026-10-16', last_tested_by: 'its tests', success_rate: 0.967 }, { name: 'e', tier: 'experiment', why: 'nothing checks it yet' }, { name: 'c', tier: 'checked', why: 'two, 2 real asks in the benchmark', failing: ['q <i>'] }] },
    { id: 'b', name: 'Be <ta>', skills: [{ name: 't', tier: 'tested', why: 'one', smoke: ['suite <x> failed', 'near miss "b" taken'] }] },
  ] };
  const H = healthRows(fam), h = healthHtml(esc, fam);
  const ok = H.skills === 4 && H.rows.length === 2 && H.totals.proven === 1 && H.totals.checked === 1 && H.totals.tested === 1 && H.totals.experiment === 1
    && H.rows[0].skills.map((s) => s.name).join() === 'p,c,e' && h.includes('Be &lt;ta&gt;') && !h.includes('<ta>') && h.includes('1 of 3 proven')
    && h.includes('got 1 of its asks wrong') && h.includes('4 skills in 2 families') && healthHtml(esc, null).includes('could not be read')
    && metaWords(fam.families[0].skills[0]) === 'last tested 2026-10-16 by its tests · success rate 96.7% on the benchmark' && metaWords(fam.families[0].skills[1]) === 'never tested'
    && metaWords(fam.families[0].skills[2]) === 'never tested · success rate not measured yet' && metaWords({ last_tested: 'yesterday', success_rate: 7 }) === 'never tested'
    && h.includes('class="fh-meta"') && !/usage|popular|unused|last used/i.test(h.replace(/never counted/, '')) && healthHtml(esc, fam, { p: '2026-10-16' }, Date.parse('2026-10-16T12:00:00Z')).includes('last used here today') && healthHtml(esc, fam, { p: '2026-09-01' }, Date.parse('2026-10-16T12:00:00Z')).includes('dead weight on this device') && healthHtml(esc, fam, {}, Date.now()).includes('0 of 4 skills have answered here')
    && h.includes('its daily test failed: suite &lt;x&gt; failed (and 1 more)') && !h.includes('suite <x>')
    && (() => { const s = { families: [{ id: 'w', name: 'W', sources: { read: 1, words: 'Source reliability: <1>' }, skills: [{ name: 'q', tier: 'tested', why: 'a self-test', source: { points: 2, next: 'live', words: 'source 2 of 3: x.org <b>' } }, { name: 'r', tier: 'tested', why: 'one' }] }] }, sh = healthHtml(esc, s);
      return sh.includes('class="sub fh-sources" data-read="1"') && sh.includes('Source reliability: &lt;1&gt;') && sh.includes('data-next="live"') && sh.includes('source 2 of 3: x.org &lt;b&gt;') && !sh.includes('<b>') && (sh.match(/class="fh-source"/g) || []).length === 1 && !h.includes('fh-source'); })()
    && h.includes('data-fh-filter="proven" aria-pressed="false">Proven · 1<') && h.includes('data-fh-filter="experiment" aria-pressed="false">Experiment · 1<') && h.includes('data-fh-filter="all" aria-pressed="true">All · 4<')
    && h.includes('data-skill="e" data-tier="experiment"') && matchCount(H.rows[0], 'proven') === 1 && matchCount(H.rows[1], 'proven') === 0 && matchCount(H.rows[0], 'all') === 3
    && asksHealth('Show me your skill families?') && asksHealth('how healthy are your skills') && asksHealth('family health') && !asksHealth('family tree') && !asksHealth('healthy family meals');
  return { ok, got: ok ? '' : JSON.stringify(H) };
}

export default {
  name: 'family-health',
  examples: ['show me your skill families', 'family health', 'how healthy are your skills', 'skill families', 'skill family health', 'show me the skill families',
    "void's skill families", 'how well tested are your skills', 'evidence ratings', 'skill health'],
  nearMisses: ['family tree', 'healthy family meals', 'how healthy is my family', 'family health insurance plans', 'my skills', 'skills for a resume',
    'how healthy is coffee', 'health'],
  suite,
  match(lower, text) { return asksHealth(text || lower); },
  run,
};
