// Tools pack 5, export and share (owner, 2026-10-18; numbers 98, 103 to 106, 109, 110): the stage as a JSON file (and back in), as
// plain text for an email, a print-friendly sheet on A4 or Letter, the history of exports and the last 5 copies. Pure; the browser
// work (a download, the print dialog, the clipboard) stays in the skills. Device-local: nothing here sends anything anywhere.
import { tidy } from './stage-pack.js';
import { thingText, thingLabel } from './stage-find.js';

export const EXPORT_VERSION = 1, HISTORY_MAX = 20, COPIES_MAX = 5, IMPORT_MAX_BYTES = 2000000, IMPORT_MAX_THINGS = 300;
export const PAPERS = { A4: { w: 210, h: 297 }, Letter: { w: 215.9, h: 279.4 } };

const STAGE = '(?:the\\s+|my\\s+)?(?:stage|void)';
/**
 * What an export ask wants, or null:
 *  { op: 'json' } "export my stage as json", "back up my stage"   { op: 'import' } "import a stage from json"
 *  { op: 'text' } "email-ready text of my stage"                    { op: 'print', paper } "print view of the stage on A4"
 *  { op: 'history' } "export history"                               { op: 'paper', paper } "use letter paper for printing"
 * "export a print file" / "export the stage as 3mf" stay with the print-file skill. Pure.
 */
export function exportIntent(text) {
  const t = tidy(text).toLowerCase().replace(/[?!.\s]+$/, '');
  const paper = /\ba4\b/.test(t) ? 'A4' : /\b(?:us\s+)?letter\b/.test(t) ? 'Letter' : null;
  if (new RegExp('^(?:please\\s+)?(?:export|download|back\\s*up|backup)\\s+' + STAGE + '(?:\\s+(?:as|to|in)\\s+(?:a\\s+)?(?:json|json\\s+file|file|backup))?$').test(t) || new RegExp('^(?:please\\s+)?save\\s+' + STAGE + '\\s+(?:as|to|in)\\s+(?:a\\s+)?(?:json|json\\s+file|file|backup)$').test(t)) return { op: 'json' };
  if (new RegExp('^(?:please\\s+)?(?:make\\s+(?:me\\s+)?a\\s+)?(?:json\\s+)?backup\\s+of\\s+' + STAGE + '$').test(t)) return { op: 'json' };
  if (new RegExp('^(?:please\\s+)?(?:import|load|restore)\\s+(?:a\\s+|my\\s+)?(?:stage|void)(?:\\s+(?:from|as)\\s+(?:a\\s+)?(?:json|json\\s+file|file|backup))?$').test(t) || /^(?:please\s+)?import\s+(?:a\s+)?(?:stage\s+)?json(?:\s+(?:stage|file))?$/.test(t)) return { op: 'import' };
  if (new RegExp('^(?:please\\s+)?(?:(?:email|mail)[- ]ready|plain[- ]text|text)\\s+(?:dump|copy|version)\\s+of\\s+' + STAGE + '$').test(t) || new RegExp('^(?:please\\s+)?(?:copy|export|give\\s+me)\\s+' + STAGE + '\\s+as\\s+(?:plain\\s+)?text$').test(t) || new RegExp('^(?:please\\s+)?(?:email|mail)[- ]ready\\s+(?:plain\\s+)?text\\s+(?:of|for)\\s+' + STAGE + '$').test(t)) return { op: 'text' };
  if (new RegExp('^(?:please\\s+)?(?:print[- ]friendly\\s+(?:view|layout|page)(?:\\s+of\\s+' + STAGE + ')?|print\\s+view(?:\\s+of\\s+' + STAGE + ')?|print\\s+' + STAGE + '|(?:open\\s+)?the\\s+print\\s+layout)(?:\\s+(?:on|for|in|as)\\s+(?:a4|(?:us\\s+)?letter)(?:\\s+(?:paper|size))?)?$').test(t)) return { op: 'print', paper };
  if (/^(?:please\s+)?(?:use|set|switch\s+to|print\s+on)\s+(?:a4|(?:us\s+)?letter)(?:\s+(?:paper|size|layout))?(?:\s+(?:for|when)\s+print(?:ing)?)?$/.test(t) || /^(?:please\s+)?(?:a4|letter)\s+(?:print\s+)?layout$/.test(t)) return { op: 'paper', paper };
  if (/^(?:please\s+)?(?:show\s+(?:me\s+)?)?(?:my\s+)?(?:export\s+history|exports|history\s+of\s+(?:my\s+)?exports|what\s+(?:have\s+)?i\s+exported)$/.test(t)) return { op: 'history' };
  return null;
}

/** the stage as a JSON file's text: a version, the time, and every thing. Pure. */
export function exportStage(things, now = Date.now()) {
  const list = Object.values(things || {}).filter((t) => t && t.kind);
  return JSON.stringify({ app: 'void', version: EXPORT_VERSION, exportedAt: new Date(now).toISOString(), count: list.length, things: list }, null, 2);
}

