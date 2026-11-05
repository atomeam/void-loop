// Proven by suite check in tools/vat.test.mjs (numbers family, 2026-11-05)
import { vatAskOf, vatStateOf } from '../lib/vat-ask.js';
import { compute, money, rateText } from '../lib/vat.js';

function run(text, api) {
  const { showPage, esc } = api;
  const s = vatStateOf(text);
  const r = s ? compute(s) : null;
  const href = vatAskOf(text) || '/vat/';
  showPage((el) => {
    el.dataset.cardKind = 'VAT calculator';
    const rows = r ? '<p><b>' + esc(money(r.vat, 'en')) + '</b> VAT on ' + esc(money(r.amount, 'en')) + ' at ' + esc(rateText(r.rate)) + '%, ' + (r.mode === 'add' ? 'added' : 'taken out') + '.</p>'
      + '<p>Net (without VAT): ' + esc(money(r.net, 'en')) + '<br>Gross (with VAT): ' + esc(money(r.gross, 'en')) + '</p>'
      + '<p class="src">' + esc(r.mode === 'add' ? 'VAT = amount × rate / 100; total = amount + VAT.' : 'Net = amount / (1 + rate / 100); VAT = amount − net.') + ' Rounded to the kopeck.</p>'
      : '';
    el.innerHTML = '<h2>VAT calculator (НДС)</h2>'
      + rows
      + '<p>Extract VAT from a total or add it on top, at 22, 20, 18, 10, 5, 0% or any rate, with the working shown. The page is in Russian and English.</p>'
      + '<p><a class="vat-open" href="' + esc(href) + '" style="display:inline-block;padding:8px 18px;border-radius:999px;background:#6d4aff;color:#fff;text-decoration:none;font-weight:600">Open the VAT calculator</a></p>'
      + '<div class="src">Worked out on this device: no amount is sent anywhere.</div>';
  });
  return 'vat';
}

export default {
  name: 'vat',
  examples: ['выделить ндс из 1000', 'начислить ндс 5000 20%', 'ндс 22% от 1000', 'remove vat from 100', 'add vat to 500', 'vat calculator', 'total with 20% vat on 150'],
  nearMisses: ['22% of 1000', 'percentage calculator', 'income tax calculator', 'sales tax', 'discount calculator', 'tip calculator', 'what is 20 percent of 50'],
  match(lower, text) { return !!vatAskOf(text || lower) || (lower.includes('vat') && /\d+%?\s+vat/.test(lower) || /vat\s+on\s+\d+/.test(lower)); },
  run,
};
