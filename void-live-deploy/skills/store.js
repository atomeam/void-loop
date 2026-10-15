/**
 * store skill: "what can I buy" -> V01D's store, from the same catalog the /store page and /api/store use (lib/store.js).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { buyAnswer } from '../lib/store.js';

const SUPPORT = /^(?:tip|tips?\s+(?:jar|void|v01d)|tip\s+(?:the\s+)?(?:dev|devs|crew|team|builders?)|buy|buy something|pricing|prices|price list|(?:your |the )?pricing|support (?:void|v01d|the crew|you|this)|how (?:can|do) i support (?:you|void|v01d)|donate|back (?:void|v01d)|what can i buy(?: here)?)\s*[?!.]*$/i;
const WHEN = /^(?:so\s+)?(?:what|which)\s+(?:things?\s+)?(?:can|could)\s+i\s+(?:buy|purchase|get|order)(?:\s+(?:from|here|on|at)\s+(?:you|void|v01d|here|this site))?(?:\s+(?:here|from you|today|now))?\s*\??$|^(?:open|show|go to|take me to)?\s*(?:the\s+)?(?:v01d|void)?\s*(?:store|shop)\s*$|^(?:do you have|is there)\s+a\s+(?:store|shop)\s*\??$|^(?:what'?s|what is)\s+(?:in|for sale in)\s+(?:the|your)\s+(?:store|shop)\s*\??$/i;
export const storeAsk = (text) => { const t = String(text || '').trim().replace(/\s+/g, ' '); return SUPPORT.test(t) || WHEN.test(t); };

function run(text, api) {
  const { showPage, esc } = api, a = buyAnswer();
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(a.lead) + '</h2><ul style="padding-left:18px">' +
      a.rows.map((r) => '<li style="margin:6px 0"><a href="' + esc(r.url) + '" target="_blank" rel="noopener"><b>' + esc(r.name) + '</b></a> · ' + esc(r.price) + '<br><span class="sub">' + esc(r.blurb) + '</span></li>').join('') +
      '</ul><p><a href="/store/">Open the V01D store</a>: 3D previews, a cart and signed downloads.</p><div class="src">Source: V01D\u2019s own catalog (lib/store.js) \u00b7 checkout on Gumroad today</div>';
  });
  return 'store';
}

export default {
  name: 'store',
  examples: ['what can i buy', 'tip', 'buy', 'pricing', 'support void', 'open the store', 'do you have a shop'],
  nearMisses: ['what can i buy with bitcoin', 'what can i buy for $20 at costco', 'store this note', 'grocery store near me', 'what do you sell', '20% tip on 45', 'buy milk', 'pricing for aws lambda'],
  match(lower, text) { return storeAsk(text); },
  run,
  suite() { return { ok: storeAsk('what can i buy') && storeAsk('open the store') && !storeAsk('store this note') && !storeAsk('what can i buy with bitcoin') }; },
};
