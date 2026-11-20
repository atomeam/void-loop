/**
 * verse-runs skill — the public scheduled automations Verse keeps, findable by name.
 * "what automations does Verse run", "Verse's scheduled automations", or a public name
 * such as "Capability and platform scout" or "Verse growth for business delivery".
 * Personal runs never appear. Nothing is sent.
 */
import { publicRuns, isVerseRunsAsk, EVERY_WORDS } from '../lib/verse-runs.js';

export { isVerseRunsAsk };

function paint(api, hit) {
  const { showPage, esc } = api;
  const rows = publicRuns();
  const focus = hit && hit.run ? hit.run.id : '';
  showPage((el) => {
    const items = rows.map((r) => {
      const when = EVERY_WORDS[r.every] || r.every;
      const line = '<li' + (r.id === focus ? ' class="here"' : '') + '><strong>' + esc(r.name) + '</strong> · ' + esc(when)
        + (r.does ? '<br>' + esc(r.does) : '') + '</li>';
      return line;
    }).join('');
    const lead = focus
      ? '<p class="sub">' + esc(hit.run.name) + ' is one of Verse’s scheduled automations. The public list is below. Personal plans stay private.</p>'
      : '<p class="sub">These are the scheduled automations Verse runs on its own clock. Personal plans stay private and are not listed.</p>';
    el.innerHTML = '<h2>Verse’s scheduled automations</h2>'
      + lead
      + '<ul class="verse-runs">' + items + '</ul>'
      + '<p>Type one of the names, or “what automations does Verse run”, to open this list again.</p>'
      + '<div class="src">Source: Verse’s scheduled runs · nothing sent</div>';
  });
  return 'verse-runs';
}

async function run(text, api) {
  return paint(api, isVerseRunsAsk(text) || { list: true });
}

export const builtWith = ['verse-runs'];
export default {
  name: 'verse-runs',
  examples: [
    'what automations does Verse run',
    "Verse's scheduled automations",
    'scheduled automations',
    'Capability and platform scout',
    'Verse growth for business delivery',
    'Idea and action extractor',
    'AI and automation news for delivery'
  ],
  nearMisses: [
    'my automations',
    'automations',
    'new automation',
    'automation status for invoice reminders',
    'what automations are running for onboarding',
    'Execution stamina plan',
    'Weekly fuel plan',
    'Daily work plan'
  ],
  match: (low, raw) => !!isVerseRunsAsk(raw || low),
  run,
  suite() {
    const ok = this.examples.every((e) => isVerseRunsAsk(e)) && !this.nearMisses.some((e) => isVerseRunsAsk(e));
    return { ok, got: ok ? 'match works' : 'match broke' };
  }
};
