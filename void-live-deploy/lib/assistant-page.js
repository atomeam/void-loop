// The assistant pages (/assistant/ and its lane pages; lib/ai-sites.js): one chat engine, switched per page. Chats, notes, instructions, prompts and characters
// are kept on this device (lib/ai-ui.js); a reply is asked from Verse's free models (functions/api/answer.js mode 'assistant'), and the sources page asks the
// stage's own answer route, which cites encyclopedia sources. Text tools run here (lib/assistant-core.js) but for translation (Verse's translator). JavaScript
// in a reply runs in a Worker made for it, with no page access, stopped after 3 seconds. A chat shared as a link is packed into the address, never uploaded.
import { newChat, cleanChat, sortChats, searchChats, toMarkdown, toJson, fromJson, shareCode, fromShareCode, b64u, unb64u, templateOf, countText, summarize, rewrite, codeBlocks, followUps, titleOf, STYLE_NAMES } from '/lib/assistant-core.js';
import { mdToHtml } from '/lib/hub-core.js';
import { $, t, isDe, boot, load, save, forget, askModel, shareLink, download, el, btn, copy } from '/lib/ai-ui.js';

const KEYS = { chats: 'a2m.void.assistant.chats', priv: 'a2m.void.assistant.private', src: 'a2m.void.assistant.sources', notes: 'a2m.void.assistant.notes', instr: 'a2m.void.assistant.instructions', prompts: 'a2m.void.assistant.prompts', chars: 'a2m.void.assistant.characters', keepPriv: 'a2m.void.assistant.private.keep', voice: 'a2m.void.assistant.voice' };
const say = (s, bad) => { const n = $('status'); if (n) { n.textContent = s; n.classList.toggle('bad', !!bad); } };

