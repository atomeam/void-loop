/**
 * Backlog digest (asked by Verse: "a 'backlog-digest' skill summarising unbuilt asks by Family and Evidence Rating"): Verse's own
 * unbuilt asks (GET /api/reflect `asks`) grouped by the skill family each one names, with the evidence rating of the skills it
 * names (skills/families.json: experiment < tested < checked < proven). An ask names a skill when the skill's name (dashes as
 * spaces, at least 4 letters) is a whole-word part of it; an ask naming none goes under "No family yet", never guessed. A group's
 * rating is the weakest of its skills, because a backlog is read to see where the footing is thin. Pure; the skill fetches.
 */
export const TIERS = ['experiment', 'tested', 'checked', 'proven'];
const norm = (s) => String(s || '').toLowerCase().replace(/[-_]+/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** skill name -> { family, familyName, tier } from families.json. Pure. */
export function skillTable(fam) {
  const t = new Map();
  for (const f of (fam && Array.isArray(fam.families) ? fam.families : [])) for (const s of (f && f.skills) || []) {
    if (s && s.name && !t.has(s.name)) t.set(s.name, { family: f.id, familyName: f.name || f.id, tier: TIERS.includes(s.tier) ? s.tier : 'experiment' });
  }
  return t;
}
const weakest = (tiers) => tiers.reduce((w, t) => (TIERS.indexOf(t) < TIERS.indexOf(w) ? t : w), 'proven');

/** the skills of the table an ask names, longest name first, each once. Pure. */
export function skillsNamed(ask, table) {
  const text = ' ' + norm(ask) + ' ', hit = [];
  for (const name of [...table.keys()].sort((a, b) => b.length - a.length)) {
    const w = norm(name);
    if (w.length >= 4 && text.includes(' ' + w + ' ') && !hit.some((h) => norm(h).includes(w))) hit.push(name);
  }
  return hit;
}

/** whole days an ask has waited unbuilt (asked by Verse: "a 'velocity' metric to the backlog digest showing how many days an ask has remained
 *  unbuilt"): from its `at`, or the date in its id (ask-YYYYMMDD-...); null when neither says, never guessed. Pure. */
export function daysOpen(a, now = Date.now()) {
  const at = a && a.at ? Date.parse(a.at) : NaN, m = /^ask-(\d{4})(\d\d)(\d\d)-/.exec(String(a && a.id || ''));
  const t = Number.isFinite(at) ? at : m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  return Number.isFinite(t) && now >= t ? Math.floor((now - t) / 864e5) : null;
}
/** { groups: [{ id, name, tier, asks: [{ text, skills: [{ name, tier }], days }] }], total, placed, oldest, median }; weakest evidence first, "none" last. Pure. */
export function digestOf(asks, fam, now = Date.now(), ledger = null) {
  const table = skillTable(fam), by = new Map(), none = [];
  for (const a of Array.isArray(asks) ? asks : []) {
    const text = String(a && (a.ask || a.text) || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!text) continue;
    const days = daysOpen(a, now);
    const named = skillsNamed(text, table).map((name) => ({ name, tier: table.get(name).tier, family: table.get(name).family }));
    if (!named.length) { none.push({ text, skills: [], days }); continue; }
    const id = named[0].family, g = by.get(id) || { id, name: table.get(named[0].name).familyName, asks: [] };
    g.asks.push({ text, skills: named.map(({ name, tier }) => ({ name, tier })), days }); by.set(id, g);
  }
  const groups = [...by.values()].map((g) => ({ ...g, tier: weakest(g.asks.flatMap((a) => a.skills.map((s) => s.tier))), ...(ledger ? { builder: builderOf(g.id, fam, ledger, [...new Set(g.asks.flatMap((a) => a.skills.map((x) => x.name)))]) } : {}) }))
    .sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || b.asks.length - a.asks.length || a.name.localeCompare(b.name));
  if (none.length) groups.push({ id: 'none', name: 'No family yet', tier: '', asks: none });
  const total = groups.reduce((n, g) => n + g.asks.length, 0), ages = groups.flatMap((g) => g.asks.map((x) => x.days)).filter((d) => d != null).sort((x, y) => x - y);
  return { groups, total, placed: total - none.length, oldest: ages.length ? ages[ages.length - 1] : null, median: ages.length ? ages[Math.floor((ages.length - 1) / 2)] : null };
}

