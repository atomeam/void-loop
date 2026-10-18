/**
 * veto-council skill - "convene a council on <question>" (asked by the owner, 2026-10-18, operating laws for serious thought).
 * Five named reasoners each propose; each holds veto mass (editable, always summing to 100). Low mass only delays a proposal, high
 * mass blocks it; consensus is not a merge: one proposal survives whole and the card names who delayed or blocked the rest. After the
 * decision the person moves the mass and convenes again. The law is lib/council-law.js (pure, tested). No network, nothing stored.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import * as C from '../lib/council-law.js';

const WHEN = /^(?:convene|call|hold|run)\s+(?:a|the)\s+(?:veto\s+)?council\s+(?:on|about|over|for)\s+\S/i; // "council tax" and "city council" are not asks to convene

function run(text, api) {
  const { showPage, esc } = api, q = String(text).replace(/^\s*\S+\s+(?:a|the)\s+(?:veto\s+)?council\s+\w+\s+/i, '').replace(/[?.!]+$/, '').trim().slice(0, 120);
  showPage((el) => {
    el.classList.add('veto-council');
    let masses = C.startMasses(), verdict = null;
    el.innerHTML = '<h2>Veto council</h2><div class="vc-q"></div><div class="vc-masses"></div><div class="vc-total"></div><div class="vc-out" role="status"></div><div class="src">Five reasoners propose; mass decides who can only delay and who can block. Consensus is not a merge. Local only · as of 2026-10</div>';
    const $ = (s) => el.querySelector(s), box = $('.vc-masses'); $('.vc-q').textContent = 'Question: ' + q;
    const draw = () => {
      verdict = C.convene(q, masses); el.dataset.survivor = verdict.survivor || ''; el.dataset.total = String(Object.values(masses).reduce((a, v) => a + v, 0));
      box.innerHTML = C.AGENTS.map((a) => '<label style="display:inline-block;margin:2px 8px 2px 0">' + esc(a.name) + ' <input type="number" min="0" max="100" step="1" data-agent="' + esc(a.name) + '" value="' + masses[a.name] + '" style="width:4.2em"></label>').join('');
      $('.vc-total').textContent = 'Veto mass: ' + el.dataset.total + ' of ' + C.TOTAL + ' (moving one moves the others). A single agent with ' + Math.round(C.BLOCK_SHARE * C.TOTAL) + '+ can block.';
      $('.vc-out').innerHTML = verdict.proposals.map((p) => {
        const dl = p.delayedBy.map((d) => esc(d.name) + ' (' + d.mass + ')').join(', '), bl = p.blockedBy.map((d) => esc(d.name) + ' (' + d.mass + ')').join(', ');
        return '<div class="vc-p vc-' + p.status + '" data-by="' + esc(p.by) + '" data-status="' + p.status + '" style="margin:4px 0;padding:4px 8px;border-left:4px solid ' + (p.status === 'survived' ? '#3a9' : p.status === 'blocked' ? '#c44' : p.status === 'delayed' ? '#ca3' : '#888') + '"><b>' + esc(p.by) + '’s proposal</b> · ' + p.status + (p.status === 'survived' ? ' (survived whole)' : '') + ' · ' + p.rounds + ' round' + (p.rounds > 1 ? 's' : '') + (dl ? ' · delayed by ' + dl : '') + (bl ? ' · blocked by ' + bl : '') + '<br><small>' + C.CRITERIA.map((c, i) => c + ' ' + p.props[i]).join(' · ') + '</small></div>';
      }).join('') + '<p>' + (verdict.survivor ? 'Survivor: ' + esc(verdict.survivor) + '’s proposal, unmerged.' : 'No proposal survived: someone with enough mass blocked each one.') + ' Now move the mass and convene again.</p>';
    };
    box.addEventListener('change', (e) => { const n = e.target && e.target.dataset && e.target.dataset.agent; if (n) { masses = C.setMass(masses, n, e.target.value); draw(); } });
    draw();
  });
  return 'veto-council';
}

export default {
  name: 'veto-council',
  examples: ['convene a council on whether to rewrite the app', 'convene a council on moving offices'],
  nearMisses: ['council tax bands', 'city council meeting times'],
  match(lower) { return WHEN.test(lower.trim()); },
  run
};
