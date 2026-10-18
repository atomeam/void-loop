// V01D cards (owner, 2026-10-16: "cards should look like actual cards, like magic cards ... with stats and an intention to add to the
// overall V01D experience"; "even what's new pussycat becomes its own magic style card, which we will call V01D cards").
// Every page V01D puts up is a card: a foil frame (its colour is the family, its foil the rarity), a title bar with a cost, an art box
// with the family's glyph, a type line with a rarity gem, the body as the text box, an "adds to V01D" line, and a footer with a collector
// number and a power/toughness plate. Nothing is invented: the rarity is the skill's evidence rating (proven mythic, checked rare, tested
// uncommon, experiment common); the cost is how many words you say to play it; power is its success rate out of nine and toughness the
// real asks that proved it; the collector number is its page in the V01D Book; "adds" is the one line the book says it does. An answer
// fetched from a source (an encyclopedia page) is an Answer card: power is how many sources it stands on, toughness how many days old the
// source is. The Illuminati card game (Steve Jackson Games) lends its three stats and its control arrows: Power, Resistance and Income,
// and arrows on the card's edges, from the site's real dependency map (skills/deps.json): an arrow out for each thing the skill controls
// (what it imports), an arrow in at the top when other skills lean on it, Income being how many do. Pure: cardOf(), chromeHtml(); the page calls keep() and style().
import { hueOf } from './guide.js';
import { typeWords, kindOf } from './card-kinds.js';
import { bar as shareBar, SHARE_CSS } from './card-share.js';
import { artLook } from './art-meta.js';
import { artSvg, kindWord, seasonOf, KINDS as ART_KINDS } from './card-art.js';
import { forge, FORGE_CSS, answerText } from './card-forge.js';
import { sealArt, SEAL_CSS } from './void-seal.js';
import { subjectOf } from './card-subject.js';

export const RARITY = {
  proven: { name: 'Mythic', gem: '#f0852d', foil: '#ffb347,#c4561a,#ffd27a,#b8430f' }, checked: { name: 'Rare', gem: '#e3c15a', foil: '#f1dc8a,#a98a2e,#f6e7a6,#8a6d1c' },
  tested: { name: 'Uncommon', gem: '#c5ccd6', foil: '#e8edf4,#8b95a3,#dfe5ee,#6f7886' }, experiment: { name: 'Common', gem: '#6b7280', foil: '#4a4f5a,#2a2e36,#4a4f5a,#23262d' },
};
const TIERS = ['experiment', 'tested', 'checked', 'proven'];

const artLookOf = (m) => { const l = artLook(m); return { artHue: l.hue, artInk: l.ink, artWhy: l.why }; };
/** what a card shows, from what the site already knows: { rarity, hue, chapter, cost, typeLine, power, toughness, number, tested, adds, name, fetched }. Pure.
 *  skill: a families.json skill ({ name, tier, why, last_tested, success_rate }) or null; page: its guide.json page or null; book: guide.json;
 *  kind: 'Answer' | 'Skill' | 'Game' | 'Miniature'; sources / ageDays: for a fetched answer, how many sources and how old the newest is */
