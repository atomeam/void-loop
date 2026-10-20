/**
 * haiku skill — a daily Verse haiku on the stage.
 * Empty surface stays empty. Nothing published.
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/[’]/g, "'").replace(/\s+/g, ' ');

const ASK_RE = /^(?:(?:show|summon|give me|make|write)\s+)?(?:a\s+)?(?:daily\s+)?(?:verse\s+)?haiku(?:\s+(?:of\s+the\s+day|for\s+me|about\s+verse))?$|^haiku\s+please$/i;

const HAIKU = [
  { lines: ['code grows by itself', 'each ask a new leaf unfurls', 'void fills with light'], by: 'Verse' },
  { lines: ['browser opens wide', 'experiments film themselves', 'watch the daily cut'], by: 'Verse' },
  { lines: ['skills learn from use', 'friction fades into better', 'growth is the answer'], by: 'Verse' }
];

export function haikuOf(text) {
  const t = CLEAN(text);
  if (!ASK_RE.test(t)) return null;
  const pick = HAIKU[Math.floor(Math.random() * HAIKU.length)]; // demo; in real would be date-seeded
  return { kind: 'haiku', lines: pick.lines, by: pick.by };
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card haiku-card';
  el.dataset.id = th.id;
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:220px;padding:20px 18px;border-radius:16px;background:#0c0c12;color:#e8e4d8;font-family:Georgia,serif;font-size:15px;line-height:1.6;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.08)';
  el.innerHTML = (th.lines || []).map(l => '<div>' + l + '</div>').join('') + '<div style="margin-top:12px;font-size:12px;opacity:.6">— ' + (th.by || 'Verse') + '</div>';
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

async function run(text, api) {
  const hit = haikuOf(text);
  if (!hit) return 'none';
  if (api.summon) {
    api.summon('haiku', { lines: hit.lines, by: hit.by, x: 80, y: 100 });
  }
  if (api.say) api.say(hit.lines.join(' / '));
  return 'haiku';
}

export default {
  name: 'haiku',
  examples: [
    'daily haiku',
    'summon a haiku',
    'verse haiku',
    'haiku of the day',
    'write a haiku for me'
  ],
  nearMisses: [
    'what is a haiku',
    'haiku about weather',
    'poem',
    'show the growth'
  ],
  match(lower, text) { return !!haikuOf(text || lower); },
  run,
  stageKinds: { haiku: { mount } },
  suite() {
    const hit = haikuOf('daily haiku');
    const empty = haikuOf('');
    const miss = haikuOf('what is a haiku');
    const ok = !!hit && Array.isArray(hit.lines) && hit.lines.length === 3 && !empty && !miss;
    return { ok, got: hit && hit.lines[0] };
  }
};
