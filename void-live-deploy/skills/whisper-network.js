/**
 * whisper-network skill (owner, 2026-10-18): "leave a whisper on the clock: remember milk" attaches a one-time note to a stage thing.
 * It surfaces once, the next time that thing is touched or opened, then is gone. Device-local (a2m.void.whispers.v1), nothing sent.
 * The surfacing is the skill's decorate(): one capture listener that looks at a touched stage thing's id.
 * Not this: "whisper of the heart", "whisper network meaning", "leave a message for mom".
 */
import { refOf } from './label.js';
import { whisperOf, findThingId, addWhisper, takeWhispers, loadList, saveList } from '../lib/stage-pack-c.js';

let armed = false;
function toast(msg) {
  try {
    const d = document.createElement('div');
    d.setAttribute('role', 'status');
    d.className = 'void-whisper';
    d.style.cssText = 'position:fixed;left:50%;bottom:18%;transform:translateX(-50%);max-width:80vw;padding:10px 14px;border-radius:12px;background:rgba(20,20,30,.92);color:#fff;font-size:15px;z-index:9999;pointer-events:none';
    d.textContent = 'A whisper: ' + msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 6000);
  } catch (_) {}
}

/** surfaces a thing's whispers once, on the first touch of it after they were left */
export function decorate(st) {
  if (armed || typeof document === 'undefined') return;
  armed = true;
  document.addEventListener('pointerdown', (e) => {
    const n = e.target && e.target.closest && e.target.closest('.thing[data-id], .side-card[data-of]');
    const id = n && (n.dataset.id || n.dataset.of);
    if (!id) return;
    const { shown, rest } = takeWhispers(loadList('whispers'), id);
    if (!shown.length) return;
    saveList('whispers', rest);
    for (const w of shown) { toast(w.text); try { st.say('a whisper: ' + w.text); } catch (_) {} }
  }, true);
}

function run(text, api) {
  const { showPage, esc } = api;
  const w = whisperOf(text);
  if (!w) return 'none';
  const st = api.stage;
  const ref = refOf(w.target.replace(/^(?:the|my)\s+/, ''), false);
  const id = findThingId(st && st.things ? st.things() : {}, ref, st && st.selected ? st.selected() : '');
  showPage((el) => {
    if (!id) { el.innerHTML = '<h2>No such thing on the stage</h2><p>' + esc('I could not find "' + w.target + '" on the stage, so the whisper was not left. Make it first, then try again.') + '</p>'; return; }
    saveList('whispers', addWhisper(loadList('whispers'), id, w.text));
    el.innerHTML = '<h2>Whisper left</h2><p>' + esc('On ' + w.target + '. It shows once, the next time you touch it.') + '</p><div class="src">Kept on this device only</div>';
  });
  return 'whisper-network';
}

export default {
  name: 'whisper-network',
  examples: ['leave a whisper on the clock: remember milk', 'leave a whisper on the note: call back'],
  nearMisses: ['whisper of the heart', 'whisper network meaning', 'leave a message for mom', 'leave a whisper'],
  match(lower, text) { return !!whisperOf(text); },
  decorate,
  run,
};
