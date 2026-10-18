// A card that rests on thin evidence says so (asked by Verse: "a visual warning when a card rests on tested or experiment evidence"):
// the skill that answered is looked up in skills/families.json (tools/families.mjs, ratings from evidence only) and, when its rating
// is "experiment" or "tested", one line joins the card's source line. Checked and proven skills say nothing. Pure.
export const THIN = ['experiment', 'tested'];

/** { tier, why } for a skill name in families.json, or null when it is not there. */
export function ratingOf(fams, name) {
  for (const f of (fams && Array.isArray(fams.families) ? fams.families : []))
    for (const s of (f && Array.isArray(f.skills) ? f.skills : [])) if (s && s.name === name && typeof s.tier === 'string') return { tier: s.tier, why: String(s.why || '') };
  return null;
}

/** the line for a thin rating, or '' (nothing to say) */
export function noteText(r) {
  if (!r || !THIN.includes(r.tier)) return '';
  return 'rated ' + r.tier + (r.why ? ' (' + r.why + ')' : '') + (r.tier === 'experiment' ? ': not checked yet' : ': a young skill, check what it says');
}
