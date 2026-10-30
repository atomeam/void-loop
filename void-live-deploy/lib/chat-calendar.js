// Chat-fill for the Calendar (owner, 2026-10-25): "put dentist on Friday at 3", "meeting with Sam tomorrow 10am for an hour", "remind me to call mum
// tomorrow 6pm", "change the dentist to 4pm", "move the dentist to Monday", "delete the dentist event", "when is my dentist" write into the events
// /calendar/ keeps (lib/calendar.js KEY a2m.void.calendar.v1) and say the parsed date and time in words so a wrong reading is seen at once. The date
// reading is the calendar's own (quickAdd). Pure; same plan/undo shape as lib/chat-notes.js. Tests: tools/chat-calendar.test.mjs.
import * as C from './calendar.js';

const cap = (s) => { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };
const lead = (t) => t.replace(/^(?:hey\s+)?(?:verse[,:]?\s+)?(?:please|bitte|can you|could you|would you|kannst du)\s+/i, '').replace(/\s+(?:please|bitte)$/i, '');
// words that say a day or a time was given (so "dinner" alone is not an event, and a missing time is told)
const DAYW = String.raw`today|tonight|tomorrow|tmrw|heute|morgen|übermorgen|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|\d{1,2}[./]\d{1,2}|\d{4}-\d{2}-\d{2}|next week|in \d+ (?:days?|weeks?)|every \w+|jeden \w+`;
const HAS_DAY = new RegExp('\\b(?:' + DAYW + ')\\b', 'i'), HAS_TIME = /\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|uhr)|\d{1,2}:\d{2}|at \d{1,2}\b|um \d{1,2}\b|noon|midnight|mittag|mitternacht)\b/i;
const EVENTY = /^(?:meeting|meet|call|lunch|dinner|breakfast|brunch|appointment|dentist|doctor|party|birthday|flight|class|lesson|interview|coffee|date|haircut|gym|workout|standup|stand-up|review|session|visit|trip|exam|deadline|concert|game|match|training|therapy|checkup|check-up|massage|webinar|dance|run|swim|termin|besprechung|zahnarzt|arzt|treffen|essen|friseur)\b/i;
const NOT_CAL = /\b(?:task|priority|mpg|miles|fuel|chain|deadline|review this|risk|pace|budget|invoice|\$)\b|[:$(){}=<>]\s*\S*\d|\d\s*[/]\s*[a-z]/i;
// the "in den Kalender" / "to my calendar" a sentence ends on is where the event goes, not part of its title ("Zahnarzt morgen 15 Uhr in den Kalender" is "Zahnarzt")
const CAL_TAIL = /\s+(?:(?:to|on|in|into|onto)\s+(?:my|the|our)\s+(?:calendar|calender|agenda)|(?:in|im|ins|in den|in meinen|in meinem|zum|zu meinem)\s+(?:den\s+|das\s+|meinen\s+|meinem\s+)?kalender(?:\s+(?:ein|eintragen|einfügen|hinzufügen|setzen|aufnehmen))?)$/i;
const TIMER = /\bin\s+(?:\d+(?:\.\d+)?|a|an|one|two|three|four|five|ten|fifteen|twenty|thirty)\s*(?:min(?:ute)?s?|hours?|hrs?|seconds?|secs?)\b/i;

