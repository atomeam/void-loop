/**
 * minimap skill — "show the minimap" / "hide the minimap": a small overview card fixed in the stage's corner, one dot for
 * every thing on the stage; a tap on a dot picks that thing and scrolls the stage to it. Asked for by the owner (2026-10-18).
 * Nothing appears until asked; it is device-local (the stage is saved in this browser) and sends nothing anywhere.
 */
import { escHtml, firstOf, addThing, removeKind, tidy } from '../lib/stage-pack.js';

const MAP = '(?:mini[\\s-]?map|stage\\s+map)';
const SHOW = new RegExp('^(?:please\\s+)?(?:(?:show|open|bring\\s+up|turn\\s+on|add|display|give)\\s+(?:me\\s+)?(?:the\\s+|a\\s+|my\\s+)?)?' + MAP + '(?:\\s+please)?$');
const HIDE = new RegExp('^(?:please\\s+)?(?:hide|close|remove|dismiss|turn\\s+off|get\\s+rid\\s+of)\\s+(?:the\\s+|my\\s+)?' + MAP + '(?:\\s+please)?$');

/** 'show' | 'hide' | null for an ask. Pure. */
export function minimapIntent(lower) {
  const l = tidy(lower).toLowerCase();
  if (HIDE.test(l)) return 'hide';
  if (SHOW.test(l)) return 'show';
  return null;
}

/** the dots of the overview: every thing but the map itself, scaled into a box. stage {w,h}, box {w,h}. Pure. */
export function minimapDots(things, stage, box) {
  const list = Object.values(things || {}).filter((t) => t && t.kind !== 'minimap' && Number.isFinite(+t.x) && Number.isFinite(+t.y));
  const maxX = Math.max(+stage.w || 0, ...list.map((t) => +t.x + 60)), maxY = Math.max(+stage.h || 0, ...list.map((t) => +t.y + 40));
  const sx = box.w / (maxX || 1), sy = box.h / (maxY || 1);
  return list.map((t) => ({ id: t.id, kind: t.kind, x: Math.round(Math.min(box.w - 6, Math.max(0, t.x * sx))), y: Math.round(Math.min(box.h - 6, Math.max(0, t.y * sy))) }));
}

const BOX = { w: 132, h: 84 };

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'minimap-card';
  el.dataset.minimap = th.id;
  el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'minimap of the stage');
  el.style.cssText = 'position:absolute;right:10px;bottom:10px;width:' + BOX.w + 'px;height:' + BOX.h + 'px;z-index:25;border-radius:8px;background:rgba(10,10,16,.82);border:1px solid rgba(255,255,255,.22);overflow:hidden';
  const dots = minimapDots(stageApi.things(), { w: stageApi.stage.clientWidth, h: stageApi.stage.clientHeight }, BOX);
  for (const d of dots) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.target = d.id;
    b.setAttribute('aria-label', 'go to ' + d.kind);
    b.title = d.kind;
    b.style.cssText = 'position:absolute;left:' + d.x + 'px;top:' + d.y + 'px;width:6px;height:6px;padding:0;border:0;border-radius:50%;background:' + (stageApi.selected() === d.id ? '#ffd166' : '#8fb4ff') + ';cursor:pointer';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = stageApi.stage.querySelector('[data-id="' + CSS.escape(d.id) + '"]');
      stageApi.select(d.id);
      if (target) {
        try { target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch (_) {}
        target.style.outline = '2px solid #ffd166'; setTimeout(() => { try { target.style.outline = ''; } catch (_) {} }, 1200);
      }
    });
    el.appendChild(b);
  }
  if (!dots.length) { const e = document.createElement('div'); e.innerHTML = '<span style="font:11px system-ui;color:#999;padding:6px;display:block">' + escHtml('nothing on the stage yet') + '</span>'; el.appendChild(e); }
  for (const ev of ['pointerdown', 'mousedown', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation());
  stageApi.stage.appendChild(el);
}

/** the stage kind's ask hook: 'minimap' (shown), 'minimap-removed', or '' */
export function ask(lower, text, stageApi) {
  const act = minimapIntent(lower);
  if (!act) return '';
  if (act === 'hide') return removeKind(stageApi, 'minimap') ? 'minimap-removed' : 'no minimap';
  if (!firstOf(stageApi, 'minimap')) addThing(stageApi, 'minimap', { x: 0, y: 0 });
  stageApi.save(); stageApi.render();
  return 'minimap';
}

export default {
  name: 'minimap',
  examples: ['show the minimap', 'hide the minimap', 'minimap'],
  nearMisses: ['what is a minimap', 'show me a map of paris', 'add milk to my list'],
  minimapIntent,
  match(lower) { return !!minimapIntent(lower); },
  async run(text, api) { const d = ask(String(text || '').toLowerCase(), text, api.stage); if (d) api.say(d === 'minimap' ? 'minimap on · tap a dot to go there' : d === 'no minimap' ? 'no minimap to hide' : ''); return d ? 'minimap' : 'none'; },
  stageKinds: { minimap: { mount, ensure: (stageApi) => firstOf(stageApi, 'minimap') || addThing(stageApi, 'minimap', { x: 0, y: 0 }), ask } },
};