export function cardOf({ skill = null, page = null, book = null, kind = '', sources = null, ageDays = null, deps = null, entity = null, artKind = '', artMeta = null } = {}) {
  const chap = page && book ? (book.chapters || []).find((c) => c.id === page.chapter) : null;
  const tier = (skill && skill.tier) || (page && page.tier) || '';
  const rarity = RARITY[tier] || null, ti = Math.max(0, TIERS.indexOf(tier)); // an unknown tier word counts as the lowest, never negative
  const typeKind = kind || (page && page.game ? 'Game' : page && page.kind === 'mini' ? 'Miniature' : skill || page ? 'Skill' : 'Answer');
  const words = page && page.examples && page.examples[0] ? String(page.examples[0]).trim().split(/\s+/).length : 0;
  const sr = skill && Number.isFinite(+skill.success_rate) ? Math.max(0, Math.min(1, +skill.success_rate)) : null;
  const why = String((skill && skill.why) || (page && page.why) || ''), asks = (/(\d+)\s+real asks?/.exec(why) || [])[1];
  const stats = !!(skill || page) && tier !== '', fetched = !stats && typeKind === 'Answer' && sources != null && sources > 0;
  const chapter = page ? page.chapter : entity && entity.chapter ? entity.chapter : 'words';
  return {
    artKind: ART_KINDS.includes(artKind) && artKind !== 'Skill' && artKind !== 'Answer' ? artKind : '', // a skill card of a song or a film paints that kind's art, not the generic one
    ...(artKind && artMeta ? artLookOf(artMeta) : {}), // a film's or song's genre and decade, as the source returned them (lib/art-meta.js)
    rarity, chapter, hue: hueOf(chapter), fetched, kindName: entity && !page && !skill && entity.kind ? String(entity.kind).toLowerCase().replace(/[^a-z]/g, '') : '',
    cost: words ? Math.min(6, words) : 0,
    typeLine: entity && !page && !skill ? typeWords(entity.kind, entity.also, entity.detail) : typeKind + (typeKind === 'Answer' ? ' \u2014 ' + (fetched ? (sources === 1 ? 'from a source' : 'from ' + sources + ' sources') : 'from V01D') : chap && chap.name ? ' \u2014 ' + chap.name : ''),
    power: stats ? (sr == null ? ti * 2 : Math.round(sr * 9)) : fetched ? Math.min(9, sources) : null,
    toughness: stats ? (asks ? Math.min(99, +asks) : ti + 1) : fetched ? (ageDays == null ? 1 : Math.max(0, Math.min(99, Math.round(ageDays)))) : null,
    income: stats && deps ? (deps.importedBy || []).length : null, arrowsOut: stats && deps ? Math.min(3, (deps.imports || []).length) : 0, arrowIn: !!(stats && deps && (deps.importedBy || []).length),
    number: page && book ? String(page.n).padStart(3, '0') + '/' + String((book.pages || []).length || '').padStart(3, '0') : '',
    tested: (skill && skill.last_tested) || '',
    adds: page && page.line ? String(page.line).replace(/\s+/g, ' ').slice(0, 120) : fetched ? 'A fact it did not have to be taught: fetched, sourced and dated.' : '',
    name: (skill && skill.name) || (page && page.name) || '', isSkill: !!(skill || page),
  };
}

/** a card whose numbers were worked out elsewhere (a merged card, lib/merge-rules.js): { tier, chapter, typeLine, cost, power, resistance, income, adds, name } -> what cardOf returns. Pure. */
export function ownCard(o = {}) {
  const n = (v, hi) => Math.max(0, Math.min(hi, Math.floor(Number(v)) || 0));
  const chapter = String(o.chapter || 'games').slice(0, 20);
  return { rarity: RARITY[o.tier] || null, chapter, hue: hueOf(chapter), fetched: false, cost: n(o.cost, 9), typeLine: String(o.typeLine || '').slice(0, 80),
    power: n(o.power, 99), toughness: n(o.resistance, 99), income: n(o.income, 9), arrowsOut: 0, arrowIn: false, number: '', tested: '',
    adds: String(o.adds || '').replace(/\s+/g, ' ').slice(0, 120), name: String(o.name || '').slice(0, 40) };
}

