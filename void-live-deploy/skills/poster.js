/**
 * poster skill — auto-generates a simple promotional poster for a film (asked by Verse: phone-cut films skill auto-generates promotional posters).
 * "make a poster for Phone Cut", "promotional poster for my film", "film poster for Ikiru".
 * Empty surface stays empty. The poster is a stage card with a canvas drawing of the title and a short line.
 * No external services, no secrets. Uses what exists: stage summon, canvas.
 */
function titleOf(text) {
  const m = /(?:poster(?:\s+for)?|promotional\s+poster(?:\s+for)?|film\s+poster(?:\s+for)?)\s+(?:the\s+)?["']?([a-z0-9\s\-]+)["']?/i.exec(String(text || ''));
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
}

function posterOf(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').trim();
  return /poster|promotional poster|film poster/.test(t) && titleOf(text);
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card poster-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(280px, calc(100vw - 20px))';
  const canvas = document.createElement('canvas');
  canvas.width = 280; canvas.height = 400;
  canvas.style.cssText = 'width:100%;height:auto;border-radius:8px;background:#111';
  const ctx = canvas.getContext('2d');
  const title = th.title || 'Untitled';
  // simple poster: gradient bg, title, tagline
  const grd = ctx.createLinearGradient(0, 0, 0, 400);
  grd.addColorStop(0, '#1a1a2e'); grd.addColorStop(1, '#16213e');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 280, 400);
  ctx.fillStyle = '#e0e0e0'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(title, 140, 180);
  ctx.font = '16px sans-serif'; ctx.fillStyle = '#a0a0a0';
  ctx.fillText('A Void film', 140, 220);
  ctx.font = '12px sans-serif'; ctx.fillText('phone-cut · auto poster', 140, 360);
  el.appendChild(canvas);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

function run(text, api) {
  const title = titleOf(text) || 'Phone Cut';
  api.summon('poster', { title, center: true });
  api.say('A promotional poster for ' + title + ' is on the stage. It stays after a reload.');
  return 'poster';
}

export default {
  name: 'poster',
  examples: [
    'make a poster for Phone Cut',
    'promotional poster for my film',
    'film poster for Ikiru',
    'generate a poster for Void'
  ],
  nearMisses: [
    'movie poster',
    'print a poster',
    'poster of a cat',
    'best posters'
  ],
  match(lower, text) { return !!posterOf(text || lower); },
  run,
  stageKinds: { poster: { mount } },
  suite() {
    return { ok: !!posterOf('make a poster for Phone Cut') && titleOf('make a poster for Phone Cut') === 'Phone Cut' && !posterOf('hello') };
  },
};
