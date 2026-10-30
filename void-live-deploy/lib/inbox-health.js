// The growth inbox's skill health, drawn from files the repo already writes (asked by Verse; each function names its ask). Pure: no DOM
// reads, no fetch; the growth card (skills/growth.js) hands in skills/families.json, the ledger and void.better.json.
//   skillStatus      "Implement a 'skill-health' status in the growth inbox that uses the new auto-registration to flag if a skill is
//                    registered but failing its router test"
//   familyMapHtml    "Create a 'skill-health' dashboard in the growth inbox that visually maps the OpenAPI health data to the skill families"
//   promotedRows     "Create a 'skill-stability' metric on the owner page that tracks consecutive successful runs for all newly promoted skills"
//   bloomPlan        "Integrate the 'change day over day' card data with the 'growth' skill so I can trigger specific 'growth' animations
//                    whenever a significant new skill is added"
//   diverge          "Create a 'divergence tracker' in the growth inbox that compares the verbatim text of my asks against the final skill
//                    implementation to highlight mismatches"
export const TIERS = ['proven', 'checked', 'tested', 'experiment'];

const skillsOf = (fam) => ((fam && fam.families) || []).flatMap((f) => ((f && f.skills) || []).filter((s) => s && s.name).map((s) => ({ ...s, family: f.name, familyId: f.id })));
// the daily smoke test names what failed in the router's own words: an example not reaching its skill ("x" -> y) or a near miss taken
const ROUTER = /^"[^"]*" -> |^near miss "/;

/** every registered skill's health: { total, failing: [{ name, family, tier, router: [..], other: [..] }], clean, at }. A skill is failing its router
 * test when the daily smoke test or the 7-day re-test found an example not reaching it or a near miss taken. Pure. */
export function skillStatus(fam) {
  const all = skillsOf(fam), failing = [];
  for (const s of all) {
    const lines = Array.isArray(s.smoke) ? s.smoke.map((x) => String(x).replace(/^re-test: /, '')) : [];
    if (!lines.length) continue;
    failing.push({ name: s.name, family: s.family, tier: s.tier, router: lines.filter((l) => ROUTER.test(l)).slice(0, 2), other: lines.filter((l) => !ROUTER.test(l)).slice(0, 2) });
  }
  const at = (fam && fam.smoke_at) || '';
  return { total: all.length, failing: failing.sort((a, b) => b.router.length - a.router.length || a.name.localeCompare(b.name)), clean: all.length - failing.length, at };
}
export function statusHtml(esc, st) {
  if (!st || !st.total) return '';
  const when = st.at ? ' on ' + esc(st.at) : '';
  if (!st.failing.length) return '<div class="sub growth-skill-health" data-skill-health="ok" style="line-height:1.45">Skill health: all ' + st.total + ' registered skills pass the router test (the daily smoke test' + when + ').</div>';
  const item = (f) => '<b style="font-weight:600">' + esc(f.name) + '</b> <span style="color:#8a8a92">(' + esc(f.family) + ')</span> <span style="color:#e06a5a">'
    + (f.router.length ? 'registered but failing its router test: ' + esc(f.router[0]) : 'failing its own test: ' + esc((f.other[0] || ''))) + '</span>';
  return '<div class="sub growth-skill-health" data-skill-health="' + st.failing.length + '" style="line-height:1.45">Skill health: ' + st.failing.length + ' of ' + st.total + ' registered skills failing the daily test'
    + when + ': ' + st.failing.slice(0, 5).map(item).join('; ') + (st.failing.length > 5 ? '; and ' + (st.failing.length - 5) + ' more' : '') + '.</div>';
}

