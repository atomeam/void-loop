/**
 * near-choir skill - "show the near choir", "what almost answered that" (owner, 2026-10-18).
 * For the last ask typed (this browser's recent asks), runs every skill's own match() and lists up to 3 other skills that also accept it,
 * or whose examples are nearest by word overlap (lib/stage-pack-h.js nearChoir), as a soft card "you might have meant" with one tap per skill
 * that runs that skill's first example ask. Device-local: no network, no model.
 */
import { choirOf, lastRealAsk, nearChoir, loadSkills, softCard } from '../lib/stage-pack-h.js';

const lastAsks = () => { try { const a = JSON.parse(localStorage.getItem('a2m.void.asks.v1') || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } };

async function run(text, api) {
  if (!choirOf(text)) return 'none';
  const { esc } = api;
  const ask = lastRealAsk(lastAsks());
  if (!ask) { const el = softCard('near-choir', '<strong>you might have meant</strong><p style="margin:6px 0 8px">Ask something first, then ask what almost answered it.</p><button type="button" class="g-btn nc-x">ok</button>'); el.querySelector('.nc-x').addEventListener('click', () => el.remove()); return 'near-choir'; }
  const skills = await loadSkills();
  const lower = ask.toLowerCase();
  const { taker, near } = nearChoir(ask, skills, (s) => s.match(lower, ask));
  const body = near.length
    ? '<div style="display:grid;gap:6px;margin:8px 0">' + near.map((n) => '<button type="button" class="g-btn nc-go" data-ask="' + esc(n.ask) + '" style="text-align:left"><span>' + esc(n.ask) + '</span> <span style="opacity:.6">(' + esc(n.name) + ', ' + esc(n.why) + ')</span></button>').join('') + '</div>'
    : '<p style="margin:6px 0 8px">Nothing else came close.</p>';
  const el = softCard('near-choir', '<strong>you might have meant</strong>' // void-review: ok (every value is escaped)
    + '<div style="opacity:.7">for: ' + esc(ask) + (taker ? ' (answered by ' + esc(taker) + ')' : '') + '</div>' + body
    + '<button type="button" class="g-btn nc-x">close</button>');
  el.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.nc-go');
    if (b) { el.remove(); api.stage.ask(b.getAttribute('data-ask')); }
    else if (e.target.closest && e.target.closest('.nc-x')) el.remove();
  });
  return 'near-choir';
}

export default {
  name: 'near-choir',
  examples: [
    'show the near choir',
    'what almost answered that'
  ],
  nearMisses: [
    'choir practice near me',
    'church choir hymns'
  ],
  match(lower, text) { return choirOf(text || lower); },
  run
};
