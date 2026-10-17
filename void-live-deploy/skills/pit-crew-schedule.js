/**
 * pit-crew-schedule skill — pit-crew --queue on a schedule once owner enables VOID_MISSES_TOKEN path.
 * "pit-crew queue schedule", "schedule pit crew queue", "pit-crew --queue".
 * Dry-run only; no token invented. Empty surface stays empty.
 */
export function pitCrewOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:pit[- ]crew)\s+(?:--queue\s+)?(?:on\s+a\s+)?schedule|^(?:schedule\s+)?pit[- ]crew\s+(?:--)?queue$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!pitCrewOf(text)) return 'none';
  showPage((p) => {
    p.innerHTML = '<h2>Pit-crew queue schedule</h2>'
      + '<div class="sub">Dry-run first</div>'
      + '<p>Once owner enables VOID_MISSES_TOKEN path, pit-crew --queue can run on a schedule.</p>'
      + '<p>This card is the dry-run: no spend, no token written. Confirm line for any real run.</p>'
      + '<div class="src">Follow-on to execution layers. Uses existing pit-crew.mjs.</div>';
  });
  return 'pit-crew-schedule';
}

export default {
  name: 'pit-crew-schedule',
  examples: ['pit-crew queue schedule', 'schedule pit crew queue', 'pit-crew --queue'],
  nearMisses: ['pit crew', 'queue', 'schedule'],
  match(lower, text) { return pitCrewOf(text); },
  run,
  suite() {
    return { ok: pitCrewOf('pit-crew queue schedule') && !pitCrewOf('hello') };
  },
};
