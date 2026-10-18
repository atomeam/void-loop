/**
 * echo-chamber skill (owner, 2026-10-18): "replay my best answers from this week", "what did I decide last tuesday" - a card of
 * what this device kept: the loop log (a2m.void.loop.v1) and what you filed in the codex. Never leaves the browser; shown only when asked.
 * Not this: "echo chamber meaning", "replay the game", "what did I decide to have for lunch".
 */
import { echoOf, echoes, loadList } from '../lib/stage-pack-c.js';

async function run(text, api) {
  const { showPage, esc } = api;
  const q = echoOf(text);
  if (!q) return 'none';
  let log = [];
  try { log = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]'); } catch (_) {}
  const rows = echoes({ log, codex: loadList('codex') }, q);
  showPage((el) => {
    const head = q.kind === 'best' ? 'Your best answers' : 'What you decided';
    if (!rows.length) {
      el.innerHTML = '<h2>' + esc(head) + '</h2><p>' + esc('Nothing on this device matches ' + q.label + ' yet.') + '</p><div class="sub">V01D only reads what this browser kept. File an answer with "file this in the codex" and it leads here.</div>';
      return;
    }
    el.innerHTML = '<h2>' + esc(head) + '</h2><div class="sub">' + esc(q.label) + ' · ' + rows.length + ' from this device, never sent anywhere</div><ol style="margin:10px 0 0 18px;padding:0;list-style:none">'
      + rows.map((r) => '<li style="margin:6px 0"><span style="color:#8a8a8a">' + esc(new Date(r.t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })) + '</span> '
        + (r.filed ? '<b>filed</b> ' : '') + '<a href="#" data-ask="' + esc(r.ask) + '">' + esc(r.ask) + '</a> <span style="opacity:.6">' + esc(r.via) + '</span></li>').join('')
      + '</ol><div class="src">Source: this device · loop log and codex</div>';
  });
  return 'echo-chamber';
}

export default {
  name: 'echo-chamber',
  examples: ['replay my best answers from this week', 'what did I decide last tuesday', 'replay my best answers', 'what did I decide yesterday'],
  nearMisses: ['echo chamber meaning', 'what did i decide to have for lunch', 'replay the game', 'what did i decide on a whim'],
  match(lower, text) { return !!echoOf(text); },
  run,
};