const gem = (r) => (r ? '<i class="vc-gem" style="background:' + r.gem + ';color:' + r.gem + '" title="' + r.name + '"></i>' : '');
/** the art box, the type bar, the adds line and the footer as HTML. Pure. */
export function chromeHtml(c, esc) {
  const art = '<div class="vc-art">' + artSvg({ key: c.key || c.name || c.typeLine, name: c.key || c.name || '', kind: c.artKind || kindWord(c.typeLine), chapter: c.chapter, hue: c.artHue != null ? c.artHue : c.hue, ink: c.artInk || undefined, rarity: c.rarity, season: c.season, glyph: c.isSkill, nouns: c.nouns }, { w: 520, h: 150 }) + '</div>';
  const type = '<div class="vc-type"><span>' + esc(c.typeLine) + '</span>' + gem(c.rarity) + '</div>';
  const adds = c.adds ? '<div class="vc-adds"><b>Adds to V01D</b> ' + esc(c.adds) + '</div>' : '';
  const stat = (k, v, t) => '<span title="' + t + '">' + k + '<b>' + v + '</b></span>';
  const plate = c.power == null ? '' : '<div class="vc-pt">' + (c.fetched ? stat('P', c.power, 'power: the sources it stands on') + stat('R', c.toughness, 'resistance: days since the source was edited')
    : stat('P', c.power, 'power: success rate out of nine') + stat('R', c.toughness, 'resistance: real asks that proved it') + (c.income == null ? '' : stat('I', c.income, 'income: how many other files lean on it'))) + '</div>';
  const arrows = '<div class="vc-arrows" aria-hidden="true">' + (c.arrowIn ? '<i class="in">\u25bc</i>' : '') + ['r', 'b', 'l'].slice(0, c.arrowsOut).map((d) => '<i class="' + d + '">\u25b6</i>').join('') + '</div>';
  const foot = '<div class="vc-foot"><div class="vc-num">' + (c.rarity ? esc(c.rarity.name) + ' · ' : '') + (c.number ? esc(c.number) + ' · ' : '') + 'V01D' + (c.tested ? ' · tested ' + esc(c.tested) : '') + '</div>' + plate + '</div>';
  return { art, type, adds, foot, arrows };
}