/** { op, ... } for a calendar sentence, or null. Syntax only. Pure. */
export function parseIntent(raw) {
  const t = lead(String(raw || '').replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '')); if (!t || t.length > 300) return null; let m;
  if (TIMER.test(t) && /^(?:remind|wake|ping|alert|buzz)\b/i.test(t)) return null; // a timer from now, the stage's own
  if ((m = /^(?:when|what time) (?:is|was) (?:my |the |our )?(.+?)$/i.exec(t)) && !/^(?:it|the time|that|this)$/i.test(m[1])) return { op: 'when', target: m[1].trim() };
  if ((m = /^(?:change|move|reschedule|push|shift|update|verschiebe)\s+(?:my |the |our |den |das )?(.+?)(?: event| appointment| meeting| termin)?\s+(?:to|until|for|auf)\s+(.+)$/i.exec(t)) && (HAS_DAY.test(m[2]) || HAS_TIME.test(m[2]))) return { op: 'change', target: m[1].trim(), when: m[2].trim() };
  if ((m = /^(?:delete|remove|cancel|drop|lösche|streiche)\s+(?:my |the |our |den |das )?(.+?)(?:\s+(?:event|appointment|meeting|termin))?$/i.exec(t))) return { op: 'delete', target: m[1].trim(), explicit: /(?:event|appointment|meeting|termin)$/i.test(t) };
  if (/^remind me at\b/i.test(t)) return null;
  if (((m = /^remind me (?:to |about |of )?(.+)$/i.exec(t)) || (m = /^erinnere mich (?:an |daran,? )?(.+)$/i.exec(t))) && (HAS_DAY.test(m[1]) || HAS_TIME.test(m[1])) && !NOT_CAL.test(t)) return { op: 'add', text: m[1].trim(), remind: true };
  if ((m = /^(?:add|put|schedule|create|new|set up|book|trage|plane)\s+(.+?)\s+(?:to|on|in|into|im|in den|ins)\s+(?:my |the |our |den |das )?(?:calendar|agenda|kalender)(?:\s+ein)?$/i.exec(t))) return { op: 'add', text: m[1].trim(), explicit: true };
  if ((m = /^(?:put|schedule|book|add|create|plan|set up)\s+(?:in |a |an |my |the )?(.+)$/i.exec(t)) && HAS_DAY.test(m[1]) && !NOT_CAL.test(t) && !/\b(?:note|sticky|stickies|list|recipe|generator|table|column|row|tag)\b/i.test(m[1]) && !/^(?:meeting|call) with\b/i.test(t.replace(/^(?:schedule|book)\s+(?:a |an )?/i, '') ) ) return { op: 'add', text: m[1].trim() };
  if ((m = /^(?:an? )?(.+)$/i.exec(t)) && EVENTY.test(m[1]) && HAS_DAY.test(m[1]) && !NOT_CAL.test(t) && t.length <= 90 && !/\?$/.test(String(raw).trim()) && !/^(?:what|when|where|who|how|is|are|do|does|can|why)\b/i.test(m[1])) return { op: 'add', text: m[1].trim() };
  return null;
}

export const HINT = 'I can fill your calendar from a sentence: "put dentist on Friday at 3", "meeting with Sam tomorrow 10am for an hour", "remind me to call mum tomorrow 6pm", "dentist tomorrow 3pm, remind me 30 minutes before, every month", "change the dentist to 4pm", "move the dentist to Monday", "delete the dentist event", "when is my dentist". I say the date and time I understood, and every change has Undo.';

