/**
 * assistant-core: the pure half of Verse's assistant pages (/assistant/ and its lane pages; lib/ai-sites.js). A chat is { id, title, at, folder, pinned,
 * style, model, messages: [{ role: 'user'|'assistant', text, at, sources? }] }, kept on the visitor's device by lib/assistant-ui.js. Here: making and
 * cleaning chats, search across them, export (Markdown, JSON) and import, a chat packed into a link, prompt templates and chat styles, and the text tools
 * that run on the device (count, summarize, rewrite). What a reply is asked from: functions/api/answer.js mode 'assistant' (lib/assistant-chat.js).
 * Tests: tools/ai-pages.test.mjs.
 */
export const MSG_MAX = 4000, CHATS_MAX = 200, MESSAGES_MAX = 200;
const line = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n);
export const newId = (rand = Math.random) => Date.now().toString(36) + rand().toString(36).slice(2, 8);
/** a new empty chat. Pure but for the id and the time, which can be given. */
export function newChat(o = {}) { return { id: o.id || newId(), title: line(o.title, 80) || 'New chat', at: o.at || Date.now(), folder: line(o.folder, 40), pinned: false, style: line(o.style, 20) || 'default', model: line(o.model, 20) || 'verse', messages: [] }; }
/** a chat read from storage, a file or a link, made safe and whole; null when it is not a chat. Pure. */
export function cleanChat(c) {
  if (!c || typeof c !== 'object' || !Array.isArray(c.messages)) return null;
  const messages = c.messages.slice(-MESSAGES_MAX).map((m) => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', text: line(m && m.text, MSG_MAX * 2), at: Number(m && m.at) || 0, ...(m && Array.isArray(m.sources) ? { sources: m.sources.slice(0, 8).map((s) => ({ title: line(s && s.title, 200), url: /^https:\/\//.test(String(s && s.url)) ? line(s.url, 500) : '' })).filter((s) => s.url) } : {}) })).filter((m) => m.text);
  return { id: /^[a-z0-9]{4,24}$/.test(String(c.id)) ? String(c.id) : newId(), title: line(c.title, 80) || titleOf(messages), at: Number(c.at) || Date.now(), folder: line(c.folder, 40), pinned: !!c.pinned, style: line(c.style, 20) || 'default', model: line(c.model, 20) || 'verse', messages };
}
/** a chat's title from its first question: its first words, at most 60 characters. Pure. */
export function titleOf(messages) {
  const first = (messages || []).find((m) => m.role === 'user'); if (!first) return 'New chat';
  const t = first.text.replace(/\s+/g, ' ').trim(); return t.length > 60 ? t.slice(0, 57).replace(/\s+\S*$/, '') + '…' : t;
}
/** chats sorted for the list: pinned first, then the newest. Pure. */
export const sortChats = (chats) => [...(chats || [])].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.at || 0) - (a.at || 0));
/** the chats whose title or any message holds every word of `q`, each with a short snippet around the first hit. Pure. */
export function searchChats(chats, q) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return [];
  const out = [];
  for (const c of chats || []) {
    const all = (c.title + '\n' + c.messages.map((m) => m.text).join('\n')).toLowerCase();
    if (!words.every((w) => all.includes(w))) continue;
    const m = c.messages.find((x) => x.text.toLowerCase().includes(words[0])), t = m ? m.text : c.title, i = Math.max(0, t.toLowerCase().indexOf(words[0]) - 40);
    out.push({ chat: c, snippet: (i > 0 ? '…' : '') + t.slice(i, i + 120).replace(/\s+/g, ' ') + (t.length > i + 120 ? '…' : '') });
  }
  return out;
}
/** a chat as Markdown. Pure. */
export function toMarkdown(chat) {
  const c = cleanChat(chat); if (!c) return '';
  return '# ' + c.title + '\n\n' + c.messages.map((m) => '**' + (m.role === 'user' ? 'You' : 'Verse') + ':**\n\n' + m.text + (m.sources && m.sources.length ? '\n\n' + m.sources.map((s, i) => '[' + (i + 1) + '] ' + s.title + ' ' + s.url).join('\n') : '')).join('\n\n---\n\n') + '\n';
}
/** every chat as one JSON file. Pure. */
export const toJson = (chats) => JSON.stringify({ kind: 'verse-chats', version: 1, chats: (chats || []).map(cleanChat).filter(Boolean) }, null, 1);
/** the chats in a file made by toJson (or a single chat, or a list of chats); [] when it holds none. Pure. */
export function fromJson(text) {
  let j; try { j = JSON.parse(String(text)); } catch (_) { return []; }
  const list = Array.isArray(j) ? j : j && Array.isArray(j.chats) ? j.chats : j && Array.isArray(j.messages) ? [j] : [];
  return list.slice(0, CHATS_MAX).map(cleanChat).filter(Boolean);
}
// a chat in a link: its JSON, packed (deflate where the browser has it, the page does that) and written base64url after #c= or #z= (packed)
export const b64u = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0));
/** the plain (unpacked) share code of a chat: only its title and messages. Pure. */
export const shareCode = (chat) => { const c = cleanChat(chat); return c ? b64u(new TextEncoder().encode(JSON.stringify({ title: c.title, messages: c.messages.map(({ role, text, sources }) => ({ role, text, ...(sources ? { sources } : {}) })) }))) : ''; };
/** the chat a plain share code holds, or null. Pure. */
export const fromShareCode = (code) => { try { return cleanChat(JSON.parse(new TextDecoder().decode(unb64u(code)))); } catch (_) { return null; } };

