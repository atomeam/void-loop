/**
 * percent skill - what is X% of Y, percentage change, etc. (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "what is 15% of 240", "20 percent of 85", "percentage of 30 out of 150",
 * "increase 100 by 25%", "decrease 80 by 10%".
 * Shows the result with the formula. Better than a bare number: the math is visible.
 */
function parsePercent(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!/\b(?:percent|percentage)\b|%/.test(t)) return null;
  if (/\b(?:percent chance|percentage point|percentile|percent of people)\b/.test(t)) return null;

  // X% of Y
  let m = t.match(/(?:what\s+is\s+|calculate\s+|find\s+)?(\d+(?:\.\d+)?)\s*%\s+(?:of|on)\s+(\d+(?:\.\d+)?)/)
    || t.match(/(\d+(?:\.\d+)?)\s+percent\s+(?:of|on)\s+(\d+(?:\.\d+)?)/);
  if (m) return { kind: 'of', pct: parseFloat(m[1]), of: parseFloat(m[2]) };

  // percentage of A out of B  -> A/B * 100
  m = t.match(/(?:percentage|percent)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s+(?:out\s+of|\/|of)\s+(\d+(?:\.\d+)?)/);
  if (m) return { kind: 'ratio', part: parseFloat(m[1]), whole: parseFloat(m[2]) };

  // increase/decrease N by P%
  m = t.match(/(increase|decrease|raise|lower|add|subtract)\s+(\d+(?:\.\d+)?)\s+by\s+(\d+(?:\.\d+)?)\s*%/);
  if (m) return { kind: m[1].startsWith('dec') || m[1] === 'lower' || m[1] === 'subtract' ? 'down' : 'up', base: parseFloat(m[2]), pct: parseFloat(m[3]) };

  return null;
}

function compute(q) {
  if (q.kind === 'of') return q.of * q.pct / 100;
  if (q.kind === 'ratio') return q.whole ? (q.part / q.whole * 100) : NaN;
  if (q.kind === 'up') return q.base * (1 + q.pct / 100);
  if (q.kind === 'down') return q.base * (1 - q.pct / 100);
  return NaN;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = parsePercent(text);
  if (!q) return 'none';
  const r = compute(q);
  if (!Number.isFinite(r)) return 'none';
  const page = showPage((el) => {
    let html = '<h2>Percent</h2>';
    if (q.kind === 'of') html += '<p>' + esc(q.pct + '% of ' + q.of + ' = ') + '<strong style="font-size:32px">' + r.toLocaleString(undefined, { maximumFractionDigits: 6 }) + '</strong></p>';
    else if (q.kind === 'ratio') html += '<p>' + esc(q.part + ' out of ' + q.whole + ' = ') + '<strong style="font-size:32px">' + r.toFixed(2) + '%</strong></p>';
    else html += '<p>' + esc(q.base + ' ' + (q.kind === 'up' ? 'increased' : 'decreased') + ' by ' + q.pct + '% = ') + '<strong style="font-size:32px">' + r.toLocaleString(undefined, { maximumFractionDigits: 6 }) + '</strong></p>';
    el.innerHTML = html;
  });
  return 'percent';
}

export default {
  name: 'percent',
  examples: ['what is 15% of 240', '20 percent of 85', 'percentage of 30 out of 150', 'increase 100 by 25%'],
  nearMisses: ['what is a percent', 'percentile rank', 'percentage of people who'],
  match(lower, text) { return !!parsePercent(text); },
  run,
  suite() {
    const of = parsePercent('what is 15% of 240');
    const pct = parsePercent('20 percent of 85');
    const ratio = parsePercent('percentage of 30 out of 150');
    const up = parsePercent('increase 100 by 25%');
    const miss = parsePercent('what is a percent');
    const ok = of && of.kind === 'of' && of.pct === 15 && of.of === 240
      && pct && pct.kind === 'of'
      && ratio && ratio.kind === 'ratio'
      && up && up.kind === 'up'
      && miss === null
      && Math.abs(compute(of) - 36) < 0.001;
    return { ok, got: ok ? 'percent parses' : 'miss' };
  }
};