const FOIL = (r) => 'linear-gradient(135deg,' + (r ? r.foil : '#5b6483,#2c3350,#5b6483,#262c46') + ')';
export const CARD_CSS = [
  '.vpage.vcard{--h:230;--edge:hsl(var(--h) 38% 48%);padding:0 0 12px!important;border:10px solid transparent!important;border-radius:22px!important;',
  'background:linear-gradient(170deg,hsl(var(--h) 26% 15%),hsl(var(--h) 22% 8%)) padding-box,var(--foil,' + FOIL(null) + ') border-box!important;',
  'box-shadow:0 30px 80px rgba(0,0,0,.65),inset 0 0 0 2px rgba(0,0,0,.5),inset 0 0 0 3px var(--edge)!important}',
  '.vpage.vcard[data-rarity=mythic]{--foil:' + FOIL(RARITY.proven) + '}.vpage.vcard[data-rarity=rare]{--foil:' + FOIL(RARITY.checked) + '}.vpage.vcard[data-rarity=uncommon]{--foil:' + FOIL(RARITY.tested) + '}.vpage.vcard[data-rarity=common]{--foil:' + FOIL(RARITY.experiment) + '}',
  '.vcard>*:not(.vc-art):not(.vc-type):not(.vc-foot):not(.vc-adds):not(.vc-title):not(style){margin-left:18px;margin-right:18px}',
  '.vcard .vc-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 12px 0!important;padding:5px 12px;background:linear-gradient(90deg,hsl(var(--h) 28% 22%),hsl(var(--h) 24% 15%));border:2px solid var(--edge);border-radius:12px 12px 6px 6px/16px 16px 6px 6px;font-weight:600;letter-spacing:.02em;font-size:20px;line-height:1.2;overflow-wrap:anywhere;min-width:0}',
  '.vcard .vc-title::after{content:attr(data-cost);font-size:13px;letter-spacing:.18em;color:hsl(var(--h) 60% 74%);white-space:nowrap}',
  '.vcard .vc-art{display:flex;align-items:center;justify-content:center;height:auto;aspect-ratio:16/9;max-height:min(300px,38vh);margin:7px 12px 0;border:2px solid var(--edge);border-radius:4px;background:radial-gradient(ellipse at 50% 120%,hsl(var(--h) 60% 40% / .55),transparent 70%),linear-gradient(180deg,hsl(var(--h) 30% 12%),hsl(var(--h) 34% 20%));overflow:hidden}.vcard .vc-art{position:relative}.vcard .vc-art svg{display:block;width:100%;height:100%}.vpage.vcard .vc-art img.vc-art-photo{position:absolute!important;inset:0;float:none!important;margin:0!important;max-width:none!important;width:100%!important;height:100%!important;border-radius:0!important;object-fit:cover;object-position:50% 35%;filter:none}.vcard .vc-art.has-photo svg{position:absolute;inset:0;mix-blend-mode:overlay;opacity:.28;pointer-events:none}.vpage.skyc .vc-art{height:72px}',
  '.vcard .vc-type{display:flex;align-items:center;justify-content:space-between;margin:7px 12px 12px;padding:3px 12px;background:linear-gradient(90deg,hsl(var(--h) 26% 21%),hsl(var(--h) 22% 16%));border:2px solid var(--edge);border-radius:6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:hsl(var(--h) 40% 78%)}',
  '.vcard .vc-gem{width:11px;height:11px;transform:rotate(45deg);border-radius:2px;box-shadow:0 0 0 2px rgba(0,0,0,.55),0 0 9px currentColor}',
  '.vcard .vc-adds{margin:8px 12px 0;padding:8px 12px;border-top:1px solid var(--edge);font-size:12.5px;font-style:italic;color:hsl(var(--h) 18% 74%)}.vcard .vc-adds b{font-style:normal;letter-spacing:.08em;text-transform:uppercase;font-size:11px;color:hsl(var(--h) 55% 72%);margin-right:6px}',
  '.vcard{scroll-padding-bottom:84px}.vcard .vc-foot a,.vcard .vc-foot button,.vcard .vc-foot [role=button],.vcard .vc-foot input{pointer-events:auto}.vcard .vc-arrows{pointer-events:none}.vcard .vc-foot{pointer-events:none;position:sticky;bottom:-12px;padding:8px 0 12px;background:linear-gradient(180deg,transparent,hsl(var(--h) 22% 8%) 38%);z-index:2;display:flex;align-items:flex-end;justify-content:space-between;margin:8px 12px 0;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:hsl(var(--h) 15% 62%)}',
  '.vcard .vc-pt{min-width:58px;text-align:center;padding:3px 12px;background:linear-gradient(180deg,hsl(var(--h) 28% 26%),hsl(var(--h) 26% 14%));border:2px solid var(--edge);border-radius:9px 4px 9px 4px;font-size:17px;font-weight:700;letter-spacing:.05em;color:#f3efe2;box-shadow:0 2px 6px rgba(0,0,0,.5)}',
  '.vcard .vc-pt{display:flex;gap:8px;padding:3px 9px}.vcard .vc-pt span{font-size:10px;letter-spacing:.1em;color:hsl(var(--h) 30% 70%);display:flex;align-items:baseline;gap:3px}.vcard .vc-pt b{font-size:16px;color:#f3efe2;letter-spacing:.02em}',
  '.vcard .vc-arrows i{position:absolute;font-style:normal;font-size:12px;line-height:1;color:var(--edge);text-shadow:0 0 6px currentColor}.vcard .vc-arrows .in{top:-2px;left:50%;transform:translateX(-50%)}.vcard .vc-arrows .r{right:-1px;top:50%;transform:translateY(-50%)}.vcard .vc-arrows .l{left:-1px;top:50%;transform:translateY(-50%) scaleX(-1)}.vcard .vc-arrows .b{bottom:-3px;left:50%;transform:translateX(-50%) rotate(90deg)}',
  // type-specific layouts (asked by Void: "Implement type-specific card layouts so that different response types (e.g., Film vs. Place) use unique
  // visual hierarchies"): the answer card's kind (card-kinds.js) decides what leads. A Film is a cinema screen: a tall letterboxed art box and an
  // italic centred title. A Place leads with where it is: its type line first, in large caps, then the title, over a shallow horizon. A Person is a
  // portrait: a round art box centred above the name. A Song is a record sleeve: a thin strip, the title with a note before it.
  '.vpage.vcard[data-kind=film] .vc-art{height:112px;box-shadow:inset 0 16px 0 #000,inset 0 -16px 0 #000}.vpage.vcard[data-kind=film] .vc-title{justify-content:center;font-style:italic;font-family:Georgia,serif;letter-spacing:.06em}.vpage.vcard[data-kind=film] .vc-title::after{content:none}',
  '.vpage.vcard[data-kind=place]{display:flex!important;flex-direction:column}.vpage.vcard[data-kind=place] .vc-type{order:-3;margin-top:12px;margin-bottom:0;font-size:15px;letter-spacing:.2em;border-radius:6px 6px 0 0}.vpage.vcard[data-kind=place] .vc-title{order:-2;margin-top:0!important;border-radius:0 0 12px 12px/0 0 16px 16px}.vpage.vcard[data-kind=place] .vc-art{order:-1;height:44px;background:linear-gradient(180deg,hsl(var(--h) 55% 62%) 0 52%,hsl(var(--h) 40% 24%) 52%)}.vpage.vcard[data-kind=place] .vc-arrows{order:99}',
  '.vpage.vcard[data-kind=person] .vc-art{width:84px;height:84px;margin:10px auto 0;border-radius:50%;border-width:3px}.vpage.vcard[data-kind=person] .vc-title{justify-content:center;text-align:center}.vpage.vcard[data-kind=person] .vc-title::after{content:none}.vpage.vcard[data-kind=person] .vc-type{justify-content:center;gap:10px}',
  '.vpage.vcard[data-kind=song] .vc-art{height:40px}.vpage.vcard[data-kind=song] .vc-title::before{content:"\\266A";margin-right:8px;color:hsl(var(--h) 60% 74%)}',
  // a card whose skill just earned a higher rating glows once (asked by Void, skill evolution): lib/card-frame.js evolved()
  '@keyframes vc-evolve{0%{box-shadow:0 0 0 0 var(--edge),0 30px 80px rgba(0,0,0,.65)}30%{box-shadow:0 0 36px 12px #ffd27a,0 0 90px 30px rgba(255,140,40,.55),0 30px 80px rgba(0,0,0,.65);filter:brightness(1.25)}100%{box-shadow:0 30px 80px rgba(0,0,0,.65);filter:none}}',
  '.vpage.vcard.vc-evolving{animation:vc-evolve 2.6s ease-out 1}.vc-evolved-note{margin:6px 12px 0;text-align:center;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ffd27a}',
  '@media (prefers-reduced-motion:reduce){.vpage.vcard.vc-evolving{animation:none;outline:3px solid #ffd27a}}',
  '@media (max-width:520px){.vpage.vcard:not(.skyc){max-height:min(40vh,calc(100vh - 140px))}.vcard .vc-title{margin:8px 6px 0!important;font-size:18px}.vcard .vc-art,.vcard .vc-type,.vcard .vc-adds,.vcard .vc-foot{margin-left:6px;margin-right:6px}.vcard .vc-art{height:0;margin-top:0;margin-bottom:0;border:0;overflow:hidden}.vcard .vc-type{margin-bottom:8px}.vpage.skyc .vc-title,.vpage.skyc .vc-type,.vpage.skyc .vc-adds{height:0;margin:0!important;padding:0;border:0;overflow:hidden}.vcard .vc-adds{height:0;margin:0!important;padding:0;border:0;overflow:hidden}.vcard .vc-pt{gap:5px;padding:3px 6px}.vcard .vc-foot{font-size:9.5px;gap:6px}}',
  // the comic-ink layer (owner, 2026-10-18: "design the almost comic like epic v01d cards"): heavy black ink round every panel with an offset
  // shadow like a printed panel, a bold outlined title banner, the stats in an inked plate, and halftone dots over the art
  '.vpage.vcard{outline:3px solid #000;outline-offset:-1px}',
  '.vcard .vc-title{text-transform:uppercase;font-family:"Bangers","Impact","Anton","Arial Black",system-ui,sans-serif!important;font-weight:800;letter-spacing:.06em;color:#fff7e0;text-shadow:2px 2px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;border:3px solid #000!important;box-shadow:inset 0 0 0 2px var(--edge),4px 4px 0 #000}',
  '.vcard .vc-art{border:3px solid #000!important;box-shadow:inset 0 0 0 2px var(--edge),5px 5px 0 #000;border-radius:3px}',
  '.vcard .vc-art::before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:radial-gradient(circle,rgba(0,0,0,.28) 0.9px,transparent 1.3px) 0 0/5px 5px;mix-blend-mode:multiply;opacity:.55}',
  '.vcard .vc-type{border:3px solid #000!important;box-shadow:inset 0 0 0 2px var(--edge),3px 3px 0 #000;font-weight:700;color:#f3efe2}',
  '.vcard .vc-pt{border:3px solid #000!important;box-shadow:inset 0 0 0 2px var(--edge),3px 3px 0 #000;transform:rotate(-2deg)}.vcard .vc-pt b{text-shadow:1px 1px 0 #000,-1px -1px 0 #000}',
].join('') + FORGE_CSS + SEAL_CSS + SHARE_CSS;

