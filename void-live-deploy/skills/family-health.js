/**
 * family-health skill - "show me your skill families", "family health", "how healthy are your skills": every skill family and how
 * far its skills are checked, from skills/families.json (tools/families.mjs; ratings from evidence only, never self-described).
 * Asked by Void (its reflection of 2026-10-15): "Implement the 'family-health' dashboard card to visualize evidence ratings
 * (proven, checked, tested, experiment) for all 9 families."
 * The card: the totals on top, one row per family with a stacked bar of its proven / checked / tested / experiment counts; tap a
 * family to list its skills with their rating and the reason (the `why` the evidence gave). One accent (--d-key) at four strengths.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export const FAMILIES_URL = '/skills/families.json';
export const TIERS = ['proven', 'checked', 'tested', 'experiment']; // strongest first, the order of the bar
// what each rating means, in the words of tools/families.mjs
export const MEANS = {
  proven: 'all three kinds of evidence, or two with at least 3 real asks',
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

const WHEN = new RegExp('^(?:(?:show|open|give|list)(?:\\s+me)?\\s+)?(?:the\\s+|your\\s+|void\'?s\\s+|v01d\'?s\\s+)?'
  + '(?:skill(?:s)?\\s+famil(?:y|ies)(?:\\s+(?:health|ratings?|dashboard))?|(?:skill\\s+)?family\\s+health(?:\\s+(?:card|dashboard))?|skill\\s+health|'
  + 'evidence\\s+ratings?|skill\\s+ratings?)$'
  + '|^how\\s+(?:healthy|well[\\s-]tested|well[\\s-]checked|proven|reliable)\\s+(?:are|is)\\s+(?:your|void\'?s|v01d\'?s)\\s+skills$'
  + '|^how\\s+(?:healthy|well[\\s-]tested)\\s+(?:are|is)\\s+(?:your|void\'?s|v01d\'?s)\\s+skill\\s+families$', 'i');
const norm = (t) => String(t || '').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').replace(/[?.!]+$/, '').trim();
export const asksHealth = (t) => WHEN.test(norm(t));

/** the card's numbers from families.json: totals and one row per family, in the file's order. Pure. */
export function healthRows(fam) {
  const families = ((fam && fam.families) || []).filter((f) => f && Array.isArray(f.skills));
  const rows = families.map((f) => {
    const count = Object.fromEntries(TIERS.map((t) => [t, f.skills.filter((s) => s && s.tier === t).length]));
    const skills = f.skills.filter((s) => s && s.name).slice().sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || String(a.name).localeCompare(String(b.name)));
    return { id: String(f.id || f.name || ''), name: String(f.name || f.id || ''), for: String(f.for || ''), total: skills.length, count, skills };
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

/** one family's skills, strongest first: name, rating, and the evidence behind it. Pure. */
export function skillsHtml(esc, row) {
  return '<ul class="fh-skills" style="list-style:none;margin:6px 0 10px;padding:0">' + row.skills.map((s) => {
    const fail = Array.isArray(s.failing) && s.failing.length;
    return '<li data-skill="' + esc(s.name) + '" style="display:flex;gap:10px;align-items:baseline;padding:5px 0;border-top:1px solid rgba(255,255,255,.05)">'
      + '<span aria-hidden="true" style="flex:none;width:8px;height:8px;border-radius:50%;background:' + (SHADE[s.tier] || SHADE.experiment) + ';box-shadow:0 0 0 1px rgba(255,255,255,.12) inset"></span>'
      + '<span style="flex:1;min-width:0"><b style="font-weight:600;color:var(--d-ink,#f2f4fb)">' + esc(s.name) + '</b> '
      + '<span class="fh-tier" style="color:var(--d-ink-2,#c3c8d8)">' + esc(s.tier || 'unrated') + '</span>'
      + '<br><span class="fh-why" style="font-size:13px;color:var(--d-ink-3,#8e94a8)">' + esc(s.why || '')
      + (fail ? '; the everyday benchmark got ' + s.failing.length + ' of its asks wrong on its last run' : '') + '</span></span></li>';
  }).join('') + '</ul>';
}

/** the whole card's body (below the title). Pure. */
export function healthHtml(esc, fam) {
  const H = healthRows(fam);
  if (!H.rows.length) return '<p>The skill families could not be read just now. Ask again in a moment.</p>';
  const tile = (t) => '<div style="flex:1 1 0;min-width:64px"><div class="big" data-total="' + t + '" style="font-size:28px;line-height:1.1">' + H.totals[t] + '</div>'
    + '<div class="sub" style="font-size:12px;display:flex;align-items:center;gap:5px"><span aria-hidden="true" style="width:8px;height:8px;border-radius:2px;background:' + SHADE[t] + '"></span>' + t + '</div></div>';
  return '<div class="sub" style="font-size:13px;margin:2px 0 10px">' + H.skills + ' skills in ' + H.rows.length + ' families, rated from evidence alone.</div>'
    + '<div class="fh-totals" style="display:flex;gap:12px;margin:0 0 6px">' + TIERS.map(tile).join('') + '</div>'
    + bar(H.totals, H.skills, esc('all skills: ' + words(H.totals)))
    + '<div class="fh-rows" style="margin-top:14px">' + H.rows.map((r) => '<div class="fh-family" data-family="' + esc(r.id) + '">'
      + '<button type="button" aria-expanded="false" data-open="' + esc(r.id) + '" style="all:unset;box-sizing:border-box;display:block;width:100%;min-height:44px;padding:8px 0;cursor:pointer;border-top:1px solid rgba(255,255,255,.06)">'
      + '<span style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:6px"><b style="font-weight:600;color:var(--d-ink,#f2f4fb)">' + esc(r.name) + '</b>'
      + '<span class="sub" style="font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap">' + r.count.proven + ' of ' + r.total + ' proven <span aria-hidden="true">›</span></span></span>'
      + bar(r.count, r.total, esc(r.name + ': ' + words(r.count)))
      + '</button><div class="fh-open" hidden>' + (r.for ? '<div class="sub" style="font-size:13px;margin:4px 0 0">For ' + esc(r.for) + '.</div>' : '') + skillsHtml(esc, r) + '</div></div>').join('') + '</div>'
    + '<div class="sub" style="font-size:12px;line-height:1.5;margin-top:10px">The three kinds of evidence: a skill\'s own self-test, the browser suite, and real asks in the everyday benchmark. '
    + TIERS.map((t) => '<b style="font-weight:600">' + t + '</b>: ' + MEANS[t]).join('; ') + '. Tap a family to see each skill and why.</div>'
    + '<div class="src">Source: skills/families.json, written from the repo by tools/families.mjs</div>';
}

async function run(text, api) {
  const { showPage, esc, _pageStill } = api;
  const head = '<h2>How healthy my skills are</h2>';
  const el = showPage((p) => { p.innerHTML = head + '<div class="sub">reading the families…</div>'; });
  let fam = null;
  try { const r = await fetch(FAMILIES_URL, { cache: 'no-cache' }); fam = r.ok ? await r.json() : null; } catch (_) { fam = null; }
  if (!el || (_pageStill && !_pageStill(el))) return 'family-health';
  el.innerHTML = head + healthHtml(esc, fam);
  el.addEventListener('click', (e) => {
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
    { id: 'a', name: 'Alpha', for: 'x', skills: [{ name: 'p', tier: 'proven', why: 'a self-test' }, { name: 'e', tier: 'experiment', why: 'nothing checks it yet' }, { name: 'c', tier: 'checked', why: 'two', failing: ['q <i>'] }] },
    { id: 'b', name: 'Be <ta>', skills: [{ name: 't', tier: 'tested', why: 'one' }] },
  ] };
  const H = healthRows(fam), h = healthHtml(esc, fam);
  const ok = H.skills === 4 && H.rows.length === 2 && H.totals.proven === 1 && H.totals.checked === 1 && H.totals.tested === 1 && H.totals.experiment === 1
    && H.rows[0].skills.map((s) => s.name).join() === 'p,c,e' && h.includes('Be &lt;ta&gt;') && !h.includes('<ta>') && h.includes('1 of 3 proven')
    && h.includes('got 1 of its asks wrong') && h.includes('4 skills in 2 families') && healthHtml(esc, null).includes('could not be read')
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
