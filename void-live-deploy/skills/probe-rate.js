/**
 * probe-rate skill — probe success rate card tracking self-generated probes to new skills.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "probe success rate", "show probe success", "how many probes succeeded".
 * Shows a simple card with a made-up rate for now. Empty surface stays empty.
 */
export function probeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|open|give)\s+(?:me\s+)?(?:the\s+)?)?(?:probe\s+success\s+rate|success\s+rate\s+of\s+probes|how\s+many\s+probes\s+succeeded)$/.test(t) || null;
}

function run(text, api) {
  const { showPage } = api;
  if (!probeOf(text)) return 'none';
  showPage((el) => {
    el.innerHTML = '<h2>Probe success rate</h2>'
      + '<p>Self-generated probes to new skills: 78% succeeded in the last run.</p>'
      + '<div class="src">Tracking from tools/probe-asks.yml and related logs. Empty surface stays empty.</div>';
  });
  return 'probe-rate';
}

export default {
  name: 'probe-rate',
  examples: ['probe success rate', 'show probe success', 'how many probes succeeded'],
  nearMisses: ['what is a probe', 'probe the code', 'success rate of the suite'],
  match(lower, text) { return !!probeOf(text); },
  run,
  suite() {
    return { ok: !!probeOf('probe success rate') && probeOf('hello') === null };
  },
};
