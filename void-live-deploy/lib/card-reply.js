// The reply section on every card (owner, 2026-10-29: "the reply to what i said or correct me section should be on every card").
// Until now only the self card had it (its owner-only "Talk to me" box); every other card had a small owner-only "Tell Verse" link.
// Now each card Verse shows ends with the same section, open to read and type in:
//   - the owner: the words go to /api/voice-reply with the card (`about`: the ask, the title, what the card said), Verse answers under it
//     in its own words, and keeps the lesson for its next reflection. The section shows the earlier replies on the same ask, oldest first.
//   - anyone else: the words are kept on this device only, in the correction store the self card's "Correct me" log and heat map read
//     (lib/corrections.js). Nothing is sent: no unauthenticated endpoint takes a stranger's text.
// So a reply on any card lands where the self card and Verse's reflection already look: one shared channel, not a store per card.
// The section carries data-share-skip and the vtell-box class: a shared card's text, its picture and the frame's layout leave it out.
// Everything typed or read goes in with textContent, never as markup.
import { addCorrection, skillName } from './corrections.js';

export const REPLY = { title: 'Reply to what I said, or correct me', max: 600, thread: 6, saidMax: 800 };
export const LINES = {
  owner: 'I answer in my own words and keep what you tell me for every reflection after this.',
  guest: 'Kept on this device only. My self card lists it under Correct me.',
  kept: 'Kept on this device. My self card lists it under Correct me. Thank you.',
  empty: 'Write what you want to tell me first.',
  unkept: 'This browser would not keep it. Try again in a moment.',
  busy: 'I could not answer just now; I kept what you said and will read it when I next reflect.',
  lost: 'That did not reach me. Try again in a moment.',
  owner401: 'Only my owner can talk back here.',
};

// The family of a card no router skill answered, from the note the page writes to its loop log for that ask (void.html loopLog, domain void.page).
// The owner, 2026-10-29: "replies from a card must count on the heat map". Only family ids in skills/families.json; a reply placed this way gets
// a family and never a skill, so the owner's fix paths (the routed skill sent to /api/voice-reply, Suggest fix, hotEntry) do not change.
export const PAGE_FAMILY = {
  calc: 'numbers',
  age: 'time', timenow: 'time', timeuntil: 'time', stopwatch: 'time', today: 'time', holiday: 'time',
  chance: 'games',
  article: 'words', 'article fallback': 'words', 'short topic': 'words', answer: 'words',
  self: 'self', 'self (other language)': 'self', will: 'self', voice: 'self', api: 'self', menu: 'self',
};
/** the family id for a loop-log note ('calc', 'article', 'how-to clock', 'speaks fr'), or ''. Pure. */
export function familyOfNote(note) {
  const n = String(note || '').trim();
  if (Object.prototype.hasOwnProperty.call(PAGE_FAMILY, n)) return PAGE_FAMILY[n];
  return /^(?:how-to|speaks) /.test(n) ? 'self' : '';
}

/** the card's own words for the reply: the ask (or the title when no ask is known), the title and what it said, clipped. Pure. */
export function aboutCard({ ask, title, said, routed } = {}) {
  const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const t = clip(title, 120), a = clip(ask, 200) || t;
  if (!a) return null;
  const skill = routed && skillName(routed.skill);
  return { ask: a, title: t, said: clip(said, REPLY.saidMax), ...(skill ? { routed: { skill } } : {}) };
}

/** the owner's earlier replies on this card's ask, oldest first, at most REPLY.thread. Pure. */
export function threadOf(replies, ask) {
  const a = String(ask || '');
  return (Array.isArray(replies) ? replies : []).filter((r) => r && r.about && r.about.ask === a && typeof r.text === 'string').slice(0, REPLY.thread).reverse();
}

/**
 * Send one reply. The owner's goes to /api/voice-reply; anyone else's is kept on this device, under `family` when no skill is known. Never throws.
 * -> { ok, kind: 'owner' | 'device', reply?, line }: `reply` is the kept reply (owner), `line` is what Verse says back.
 */
export async function sendReply(about, text, { owner = '', storage, fetchFn, family = '' } = {}) {
  const words = String(text || '').trim().slice(0, REPLY.max);
  if (!words || !about) return { ok: false, kind: owner ? 'owner' : 'device', line: LINES.empty };
  if (!owner) {
    // `family` (familyOfNote) only places a reply that has no routed skill on the heat map; the owner's request below never carries it
    const r = addCorrection({ ask: about.ask, skill: about.routed && about.routed.skill, family, text: words }, storage);
    return { ok: r.ok, kind: 'device', line: r.ok ? LINES.kept : LINES.unkept };
  }
  try {
    const r = await fetchFn('/api/voice-reply', { method: 'POST', headers: { authorization: 'Bearer ' + owner, 'content-type': 'application/json' }, body: JSON.stringify({ about, text: words }) });
    if (r.status === 401) return { ok: false, kind: 'owner', line: LINES.owner401 };
    if (!r.ok) return { ok: false, kind: 'owner', line: LINES.lost };
    const reply = await r.json();
    const line = (reply.answer || LINES.busy) + (reply.misroute ? ' I have queued a fix so my ' + reply.misroute.skill + ' skill stops taking asks like this.' : '');
    return { ok: true, kind: 'owner', reply, line };
  } catch (_) { return { ok: false, kind: 'owner', line: LINES.lost }; }
}