/** an event said in words: "Friday, 30 October 2026, 3:00 PM to 4:00 PM (1 hour), every month, reminder 30 minutes before". Pure. */
export function describe(e, lang = 'en', now = new Date()) {
  const st = C.parseLocal(e.start), en = C.parseLocal(e.end), de = /^de\b/i.test(lang); if (!st) return '';
  let s = C.fmtDay(st, lang, { year: st.getFullYear() !== now.getFullYear() });
  if (e.allDay) { s += (de ? ', ganztägig' : ', all day'); if (en && C.dayKey(en) !== C.dayKey(st)) s += (de ? ' bis ' : ' to ') + C.fmtDay(en, lang, { year: false }); }
  else { s += ', ' + C.fmtTime(st, lang) + (en ? (de ? ' bis ' : ' to ') + C.fmtTime(en, lang) : ''); const min = en ? Math.round((en - st) / 60000) : 0; if (min > 0) s += ' (' + (min % 60 === 0 ? min / 60 + (de ? ' Std.' : min / 60 === 1 ? ' hour' : ' hours') : min + (de ? ' Min.' : ' minutes')) + ')'; }
  if (e.rrule) s += ', ' + C.repeatText(e.rrule, lang);
  if (e.reminders && e.reminders.length) s += ', ' + (de ? 'Erinnerung ' : 'reminder ') + e.reminders.map((m) => C.reminderText(m, lang)).join(', ');
  return s;
}
const evOf = (store) => (store && store.events) || [];
const same = (a, b) => a && b && a.title.toLowerCase() === b.title.toLowerCase() && a.start === b.start;
const words = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !['my', 'the', 'a', 'an', 'our', 'event', 'appointment', 'meeting', 'termin', 'den', 'das'].includes(w));
const matchEvents = (events, phrase) => { const kw = words(phrase); if (!kw.length) return []; return events.filter((e) => { const tw = words(e.title); return kw.every((w) => tw.some((x) => x === w || x.startsWith(w) || w.startsWith(x))); }); };

/** what the intent does to the stored calendar { events, ... } (see lib/fill-card.js). Pure. */
export function plan(store, it, now = new Date(), lang = 'en') {
  if (!it) return { kind: 'none' }; const S = { ...(store || {}), events: evOf(store) }, de = /^de\b/i.test(lang);
  const find = (phrase, id) => (id ? S.events.filter((e) => e.id === id) : matchEvents(S.events, phrase));
  const pickOne = (hits, mk, question) => hits.length === 1 ? null : { kind: 'ask', question, options: hits.slice(0, 6).map((e) => ({ label: e.title + ' (' + describe(e, lang, now) + ')', intent: mk(e.id) })) };
  switch (it.op) {
    case 'add': {
      let text = it.text.replace(CAL_TAIL, '').replace(/^(?:to |an |a )/i, '').replace(/\bfor (?:an|a|one) hour\b/i, 'for 1 hour').replace(/\bfor (?:half an hour|a half hour|half hour)\b/i, 'for 30 minutes').replace(/\bfor (?:two|2) hours\b/i, 'for 2 hours'); const e = C.quickAdd(text, now); if (!e) return { kind: 'none' };
      if (it.remind && !e.reminders.length) e.reminders = [0];
      const hasDay = HAS_DAY.test(text), hasTime = HAS_TIME.test(text), dup = S.events.find((x) => same(x, e)), line = describe(e, lang, now);
      if (dup) return { kind: 'show', title: dup.title, lines: ['Already in your calendar: ' + dup.title + ', ' + describe(dup, lang, now) + '. Nothing changed.'], openId: dup.id };
      if (!it.sure && (!hasDay && !hasTime || e.title.length < 2)) return { kind: 'confirm', preview: 'Put "' + cap(e.title) + '" on ' + line + ' (no day or time was given, so I took today' + (e.allDay ? ', all day' : '') + ')', intent: { ...it, sure: true } };
      const ev = { ...e, title: cap(e.title) }; return { kind: 'write', title: ev.title, said: 'Put "' + ev.title + '" in your calendar for ' + line, store: { ...S, events: C.withEvent(S.events, ev) }, changes: [{ id: e.id, before: null }], openId: e.id, hasTime };
    }
    case 'when': { const hits = find(it.target, it.docId); if (!hits.length) return { kind: 'none' }; if (hits.length > 1) return pickOne(hits, (id) => ({ ...it, docId: id }), 'Which "' + it.target + '"?'); return { kind: 'show', title: hits[0].title, lines: [hits[0].title + ': ' + describe(hits[0], lang, now) + '.'], openId: hits[0].id }; }
    case 'change': {
      const hits = find(it.target, it.docId); if (!hits.length) return { kind: 'none' }; const q = pickOne(hits, (id) => ({ ...it, docId: id }), 'Which "' + it.target + '"?'); if (q) return q;
      const e = hits[0], st = C.parseLocal(e.start), en = C.parseLocal(e.end), ne = C.quickAdd('x ' + it.when, now); if (!ne) return { kind: 'none' };
      const nst = C.parseLocal(ne.start), day = HAS_DAY.test(it.when) ? nst : st, hasT = HAS_TIME.test(it.when);
      let start, end;
      if (hasT && !e.allDay || hasT && e.allDay) { const dur = e.allDay ? 3600000 : en - st; start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), nst.getHours(), nst.getMinutes()); end = new Date(start.getTime() + dur); }
      else if (e.allDay) { start = day; end = new Date(day.getTime() + (en - st)); }
      else { start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), st.getHours(), st.getMinutes()); end = new Date(start.getTime() + (en - st)); }
      const upd = { ...e, allDay: e.allDay && !hasT, start: e.allDay && !hasT ? C.dayKey(start) : C.fmtLocal(start), end: e.allDay && !hasT ? C.dayKey(end) : C.fmtLocal(end) };
      if (upd.start === e.start && upd.end === e.end) return { kind: 'show', title: e.title, lines: [e.title + ' is already ' + describe(e, lang, now) + '. Nothing changed.'], openId: e.id };
      return { kind: 'write', title: e.title, said: 'Moved "' + e.title + '" from ' + describe(e, lang, now) + ' to ' + describe(upd, lang, now), store: { ...S, events: C.withEvent(S.events, upd) }, changes: [{ id: e.id, before: e }], openId: e.id };
    }
    case 'delete': {
      const hits = find(it.target, it.docId); if (!hits.length) return { kind: 'none' }; const q = pickOne(hits, (id) => ({ ...it, docId: id }), 'Which "' + it.target + '" do you want deleted?'); if (q) return q; const e = hits[0];
      if (!it.explicit && !it.sure && !it.docId) return { kind: 'confirm', preview: 'Delete "' + e.title + '" (' + describe(e, lang, now) + ')', intent: { ...it, sure: true } };
      return { kind: 'write', title: e.title, said: 'Deleted "' + e.title + '" (' + describe(e, lang, now) + ')', store: { ...S, events: C.withoutEvent(S.events, e.id) }, changes: [{ id: e.id, before: e }], openId: null };
    }
    default: return { kind: 'none' };
  }
}
/** a sentence the stage's own calendar card already took ("add dentist tomorrow 3pm to my calendar"), put into the calendar page's store as well, read by the
 *  page's own quickAdd (length, repeat, reminder): { store, event, line } or null when it reads to nothing or is there already. Pure. */
