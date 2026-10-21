/**
 * daily-quote skill — draws a short quote or recent change from the growth ledger as a card.
 * Asks: "daily quote", "quote from the ledger", "a growth quote".
 * Reads /void.growth.json, picks a recent 'grow' or 'build' entry's what, trims it.
 * Empty stage stays empty until asked. Nothing sent.
 */
export function dailyQuoteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:show|give me|open)\s+(?:a\s+)?(?:daily\s+)?quote(?:\s+from\s+(?:the\s+)?(?:growth\s+)?ledger)?$|daily\s+quote|growth\s+quote|quote\s+of\s+the\s+day/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Daily growth quote</h2><div class="sub">…</div>'; });
  try {
    const list = await fetch('/void.growth.json').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'daily-quote';
    const recent = (Array.isArray(list) ? list : []).filter((e) => e && (e.kind === 'grow' || e.kind === 'build') && e.what)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const q = recent[0] ? String(recent[0].what).split(/[.:]/)[0].trim().slice(0, 140) : 'Verse keeps growing, one skill at a time.';
    el.innerHTML = '<h2>Daily growth quote</h2><blockquote style="font-size:1.2em;line-height:1.4;margin:12px 0;padding:8px 16px;border-left:3px solid #5b8def">' + esc(q) + '</blockquote>'
      + '<div class="sub">from the growth ledger' + (recent[0] ? ' · ' + esc(String(recent[0].at || '').slice(0, 10)) : '') + '</div>';
  } catch (_) {
    el.innerHTML = '<h2>Daily growth quote</h2><p>' + esc('The ledger could not be read just now.') + '</p>';
  }
  return 'daily-quote';
}

export function suite() {
  return dailyQuoteOf('daily quote') && dailyQuoteOf('quote from the ledger') && !dailyQuoteOf('growth');
}

export default {
  name: 'daily-quote',
  examples: ['daily quote', 'quote from the ledger', 'growth quote', 'quote of the day'],
  nearMisses: ['growth', 'how have you grown', 'what did you do today'],
  match(lower, text) { return dailyQuoteOf(text); },
  run,
  suite,
};
