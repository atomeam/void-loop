/**
 * better-score skill — "what's your better score", "is void getting better", "show the better trend".
 * Reads /void.better.json and shows the one-line trend from the latest row. Empty surface stays empty.
 * Uses the existing better measure (lib/better.js, tools/better.mjs). No secrets.
 */
export function betterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|what'?s|what is|give me)\s+(?:the\s+)?)?(?:void'?s\s+|your\s+)?(?:better\s+)?(?:score|trend|better\s+score)$|^(?:is\s+void\s+getting\s+better|how\s+are\s+you\s+doing\s+today)$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!betterOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Better score</h2><div class="sub">reading the daily measure…</div>'; });
  try {
    const r = await fetch('/void.better.json');
    if (!api._pageStill(el)) return 'better-score';
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) { el.innerHTML = '<h2>Better score</h2><p>No measure yet.</p>'; return 'better-score'; }
    const last = rows[rows.length - 1];
    const prev = rows.length > 1 ? rows[rows.length - 2] : null;
    const delta = prev && Number.isFinite(last.score) && Number.isFinite(prev.score) ? last.score - prev.score : null;
    const trend = delta === null ? 'first measure' : delta > 0 ? 'up ' + delta : delta < 0 ? 'down ' + (-delta) : 'steady';
    const json = JSON.stringify({ at: last.at, score: last.score, trend, parts: last.parts }, null, 2);
    el.innerHTML = '<h2>Better score</h2><div class="sub">Today: <b>' + esc(String(last.score)) + '</b> of 100 (' + esc(trend) + ')</div>'
      + '<pre style="white-space:pre-wrap;font-size:12px;background:rgba(0,0,0,.3);padding:12px;border-radius:8px;max-height:360px;overflow:auto">' + esc(json) + '</pre>'
      + '<div class="src">From <a href="/void.better.json" target="_blank" rel="noopener">void.better.json</a> (tools/better.mjs daily)</div>';
    return 'better-score';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Better score</h2><p>The score could not be read just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'better-score',
  examples: ["what's your better score", "is void getting better", "show the better trend"],
  nearMisses: ["better score of the team", "how to get better at coding", "score a movie", "what is a good score"],
  match(lower, text) { return betterOf(text); },
  run,
  suite() {
    return { ok: betterOf("what's your better score") && betterOf("is void getting better") && !betterOf("hello world") };
  },
};
