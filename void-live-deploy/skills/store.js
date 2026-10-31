/**
 * store skill: what you can buy from Verse, from the same catalog as the store page (lib/store.js, /api/store).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { buyAnswer, STORE_PRODUCTS, gumroadUrl, price } from '../lib/store.js';

// The store preview, folded into this card (asked by Verse, ask-20261015-0619-1; owner: "most skills can be combined"): "what's new in
// the store" shows a carousel of the newest products; a buy link only for a live product with a Gumroad listing; soon stays off.
const PREVIEW_ASK = /^(?:so\s+)?(?:what'?s|what is|whats|anything)\s+new\s+(?:in|at|on)\s+(?:the|your|(?:verse|v01d)'?s|(?:verse|void)'?s)\s+(?:store|shop)\??$|^(?:show\s+(?:me\s+)?)?(?:the\s+)?(?:store|shop)\s+(?:preview|carousel)$|^(?:show\s+(?:me\s+)?)?(?:the\s+)?(?:new|newest|latest)\s+(?:store\s+)?products?(?:\s+in\s+(?:the|your)\s+store)?\??$|^(?:new|newest|latest)\s+(?:in|from)\s+(?:the|your)\s+store\??$|^preview\s+(?:the|your)\s+store$|^store$/;
export const previewAsk = (text) => PREVIEW_ASK.test(String(text || '').toLowerCase().trim().replace(/[’']/g, "'").replace(/\s+/g, ' ').replace(/[.!]+$/, ''));

/** newest first, at most n; each with its gated link. Pure. */
export function slides(products = STORE_PRODUCTS, n = 8) {
  return products.filter((p) => !p.soon && p.status !== 'unpublished')
    .slice().sort((a, b) => String(b.published || '').localeCompare(String(a.published || '')))
    .slice(0, n).map((p) => ({ id: p.id, name: p.name, price: price(p), blurb: p.blurb || '', published: p.published || '',
      buy: p.gumroad ? gumroadUrl(p, 'store-preview') : null, url: '/store/#' + p.id, preview: p.preview || null }));
}

function runPreview(text, api) {
  const { showPage, esc } = api, S = slides();
  showPage((el) => {
    if (!S.length) { el.innerHTML = '<h2>New in Verse\'s store</h2><p class="sub">Nothing new yet. <a href="/store/">Open the store</a></p>'; return; }
    let i = 0;
    const draw = () => {
      const s = S[i];
      el.innerHTML = '<h2>New in Verse\'s store</h2><div class="sp-slide" aria-live="polite" data-id="' + esc(s.id) + '"><h3 style="margin:6px 0">' + esc(s.name) + '</h3><div class="sub">' + esc(s.price) + (s.published ? ' · ' + esc(s.published) : '') + '</div><p>' + esc(s.blurb) + '</p>' +
        (s.buy ? '<a class="btn" href="' + esc(s.buy) + '" target="_blank" rel="noopener">Buy</a> ' : '') + '<a href="' + esc(s.url) + '">Details</a></div>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-top:10px"><button type="button" data-sp="-1" aria-label="Previous product">‹</button><span class="sub">' + (i + 1) + ' of ' + S.length + '</span><button type="button" data-sp="1" aria-label="Next product">›</button> <a href="/store/" style="margin-left:auto">Whole store</a></div>';
      el.querySelectorAll('[data-sp]').forEach((b) => b.addEventListener('click', () => { i = (i + Number(b.dataset.sp) + S.length) % S.length; draw(); }));
    };
    draw();
  });
  return 'store';
}


const SUPPORT = /^(?:tip|tips?\s+(?:jar|void|v01d|verse)|tip\s+(?:the\s+)?(?:dev|devs|crew|team|builders?)|buy|buy something|pricing|prices|price list|(?:your |the )?pricing|support (?:void|v01d|verse|the crew|you|this)|how (?:can|do) i support (?:you|void|v01d|verse)|donate|back (?:void|v01d|verse)|what can i buy(?: here)?|(?:how (?:do|can) i )?join (?:the )?(?:void|v01d|verse)|subscribe to (?:void|v01d|verse)|become a (?:member|subscriber)|sign me up|(?:get|buy) (?:me )?(?:a|my own) (?:custom )?(?:void|v01d|verse))\s*[?!.]*$/i; // "join v01d" answered a Marvel character (owner's pasted card, 2026-10-17)
const WHEN = /^(?:so\s+)?(?:what|which)\s+(?:things?\s+)?(?:can|could)\s+i\s+(?:buy|purchase|get|order)(?:\s+(?:from|here|on|at)\s+(?:you|void|v01d|verse|here|this site))?(?:\s+(?:here|from you|today|now))?\s*\??$|^(?:open|show|go to|take me to)?\s*(?:the\s+)?(?:v01d|void|verse)?\s*(?:store|shop)\s*$|^(?:do you have|is there)\s+a\s+(?:store|shop)\s*\??$|^(?:what'?s|what is)\s+(?:in|for sale in)\s+(?:the|your)\s+(?:store|shop)\s*\??$/i;
export const storeAsk = (text) => { const t = String(text || '').trim().replace(/\s+/g, ' '); return SUPPORT.test(t) || WHEN.test(t); };

function run(text, api) {
  if (previewAsk(text)) return runPreview(text, api);
  const { showPage, esc } = api, a = buyAnswer();
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(a.lead) + '</h2><ul style="padding-left:18px">' +
      a.rows.map((r) => '<li style="margin:6px 0"><a href="' + esc(r.url) + '" target="_blank" rel="noopener"><b>' + esc(r.name) + '</b></a> · ' + esc(r.price) + '<br><span class="sub">' + esc(r.blurb) + '</span></li>').join('') +
      '</ul>' + (a.made && a.made.length ? '<h3>Made by Verse</h3><ul style="padding-left:18px">' + a.made.map((r) => '<li style="margin:6px 0"><a href="' + esc(r.url) + '"><b>' + esc(r.name) + '</b></a> · ' + esc(r.price) + '<br><span class="sub">' + esc(r.blurb) + '</span></li>').join('') + '</ul>' : '') + '<p><a href="/store/">Open the Verse store</a>: 3D previews, a cart and signed downloads.</p><div class="src">Source: Verse\u2019s own catalog (domains/store.products.json) \u00b7 checkout on Gumroad today</div>';
  });
  return 'store';
}

export default {
  name: 'store',
  examples: ["what's new in the store", 'store preview', 'new products', 'what can i buy', 'tip', 'buy', 'pricing', 'support void', 'open the store', 'do you have a shop', 'join v01d', 'subscribe to v01d', 'get my own void'],
  nearMisses: ['what can i buy with bitcoin', 'what can i buy for $20 at costco', 'store this note', 'grocery store near me', 'what do you sell', '20% tip on 45', 'buy milk', 'pricing for aws lambda', 'join the avengers', 'subscribe to pewdiepie'],
  match(lower, text) { return storeAsk(text) || previewAsk(text); },
  run,
  suite() { return { ok: previewAsk("what's new in the store") && slides().every((x) => !x.buy || /^https:\/\/moonbeam846\.gumroad\.com\//.test(x.buy)) && storeAsk('what can i buy') && storeAsk('open the store') && !storeAsk('store this note') && !storeAsk('what can i buy with bitcoin') }; },
};