export function mirror(store, text, now = new Date(), lang = 'en') {
  const t = String(text || '').replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '').replace(/^(?:please\s+)?(?:add|put|schedule|create|book)\s+/i, '').replace(/\s+(?:to|on|in|into)\s+(?:my|the)\s+(?:calendar|calender|agenda)(?:\s+(.+))?$/i, ' $1').replace(/^remind me (?:to |about |of )?/i, '');
  const e = C.quickAdd(t.replace(/\bfor (?:an|a|one) hour\b/i, 'for 1 hour'), now); if (!e) return null; if (/^remind me/i.test(String(text).replace(/^please\s+/i, '')) && !e.reminders.length) e.reminders = [0];
  const S = { ...(store || {}), events: evOf(store) }; if (S.events.some((x) => same(x, e))) return null; const ev = { ...e, title: cap(e.title) };
  return { store: { ...S, events: C.withEvent(S.events, ev) }, event: ev, line: describe(ev, lang, now) };
}
/** the events put back as they were: an added one removed, a changed or deleted one returned. Pure. */
export function undoOf(store, changes) { let events = [...evOf(store)]; for (const c of [...changes].reverse()) { events = events.filter((e) => e.id !== c.id); if (c.before) events.push(c.before); } return { ...(store || {}), events }; }
