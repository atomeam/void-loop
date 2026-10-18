// Template lists (owner's list, 2026-10-18, items 141 to 150, tools pack 6): packing list, travel checklist, meal idea slots, chore wheel,
// bills due, warranty expiry, plant watering, package notes and a guest list, all as one stage card with a template. Manual notes on this
// device only: nothing is sent, no money moves, no carrier is called. Pure. Run: node --test tools/template-list.test.mjs
// ("shopping list" is skills/list.js and was already live.)

export const TPL_LABEL = { packing: 'Packing list', travel: 'Travel checklist', meal: 'Meal ideas', chores: 'Chore wheel', bills: 'Bills due', warranty: 'Warranty expiry', plants: 'Plant watering', package: 'Package notes', guests: 'Guest list' };
export const DATED = new Set(['bills', 'warranty', 'package']);
export const MAX_ITEMS = 60;

const uid = () => Math.random().toString(36).slice(2, 9);
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/^[\s,;:.\-]+|[\s,;:]+$/g, '').trim().slice(0, 80);

// ---- templates ----
export const PACKING_BASE = ['ID or passport', 'Phone and charger', 'Wallet and keys', 'Underwear and socks', 'Tops', 'Bottoms', 'Pajamas', 'Toothbrush and toothpaste', 'Deodorant and toiletries', 'Medications', 'Water bottle', 'Headphones'];
const PACKING_EXTRAS = [
  [/\b(beach|swim|pool|summer|tropical|island|cruise)\b/i, ['Swimsuit', 'Sunscreen', 'Sunglasses', 'Beach towel', 'Sandals', 'Sun hat']],
  [/\b(ski|snow|winter|cold|alps|mountain trip)\b/i, ['Warm coat', 'Gloves and hat', 'Thermal layers', 'Boots', 'Lip balm']],
  [/\b(camp|camping|hike|hiking|trek|outdoor)\b/i, ['Tent', 'Sleeping bag', 'Headlamp', 'First-aid kit', 'Bug spray', 'Water filter']],
  [/\b(business|work|conference|meeting|interview)\b/i, ['Laptop and charger', 'Business clothes', 'Notebook and pen', 'Business cards']],
  [/\b(flight|fly|flying|plane|international|abroad|overseas)\b/i, ['Boarding pass', 'Power adapter', 'Neck pillow', 'Snacks for the trip']],
  [/\b(baby|kid|kids|child|children|family)\b/i, ['Diapers and wipes', 'Snacks', 'Favorite toy', 'Change of clothes']],
  [/\b(gym|workout|sport|run|marathon)\b/i, ['Workout clothes', 'Running shoes', 'Towel']],
  [/\b(weekend|overnight|short)\b/i, []],
];
/** the things to pack, from a base set plus extras for the words in the trip name. Pure. */
export function packingItems(title) {
  const out = PACKING_BASE.slice();
  for (const [re, add] of PACKING_EXTRAS) if (re.test(title || '')) for (const a of add) if (!out.includes(a)) out.push(a);
  return out;
}
export const TRAVEL_BASE = ['Tickets or boarding passes', 'Passport or ID', 'Accommodation confirmation', 'Phone charger and power bank', 'Travel insurance details', 'Check the weather', 'Download offline maps', 'Copies of key documents', 'Lock up and turn off appliances', 'Water the plants', 'Tell someone your plan'];
export const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
export const MEAL_IDEAS = {
  Breakfast: ['Oatmeal with fruit', 'Scrambled eggs on toast', 'Yogurt and granola', 'Pancakes', 'Avocado toast', 'Smoothie and a banana', 'Breakfast burrito', 'Cereal and berries'],
  Lunch: ['Veggie wrap', 'Tomato soup and a sandwich', 'Rice bowl with beans', 'Pasta salad', 'Quesadilla', 'Chickpea salad', 'Leftover stir fry', 'Egg fried rice'],
  Dinner: ['Spaghetti and tomato sauce', 'Sheet-pan chicken and vegetables', 'Lentil curry with rice', 'Veggie tacos', 'Stir fry noodles', 'Baked potatoes and salad', 'Fried rice', 'Homemade pizza'],
  Snack: ['Apple and peanut butter', 'Hummus and carrots', 'Popcorn', 'Cheese and crackers', 'A handful of nuts', 'Fruit and yogurt', 'Toast with jam', 'Rice cakes'],
};
/** an idea for a slot: `pick` is a number in [0,1) so the card can use Math.random and a test a fixed value. Pure. */
export function mealIdea(slot, pick, not = '') {
  const list = (MEAL_IDEAS[slot] || MEAL_IDEAS.Dinner).filter((x) => x !== not);
  return list[Math.min(list.length - 1, Math.floor((+pick || 0) * list.length))];
}