// templates a chat can start from (?t=key): [key, name, the text put in the box]; a [bracket] is the part to fill in
export const TEMPLATES = Object.freeze([
  ['explain', 'Explain simply', 'Explain [a topic] to me as if I were 12, with one everyday example.'],
  ['summarize', 'Summarize a text', 'Summarize this in five bullet points, then one sentence on what matters most:\n\n[paste the text]'],
  ['email', 'Write an email', 'Write a short, friendly email to [who] about [what]. Keep it under 120 words.'],
  ['brainstorm', 'Brainstorm ideas', 'Give me 10 different ideas for [what], each in one line, from safe to bold.'],
  ['code', 'Review my code', 'Review this code: find bugs, explain them, and show the fixed version.\n\n```\n[paste the code]\n```'],
  ['plan', 'Plan my week', 'Make a simple plan for my week. Things I need to do: [list them]. I have [hours] free each day.'],
  ['rewrite', 'Make it clearer', 'Rewrite this so it is clear and short, keeping its meaning:\n\n[paste the text]'],
  ['translate', 'Translate', 'Translate into [language], natural and not word for word:\n\n[paste the text]'],
  ['study', 'Quiz me', 'Ask me 5 questions, one at a time, to check I understand [a topic]. Wait for my answer each time.'],
  ['recipe', 'Cook from what I have', 'I have [ingredients]. Suggest two dishes I can make in 30 minutes, with steps.'],
  ['decide', 'Help me decide', 'Help me decide between [option A] and [option B]. Ask me two questions first, then weigh them.'],
  ['js', 'Write JavaScript', 'Write a small JavaScript function that [does what], with console.log examples I can run.'],
]);
export const templateOf = (key) => TEMPLATES.find(([k]) => k === key) || null;
// chat styles (the quick page's personas; the voice page uses 'warm'): [key, name]; the words the model is given are in lib/assistant-chat.js STYLES
export const STYLE_NAMES = Object.freeze([['default', 'Standard'], ['concise', 'Short and direct'], ['teacher', 'Teacher'], ['coder', 'Coder'], ['poet', 'Poet'], ['comedian', 'Comedian'], ['philosopher', 'Philosopher'], ['coach', 'Coach'], ['warm', 'Warm and curious'], ['long', 'Longer, deeper answers']]);

