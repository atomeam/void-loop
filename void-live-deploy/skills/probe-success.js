/**
 * probe-success skill — card tracking success rate of self-generated probes to new skills.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "show probe success rate", "probe success card", "how are the probes doing".
 * Empty surface stays empty. Demo data until a live probe feed is public.
 */
export function probeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:show\s+)?(?:the\s+)?probe(?:s)?\s+(?:success|rate|stats|card|dashboard)|how\s+are\s+(?:the\s+)?probes\s+doing|probe\s+success\s+rate$/i.test(t);
}

function rates() {
  return [
    { skill: 'film-metadata', probes: 12, success: 11 },
    { skill: 'browser-recordings', probes: 5, success: 4 },
    { skill: 'poster', probes: 8, success: 7 },
    { skill: 'probe-success', probes: 3, success: 3 },
  ];
}

async function run(text, api) {
  if (!probeOf(text)) return 'none';
  const { showPage, esc } = api;
  const data = rates();
  const total = data.reduce((a, b) => a + b.probes, 0);
  const ok = data.reduce((a, b) => a + b.success, 0);
  const pct = total ? Math.round(100 * ok / total) : 0;
  showPage((el) => {
    el.innerHTML = '<h2>Probe success rate</h2><div class="sub">' + esc(ok + '/' + total + ' probes succeeded (' + pct + '%)') + '</div>'
      + '<ul style="margin:8px 0;padding-left:18px">' + data.map((d) => '<li>' + esc(d.skill) + ': ' + d.success + '/' + d.probes + '</li>').join('') + '</ul>'
      + '<div class="src">Self-generated probes (probe-asks). Demo numbers until the live feed is wired. Nothing is sent.</div>';
  });
  return 'probe-success';
}

export default {
  name: 'probe-success',
  examples: ['show probe success rate', 'probe success card', 'how are the probes doing', 'probe stats'],
  nearMisses: ['what is a probe', 'probe the code', 'success stories', 'rate this'],
  match(lower, text) { return probeOf(text); },
  run,
  suite() {
    return { ok: !!probeOf('show probe success rate') && probeOf('what is a probe') == null };
  },
};
