// The rule registry (asked by Verse: "Create a 'rule-registry' view within the leather tome that lists all active router rules as
// illuminated manuscript entries"). Verse's router on the page is its skills in routing order (skills/order/<rank>-<name>, written
// out as skills/index.json): an ask goes down the list and the first skill whose match() takes it answers. Each of those is one
// active rule. This chapter of the book (lib/guide.js compose) sets every one down in that order as a manuscript entry: a gilded,
// coloured initial, the rule's number in Roman numerals, the skill's name, and what it catches (its own first example, an ask you
// can touch). Pure: no DOM, no fetch; every value is escaped by the caller's esc.

export const PER_PAGE = 8; // entries on one parchment page: two lines each, so a long chapter still never runs into the folio
export const RULES_ID = 'rules';
export const RULES_NAME = 'Rule registry';
export const RULES_FOR = 'every active router rule, in the order an ask meets them: the first that catches it answers';

/** n as Roman numerals (1..3999; anything else as plain digits). Pure. */
export function roman(n) {
  n = Math.floor(Number(n));
  if (!(n >= 1 && n <= 3999)) return String(n);
  const R = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = ''; for (const [v, d] of R) while (n >= v) { s += d; n -= v; }
  return s;
}

/** the active rules in routing order: names is skills/index.json, examplesOf(name) a skill's own asks. [{ rank, name, catches }]. Pure. */
export function rulesOf(names, examplesOf = () => []) {
  return (Array.isArray(names) ? names : []).filter((n) => typeof n === 'string' && n).map((name, i) => {
    const ex = (examplesOf(name) || []).find((x) => typeof x === 'string' && x.trim());
    return { rank: i + 1, name, catches: ex ? ex.trim().slice(0, 80) : '' };
  });
}

/** the rules cut into pages of the book: [{ kind:'rules', chapter, title, rules }]. Pure. */
export function rulePages(rules, per = PER_PAGE) {
  const out = [], k = Math.max(1, per | 0);
  for (let i = 0; i < rules.length; i += k) {
    const part = rules.slice(i, i + k);
    out.push({ kind: 'rules', chapter: RULES_ID, title: 'Rules ' + roman(part[0].rank) + '–' + roman(part[part.length - 1].rank), rules: part });
  }
  return out;
}

// the illuminator's inks: vermilion, lapis, verdigris, and a deep murrey, turned by rank so neighbours never share a colour
const INKS = ['#9b2a17', '#23407a', '#2f5d3a', '#5b1f4a'];
/** the ink an entry's initial is laid on. Pure. */
export const inkOf = (rank) => INKS[(Math.abs(Math.floor(Number(rank) || 0)) + INKS.length - 1) % INKS.length];

/** one rule as an illuminated entry: an initial on its ink, Rule N in Roman numerals, the name, and the ask it catches. Pure. */
export function ruleEntryHtml(r, esc) {
  const name = String(r.name || ''), at = name.search(/[a-z0-9]/i), cap = at < 0 ? '?' : name[at].toUpperCase();
  return '<li class="tome-rx" data-rule="' + esc(name) + '" data-rank="' + esc(r.rank) + '">'
    + '<span class="tome-rx-cap" style="background-color:' + inkOf(r.rank) + '" aria-hidden="true">' + esc(cap) + '</span>'
    + '<span class="tome-rx-head"><span class="tome-rx-no">Rule ' + esc(roman(r.rank)) + '</span> <b class="tome-rx-name">' + esc(name) + '</b></span>'
    + '<span class="tome-rx-catch">' + (r.catches ? 'catches <a href="#" data-ask="' + esc(r.catches) + '">“' + esc(r.catches) + '”</a>' : 'catches what its own rule says') + '</span></li>';
}

/** a page of the registry. Pure. */
export function rulesPageHtml(p, esc) {
  return '<div class="tome-kicker">Rule registry</div><h3 class="tome-title">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body"><ol class="tome-rxs">'
    + (p.rules || []).map((r) => ruleEntryHtml(r, esc)).join('') + '</ol></div>';
}

/** the entries' look, added to the tome's stylesheet. Pure. */
export const RULES_CSS = [
  '.tome-rxs{margin:0;padding:0;list-style:none}',
  '.tome-rx{display:grid;grid-template-columns:5.4cqh 1fr;grid-template-rows:auto auto;column-gap:1.4cqh;margin:0 0 1.15cqh;min-height:5.4cqh;align-items:center}',
  '.tome-rx-cap{grid-row:1/3;width:5.4cqh;height:5.4cqh;display:flex;align-items:center;justify-content:center;font-size:3.9cqh;font-weight:700;line-height:1;color:#f1d47a;border-radius:2px;'
    + 'box-shadow:inset 0 0 0 1px rgba(241,212,122,.85),inset 0 0 0 3px rgba(0,0,0,.25),inset 0 0 0 4px rgba(241,212,122,.45),0 1px 2px rgba(40,20,5,.45);text-shadow:0 1px 0 rgba(0,0,0,.45);'
    + 'background-image:radial-gradient(circle at 30% 25%,rgba(255,240,200,.28),rgba(255,240,200,0) 60%)}',
  '.tome-rx-head{font-size:2.05cqh;line-height:1.2;overflow-wrap:anywhere}.tome-rx-no{font-variant:small-caps;letter-spacing:.12em;color:#7a4a22;font-size:1.65cqh}',
  '.tome-rx-name{font-weight:600;color:#2b1b0e}',
  '.tome-rx-catch{font-size:1.75cqh;line-height:1.25;font-style:italic;color:#4f3418;overflow-wrap:anywhere}',
].join('');