const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const URL_KEYS = new Set(['url', 'href', 'src']);
const escText = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = (html) => String(html || '').replace(/<(script|style|button|svg|canvas|select)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

function clean(v, depth) {
  if (depth > 6) return undefined;
  if (Array.isArray(v)) return v.slice(0, 200).map((x) => clean(x, depth + 1));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (BAD_KEYS.has(k)) continue;
      if (URL_KEYS.has(k) && typeof x === 'string' && x && !/^https?:\/\//i.test(x) && !/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(x)) continue; // no javascript: urls
      const c = clean(x, depth + 1);
      if (c !== undefined) o[k] = c;
    }
    return o;
  }
  if (typeof v === 'string') return v.slice(0, 200000);
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  return typeof v === 'boolean' || v === null ? v : undefined;
}

/**
 * Read a stage file. { ok: true, things: [thing], skipped } or { ok: false, why }. Only kinds in `kinds` come in; a kept card's
 * html comes back as its words (a file you did not make never brings markup onto the page); an unsafe link is dropped;
 * a taken id gets a new one. Nothing is applied here. Pure.
 */
export function parseStageImport(text, kinds, taken = new Set()) {
  const s = String(text || '');
  if (!s.trim()) return { ok: false, why: 'the file is empty' };
  if (s.length > IMPORT_MAX_BYTES) return { ok: false, why: 'the file is over 2 MB' };
  let data;
  try { data = JSON.parse(s); } catch (_) { return { ok: false, why: 'that is not a JSON file' }; }
  const arr = Array.isArray(data) ? data : data && Array.isArray(data.things) ? data.things : data && data.things && typeof data.things === 'object' ? Object.values(data.things) : null;
  if (!arr) return { ok: false, why: 'no stage in that file' };
  const allowed = kinds ? new Set(kinds) : null, used = new Set(taken), out = [];
  let skipped = 0;
  for (const raw of arr.slice(0, IMPORT_MAX_THINGS)) {
    if (!raw || typeof raw !== 'object' || typeof raw.kind !== 'string' || !/^[a-z][a-z0-9-]{0,30}$/.test(raw.kind) || (allowed && !allowed.has(raw.kind))) { skipped++; continue; }
    const th = clean(raw, 0);
    if (th.kind === 'kept' && typeof th.html === 'string') th.html = '<p>' + escText(plain(th.html).slice(0, 4000)) + '</p>';
    const x = Number(th.x), y = Number(th.y);
    th.x = Number.isFinite(x) ? Math.min(20000, Math.max(0, x)) : 40; th.y = Number.isFinite(y) ? Math.min(20000, Math.max(0, y)) : 40;
    let id = typeof th.id === 'string' ? th.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) : '';
    if (!id || used.has(id)) id = th.kind + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + out.length;
    used.add(id); th.id = id;
    out.push(th);
  }
  skipped += Math.max(0, arr.length - IMPORT_MAX_THINGS);
  if (!out.length) return { ok: false, why: 'nothing in that file can come onto the stage' };
  return { ok: true, things: out, skipped };
}

const wrap = (s, n = 72, indent = '  ') => {
  const out = []; let line = '';
  for (const w of String(s).split(/\s+/)) { if (line && (line + ' ' + w).length > n) { out.push(line); line = indent + w; } else line = line ? line + ' ' + w : w; }
  if (line) out.push(line);
  return out.join('\n');
};

/** the stage as plain text for an email: a heading, then one wrapped line or block per thing. ASCII bullets, no markup. Pure. */
export function stageTextDump(things, now = Date.now()) {
  const list = Object.values(things || {}).filter((t) => t && t.kind).sort((a, b) => (+a.y || 0) - (+b.y || 0) || (+a.x || 0) - (+b.x || 0));
  const lines = ['My Void stage, ' + new Date(now).toISOString().slice(0, 10) + ' (' + list.length + ' thing' + (list.length === 1 ? '' : 's') + ')', ''];
  if (!list.length) lines.push('(nothing on the stage)');
  for (const th of list) {
    const label = thingLabel(th), all = thingText(th);
    const head = '- ' + th.kind + (label && label.toLowerCase() !== th.kind ? ': ' + label : '');
    lines.push(wrap(head, 72, '  '));
    const items = Array.isArray(th.items) ? th.items.map((i) => (typeof i === 'string' ? i : i && i.text ? (i.done ? '[x] ' : '[ ] ') + i.text : '')).filter(Boolean) : [];
    if (items.length) for (const i of items.slice(0, 40)) lines.push('    * ' + i.slice(0, 120));
    else if (all && all !== label.toLowerCase() && all.length > label.length + 2 && th.kind !== 'kept') lines.push(wrap('    ' + all.slice(0, 400), 72, '    '));
  }
  return lines.join('\n') + '\n';
}

