/**
 * time-capsule skill (owner, 2026-10-18): "seal a time capsule until 2027-01-01" or "seal a capsule for the word aurora" snapshots
 * the things on the stage into this browser (a2m.void.capsule.v1). It stays invisible: a date capsule opens once the date has passed
 * ("open my capsules"), a word capsule when the word is typed ("open the capsule aurora"). The word is kept only as a SHA-256 hash.
 * Device-local, nothing sent. Not this: "what is a time capsule", "time capsule song", "capsule wardrobe".
 */
import { capsuleOf, hashWord, snapshotOf, newCapsule, openable, thingLine, restorable, loadList, saveList } from '../lib/stage-pack-c.js';

async function run(text, api) {
  const { showPage, esc } = api;
  const c = capsuleOf(text);
  if (!c) return 'none';
  const st = api.stage;
  if (c.op === 'seal') {
    const snap = snapshotOf(st && st.things ? st.things() : {});
    let msg = snap.error, title = 'Nothing sealed';
    if (!snap.error) {
      if (c.until && c.until <= Date.now()) msg = 'That date has already come. Pick one in the future.';
      else {
        const cap = newCapsule(c.word ? { hash: await hashWord(c.word) } : { until: c.until }, snap.things);
        if (saveList('capsule', [...loadList('capsule'), cap].slice(-10))) { title = 'Capsule sealed'; msg = snap.things.length + (snap.things.length === 1 ? ' thing' : ' things') + ' sealed. ' + (c.word ? 'Say "open the capsule <the word>" to open it. The word itself is not kept.' : 'It opens on ' + new Date(c.until).toLocaleDateString() + ': say "open my capsules".'); }
        else msg = 'This browser would not keep the capsule.';
      }
    }
    showPage((el) => { el.innerHTML = '<h2>' + esc(title) + '</h2><p>' + esc(msg) + '</p><div class="src">Kept on this device only</div>'; });
    return 'time-capsule';
  }
  const caps = loadList('capsule');
  const hash = c.word ? await hashWord(c.word) : '';
  const open = caps.filter((x) => openable(x, { hash }));
  const waiting = c.op === 'due' ? caps.filter((x) => x.until && !openable(x)) : [];
  showPage((el) => {
    if (!open.length) {
      el.innerHTML = '<h2>Nothing to open</h2><p>' + esc(c.op === 'due' ? (waiting.length ? waiting.length + (waiting.length === 1 ? ' capsule is' : ' capsules are') + ' still sealed; the earliest opens on ' + new Date(Math.min(...waiting.map((w) => w.until))).toLocaleDateString() + '.' : 'No capsule is waiting.') : 'No capsule answers to that word.') + '</p>';
      return;
    }
    el.innerHTML = open.map((cap, n) => '<h2>Capsule sealed ' + esc(new Date(cap.sealed).toLocaleDateString()) + '</h2><ul style="margin:6px 0 0 18px;padding:0">'
      + cap.things.map((th) => '<li>' + esc(thingLine(th)) + '</li>').join('') + '</ul><p><a href="#" class="cap-back" data-n="' + n + '">Put these back on the stage</a></p>').join('')
      + '<div class="src">Source: this device · a2m.void.capsule.v1</div>';
    el.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a.cap-back'); if (!a || !st) return;
      e.preventDefault();
      const cap = open[+a.dataset.n], live = st.things();
      for (const th of restorable(cap, (t, i) => 'cap' + Date.now().toString(36) + i)) live[th.id] = th;
      try { st.save(); st.render(); } catch (_) {}
      a.textContent = 'Put back.';
    });
  });
  return 'time-capsule';
}

export default {
  name: 'time-capsule',
  examples: ['seal a time capsule until 2027-01-01', 'seal a capsule for the word aurora', 'open the capsule aurora', 'open my capsules'],
  nearMisses: ['what is a time capsule', 'time capsule song', 'capsule wardrobe', 'seal the envelope'],
  match(lower, text) { return !!capsuleOf(text); },
  run,
};
