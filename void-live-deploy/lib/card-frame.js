// Verse cards (owner, 2026-10-16: "cards should look like actual cards, like magic cards ... with stats and an intention to add to the
// overall Verse experience"; "even what's new pussycat becomes its own magic style card, which we will call Verse cards").
// Every page Verse puts up is a card: a foil frame (its colour is the family, its foil the rarity), a title bar with a cost, an art box
// with the family's glyph, a type line with a rarity gem, the body as the text box, an "adds to Verse" line, and a footer with a collector
// number and a power/toughness plate. Nothing is invented: the rarity is the skill's evidence rating (proven mythic, checked rare, tested
// uncommon, experiment common); the cost is how many words you say to play it; power is its success rate out of nine and toughness the
// real asks that proved it (on 0-9, asksResistance); the collector number is its page in the Verse Book; "adds" is the one line the book says it does. An answer
// fetched from a source (an encyclopedia page) is an Answer card: power is how many sources it stands on, toughness how fresh the
// source is (freshness). The Illuminati card game (Steve Jackson Games) lends its three stats and its control arrows: Power, Resistance and Income,
// and arrows on the card's edges, from the site's real dependency map (skills/deps.json): an arrow out for each thing the skill controls
// (what it imports), an arrow in at the top when other skills lean on it, Income being how many do. Pure: cardOf(), chromeHtml(); the page calls keep() and style().
import { hueOf } from './guide.js';
import { typeWords, kindOf, newInSub, repeatsTitle } from './card-kinds.js';
import { lineageOf } from './lineage.js';
import { bar as shareBar, SHARE_CSS, SOURCE_BOX, SOURCE_LINKS } from './card-share.js';
export { SOURCE_BOX, SOURCE_LINKS };
import { artLook } from './art-meta.js';
import { artSvg, kindWord, seasonOf, KINDS as ART_KINDS } from './card-art.js';
import { forge, FORGE_CSS, answerText } from './card-forge.js';
import { sealArt, SEAL_CSS } from './void-seal.js';
import { subjectOf, motifsFor } from './card-subject.js';
import { lookOfSkill, LOOK_CSS } from './card-look.js'; // the family's frame: organic for sky and earth, blueprint for numbers and money (asked by Verse)
import { artSource } from './art-source.js';
import { sectionsOf } from './card-sections.js';
import { badgesOf, noticeOf, themeOf } from './subject-kinds.js';
import { isNoAnswer } from './no-answer.js'; // a refusal body is a Not found card, never a sourced answer with an "Adds to Verse" line

export const RARITY = {
  proven: { name: 'Mythic', gem: '#f0852d', foil: '#ffb347,#c4561a,#ffd27a,#b8430f' }, checked: { name: 'Rare', gem: '#e3c15a', foil: '#f1dc8a,#a98a2e,#f6e7a6,#8a6d1c' },
  tested: { name: 'Uncommon', gem: '#c5ccd6', foil: '#e8edf4,#8b95a3,#dfe5ee,#6f7886' }, experiment: { name: 'Common', gem: '#6b7280', foil: '#4a4f5a,#2a2e36,#4a4f5a,#23262d' },
};
const TIERS = ['experiment', 'tested', 'checked', 'proven'];

// every stat sits on 0-9 (owner, 2026-10-18: "lets start thinking about the stats and card game rules to make the cards better"):
// resistance counted every proving ask, so calc read 9/99 and cost 27 in a duel; now it grows about 3 for each tenfold rise in asks
// (1 ask 1, 10 asks 4, 100 asks 7, 1000 or more 9). An answer's resistance is its freshness, not its age: a source edited today is 9,
// a week ago 6, a month ago 5, a year ago 1, so a stale fact no longer outlasts a fresh one.
export const asksResistance = (n) => (Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(9, 1 + Math.round(3 * Math.log10(n)))) : 0);
export const freshness = (days) => (days == null || !Number.isFinite(+days) ? 1 : Math.max(1, Math.min(9, 9 - Math.floor(Math.log2(Math.max(0, +days) + 1)))));
// a card's abilities as printed keywords, each from a fact the site already has (the duel plays them: lib/duel-rules.js ABILITIES):
// Proven (a proven skill, a mythic), Fresh (tested in the last 7 days), Linked (it leans on other skills), Sourced (an answer standing on 2+ sources)
export const KEYWORDS = { Proven: 'cannot be neutralised the turn it is summoned', Fresh: 'tested this week: +1 Resistance', Linked: '+1 Income for each arrow a card stands on', Sourced: 'stands on two or more sources' };
export function keywordsOf({ tier = '', tested = '', arrows = 0, fetched = false, sources = null, today = null } = {}) {
  const now = Date.parse(today || new Date().toISOString().slice(0, 10)), days = tested ? (now - Date.parse(tested)) / 864e5 : Infinity;
  return [tier === 'proven' && 'Proven', days >= 0 && days <= 7 && 'Fresh', arrows > 0 && 'Linked', fetched && sources >= 2 && 'Sourced'].filter(Boolean);
}
const artLookOf = (m) => { const l = artLook(m); return { artHue: l.hue, artInk: l.ink, artWhy: l.why }; };
/** what a card shows, from what the site already knows: { rarity, hue, chapter, cost, typeLine, power, toughness, number, tested, adds, name, fetched }. Pure.
 *  skill: a families.json skill ({ name, tier, why, last_tested, success_rate }) or null; page: its guide.json page or null; book: guide.json;
 *  kind: 'Answer' | 'Skill' | 'Game' | 'Miniature'; sources / ageDays: for a fetched answer, how many sources and how old the newest is */
