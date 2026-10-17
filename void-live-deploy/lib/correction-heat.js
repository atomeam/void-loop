// The family-health heat-map on the self card (asked by Void): error density per family, from the real correction log and the families file,
// nothing else. A family's density is its kept corrections divided by its skill count (familyDrivers in lib/better.js supplies the skill counts,
// so a family with no corrections still shows, cold). Each cell's heat is its density against the hottest family's. With no corrections it says
// so and draws no number; corrections whose skill is in no family are counted apart, never spread over the families. Pure; all text escaped.
import { familyDrivers } from './better.js';
import { groupByFamily } from './corrections.js';

/** { rows: [{ id, name, skills, errors, density, heat }], unplaced, total } sorted hottest first (ties by name). density = errors per skill, 2 places; heat 0..1. Pure. */
export function heatRows(list, fam) {
  const groups = groupByFamily(list, fam), by = new Map(groups.map((g) => [g.id, g.items.length]));
  const rows = familyDrivers(fam).map((d) => { const errors = by.get(d.id) || 0; return { id: d.id, name: d.name, skills: d.skills, errors, density: Math.round(100 * errors / d.skills) / 100, heat: 0 }; });
  const max = Math.max(0, ...rows.map((r) => r.density));
  for (const r of rows) r.heat = max > 0 ? Math.round(100 * r.density / max) / 100 : 0;
  rows.sort((a, b) => b.density - a.density || a.name.localeCompare(b.name));
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return { rows, unplaced: by.get('unplaced') || 0, total };
}

const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** the heat-map's markup. An honest empty state when nothing is kept (and when the families file could not be read). Pure. */
export function heatHtml(list, fam, esc = escHtml) {
  const h = heatRows(list, fam), head = '<div class="vh">Where I get things wrong</div>';
  if (!h.total) return head + '<div class="sub" data-heat-empty="1">No corrections yet. When you tell me what I got wrong, the families it falls in light up here.</div>';
  if (!h.rows.length) return head + '<div class="sub" data-heat-empty="1">The skill families could not be read just now, so I cannot place ' + esc(h.total) + ' kept correction' + (h.total === 1 ? '' : 's') + ' by family.</div>';
  return head + '<div class="sub">Corrections kept on this device per skill in each family; the brightest cell is the hottest family. Nothing here is estimated.</div>'
    + '<div class="ch-grid" data-heat="1" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;margin:6px 0">'
    + h.rows.map((r) => '<div class="ch-cell" data-family="' + esc(r.id) + '" data-heat-level="' + esc(r.heat) + '" title="' + esc(r.name + ': ' + r.errors + ' correction' + (r.errors === 1 ? '' : 's') + ' over ' + r.skills + ' skills') + '" style="padding:8px;border-radius:8px;background:rgba(255,120,90,' + (0.06 + 0.5 * r.heat).toFixed(2) + ');border:1px solid rgba(255,255,255,.1)">'
      + '<b style="font-weight:600">' + esc(r.name) + '</b><br><span style="font-variant-numeric:tabular-nums">' + esc(r.errors) + '</span> <span class="sub">of ' + esc(r.skills) + ' skills · ' + esc(r.density.toFixed(2)) + ' each</span></div>').join('') + '</div>'
    + (h.unplaced ? '<div class="sub">' + esc(h.unplaced) + ' more ' + (h.unplaced === 1 ? 'is' : 'are') + ' about answers no skill family owns, so ' + (h.unplaced === 1 ? 'it is' : 'they are') + ' not in the map.</div>' : '');
}
