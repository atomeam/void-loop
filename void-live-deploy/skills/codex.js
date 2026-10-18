/**
 * codex skill - the Living Codex (owner, 2026-10-18): "file this in the codex" keeps the card or answer you are looking at
 * (or your last one) in this browser; "open the codex on space" and "what have I collected about space" search what you filed,
 * grouped by skill family (skills/families.json). Device-local: localStorage a2m.void.codex.v1, nothing sent, nothing shows until asked.
 * Not this: "codex gigas", "the da vinci codex", "what is the codex alimentarius".
 */
import { codexOf, codexItem, fileItem, searchCodex, groupByFamily, loadList, saveList } from '../lib/stage-pack-c.js';

/** the card on screen (or, if it was closed by the ask, the last answer in the loop log) as { ask, title, text, skill } */
function currentCard() {
  try {
    const els = document.querySelectorAll('.vpage'), el = els[els.length - 1]; // the newest card (an older one can still be fading out)
    if (el && el._ask && !/codex/i.test(el._ask)) {
      const h = el.querySelector('h1,h2,h3');
      return { ask: el._ask, title: h ? h.textContent : '', text: el.innerText, skill: (el.dataset && el.dataset.skill) || '' };
    }
  } catch (_) {}
  try {
    const log = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]');
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i];
      if (e && e.ask && /^skill:/.test(String(e.note || '')) && !/codex/i.test(e.ask)) return { ask: e.ask, title: e.ask, text: '', skill: String(e.note).slice(6) };
    }
  } catch (_) {}
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const c = codexOf(text);
  if (!c) return 'none';
  if (c.op === 'file') {
    const item = codexItem(currentCard() || {});
    const ok = item && saveList('codex', fileItem(loadList('codex'), item));
    showPage((el) => {
      el.innerHTML = ok
        ? '<h2>Filed in the codex</h2><p>' + esc(item.title || item.ask) + '</p><div class="sub">' + esc(item.skill ? 'from ' + item.skill + ' · ' : '') + 'kept on this device only. Say "open the codex" to browse it.</div>'
        : '<h2>Nothing to file</h2><p>' + esc(item ? 'This browser would not keep it.' : 'Ask something first, then say "file this in the codex".') + '</p>';
    });
    return 'codex';
  }
  let families = null;
  try { const r = await fetch('/skills/families.json'); if (r.ok) families = await r.json(); } catch (_) {}
  const found = searchCodex(loadList('codex'), c.topic);
  const groups = groupByFamily(found, families);
  showPage((el) => {
    const head = c.topic ? 'The codex on ' + c.topic : 'The codex';
    if (!found.length) {
      el.innerHTML = '<h2>' + esc(head) + '</h2><p>' + esc(c.topic ? 'You have filed nothing about "' + c.topic + '" yet.' : 'Nothing is filed yet.') + '</p><div class="sub">Get an answer, then say "file this in the codex".</div>';
      return;
    }
    el.innerHTML = '<h2>' + esc(head) + '</h2><div class="sub">' + found.length + (found.length === 1 ? ' item' : ' items') + ' · filed on this device</div>'
      + '<input class="codex-q" type="search" placeholder="search the codex" value="' + esc(c.topic) + '" aria-label="search the codex" style="width:100%;margin:8px 0">'
      + groups.map((g) => '<h3 style="margin:12px 0 4px">' + esc(g.family) + '</h3><ul class="codex-list" style="margin:0 0 0 18px;padding:0">'
        + g.items.map((x) => '<li data-hay="' + esc((x.ask + ' ' + x.title + ' ' + x.text).toLowerCase()) + '" style="margin:6px 0"><b>' + esc(x.title || x.ask) + '</b><br><span style="opacity:.75">' + esc(x.text.slice(0, 160)) + '</span></li>').join('') + '</ul>').join('')
      + '<div class="src">Source: this device · a2m.void.codex.v1</div>';
    const q = el.querySelector('.codex-q');
    if (q) q.addEventListener('input', () => { const w = q.value.toLowerCase().split(/\s+/).filter(Boolean); for (const li of el.querySelectorAll('li[data-hay]')) li.hidden = !w.every((x) => li.dataset.hay.includes(x)); });
  });
  return 'codex';
}

export default {
  name: 'codex',
  examples: ['file this in the codex', 'open the codex on space', 'what have I collected about space', 'open the codex'],
  nearMisses: ['codex gigas', 'the da vinci codex', 'what is the codex alimentarius', 'codex vinci meaning'],
  match(lower, text) { return !!codexOf(text); },
  run,
};