/** the history of exports with this one on top (20 kept). Pure. */
export function historyAdd(list, entry) {
  const e = { at: entry.at, kind: String(entry.kind || '').slice(0, 12), count: Math.max(0, +entry.count || 0), bytes: Math.max(0, +entry.bytes || 0) };
  return [e].concat(Array.isArray(list) ? list : []).slice(0, HISTORY_MAX);
}
export const historyLine = (e) => e.kind + ' · ' + e.count + ' thing' + (e.count === 1 ? '' : 's') + (e.bytes ? ' · ' + (e.bytes < 1024 ? e.bytes + ' B' : Math.round(e.bytes / 1024) + ' kB') : '');

/** the print stylesheet: only the sheet prints, on A4 or Letter. Pure. */
export function printCss(paper) {
  const p = PAPERS[paper] ? paper : 'A4', m = 15;
  return '@media print{@page{size:' + (p === 'A4' ? 'A4' : 'letter') + ';margin:' + m + 'mm}html,body{background:#fff!important;color:#000!important}body>*:not(#p5-print-sheet){display:none!important}#p5-print-sheet{display:block!important;position:static!important;width:auto!important;color:#000;background:#fff;font:11pt/1.4 Georgia,serif}#p5-print-sheet .p5-card{break-inside:avoid;border:1px solid #999;border-radius:4px;padding:6px 8px;margin:0 0 6px}}'
    + '@media screen{#p5-print-sheet{display:none}}';
}

/** the print sheet's cards as plain data (title, kind, lines) so the page builds them with textContent. Pure. */
export function printCards(things) {
  return Object.values(things || {}).filter((t) => t && t.kind).sort((a, b) => (+a.y || 0) - (+b.y || 0) || (+a.x || 0) - (+b.x || 0)).map((t) => {
    const items = Array.isArray(t.items) ? t.items.map((i) => (typeof i === 'string' ? i : i && i.text ? (i.done ? '[x] ' : '[ ] ') + i.text : '')).filter(Boolean) : [];
    const body = items.length ? items.slice(0, 40) : t.kind === 'kept' || !thingText(t) ? [thingText(t).slice(0, 600)].filter(Boolean) : [String(t.text || thingText(t)).slice(0, 600)];
    return { kind: t.kind, title: thingLabel(t), lines: body };
  });
}

// --- the clipboard stack: the last 5 copies made on this page -----------------------------------------------------------

/** the stack with `text` put on top: trimmed, no repeats, 5 kept, nothing empty or enormous or key-like. Pure. */
export function pushCopy(stack, text) {
  const t = String(text == null ? '' : text).replace(/\r\n/g, '\n').trim().slice(0, 4000);
  if (!t || looksSecret(t)) return Array.isArray(stack) ? stack : [];
  return [t].concat((Array.isArray(stack) ? stack : []).filter((x) => x !== t)).slice(0, COPIES_MAX);
}

/** a copy that looks like a key, token or password is never kept in the stack. Pure. */
export function looksSecret(t) {
  const s = String(t || '');
  return /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s) || /\b(?:sk|pk|ghp|gho|xox[abp]|AKIA|AIza)[-_A-Za-z0-9]{16,}/.test(s) || /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/i.test(s) || /^[A-Za-z0-9+/_=-]{40,}$/.test(s.trim()) || /\b(?:password|passwd|secret|api[_ -]?key|token)\s*[:=]\s*\S{6,}/i.test(s);
}

/** { op: 'show' } | { op: 'copy', n } "copy item 2 from the clipboard stack" | { op: 'clear' } | null. Pure. */
export function copyIntent(text) {
  const t = tidy(text).toLowerCase().replace(/[?!.\s]+$/, '');
  let m;
  if (/^(?:please\s+)?(?:show\s+(?:me\s+)?)?(?:my\s+)?(?:clipboard\s+(?:stack|history)|(?:last|recent)\s+(?:5|five)\s+copies|copy\s+(?:stack|history)|what\s+did\s+i\s+copy(?:\s+lately)?)$/.test(t)) return { op: 'show' };
  if ((m = /^(?:please\s+)?(?:copy|paste|recopy)\s+(?:item\s+|number\s+|#)?(\d)\s+(?:from|of|on)\s+(?:the\s+|my\s+)?clipboard\s+(?:stack|history)$/.exec(t)) && +m[1] >= 1 && +m[1] <= COPIES_MAX) return { op: 'copy', n: +m[1] };
  if (/^(?:please\s+)?(?:clear|empty|wipe)\s+(?:the\s+|my\s+)?(?:clipboard\s+(?:stack|history)|copy\s+(?:stack|history))$/.test(t)) return { op: 'clear' };
  return null;
}