export function cardOf({ skill = null, page = null, book = null, kind = '', sources = null, ageDays = null, deps = null, entity = null, artKind = '', artMeta = null, today = null, notFound = false } = {}) {
  const chap = page && book ? (book.chapters || []).find((c) => c.id === page.chapter) : null;
  const tier = (skill && skill.tier) || (page && page.tier) || '';
  const rarity = RARITY[tier] || null, ti = Math.max(0, TIERS.indexOf(tier)); // an unknown tier word counts as the lowest, never negative
  const typeKind = kind || (page && page.game ? 'Game' : page && page.kind === 'mini' ? 'Miniature' : skill || page ? 'Skill' : 'Answer');
  const words = page && page.examples && page.examples[0] ? String(page.examples[0]).trim().split(/\s+/).length : 0;
  const sr = skill && Number.isFinite(+skill.success_rate) ? Math.max(0, Math.min(1, +skill.success_rate)) : null;
  const why = String((skill && skill.why) || (page && page.why) || ''), asks = (/(\d+)\s+real asks?/.exec(why) || [])[1];
  const stats = !!(skill || page) && tier !== '', fetched = !notFound && !stats && typeKind === 'Answer' && sources != null && sources > 0;
  const chapter = page ? page.chapter : entity && entity.chapter ? entity.chapter : 'words';
  return {
    artKind: ART_KINDS.includes(artKind) && artKind !== 'Skill' && artKind !== 'Answer' ? artKind : '', // a skill card of a song or a film paints that kind's art, not the generic one
    ...(artKind && artMeta ? artLookOf(artMeta) : {}), // a film's or song's genre and decade, as the source returned them (lib/art-meta.js)
    rarity, chapter, hue: hueOf(chapter), fetched, kindName: !notFound && entity && !page && !skill && entity.kind ? String(entity.kind).toLowerCase().replace(/[^a-z]/g, '') : '',
    cost: words ? Math.min(6, words) : 0,
    notFound: !!notFound,
    typeLine: notFound ? 'Not found' : entity && !page && !skill ? typeWords(entity.kind, entity.also, entity.detail) : typeKind + (typeKind === 'Answer' ? ' \u2014 ' + (fetched ? (sources === 1 ? 'from a source' : 'from ' + sources + ' sources') : 'from Verse') : chap && chap.name ? ' \u2014 ' + chap.name : ''),
    power: stats ? (sr == null ? ti * 2 : Math.round(sr * 9)) : fetched ? Math.min(9, sources) : null,
    toughness: stats ? (asks ? asksResistance(+asks) : ti + 1) : fetched ? freshness(ageDays) : null,
    income: stats && deps ? (deps.importedBy || []).length : null, arrowsOut: stats && deps ? Math.min(3, (deps.imports || []).length) : 0, arrowIn: !!(stats && deps && (deps.importedBy || []).length),
    number: page && book ? String(page.n).padStart(3, '0') + '/' + String((book.pages || []).length || '').padStart(3, '0') : '',
    tested: (skill && skill.last_tested) || '',
    adds: page && page.line ? String(page.line).replace(/\s+/g, ' ').slice(0, 120) : fetched ? 'A fact it did not have to be taught: fetched, sourced and dated.' : '',
    name: (skill && skill.name) || (page && page.name) || '', isSkill: !!(skill || page),
    keywords: keywordsOf({ tier, tested: skill && skill.last_tested, arrows: stats && deps ? (deps.imports || []).length : 0, fetched, sources, today }),
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
  const lineage = lineageOf(c.chapter), trace = lineage ? ' title="' + esc(lineage) + '" data-lineage="' + esc(lineage) + '"' : '';
  const type = '<div class="vc-type"' + trace + '><span>' + esc(c.typeLine) + '</span>' + gem(c.rarity) + '</div>';
  const kws = (c.keywords || []).filter((k) => KEYWORDS[k]).map((k) => '<span class="vc-kw" title="' + esc(k + ': ' + KEYWORDS[k]) + '">' + esc(k) + '</span>').join('');
  const badges = (c.badges || []).length ? '<div class="vc-badges" role="list">' + c.badges.map(([k, v]) => '<span role="listitem" class="vc-badge"><i>' + esc(k) + '</i> ' + esc(v) + '</span>').join('') + '</div>' : '';
  const notice = c.notice ? '<div class="vc-notice">' + esc(c.notice) + '</div>' : '';
  const adds = c.adds || kws || badges || notice ? '<div class="vc-adds"' + (badges || notice ? ' data-facts="1"' : '') + '>' + badges + (kws ? '<div class="vc-kws">' + kws + '</div>' : '') + (c.adds ? '<span class="vc-addstext"><b' + trace + '>Adds to Verse</b> ' + esc(c.adds) + '</span>' : '') + notice + '</div>' : '';
  const stat = (k, v, t) => '<span title="' + t + '">' + k + '<b>' + v + '</b></span>';
  const plate = c.power == null ? '' : '<div class="vc-pt">' + (c.fetched ? stat('P', c.power, 'power: the sources it stands on') + stat('R', c.toughness, 'resistance: how fresh the source is, 9 if edited today, 1 if a year or more')
    : stat('P', c.power, 'power: success rate out of nine') + stat('R', c.toughness, 'resistance: the real asks that proved it, about 3 more for each tenfold') + (c.income == null ? '' : stat('I', c.income, 'income: how many other files lean on it'))) + '</div>';
  const arrows = '<div class="vc-arrows" aria-hidden="true">' + (c.arrowIn ? '<i class="in">\u25bc</i>' : '') + ['r', 'b', 'l'].slice(0, c.arrowsOut).map((d) => '<i class="' + d + '">\u25b6</i>').join('') + '</div>';
  const foot = '<div class="vc-foot"><div class="vc-num">' + (c.rarity ? esc(c.rarity.name) + ' · ' : '') + (c.number ? esc(c.number) + ' · ' : '') + 'Verse' + (c.tested ? ' · tested ' + esc(c.tested) : '') + '</div>' + plate + '</div>';
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
  '.vcard .vc-art{display:flex;align-items:center;justify-content:center;height:auto;aspect-ratio:16/10;max-height:min(380px,46vh);margin:6px 8px 0;border:2px solid var(--edge);border-radius:4px;background:radial-gradient(ellipse at 50% 120%,hsl(var(--h) 60% 40% / .55),transparent 70%),linear-gradient(180deg,hsl(var(--h) 30% 12%),hsl(var(--h) 34% 20%));overflow:hidden}.vcard .vc-art{position:relative}.vcard .vc-art svg{display:block;width:100%;height:100%}.vpage.vcard .vc-art img.vc-art-photo{position:absolute!important;inset:0;float:none!important;margin:0!important;max-width:none!important;max-height:none!important;width:100%!important;height:100%!important;border-radius:0!important;object-fit:cover;object-position:50% 35%;filter:none}.vcard .vc-art.has-photo::before{content:none}.vpage.skyc .vc-art{height:72px}',
  '.vcard .vc-type{display:flex;align-items:center;justify-content:space-between;margin:7px 12px 12px;padding:3px 12px;background:linear-gradient(90deg,hsl(var(--h) 26% 21%),hsl(var(--h) 22% 16%));border:2px solid var(--edge);border-radius:6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:hsl(var(--h) 40% 78%)}',
  '.vcard .vc-gem{width:11px;height:11px;transform:rotate(45deg);border-radius:2px;box-shadow:0 0 0 2px rgba(0,0,0,.55),0 0 9px currentColor}',
  '.vcard .vc-kws{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 6px;font-style:normal}.vcard .vc-kw{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;padding:1px 7px;border-radius:999px;border:1px solid hsl(var(--h) 40% 60% / .55);color:hsl(var(--h) 50% 80%)}.vcard .vc-adds{margin:8px 12px 0;padding:8px 12px;border-top:1px solid var(--edge);font-size:12.5px;font-style:italic;color:hsl(var(--h) 18% 74%)}.vcard .vc-adds b{font-style:normal;letter-spacing:.08em;text-transform:uppercase;font-size:11px;color:hsl(var(--h) 55% 72%);margin-right:6px}',
  '.vcard{scroll-padding-bottom:84px}.vcard .vc-foot a,.vcard .vc-foot button,.vcard .vc-foot [role=button],.vcard .vc-foot input{pointer-events:auto}.vcard .vc-arrows{pointer-events:none}.vcard .vc-foot{pointer-events:none;position:sticky;bottom:-12px;padding:8px 0 12px;background:linear-gradient(180deg,transparent,hsl(var(--h) 22% 8%) 38%);z-index:2;display:flex;align-items:flex-end;justify-content:space-between;margin:8px 12px 0;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:hsl(var(--h) 15% 62%)}',
  '.vcard .vc-pt{min-width:58px;text-align:center;padding:3px 12px;background:linear-gradient(180deg,hsl(var(--h) 28% 26%),hsl(var(--h) 26% 14%));border:2px solid var(--edge);border-radius:9px 4px 9px 4px;font-size:17px;font-weight:700;letter-spacing:.05em;color:#f3efe2;box-shadow:0 2px 6px rgba(0,0,0,.5)}',
  '.vcard .vc-pt{display:flex;gap:8px;padding:3px 9px}.vcard .vc-pt span{font-size:10px;letter-spacing:.1em;color:hsl(var(--h) 30% 70%);display:flex;align-items:baseline;gap:3px}.vcard .vc-pt b{font-size:16px;color:#f3efe2;letter-spacing:.02em}',
  '.vcard .vc-arrows i{position:absolute;font-style:normal;font-size:12px;line-height:1;color:var(--edge);text-shadow:0 0 6px currentColor}.vcard .vc-arrows .in{top:-2px;left:50%;transform:translateX(-50%)}.vcard .vc-arrows .r{right:-1px;top:50%;transform:translateY(-50%)}.vcard .vc-arrows .l{left:-1px;top:50%;transform:translateY(-50%) scaleX(-1)}.vcard .vc-arrows .b{bottom:-3px;left:50%;transform:translateX(-50%) rotate(90deg)}',
  // type-specific layouts (asked by Verse: "Implement type-specific card layouts so that different response types (e.g., Film vs. Place) use unique
  // visual hierarchies"): the answer card's kind (card-kinds.js) decides what leads. A Film is a cinema screen: a tall letterboxed art box and an
  // italic centred title. A Place leads with where it is: its type line first, in large caps, then the title, over a shallow horizon. A Person is a
  // portrait: a round art box centred above the name. A Song is a record sleeve: a thin strip, the title with a note before it.
  '.vpage.vcard[data-kind=film] .vc-art{height:112px;box-shadow:inset 0 16px 0 #000,inset 0 -16px 0 #000}.vpage.vcard[data-kind=film] .vc-title{justify-content:center;font-style:italic;font-family:Georgia,serif;letter-spacing:.06em}.vpage.vcard[data-kind=film] .vc-title::after{content:none}',
  '.vpage.vcard[data-kind=place]{display:flex!important;flex-direction:column}.vpage.vcard[data-kind=place] .vc-type{order:-3;margin-top:12px;margin-bottom:0;font-size:15px;letter-spacing:.2em;border-radius:6px 6px 0 0}.vpage.vcard[data-kind=place] .vc-title{order:-2;margin-top:0!important;border-radius:0 0 12px 12px/0 0 16px 16px}.vpage.vcard[data-kind=place] .vc-art{order:-1;height:44px;background:linear-gradient(180deg,hsl(var(--h) 55% 62%) 0 52%,hsl(var(--h) 40% 24%) 52%)}.vpage.vcard[data-kind=place] .vc-arrows{order:99}',
  '.vpage.vcard[data-kind=person] .vc-art{width:84px;height:84px;margin:10px auto 0;border-radius:50%;border-width:3px}.vpage.vcard[data-kind=person] .vc-title{justify-content:center;text-align:center}.vpage.vcard[data-kind=person] .vc-title::after{content:none}.vpage.vcard[data-kind=person] .vc-type{justify-content:center;gap:10px}',
  '.vpage.vcard[data-kind=song] .vc-art{height:40px}.vpage.vcard[data-kind=song] .vc-title::before{content:"\\266A";margin-right:8px;color:hsl(var(--h) 60% 74%)}',
  // the stats chip sits in the footer row after the copy / save actions, in the flow: it never floats over the text (owner, 2026-10-18: "P 1 R 39" hid words)
  '.vcard .vc-foot{position:static!important;background:none!important;padding:8px 0 4px!important;align-items:center;flex-wrap:wrap;gap:6px 10px}',
  '.vcard .vc-route{margin:6px 18px 0;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:0;text-transform:none;color:hsl(var(--h) 14% 70%)!important}',
  // two voices, two looks: the source's excerpt is a quotation (left rule, darker ground, its source line attached); Verse's take is labelled in a bright, bold ink
  '.vpage.vcard[data-card-extract]>p:not(.vc-route){border-left:3px solid hsl(var(--h) 38% 48%);background:rgba(0,0,0,.26);padding:8px 12px;margin-bottom:0;border-radius:0 6px 0 0;color:#dcd8ca}',
  '.vpage.vcard[data-card-extract]>.src{margin-top:0;padding:4px 12px 8px;border-left:3px solid hsl(var(--h) 38% 48%);background:rgba(0,0,0,.26);border-radius:0 0 6px 0;font-size:11.5px;color:hsl(var(--h) 18% 76%)}',
  '.vcard .take-label{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:hsl(var(--h) 70% 82%);margin-bottom:3px}',
  // the read-aloud button shares the title bar's row and right edge, and the title leaves room for it (owner, 2026-10-18)
  '.vcard>.vread{position:absolute!important;float:none!important;top:12px!important;right:22px!important;margin:0!important;width:32px;height:32px}.vcard .vc-title{padding-right:50px}',
  // a very long answer is an accordion (lib/card-sections.js): the first section open, the rest behind one-line summaries; the text stays in the page
  '.vcard .vc-sec{margin:6px 18px 0;border:1px solid hsl(var(--h) 25% 28%);border-radius:6px}.vcard .vc-sec-head{display:block;width:100%;text-align:left;font:inherit;font-size:13px;font-weight:600;color:hsl(var(--h) 40% 84%);background:hsl(var(--h) 22% 14%);border:0;border-radius:6px;padding:8px 12px 8px 30px;cursor:pointer;position:relative}',
  '.vcard .vc-sec-head::before{content:"\\25B8";position:absolute;left:11px;top:8px;transition:none}.vcard .vc-sec-head[aria-expanded=true]::before{content:"\\25BE"}.vcard .vc-sec-head:focus-visible{outline:2px solid hsl(var(--h) 70% 70%);outline-offset:1px}.vcard .vc-sec-body{padding:6px 12px 2px}.vcard .vc-sec-body>*{margin-left:0!important;margin-right:0!important}',
  // a film with a real poster (owner, 2026-10-18): a clean two-column card. The poster keeps its own portrait shape on the left (never cropped or stretched,
  // a thin ink edge); the title, type line and the rest of the card stack to its right. Narrow screens centre the poster above the rest.
  '.vpage.vcard[data-poster]{display:grid!important;grid-template-columns:228px minmax(0,1fr);align-content:start}.vpage.vcard[data-poster]>*{grid-column:2}.vpage.vcard[data-poster]>.vread{grid-column:auto}',
  '.vpage.vcard[data-poster] .vc-art{grid-column:1;grid-row:1 / span 8;align-self:start;position:relative;width:200px;height:auto;max-height:none;aspect-ratio:2/3;margin:14px 0 14px 14px;border:2px solid var(--edge)!important;border-radius:3px;box-shadow:none;background:hsl(var(--h) 30% 8%)}',
  '.vpage.vcard[data-poster] .vc-art::before{content:none}',
  '.vpage.vcard[data-poster] .vc-art img.vc-art-photo{object-fit:contain!important;object-position:50% 50%!important}',
  '.vpage.vcard[data-poster] .vc-title{margin-top:14px!important;justify-content:flex-start;text-align:left}',
  '.vpage.vcard[data-poster] .vc-adds,.vpage.vcard[data-poster] .vc-share,.vpage.vcard[data-poster] .vc-route,.vpage.vcard[data-poster] .vc-foot,.vpage.vcard[data-poster] .vc-arrows{grid-column:1 / -1}',
  '.vpage.vcard[data-poster]>img{position:absolute;width:0;height:0;margin:0;opacity:0;pointer-events:none}', // the source's own thumbnail is the poster in the art box: not shown twice
  '@media (max-width:520px){.vpage.vcard:not(.skyc){max-height:min(60vh,calc(100vh - 140px))}.vcard .vc-title{margin:8px 6px 0!important;font-size:18px}.vcard .vc-art,.vcard .vc-type,.vcard .vc-adds,.vcard .vc-foot{margin-left:6px;margin-right:6px}.vpage.skyc .vc-art{height:0;margin-top:0;margin-bottom:0;border:0;overflow:hidden}.vpage.vcard:not(.skyc) .vc-art{max-height:28vh;margin-top:4px}.vcard .vc-type{margin-bottom:8px}.vpage.skyc .vc-title,.vpage.skyc .vc-type,.vpage.skyc .vc-adds{height:0;margin:0!important;padding:0;border:0;overflow:hidden}.vcard .vc-adds:not([data-facts]){height:0;margin:0!important;padding:0;border:0;overflow:hidden}.vcard .vc-adds[data-facts] .vc-addstext,.vcard .vc-adds[data-facts] .vc-kws{display:block;height:0;margin:0;padding:0;overflow:hidden}.vcard .vc-pt{gap:5px;padding:3px 6px}.vcard .vc-foot{font-size:9.5px;gap:6px}}',
  '@media (max-width:520px){.vpage.vcard[data-poster]{grid-template-columns:minmax(0,1fr)}.vpage.vcard[data-poster]>*{grid-column:1}.vpage.vcard[data-poster] .vc-art{grid-row:auto;justify-self:center;width:min(46%,170px);height:auto!important;margin:12px auto 4px!important;overflow:hidden}.vpage.vcard[data-poster] .vc-title{margin:8px 6px 0!important;justify-content:center;text-align:center}.vpage.vcard[data-poster] .vc-type,.vpage.vcard[data-poster] .vc-adds,.vpage.vcard[data-poster] .vc-foot{margin-left:6px}}',
  // the comic-ink layer (owner, 2026-10-18: "design the almost comic like epic v01d cards"): heavy black ink round every panel with an offset
  // shadow like a printed panel, a bold outlined title banner, the stats in an inked plate, and halftone dots over the art
  '.vpage.vcard{outline:3px solid #000;outline-offset:-1px}',
  '.vcard .vc-title{font-family:"Bangers","Impact","Anton","Arial Black",system-ui,sans-serif!important;font-weight:800;letter-spacing:.06em;color:#fff7e0;text-shadow:2px 2px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;border:3px solid #000!important;box-shadow:inset 0 0 0 2px var(--edge),4px 4px 0 #000}',
  '.vcard .vc-art{border:3px solid #000!important;box-shadow:inset 0 0 0 2px var(--edge),5px 5px 0 #000;border-radius:3px}',
  '.vcard .vc-art::before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:radial-gradient(circle,rgba(0,0,0,.28) 0.9px,transparent 1.3px) 0 0/5px 5px;mix-blend-mode:multiply;opacity:.55}',
  '.vcard .vc-type{border:3px solid #000!important;box-shadow:inset 0 0 0 2px var(--edge),3px 3px 0 #000;font-weight:700;color:#f3efe2}',
  '.vcard .vc-pt{border:3px solid #000!important;box-shadow:inset 0 0 0 2px var(--edge),3px 3px 0 #000;transform:rotate(-2deg)}.vcard .vc-pt b{text-shadow:1px 1px 0 #000,-1px -1px 0 #000}',
  // a utility card's share bar (data-card-plain): small, quiet and after a thin rule, so the card's own actions lead
  '.vcard-plain .vc-share{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;margin:14px 0 0;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)}.vcard-plain .vc-share .vc-grp{display:flex;flex-wrap:wrap;align-items:center;gap:6px}',
  '.vcard-plain .vc-share .vc-grp::before{content:attr(data-label);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#a9afc2}',
  '.vcard-plain .vc-share button{font:inherit;font-size:12px;padding:4px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.16);background:transparent;color:#c9cede;cursor:pointer;min-height:28px}',
  '.vcard-plain .vc-share button:hover,.vcard-plain .vc-share button:focus-visible{background:rgba(255,255,255,.08);outline:2px solid rgba(160,190,255,.7);outline-offset:1px}.vcard-plain .vc-share .vc-full{font-size:10.5px;color:#a9afc2}',
  // subject themes (lib/subject-kinds.js): the frame follows what the card is about. Facts as small badges, and a plain "not affiliated" line on someone else's work.
  '.vcard .vc-badges{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;font-style:normal}.vcard .vc-badge{font-size:11.5px;letter-spacing:.04em;padding:2px 9px;border-radius:999px;background:hsl(var(--h) 30% 20%);border:1px solid hsl(var(--h) 40% 56% / .6);color:hsl(var(--h) 30% 90%)}.vcard .vc-badge i{font-style:normal;text-transform:uppercase;font-size:10px;letter-spacing:.1em;color:hsl(var(--h) 55% 74%);margin-right:3px}',
  '.vcard .vc-notice{margin-top:6px;font-size:11px;font-style:normal;letter-spacing:.04em;color:hsl(var(--h) 14% 72%)}',
  // collectible: a toy or a character in a blister pack. A bright card back (the foil border), a die-cut window round the art, a hang hole, a corner sticker and a bold name plate. Original colours and shapes: no show, studio or brand trade dress.
  '.vpage.vcard[data-theme=collectible]{--foil:linear-gradient(135deg,#ffd447,#ff7a3d,#ffe27a,#f2562b)!important;position:relative}.vpage.vcard[data-theme=collectible]::before{content:"";position:absolute;top:-5px;left:50%;width:34px;height:12px;margin-left:-17px;border-radius:0 0 12px 12px;background:#0b0d14;box-shadow:inset 0 -3px 0 rgba(255,255,255,.18);z-index:3}',
  '.vpage.vcard[data-theme=collectible] .vc-title{text-transform:uppercase;letter-spacing:.08em;font-weight:800;justify-content:center;background:linear-gradient(90deg,#c8372d,#ff7a3d);color:#fff;border-color:#ffe27a;border-radius:6px}.vpage.vcard[data-theme=collectible] .vc-title::after{content:none}',
  '.vpage.vcard[data-theme=collectible] .vc-art{border:4px solid #fff7d6;border-radius:18px;box-shadow:inset 0 0 0 3px #c8372d,0 3px 0 rgba(0,0,0,.4)}.vpage.vcard[data-theme=collectible] .vc-type{justify-content:center;gap:10px}',
  '.vpage.vcard[data-theme=collectible] .vc-art::after{content:"FIGURE";position:absolute;top:8px;right:8px;transform:rotate(5deg);padding:2px 10px;font:700 11px/1.4 system-ui,sans-serif;letter-spacing:.14em;color:#3a1608;background:#ffe27a;border-radius:3px;box-shadow:0 1px 0 rgba(0,0,0,.4)}',
  // plain: a company, a concept, a book: a quiet fact card, no foil, a thin rule
  '.vpage.vcard[data-theme=plain]{--foil:linear-gradient(135deg,#59616f,#2b303a,#59616f,#262b34)!important}.vpage.vcard[data-theme=plain] .vc-art{aspect-ratio:16/5;max-height:92px}',
  // specimen: an animal, a plant, a dish: a field-guide plate, the art in a ruled frame
  '.vpage.vcard[data-theme=specimen]{--foil:linear-gradient(135deg,#8fbf7a,#3f6b3a,#c7e2a8,#2e5230)!important}.vpage.vcard[data-theme=specimen] .vc-art{border-style:double;border-width:5px}',
  '.vpage.vcard[data-kind=place] .vc-art.has-photo{height:auto;aspect-ratio:16/9;max-height:220px}',
  '.vpage.vcard[data-theme=portrait] .vc-art{box-shadow:inset 0 0 0 4px rgba(255,255,255,.12)}.vpage.vcard[data-theme=sleeve] .vc-art{aspect-ratio:1/1;max-height:min(260px,36vh);width:min(260px,70%);margin-left:auto;margin-right:auto}',
].join('') + LOOK_CSS + FORGE_CSS + SEAL_CSS + SHARE_CSS;

// Skill evolution (asked by Verse: "Create a 'Skill Evolution' animation where a card visually upgrades its border or glow when a new 'proven'
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

// the full page of a skill that has one (owner, 2026-10-25: "why are you not linking the cards to the pages?"): a card from one of these skills
// carries a link to its page, the one the Versus fights are measured on
import { SITE_PAGES } from './tool-sites.js';
export const PAGE_OF = Object.freeze({ ...Object.fromEntries(SITE_PAGES.map((p) => ['site ' + p.path, [p.path, p.name]])), 'pdf-tools': ['/pdf/', 'PDF tools'], 'kanban-board': ['/kanban/', 'Kanban board'], calendar: ['/calendar/', 'Calendar'], 'calendar-file': ['/calendar/', 'Calendar'], translate: ['/translate/', 'Translate'],
  weather: ['/weather/', 'Weather'], recipe: ['/recipes/', 'Recipes'], calc: ['/calculator/', 'Calculator'], 'calc-more': ['/calculator/', 'Calculator'],
  convert: ['/convert/', 'Unit converter'], gradient: ['/gradient/', 'Gradient'], wheel: ['/wheel/', 'Wheel of names'], coin: ['/flip/', 'Coin flip'],
  'is-it': ['/is-it/christmas', 'Is it…?'], baseconv: ['/base-converter/', 'Base converter'], timer: ['/stopwatch/', 'Stopwatch and timer'],
  words: ['/word-count/', 'Word counter'], fakeuser: ['/random-user/', 'Made-up people'], time: ['/time/', 'Time zones'], colour: ['/color/', 'Colour codes'], color: ['/color/', 'Colour codes'],
  password: ['/password/', 'Password generator'], base64: ['/base64/', 'Base64'], random: ['/random/', 'Random number'],
  worldtime: ['/time/', 'Time zones'], imgfit: ['/resize-image/', 'Resize an image'], 'photo-tools': ['/photos/', 'Photo tools'], pwcheck: ['/password-strength/', 'Password strength'], toolkit: ['/tools/', 'Every tool'],
  podcast: ['/podcasts/', 'Podcasts'], notepad: ['/notes/', 'Notes'], textgen: ['/generators/', 'Generators'], boards: ['/boards/', 'Boards'], fanfic: ['/fanfic/', 'Fan fiction'], draw: ['/learn-to-draw/', 'Learn to draw'], markets: ['/markets/', 'Markets'], news: ['/news/', 'News'], scores: ['/scores/', 'Scores'], 'sports-browse': ['/sports/', 'Sports'], fantasy: ['/fantasy/', 'Fantasy tools'], metronome: ['/metronome/', 'Metronome'], piano: ['/piano/', 'Piano'], tuner: ['/tuner/', 'Tuner'], bpm: ['/bpm/', 'BPM counter'], chordfinder: ['/chords/', 'Chords and scales'], 'music-tools': ['/music/', 'Music tools'], cartoon: ['/image/', 'AI image generator'], formulas: ['/calculators/', 'Formula calculators'], repo: ['/ledger/', 'Repo activity ledger'] });
// a card from a skill or a built-in answer that does several things (util: colours, word counts, passwords; the page's own calculator,
// stopwatch and random number) names its page itself with data-page; only a page in this list is linked (owner, 2026-10-25: "and vice versa")
export const PAGE_PATHS = Object.freeze(Object.fromEntries(Object.values(PAGE_OF).map(([href, label]) => [href, label])));
// a data-page may carry what the card shows in a plain query ('/random/?min=-5&max=5'), so the page opens on it, not on its default
const PAGE_QUERY = /^\?[A-Za-z0-9_.=&%-]{1,200}$/;
/** the [href, label] of a card's full page: its own data-page when it is a known page (with a plain query or none), else its skill's; null when it has none. Pure. */
export const pageOfCard = (name, page) => {
  const i = page ? page.indexOf('?') : -1, base = i < 0 ? page : page.slice(0, i);
  return page && PAGE_PATHS[base] && (i < 0 || PAGE_QUERY.test(page.slice(i))) ? [page, PAGE_PATHS[base]] : PAGE_OF[name] || null;
};
/** the link to a skill's full page, or '' when it has none. Pure. */
export const pageLinkHtml = (name, esc, page = '') => { const p = pageOfCard(name, page); return p ? '<a class="vc-page" href="' + esc(p[0]) + '" style="display:inline-block;margin:6px 0 2px;font-size:13px;font-weight:600">Open the full ' + esc(p[1]) + ' page →</a>' : ''; };

/** put the card's frame on a page, or refresh it: idempotent, and safe to call from a MutationObserver (it only writes when it changes). */
export function keep(el, esc, stats) {
  if (!el || !el.classList) return;
  if (el.dataset && el.dataset.cardPlain !== undefined) { plain(el); return; } // a utility card asks for no collectible frame (data-card-plain)
  if (!el.classList.contains('vcard')) el.classList.add('vcard');
  // a minted collectible (skills/collectible.js) stays the card of its subject, not of the skill that minted it
  const name = el.dataset.collect ? '' : el.dataset.skill || '', srcLinks = el.querySelectorAll(SOURCE_LINKS).length, src = el.querySelector(SOURCE_BOX);
  const entity = !name && el.dataset.cardDesc !== undefined ? { ...kindOf(el.dataset.cardDesc, el.dataset.cardExtract), also: (el.dataset.cardAlso || '').split(',').filter(Boolean) } : null;
  let own = null; try { own = el.dataset.cardOwn ? JSON.parse(el.dataset.cardOwn) : null; } catch (_) {} // a merged card brings its own worked-out numbers
  // a body that says it found nothing ("I do not have information ...") is a Not found card: no source count, no stats, no "Adds to Verse", a neutral picture
  const bodyText = !name && !own ? answerText(el) : '', notFound = !name && !own && (el.dataset.notFound !== undefined || (bodyText.length > 12 && isNoAnswer(bodyText)));
  const c = own ? ownCard(own) : cardOf({ ...lookup(stats, name), notFound, entity: notFound ? null : entity, kind: el.dataset.cardKind || '', artKind: el.dataset.artKind || '', artMeta: el.dataset.artKind ? { genre: el.dataset.artGenre || '', year: el.dataset.artYear || '' } : null, sources: name ? null : srcLinks || null, ageDays: name ? null : editedDaysAgo(src && src.textContent) });
  if (pageOfCard(name, el.dataset.page) && !el.querySelector(':scope > .vc-page')) { const t0 = document.createElement('template'); t0.innerHTML = pageLinkHtml(name, esc, el.dataset.page); /* void-review: ok: fixed table, escaped */ const a = t0.content.firstChild; let tail = el.lastElementChild; while (tail && (tail.classList.contains('vtail') || tail.classList.contains('vtell') || tail.classList.contains('vtell-box') || tail.classList.contains('vc-arrows') || tail.classList.contains('vc-foot') || tail.classList.contains('vc-adds'))) tail = tail.previousElementSibling; if (tail) tail.after(a); else el.appendChild(a); }
  // the frame follows the subject's kind, read from the fetched description (lib/subject-kinds.js): a theme, badges from the answer's own facts, and a
  // "not affiliated" line on a card about someone else's work
  const kindTitle = c.kindName ? c.kindName.charAt(0).toUpperCase() + c.kindName.slice(1) : '';
  if (!own && !name && !notFound && kindTitle) { const kw = (c.typeLine.split(/\s*[\u00b7\u2014]\s*/)[0] || kindTitle).trim(); c.badges = badgesOf(kw, bodyText || answerText(el)); c.notice = noticeOf(kw, el.dataset.cardSeries || ''); c.theme = themeOf(kw); }
  if (c.theme) el.dataset.theme = c.theme; else delete el.dataset.theme;
  const h2t = el.querySelector('h2'); c.key = notFound ? 'not found' : name || (h2t ? h2t.textContent.trim() : '') || c.typeLine; c.season = seasonOf(new Date().getMonth(), typeof location !== 'undefined' ? location.search : '');
  // the art is of the subject (owner, 2026-10-17: the art should be of the subject of each card): when the answer carries a picture of the thing
  // (its source's thumbnail), the art box shows that picture in its true colour (owner, 2026-10-17: the ink filter stripped a poster's colour), under a light ink texture; with none, the plate of its kind
  const photoImg = [...el.querySelectorAll('img[src]')].find((i) => !i.closest('.vc-art') && /^https:\/\//.test(i.getAttribute('src') || '')), photo = photoImg ? photoImg.getAttribute('src') : '';
  // the card's subject is what its ANSWER is about (lib/card-subject.js), not the ask's words: the plate draws it, the Art Forge paints it
  const subj = c.isSkill || own || notFound ? { nouns: [], phrase: '' } : subjectOf(c.key, answerText(el)); c.nouns = subj.nouns; el._vcSubject = subj.phrase;
  const key = JSON.stringify([c.key, c.nouns, c.season, c.isSkill, c.chapter, c.typeLine, c.cost, c.power, c.toughness, c.income, c.arrowsOut, c.arrowIn, c.number, c.adds, c.artKind, c.artHue, c.artInk, c.rarity && c.rarity.name, c.hue, photo, c.badges, c.notice, c.theme]);
  const h2 = el.querySelector('h2');
  if (h2 && !h2.classList.contains('vc-title')) h2.classList.add('vc-title');
  // the title row spreads its children (flex, space-between): a title made of loose text and inline pieces (the films title's glitching I)
  // was pulled apart into "VERSE F   I   LMS" (owner, 2026-10-22), so a mixed title is kept as one word box
  if (h2 && h2.childNodes.length > 1 && [...h2.childNodes].some((n) => n.nodeType === 3 && n.data.trim())) { const w = document.createElement('span'); w.className = 'vc-tw'; while (h2.firstChild) w.appendChild(h2.firstChild); h2.appendChild(w); }
  // the page keeps its own lines last (a product line, the Tell Verse link): the arrows sit before them, never after, or the two keep moving past each other forever
  const trailing = (n) => n.classList.contains('vtail') || n.classList.contains('vtell') || n.classList.contains('vtell-box');
  let last = el.lastElementChild; while (last && trailing(last)) last = last.previousElementSibling;
  if (el.dataset.cardKey === key && el.querySelector(':scope > .vc-type') && el.querySelector(':scope > .vc-arrows') === last) return;
  for (const n of el.querySelectorAll(':scope > .vc-art, :scope > .vc-type, :scope > .vc-adds, :scope > .vc-foot, :scope > .vc-arrows')) n.remove();
  el.style.setProperty('--h', String(c.hue));
  el._vcard = c; el.dataset.cardKey = key; el.dataset.rarity = c.rarity ? c.rarity.name.toLowerCase() : 'answer';
  if (c.kindName) el.dataset.kind = c.kindName; else delete el.dataset.kind;
  const look = name ? lookOfSkill(stats && stats.fam, name) : ''; if (look) el.dataset.look = look; else delete el.dataset.look; // asked by Verse: the family decides the frame
  if (h2) h2.dataset.cost = c.cost ? '◆'.repeat(c.cost) : '';
  const html = chromeHtml(c, esc), tpl = document.createElement('template');
  tpl.innerHTML = html.art + html.type; /* void-review: ok: chromeHtml escapes every text field */ const top = [...tpl.content.childNodes];
  if (h2 && h2.parentNode === el) { let at = h2; for (const n of top) { at.after(n); at = n; } } else for (const n of top.reverse()) el.prepend(n);
  // a real picture is the art (owner, 2026-10-18): it is the only thing in the box, with no plate, seal, texture or painting under or over it
  const source = artSource({ photo, painting: !!el._vcForge, hasArt: !!el.querySelector(':scope > .vc-art') }); // lib/art-source.js: one picture in the slot
  if (source === 'photo') { const box = el.querySelector(':scope > .vc-art'); if (box) {
    for (const n of box.querySelectorAll(':scope > svg, :scope > .vc-seal')) n.remove(); box.classList.remove('vc-sealed'); box.classList.add('has-photo');
    const im = document.createElement('img'); im.className = 'vc-art-photo'; im.alt = ''; im.referrerPolicy = 'no-referrer'; im.loading = 'lazy'; im.src = photo; box.appendChild(im);
    if (c.kindName === 'film') { el.dataset.poster = '1'; im.addEventListener('load', () => { if (im.naturalWidth > im.naturalHeight * 1.15) delete el.dataset.poster; }); } else delete el.dataset.poster; // a portrait poster gets the two-column layout, a landscape still keeps the wide box
  } } else delete el.dataset.poster;
  tpl.innerHTML = html.adds + html.foot + html.arrows; // void-review: ok: built by chromeHtml, every text field escaped
  let anchor = null; for (let n = el.lastElementChild; n && trailing(n); n = n.previousElementSibling) anchor = n;
  for (const n of [...tpl.content.childNodes]) el.insertBefore(n, anchor);
  // the header box holds the hard facts, so the description line under it keeps only what is new (lib/card-kinds.js newInSub); the "closest match"
  // routing note is a small monospace line at the bottom of the card, by the stats, not above the answer
  const sub = el.querySelector(':scope > .sub'); if (sub && entity) { const rest = newInSub(el.dataset.cardDesc, c.typeLine); sub.textContent = rest; sub.hidden = !rest; }
  // one title and the small kind label (owner, 2026-10-18): a heading in the answer that only repeats the card's title is dropped
  if (h2 && !c.isSkill && !own) { const first = [...el.children].find((n) => /^H[1-4]$/.test(n.tagName) && n !== h2); if (first && repeatsTitle(h2.textContent, first.textContent)) first.hidden = true; }
  const thin = el.querySelector(':scope > p.thin'), foot0 = el.querySelector(':scope > .vc-foot'); if (thin && foot0) { thin.classList.add('vc-route'); thin.removeAttribute('style'); foot0.before(thin); }
  if (source === 'seal') sealArt(el.querySelector(':scope > .vc-art'), { key: c.key || c.name || c.typeLine, kind: c.artKind || kindWord(c.typeLine), hue: c.artHue != null ? c.artHue : c.hue, rarity: c.rarity, nouns: c.nouns }); // the void seal (lib/void-seal.js): Verse's procedural art under any painted picture
  // the picture says what it shows (a11y, and the page tests read it): the subject's own motif, drawn from the answer, never from one word of the ask
  { const box = el.querySelector(':scope > .vc-art'); if (box && !c.isSkill && !own) { const m = notFound ? '' : kindTitle === 'Person' ? 'a neutral portrait' : (motifsFor(c.nouns)[0] || ''), label = (notFound ? 'Neutral picture' : 'Picture of ' + (m ? m + ' for ' : '') + (h2t ? h2t.textContent.trim() : c.key)); box.setAttribute('role', 'img'); box.setAttribute('aria-label', label); box.dataset.subject = m || (c.nouns || []).slice(0, 3).join(' '); } }
  forge(el, c, !!photo); // the Art Forge (lib/card-forge.js): painted art for an answer or merged card, or a "paint this card" button
  accordion(el); // a very long body: sections behind one-line summaries
  shareBar(el); // copy card / save card (lib/card-share.js)
  // no "Evolved" note on cards any more (owner, 2026-10-18: "get rid of the evolved stuff"); evolved() and noteTier() stay for the ratings
}

/** a utility card (owner, 2026-10-18, the spectators card: "make sure its perfect i dont like it at all"): a page that sets data-card-plain keeps
 *  the plain glass page, with no foil frame, rarity, art, type line, stats or arrows; only the share bar (copy / save) is added, and its saved
 *  picture is the plain one (lib/card-image.js plainSvg). Idempotent. */
function plain(el) {
  el.classList.remove('vcard'); el.classList.add('vcard-plain'); el._vcard = null;
  for (const n of el.querySelectorAll(':scope > .vc-art, :scope > .vc-type, :scope > .vc-adds, :scope > .vc-foot, :scope > .vc-arrows')) n.remove();
  shareBar(el);
}

/** a body past 3,000 characters becomes an accordion (lib/card-sections.js decides the cut). Every node stays in the page, so copy card and save text keep it all. Never throws. */
function accordion(el) {
  try {
    if (el.querySelector(':scope > .vc-sec') || el.dataset.skill || el.dataset.cardOwn) return;
    const nodes = [...el.children].filter((n) => /^(P|UL|OL|PRE|BLOCKQUOTE|TABLE|H[1-6])$/.test(n.tagName) && !n.classList.contains('vc-title') && !n.classList.contains('vc-route') && !n.hidden);
    const secs = sectionsOf(nodes.map((n) => ({ heading: /^H\d$/.test(n.tagName), text: n.textContent })));
    if (!secs.length) return;
    el.dataset.sections = String(secs.length);
    secs.forEach((sc, i) => {
      const group = nodes.slice(sc.from, sc.to + 1), wrap = document.createElement('div'), head = document.createElement('button'), body = document.createElement('div'), id = 'vcs' + Math.random().toString(36).slice(2, 8);
      wrap.className = 'vc-sec'; head.type = 'button'; head.className = 'vc-sec-head'; head.textContent = sc.title; head.setAttribute('aria-expanded', i === 0 ? 'true' : 'false'); head.setAttribute('aria-controls', id); head.dataset.nospeak = '1';
      body.className = 'vc-sec-body'; body.id = id; body.hidden = i !== 0;
      head.addEventListener('pointerdown', (e) => e.stopPropagation());
      head.addEventListener('click', (e) => { e.stopPropagation(); const open = head.getAttribute('aria-expanded') !== 'true'; head.setAttribute('aria-expanded', String(open)); body.hidden = !open; });
      group[0].before(wrap); wrap.append(head, body); for (const n of group) body.appendChild(n);
    });
  } catch (_) {}
}

let styled = false;
/** the one stylesheet, once */
export function style() { if (styled || typeof document === 'undefined') return; styled = true; const s = document.createElement('style'); s.id = 'vcard-css'; s.textContent = CARD_CSS; document.head.appendChild(s); }