// Skill evolution (asked by Void: "Create a 'Skill Evolution' animation where a card visually upgrades its border or glow when a new 'proven'
// test passes"): a skill's rating only rises when new evidence arrives (tools/families.mjs). This browser remembers the rating it last showed
// for each skill; when a card appears with a higher one the card glows once and says what it became. The first sight of a skill only
// remembers it, so nothing evolves on a first visit. Stored on this device only.
export const EVO_KEY = 'a2m.void.tiers.v1';
/** { from, to } when `tier` is higher than the `prev` rating word, else null. Pure. */
export function evolved(prev, tier) {
  const a = TIERS.indexOf(prev), b = TIERS.indexOf(tier);
  return a >= 0 && b > a ? { from: RARITY[prev].name, to: RARITY[tier].name } : null;
}
/** read the remembered ratings, note this one, and say whether the skill just evolved. Never throws (storage may be blocked). */
export function noteTier(name, tier, store = typeof localStorage === 'undefined' ? null : localStorage) {
  if (!name || !TIERS.includes(tier)) return null;
  try {
    const m = JSON.parse(store.getItem(EVO_KEY) || '{}') || {}, up = evolved(m[name], tier);
    if (m[name] !== tier) { m[name] = tier; store.setItem(EVO_KEY, JSON.stringify(m)); }
    return up;
  } catch (e) { return null; }
}

