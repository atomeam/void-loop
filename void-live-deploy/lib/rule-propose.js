// "Propose a rule in words" (frontier #35): a sentence in, a rule out, by pattern. Pure, no model, no guessing: a sentence that matches none of
// the shapes below returns { rule: null, reason } and nothing is made up. Every rule it makes goes through validateRule before it is returned.
// The model-assisted version (any sentence, checked by the same validator) is the next step on the frontier.
import { validateRule } from './rules-engine.js';

const NUMS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const num = (w) => (/^\d{1,3}$/.test(w) ? +w : NUMS[w] == null ? null : NUMS[w]);
const CMP = { over: 'gt', above: 'gt', 'more than': 'gt', 'at least': 'gte', under: 'lt', below: 'lt', 'less than': 'lt', 'at most': 'lte' };
const ANY = ['card', 'cards', 'thing', 'things', 'one', 'ones', 'piece', 'pieces'];
/** "creatures" -> "creature", "witches" -> "witch": the kind word a card carries */
export const singular = (w) => (/(ch|sh|ss|x)es$/.test(w) ? w.slice(0, -2) : /[^s]s$/.test(w) ? w.slice(0, -1) : w);
const kindCond = (k) => (ANY.includes(k) ? [] : [{ fact: 'cardKind', cmp: 'eq', value: singular(k) }]);
const hash = (t) => { let h = 7; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(36).slice(0, 4); };
const slug = (t) => 'prop-' + t.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28).replace(/-$/, '') + '-' + hash(t);

const SHAPES = [
  // when a song is summoned, gain 1 (coins)
  [/^(?:when|whenever|each time) (?:a|an|any) ([a-z-]{2,20}) is summoned,? (?:you )?gain (\w+)(?: coins?)?$/, (m, t) => {
    const n = num(m[2]); if (n == null) return null;
    return { id: slug(t), source: 'proposed', layer: 3, when: 'summon', if: kindCond(m[1]), then: [{ do: 'gain', resource: 'coins', n }] };
  }],
  // creatures cannot attack on turn one / until turn three
  [/^([a-z-]{2,20}) (?:cannot|can not|can't|may not) attack (on|until|before) turn (\w+)$/, (m, t) => {
    const n = num(m[3]); if (n == null || n < 1) return null;
    const when = m[2] === 'on' ? { fact: 'round', cmp: 'eq', value: n } : { fact: 'round', cmp: 'lt', value: n };
    return { id: slug(t), source: 'proposed', layer: 1, when: 'attack', if: [...kindCond(m[1]), when], then: [{ do: 'deny', reason: m[1] + ' cannot attack ' + m[2] + ' turn ' + n }] };
  }],
  // a card with power over 6 costs one more
  [/^(?:a|any) (?:card|creature|thing) with (power|resistance|income|speed) (over|above|more than|at least|under|below|less than|at most) (\w+) costs? (\w+) (more|less)$/, (m, t) => {
    const v = num(m[3]), n = num(m[4]); if (v == null || n == null) return null;
    return { id: slug(t), source: 'proposed', layer: 2, when: 'summon', if: [{ fact: 'card' + m[1][0].toUpperCase() + m[1].slice(1), cmp: CMP[m[2]], value: v }],
      then: [{ do: 'modify', stat: 'cost', add: m[5] === 'more' ? n : -n, ...(m[5] === 'less' ? { min: 0 } : {}) }] };
  }],
];
export const SHAPE_HELP = ['when a <kind> is summoned, gain <n>', '<kinds> cannot attack on turn <n>  (or until turn <n>)', 'a card with <power|resistance|income|speed> over|under|at least|at most <n> costs <n> more|less'];

/** a sentence as a rule: { rule, reason }; rule is null (with the reason) for anything the shapes do not cover or that does not validate. Pure. */
export function proposeRule(text) {
  const t = String(text == null ? '' : text).trim().replace(/[.!]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  if (!t || t.length > 160) return { rule: null, reason: t ? 'that is longer than a rule sentence (160 characters)' : 'there is no sentence to read' };
  for (const [re, make] of SHAPES) {
    const m = re.exec(t); if (!m) continue;
    const rule = make(m, t);
    if (!rule) return { rule: null, reason: 'I could not read the number in "' + t + '" (use digits or a word up to ten)' };
    const v = validateRule(rule);
    return v.ok ? { rule, reason: 'read as a layer ' + rule.layer + ' rule on the ' + rule.when } : { rule: null, reason: 'I read the sentence but the rule it made is not allowed: ' + v.errors.join('; ') };
  }
  return { rule: null, reason: 'I do not know that sentence shape yet, so I made nothing up. I understand: ' + SHAPE_HELP.join('; ') + '.' };
}
