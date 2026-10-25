/**
 * toolkit: what ties Verse's tool pages together (owner, 2026-10-24: "a lot of these tools can be linked together and made easily usable everywhere
 * on the site, like being able to customize colors and linking the random names to the wheel ... you make the connections yourself"). Three things:
 *   1. one accent colour for every tool page, picked once on /color/ and kept on this device (accent());
 *   2. which tools belong together and why (RELATED), drawn as a "Use with" row at the foot of each page (mountRelated());
 *   3. hand-offs that carry what is on the page into the next tool (the people's names onto the wheel, a colour into a gradient, a text's speaking
 *      time into a countdown): each page passes its own as { label, href: () => url }, worked out when pressed, so they carry what is there now.
 * Nothing leaves the device. Pure except accent(), setAccent() and mountRelated(). Tests: tools/toolkit.test.mjs.
 */
export const ACCENT_KEY = 'a2m.void.accent.v1';

export const TOOLS = Object.freeze({
  '/color/': 'Colour codes', '/gradient/': 'Gradient', '/wheel/': 'Wheel of names', '/random-user/': 'Made-up people', '/random/': 'Random number',
  '/flip/': 'Coin flip', '/stopwatch/': 'Stopwatch and timer', '/word-count/': 'Word counter', '/base-converter/': 'Base converter',
  '/password-strength/': 'Password strength', '/resize-image/': 'Resize an image', '/convert/': 'Unit converter', '/calculator/': 'Calculator', '/time/': 'Time zones', '/base64/': 'Base64',
  '/password/': 'Password generator', '/weather/': 'Weather', '/translate/': 'Translate', '/recipes/': 'Recipes', '/calendar/': 'Calendar', '/tools/': 'Every tool',
});
// the tools that go with each one, closest first: colours with colours, ways of picking at random with each other, words with timing them
export const RELATED = Object.freeze({
  '/color/': ['/gradient/', '/wheel/', '/base-converter/'],
  '/gradient/': ['/color/', '/wheel/'],
  '/wheel/': ['/random/', '/random-user/', '/flip/', '/gradient/', '/color/'],
  '/random-user/': ['/wheel/', '/random/', '/password-strength/'],
  '/random/': ['/wheel/', '/flip/', '/random-user/', '/base-converter/'],
  '/flip/': ['/wheel/', '/random/'],
  '/stopwatch/': ['/word-count/', '/time/'],
  '/word-count/': ['/stopwatch/'],
  '/base-converter/': ['/convert/', '/color/', '/random/', '/calculator/'],
  '/convert/': ['/base-converter/', '/stopwatch/', '/calculator/'],
  '/password-strength/': ['/password/', '/random-user/'],
  '/password/': ['/password-strength/', '/random/', '/random-user/'],
  '/resize-image/': ['/color/'],
  '/calculator/': ['/base-converter/', '/convert/', '/random/'],
  '/time/': ['/stopwatch/', '/weather/'],
  '/weather/': ['/time/', '/stopwatch/'],
  '/translate/': ['/word-count/', '/time/'],
  '/recipes/': ['/stopwatch/', '/convert/', '/translate/'],
  '/calendar/': ['/time/', '/stopwatch/', '/weather/'],
  '/base64/': ['/word-count/', '/base-converter/'],
  '/tools/': ['/color/', '/wheel/', '/calculator/'],
});
/** the related tools of a page as [{ href, label }], closest first; unknown pages get none. Pure. */
export const relatedOf = (path) => (RELATED[path] || []).filter((p) => TOOLS[p]).map((href) => ({ href, label: TOOLS[href] }));

/** a colour written as #rrggbb (3 or 6 hex digits, with or without #), or null. Pure. */
export function hexOf(text) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(text || '').trim()); if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]; return '#' + h.toLowerCase();
}
/** the text colour that reads on a background, by WCAG contrast: '#ffffff' or '#111111'. Pure. */
export function inkOn(hex) {
  const h = hexOf(hex); if (!h) return '#ffffff';
  const L = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2], white = 1.05 / (lum + 0.05), dark = (lum + 0.05) / (0.0056 + 0.05); // #111 is 0.0056
  return white >= dark ? '#ffffff' : '#111111';
}

const store = () => { try { return globalThis.localStorage || null; } catch (_) { return null; } };
/** the accent picked on this device, or null; put on the page (--accent, and --on-accent for text on it) when there is one. */
export function accent(root = globalThis.document && document.documentElement) {
  let h = null; try { const s = store(); h = s ? hexOf(s.getItem(ACCENT_KEY)) : null; } catch (_) {}
  if (h && root && root.style) { root.style.setProperty('--accent', h); root.style.setProperty('--on-accent', inkOn(h)); }
  return h;
}
/** keep a colour as every tool's accent (null puts back each page's own); true when kept. */
export function setAccent(hex, root = globalThis.document && document.documentElement) {
  const s = store(); const h = hex === null ? null : hexOf(hex); if (hex !== null && !h) return false;
  try { if (!s) return false; if (h) s.setItem(ACCENT_KEY, h); else s.removeItem(ACCENT_KEY); } catch (_) { return false; }
  if (root && root.style) { if (h) accent(root); else { root.style.removeProperty('--accent'); root.style.removeProperty('--on-accent'); } }
  return true;
}

