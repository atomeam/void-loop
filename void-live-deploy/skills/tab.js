/**
 * tab skill — the card the Verse extension's side panel shows for the tab you point it at (Alt+Shift+V): its title,
 * address and selection, a draft box with "put in the page", "draft for me" (reply, summary, notes, rewrite,
 * proposal: sent to Verse once, said so on the card), and a step for Verse to propose (fill / click, up to three; the
 * extension's panel asks Yes / No and acts only on a site you allowed). Moved out of void.html in cleanup step 6. The
 * page keeps the extension bridge itself (the messages, what was read, drafting into the page, the execution record);
 * the card reaches it through stageApi.ext. The card never serializes: it is not in the saved stage, /api/mine or undo.
 */

import { contentOf, suggestionHtml } from '../lib/context-check.js';

function mount(th, stageApi) {
  const bridge = stageApi.ext, ext = bridge.state; // the page's extension bridge: the tab, the draft, what was sent, and its senders
  const t = ext.tab;
  const el = document.createElement('div');
  el.className = 'thing tab-card';
  el.dataset.id = th.id;
  el.style.cssText += ';left:' + th.x + 'px;top:' + th.y + 'px;width:320px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:rgba(12,12,12,0.92);font-size:13px';
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';
  const head = document.createElement('div');
  head.style.cssText = 'color:var(--muted);font-size:12px;margin-bottom:6px;cursor:grab';
  head.textContent = 'this tab · stays in this browser';
  el.appendChild(head);
  const body = document.createElement('div');
  if (t) {
    let host = ''; try { host = new URL(t.url).host; } catch (_) {}
    // the page it read, as it looked: its title on a browser tab, its address in a bar (a lock for https), the selection in highlighter
    const lock = /^https:/i.test(t.url || '') ? '<svg class="tab-lock" viewBox="0 0 12 14" width="10" height="12" aria-label="secure"><rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor"/><path d="M3.5 6V4.2a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' : '';
    body.innerHTML = '<div class="tab-title">' + bridge.esc(t.title || host || t.url) + '</div>'
      + '<div class="tab-host">' + lock + bridge.esc(host) + '</div>'
      + (t.selection ? '<blockquote class="tab-sel"><mark>' + bridge.esc(t.selection) + '</mark></blockquote>' : '<p style="margin:0 0 8px;color:var(--muted)">nothing selected</p>')
      + (t.readable ? '' : '<p style="margin:0 0 8px;color:var(--muted)">Chrome keeps extensions out of this page: only its title and address came through.</p>')
      // the context check (asked by Verse): what the page mostly is, from the extension's counts, and one skill for it (lib/context-check.js)
      + suggestionHtml(bridge.esc, contentOf(t.content))
      + '<textarea class="tab-draft" rows="3" placeholder="a draft for the page" style="width:100%;box-sizing:border-box;background:transparent;color:inherit;border:1px solid var(--line);border-radius:8px;padding:6px;font:inherit"></textarea>'
      // draft for me (sends it to Verse): the title, address and selection go to Verse's answer engine once (mode draft, lib/draft.js), the draft
      // comes back into the box above for "put in the page" or copy, and the card says what left. What is in the box goes along as a note.
      + '<div class="tab-ask" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;color:var(--muted);font-size:12px">draft for me:'
      + ['reply', 'summary', 'notes', 'rewrite', 'proposal'].map((k) => '<button type="button" class="tab-ask-' + k + ' vcopy" data-intent="' + k + '"' + (k === 'rewrite' && !t.selection ? ' disabled title="select the text to rewrite first"' : '') + '>' + k + '</button>').join('')
      + '<span>(sends it to Verse)</span></div>'
      + '<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><button type="button" class="tab-put vcopy">put in the page</button><span class="tab-said" style="color:var(--muted);font-size:12px">'
      + bridge.esc(t.field ? 'goes into: ' + (t.field.name || t.field.tag) : 'goes into the box you click on the page') + '</span></div>'
      + '<div class="tab-foot" style="color:var(--muted);font-size:11px;margin-top:6px"></div>'
      + '<div style="display:flex;gap:6px;margin-top:10px"><input class="tab-step" placeholder="a step for Verse: fill Reply with … / click Save (up to 3, split by ;)" style="flex:1;min-width:0;background:transparent;color:inherit;border:1px solid var(--line);border-radius:8px;padding:5px 6px;font:inherit"><button type="button" class="tab-propose vcopy">propose</button></div>'
      + '<div class="tab-act-said" style="color:var(--muted);font-size:12px;margin-top:4px">Verse acts only on a site you allowed, and only after your yes in the panel.</div>';
    const put = body.querySelector('.tab-put'), ta = body.querySelector('.tab-draft'), said = body.querySelector('.tab-said'), foot = body.querySelector('.tab-foot');
    const footLine = () => { foot.textContent = ext.sent ? 'Not saved. ' + ext.sent + ' You press send on the page yourself.' : 'Not saved, not sent anywhere. You press send on the page yourself.'; };
    ta.value = ext.draft; footLine();
    ta.addEventListener('input', () => { ext.draft = ta.value; });
    put.addEventListener('click', async () => { if (!ta.value.trim()) { said.textContent = 'write the draft first'; return; } said.textContent = 'putting it in…'; said.textContent = bridge.draftSaid(await bridge.draft(ta.value)); });
    body.querySelectorAll('.tab-ask button').forEach((b) => b.addEventListener('click', async () => {
      const intent = b.dataset.intent, tab = ext.tab; if (!tab) return;
      if (intent === 'proposal') return bridge.proposalFromTab(tab, said, footLine);
      said.textContent = 'asking Verse for a ' + intent + '…'; // ellipsis-ok: progress text, not a cut
      let j = null;
      try {
        const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'draft', intent, title: tab.title, url: tab.url, selection: tab.selection, note: ta.value.trim().slice(0, 300) }) });
        if (r.ok || r.status === 400 || r.status === 429) j = await r.json();
      } catch (_) {}
      if (!ta.isConnected) return; // the card was redrawn or closed meanwhile
      ext.sent = 'The title, address and selection were sent to a-to-mind.com for a ' + intent + ' draft · not kept there.'; footLine();
      if (!j || !j.draft) { said.textContent = (j && j.note) || 'Verse couldn’t draft just now. Try again in a moment.'; return; }
      ext.draft = j.draft; ta.value = j.draft; ta.rows = Math.min(12, Math.max(3, (j.draft.match(/\n/g) || []).length + 2));
      const notes = [j.model === 'rules' && 'by rule, no model just now', j.masked && 'keys in the text were masked', j.cut && 'the selection was cut'].filter(Boolean);
      said.textContent = intent + ' from Verse' + (notes.length ? ' (' + notes.join('; ') + ')' : '') + ' · put it in the page, or copy it';
      // B3 joined to the draft: a reply for the box you were in becomes a proposed step, the same Yes / No card in the panel
      // and the same record; the panel shows it only on a site on your list (off the list it says nothing: copy as before)
      if (intent === 'reply' && tab.field) bridge.propose({ action: 'fill', label: bridge.boxName(tab.field), box: 'mine', text: j.draft, auto: true });
    }));
    const stepIn = body.querySelector('.tab-step'), actSp = body.querySelector('.tab-act-said');
    stepIn.value = ext.stepText || ''; stepIn.addEventListener('input', () => { ext.stepText = stepIn.value; }); // a redraw of the stage keeps what you typed
    // the context check's suggestion: a text page presses the card's own summary button; a picture or table page runs the ask it names
    // (the card is a thing on the stage, not an answer page, so the page's data-ask handler does not reach it: the summon event does, void.html)
    { const sg = body.querySelector('.tab-context a'); if (sg) sg.addEventListener('click', (e) => { e.preventDefault();
      if (sg.dataset.intent) { const b = body.querySelector('.tab-ask-' + sg.dataset.intent); if (b && !b.disabled) b.click(); return; }
      if (sg.dataset.ask) document.dispatchEvent(new CustomEvent('void:summon', { detail: sg.dataset.ask })); }); }
    body.querySelector('.tab-propose').addEventListener('click', () => { const st = bridge.stepsOf(stepIn.value); if (!Array.isArray(st)) { actSp.textContent = bridge.ACT_WHY[st || 'bad-step']; return; } actSp.textContent = bridge.propose(st) ? 'asking you in the panel…' : bridge.DRAFT_WHY['no-panel']; });
  }
  el.appendChild(body);
  body.addEventListener('pointerdown', (e) => { if (e.target.closest('textarea, input, button, blockquote')) e.stopPropagation(); });
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export default {
  name: 'tab',
  examples: [],
  nearMisses: [],
  match() { return false; }, // nothing to ask: the extension's panel puts the card up
  async run() { return 'none'; },
  stageKinds: { tab: { mount } },
};
