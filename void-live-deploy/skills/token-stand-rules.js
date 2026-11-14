/** Token Stand: six market days. You set a price. Verse always sells at 1 and earns less. */
export const id = 'token-stand', W = 240, H = 150, CAP = 400;
const demand = (price, roll) => Math.max(0, 8 - price + (roll % 3));
export function create(seed = 1) {
  return { tick: 0, n: (seed >>> 0) || 1, price: 3, pad: 0, day: 0, cash: { you: 0, void: 0 }, over: null, why: 'pricing every token at 1', score: { you: 0, void: 0 }, sfx: 0 };
}
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++; s.sfx = 0;
  if (s.pad > 0) s.pad--;
  else if (!input.auto && input.left) { s.price = Math.max(1, s.price - 1); s.pad = 6; }
  else if (!input.auto && input.right) { s.price = Math.min(5, s.price + 1); s.pad = 6; }
  if (!(input.fire || input.auto)) return s;
  const roll = (s.n + s.day) % 3, yours = input.auto ? 4 : s.price;
  s.cash.you += demand(yours, roll) * yours;
  s.cash.void += demand(1, roll) * 1;
  s.score.you = s.cash.you; s.score.void = s.cash.void; s.day++; s.sfx = 1;
  s.why = 'selling at 1 while you hold a higher price';
  if (s.day >= 6) s.over = s.cash.you === s.cash.void ? 'draw' : s.cash.you > s.cash.void ? 'you' : 'void';
  return s;
}
export function selfPlay(seed, cap = CAP) { const s = create(seed); while (!s.over && s.tick < cap) tick(s, { auto: true }); return { over: s.over, tick: s.tick, score: { ...s.score } }; }
export function draw(g, s) {
  g.fillStyle = '#07060f'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#e0b15a'; g.fillRect(24, 48, 36, 28); g.fillRect(150, 48, 36, 28);
  g.fillStyle = '#f4f1ea'; g.font = '14px sans-serif';
  g.fillText('you ' + s.score.you + '  price ' + (s.price), 20, 110);
  g.fillText('Verse ' + s.score.void + '  price 1', 130, 110);
  g.fillText('day ' + Math.min(6, s.day + 1), 20, 28);
}
export const how = 'Left and right set your price from 1 to 5. Press space or Act to sell the day. More buyers come when the price is lower, and the take is price times buyers. Verse sells every day at 1. After six days the fuller purse wins. A link hands a friend the same market.';
