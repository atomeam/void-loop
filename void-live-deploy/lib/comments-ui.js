// The comments box under a published generator and under /image/ (functions/api/comments.js; rules in lib/comments.js). DOM only; text is put
// in as text, never HTML. mountComments(el, thread, { de }) draws the list, a name, the comment, the sum and the hidden field a bot fills.
import { NAME_MAX, TEXT_MAX } from './comments.js';
export function mountComments(el, thread, { de = false } = {}) {
  if (!el) return; const d = el.ownerDocument, mk = (tag, props = {}) => Object.assign(d.createElement(tag), props);
  const W = de ? { h: 'Kommentare', name: 'Name (optional)', text: 'Dein Kommentar', send: 'Senden', report: 'Melden', reported: 'Gemeldet', none: 'Noch keine Kommentare.', off: 'Kommentare brauchen Internet.', reportQ: 'Diesen Kommentar melden?', sum: 'Kurze Prüfung, ob du ein Mensch bist:' }
    : { h: 'Comments', name: 'Name (optional)', text: 'Your comment', send: 'Post', report: 'Report', reported: 'Reported', none: 'No comments yet.', off: 'Comments need the internet.', reportQ: 'Report this comment as rude or spam? Three reports hide it until it is looked at.', sum: 'A quick check that you are a person:' };
  const h = mk('h2', { textContent: W.h }), list = mk('ul', { className: 'cm-list' }), form = mk('form', { className: 'cm-form' }), note = mk('p', { className: 'note' }); note.setAttribute('role', 'status');
  const uid = 'cm' + Math.random().toString(36).slice(2, 7);
  const nameL = mk('label', { textContent: W.name, htmlFor: uid + 'n' }), name = mk('input', { id: uid + 'n', maxLength: NAME_MAX, autocomplete: 'nickname' });
  const textL = mk('label', { textContent: W.text, htmlFor: uid + 't' }), text = mk('textarea', { id: uid + 't', maxLength: TEXT_MAX, rows: 2, required: true });
  const sumL = mk('label', { htmlFor: uid + 's' }), sum = mk('input', { id: uid + 's', inputMode: 'numeric', autocomplete: 'off', required: true }); sum.style.width = '90px';
  const trap = mk('input', { name: 'website', tabIndex: -1, autocomplete: 'off' }); trap.setAttribute('aria-hidden', 'true'); trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px';
  const send = mk('button', { type: 'submit', textContent: W.send, className: 'go' });
  form.append(nameL, name, textL, text, sumL, sum, trap, send);
  const style = mk('style', { textContent: '.cm-list{list-style:none;padding:0;margin:8px 0}.cm-list li{padding:8px 0;border-top:1px solid var(--line,#8884)}.cm-list .cm-who{font-size:13px;color:var(--soft,#777);font-weight:600}.cm-list .cm-text{white-space:pre-wrap;overflow-wrap:anywhere}.cm-list button{font-size:12px;min-height:32px;padding:2px 10px}.cm-form{display:grid;gap:6px;margin-top:8px}.cm-form label{font-size:14px;color:var(--soft,#777)}.cm-form .go{justify-self:start}' });
  el.replaceChildren(style, h, list, form, note);
  let token = '';
  async function load() {
    try { const j = await (await fetch('/api/comments?thread=' + encodeURIComponent(thread))).json(); if (!j.ok) throw 0; token = j.check.token; sumL.textContent = W.sum + ' ' + j.check.q;
      list.replaceChildren(...(j.items.length ? j.items.map((c) => { const li = mk('li'), who = mk('div', { className: 'cm-who', textContent: c.name + ' · ' + new Date(c.at).toLocaleDateString() }), t = mk('div', { className: 'cm-text', textContent: c.text }), r = mk('button', { type: 'button', textContent: W.report });
        r.setAttribute('aria-label', W.report + ': ' + c.text.slice(0, 40)); r.addEventListener('click', async () => { if (!confirm(W.reportQ)) return; try { await fetch('/api/comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ act: 'report', id: c.id }) }); } catch (_) {} r.textContent = W.reported; r.disabled = true; });
        li.append(who, t, r); return li; }) : [mk('li', { className: 'note', textContent: W.none })]));
    } catch (_) { list.replaceChildren(mk('li', { className: 'note', textContent: W.off })); form.hidden = true; }
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); send.disabled = true; note.textContent = '';
    try { const j = await (await fetch('/api/comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ act: 'post', thread, name: name.value, text: text.value, answer: sum.value, token, website: trap.value }) })).json();
      if (j.ok) { text.value = ''; sum.value = ''; await load(); } else note.textContent = j.error || '…'; } catch (_) { note.textContent = W.off; }
    send.disabled = false;
  });
  load();
}