/** the families as a map of the health file: one row per family, a bar of its skills by rating, those failing marked. Pure. */
const SHADE = { proven: 'rgb(var(--d-key, 158 178 255) / .95)', checked: 'rgb(var(--d-key, 158 178 255) / .58)', tested: 'rgb(var(--d-key, 158 178 255) / .30)', experiment: 'rgba(255,255,255,.10)' };
export function familyMapHtml(esc, fam) {
  const rows = ((fam && fam.families) || []).filter((f) => f && Array.isArray(f.skills) && f.skills.length);
  if (!rows.length) return '';
  const row = (f) => {
    const n = f.skills.length, cnt = Object.fromEntries(TIERS.map((t) => [t, f.skills.filter((s) => s.tier === t).length]));
    const bad = f.skills.filter((s) => (Array.isArray(s.smoke) && s.smoke.length) || (Array.isArray(s.failing) && s.failing.length)).length;
    const label = f.name + ': ' + TIERS.map((t) => cnt[t] + ' ' + t).join(', ') + (bad ? ', ' + bad + ' failing' : '');
    return '<div class="gi-fam" data-fam="' + esc(f.id || f.name) + '" style="display:flex;gap:8px;align-items:center;margin:3px 0">'
      + '<span style="flex:0 0 38%;min-width:0;font-size:12px;overflow-wrap:anywhere">' + esc(f.name) + '</span>'
      + '<span role="img" aria-label="' + esc(label) + '" style="flex:1;display:flex;height:9px;border-radius:5px;overflow:hidden;background:rgba(255,255,255,.04);box-shadow:0 0 0 1px rgba(255,255,255,.06) inset">'
      + TIERS.filter((t) => cnt[t]).map((t) => '<i data-tier="' + t + '" style="width:' + Math.round(cnt[t] / n * 1000) / 10 + '%;background:' + SHADE[t] + '"></i>').join('') + '</span>'
      + '<span style="flex:0 0 auto;font-size:12px;font-variant-numeric:tabular-nums;color:' + (bad ? '#e06a5a' : '#8a8a92') + '">' + (bad ? bad + ' failing' : cnt.proven + '/' + n) + '</span></div>';
  };
  return '<div class="growth-fam-map" data-fam-map="' + rows.length + '" style="margin:6px 0"><div class="sub" style="font-size:12px;margin-bottom:2px">Skill health by family, from the published health file (/skills/families.json, operationId skillHealth): proven, checked, tested, experiment</div>'
    + rows.map(row).join('') + '</div>';
}

/** the skills promoted lately with the clean runs in a row each has had since (families.json `promoted`, `streak`): newest promotion first. Pure. */
export function promotedRows(fam, days = 30, today = new Date().toISOString().slice(0, 10)) {
  const t = Date.parse(today + 'T00:00:00Z');
  return skillsOf(fam).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s.promoted || '')) && (t - Date.parse(s.promoted + 'T00:00:00Z')) / 864e5 <= days)
    .map((s) => ({ name: s.name, tier: s.tier, promoted: s.promoted, streak: Number.isFinite(+s.streak) ? +s.streak : 0 }))
    .sort((a, b) => b.promoted.localeCompare(a.promoted) || b.streak - a.streak || a.name.localeCompare(b.name));
}
export function promotedHtml(esc, rows) {
  if (!rows || !rows.length) return '';
  const steady = rows.filter((r) => r.streak >= 3).length;
  return ' Skill stability: ' + rows.length + ' skill' + (rows.length === 1 ? '' : 's') + ' promoted lately, ' + steady + ' with 3 or more clean runs in a row: '
    + rows.slice(0, 5).map((r) => '<b style="font-weight:600">' + esc(r.name) + '</b> to ' + esc(r.tier) + ' ' + esc(r.promoted) + ', ' + r.streak + ' clean run' + (r.streak === 1 ? '' : 's') + ' in a row').join('; ')
    + (rows.length > 5 ? '; and ' + (rows.length - 5) + ' more' : '') + '.';
}

/** which growth animation a day's change calls for (the ledger's new skills in the last day, and the better card's skill count against the
 * day before): none, a bloom for one new skill, a burst for three or more. Names come from the ledger lines, never from a visitor. Pure. */
