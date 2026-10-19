/**
 * telemetry-route skill (owner, 2026-10-18): paste a CI report, build log or status update and Verse reads it as the builders' own
 * telemetry instead of answering it like a coding question. A card names the commits and pull requests it saw, the pass count and what
 * is still failing, with two taps: plant the failures in the error garden, or open the incident autopsy. Nothing is sent anywhere and
 * nothing lands on the stage unasked. A question or an instruction ("why is my ci red") is left alone (lib/telemetry.js).
 */
import { telemetryOf, summaryOf } from '../lib/telemetry.js';
import { liveLines, REPO } from '../lib/telemetry-live.js';

const MARK = { true: '✓ ', false: '✗ ', null: '· ' };

function run(text, api) {
  const t = telemetryOf(text); if (!t) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => {
    p.innerHTML = '<h2>What is really true now</h2>' // void-review: ok (constant heading; every value below is escaped)
      + '<ul class="v-asks" data-tel-live="1"><li>checking GitHub for main, the pull requests and the commits it names…</li></ul>'
      + '<div class="vh">What the report said</div><ul class="v-asks">' + summaryOf(t).slice(1).map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>'
      + (t.failures.length ? '<div class="vh">Named as failing in the report (checked above, not here)</div><ul class="v-asks" data-tel-fail="1">' + t.failures.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>' : '')
      + '<p><button type="button" class="tr-copy" data-tel="garden">Plant these in the error garden</button> <button type="button" class="tr-copy" data-tel="autopsy">Open the incident autopsy</button></p>'
      + '<div class="src">Live state from GitHub\'s public API for ' + esc(REPO) + ' · what you pasted stays on this device</div>';
  });
  const slot = el && el.querySelector && el.querySelector('[data-tel-live]');
  if (slot) liveLines(t).then((lines) => {
    slot.innerHTML = lines.map((l) => '<li data-ok="' + esc(String(l.ok)) + '">' + esc(MARK[String(l.ok)] || '· ') + esc(l.text) + '</li>').join('') || '<li>nothing to check</li>'; // void-review: ok (every value escaped)
  });
  if (el) el.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-tel]'); if (!b) return;
    if (b.dataset.tel === 'autopsy') api.stage.ask('incident autopsy');
    else for (const f of t.failures.slice(0, 3)) api.stage.ask('plant my mistake: ' + f.replace(/[:\-]\s*$/, ''));
  });
  return 'telemetry-route';
}

export default {
  name: 'telemetry-route',
  examples: [
    'CI report: the browser suite failed on commit 57ab1f2e after PR 1083 merged. FAIL fly stars move: the streak never showed. 159/162 passed, unit tests pass, the rest are unconfirmed.'
  ],
  nearMisses: [
    'why is my ci red',
    'fix this failing test',
    'what is a browser suite'
  ],
  match(lower, text) { return !!telemetryOf(text || lower); },
  run
};
