/**
 * film-posters skill — auto-generates promotional posters for phone-cut films.
 * A CSS poster card for Verse films. Empty surface stays empty. Nothing published.
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/[’]/g, "'").replace(/\s+/g, ' ');

const ASK_RE = /^(?:(?:show|generate|make|create|summon|give me)\s+)?(?:a\s+)?(?:promotional\s+)?poster(?:\s+for(?:\s+the)?\s+(?:film|phone-?cut(?:\s+film)?|latest(?:\s+film)?))?$|^phone-?cut\s+films?\s+(?:poster|promo)$/i;

export function posterOf(text) {
  const t = CLEAN(text);
  if (!ASK_RE.test(t)) return null;
  return { kind: 'film-poster', title: 'VERSE FILMS', tag: 'phone-cut · daily', line: 'built by itself, shot in a real browser' };
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card film-poster-card';
  el.dataset.id = th.id;
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:240px;padding:24px 20px;border-radius:18px;background:radial-gradient(120% 90% at 85% 0%, rgba(255,72,120,.55), transparent 60%), radial-gradient(90% 80% at 0% 100%, rgba(90,110,255,.6), transparent 60%), linear-gradient(160deg, #14102a, #07070d 70%);color:#fff;font-size:14px;line-height:1.4;box-shadow:0 18px 50px rgba(30,20,80,.45);text-align:center';
  el.innerHTML = '<div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;opacity:.7;margin-bottom:8px">' + (th.tag || '') + '</div>'
    + '<div style="font-size:28px;font-weight:700;letter-spacing:-.02em;margin-bottom:8px">' + (th.title || 'VERSE FILMS') + '</div>'
    + '<div style="opacity:.85;margin-bottom:16px">' + (th.line || '') + '</div>'
    + '<div style="display:inline-block;padding:10px 18px;border-radius:999px;background:linear-gradient(90deg,#ff3d7f,#7a5cff);font-weight:700">Watch now</div>';
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

async function run(text, api) {
  const hit = posterOf(text);
  if (!hit) return 'none';
  if (api.summon) {
    api.summon('film-poster', { title: hit.title, tag: hit.tag, line: hit.line, x: 60, y: 80 });
  }
  if (api.say) api.say(hit.title + ' · promotional poster');
  return 'film-posters';
}

export default {
  name: 'film-posters',
  examples: [
    'promotional poster for the film',
    'generate a poster for phone-cut',
    'film poster',
    'poster for the latest film',
    'phone-cut films poster'
  ],
  nearMisses: [
    'what is a poster',
    'show the films',
    'cartoon version of a film',
    'print a poster'
  ],
  match(lower, text) { return !!posterOf(text || lower); },
  run,
  stageKinds: { 'film-poster': { mount } },
  suite() {
    const hit = posterOf('promotional poster for the film');
    const empty = posterOf('');
    const miss = posterOf('what is a poster');
    const ok = !!hit && hit.kind === 'film-poster' && !empty && !miss && hit.title === 'VERSE FILMS';
    return { ok, got: hit && hit.tag };
  }
};
