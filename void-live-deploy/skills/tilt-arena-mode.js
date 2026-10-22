/**
 * tilt-arena-mode skill — Tilt Arena: learning agents chase what you steer, in four modes (Tilt, Gaze Chase, GPU Swarm and Hand Arena).
 * "tilt arena modes" lists them and every card has a Mode switcher. These are the words that reach a
 * mode by name: "tilt arena gaze", "tilt arena in hand mode", "gaze arena", "tilt arena modes", "save the arena". A mode ask opens that
 * mode's own skill exactly as its own words do; "save the arena" seals the arena card on the stage (the leader's genome, numbers only).
 * The table is lib/tilt-arena-modes.js.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { MODES, modeAsk, listAsk, saveAsk, isMode } from '../lib/tilt-arena-modes.js';
import tilt from './tilt-mode.js';
import gaze from './gaze-chase.js';
import gpuSwarm from './gpu-swarm.js';
import hand from './hand-arena.js';

const SKILLS = { 'tilt-mode': tilt, 'gaze-chase': gaze, 'gpu-swarm': gpuSwarm, 'hand-arena': hand };
const PLAY = /^(?:show|give|let) (?:me|us) (?:an?|the) (?:agent )?arena$|^(?:play|start) (?:an?|the) arena$/;
const CLEAN = (t) => String(t || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

function match(lower, text) { const t = text || lower; if (Object.values(SKILLS).some((k) => k.match(String(t).toLowerCase(), t))) return false; // a mode's own words stay its own
  return !!modeAsk(t) || listAsk(t) || saveAsk(t) || PLAY.test(CLEAN(t)); }

async function run(text, api) {
  const t = String(text || '');
  if (listAsk(t)) {
    api.showPage((p) => {
      p.innerHTML = '<h2>Tilt Arena modes</h2><p>Tilt Arena is one game with ' + MODES.length + ' ways to steer. Each card has a Mode switcher, and every one of these asks opens its mode.</p><ul class="ta-modes">'
        + MODES.map((m) => '<li><b>' + api.esc(m.title) + '</b>: ' + api.esc(m.about) + '. <a href="#" data-ask="' + api.esc(m.ask) + '">' + api.esc(m.ask) + '</a> · <a href="#" data-ask="tilt arena ' + api.esc(m.name.toLowerCase()) + '">tilt arena ' + api.esc(m.name.toLowerCase()) + '</a></li>').join('')
        + '</ul><p class="src">Say "save the arena" to seal the leader of the one on the stage.</p>';
    });
    return 'tilt-arena-mode';
  }
  if (saveAsk(t)) {
    const on = Object.values(api.stage.things()).find((x) => isMode(x.kind));
    const el = on && document.querySelector('.field-card[data-id="' + CSS.escape(on.id) + '"] .ff-seal');
    if (el) { el.click(); api.say("Saving the arena's leader: only its genome's numbers are sealed on this device."); return 'tilt-arena-mode'; }
    await tilt.run('tilt arena', api); api.say('There was no arena on the stage, so here is Tilt Arena. Let it play a little, then tap Seal or say "save the arena" again.');
    return 'tilt-arena-mode';
  }
  if (PLAY.test(CLEAN(t))) return tilt.run('tilt arena', api);
  const mode = modeAsk(t); if (!mode) return 'none';
  return SKILLS[mode.id].run(mode.ask, api);
}

export default {
  name: 'tilt-arena-mode',
  examples: ['tilt arena modes', 'tilt arena gaze', 'tilt arena in hand mode', 'swarm arena', 'save the arena', 'tilt arena gpu swarm', 'show me an arena'],
  nearMisses: ['arena seating chart', 'save this note', 'what is an arena', 'tilt'],
  match, run
};
