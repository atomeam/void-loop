import { createRequire } from 'module'; import fs from 'fs'; import zlib from 'zlib';
const require = createRequire(import.meta.url); const { PPM } = require('./core.js');
const files = process.argv.slice(2);
let text = files.map(f => fs.readFileSync(f, 'utf8')).join('\n').replace(/[^\x20-\x7e\n]/g, ' ');
text = text.slice(0, 120000);
const out = { chars: text.length, orders: {} };
for (const o of [0, 1, 2, 3, 4, 5, 6]) {
  const m = new PPM(o); let s = 0, t0 = performance.now();
  for (const c of text) s += m.feed(c);
  out.orders[o] = { bpc: +(s / text.length).toFixed(3), contexts: m.contexts, ms: Math.round(performance.now() - t0) };
}
out.gzip9_bpc = +(zlib.gzipSync(text, { level: 9 }).length * 8 / text.length).toFixed(3);
// keystrokes saved by accepting ghost completions: train on first 80%, simulate typing the rest
out.sweep = {};
for (const fl of [0.35, 0.5, 0.65, 0.8]) {
const split = Math.floor(text.length * 0.8), m = new PPM(4);
for (const c of text.slice(0, split)) m.learn(c);
const test = text.slice(split, split + 15000); let i = 0, keys = 0, accepted = 0, offered = 0, wrongOffers = 0;
while (i < test.length) {
  const g = m.predict(16, fl);
  if (g) { offered++; if (test.startsWith(g, i)) { for (const c of g) m.learn(c); i += g.length; keys++; accepted++; continue; } else wrongOffers++; }
  m.learn(test[i]); i++; keys++;
}
out.sweep[fl] = { testChars: test.length, keystrokes: keys, saved_pct: +(100 * (1 - keys / test.length)).toFixed(1), accept_rate: +(accepted / offered).toFixed(3), offers: offered };
}
console.log(JSON.stringify(out, null, 1));