export function start(page) {
  boot(say);
  const emptyText = $('emptyNote') ? $('emptyNote').textContent : '';
  const P = page, store = P === 'private' ? KEYS.priv : P === 'sources' ? KEYS.src : KEYS.chats;
  let quickStyle = 'default';
  let keep = P !== 'private' || load(KEYS.keepPriv, true) !== false;
  let chats = (keep ? load(store, []) : []).map(cleanChat).filter(Boolean), cur = null, ctrl = null, fileText = '', shared = null;
  const persist = () => { if (keep) save(store, chats.slice(0, 200)); drawList(); stats(); };
  const current = () => chats.find((c) => c.id === cur) || null;
  const lastReply = () => { const c = current(); const m = c && [...c.messages].reverse().find((x) => x.role === 'assistant'); return m ? m.text : ''; };

  // ---- the chat list
  function drawList() {
    const q = $('find').value.trim(), ff = $('folderFilter') ? $('folderFilter').value : '', ul = $('chats'); ul.replaceChildren();
    const list = q ? searchChats(chats, q).map((x) => [x.chat, x.snippet]) : sortChats(chats).map((c) => [c, '']);
    for (const [c, snip] of list.filter(([c]) => !ff || c.folder === ff)) {
      const a = el('a', { href: '#', 'aria-current': c.id === cur ? 'true' : 'false', title: c.title, on: { click: (e) => { e.preventDefault(); open(c.id); } } }, (c.pinned ? '📌 ' : '') + c.title);
      const li = el('li', {}, a, btn(c.pinned ? 'Unpin' : 'Pin', () => { c.pinned = !c.pinned; persist(); }, { 'aria-label': t(c.pinned ? 'Unpin' : 'Pin') + ' ' + c.title }), btn('Rename', () => { const n = prompt(t('Name of the chat'), c.title); if (n) { c.title = n.slice(0, 80); persist(); } }, { 'aria-label': t('Rename') + ' ' + c.title, title: t('Rename') }), btn('Delete', () => { if (confirm(t('Delete this chat?'))) { chats = chats.filter((x) => x.id !== c.id); if (cur === c.id) cur = null; persist(); draw(); } }, { 'aria-label': t('Delete') + ' ' + c.title }));
      if (P !== 'workspace') for (const b of li.querySelectorAll('button')) if (/^(Pin|Unpin|Anheften|Lösen|Rename|Umbenennen)$/.test(b.textContent)) b.remove();
      ul.append(li); if (snip) ul.append(el('li', { class: 'note', style: 'padding:0 8px 6px' }, snip));
    }
    if ($('folderFilter')) { const fs = [...new Set(chats.map((c) => c.folder).filter(Boolean))].sort(); const keepV = $('folderFilter').value; $('folderFilter').replaceChildren(el('option', { value: '' }, t('Every folder')), ...fs.map((f) => el('option', { value: f }, f))); $('folderFilter').value = keepV; $('folderList').replaceChildren(...fs.map((f) => el('option', { value: f }))); }
  }
  function stats() { if (!$('stats')) return; const msgs = chats.reduce((a, c) => a + c.messages.length, 0), words = chats.reduce((a, c) => a + c.messages.reduce((b, m) => b + countText(m.text).words, 0), 0); $('stats').textContent = chats.length + ' ' + t('chats') + ' · ' + msgs + ' ' + t('messages') + ' · ' + words + ' ' + t('words'); }

  // ---- the thread
  function msgNode(m, i) {
    const n = el('div', { class: 'msg ' + m.role }, el('span', { class: 'who' }, m.role === 'user' ? t('You') : t('Verse')));
    if (m.role === 'user') { n.append(m.text); if (!shared && current() && i >= current().messages.length - 2) n.append(el('div', { class: 'tools' }, btn('Edit', () => { const c = current(); $('box').value = m.text; c.messages = c.messages.slice(0, i); persist(); draw(); $('box').focus(); }))); return n; }
    const body = el('div', { html: mdToHtml(m.text) }); // mdToHtml escapes every text and keeps only http(s) links
    if (m.sources && m.sources.length) linkCites(body, m.sources);
    n.append(body);
    for (const pre of body.querySelectorAll('pre')) { const code = pre.textContent, lang = (pre.querySelector('code') || {}).dataset?.lang || ''; const bar = el('div', { class: 'tools' }, btn('Copy the code', () => copy(code, say))); if (/^(js|javascript|mjs)?$/i.test(lang) && /console\.log|return|function|=>/.test(code)) bar.append(btn('Run the JavaScript', () => runJs(code, bar))); pre.after(bar); }
    if (m.sources && m.sources.length) n.append(el('ol', { class: 'note' }, ...m.sources.map((s) => el('li', {}, el('a', { href: s.url, rel: 'noopener nofollow', target: '_blank' }, s.title)))));
    const tools = el('div', { class: 'tools' }, btn('Copy', () => copy(m.text, say)));
    if ('speechSynthesis' in window) tools.append(btn('Read aloud', () => speak(m.text)));
    n.append(tools); return n;
  }
  // a citation "[2]" in an answer becomes a link to its source (text nodes only, so nothing else in the answer changes)
  function linkCites(root, sources) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), hits = []; let n; while ((n = w.nextNode())) if (/\[\d\]/.test(n.nodeValue) && !n.parentNode.closest('a,code,pre')) hits.push(n);
    for (const node of hits) { const parts = node.nodeValue.split(/(\[\d\])/); node.replaceWith(...parts.map((x) => { const d = /^\[(\d)\]$/.exec(x), s = d && sources[+d[1] - 1]; return s ? el('a', { href: s.url, rel: 'noopener nofollow', target: '_blank', title: s.title }, x) : x; })); }
  }
  function draw() {
    const th = $('thread'), c = shared || current(); th.replaceChildren();
    if (shared) th.append(el('p', { class: 'note' }, t('A shared chat. Keep a copy to continue it.'), ' ', btn('Keep a copy', () => { const k = cleanChat({ ...shared, id: undefined }); k.id = newChat().id; chats.unshift(k); cur = k.id; shared = null; history.replaceState(null, '', location.pathname); persist(); draw(); say(t('Kept as a new chat.')); })));
    if (!c || !c.messages.length) { th.append(el('p', { class: 'empty' }, emptyText)); }
    else c.messages.forEach((m, i) => th.append(msgNode(m, i)));
    $('again').disabled = !c || shared || !c.messages.some((m) => m.role === 'user');
    if ($('model') && c && !shared) $('model').value = c.model || 'verse'; if ($('style') && c && !shared) $('style').value = c.style || 'default'; if ($('folder')) $('folder').value = (c && c.folder) || '';
    if ($('charSel') && c) $('charSel').value = c.character || '';
    if (P === 'sources') drawSources(c);
    th.lastElementChild && th.lastElementChild.scrollIntoView({ block: 'nearest' });
  }
  function open(id) { shared = null; cur = id; drawList(); draw(); }
  function fresh() { const c = newChat({ style: $('style') ? $('style').value : P === 'voice' ? 'warm' : 'default', model: $('model') ? $('model').value : 'verse' }); return c; }

  // ---- sending
  const instructions = () => { const c = current(), own = load(KEYS.instr, ''), ch = c && c.character ? (load(KEYS.chars, []).find((x) => x.name === c.character) || {}).text : ''; return [own, ch].filter(Boolean).join('\n').slice(0, 800); };
  async function send(text, again = false) {
    if (shared) return; text = String(text || '').trim();
    if (!again && !text) return;
    if (!navigator.onLine) { say(t('You are offline. Your message stays in the box; notes, chats and the text tools work offline.'), true); return; }
    let c = current(); if (!c) { c = fresh(); chats.unshift(c); cur = c.id; }
    if (!again) { const full = fileText ? text + '\n\n---\n' + fileText : text; c.messages.push({ role: 'user', text: full.slice(0, 8000), at: Date.now() }); if (c.messages.length === 1) c.title = titleOf(c.messages); $('box').value = ''; fileText = ''; if ($('file')) $('file').value = ''; }
    else while (c.messages.length && c.messages[c.messages.length - 1].role === 'assistant') c.messages.pop();
    if ($('model')) c.model = $('model').value; if ($('style')) c.style = $('style').value; if (P === 'quick') c.style = quickStyle; if ($('folder')) c.folder = $('folder').value.trim();
    c.at = Date.now(); persist(); draw();
    const th = $('thread'); th.append(el('div', { class: 'msg assistant', id: 'wait' }, el('span', { class: 'who' }, t('Verse')), t('Thinking…')));
    $('send').disabled = true; $('stop').disabled = false; ctrl = new AbortController(); say(t('Thinking…'));
    let r;
    if (P === 'sources') r = await askSources(c, ctrl.signal);
    else r = await askModel({ messages: c.messages, model: c.model, style: P === 'voice' ? 'warm' : P === 'quick' && $('longer') && $('longer').checked ? 'long' : c.style, instructions: instructions() }, ctrl.signal);
    $('send').disabled = false; $('stop').disabled = true; ctrl = null; const w = $('wait'); if (w) w.remove();
    if (r.reply) { c.messages.push({ role: 'assistant', text: r.reply, at: Date.now(), ...(r.sources ? { sources: r.sources } : {}) }); persist(); draw(); say(t('Enter sends, Shift+Enter starts a new line.')); if (P === 'voice' && $('readAloud').checked) speak(r.reply, () => { if ($('handsFree').checked) listen(); }); }
    else { say(r.say, true); if (!again) { const last = c.messages.pop(); if (last && !$('box').value) $('box').value = last.text; persist(); draw(); } }
  }
  async function askSources(c, signal) {
    // the stage's answer route takes one question of up to 300 characters: a follow-up carries the subject of the chat's first question along
    const q = c.messages[c.messages.length - 1].text, first = c.messages.find((m) => m.role === 'user').text;
    const ask = (c.messages.filter((m) => m.role === 'user').length > 1 ? 'About ' + first.slice(0, 120) + ': ' + q : q).slice(0, 300);
    try { const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, signal, body: JSON.stringify({ ask }) }); const j = await r.json().catch(() => ({}));
      return j && j.answer ? { reply: j.answer, sources: (j.sources || []).filter((s) => /^https:\/\//.test(s.url)).map((s) => ({ title: s.title, url: s.url })) } : { reply: null, say: (j && j.note) || t('The model did not answer.') }; }
    catch (e) { return { reply: null, say: e && e.name === 'AbortError' ? t('Stopped.') : t('The model did not answer.') }; }
  }
  function drawSources(c) {
    const last = c && [...c.messages].reverse().find((m) => m.role === 'assistant'), q = c && [...c.messages].reverse().find((m) => m.role === 'user');
    $('srcCards').replaceChildren(...((last && last.sources) || []).map((s, i) => el('li', {}, el('strong', {}, '[' + (i + 1) + '] '), el('a', { href: s.url, rel: 'noopener nofollow', target: '_blank' }, s.title), el('div', { class: 'note' }, new URL(s.url).hostname))));
    if (last && !(last.sources || []).length) $('srcCards').append(el('li', { class: 'note' }, t('No source matched: answered from the model\'s own knowledge.')));
    $('follow').replaceChildren(...followUps(q ? q.text.replace(/^About [^:]*: /, '') : '').map((f) => btn(f, () => send(f))));
  }
  $('composer').addEventListener('submit', (e) => { e.preventDefault(); send($('box').value); });
  $('box').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send($('box').value); } });
  $('stop').onclick = () => { if (ctrl) ctrl.abort(); };
  $('again').onclick = () => send('', true);
  $('newChat').onclick = () => { shared = null; cur = null; history.replaceState(null, '', location.pathname); drawList(); draw(); $('box').focus(); };
  $('find').addEventListener('input', drawList);
  if ($('folderFilter')) $('folderFilter').onchange = drawList;
  if ($('folder')) $('folder').onchange = () => { const c = current(); if (c) { c.folder = $('folder').value.trim(); persist(); } };
  for (const id of ['model', 'style']) if ($(id)) $(id).onchange = () => { const c = current(); if (c) { c[id] = $(id).value; persist(); } };
  if ($('tpl')) $('tpl').onchange = () => { const tp = templateOf($('tpl').value); if (tp) { $('box').value = tp[2]; $('box').focus(); const i = tp[2].indexOf('['); if (i >= 0) $('box').setSelectionRange(i, tp[2].indexOf(']', i) + 1); } $('tpl').value = ''; };
  if ($('file')) $('file').onchange = async () => { const f = $('file').files[0]; if (!f) return; const txt = await f.text().catch(() => ''); if (!txt || /\u0000/.test(txt.slice(0, 2000))) { fileText = ''; say(t('The file is not text this page can read.'), true); return; } fileText = '[' + f.name + ']\n' + txt.slice(0, 6000); say(t('Added') + ': ' + f.name + ' (' + countText(txt).words + ' ' + t('words') + ')'); };

  // ---- running JavaScript from a reply: a Worker of its own (no page, no storage of this site's), its console written back, stopped after 3 s
  function runJs(code, bar) {
    const out = el('div', { class: 'run-out' }, t('Loading…')); const old = bar.nextElementSibling; if (old && old.classList.contains('run-out')) old.remove(); bar.after(out);
    const src = 'const __o=[];const __f=(...a)=>a.map(x=>{try{return typeof x==="string"?x:JSON.stringify(x)}catch(_){return String(x)}}).join(" ");console.log=console.info=console.warn=console.error=(...a)=>__o.push(__f(...a));self.fetch=undefined;self.XMLHttpRequest=undefined;self.WebSocket=undefined;self.importScripts=undefined;'
      + 'self.onmessage=async(e)=>{try{const r=await (async()=>{' + '\n' + code + '\n' + '})();if(r!==undefined)__o.push("→ "+__f(r));}catch(err){__o.push("Error: "+(err&&err.message||err));}postMessage(__o.join("\\n"));};';
    let w; try { w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); } catch (e) { out.textContent = 'Error: ' + e.message; return; }
    const stop = setTimeout(() => { w.terminate(); out.textContent = t('Stopped after 3 seconds.'); }, 3000);
    w.onmessage = (e) => { clearTimeout(stop); w.terminate(); out.textContent = String(e.data || '') || t('(no output)'); };
    w.onerror = (e) => { clearTimeout(stop); w.terminate(); out.textContent = 'Error: ' + (e.message || 'the code did not run'); e.preventDefault(); };
    w.postMessage(0);
  }

  // ---- voice (the voice page; read aloud everywhere a browser can speak)
  let voices = [];
  function speak(text, then) {
    if (!('speechSynthesis' in window)) { if (then) then(); return; }
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(text).replace(/```[\s\S]*?```/g, ' ').replace(/[*_#>`|]/g, '').slice(0, 4000));
    const v = $('voiceSel') && voices.find((x) => x.name === $('voiceSel').value); if (v) u.voice = v; u.lang = v ? v.lang : isDe() ? 'de-DE' : 'en-US'; u.rate = $('rate') ? Number($('rate').value) || 1 : 1;
    if (then) u.onend = then; speechSynthesis.speak(u);
  }
  let rec = null;
  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { say(t('This browser cannot turn speech into text; type instead.'), true); return; }
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = isDe() ? 'de-DE' : (navigator.language || 'en-US'); rec.interimResults = true; rec.continuous = false;
    $('mic').setAttribute('aria-pressed', 'true'); say(t('Listening…'));
    rec.onresult = (e) => { $('box').value = [...e.results].map((r) => r[0].transcript).join(' '); if (e.results[e.results.length - 1].isFinal) { const v = $('box').value; rec.stop(); send(v); } };
    rec.onend = () => { rec = null; $('mic').setAttribute('aria-pressed', 'false'); }; rec.onerror = () => { say(t('This browser cannot turn speech into text; type instead.'), true); };
    try { rec.start(); } catch (_) { rec = null; }
  }
  if (P === 'voice') {
    const vs = load(KEYS.voice, {});
    const fill = () => { voices = speechSynthesis.getVoices(); const s = $('voiceSel'), keepV = s.value || vs.voice || ''; s.replaceChildren(s.firstElementChild || el('option', { value: '' }), ...voices.map((v) => el('option', { value: v.name }, v.name + ' (' + v.lang + ')'))); s.value = keepV; };
    if ('speechSynthesis' in window) { fill(); speechSynthesis.onvoiceschanged = fill; }
    if (vs.rate) $('rate').value = vs.rate; if (vs.hands) $('handsFree').checked = true; if (vs.read === false) $('readAloud').checked = false;
    const keepVoice = () => save(KEYS.voice, { voice: $('voiceSel').value, rate: $('rate').value, hands: $('handsFree').checked, read: $('readAloud').checked });
    for (const id of ['voiceSel', 'rate', 'handsFree', 'readAloud']) $(id).addEventListener('change', keepVoice);
    $('mic').onclick = listen; $('hush').onclick = () => speechSynthesis && speechSynthesis.cancel();
    for (const b of document.querySelectorAll('[data-topic]')) b.onclick = () => send(b.dataset.topic);
  }

  // ---- the quick page's styles: one press picks how Verse answers this chat
  if (P === 'quick') {
    for (const b of document.querySelectorAll('[data-style]')) b.onclick = () => { quickStyle = b.dataset.style; for (const x of document.querySelectorAll('[data-style]')) x.setAttribute('aria-pressed', String(x === b)); const c = current(); if (c) { c.style = quickStyle; persist(); } };
  }

  // ---- the private page: keep or not, burn all
  if (P === 'private') {
    $('keepChats').checked = keep;
    $('keepChats').onchange = () => { keep = $('keepChats').checked; save(KEYS.keepPriv, keep); if (!keep) forget(store); else save(store, chats); };
    $('burn').onclick = () => { if (!confirm(t('Burn every chat on this device? This cannot be undone.'))) return; chats = []; cur = null; forget(store); drawList(); draw(); say(t('Every chat is gone.')); };
  }

  // ---- the workspace: prompt library on "/", characters
  if (P === 'workspace') {
    const drawPrompts = () => { const ps = load(KEYS.prompts, []); $('prompts').replaceChildren(...ps.map((p, i) => el('li', {}, el('div', { class: 't' }, p.name), el('div', { class: 'm' }, p.text), el('div', { class: 'a' }, btn('Insert', () => { $('box').value = p.text; $('box').focus(); }), btn('Delete', () => { ps.splice(i, 1); save(KEYS.prompts, ps); drawPrompts(); }))))); };
    $('pSave').onclick = () => { const name = $('pName').value.trim(), text = $('pText').value.trim(); if (!name || !text) return; const ps = load(KEYS.prompts, []).filter((p) => p.name !== name); ps.unshift({ name: name.slice(0, 40), text: text.slice(0, 1000) }); save(KEYS.prompts, ps.slice(0, 100)); $('pName').value = $('pText').value = ''; drawPrompts(); say(t('Prompt saved.')); };
    const pick = el('ul', { class: 'cards', style: 'min-height:0', id: 'slash', hidden: true }); $('box').after(pick);
    $('box').addEventListener('input', () => { const v = $('box').value; if (/^\/\S*$/.test(v)) { const q = v.slice(1).toLowerCase(), ps = load(KEYS.prompts, []).filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6); pick.replaceChildren(...ps.map((p) => el('li', {}, btn(p.name, () => { $('box').value = p.text; pick.hidden = true; $('box').focus(); })))); pick.hidden = !ps.length; } else pick.hidden = true; });
    const drawChars = () => { const cs = load(KEYS.chars, []), s = $('charSel'), v = s.value; s.replaceChildren(el('option', { value: '' }, t('None')), ...cs.map((c) => el('option', { value: c.name }, c.name))); s.value = v; };
    $('cSave').onclick = () => { const name = $('cName').value.trim(), text = $('cText').value.trim(); if (!name || !text) return; const cs = load(KEYS.chars, []).filter((c) => c.name !== name); cs.unshift({ name: name.slice(0, 40), text: text.slice(0, 800) }); save(KEYS.chars, cs.slice(0, 50)); $('cName').value = $('cText').value = ''; drawChars(); say(t('Character saved.')); };
    $('charSel').onchange = () => { let c = current(); if (!c) { c = fresh(); chats.unshift(c); cur = c.id; } c.character = $('charSel').value; persist(); };
    drawPrompts(); drawChars();
  }

  // ---- text tools
  if ($('toolOut')) {
    const src = () => ({ reply: lastReply(), box: $('box').value, file: fileText, notes: $('notes') ? $('notes').value : '' })[$('toolSrc').value] || '';
    const out = (s) => { $('toolOut').textContent = s; };
    const need = () => { const s = src(); if (!s.trim()) out(t('No text there yet.')); return s.trim() ? s : null; };
    $('tCount').onclick = () => { const s = need(); if (s == null) return; const c = countText(s); out([c.words + ' ' + t('words'), c.chars + ' ' + t('characters'), c.charsNoSpaces + ' ' + t('without spaces'), c.sentences + ' ' + t('sentences'), c.paragraphs + ' ' + t('paragraphs'), c.readMin + ' ' + t('min to read'), c.speakMin + ' ' + t('min to speak')].join(' · ')); };
    $('tSum').onclick = () => { const s = need(); if (s != null) out(summarize(s, 3)); };
    $('tRe').onclick = () => { const s = need(); if (s != null) out(rewrite(s, $('how').value)); };
    $('tTr').onclick = async () => { const s = need(); if (s == null) return; out(t('Translating…')); try { const r = await fetch('/api/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: s.slice(0, 5000), to: $('lang').value }) }); const j = await r.json(); out(j && j.text ? j.text : t('The translator did not answer.')); } catch (_) { out(t('The translator did not answer.')); } };
    $('tAsk').onclick = () => { const s = need(); if (s == null) return; $('box').value = (isDe() ? 'Schreib das klarer und kürzer um, Bedeutung beibehalten:\n\n' : 'Rewrite this so it is clear and short, keeping its meaning:\n\n') + s.slice(0, 3500); $('box').focus(); };
    $('toolCopy').onclick = () => copy($('toolOut').textContent, say); $('toolToBox').onclick = () => { $('box').value = $('toolOut').textContent; $('box').focus(); };
  }
  // ---- instructions and notes
  if ($('instr')) { $('instr').value = load(KEYS.instr, ''); $('instr').addEventListener('input', () => save(KEYS.instr, $('instr').value.slice(0, 800))); }
  if ($('notes')) { $('notes').value = load(KEYS.notes, ''); $('notes').addEventListener('input', () => save(KEYS.notes, $('notes').value)); $('toNotes').onclick = () => { const r = lastReply(); if (!r) return; $('notes').value = ($('notes').value ? $('notes').value + '\n\n' : '') + r; save(KEYS.notes, $('notes').value); $('notesNote').textContent = t('Saved to notes.'); }; }
  // ---- share and export
  const sNote = (s) => { $('shareNote').textContent = s; };
  $('shareChat').onclick = async () => {
    const c = current(); if (!c || !c.messages.length) return; let url = location.origin + location.pathname + '#c=' + shareCode(c);
    try { if ('CompressionStream' in window) { const packed = new Uint8Array(await new Response(new Blob([JSON.stringify({ title: c.title, messages: c.messages.map(({ role, text, sources }) => ({ role, text, ...(sources ? { sources } : {}) })) })]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); url = location.origin + location.pathname + '#z=' + b64u(packed); } } catch (_) { /* the plain code above */ }
    shareLink(url, c.title, sNote);
  };
  $('exMd').onclick = () => { const c = current(); if (c) download((c.title || 'chat').replace(/[^\w -]+/g, '').slice(0, 40) + '.md', toMarkdown(c), 'text/markdown'); };
  $('exJson').onclick = () => download('verse-chats.json', toJson(chats), 'application/json');
  $('imp').onchange = async () => { const f = $('imp').files[0]; if (!f) return; const got = fromJson(await f.text()); const ids = new Set(chats.map((c) => c.id)); for (const c of got) { if (ids.has(c.id)) c.id = newChat().id; chats.push(c); } persist(); sNote(t('Imported') + ': ' + got.length + ' ' + t('chats')); $('imp').value = ''; };
  $('print').onclick = () => print();

  // ---- a chat opened from a link, a template from ?t=
  (async () => {
    const h = location.hash, m = h.match(/^#([cz])=([A-Za-z0-9_-]+)$/);
    if (m) { try { shared = m[1] === 'c' ? fromShareCode(m[2]) : cleanChat(JSON.parse(await new Response(new Blob([unb64u(m[2])]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text())); } catch (_) { shared = null; } }
    const tp = templateOf(new URLSearchParams(location.search).get('t') || ''); if (tp && !shared) { $('box').value = tp[2]; say(t('Template') + ': ' + t(tp[1])); }
    drawList(); stats();
    if (!shared && chats.length && P !== 'quick') cur = sortChats(chats)[0].id;
    draw();
    if (!navigator.onLine) say(t('You are offline. Your message stays in the box; notes, chats and the text tools work offline.'));
  })();
}