// ---- text tools on the device ----
const SENT = /[^.!?\n]+(?:[.!?]+["')\]]*|\n|$)/g;
export const sentencesOf = (t) => (String(t || '').match(SENT) || []).map((s) => s.trim()).filter((s) => /\w/.test(s));
/** counts of a text: words, characters (with and without spaces), sentences, paragraphs, minutes to read (238 words a minute) and to speak (150). Pure. */
export function countText(t) {
  const s = String(t || ''), words = (s.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length;
  return { words, chars: [...s].length, charsNoSpaces: [...s.replace(/\s/g, '')].length, sentences: sentencesOf(s).length, paragraphs: s.split(/\n\s*\n/).filter((p) => p.trim()).length, readMin: Math.max(words ? 1 : 0, Math.round(words / 238)), speakMin: Math.max(words ? 1 : 0, Math.round(words / 150)) };
}
const STOP = new Set('a an and are as at be but by for from has have he her his i in is it its me my of on or our she so that the their them there they this to was we were what when which who will with you your'.split(' '));
/** the `n` sentences that carry most of a text's frequent words, in their original order (an extractive summary, made on the device). Pure. */
export function summarize(t, n = 3) {
  const ss = sentencesOf(t); if (ss.length <= n) return ss.join(' ');
  const freq = {}; for (const w of String(t).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) if (!STOP.has(w) && w.length > 2) freq[w] = (freq[w] || 0) + 1;
  const score = ss.map((s, i) => { const ws = (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => freq[w]); return [i, ws.reduce((a, w) => a + freq[w], 0) / Math.sqrt(ws.length + 1) + (i === 0 ? 0.5 : 0)]; });
  return score.sort((a, b) => b[1] - a[1]).slice(0, n).map(([i]) => i).sort((a, b) => a - b).map((i) => ss[i]).join(' ');
}
// filler a "shorter" rewrite drops, and the long phrases it swaps for short ones
const FILLER = /\b(?:really|very|just|basically|actually|literally|quite|simply|totally|definitely|in order)\s+/gi;
const SHORTER = [[/\bin order to\b/gi, 'to'], [/\bdue to the fact that\b/gi, 'because'], [/\bat this point in time\b/gi, 'now'], [/\bin the event that\b/gi, 'if'], [/\bfor the purpose of\b/gi, 'for'], [/\ba large number of\b/gi, 'many'], [/\bhas the ability to\b/gi, 'can'], [/\bin spite of the fact that\b/gi, 'although'], [/\bwith regard to\b/gi, 'about'], [/\bprior to\b/gi, 'before']];
/** a text rewritten on the device: 'shorter' (filler out, long phrases short), 'tidy' (spaces and punctuation), 'sentence' (Sentence case), 'title'
 *  (Title Case), 'bullets' (one sentence a bullet), 'upper', 'lower'. Mechanical by design: a rewrite in other words is the model's (Ask Verse). Pure. */
export function rewrite(t, how = 'tidy') {
  let s = String(t || '');
  const tidy = (x) => x.replace(/[ \t]+/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/([,.;:!?])(?=[A-Za-z])/g, '$1 ').replace(/\n{3,}/g, '\n\n').replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase()).trim();
  if (how === 'shorter') { for (const [re, to] of SHORTER) s = s.replace(re, to); return tidy(s.replace(FILLER, '')); }
  if (how === 'sentence') return s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\bi\b/g, 'I');
  if (how === 'title') { const small = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']); return s.toLowerCase().replace(/\p{L}[\p{L}'’]*/gu, (w, i) => (i > 0 && small.has(w) ? w : w[0].toUpperCase() + w.slice(1))); }
  if (how === 'bullets') return sentencesOf(s).map((x) => '- ' + x).join('\n');
  if (how === 'upper') return s.toUpperCase(); if (how === 'lower') return s.toLowerCase();
  return tidy(s);
}
/** the code blocks of a reply: [{ lang, code }]. Pure. */
export const codeBlocks = (text) => [...String(text || '').matchAll(/```([\w+-]*)\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1].toLowerCase(), code: m[2] }));
/** follow-up questions for a question (the sources page): built from its words, never from the model. Pure. */
export function followUps(q) {
  const t = String(q || '').replace(/[?!.]+$/, '').trim(), subj = t.replace(/^(?:what|who|where|when|why|how|which)\s+(?:is|are|was|were|do|does|did)\s+(?:the\s+|a\s+|an\s+)?/i, '').trim();
  if (!subj || subj.length > 80) return [];
  return ['What is the history of ' + subj + '?', 'Why does ' + subj + ' matter?', 'What are common misconceptions about ' + subj + '?', 'How does ' + subj + ' compare with similar things?'];
}