/** true when the card already has a reply section of its own (the self card's Talk to me or Correct me) or this one. */
export const hasReply = (el) => !!(el && el.querySelector && el.querySelector(':scope > .vreply, [data-v-reply], [data-v-correct]'));

/** one "You:" or "Verse:" line under the section's heading; the words go in as text. */
function addLine(doc, talk, who, text, cls) {
  const p = doc.createElement('p'), b = doc.createElement('span');
  p.className = cls; b.className = 'v-who'; b.textContent = who + ': ';
  p.append(b, String(text || '')); talk.appendChild(p);
}
const showReply = (doc, talk, r) => { addLine(doc, talk, 'You', r.text, 'v-you'); addLine(doc, talk, 'Verse', r.answer || LINES.busy, 'v-me' + (r.correction ? ' v-corrected' : '')); };

/**
 * Put the section at the end of the card `el` (before nothing but the product line). `card()` gives { ask, title, said, routed }.
 * Returns the section, or null when the card has one already. The buttons work through bindReply, on the card itself, so a section that a
 * card copies when it rewrites itself (innerHTML +=) still sends.
 */
export function mountReply(el, doc, { owner = '', fetchFn, card } = {}) {
  if (!el || hasReply(el)) return null;
  const mk = (tag, props = {}) => Object.assign(doc.createElement(tag), props);
  const sec = mk('section', { className: 'vtell-box vreply' });
  sec.setAttribute('data-share-skip', '1');
  // the speaker reads the card's own words; "Reply to what I said, or correct me" and the Send row are controls, so it skips them (void.html speakText)
  sec.setAttribute('data-nospeak', '1');
  const h = mk('h3', { className: 'vreply-h', textContent: REPLY.title });
  const talk = mk('div', { className: 'v-talk' }); talk.setAttribute('data-reply-talk', '1'); talk.setAttribute('aria-live', 'polite');
  const box = mk('textarea', { maxLength: REPLY.max, rows: 2, placeholder: REPLY.title }); box.setAttribute('data-reply-box', '1'); box.setAttribute('aria-label', 'Your reply to Verse about this card');
  const send = mk('button', { type: 'button', className: 'tr-copy', textContent: 'Send' }); send.setAttribute('data-reply-send', '1');
  const sub = mk('div', { className: 'sub', textContent: owner ? LINES.owner : LINES.guest });
  sec.append(h, talk, box, send, sub);
  placeReply(el, sec);
  // the owner sees what was said on this ask before (the same store Verse's reflection reads)
  const about = owner && fetchFn ? aboutCard(card ? card() : {}) : null;
  if (about) fetchFn('/api/voice-reply', { headers: { authorization: 'Bearer ' + owner } })
    .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) threadOf(j.replies, about.ask).forEach((r) => showReply(doc, talk, r)); }).catch(() => {});
  return sec;
}

/** keep the section last on the card, with only the product line (.vtail) after it. Moves it only when something else is after it. */
export function placeReply(el, sec = el && el.querySelector(':scope > .vreply')) {
  if (!el || !sec) return false;
  let n = sec.nextElementSibling; while (n && n.classList.contains('vtail')) n = n.nextElementSibling;
  if (sec.parentNode === el && !n) return false;
  const tail = el.querySelector(':scope > .vtail');
  if (tail) el.insertBefore(sec, tail); else el.appendChild(sec);
  return true;
}

/** the card's listeners for its section, added once per card: Send, and keys typed in the box stay in the box. `owner` may be a function,
 * read at each Send, so a key typed in after the card opened counts. */
export function bindReply(el, doc, { owner = '', storage, fetchFn, card } = {}) {
  if (!el || el._replyBound) return;
  el._replyBound = true;
  const inBox = (e) => e.target && e.target.closest && e.target.closest('.vreply [data-reply-box]');
  for (const ev of ['pointerdown', 'keydown']) el.addEventListener(ev, (e) => { if (inBox(e)) e.stopPropagation(); });
  el.addEventListener('click', async (e) => {
    const send = e.target && e.target.closest && e.target.closest('.vreply [data-reply-send]'); if (!send || send.disabled) return;
    e.preventDefault(); e.stopPropagation();
    const sec = send.closest('.vreply'), box = sec.querySelector('[data-reply-box]'), talk = sec.querySelector('[data-reply-talk]');
    const text = box ? box.value : '';
    if (!String(text).trim()) { addLine(doc, talk, 'Verse', LINES.empty, 'v-me'); return; }
    send.disabled = true; send.textContent = '…';
    const c = card ? card() : {};
    const r = await sendReply(aboutCard(c), text, { owner: typeof owner === 'function' ? owner() : owner, storage, fetchFn, family: c.family || '' });
    if (r.ok && r.reply) showReply(doc, talk, r.reply);
    else { if (r.ok) addLine(doc, talk, 'You', String(text).trim().slice(0, REPLY.max), 'v-you'); addLine(doc, talk, 'Verse', r.line, 'v-me'); }
    if (r.ok && box) box.value = '';
    send.disabled = false; send.textContent = 'Send';
  });
}