let cache = null;
/** the site's own files, once: guide.json (the pages) and families.json (the ratings); nulls where they cannot be read */
export function loadStats() {
  if (!cache) {
    const get = (u) => fetch(u, { cache: 'force-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    cache = Promise.all([get('/skills/guide.json'), get('/skills/families.json'), get('/skills/deps.json')]).then(([book, fam, deps]) => ({ book, fam, deps }));
  }
  return cache;
}
/** the families.json skill and the guide.json page for a skill name, or nulls. Pure. */
export function lookup(stats, name) {
  const book = stats && stats.book, fam = stats && stats.fam;
  let skill = null; for (const f of (fam && fam.families) || []) for (const s of f.skills || []) if (s.name === name) skill = s;
  const page = book ? (book.pages || []).find((p) => (p.kind === 'skill' || p.kind === 'game' || p.kind === 'mini') && p.name === name) || null : null;
  const f = stats && stats.deps && stats.deps.files, d = f && f['skills/' + name + '.js'];
  return { skill, page, book, deps: d ? { imports: (d.imports || []).filter((x) => !/\/mini\//.test(x)), importedBy: d.importedBy || [] } : null };
}
/** how many days ago a source line says it was edited ("Source: Wikipedia · last edited Sep 3, 2026"), or null. Pure. */
export function editedDaysAgo(text, now = Date.now()) {
  const m = /last edited ([A-Z][a-z]{2,8})\.? (\d{1,2}), (\d{4})/.exec(String(text || '')); if (!m) return null;
  const months = { Jan: 0, January: 0, Feb: 1, February: 1, Mar: 2, March: 2, Apr: 3, April: 3, May: 4, Jun: 5, June: 5, Jul: 6, July: 6, Aug: 7, August: 7, Sep: 8, September: 8, Oct: 9, October: 9, Nov: 10, November: 10, Dec: 11, December: 11 };
  const month = months[m[1]];
  const t = month == null ? NaN : Date.UTC(Number(m[3]), month, Number(m[2])); return Number.isFinite(t) ? Math.max(0, (now - t) / 864e5) : null;
}

/** put the card's frame on a page, or refresh it: idempotent, and safe to call from a MutationObserver (it only writes when it changes). */
export function keep(el, esc, stats) {
  if (!el || !el.classList) return;
  if (!el.classList.contains('vcard')) el.classList.add('vcard');
  // a minted collectible (skills/collectible.js) stays the card of its subject, not of the skill that minted it
  const name = el.dataset.collect ? '' : el.dataset.skill || '', srcLinks = el.querySelectorAll('.src a').length, src = el.querySelector('.src');
  const entity = !name && el.dataset.cardDesc !== undefined ? { ...kindOf(el.dataset.cardDesc, el.dataset.cardExtract), also: (el.dataset.cardAlso || '').split(',').filter(Boolean) } : null;
  let own = null; try { own = el.dataset.cardOwn ? JSON.parse(el.dataset.cardOwn) : null; } catch (_) {} // a merged card brings its own worked-out numbers
  const c = own ? ownCard(own) : cardOf({ ...lookup(stats, name), entity, kind: el.dataset.cardKind || '', artKind: el.dataset.artKind || '', artMeta: el.dataset.artKind ? { genre: el.dataset.artGenre || '', year: el.dataset.artYear || '' } : null, sources: name ? null : srcLinks || null, ageDays: name ? null : editedDaysAgo(src && src.textContent) });
  const h2t = el.querySelector('h2'); c.key = name || (h2t ? h2t.textContent.trim() : '') || c.typeLine; c.season = seasonOf(new Date().getMonth(), typeof location !== 'undefined' ? location.search : '');
  // the art is of the subject (owner, 2026-10-17: the art should be of the subject of each card): when the answer carries a picture of the thing
  // (its source's thumbnail), the art box shows that picture in its true colour (owner, 2026-10-17: the ink filter stripped a poster's colour), under a light ink texture; with none, the plate of its kind
  const photoImg = [...el.querySelectorAll('img[src]')].find((i) => !i.closest('.vc-art') && /^https:\/\//.test(i.getAttribute('src') || '')), photo = photoImg ? photoImg.getAttribute('src') : '';
  // the card's subject is what its ANSWER is about (lib/card-subject.js), not the ask's words: the plate draws it, the Art Forge paints it
  const subj = c.isSkill || own ? { nouns: [], phrase: '' } : subjectOf(c.key, answerText(el)); c.nouns = subj.nouns; el._vcSubject = subj.phrase;
  const key = JSON.stringify([c.key, c.nouns, c.season, c.isSkill, c.chapter, c.typeLine, c.cost, c.power, c.toughness, c.income, c.arrowsOut, c.arrowIn, c.number, c.adds, c.artKind, c.artHue, c.artInk, c.rarity && c.rarity.name, c.hue, photo]);
  const h2 = el.querySelector('h2');
  if (h2 && !h2.classList.contains('vc-title')) h2.classList.add('vc-title');
  // the page keeps its own lines last (a product line, the Tell V01D link): the arrows sit before them, never after, or the two keep moving past each other forever
  const trailing = (n) => n.classList.contains('vtail') || n.classList.contains('vtell') || n.classList.contains('vtell-box');
  let last = el.lastElementChild; while (last && trailing(last)) last = last.previousElementSibling;
  if (el.dataset.cardKey === key && el.querySelector(':scope > .vc-type') && el.querySelector(':scope > .vc-arrows') === last) return;
  for (const n of el.querySelectorAll(':scope > .vc-art, :scope > .vc-type, :scope > .vc-adds, :scope > .vc-foot, :scope > .vc-arrows')) n.remove();
  el.style.setProperty('--h', String(c.hue));
  el._vcard = c; el.dataset.cardKey = key; el.dataset.rarity = c.rarity ? c.rarity.name.toLowerCase() : 'answer';
  if (c.kindName) el.dataset.kind = c.kindName; else delete el.dataset.kind;
  if (h2) h2.dataset.cost = c.cost ? '◆'.repeat(c.cost) : '';
  const html = chromeHtml(c, esc), tpl = document.createElement('template');
  tpl.innerHTML = html.art + html.type; /* void-review: ok: chromeHtml escapes every text field */ const top = [...tpl.content.childNodes];
  if (h2 && h2.parentNode === el) { let at = h2; for (const n of top) { at.after(n); at = n; } } else for (const n of top.reverse()) el.prepend(n);
  if (photo) { const box = el.querySelector(':scope > .vc-art'); if (box) { box.classList.add('has-photo'); const im = document.createElement('img'); im.className = 'vc-art-photo'; im.alt = ''; im.referrerPolicy = 'no-referrer'; im.loading = 'lazy'; im.src = photo; box.appendChild(im); } }
  tpl.innerHTML = html.adds + html.foot + html.arrows; // void-review: ok: built by chromeHtml, every text field escaped
  let anchor = null; for (let n = el.lastElementChild; n && trailing(n); n = n.previousElementSibling) anchor = n;
  for (const n of [...tpl.content.childNodes]) el.insertBefore(n, anchor);
  if (!photo) sealArt(el.querySelector(':scope > .vc-art'), { key: c.key || c.name || c.typeLine, kind: c.artKind || kindWord(c.typeLine), hue: c.artHue != null ? c.artHue : c.hue, rarity: c.rarity, nouns: c.nouns }); // the void seal (lib/void-seal.js): V01D's procedural art under any painted picture
  forge(el, c, !!photo); // the Art Forge (lib/card-forge.js): painted art for an answer or merged card, or a "paint this card" button
  shareBar(el); // copy card / save card (lib/card-share.js)
  const up = name && c.rarity ? noteTier(name, (lookup(stats, name).skill || {}).tier) : null; // a rating that rose since this browser last saw the skill
  if (up) {
    el.classList.add('vc-evolving'); el.dataset.evolved = up.to;
    const note = document.createElement('div'); note.className = 'vc-evolved-note'; note.textContent = 'Evolved: ' + up.from + ' \u2192 ' + up.to;
    const at = el.querySelector(':scope > .vc-type'); if (at) at.after(note);
    setTimeout(() => { el.classList.remove('vc-evolving'); note.remove(); }, 4500);
  }
}

let styled = false;
/** the one stylesheet, once */
export function style() { if (styled || typeof document === 'undefined') return; styled = true; const s = document.createElement('style'); s.id = 'vcard-css'; s.textContent = CARD_CSS; document.head.appendChild(s); }