// ---- dates (YYYY-MM-DD) ----
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n) => String(n).padStart(2, '0');
const dayNum = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const keyOf = (n) => { const d = new Date(n * 86400000); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
export const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && keyOf(dayNum(s)) === s;
/** whole days from `today` to `day` (negative when past). Pure. */
export const daysUntil = (day, today) => dayNum(day) - dayNum(today);
export const addDays = (day, n) => keyOf(dayNum(day) + n);

const DATE_RES = [
  /\b(\d{4}-\d{2}-\d{2})\b/,
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i,
  /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?(?:,?\s+(\d{4}))?\b/i,
  /\b(today|tomorrow)\b/i,
  /\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i,
];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
/** find a date inside a phrase: { day, at, len } or null. A date with no year is the next time that day comes round. Pure. */
export function findDate(phrase, today) {
  const s = String(phrase || '');
  let m = DATE_RES[0].exec(s);
  if (m && isDay(m[1])) return { day: m[1], at: m.index, len: m[0].length };
  const mk = (mon, d, y, mm) => {
    const mi = MONTHS.indexOf(String(mon).slice(0, 3).toLowerCase()), dd = +d;
    if (mi < 0 || dd < 1 || dd > 31) return null;
    const ty = +today.slice(0, 4);
    let cand = (y ? +y : ty) + '-' + pad(mi + 1) + '-' + pad(dd);
    if (!isDay(cand)) return null;
    if (!y && daysUntil(cand, today) < 0) cand = (ty + 1) + '-' + pad(mi + 1) + '-' + pad(dd);
    return isDay(cand) ? { day: cand, at: mm.index, len: mm[0].length } : null;
  };
  m = DATE_RES[1].exec(s); if (m) { const r = mk(m[1], m[2], m[3], m); if (r) return r; }
  m = DATE_RES[2].exec(s); if (m) { const r = mk(m[2], m[1], m[3], m); if (r) return r; }
  m = DATE_RES[3].exec(s); if (m) return { day: m[1].toLowerCase() === 'today' ? today : addDays(today, 1), at: m.index, len: m[0].length };
  m = new RegExp('\\b(' + WEEKDAYS.join('|') + ')\\b', 'i').exec(s);
  if (m) { const wd = WEEKDAYS.indexOf(m[1].toLowerCase()); const cur = new Date(dayNum(today) * 86400000).getUTCDay(); const add = ((wd - cur + 7) % 7) || 7; return { day: addDays(today, add), at: m.index, len: m[0].length }; }
  m = DATE_RES[4].exec(s);
  if (m && +m[1] >= 1 && +m[1] <= 31) {
    const [y, mo] = today.split('-').map(Number);
    for (let k = 0; k < 14; k++) { const yy = y + Math.floor((mo - 1 + k) / 12), mm2 = ((mo - 1 + k) % 12) + 1, cand = yy + '-' + pad(mm2) + '-' + pad(+m[1]); if (isDay(cand) && daysUntil(cand, today) >= 0) return { day: cand, at: m.index, len: m[0].length }; }
  }
  return null;
}

/** "in 3 days", "today", "2 days overdue"; `past` is the word for a date that has gone ("overdue", "expired"). Pure. */
export function dueLabel(days, past = 'overdue') {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return days >= 60 ? 'in ' + Math.round(days / 30) + ' months' : 'in ' + days + ' days';
  const n = -days;
  return past === 'expired' ? 'expired ' + (n === 1 ? 'yesterday' : n + ' days ago') : (n === 1 ? '1 day ' : n + ' days ') + past;
}
/** dated items soonest first, undated last, done ones after open ones. Pure. */
export function sortDated(items) {
  return items.slice().sort((a, b) => (!!a.done - !!b.done) || ((a.date ? 0 : 1) - (b.date ? 0 : 1)) || String(a.date || '').localeCompare(String(b.date || '')));
}

// ---- plants ----
/** when a plant is next due: { next, days } (a never-watered plant is due today). Pure. */
export function plantDue(item, today) {
  const every = Math.max(1, Math.min(365, +item.every || 7));
  const next = item.last && isDay(item.last) ? addDays(item.last, every) : today;
  return { next, days: daysUntil(next, today) };
}
/** "every 7 days", "every 3 weeks", "weekly", "twice a month" -> days, or 0. Pure. */
export function everyDays(phrase) {
  const s = String(phrase || '').toLowerCase();
  let m = /\bevery\s+(\d+)\s*(day|days|d|week|weeks|wk|wks|w|month|months)\b/.exec(s);
  if (m) return Math.min(365, +m[1] * (/^w/.test(m[2]) ? 7 : /^m/.test(m[2]) ? 30 : 1));
  m = /\bevery\s+(day|week|month|other\s+day|other\s+week)\b/.exec(s);
  if (m) return { day: 1, week: 7, month: 30, 'other day': 2, 'other week': 14 }[m[1].replace(/\s+/, ' ')] || 0;
  m = /\b(daily|weekly|monthly|fortnightly|biweekly)\b/.exec(s);
  return m ? { daily: 1, weekly: 7, monthly: 30, fortnightly: 14, biweekly: 14 }[m[1]] : 0;
}

// ---- chores ----
/** who has chore i after `offset` turns of the wheel. Pure. */
export const assignee = (people, offset, i) => (people.length ? people[(((i + offset) % people.length) + people.length) % people.length] : '');
// ---- guests ----
export const RSVPS = ['', 'yes', 'maybe', 'no'];
export const rsvpNext = (s) => RSVPS[(RSVPS.indexOf(s || '') + 1) % RSVPS.length];
/** { yes, maybe, no, waiting, heads } where heads counts yes guests and their +1s. Pure. */
export function rsvpCounts(items) {
  const c = { yes: 0, maybe: 0, no: 0, waiting: 0, heads: 0 };
  for (const g of items || []) {
    const r = RSVPS.includes(g.rsvp) ? g.rsvp : '';
    if (r === 'yes') { c.yes++; c.heads += 1 + Math.max(0, Math.min(9, +g.plus || 0)); } else if (r) c[r]++; else c.waiting++;
  }
  return c;
}

// ---- the ask ----
const LEAD = '^(?:please\\s+)?(?:(?:make|build|create|show|start|give|open|set\\s+up|get)\\s+(?:me\\s+)?)?(?:an?\\s+|my\\s+|the\\s+)?';
const TAIL = '(?:\\s+please)?$';
const REST = '(?:\\s*(.*))?';
const RULES = [
  ['packing', new RegExp(LEAD + 'packing\\s+(?:list|checklist)\\s+template' + REST + TAIL, 'i'), true],
  ['packing', new RegExp(LEAD + 'packing\\s+(?:list|checklist)\\s+(?:for|to)\\s+(.+?)' + TAIL, 'i')],
  ['travel', new RegExp(LEAD + '(?:travel|trip|before[\\s-]you[\\s-]go)\\s+(?:checklist|list)(?:\\s+(?:for|to)\\s+(.+?))?' + TAIL, 'i')],
  ['meal', new RegExp(LEAD + 'meal\\s+(?:idea\\s+)?(?:slots?|ideas?\\s+(?:slots?|card|board))(?:\\s+(?:for)\\s+(.+?))?' + TAIL, 'i')],
  ['chores', new RegExp(LEAD + 'chore\\s+(?:wheel|rotation)' + REST + TAIL, 'i')],
  ['bills', new RegExp(LEAD + '(?:bills?\\s+due(?:\\s+(?:list|dates?))?|bill\\s+due\\s+(?:list|dates?))' + REST + TAIL, 'i')],
  ['warranty', new RegExp(LEAD + 'warranty\\s+(?:expiry|expiration|end|dates?)(?:\\s+(?:notes?|list|tracker))?' + REST + TAIL, 'i')],
  ['plants', new RegExp(LEAD + 'plant\\s+(?:watering|water)(?:\\s+(?:interval|intervals|schedule|list|reminders?|tracker))?' + REST + TAIL, 'i')],
  ['package', new RegExp(LEAD + '(?:package|parcel|delivery)\\s+(?:tracking\\s+)?(?:notes?|list)' + REST + TAIL, 'i')],
  ['guests', new RegExp(LEAD + 'guest\\s+list' + REST + TAIL, 'i')],
];
const splitItems = (s) => String(s || '').split(/\s*(?:,|;|\n|⏎)\s*|\s+and\s+(?=\S+\s*$)/i).map(clean).filter(Boolean);

function seedItems(tpl, rest, today) {
  const items = [];
  if (tpl === 'chores' || !rest) return items;
  for (const part of splitItems(rest)) {
    if (tpl === 'plants') {
      const e = everyDays(part);
      const name = clean(part.replace(/\bevery\s+\S+(?:\s+\S+)?\s*(?:days?|weeks?|months?|d|w)?\b/i, '').replace(/\b(daily|weekly|monthly|fortnightly|biweekly)\b/i, '').replace(/\bevery\s+(?:other\s+)?(?:day|week|month)\b/i, ''));
      if (name) items.push({ id: uid(), text: name, every: e || 7, last: '' });
    } else if (DATED.has(tpl)) {
      const d = findDate(part, today);
      const name = clean(d ? part.slice(0, d.at) + ' ' + part.slice(d.at + d.len) : part).replace(/\b(?:on|by|until|due|expires?|expiring|arriving|arrives|expected)\s*$/i, '').trim();
      if (name || d) items.push({ id: uid(), text: clean(name) || 'Untitled', date: d ? d.day : '', done: false });
    } else if (tpl === 'guests') items.push({ id: uid(), text: part, rsvp: '', plus: 0 });
    else items.push({ id: uid(), text: part, done: false });
  }
  return items.slice(0, MAX_ITEMS);
}

/** a template-list ask as a thing's props: { tpl, title, items, ... }, or null. `today` is YYYY-MM-DD. Pure. */
export function parseTemplateAsk(raw, today) {
  const t = String(raw == null ? '' : raw).trim().replace(/[.!]+$/, '');
  if (!t || t.length > 600) return null;
  for (const [tpl, re, templateOnly] of RULES) {
    const m = re.exec(t);
    if (!m) continue;
    let title = '', rest = '';
    if (templateOnly) rest = m[1] || '';
    else if (tpl === 'packing') title = clean(m[1]);
    else if (tpl === 'travel' || tpl === 'meal') title = clean(m[1]);
    else rest = m[1] || '';
    if (rest && tpl === 'chores') rest = rest.trim().replace(/^(?:for\s+|of\s+)?:?\s*/i, '');
    else if (rest) { // "for the party: Sam, Alex" / ": a, b" / "for dishes, trash"
      const colon = /^(?:for\s+|of\s+)?([^:]*?)\s*:\s*(.*)$/i.exec(rest.trim());
      const f = /^(?:for|of)\s+(.+)$/i.exec(rest.trim());
      if (colon) { title = clean(colon[1]); rest = colon[2]; } else if (f) rest = f[1]; else rest = rest.replace(/^:\s*/, '');
    }
    const props = { tpl, title: title.replace(/^(?:a|an|the|my)\s+/i, '') };
    if (tpl === 'packing') props.items = packingItems(title).map((x) => ({ id: uid(), text: x, done: false }));
    else if (tpl === 'travel') props.items = TRAVEL_BASE.map((x) => ({ id: uid(), text: x, done: false }));
    else if (tpl === 'meal') props.items = MEAL_SLOTS.map((x) => ({ id: uid(), text: x, idea: '' }));
    else if (tpl === 'chores') {
      const w = /^(.*?)\s+(?:with|between|among|for)\s+(.+)$/i.exec(rest);
      const chores = splitItems(w ? w[1] : rest), people = splitItems(w ? w[2] : '');
      props.items = (chores.length ? chores : ['Dishes', 'Trash', 'Laundry', 'Vacuum']).slice(0, 20).map((x) => ({ id: uid(), text: x, done: false }));
      props.people = (people.length ? people : ['Me', 'You']).slice(0, 12);
      props.offset = 0;
    } else props.items = seedItems(tpl, rest, today);
    if (tpl === 'chores') props.title = '';
    return props;
  }
  return null;
}
