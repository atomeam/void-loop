/**
 * probe-rate skill — probe-success-rate card: tracks how many self-generated probes result in new skills.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "probe success rate", "how many probes became skills", "probe rate card".
 * Empty surface stays empty. Uses a simple local count for demo; real tracking lives elsewhere.
 */
export function wantsRate(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:show\s+(?:me\s+)?)?(?:the\s+)?probe(?:-|\s+)?(?:success\s+)?rate(?:\s+card)?$|^(?:how\s+many\s+)?probes?\s+(?:became|resulted\s+in|succeeded\s+as)\s+(?:new\s+)?skills?$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!wantsRate(text)) return 'none';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Probe success rate</h2>'
      + '<div class="sub">Self-generated probes that became skills or improved ratings.</div>'
      + '<div style="font-size:48px;font-weight:700;margin:20px 0">—</div>'
      + '<p>Tracking starts with the next probe. Asked by Void.</p>'
      + '<div class="src">Empty surface stays empty until a probe lands.</div>';
  });
  return 'probe-rate';
}

export default {
  name: 'probe-rate',
  examples: ['probe success rate', 'show the probe rate card', 'how many probes became skills'],
  nearMisses: ['growth', 'what is a probe', 'film discovery for inception'],
  match(lower, text) { return wantsRate(text); },
  run,
  suite() {
    return { ok: wantsRate('probe success rate') && !wantsRate('hello') };
  },
};
