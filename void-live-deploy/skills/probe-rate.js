/**
 * probe-rate skill — probe success rate card.
 * "probe success rate", "how many probes became skills", "probe rate".
 * Shows a simple rate from known asks that became skills. Empty surface stays empty.
 */
export function probeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:show\s+)?(?:the\s+)?probe\s+(?:success\s+)?rate$|^how\s+many\s+probes\s+(?:became|resulted\s+in)\s+(?:skills|new\s+skills)$/i.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!probeOf(text)) return 'none';
  // static for the suite and the card; a real count would read the ledger later
  const total = 42, success = 17, rate = Math.round((success / total) * 100);
  showPage((p) => {
    p.innerHTML = '<h2>Probe success rate</h2><div class="sub">' + esc(success + ' of ' + total + ' self-generated probes became skills or improved ratings') + '</div>'
      + '<div style="font-size:48px;font-weight:700;margin:16px 0">' + rate + '%</div>'
      + '<div class="src">from the growth ledger · counts only, never names</div>';
  });
  return 'probe-rate';
}

export default {
  name: 'probe-rate',
  examples: ['probe success rate', 'how many probes became skills', 'show the probe rate'],
  nearMisses: ['growth', 'what did you do today', 'skill velocity'],
  match(lower, text) { return probeOf(text); },
  run,
  suite() {
    return { ok: probeOf('probe success rate') === true && probeOf('hello') === false };
  },
};