// one palette for every tool that paints with several colours (owner, 2026-10-24: "even the colors on the wheel can use the tools"): set from a
// colour's shades on /color/ or from along a gradient on /gradient/, worn by the wheel's slices; kept on this device
export const PALETTE_KEY = 'a2m.void.palette.v1';
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexFrom = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** n colours along gradient stops [{ color: '#rrggbb', pos: 0..100 }], ends included. Pure. */
export function along(stops, n = 8) {
  const st = (stops || []).map((s) => ({ c: hexOf(s.color), pos: +s.pos })).filter((s) => s.c && Number.isFinite(s.pos)).sort((a, b) => a.pos - b.pos);
  if (!st.length) return []; if (st.length === 1) return Array(n).fill(st[0].c);
  return Array.from({ length: n }, (_, i) => { const p = st[0].pos + (st[st.length - 1].pos - st[0].pos) * (n > 1 ? i / (n - 1) : 0);
    let k = 0; while (k < st.length - 2 && p > st[k + 1].pos) k++;
    const a = st[k], b = st[k + 1], t = b.pos > a.pos ? Math.max(0, Math.min(1, (p - a.pos) / (b.pos - a.pos))) : 0, A = rgbOf(a.c), B = rgbOf(b.c);
    return hexFrom(A.map((v, j) => v + (B[j] - v) * t)); });
}
/** n shades of one colour, from deep to light, the colour itself among them. Pure. */
export function shadesOf(hex, n = 8) {
  const h = hexOf(hex); if (!h) return []; const c = rgbOf(h);
  return Array.from({ length: n }, (_, i) => { const t = n > 1 ? i / (n - 1) : 0.5, k = t * 2 - 1; // -1 deep .. +1 light
    return hexFrom(c.map((v) => (k < 0 ? v * (1 + k * 0.6) : v + (255 - v) * k * 0.6))); });
}
/** the palette kept on this device: 2 to 24 colours, or null. */
export function paletteOf() { try { const s = store(); const l = s ? JSON.parse(s.getItem(PALETTE_KEY) || 'null') : null; const v = Array.isArray(l) ? l.map(hexOf).filter(Boolean) : []; return v.length >= 2 ? v.slice(0, 24) : null; } catch (_) { return null; } }
/** keep a palette for every tool (null puts back each tool's own colours); true when kept. */
export function setPalette(list) {
  const s = store(); if (!s) return false; const v = list === null ? null : (list || []).map(hexOf).filter(Boolean).slice(0, 24);
  if (v && v.length < 2) return false;
  try { if (v) s.setItem(PALETTE_KEY, JSON.stringify(v)); else s.removeItem(PALETTE_KEY); return true; } catch (_) { return false; }
}

