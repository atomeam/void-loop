/**
 * number-fact skill — interesting facts about a number from numbersapi (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "fact about 42", "what's special about 7", "number fact 100".
 */
export function isNumberFact(text) {
  return /^(?:(?:fact|interesting\s+fact)\s+(?:about|for|on)\s+(\d+)|(?:what(?:'s|\s+is)\s+(?:special|interesting)\s+about|number\s+fact(?:\s+about)?)\s+(\d+)|(\d+)\s+(?:fact|number\s+fact))$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function extractNumber(text) {
  const m = String(text || '').match(/\b(\d+)\b/);
  return m ? m[1] : null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const n = extractNumber(text);
  if (!n) {
    showPage((p) => { p.innerHTML = '<h2>Number fact</h2><p>Say a number, like “fact about 42”.</p>'; });
    return 'number-fact';
  }
  const el = showPage((p) => { p.innerHTML = '<h2>Number fact</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('http://numbersapi.com/' + encodeURIComponent(n) + '/trivia?json', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'number-fact';
    if (!j || !j.text) throw 0;
    el.innerHTML = '<h2>Number fact</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.text) + '</p><div class="sub">try another number</div>'
      + '<div class="src">Source: <a href="http://numbersapi.com/" target="_blank" rel="noopener">numbersapi</a></div>';
    return 'number-fact';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Number fact</h2><p>The number service didn\'t answer. ' + n + ' is a number.</p>';
    return 'number-fact';
  }
}

export default {
  name: 'number-fact',
  examples: ['fact about 42', 'what\'s special about 7', 'number fact 100'],
  nearMisses: ['facts about space', 'what is 42', 'random number'],
  match(lower, text) { return isNumberFact(text); },
  run,
  suite() {
    const ok = isNumberFact('fact about 42') && isNumberFact('number fact 100') && !isNumberFact('facts about space');
    return { ok, got: 'match works' };
  }
};
