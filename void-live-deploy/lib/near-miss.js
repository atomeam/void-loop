// A near miss becomes a visible proposal (asked by Void twice, domains/void.voice.md, 2026-10-14: "Create a visual 'near-miss'
// skill proposal when a user ask fails to map to an existing skill."). When an ask maps to no skill and Verse says "I don't
// know this yet", and the router (lib/router.js) found a skill whose asks scored near its bar, the card adds
// "Did you mean <that skill's first example>?" as a data-ask link, so one tap runs the ask the skill answers. The server side
// (functions/api/answer.js) turns the router's decision into `near` with nearOf; the page turns `near` into the line with
// proposalOf and proposalHtml. Pure: no DOM, no fetch, nothing stored; the route log already held the nearest skill.
export const CLOSE = 0.1; // how far under the skill bar an ask still counts as nearly that skill (lib/router.js CLOSE)
const NAME = /^[a-z0-9_-]{1,24}$/; // a skill name from the router's own table, nothing typed by a person
const num = (x) => (Number.isFinite(+x) ? +x : null);

/** the router's decision + its skill table -> { skill, score, bar, example } when a skill was nearly it, else null */
export function nearOf(route, skills, close = CLOSE) {
  if (!route || !skills) return null;
  let skill = null, score = null, bar = null;
  if (route.kind === 'skill' && route.skill) { skill = route.skill; score = num(route.score); bar = num(route.nearest && route.nearest.bar); }
  else if (route.nearest && route.nearest.skill) {
    skill = route.nearest.skill; score = num(route.nearest.score); bar = num(route.nearest.bar);
    if (score === null || bar === null || score < bar - close) return null;
  } else return null;
  if (!NAME.test(String(skill))) return null;
  const ex = skills[skill] && skills[skill].examples;
  const example = Array.isArray(ex) && typeof ex[0] === 'string' ? ex[0].trim() : '';
  if (!example) return null;
  return { skill, score, bar, example };
}

/** what the page got from /api/answer -> { skill, ask, line } to show, or null for anything that is not a near miss */
export function proposalOf(near) {
  if (!near || typeof near !== 'object') return null;
  const skill = String(near.skill || ''), ask = String(near.example || '').replace(/\s+/g, ' ').trim();
  if (!NAME.test(skill) || !ask || ask.length > 120 || /[<>]/.test(ask)) return null;
  return { skill, ask, line: 'Did you mean “' + ask + '”?' };
}

/** the line under the refusal: a data-ask link the page runs on a tap (esc: the page's HTML escaper) */
export function proposalHtml(esc, proposal) {
  const p = proposal && proposal.ask ? proposal : proposalOf(proposal);
  if (!p) return '';
  return '<div class="src near-miss">Did you mean <a href="#" data-ask="' + esc(p.ask) + '" data-skill="' + esc(p.skill) + '">' + esc(p.ask) + '</a>?</div>';
}