/** the suggested builder of a family (asked by Verse: "a 'suggested builder' tag to digest items, mapping specific fails to the builder
 *  who last touched that family"): the newest growth-ledger entry (void.growth.json) that names one of the family's skills as a whole
 *  word, and who wrote it ({ by, at, skill }); null when no entry names one, never guessed. Pure. */
export function builderOf(familyId, fam, ledger, prefer = []) {
  const f = (fam && Array.isArray(fam.families) ? fam.families : []).find((x) => x && x.id === familyId);
  // a skill the ask names comes first; then the family's skills whose names cannot be an everyday word (a dash, or 7+ letters): "place" or "memory" in a line is not that skill
  const plain = (n) => /-/.test(n) || norm(n).length >= 7;
  const names = ((f && f.skills) || []).map((x) => x && x.name).filter((n) => n && plain(n));
  const list = Array.isArray(ledger) ? ledger : (ledger && ledger.entries) || [];
  const first = (prefer || []).filter(Boolean);
  for (const pool of [first, names]) { if (!pool.length) continue; const hitIn = scan(list, pool); if (hitIn) return hitIn; }
  return null;
}
function scan(list, names) {
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]; if (!e || !e.by || !e.what) continue;
    const text = ' ' + norm(e.what) + ' ', hit = names.find((n) => text.includes(' ' + norm(n) + ' '));
    if (hit) return { by: String(e.by), at: String(e.at || '').slice(0, 10), skill: hit };
  }
  return null;
}
const dayWord = (n) => (n === 0 ? 'under a day' : n + ' day' + (n === 1 ? '' : 's'));
/** the card body. esc escapes for HTML; every value goes through it. Pure. */
export function digestHtml(d, esc) {
  if (!d || !d.total) return '<h2>Backlog digest</h2><p>Nothing is waiting: every ask I made has been built.</p>';
  return '<h2>Backlog digest</h2><div class="sub">' + esc(d.total) + ' unbuilt ask' + (d.total === 1 ? '' : 's') + ', ' + esc(d.placed) + ' placed in a family by the skills they name, weakest footing first.'
    + (d.oldest != null ? ' Velocity: the oldest has waited <b data-oldest="' + esc(d.oldest) + '">' + esc(dayWord(d.oldest)) + '</b>, the median ' + esc(dayWord(d.median)) + '.' : '') + '</div>'
    + d.groups.map((g) => '<section data-family="' + esc(g.id) + '" data-n="' + esc(g.asks.length) + '"><h3 style="margin:12px 0 2px;font-size:15px">' + esc(g.name) + ' <span class="sub">(' + esc(g.asks.length) + ')'
      + (g.tier ? ' · weakest evidence: <b data-tier="' + esc(g.tier) + '">' + esc(g.tier) + '</b>' : '') + (g.builder ? ' · suggested builder: <b data-builder="' + esc(g.builder.by) + '">' + esc(g.builder.by) + '</b> (last touched ' + esc(g.builder.skill) + (g.builder.at ? ' on ' + esc(g.builder.at) : '') + ')' : '') + '</span></h3><ul style="margin:2px 0 0;padding-left:18px">'
      + g.asks.map((a) => '<li' + (a.days != null ? ' data-days="' + esc(a.days) + '"' : '') + '>' + esc(a.text) + (a.days != null ? ' <span class="sub">· ' + esc(dayWord(a.days)) + ' unbuilt</span>' : '') + (a.skills.length ? ' <span class="sub">(' + a.skills.map((s) => esc(s.name) + ': ' + esc(s.tier)).join(', ') + ')</span>' : '') + '</li>').join('') + '</ul></section>').join('')
    + '<div class="src">Source: my open asks (/api/reflect), the evidence ratings in skills/families.json and, for the suggested builder, who last wrote a growth-ledger line naming one of the family\'s skills (void.growth.json). An ask is placed only by a skill it names; the rest are not guessed. My own records, no model.</div>';
}
