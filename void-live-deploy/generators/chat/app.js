// /generators/chat/'s code, kept out of the page so the page needs no inline-script CSP rule (tools/csp-hashes.mjs budget)
import { mountRelated } from '/lib/toolkit.js';
import { STARTERS, cleanCharacter, toCode, fromCode, CHAT_SAYS, TURNS, MEMORY_MAX } from '/lib/character.js';
addEventListener('load', () => {
  const $ = (id) => document.getElementById(id), de = /^de\b/i.test(navigator.language || '');
  const KEY = 'a2m.void.chars.v1';
  let store = { chars: [], current: '' };
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); if (s && Array.isArray(s.chars)) store = { chars: s.chars.filter((c) => c && c.id).slice(0, 50), current: String(s.current || '') }; } catch (_) {}
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_) { say('This browser would not keep the chat (storage is full or off).'); } };
  const say = (t) => { $('note').textContent = t || ''; };
  // the starters are characters too; a chat with one is kept like any other
  for (const [i, s] of STARTERS.entries()) if (!store.chars.some((c) => c.id === 'starter' + i)) store.chars.push({ id: 'starter' + i, ...s, memory: '', chat: [] });
  let cur = store.chars.find((c) => c.id === store.current) || store.chars[0], shared = null;
  const h = new URLSearchParams(location.hash.slice(1)).get('c');
  if (h) { const c = fromCode(h); if (c) { shared = { id: 'c' + Date.now().toString(36), ...c, memory: '', chat: [] }; cur = shared; $('keepShared').hidden = false; say('A shared character. Chat away; "Keep this character" saves it here.'); } }
  function drawChars() {
    $('chars').replaceChildren(...store.chars.concat(shared && !store.chars.includes(shared) ? [shared] : []).map((c) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = c.name; b.setAttribute('aria-pressed', String(c === cur)); b.addEventListener('click', () => { cur = c; store.current = c.id; keep(); open(); }); return b; }));
  }
  function fillSheet() { $('cName').value = cur.name; $('cPersona').value = cur.persona; $('cScenario').value = cur.scenario; $('cGreeting').value = cur.greeting; $('cMemory').value = cur.memory || ''; }
  function bubble(m, i) {
    const li = document.createElement('li'); li.className = 'msg ' + m.role;
    const who = document.createElement('span'); who.className = 'who'; who.textContent = m.role === 'user' ? (de ? 'Du' : 'You') : cur.name;
    li.append(who, document.createTextNode(m.text));
    if (i !== undefined) {
      const acts = document.createElement('div'); acts.className = 'acts';
      if (m.role === 'character' && i === cur.chat.length - 1 && i > 0) { const r = document.createElement('button'); r.type = 'button'; r.textContent = de ? 'Neu antworten' : 'Try another reply'; r.addEventListener('click', () => { cur.chat.pop(); keep(); drawLog(); reply(); }); acts.append(r); }
      const d = document.createElement('button'); d.type = 'button'; d.textContent = de ? 'Löschen' : 'Delete'; d.setAttribute('aria-label', (de ? 'Nachricht löschen: ' : 'Delete message: ') + m.text.slice(0, 40)); d.addEventListener('click', () => { cur.chat.splice(i, 1); keep(); drawLog(); }); acts.append(d);
      li.append(acts);
    }
    return li;
  }
  function drawLog() {
    if (!cur.chat.length && cur.greeting) cur.chat.push({ role: 'character', text: cur.greeting, at: Date.now() });
    $('log').replaceChildren(...cur.chat.map((m, i) => bubble(m, i)));
    $('log').lastElementChild && $('log').lastElementChild.scrollIntoView({ block: 'nearest' });
  }
  function open() { drawChars(); fillSheet(); drawLog(); $('h').textContent = (de ? 'Chat mit ' : 'Chat with ') + cur.name; }
  let busy = false;
  async function reply() {
    if (busy) return; busy = true; $('send').disabled = true;
    const typing = Object.assign(document.createElement('li'), { className: 'msg character typing', textContent: cur.name + (de ? ' schreibt…' : ' is typing…') }); $('log').append(typing); typing.scrollIntoView({ block: 'nearest' });
    const last = cur.chat[cur.chat.length - 1], history = cur.chat.slice(0, -1).slice(-TURNS).map((m) => ({ role: m.role, text: m.text }));
    let j = null;
    try { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 30000); j = await (await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'character', character: cleanCharacter(cur), memory: (cur.memory || '').slice(0, MEMORY_MAX), history, message: last.text, lang: de ? 'de' : 'en' }), signal: ctl.signal })).json(); clearTimeout(t); } catch (_) { j = null; }
    typing.remove(); busy = false; $('send').disabled = false;
    if (j && j.reply) { cur.chat.push({ role: 'character', text: j.reply, at: Date.now() }); keep(); drawLog(); }
    else say((j && j.say) || (navigator.onLine ? CHAT_SAYS.busy[de ? 1 : 0] : (de ? 'Der Chat braucht Internet.' : 'The chat needs the internet.')));
  }
  function send() {
    const t = $('say').value.trim(); if (!t || busy) return;
    cur.chat.push({ role: 'user', text: t.slice(0, 600), at: Date.now() }); cur.chat = cur.chat.slice(-200); $('say').value = ''; say(''); keep(); drawLog(); reply();
  }
  $('send').addEventListener('click', send);
  $('say').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  $('saveChar').addEventListener('click', () => {
    const c = cleanCharacter({ name: $('cName').value, persona: $('cPersona').value, scenario: $('cScenario').value, greeting: $('cGreeting').value });
    Object.assign(cur, c, { memory: $('cMemory').value.slice(0, MEMORY_MAX) });
    if (!store.chars.includes(cur)) { store.chars.unshift(cur); shared = null; $('keepShared').hidden = true; }
    store.current = cur.id; keep(); open(); say(de ? 'Gespeichert.' : 'Saved on this device.');
  });
  $('cMemory').addEventListener('change', () => { cur.memory = $('cMemory').value.slice(0, MEMORY_MAX); keep(); });
  $('newChar').addEventListener('click', () => { cur = { id: 'c' + Date.now().toString(36), name: '', persona: '', scenario: '', greeting: '', memory: '', chat: [] }; fillSheet(); $('sheet').open = true; $('log').replaceChildren(); $('cName').focus(); say(de ? 'Schreib die Figur und drück Speichern.' : 'Write the character, then Save.'); });
  $('clearChat').addEventListener('click', () => { if (!confirm(de ? 'Den Chat leeren?' : 'Clear this chat?')) return; cur.chat = []; keep(); drawLog(); });
  $('delChar').addEventListener('click', () => { if (!confirm((de ? 'Löschen: ' : 'Delete ') + cur.name + '?')) return; store.chars = store.chars.filter((c) => c !== cur); cur = store.chars[0]; store.current = cur ? cur.id : ''; keep(); if (cur) open(); });
  $('keepShared').addEventListener('click', () => { if (shared && !store.chars.includes(shared)) { store.chars.unshift(shared); store.current = shared.id; keep(); } $('keepShared').hidden = true; drawChars(); say(de ? 'Behalten.' : 'Kept on this device.'); });
  $('share').addEventListener('click', async () => { const url = location.origin + '/generators/chat/#c=' + toCode(cur); try { if (navigator.share) { await navigator.share({ title: cur.name, url }); return; } } catch (_) {} try { await navigator.clipboard.writeText(url); } catch (_) {} say((de ? 'Link kopiert (nur die Figur, nie der Chat): ' : 'Link copied (the character, never the chat): ') + url); });
  if (de) { document.documentElement.lang = 'de'; $('sub').textContent = 'Wähl eine Figur oder schreib deine eigene, dann rede mit ihr. Chat und Erinnerung bleiben auf diesem Gerät.'; $('newChar').textContent = 'Neue Figur'; $('share').textContent = 'Figur teilen'; $('keepShared').textContent = 'Diese Figur behalten'; $('sheetH').textContent = 'Figurenblatt'; $('send').textContent = 'Senden'; $('saveChar').textContent = 'Speichern'; $('clearChat').textContent = 'Chat leeren'; $('delChar').textContent = 'Figur löschen'; $('say').placeholder = 'Sag etwas…'; $('charsH').textContent = 'Figuren'; }
  if (cur) open();
  mountRelated($('related'), '/generators/');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
});
