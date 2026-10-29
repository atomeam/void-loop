/**
 * swarm skill — "swarm", "void agents", "show me the swarm", "watch the agents": Verse's agents on the stage, a field of small
 * minds that cluster near your pointer, explore when you leave and now and then scatter, while the card around them
 * changes with the field's mood (its border hue, glow and status line). The 3D field is skills/mini/swarm.js on the shared
 * scene3d.js engine. Salvaged from the Frontier-Engine experiment F-020 (docs/SALVAGE.md). Reduced motion: a still field.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const WHEN = /^(?:show (?:me )?|open |start |run )?(?:the |your |(?:verse|v01d)'?s |(?:verse|void)'?s )?(?:swarm|(?:verse|void) agents?|agent swarm|swarm agents|agents swarm|swarm effect|swarm sim(?:ulation)?)(?: (?:demo|mode|effect))?(?: please)?$/i;
const WORDS = { idle: 'void · idle', clustering: 'clustering', dispersing: 'dispersing' };

function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => {
    p.innerHTML = '<h2>' + esc('Verse agents') + '</h2><div class="sub">' + esc('a swarm of small minds; move over it to call them, leave and they explore') + '</div>'
      + '<div class="vswarm" style="--mood:190;--intensity:.3;border:2px solid hsl(var(--mood),70%,calc(50% + var(--intensity)*30%));box-shadow:0 0 calc(var(--intensity)*20px) hsl(var(--mood),70%,50%);border-radius:14px;overflow:hidden;transition:border-color .3s,box-shadow .3s">'
      + '<div class="vmini" style="height:' + (Math.min(innerWidth, innerHeight) < 560 ? 200 : 240) + 'px"></div></div>'
      + '<p class="vswarm-status" role="status" aria-live="polite" style="margin:8px 0 0">void · idle</p>'
      + '<div class="src">From the Frontier-Engine experiment F-020 (emergent agents with a mood that reshapes the card) \u00b7 runs on your device</div>';
  });
  const box = el && el.querySelector('.vswarm'), band = el && el.querySelector('.vmini'), status = el && el.querySelector('.vswarm-status');
  let lastName = '';
  const onMood = (m) => {
    if (!m || !box) return;
    box.style.setProperty('--mood', m.hue); box.style.setProperty('--intensity', m.intensity);
    if (status && m.name !== lastName) { lastName = m.name; status.textContent = WORDS[m.name] || m.name; } // only a change is announced
  };
  if (band && api.stage && api.stage.miniature) {
    api.stage.miniature(band, 'swarm', { onMood }, { key: 'swarm:' + Date.now().toString(36), label: 'Verse agents: a swarm that gathers near your pointer', orbit: false, ground: 'none' })
      .catch(() => { band.remove(); if (status) status.textContent = 'The swarm needs WebGL, which this browser cannot run.'; });
  } else if (band) { band.remove(); if (status) status.textContent = 'The swarm needs WebGL, which this browser cannot run.'; }
  return 'swarm';
}

export { WHEN };
export default {
  name: 'swarm',
  examples: ['swarm', 'void agents', 'show me the swarm', 'show the void agents', "v01d's swarm", 'agent swarm'],
  nearMisses: ['swarm of bees', 'what is a swarm', 'how do bees swarm', 'what are ai agents', 'swarm intelligence definition'],
  match(lower) { return WHEN.test(lower.trim()); },
  run
};
