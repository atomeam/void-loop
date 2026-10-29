/**
 * rides skill - food and rides in one card: type an address (and what you want to eat), get the Uber Eats, DoorDash, Waymo,
 * Uber and Lyft apps and sites opened on it; plus "where does Waymo run". The same hand-off card opens your mail (asked by Verse,
 * ask-20261028-1856-1, "my email" as a direct command; lists run 7): "my email" lists your inbox in Gmail, Outlook, Yahoo, Proton and
 * iCloud, and "email sam that I am running late" fills To, Subject and Body and opens the draft in your own mail app, where you send it. Contract: { name, examples, nearMisses, match, run }.
 * Every provider sits behind an adapter in skills/providers.js, so a real ordering API replaces a deep link later without
 * touching this card. None of these services has a public API for ordering on someone's behalf today (docs/everything-app.md).
 */
import { ofKind, waymoWhere, mailto } from './providers.js';
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
/** { mail: true, to?, body? } | null: your inbox or a draft in your own mail app. Pure. */
export function mailAsk(text) {
  const raw = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '), t = raw.toLowerCase();
  if (/^(?:(?:open|check|show|read|go\s+to|pull\s+up|take\s+me\s+to)\s+)?(?:me\s+)?my\s+(?:e-?mails?|inbox|mail(?:box)?)(?:\s+(?:inbox|please|pls))?$|^(?:open|check)\s+(?:gmail|outlook|yahoo\s+mail|proton\s*mail|icloud\s+mail)$|^(?:mail|e-?mail)\s+card$|^(?:any|do\s+i\s+have\s+(?:any\s+)?)new\s+e-?mails?$/.test(t)) return { mail: true };
  let m = raw.match(/^(?:(?:send|write|draft|compose)\s+(?:an?\s+)?e-?mail\s+to|e-?mail)\s+([^\s@]+@[^\s@]+\.[a-z]{2,}|[a-z][a-z'.-]{0,30}(?:\s+[a-z][a-z'.-]{0,30})?)\s+(?:that|saying|to\s+say)\s+(.{2,400})$/i);
  if (m && !/^(?:me|myself|it|this|them)$/i.test(m[1])) return { mail: true, to: m[1], body: m[2] };
  m = raw.match(/^(?:send|write|draft|compose|start)\s+(?:an?\s+)?(?:new\s+)?e-?mail(?:\s+to\s+([^\s@]+@[^\s@]+\.[a-z]{2,}|[a-z][a-z'.-]{0,30}(?:\s+[a-z][a-z'.-]{0,30})?))?$/i);
  if (m) return { mail: true, to: m[1] || '' };
  return null;
}
const subjectOf = (body) => { const s = String(body || '').replace(/\s+/g, ' ').trim(); if (!s) return ''; const w = s.split(' '); const cut = w.slice(0, 6).join(' '); return (cut.charAt(0).toUpperCase() + cut.slice(1)) + (w.length > 6 ? '…' : ''); };
/** the draft a mail ask fills in: { to (address or blank), name (who, when not an address), subject, body }. Pure. */
export function mailDraft(q) {
  const who = String(q.to || '').trim(), addr = EMAIL.test(who) ? who : '';
  let body = String(q.body || '').trim();
  if (body) body = body.replace(/^i am\b/i, 'I am').replace(/^i'm\b/i, "I'm").replace(/^i\b/, 'I'); if (body) body = body.charAt(0).toUpperCase() + body.slice(1) + (/[.!?]$/.test(body) ? '' : '.');
  const name = addr ? '' : who.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return { to: addr, name, subject: subjectOf(q.body), body: body ? (name ? 'Hi ' + name + ',\n\n' : '') + body : '' };
}
/** { waymo: city|'' } | { open: true, address?, food? } | null. Pure. */
export function ridesAsk(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:where\s+(?:does|do|can)\s+(?:i\s+(?:get|ride|take)\s+(?:a\s+)?)?waymos?\s*(?:run|operate|go|drive|work|ride)?|where\s+is\s+waymo(?:\s+available)?|waymo\s+(?:cities|service\s+areas?|map))$/);
  if (m) return { waymo: '' };
  m = t.match(/^(?:is\s+(?:there\s+)?waymo\s+(?:in|available\s+in)|does\s+waymo\s+(?:run|operate|work|go)\s+in|can\s+i\s+(?:get|take|ride)\s+a\s+waymo\s+in)\s+([a-z .'-]{2,40})$/);
  if (m) return { waymo: m[1].trim() };
  m = t.match(/^(?:order|get|i\s+want|deliver)\s+(?:me\s+)?(?:some\s+)?([a-z '&-]{2,30}?)\s+(?:delivered\s+)?(?:to|at)\s+(.{4,120})$/);
  if (m && !/\b(?:ride|car|taxi|waymo|uber)\b/.test(m[1])) return { open: true, food: m[1].trim(), address: m[2].trim() };
  m = t.match(/^([a-z '&-]{2,30}?)\s+delivery\s+(?:to|at|near)\s+(.{4,120})$/);
  if (m) return { open: true, food: m[1].trim() === 'food' ? '' : m[1].trim(), address: m[2].trim() };
  m = t.match(/^(?:(?:get|call|book|order)\s+(?:me\s+)?)?(?:a\s+)?(?:ride|waymo|robotaxi|taxi|car)\s+to\s+(.{4,120})$/);
  if (m) return { open: true, address: m[1].trim(), ride: true };
  if (/^(?:food\s+(?:and|&)\s+rides?|rides?\s+(?:and|&)\s+food|food\s+delivery|order\s+food|delivery\s+card|rides?\s+card|food\s+card|get\s+a\s+ride|order\s+a\s+ride|waymo|uber\s+eats|doordash|food\s+delivery\s+via\s+waymo|waymo\s+delivery)$/.test(t)) return { open: true };
  return null;
}
function draw(el, esc, q) {
  const btn = (p, kind) => '<a class="g-btn" style="display:inline-block;margin:3px 4px 3px 0;padding:6px 10px;text-decoration:none" target="_blank" rel="noopener" href="' + esc(p.web(q)) + '">' + esc(p.name) + ' ↗</a>'
    + '<a style="font-size:11px;opacity:.7;margin-right:8px" href="' + esc(p.app(q)) + '">app</a>';
  el.querySelector('.rd-out').innerHTML = '<p style="margin:10px 0 4px">Food' + (q.food ? ' · ' + esc(q.food) : '') + (q.address ? ' · to ' + esc(q.address) : '') + '</p>'
    + ofKind('food').map((p) => btn(p)).join('') + '<p style="margin:10px 0 4px">Rides' + (q.address ? ' · to ' + esc(q.address) : '') + '</p>' + ofKind('ride').map((p) => btn(p)).join('')
    + '<p class="g-sub" style="font-size:12px;margin-top:8px">You order and pay inside their app; Verse never sees your card. Waymo food delivery runs through DoorDash in metro Phoenix.</p>';
}
function drawMail(el, esc, d) {
  const q = { to: d.to, subject: d.subject, body: d.body }, draft = !!(d.to || d.subject || d.body);
  const btn = (href, name) => '<a class="g-btn" style="display:inline-block;margin:3px 4px 3px 0;padding:6px 10px;text-decoration:none" target="_blank" rel="noopener" href="' + esc(href) + '">' + esc(name) + ' ↗</a>';
  el.querySelector('.ml-out').innerHTML = (draft ? btn(mailto(q), 'Your mail app') : '') + ofKind('mail').filter((p) => !draft || ['gmail', 'outlook', 'yahoo'].includes(p.id)).map((p) => btn(p.web(q), p.name)).join('')
    + '<p class="g-sub" style="font-size:12px;margin-top:8px">' + (draft ? 'The draft opens in your own mail app; you check it and press send there.' : 'Your inbox opens in your own mail app.') + ' Verse never reads or sends your mail.</p>';
}
function runMail(q, api) {
  const { showPage, esc } = api, d = mailDraft(q);
  showPage((el) => {
    el.className += ' mail-card';
    const field = (cls, label, v, ph) => '<label style="display:block;margin:4px 0"><span class="g-sub" style="font-size:12px">' + label + '</span><input class="' + cls + '" aria-label="' + label + '" value="' + esc(v) + '" placeholder="' + esc(ph) + '" style="width:100%"></label>';
    el.innerHTML = '<h2>' + (q.to || q.body ? 'Email' + (d.name ? ' to ' + esc(d.name) : '') : 'Your email') + '</h2>'
      + field('ml-to', 'To', d.to, d.name ? d.name + "'s email address" : 'name@example.com') + field('ml-su', 'Subject', d.subject, 'Subject')
      + '<label style="display:block;margin:4px 0"><span class="g-sub" style="font-size:12px">Message</span><textarea class="ml-body" aria-label="Message" rows="4" style="width:100%">' + esc(d.body) + '</textarea></label>'
      + '<div class="ml-out"></div><div class="src">Deep links to each mail service · <a data-ask="food and rides" href="#">food &amp; rides</a></div>';
    const to = el.querySelector('.ml-to'), su = el.querySelector('.ml-su'), bo = el.querySelector('.ml-body');
    const up = () => drawMail(el, esc, { to: to.value.trim(), subject: su.value.trim(), body: bo.value });
    for (const i of [to, su, bo]) { i.addEventListener('input', up); i.addEventListener('keydown', (e) => e.stopPropagation()); }
    up();
  });
  return 'rides';
}
function run(text, api) {
  const mq = mailAsk(text);
  if (mq) return runMail(mq, api);
  const { showPage, esc } = api; const q = ridesAsk(text);
  if (!q) return 'none';
  if ('waymo' in q) {
    const w = waymoWhere(q.waymo);
    showPage((el) => { el.innerHTML = '<h2>Where Waymo runs</h2><p>' + esc(w.text) + '</p><p class="g-sub">Waymo has no public ordering API, so Verse opens the Waymo app for you: <a href="https://waymo.com/rides/" target="_blank" rel="noopener">waymo.com/rides</a>.</p><div class="src">Source: <a href="https://waymo.com/faq/" target="_blank" rel="noopener">Waymo FAQ</a> · checked Oct 2026</div>'; });
    return 'rides';
  }
  showPage((el) => {
    el.className += ' rides-card';
    el.innerHTML = '<h2>Food &amp; rides</h2><div style="display:flex;gap:6px;flex-wrap:wrap"><input class="rd-food" aria-label="What to eat" placeholder="pizza, tacos…" style="flex:1;min-width:120px"><input class="rd-addr" aria-label="Address" placeholder="address or place" style="flex:2;min-width:160px"></div><div class="rd-out"></div><div class="src">Deep links to each service · <a data-ask="where does waymo run" href="#">where does Waymo run?</a></div>';
    const f = el.querySelector('.rd-food'), a = el.querySelector('.rd-addr');
    f.value = q.food || ''; a.value = q.address || '';
    const up = () => draw(el, esc, { food: f.value.trim(), address: a.value.trim() });
    for (const i of [f, a]) { i.addEventListener('input', up); i.addEventListener('keydown', (e) => e.stopPropagation()); }
    up();
  });
  return 'rides';
}
export default {
  name: 'rides',
  examples: ['food and rides', 'where does waymo run', 'is waymo in austin', 'pizza delivery to 1 main st phoenix', 'get me a ride to the airport', 'food delivery via waymo', 'my email', 'check my email', 'open gmail', 'email sam that I am running late', 'write an email to jo@example.com'],
  nearMisses: ['how far is the airport', 'pizza recipe', 'calories in pizza', 'uber stock price', 'what is email', 'how do i write a good email', 'email marketing tips', 'digest my email'],
  mailAsk, mailDraft,
  match(lower, text) { return !!(mailAsk(text || lower) || ridesAsk(text || lower)); },
  run,
};
