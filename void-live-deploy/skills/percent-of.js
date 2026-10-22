/**
 * percent-of — pure percent math. "what is 15% of 80", "20 is what percent of 50", "percent of 12 out of 40".
 * Does not overlap calc for free-form equations. Contract: { name, examples, nearMisses, match, run, suite }
 */
export function percentOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const l = t.toLowerCase();
  let m = l.match(/^(?:what\s+is\s+)?(\d+(?:\.\d+)?)\s*%\s+of\s+(\d+(?:\.\d+)?)$/)
    || l.match(/^(?:find\s+)?(\d+(?:\.\d+)?)\s+percent\s+of\s+(\d+(?:\.\d+)?)$/);
  if (m) return { kind: 'of', p: +m[1], n: +m[2] };
  m = l.match(/^(\d+(?:\.\d+)?)\s+is\s+what\s+(?:percent|%)\s+of\s+(\d+(?:\.\d+)?)$/)
    || l.match(/^(?:what\s+)?(?:percent|%)\s+(?:is\s+)?(\d+(?:\.\d+)?)\s+(?:of|out\s+of)\s+(\d+(?:\.\d+)?)$/);
  if (m) return { kind: 'as', part: +m[1], whole: +m[2] };
  return null;
}

function fmt(n) {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n * 1000) / 1000;
  return String(r);
}

async function run(text, api) {
  const q = percentOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  let title, big, sub;
  if (q.kind === 'of') {
    const v = q.n * (q.p / 100);
    title = q.p + '% of ' + q.n;
    big = fmt(v);
    sub = q.p + ' percent of ' + q.n + ' is ' + fmt(v);
  } else {
    const v = q.whole === 0 ? NaN : (q.part / q.whole) * 100;
    title = q.part + ' of ' + q.whole;
    big = Number.isFinite(v) ? fmt(v) + '%' : 'undefined';
    sub = Number.isFinite(v) ? q.part + ' is ' + fmt(v) + '% of ' + q.whole : 'cannot divide by zero';
  }
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(title) + '</h2>'
      + '<div style="font-size:44px;font-weight:300;margin:10px 0">' + esc(big) + '</div>'
      + '<p style="color:#8a8a8a">' + esc(sub) + '</p>';
  });
  api.say(big);
  return 'percent-of';
}

export default {
  name: 'percent-of',
  examples: ['what is 15% of 80', '20 is what percent of 50', '12 percent of 40'],
  nearMisses: ['percent change from 10 to 12', 'interest rate', 'tip calculator'],
  match(lower, text) { return !!percentOf(text); },
  run,
  suite() {
    const a = percentOf('what is 15% of 80'), b = percentOf('20 is what percent of 50'), c = percentOf('tip calculator');
    return { ok: !!(a && a.kind === 'of' && a.p === 15 && a.n === 80 && b && b.kind === 'as' && b.part === 20 && b.whole === 50 && c === null) };
  },
};
