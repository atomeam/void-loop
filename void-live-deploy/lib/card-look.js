// Style inheritance for cards (asked by Verse: "Sky and earth cards should feel organic and atmospheric, while Numbers and money cards should adopt a clean, technical
// blueprint aesthetic to prevent visual noise."). The skill's family (skills/families.json, the names in lib/art-rules.js FAMILIES) decides a frame look: 'organic'
// for Sky and earth, 'blueprint' for Numbers and money, nothing for the rest (they keep the plain foil frame). The look is a data attribute on the card
// (data-look) and the tint and pattern are CSS only (CARD_CSS in lib/card-frame.js). Pure: no network, no model.
import { familyOf } from './art-rules.js';

export const LOOKS = { 'Sky and earth': 'organic', 'Numbers and money': 'blueprint' };
/** the frame look of a family given by its name or its id in families.json ('sky', 'numbers'), or ''. Pure. */
export function lookOfFamily(fam, key) {
  const k = String(key == null ? '' : key).toLowerCase(), f = ((fam && fam.families) || []).find((x) => x && (String(x.id).toLowerCase() === k || String(x.name || '').toLowerCase() === k));
  return LOOKS[familyOf(f ? f.name : key)] || '';
}
/** the frame look of a skill by name: the look of the family that lists it, or ''. Pure. */
export function lookOfSkill(fam, name) {
  for (const f of (fam && fam.families) || []) if ((f.skills || []).some((s) => s && s.name === name)) return LOOKS[familyOf(f.name)] || '';
  return '';
}
/** the CSS: organic is a soft green-teal tint with layered radial "mist" and rounder corners; blueprint is a blue tint with a fine grid and a heavier grid every fifth line. */
export const LOOK_CSS = [
  '.vpage.vcard[data-look=organic]{--edge:hsl(150 38% 52%);border-radius:30px 18px 30px 18px!important;',
  'background:radial-gradient(ellipse at 20% 0%,rgba(120,200,160,.22),transparent 55%) padding-box,radial-gradient(ellipse at 90% 100%,rgba(110,170,230,.2),transparent 50%) padding-box,linear-gradient(170deg,hsl(165 30% 15%),hsl(200 28% 9%)) padding-box,var(--foil) border-box!important}',
  '.vpage.vcard[data-look=blueprint]{--edge:hsl(205 75% 58%);border-radius:6px!important;',
  'background:linear-gradient(rgba(120,190,255,.16) 1px,transparent 1px) 0 0/40px 40px padding-box,linear-gradient(90deg,rgba(120,190,255,.16) 1px,transparent 1px) 0 0/40px 40px padding-box,linear-gradient(rgba(120,190,255,.07) 1px,transparent 1px) 0 0/8px 8px padding-box,linear-gradient(90deg,rgba(120,190,255,.07) 1px,transparent 1px) 0 0/8px 8px padding-box,linear-gradient(170deg,hsl(215 55% 16%),hsl(220 55% 9%)) padding-box,var(--foil) border-box!important}',
  '.vpage.vcard[data-look=blueprint] .vc-title{font-family:ui-monospace,Menlo,Consolas,monospace!important;letter-spacing:.08em}',
].join('');
