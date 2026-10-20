/**
 * last-ask skill — "what did I just ask", "echo the last ask", "repeat my previous ask".
 * Reads the local loop log (a2m.void.loop.v1) and shows the prior ask. Nothing is sent.
 * Empty if none.
 */
export function isLastAsk(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:what did i just ask|echo(?: the)? last ask|repeat my (?:last|previous) ask|what was my last ask)$/.test(t);
}

function lastAsk() {
  try {
    const log = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]');
    const prior = log.filter((x) => x && x.ask).slice(-2, -1)[0];
    return prior ? prior.ask : null;
  } catch (_) { return null; }
}

function run(text, api) {
  if (!isLastAsk(text)) return 'none';
  const { showPage, esc } = api;
  const ask = lastAsk();
  showPage((p) => {
    p.innerHTML = ask
      ? '<h2>Your last ask</h2><p style="font-size:20px">' + esc(ask) + '</p><div class="sub">From this browser only. Nothing sent.</div>'
      : '<h2>Your last ask</h2><p>No earlier ask in this session yet.</p>';
  });
  return 'last-ask';
}

export default {
  name: 'last-ask',
  examples: ['what did I just ask', 'echo the last ask', 'repeat my previous ask'],
  nearMisses: ['what did you just say', 'last film', 'previous page'],
  match(lower, text) { return isLastAsk(text); },
  run,
};
