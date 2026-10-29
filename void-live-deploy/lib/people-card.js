// /random-user/'s stage card: the made-up people on the page, as an ask the stage's fakeuser skill reads back (count, countries, gender, seed).
// '' when the page's settings do not say it, so the example ask stays.
import { askFake } from './fakeuser.js';

// one word for each country that askFake reads back as that country only
const WORD = { us: 'usa', gb: 'uk', fr: 'france', de: 'germany', es: 'spain', br: 'brazil', in: 'india', jp: 'japan', au: 'australia', ca: 'canada', ch: 'switzerland',
  dk: 'denmark', fi: 'finland', ie: 'ireland', ir: 'iran', mx: 'mexico', nl: 'netherlands', no: 'norway', nz: 'new zealand', rs: 'serbia', tr: 'turkey', ua: 'ukraine' };

export function cardAsk(n, nats = ['us'], gender = '', seed = '') {
  const s = String(n ?? '').trim(); if (!/^\d{1,4}$/.test(s) || +s < 1 || +s > 5000) return '';
  const k = +s, list = [...new Set(nats)].filter((c) => WORD[c]), on = list.length ? list : ['us'], g = gender === 'female' || gender === 'male' ? gender : '';
  const noun = g === 'female' ? (k === 1 ? 'woman' : 'women') : g === 'male' ? (k === 1 ? 'man' : 'men') : (k === 1 ? 'person' : 'people');
  const words = on.map((c) => WORD[c]), from = on.length === 1 && on[0] === 'us' ? '' : ' from ' + (words.length > 1 ? words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] : words[0]);
  const sd = /^[A-Za-z0-9_-]{1,40}$/.test(String(seed || '')) ? ', seed ' + seed : '';
  const ask = k + ' fake ' + noun + from + sd, q = askFake(ask);
  // the ask must come back as exactly these people, or the card would show others
  return q && q.n === k && q.gender === g && q.nats.join() === on.join() && (q.seed || '') === (sd ? seed : '') ? ask : '';
}
