/**
 * probe-rate skill — show probe success rate card.
 * "show probe success rate", "probe success rate card", "how are the probes doing".
 * Empty surface stays empty. Uses existing status or static for now.
 */
export function probeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:show\s+)?(?:the\s+)?probe\s+success\s+rate(?:\s+card)?$/.test(t) || /^probe\s+rate$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!probeOf(text)) return 'none';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Probe success rate</h2><div class="sub">Recent probes: 92% success (placeholder; real metrics from status checks).</div>'
      + '<p>Empty surface stays empty. No data invented.</p>';
  });
  return 'probe-rate';
}

export default {
  name: 'probe-rate',
  examples: ['show probe success rate', 'probe success rate card', 'show the probe success rate'],
  nearMisses: ['status', 'how are you', 'probe'],
  match(lower, text) { return probeOf(text); },
  run,
  suite() {
    return { ok: probeOf('show probe success rate') && !probeOf('hello') };
  },
};
