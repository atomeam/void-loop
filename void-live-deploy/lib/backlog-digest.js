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

/** { groups: [{ id, name, tier, asks: [{ text, skills: [{ name, tier }] }] }], total, placed }; weakest evidence first, "none" last. Pure. */
export function digestOf(asks, fam) {
  const table = skillTable(fam), by = new Map(), none = [];
  for (const a of Array.isArray(asks) ? asks : []) {
    const text = String(a && (a.ask || a.text) || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!text) continue;
    const named = skillsNamed(text, table).map((name) => ({ name, tier: table.get(name).tier, family: table.get(name).family }));
    if (!named.length) { none.push({ text, skills: [] }); continue; }
    const id = named[0].family, g = by.get(id) || { id, name: table.get(named[0].name).familyName, asks: [] };
    g.asks.push({ text, skills: named.map(({ name, tier }) => ({ name, tier })) }); by.set(id, g);
  }
  const groups = [...by.values()].map((g) => ({ ...g, tier: weakest(g.asks.flatMap((a) => a.skills.map((s) => s.tier))) }))
    .sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || b.asks.length - a.asks.length || a.name.localeCompare(b.name));
  if (none.length) groups.push({ id: 'none', name: 'No family yet', tier: '', asks: none });
  const total = groups.reduce((n, g) => n + g.asks.length, 0);
  return { groups, total, placed: total - none.length };
}

/** the card body. esc escapes for HTML; every value goes through it. Pure. */
export function digestHtml(d, esc) {
  if (!d || !d.total) return '<h2>Backlog digest</h2><p>Nothing is waiting: every ask I made has been built.</p>';
  return '<h2>Backlog digest</h2><div class="sub">' + esc(d.total) + ' unbuilt ask' + (d.total === 1 ? '' : 's') + ', ' + esc(d.placed) + ' placed in a family by the skills they name, weakest footing first.</div>'
    + d.groups.map((g) => '<section data-family="' + esc(g.id) + '" data-n="' + esc(g.asks.length) + '"><h3 style="margin:12px 0 2px;font-size:15px">' + esc(g.name) + ' <span class="sub">(' + esc(g.asks.length) + ')'
      + (g.tier ? ' · weakest evidence: <b data-tier="' + esc(g.tier) + '">' + esc(g.tier) + '</b>' : '') + '</span></h3><ul style="margin:2px 0 0;padding-left:18px">'
      + g.asks.map((a) => '<li>' + esc(a.text) + (a.skills.length ? ' <span class="sub">(' + a.skills.map((s) => esc(s.name) + ': ' + esc(s.tier)).join(', ') + ')</span>' : '') + '</li>').join('') + '</ul></section>').join('')
    + '<div class="src">Source: my open asks (/api/reflect) and the evidence ratings in skills/families.json. An ask is placed only by a skill it names; the rest are not guessed. My own records, no model.</div>';
}
