// The stage beside the show on /local/ (owner, 2026-11-06: "when blueprints from local tv are opened on stage it would be nice if the show went
// into a card alongside the blueprint so it doesnt stop playing"). Leaving /local/ for the stage would end the stream, so while a station plays,
// a "blueprint on stage" link (local/watch.js) opens the real stage, the home page with its ask, in a layer over this page, and the player
// becomes a card beside it. The <video> is never moved, reloaded or restarted: only CSS changes, so the show keeps its place and its captions,
// and Watch with Verse keeps learning. Back (the button, Esc or the browser's Back) folds the layer away and the player is where it was.
// With nothing playing, the link opens the stage the ordinary way.
const $ = (id) => document.getElementById(id);
const root = document.documentElement;
let dock = null, frame = null, sized = null, pushed = false;

function measure() { // the bar and the show card take room at the foot (phone) or the side (desktop); the stage gets the rest
  const bar = $('bar'), screen = $('screen');
  root.style.setProperty('--bar-h', (bar && !bar.hidden ? bar.offsetHeight : 0) + 'px');
  root.style.setProperty('--show-h', (screen && !screen.hidden ? screen.offsetHeight + 16 : 0) + 'px');
}

function build() {
  dock = document.createElement('div'); dock.id = 'stage-dock'; dock.setAttribute('role', 'dialog'); dock.setAttribute('aria-label', 'The stage, with the show still playing');
  const top = document.createElement('div'); top.className = 'dock-top';
  const back = document.createElement('button'); back.type = 'button'; back.className = 'go'; back.id = 'dock-back'; back.textContent = 'Back to the stations';
  back.addEventListener('click', () => closeStage());
  const full = document.createElement('a'); full.className = 'btn'; full.id = 'dock-full'; full.target = '_top'; full.textContent = 'Open the stage on its own (ends the show)';
  top.append(back, full);
  dock.append(top);
  document.body.append(dock);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('on-stage') && document.activeElement !== frame) closeStage(); });
  addEventListener('popstate', () => { if (root.classList.contains('on-stage')) { pushed = false; closeStage(); } });
  addEventListener('resize', measure);
  try { sized = new ResizeObserver(measure); sized.observe($('screen')); sized.observe($('bar')); } catch (_) {}
}

/** opens `href` (a same-site stage link) in the layer, the playing show docked beside it as a card. Returns false when it cannot (the caller then navigates). */
export function openStage(href, { tv = false } = {}) {
  let url; try { url = new URL(href, location.href); } catch (_) { return false; }
  if (url.origin !== location.origin) return false;
  if (!dock) build();
  root.classList.add('on-stage'); root.classList.toggle('stage-tv', !!tv);
  $('dock-full').href = url.pathname + url.search;
  if (!frame || frame.dataset.src !== url.href) { // a fresh frame each time: its first load replaces its blank start, so it adds no Back step
    if (frame) frame.remove();
    frame = document.createElement('iframe'); frame.title = 'Verse stage'; frame.id = 'dock-frame'; frame.dataset.src = url.href;
    frame.setAttribute('allow', 'autoplay; fullscreen; clipboard-write; microphone'); frame.src = url.href;
    dock.prepend(frame);
  }
  dock.hidden = false; measure();
  if (!pushed) { try { history.pushState({ stageDock: 1 }, '', location.href); pushed = true; } catch (_) {} }
  $('dock-back').focus({ preventScroll: true });
  return true;
}

export function closeStage() {
  if (!dock || !root.classList.contains('on-stage')) return;
  root.classList.remove('on-stage', 'stage-tv'); dock.hidden = true;
  if (frame) { frame.remove(); frame = null; } // a stage left running out of sight would keep drawing and could keep sounding
  if (pushed) { pushed = false; try { history.back(); } catch (_) {} }
  const s = $('screen'); if (s && !s.hidden) s.scrollIntoView({ block: 'nearest' });
}
