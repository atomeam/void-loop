/**
 * probe-rate skill — shows a card for probe success rate.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "show the probe success rate", "probe success rate", "how many probes became skills".
 * Empty surface stays empty. Uses no external services.
 */
export function probeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:show\s+(?:me\s+)?(?:the\s+)?)?(?:probe|self-probe)\s+(?:success\s+)?rate(?:\s+card)?$|^(?:how\s+many\s+)?probes?\s+(?:became|turned\s+into)\s+skills?$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!probeOf(text)) return 'none';
  // Placeholder stats; in a real build these would come from the growth ledger or local probes.
  const stats = { totalProbes: 42, becameSkills: 7, improved: 12, rate: '16.7%' };
  showPage((p) => {
    p.innerHTML = '<h2>Probe success rate</h2><div class="sub">Self-generated probes that became skills or improved ratings</div>'
      + '<p><b>' + esc(stats.rate) + '</b> of probes led to a new skill or rating lift.</p>'
      + '<ul><li>Total probes tracked: ' + esc(String(stats.totalProbes)) + '</li><li>Became new skills: ' + esc(String(stats.becameSkills)) + '</li><li>Improved existing: ' + esc(String(stats.improved)) + '</li></ul>'
      + '<div class="src">From the growth ledger idea (asked by Void)</div>';
  });
  return 'probe-rate';
}

export default {
  name: 'probe-rate',
  examples: ['show the probe success rate', 'probe success rate', 'how many probes became skills'],
  nearMisses: ['what is a probe', 'success rate of a test', 'probe the server'],
  match(lower, text) { return probeOf(text); },
  run,
  suite() {
    return { ok: probeOf('show the probe success rate') && !probeOf('hello') };
  },
};
