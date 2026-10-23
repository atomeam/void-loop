/**
 * mind-field-mode skill — Mind Field: one living field you can draw on, talk to and steer, in nine modes (Doodle Mind, Echo Field, Resonant Membrane, Swarm,
 * Flow, Listen, Grow, Attention and Living cards); "mind field modes" lists them and every card has a Mode switcher. These are the words
 * that reach Mind Field's modes by name (owner, 2026-10-21: "make them all easier to find"):
 * "mind field swarm", "listen field", "swarm field", "mind field in flow mode", "show me a mind", "mind field modes", "save this mind".
 * A mode ask opens that mode's own skill exactly as its old words do (or switches the card on the stage); "save this mind" seals the
 * Mind Field card on the stage (numbers only, never what you drew). The table is lib/mind-field-modes.js.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { MODES, modeAsk, listAsk, saveAsk, isMode } from '../lib/mind-field-modes.js';
import doodle from './doodle-mind.js';
import swarmMind from './swarm-mind.js';
import vectorField from './vector-field-mind.js';
import resonance from './resonance-mind.js';
import nca from './nca-mind.js';
import attention from './attention-field-mind.js';
import livingCards from './living-cards-mind.js';
import echo from './echo-field.js';
import membrane from './resonant-membrane.js';

const SKILLS = { 'doodle-mind': doodle, 'echo-field': echo, 'resonant-membrane': membrane, 'swarm-mind': swarmMind, 'vector-field-mind': vectorField, 'resonance-mind': resonance, 'nca-mind': nca, 'attention-field-mind': attention, 'living-cards-mind': livingCards };
const CLEAN = (t) => String(t || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const SHOW_A_MIND = /^(?:show|give|make) me (?:a|the|your) mind$/;

function match(lower, text) { const t = text || lower; if (Object.values(SKILLS).some((k) => k.match(String(t).toLowerCase(), t))) return false; // a mode's own words stay its own (and its log line)
  return !!modeAsk(t) || listAsk(t) || saveAsk(t) || SHOW_A_MIND.test(CLEAN(t)); }

async function run(text, api) {
  const t = String(text || '');
  if (listAsk(t)) {
    api.showPage((p) => {
      p.innerHTML = '<h2>Mind Field modes</h2><p>Mind Field is one skill with ' + MODES.length + ' modes. Each card has a Mode switcher, and every one of these asks opens its mode.</p><ul class="mf-modes">'
        + MODES.map((m) => '<li><b>' + api.esc(m.title) + '</b>: ' + api.esc(m.about) + '. <a href="#" data-ask="' + api.esc(m.ask) + '">' + api.esc(m.ask) + '</a> · <a href="#" data-ask="mind field ' + api.esc(m.name.toLowerCase()) + '">mind field ' + api.esc(m.name.toLowerCase()) + '</a>' + (m.link ? ' · <a href="' + api.esc(m.link.href) + '" target="_blank" rel="noopener">' + api.esc(m.link.text) + '</a>' : '') + '</li>').join('')
        + '</ul><p class="src">Say "save this mind" to seal the one on the stage.</p>';
    });
    return 'mind-field-mode';
  }
  if (saveAsk(t)) {
    const on = Object.values(api.stage.things()).find((x) => isMode(x.kind));
    const el = on && document.querySelector('.field-card[data-id="' + CSS.escape(on.id) + '"] .ff-seal');
    if (el) { el.click(); api.say('Saving this mind: only its numbers are sealed on this device, never what you drew.'); return 'mind-field-mode'; }
    await doodle.run('mind field', api); api.say('There was no mind on the stage, so here is Mind Field. Draw on it, then tap Seal or say "save this mind" again.');
    return 'mind-field-mode';
  }
  if (SHOW_A_MIND.test(CLEAN(t))) return doodle.run('mind field', api);
  const mode = modeAsk(t); if (!mode) return 'none';
  return SKILLS[mode.id].run(mode.id === 'doodle-mind' ? 'mind field' : mode.ask, api);
}

export default {
  name: 'mind-field-mode',
  examples: ['mind field swarm', 'listen field', 'swarm field', 'mind field in flow mode', 'show me a mind', 'mind field modes', 'save this mind', 'mind field grow', 'mind field doodle mind'],
  nearMisses: ['what is a magnetic field', 'mind over matter', 'save this note', 'field trip ideas', 'swarm'],
  match, run
};