// one ask bar on every tool page (owner, 2026-10-25: the tools "usable together"): what is typed goes to the tool that does it, with the ask in its
// link, so "100 c to f" on the coin page opens the converter converted; an ask no tool takes goes to the stage, which answers anything. Pure.
const NUM = String.raw`-?\d[\d.,/]*(?:\s+\d+/\d+)?`;
const ROUTES = [
  // calendar: 'add dentist tomorrow 3pm to my calendar', 'remind me to call mum tomorrow 6pm', 'my calendar', "what's on tomorrow", 'my week'
  [/^(?:add|put) (.+?) (?:to|on|in) (?:my |the )?(?:calendar|verse|void)$|^(?:calendar|schedule|new event)[:,] (.+)$|^remind me (?:to |about |of )?(.+)$/i, (m) => '/calendar/?q=' + encodeURIComponent(m[1] || m[2] || m[3])],
  [/^(?:my |the |open (?:my |the )?)?calendar$|^(?:my )?(?:agenda|schedule|events)$/i, () => '/calendar/'],
  [/^what(?:'s| is| do i have) on (today|tomorrow|this week|next week)\??$|^(?:my )?(?:day|schedule|agenda|events|plans) (?:for )?(today|tomorrow|this week|next week)$|^(?:my|this) (week)$/i, (m) => '/calendar/?show=' + (m[1] || m[2] || m[3]).replace(/\s+/g, '-')],
  // recipes: 'pancake recipe', 'recipe for pancakes', 'how do I make pancakes', 'how to cook rice'; and by what is in the fridge, 'what can I make with eggs, spinach'
  [/^what (?:can|could|should) (?:i|we) (?:make|cook|bake) (?:with|from|using) (.+)$|^recipes? (?:with|using|from) (.+)$/i, (m) => '/recipes/?i=' + encodeURIComponent(m[1] || m[2])],
  [/^(?:(?:an? |the )?(?:easy |simple |quick |best |homemade )?recipes? for (.+)|(.+?) recipes?|how (?:do|would|can) (?:i|you|we) (?:make|cook|bake) (.+)|how to (?:make|cook|bake) (.+))$/i, (m) => '/recipes/?q=' + encodeURIComponent(m[1] || m[2] || m[3] || m[4])],
  // translate: 'translate hello to spanish', 'how do you say thank you in japanese', 'good morning in french' (the code from lib/translate-langs.js's names, a few common ones here)
  [/^(?:please\s+)?translate\s+(.+?)\s+(?:to|into|in)\s+([a-z]+(?:\s+[a-z]+)?)$|^how\s+(?:do|would)\s+(?:you|i|we)\s+say\s+(.+?)\s+in\s+([a-z]+(?:\s+[a-z]+)?)$/i, (m) => '/translate/?q=' + encodeURIComponent(m[1] || m[3]) + '&to=' + encodeURIComponent((m[2] || m[4]).toLowerCase())],
  [/^(?:what(?:'s| is) the )?weather(?: (?:in|for|at) (.+))?$|^forecast(?: (?:in|for) (.+))?$/i, (m) => '/weather/' + (m[1] || m[2] ? '?q=' + encodeURIComponent(m[1] || m[2]) : '')],
  [/^(?:what )?time (?:is it )?in (.+)$|^(.+) time$/i, (m) => '/time/?q=' + encodeURIComponent(m[1] || m[2])],
  [/^(?:is it|is today) (.+)$/i, (m) => '/is-it/' + encodeURIComponent(m[1].toLowerCase().replace(/[?!.]+$/, '').trim().replace(/\s+/g, '-'))],
  [/^(?:flip|toss) (?:a )?coins?$|^coin ?flip$|^heads or tails$/i, () => '/flip/'],
  [/^(?:spin (?:the |a )?)?wheel(?: of names)?$|^pick (?:a |one )?(?:name|winner)$/i, () => '/wheel/'],
  [/^(?:a |one |some )?(?:random|fake|made-?up) (?:users?|people|persons?|names?)$|^(\d+) (?:random|fake|made-?up) (?:users?|people)$/i, (m) => '/random-user/' + (m[1] ? '?n=' + m[1] : '')],
  [/^(?:a )?random number(?: (?:between|from) (\d+) (?:and|to) (\d+))?$|^(?:roll|dice|d\d+)$/i, () => '/random/'],
  [/^(?:a |an? )?(?:strong )?(?:password|passphrase)(?: of (\d+)(?: characters| letters)?)?$|^(?:generate|make|new) (?:a |me a )?(?:strong )?(?:password|passphrase)(?: of (\d+))?$/i, (m) => '/password/' + (m[1] || m[2] ? '?len=' + (m[1] || m[2]) : '')],
  [/^(?:how (?:strong|secure|safe) is|check(?: the)? (?:password|strength of)) (.+)$/i, (m) => '/password-strength/#p=' + encodeURIComponent(m[1])],
  [/^(?:base64 )?decode (.+)$|^(.+) from base64$/i, (m) => '/base64/?mode=decode&t=' + encodeURIComponent(m[1] || m[2])],
  [/^(?:base64 )?encode (.+)$|^(.+) (?:to|in|as) base64$/i, (m) => '/base64/?t=' + encodeURIComponent(m[1] || m[2])],
  [/^(?:0x[0-9a-f]+|0b[01]+|\d+) (?:in|to|as) (binary|hex(?:adecimal)?|octal|decimal|base \d+)$/i, (m, t) => { const v = t.split(/\s/)[0], b = /^bin/i.test(m[1]) ? 2 : /^hex/i.test(m[1]) ? 16 : /^oct/i.test(m[1]) ? 8 : /^dec/i.test(m[1]) ? 10 : +m[1].replace(/\D/g, ''); return '/base-converter/?v=' + encodeURIComponent(v) + '&b=' + b; }],
  [/^#?[0-9a-f]{6}$|^#?[0-9a-f]{3}$|^rgba?\(.+\)$|^hsla?\(.+\)$/i, (m, t) => '/color/?c=' + encodeURIComponent(t.replace(/^#/, ''))],
  [/^(?:a )?gradient(?: from (.+))?$/i, () => '/gradient/'],
  [/^(?:resize|shrink|crop) (?:an? |my |the )?(?:image|photo|picture|signature)(?: to (.+))?$/i, () => '/resize-image/'],
  [/^(?:count (?:the )?words(?: in)?|how many words(?: in)?|word count(?: of)?) (.+)$/i, (m) => '/word-count/?t=' + encodeURIComponent(m[1])],
  [/^(?:start (?:a )?)?(?:stopwatch|timer|countdown)(?: (?:for|of) (.+))?$|^(\d+ ?(?:min(?:ute)?s?|sec(?:ond)?s?|hours?)) timer$/i, (m) => '/stopwatch/' + (m[1] || m[2] ? '?t=' + encodeURIComponent(m[1] || m[2]) : '')],
  [new RegExp('^(?:convert )?' + NUM + '\\s*[a-zµ°/²³]+\\s+(?:to|in|into|as)\\s+[a-zµ°/²³]+$', 'i'), (m, t) => '/convert/?q=' + encodeURIComponent(t)],
  [/^(?:what is |what's |calculate |calc )?[-\d.(][\d\s.,+\-*×÷/^%()!πe]*(?:\s*(?:of|percent of)\s*[\d.]+)?$/i, (m, t) => '/calculator/?q=' + encodeURIComponent(t.replace(/^(?:what is |what's |calculate |calc )/i, ''))],
];
/** where an ask goes: the tool's link with the ask in it, or the stage for anything else. Pure. */
export function routeAsk(text) {
  const t = String(text || '').replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim();
  if (!t) return '';
  for (const [re, to] of ROUTES) { const m = re.exec(t); if (m) return to(m, t); }
  return '/?q=' + encodeURIComponent(t);
}

/** the "Use with" row: this page's hand-offs (carrying what is on it), then its related tools, then the accent it wears. */
export function mountRelated(el, path, handoffs = []) {
  if (!el) return;
  const d = el.ownerDocument, a = (href, text, cls) => { const x = d.createElement('a'); x.href = href; x.textContent = text; if (cls) x.className = cls; return x; };
  const row = d.createElement('div'); row.className = 'tk-row';
  for (const h of handoffs) {
    if (h.run) { const b = d.createElement('button'); b.type = 'button'; b.className = 'tk-hand'; b.textContent = h.label; b.addEventListener('click', () => { const said = h.run(); if (said) { b.textContent = said; setTimeout(() => { b.textContent = h.label; }, 1600); } }); row.append(b); continue; }
    const x = a('#', h.label, 'tk-hand'); x.addEventListener('click', (e) => { const u = h.href(); if (!u) { e.preventDefault(); return; } x.href = u; }); x.addEventListener('pointerdown', () => { const u = h.href(); if (u) x.href = u; }); row.append(x);
  }
  for (const r of relatedOf(path)) row.append(a(r.href, r.label));
  if (path !== '/tools/') row.append(a('/tools/', 'All tools')); // the kit's own page (owner, 2026-10-25: "link them all so they are all usable together")
  const h = accent(); const sw = a('/color/' + (h ? '?c=' + h.slice(1) : ''), h ? 'Accent ' + h : 'Pick an accent colour', 'tk-accent');
  sw.title = 'The colour every Verse tool wears on this device: pick it on the colour page'; row.append(sw);
  const label = d.createElement('span'); label.className = 'tk-label'; label.textContent = 'Use with';
  // the ask bar: any ask, to the tool that does it
  const form = d.createElement('form'); form.className = 'tk-ask'; const inp = d.createElement('input'); inp.type = 'search'; inp.placeholder = 'Ask any tool: 100 c to f, flip a coin, weather in boston'; inp.setAttribute('aria-label', 'Ask any tool'); inp.autocomplete = 'off';
  form.append(inp); form.addEventListener('submit', (e) => { e.preventDefault(); const to = routeAsk(inp.value); if (to) d.defaultView.location.href = to; });
  const style = d.createElement('style');
  style.textContent = '.tk-row{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;margin:14px 0 4px;font-size:13px}.tk-label{color:var(--soft,var(--muted,#888))}'
    + '.tk-row a,.tk-row button{font:inherit;background:transparent;cursor:pointer;display:inline-flex;align-items:center;min-height:40px;padding:4px 12px;border:1px solid var(--line,#8884);border-radius:999px;color:inherit;text-decoration:none}'
    + '.tk-ask{margin:14px 0 0}.tk-ask input{font:inherit;width:100%;box-sizing:border-box;min-height:40px;padding:6px 12px;border:1px solid var(--line,#8884);border-radius:999px;background:transparent;color:inherit}.tk-ask input:focus{outline:2px solid var(--accent,#6d4aff);outline-offset:1px}'
    + '.tk-row .tk-hand{border-color:var(--accent,#6d4aff)}.tk-row a.tk-accent::before{content:"";width:12px;height:12px;border-radius:50%;margin-right:6px;background:var(--accent,#6d4aff)}';
  row.prepend(label); el.replaceChildren(style, form, row);
}
