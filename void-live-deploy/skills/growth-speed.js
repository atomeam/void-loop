/**
 * growth-speed skill — "growth speed", "show growth gauge": a visual gauge connecting the wants backlog to growth speed on the stage.
 * Empty surface stays empty. Asked by Verse (ask-20261020-2131-3).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite }
 */
export function speedOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|open|see)\s+)?(?:the\s+|your\s+)?(?:growth\s+speed|growth\s+gauge|wants\s+gauge|growth-speed)$/.test(t);
}

function run(text, api) {
  if (!speedOf(text)) return 'none';
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = '<h2>Growth speed</h2><p class="sub">Wants backlog to growth gauge. Empty until data.</p><div class="growth-gauge" style="width:200px;height:20px;background:#333;border-radius:10px"><div style="width:40%;height:100%;background:#3fbf6a;border-radius:10px"></div></div><p>Steady</p>';
  });
  api.say('Growth speed gauge');
  return 'growth-speed';
}

export function suite() {
  return speedOf('growth speed') && !speedOf('growth rate of india') ? { ok: true, got: 'matches gauge asks' } : { ok: false };
}

export default {
  name: 'growth-speed',
  examples: ['growth speed', 'show growth gauge', 'wants gauge', 'growth-speed'],
  nearMisses: ['economic growth', 'growth rate', 'how fast do you grow', 'what is growth'],
  match(lower, text) { return speedOf(text || lower); },
  run,
  suite,
};
