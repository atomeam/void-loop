// Importing a recipe (Cookpad: from a link, from a photo of a card): the pure half, shared by /api/recipeimport and the recipes page. Three sources, one shape (the page's own:
// name, servings, time, ingredients, steps): a web page's schema.org Recipe data (almost every recipe site writes it for search engines), pasted text with an "Ingredients" and a
// "Method" heading, and the text a vision model read from a photo of a card (which is pasted text again). Everything is cut to a sane size and kept as plain text; an address
// that is not https is dropped, and nothing of the page but the recipe leaves the server. Pure. Tests: tools/recipeimport.test.mjs.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', frac12: '½', frac14: '¼', frac34: '¾', deg: '°', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', eacute: 'é', egrave: 'è', ccedil: 'ç', ouml: 'ö', uuml: 'ü', auml: 'ä' };
/** HTML entities in a string as the characters they name (a few names and every number); never markup. Pure. */
export const decode = (s) => String(s == null ? '' : s).replace(/&(?:#(\d{1,6})|#x([0-9a-f]{1,5})|([a-z0-9]{2,8}));/gi, (m, d, h, n) => { const c = d ? +d : h ? parseInt(h, 16) : null; if (c != null) return c > 0 && c < 0x110000 && !(c >= 0xd800 && c < 0xe000) ? String.fromCodePoint(c) : ' '; return ENT[n.toLowerCase()] ?? m; });
/** text made of what a field holds: tags stripped, entities decoded, spaces folded, cut to `max`. Pure. */
export const plain = (s, max = 300) => decode(String(s == null ? '' : s).replace(/<[^>]*>/g, ' ')).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
/** minutes in an ISO 8601 duration ("PT1H30M" is 90, "P0DT45M" is 45); 0 for anything else. Pure. */
export function minutesOf(d) { const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/i.exec(String(d || '').trim()); return m ? (+(m[1] || 0)) * 1440 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0; }
/** the number of servings in a recipeYield ("4 servings", 4, ["4", "4 servings"], "Makes 12 cookies"); 0 when none. Pure. */
export function yieldOf(v) { const s = Array.isArray(v) ? v.map(String).join(' ') : String(v == null ? '' : v); const m = /\d+/.exec(s); const n = m ? +m[0] : 0; return n >= 1 && n <= 200 ? n : 0; }
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
/** every step in recipeInstructions, flattened: a string (split on line breaks), HowToStep { text }, HowToSection { itemListElement }, a list of those. Pure. */
export function stepsOf(v, depth = 0) {
  const out = []; if (depth > 4) return out;
  for (const x of arr(v)) {
    if (typeof x === 'string') { for (const p of x.replace(/<\/(?:p|li|div)>|<br\s*\/?>/gi, '\n').split(/\n+/)) { const t = plain(p, 600).replace(/^(?:step\s*)?\d+\s*[.):-]\s*/i, ''); if (t.length > 2) out.push(t); } }
    else if (x && typeof x === 'object') { if (x.itemListElement) out.push(...stepsOf(x.itemListElement, depth + 1)); else { const t = plain(x.text || x.name || '', 600).replace(/^(?:step\s*)?\d+\s*[.):-]\s*/i, ''); if (t.length > 2) out.push(t); } }
  }
  return out.slice(0, 60);
}
const isRecipe = (n) => n && typeof n === 'object' && arr(n['@type']).some((t) => /(?:^|[/#])Recipe$/i.test(String(t)));
function findRecipe(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) { for (const x of node) { const r = findRecipe(x, depth + 1); if (r) return r; } return null; }
  if (isRecipe(node)) return node;
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) { const r = findRecipe(node[k], depth + 1); if (r) return r; }
  return null;
}
const slug = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'recipe';
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };
/** the page's recipe shape from a recipe with its fields as plain text, or null when it has no name or no ingredients. Pure. */
export function shape({ name, servings, time, ingredients, steps, image, source, author }) {
  const n = plain(name, 120); const ing = (ingredients || []).map((x) => plain(x, 200)).filter((x) => x.length > 1).slice(0, 80); const st = (steps || []).map((x) => plain(x, 600)).filter((x) => x.length > 2).slice(0, 60);
  if (!n || !ing.length) return null;
  const src = /^https:\/\//i.test(String(source || '')) ? String(source).slice(0, 500) : '', img = /^https:\/\/[^\s"'<>]+$/i.test(String(image || '')) ? String(image).slice(0, 500) : '';
  return { id: 'mine-' + slug(n), name: n, aliases: [n.toLowerCase()], tags: ['mine', 'imported'], servings: servings > 0 ? Math.min(200, Math.round(servings)) : 4, ...(servings > 0 ? {} : { servingsGuessed: true }), time: Math.min(2880, Math.max(0, Math.round(time || 0))), ingredients: ing, steps: st.length ? st : ['See the original recipe.'],
    image: img, source: src, video: '', from: (src && hostOf(src)) || plain(author, 60) || '' };
}
/** a web page's recipe (its schema.org JSON-LD), or null when the page has none: { recipe } as the page's shape. Pure. */
export function parseRecipePage(html, url = '') {
  const blocks = [...String(html || '').matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const b of blocks) {
    let j; try { j = JSON.parse(b.trim().replace(/^<!--|-->$/g, '')); } catch (_) { continue; }
    const r = findRecipe(j); if (!r) continue;
    const img = arr(r.image).map((i) => (typeof i === 'string' ? i : i && (i.url || i.contentUrl))).find((u) => /^https:\/\//i.test(String(u || '')));
    const t = minutesOf(r.totalTime) || (minutesOf(r.prepTime) + minutesOf(r.cookTime)), author = arr(r.author).map((a) => (typeof a === 'string' ? a : a && a.name)).filter(Boolean)[0];
    const out = shape({ name: r.name || r.headline, servings: yieldOf(r.recipeYield), time: t, ingredients: arr(r.recipeIngredient || r.ingredients).map(String), steps: stepsOf(r.recipeInstructions), image: img, source: url, author });
    if (out) return out;
  }
  return null;
}
const HEAD_ING = /^\s*(?:ingredients?|zutaten|you(?:'|’)ll need|what you need|ingr[eé]dients)\s*:?\s*$/i, HEAD_STEP = /^\s*(?:instructions?|directions?|method|steps?|preparation|how to make(?: it)?|zubereitung|anleitung|so geht(?:'|’)?s)\s*:?\s*$/i;
/** a recipe from pasted text (or text read from a photo): a title line, "Serves 4", an Ingredients heading and a Method heading; the heading words in English and German. Without the
 *  headings, lines that start with an amount are ingredients and the rest are steps. null when no ingredients are found. Pure. */
export function parseRecipeText(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map((l) => l.replace(/^\s*(?:[-*•·▪◦☐□✓]|\d+[.)])\s+/, '').trim()).filter((l) => l.length), n = lines.length; if (!n) return null;
  const ii = lines.findIndex((l) => HEAD_ING.test(l)), si = lines.findIndex((l) => HEAD_STEP.test(l));
  let title = '', ing = [], steps = [], head = [];
  const AMOUNT = /^(?:\d|[¼½¾⅓⅔⅛]|an? |a few |a pinch|a handful|one |two |three |some |etwas |eine? |ein paar )/i;
  if (ii >= 0) { head = lines.slice(0, ii); ing = lines.slice(ii + 1, si > ii ? si : n); steps = si >= 0 ? (si > ii ? lines.slice(si + 1) : lines.slice(si + 1, ii)) : []; if (si >= 0 && si < ii) head = lines.slice(0, si); }
  else if (si >= 0) { head = lines.slice(0, si); ing = head.filter((l) => AMOUNT.test(l) && l.length < 100); head = head.filter((l) => !ing.includes(l)); steps = lines.slice(si + 1); }
  else { head = lines.filter((l, k) => k === 0); const rest = lines.slice(1), short = (l) => l.split(' ').length <= 3 && !/[.!?:]$/.test(l); ing = rest.filter((l) => (AMOUNT.test(l) || short(l)) && l.length < 100); steps = rest.filter((l) => !ing.includes(l) && l.length > 12); }
  title = head.find((l) => !/^(?:serves?|servings?|makes?|yield|portionen|für)\b/i.test(l) && l.length <= 100 && !/^(?:prep|cook|total|time|zeit)\b/i.test(l)) || '';
  if (!title && ing.length) title = 'Imported recipe';
  const meta = lines.slice(0, Math.max(ii, si, 4)).join(' '), sv = /(?:serves?|servings?|makes?|yield|portionen|für)\s*:?\s*(\d{1,3})/i.exec(meta), tm = /(?:total|ready in|prep(?:aration)?|cook(?:ing)?|zeit)\s*(?:time)?\s*:?\s*(?:(\d+)\s*(?:hours?|hrs?|std|h)\.?)?\s*(?:(\d+)\s*(?:minutes?|mins?|m)\.?)?/i.exec(meta);
  return shape({ name: title, servings: sv ? +sv[1] : 0, time: tm ? (+(tm[1] || 0)) * 60 + (+(tm[2] || 0)) : 0, ingredients: ing, steps });
}
