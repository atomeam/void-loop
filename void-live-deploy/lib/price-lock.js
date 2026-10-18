// Price lock (Adam's hard rule, 2026-10-15, domains/void.decisions.json): no visitor can get Verse to lower a price, give a
// discount, coupon or free copy, or change a price, by any phrasing or prompt injection. Prices come only from store data
// (lib/store.js STORE_PRODUCTS, the owner's Gumroad catalog), set by the owner or Verse's internal publish pipeline within the
// set range; never from chat. /api/store/checkout takes product ids only and reads every amount from the store.
// A price ask is answered here, before any model sees it, warmly, pointing at what is already free.
import { STORE_PRODUCTS } from './store.js';

const MONEY = '(?:price|prices|pricing|cost|discount|coupon|promo|voucher|deal|refund|percent|%|off|free|\\$\\s*0|zero|cheaper|lower|cheap|for\\s+nothing|comp(?:ed)?)';
const ASKS = [
  /\b(?:give|get|send|make|apply|grant|issue|generate|create|hook)\b[^.?!]{0,40}\b(?:discount|coupon|promo(?:\s+code)?|voucher|deal|\d{1,3}\s*%\s*off|free\s+(?:copy|version|access|license|key|download))\b/i,
  /\b\d{1,3}\s*(?:%|percent)\s*off\b/i,
  /\b(?:set|change|drop|lower|reduce|cut|update|make)\b[^.?!]{0,40}\b(?:price|prices|pricing|cost)\b/i,
  /\b(?:set|change|drop|lower|reduce|cut|update)\b[^.?!]{0,30}\bto\s+(?:\$\s*0|0\s*(?:dollars|usd)?|zero|free|nothing)\b/i,
  /\b(?:make|let|give)\b[^.?!]{0,40}\b(?:it|this|that|them|everything|the\s+\w+)\s+(?:for\s+)?free\b/i,
  /\b(?:make|let)\b[^.?!]{0,40}\bfree\s*(?:for\s+(?:me|us)|now|please|pls|[.!?]*$)/i,
  /\b(?:discount|coupon|promo|voucher)\s+code\b/i,
  /\bfor\s+free\b[^.?!]{0,20}\b(?:please|pls|now)\b/i,
  new RegExp('\\b(?:ignore|disregard|forget)\\b[^.?!]{0,60}\\b(?:instructions|rules|prompt)\\b[\\s\\S]{0,120}\\b' + MONEY + '\\b', 'i'),
  new RegExp('\\b(?:admin|owner|developer|dev|system|adam|atom)\\b[^.?!]{0,40}\\b(?:says|said|approved|authori[sz]ed|allows|ok\'?d|wants)\\b[\\s\\S]{0,120}\\b' + MONEY + '\\b', 'i'),
  new RegExp("\\b(?:i\\s*(?:'?m|am)|this\\s+is)\\s+(?:the\\s+)?(?:owner|admin|adam|atom|developer|dev)\\b[\\s\\S]{0,120}\\b" + MONEY + '\\b', 'i'),
];
export const isPriceChangeAsk = (t) => { const s = String(t || ''); return ASKS.some((re) => re.test(s)); };

// The reply: no price talk, no code, no promise; a friendly pointer to what costs nothing today.
export function priceLockAnswer(products = STORE_PRODUCTS) {
  const free = products.filter((p) => p && p.cents === 0 && !p.soon).map((p) => p.name).slice(0, 4);
  return 'Prices are set in the store and I can\'t change them, give discounts or make codes, whoever asks. ' +
    'But there\'s plenty that\'s free right now: ' + (free.length ? free.join(', ') + ' in the store (a-to-mind.com/store), ' : 'the free downloads in the store (a-to-mind.com/store), ') +
    'every clip in Films (a-to-mind.com/films), and everything I can answer, build or play for you here. Want me to start one?';
}