export function bloomPlan(added, rows) {
  const names = (added || []).filter(Boolean);
  const r = Array.isArray(rows) ? rows : [], a = r.length > 1 && r[r.length - 1].facts, b = r.length > 1 && r[r.length - 2].facts;
  const delta = a && b && Number.isFinite(+a.skills) && Number.isFinite(+b.skills) ? +a.skills - +b.skills : null;
  const n = delta !== null ? Math.max(delta, 0) : names.length; // the day-over-day count is the truth when the better card has two days; the ledger lines only name them
  return { kind: n >= 3 ? 'burst' : n >= 1 ? 'bloom' : 'none', count: n, delta, names: names.slice(0, 5) };
}
export function bloomHtml(esc, plan) {
  if (!plan || plan.kind === 'none') return '';
  return '<div class="sub growth-bloom" data-bloom="' + esc(plan.kind) + '" style="line-height:1.45">Since yesterday: ' + plan.count + ' new skill' + (plan.count === 1 ? '' : 's')
    + (plan.names.length ? ' (' + plan.names.map(esc).join('; ') + ')' : '') + (plan.delta !== null && plan.delta > 0 ? ', ' + plan.delta + ' more on the better card than the day before' : '') + '.</div>';
}

const STOP = new Set('the a an and or of to in on for with that this so it its my me i can be is are as by from into at not no when every each all any new more than then which what who how via like just also only you your will so one two make use using create implement build add'.split(' '));
const stem = (w) => w.replace(/(ings?|ies|ied|ed|es|s|ly)$/, '');
const tokens = (t) => { const seen = new Set(), out = []; for (const w of String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')) { if (w.length <= 3 || STOP.has(w)) continue; const k = stem(w); if (k.length > 2 && !seen.has(k)) { seen.add(k); out.push({ w, k }); } } return out; };
export const wordsOf = (t) => tokens(t).map((x) => x.k);
/** an ask against the ledger line that built it: the words of the ask the line never says. { share, left: [words], said: [words] }; share is the
 * part of the ask's content words the build mentions (1 = every word). Pure. */
export function diverge(ask, built) {
  const a = tokens(ask), b = new Set(wordsOf(built));
  if (a.length < 3) return null;
  const said = a.filter((x) => b.has(x.k)), left = a.filter((x) => !b.has(x.k));
  return { share: Math.round(said.length / a.length * 100) / 100, left: left.map((x) => x.w), said: said.map((x) => x.w) };
}
/** the divergence rows for the inbox: every built ask (follow.recent: [{ ask, what, at }]) that leaves out at least `gap` of its words, widest gap first. Pure. */
export function divergences(recent, gap = 0.5) {
  return (recent || []).map((r) => { const d = r && diverge(r.ask, r.what); return d && d.share <= 1 - gap ? { ask: r.ask, what: r.what, at: r.at, ...d } : null; }).filter(Boolean).sort((x, y) => x.share - y.share);
}
export function divergenceHtml(esc, recent, total) {
  const rows = divergences(recent), n = (recent || []).length;
  if (!n) return '';
  if (!rows.length) return '<div class="sub growth-diverge" data-diverge="0" style="line-height:1.45">Divergence: the last ' + n + ' built asks are each echoed in the line that built them.</div>';
  return '<div class="sub growth-diverge" data-diverge="' + rows.length + '" style="line-height:1.45">Divergence: ' + rows.length + ' of the last ' + n + ' built asks leave out half or more of my words: '
    + rows.slice(0, 3).map((r) => '“' + esc(r.ask) + '” built as “' + esc(String(r.what || '')) + '”, not in it: <mark style="background:rgba(224,162,74,.25);color:inherit">' + r.left.slice(0, 6).map(esc).join(', ') + '</mark>').join('; ') + '.</div>';
}
