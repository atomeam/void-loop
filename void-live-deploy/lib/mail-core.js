// Verse's email page (/email/, the Gmail floor), the pure half: everything runs on the device and nothing is sent anywhere. Reading a mail file
// (.eml, RFC 5322 and MIME: folded headers, encoded words, multipart, base64 and quoted-printable, character sets), splitting an .mbox, search
// with Gmail-style operators, a spam score for your own draft, what a message's headers say about where it came from (the hops, SPF, DKIM, DMARC),
// where to unsubscribe, a mailto: link, and a draft saved as an .eml any mail program opens. Verse has no mailbox: it neither sends nor receives
// mail (that needs a mail server, deliverability and abuse handling; see the page). Tests: tools/email-page.test.mjs.

const dec = (bytes, charset = 'utf-8') => { const cs = String(charset || 'utf-8').toLowerCase().replace(/^(?:us-)?ascii$/, 'utf-8'); try { return new TextDecoder(cs).decode(bytes); } catch (_) { return new TextDecoder('utf-8').decode(bytes); } };
const latin1 = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
// The parser reads a message as a binary string, one character per byte, as mail is stored (bytes, not text): bodyBytes() and the character set of each
// part then decode it. binaryOf() turns typed or pasted text into that form; a file is read with fromBytes().
/** bytes as a binary string (one character per byte). Pure. */
export function fromBytes(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return s; }
/** typed or pasted text as the binary string of its UTF-8 bytes. Pure. */
export const binaryOf = (text) => fromBytes(new TextEncoder().encode(String(text || '')));
/** a header value sent as raw UTF-8 (RFC 6532) read as UTF-8; any other value as it is. Pure. */
const utf8Header = (v) => { if (!/[\x80-\xff]/.test(v)) return v; try { return new TextDecoder('utf-8', { fatal: true }).decode(latin1(v)); } catch (_) { return v; } };
/** base64 (with any line breaks or junk) to bytes. Pure. */
export function b64bytes(s) { const t = String(s || '').replace(/[^A-Za-z0-9+/]/g, ''); try { return latin1(atob(t + '==='.slice((t.length + 3) % 4))); } catch (_) { return new Uint8Array(0); } }
/** quoted-printable to bytes (soft line breaks joined; underscores as spaces when `q`, the encoded-word form). Pure. */
export function qpBytes(s, q = false) {
  const t = String(s || '').replace(/=\r?\n/g, ''), out = [];
  for (let i = 0; i < t.length; i++) { const c = t[i]; if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) { out.push(parseInt(t.slice(i + 1, i + 3), 16)); i += 2; } else if (q && c === '_') out.push(32); else { const code = c.charCodeAt(0); if (code < 128) out.push(code); else out.push(...new TextEncoder().encode(c)); } }
  return new Uint8Array(out);
}
/** a header value with its RFC 2047 encoded words (=?utf-8?B?...?= and =?iso-8859-1?Q?...?=) decoded; the space between two encoded words dropped. Pure. */
export function decodeWords(v) {
  return String(v || '').replace(/(=\?[^?\s]+\?[BbQq]\?[^?\s]*\?=)\s+(?==\?)/g, '$1').replace(/=\?([^?\s*]+)(?:\*[^?\s]*)?\?([BbQq])\?([^?\s]*)\?=/g, (_, cs, e, t) => dec(/b/i.test(e) ? b64bytes(t) : qpBytes(t, true), cs));
}
/** the headers of a raw message part, unfolded: [[name, value], ...] in order, names as written. Pure. */
export function headersOf(head) {
  const out = [];
  for (const line of String(head || '').replace(/\r\n/g, '\n').split('\n')) { if (/^[ \t]/.test(line) && out.length) out[out.length - 1][1] += ' ' + line.trim(); else { const m = /^([!-9;-~]+):\s?(.*)$/.exec(line); if (m) out.push([m[1], m[2]]); } }
  for (const hv of out) hv[1] = utf8Header(hv[1]);
  return out;
}
const get = (hs, name) => { const h = hs.find(([n]) => n.toLowerCase() === name.toLowerCase()); return h ? h[1] : ''; };
const all = (hs, name) => hs.filter(([n]) => n.toLowerCase() === name.toLowerCase()).map(([, v]) => v);
/** a header value's main value and parameters: "text/plain; charset=UTF-8" -> { value: 'text/plain', params: { charset: 'UTF-8' } }, RFC 2231 names too. Pure. */
export function params(v) {
  const parts = String(v || '').match(/(?:[^;"]|"(?:\\.|[^"\\])*")+/g) || [''], out = {};
  for (const p of parts.slice(1)) { const m = /^\s*([^=\s]+)\s*=\s*(.*)$/.exec(p); if (!m) continue; let k = m[1].toLowerCase(), val = m[2].trim().replace(/^"(.*)"$/, '$1').replace(/\\(.)/g, '$1');
    if (/\*$/.test(k) || /\*\d+\*?$/.test(k)) { const base = k.replace(/\*.*$/, ''); const mm = /^([^']*)'[^']*'(.*)$/.exec(val); if (mm) val = dec(qpBytes(mm[2].replace(/%([0-9A-Fa-f]{2})/g, '=$1')), mm[1] || 'utf-8'); out[base] = (out[base] || '') + val; } else out[k] = val; }
  return { value: parts[0].trim().toLowerCase(), params: out };
}
const split2 = (raw) => { const s = String(raw || '').replace(/\r\n/g, '\n'), i = s.search(/\n\n/); return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 2)]; };
const bodyBytes = (body, cte) => { const e = String(cte || '').toLowerCase().trim(); return e === 'base64' ? b64bytes(body) : e === 'quoted-printable' ? qpBytes(body) : latin1(body); };
/** a raw message (or MIME part) as a tree of parts, flattened: { headers, text, html, attachments: [{ name, type, size, bytes, cid }] }. Pure. */
export function parsePart(raw, depth = 0) {
  const [head, body] = split2(raw), hs = headersOf(head), ct = params(get(hs, 'content-type') || 'text/plain'), out = { headers: hs, text: '', html: '', attachments: [] };
  if (/^multipart\//.test(ct.value) && ct.params.boundary && depth < 12) {
    const b = '--' + ct.params.boundary, chunks = body.split(new RegExp('(?:^|\\n)' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:--)?[ \\t]*(?=\\n|$)'));
    for (const c of chunks.slice(1)) { const part = c.replace(/^\n/, ''); if (!part.trim()) continue; const sub = parsePart(part, depth + 1);
      if (ct.value === 'multipart/alternative') { if (sub.text && !out.text) out.text = sub.text; if (sub.html) out.html = sub.html; } else { if (sub.text) out.text += (out.text ? '\n\n' : '') + sub.text; if (sub.html && !out.html) out.html = sub.html; }
      out.attachments.push(...sub.attachments); }
    return out;
  }
  const disp = params(get(hs, 'content-disposition')), name = decodeWords(disp.params.filename || ct.params.name || ''), bytes = bodyBytes(body, get(hs, 'content-transfer-encoding'));
  if (ct.value === 'message/rfc822' && depth < 12) { const inner = parsePart(dec(bytes, 'latin1'), depth + 1); out.attachments.push({ name: name || decodeWords(get(inner.headers, 'subject') || 'message') + '.eml', type: 'message/rfc822', size: bytes.length, bytes, cid: '' }); return out; }
  if ((ct.value === 'text/plain' || ct.value === 'text/html') && disp.value !== 'attachment') { const t = dec(bytes, ct.params.charset); if (ct.value === 'text/html') out.html = t; else out.text = t; return out; }
  out.attachments.push({ name: name || 'attachment', type: ct.value, size: bytes.length, bytes, cid: (get(hs, 'content-id') || '').replace(/[<>]/g, '') });
  return out;
}
/** an address list into [{ name, email }]: "Ana <ana@x.org>, bob@y.com". Pure. */
export function addresses(v) {
  const out = [];
  for (const piece of String(decodeWords(v) || '').match(/(?:[^,"]|"[^"]*")+/g) || []) { const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(piece) || /^\s*([^\s@]+@[^\s@]+)\s*(?:\(([^)]*)\))?\s*$/.exec(piece); if (!m) continue; if (piece.includes('<')) out.push({ name: m[1].trim(), email: m[2].trim() }); else out.push({ name: (m[2] || '').trim(), email: m[1].trim() }); }
  return out;
}
/** a whole message read: subject, from, to, cc, date, id, text (or the HTML's words), html, attachments, headers, size. Pure. */
export function parseMessage(raw) {
  const p = parsePart(raw), hs = p.headers, d = Date.parse(get(hs, 'date'));
  return { headers: hs, subject: decodeWords(get(hs, 'subject')), from: addresses(get(hs, 'from')), to: addresses(get(hs, 'to')), cc: addresses(get(hs, 'cc')), replyTo: addresses(get(hs, 'reply-to')),
    date: Number.isFinite(d) ? d : 0, id: get(hs, 'message-id').replace(/[<>]/g, ''), text: p.text || htmlText(p.html), html: p.html, attachments: p.attachments, size: String(raw || '').length };
}
/** the words of an HTML mail, for search and for a plain view (tags, scripts and styles dropped, entities decoded). Pure. */
export function htmlText(html) {
  const ent = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(html || '').replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ent[e.toLowerCase()] ?? m)).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** an .mbox file split into its raw messages (the "From " separator lines dropped, ">From " lines unescaped). Pure. */
export function splitMbox(text) {
  const s = String(text || '').replace(/\r\n/g, '\n'), out = []; let cur = null;
  for (const line of s.split('\n')) { if (/^From \S+/.test(line) && (cur === null || cur.length === 0 || cur[cur.length - 1] === '')) { if (cur && cur.join('').trim()) out.push(cur.join('\n')); cur = []; continue; } if (cur === null) cur = []; cur.push(line.replace(/^>(>*From )/, '$1')); }
  if (cur && cur.join('').trim()) out.push(cur.join('\n'));
  return out;
}
const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const sizeOf = (v) => { const m = /^(\d+(?:\.\d+)?)([kmg]?)b?$/i.exec(String(v || '')); return m ? +m[1] * ({ '': 1, k: 1024, m: 1048576, g: 1073741824 })[m[2].toLowerCase()] : NaN; };
/** a search with Gmail's operators: from:, to:, cc:, subject:, has:attachment, filename:, is:junk (messageScore 5 or more), before: and after: (YYYY-MM-DD or YYYY/MM/DD), larger: and smaller:
 *  (10k, 2M), "a phrase", -word to leave out, OR between words; plain words anywhere. Returns a test for a parsed message. Pure. */
export function matcher(q) {
  const toks = String(q || '').match(/-?\w+:"[^"]*"|-?"[^"]*"|\S+/g) || [], tests = [];
  let anyOf = null;
  const text = (m) => fold([m.subject, m.text, ...m.from.map((a) => a.name + ' ' + a.email), ...m.to.map((a) => a.name + ' ' + a.email), ...m.attachments.map((a) => a.name)].join(' '));
  const who = (list) => fold(list.map((a) => a.name + ' ' + a.email).join(' '));
  const day = (v) => Date.parse(String(v).replace(/\//g, '-') + 'T00:00:00Z');
  for (let i = 0; i < toks.length; i++) {
    let t = toks[i]; if (t === 'OR') continue; const neg = t.startsWith('-') && t.length > 1; if (neg) t = t.slice(1);
    const m = /^(\w+):(.*)$/.exec(t), v = m ? fold(m[2].replace(/^"|"$/g, '')) : fold(t.replace(/^"|"$/g, ''));
    let f;
    if (m && m[1] === 'from') f = (x) => who(x.from).includes(v); else if (m && m[1] === 'to') f = (x) => who([...x.to, ...x.cc]).includes(v); else if (m && m[1] === 'cc') f = (x) => who(x.cc).includes(v);
    else if (m && m[1] === 'subject') f = (x) => fold(x.subject).includes(v); else if (m && m[1] === 'has' && v === 'attachment') f = (x) => x.attachments.length > 0; else if (m && m[1] === 'filename') f = (x) => x.attachments.some((a) => fold(a.name).includes(v));
    else if (m && m[1] === 'before') f = (x) => x.date && x.date < day(v); else if (m && m[1] === 'after') f = (x) => x.date && x.date >= day(v);
    else if (m && m[1] === 'is' && (v === 'junk' || v === 'spam')) f = (x) => messageScore(x).score >= 5;
    else if (m && m[1] === 'larger') f = (x) => x.size > sizeOf(v); else if (m && m[1] === 'smaller') f = (x) => x.size < sizeOf(v);
    else f = (x) => text(x).includes(v);
    const g = neg ? (x) => !f(x) : f;
    if (toks[i + 1] === 'OR' || anyOf) { (anyOf = anyOf || []).push(g); if (toks[i + 1] !== 'OR') { const list = anyOf; tests.push((x) => list.some((h) => h(x))); anyOf = null; } } else tests.push(g);
  }
  return (msg) => tests.every((f) => f(msg));
}

// ---- the spam score of your own draft: rules written for Verse, each named and weighed, in the spirit of the classic content filters ----
const SPAMMY = ['act now', 'limited time', 'click here', 'buy now', 'order now', '100% free', 'risk free', 'risk-free', 'no obligation', 'guaranteed', 'winner', 'you have won', 'congratulations', 'cash bonus', 'earn money', 'make money', 'extra income', 'work from home', 'double your', 'million dollars', 'lowest price', 'best price', 'special promotion', 'urgent', 'apply now', 'call now', 'dear friend', 'this is not spam', 'unsubscribe anytime', 'miracle', 'weight loss', 'lose weight', 'viagra', 'casino', 'crypto giveaway', 'bitcoin giveaway', 'wire transfer', 'bank account details', 'verify your account', 'password expired', 'final notice', 'once in a lifetime', 'no credit check', 'pre-approved', 'free gift', 'free trial', 'cheap', '$$$', '€€€'];
const SHORTENERS = /\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|t\.ly)\//i;
/** a spam score for a draft { subject, body (text or HTML), from }: { score, rules: [{ id, points, why }] }; under 3 reads clean, 3 to 5 risky, 5 and up likely junk.
 *  It judges the words and links only: whether mail lands also depends on the sending server (SPF, DKIM, DMARC, its reputation), which a draft cannot show. Pure. */
export function spamScore({ subject = '', body = '', from = '' } = {}) {
  const rules = [], add = (id, points, why) => rules.push({ id, points, why });
  const html = /<[a-z][\s\S]*>/i.test(body), words = html ? htmlText(body) : String(body), all = (subject + ' ' + words).toLowerCase();
  const letters = subject.replace(/[^A-Za-z]/g, ''); if (letters.length >= 8 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) add('SUBJ_ALL_CAPS', 1.6, 'The subject is mostly capital letters');
  if (!subject.trim()) add('NO_SUBJECT', 1.2, 'There is no subject');
  if (/[!?]{2,}|!.*!.*!/.test(subject)) add('SUBJ_SHOUTS', 1.0, 'The subject has several ! or ?');
  if (/^\s*(?:re|fwd?):/i.test(subject) && !/\n>|wrote:|schrieb:/i.test(words)) add('FAKE_REPLY', 1.4, 'The subject says Re: or Fwd: but nothing is quoted');
  const hits = SPAMMY.filter((p) => all.includes(p)); if (hits.length) add('SPAM_PHRASES', Math.min(3, 0.6 * hits.length), 'Phrases spam filters weigh: ' + hits.slice(0, 6).map((h) => '“' + h + '”').join(', '));
  const caps = (words.match(/\b[A-Z]{4,}\b/g) || []).length, wc = (words.match(/\b\w+\b/g) || []).length || 1; if (caps / wc > 0.1 && caps > 3) add('BODY_CAPS', 1.0, 'Many words in capitals');
  if ((words.match(/!/g) || []).length > 5) add('BODY_SHOUTS', 0.8, 'More than five exclamation marks');
  const links = (body.match(/https?:\/\/[^\s"'<>)]+/gi) || []); if (links.length > 6) add('MANY_LINKS', 1.0, links.length + ' links');
  if (links.some((l) => SHORTENERS.test(l))) add('SHORT_LINK', 1.5, 'A link shortener hides where a link goes');
  if (links.some((l) => /^https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/.test(l))) add('IP_LINK', 2.0, 'A link to a bare IP address');
  if (html) { for (const m of body.matchAll(/<a\b[^>]*href=["']?(https?:\/\/[^"'\s>]+)[^>]*>([\s\S]*?)<\/a>/gi)) { const shown = htmlText(m[2]); const sh = /https?:\/\/([^/\s]+)/i.exec(shown), real = /https?:\/\/([^/\s]+)/i.exec(m[1]); if (sh && real && sh[1].toLowerCase().replace(/^www\./, '') !== real[1].toLowerCase().replace(/^www\./, '')) { add('LINK_MISMATCH', 2.5, 'A link shows ' + sh[1] + ' but goes to ' + real[1]); break; } }
    const imgs = (body.match(/<img\b/gi) || []).length; if (imgs && wc < 25) add('IMAGE_ONLY', 1.8, 'Mostly pictures and few words'); if (/<script|<form|<iframe/i.test(body)) add('ACTIVE_HTML', 2.0, 'Scripts, forms or frames in the HTML'); if (/font-size:\s*[0-2]px|color:\s*#?fff(?:fff)?\b[^>]*>[^<]{20,}/i.test(body)) add('HIDDEN_TEXT', 2.0, 'Text that is tiny or white on white'); }
  if (wc < 8 && links.length) add('LINK_NO_WORDS', 1.2, 'A link with almost no words around it');
  if (/[$€£]\s?\d{3,}|\d{3,}\s?(?:usd|eur|dollars|euros)/i.test(all)) add('MONEY', 0.6, 'Sums of money');
  if (/\b(?:password|passwort|login|verify|bestätigen)\b/i.test(all) && links.length) add('PHISHY', 1.2, 'Asks to log in or verify, with a link');
  if (from && !/^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(String(from).replace(/^.*<|>.*$/g, '').trim())) add('BAD_FROM', 1.0, 'The From address does not look like an address');
  if (/\b(?:newsletter|unsubscribe|abmelden|mailing list)\b/i.test(all) === false && links.length > 3) add('BULK_NO_UNSUB', 0.8, 'Reads like bulk mail but has no way to unsubscribe');
  const score = Math.round(rules.reduce((a, r) => a + r.points, 0) * 10) / 10;
  return { score, verdict: score >= 5 ? 'likely junk' : score >= 3 ? 'risky' : 'reads clean', rules };
}

/** a received message's spam score: its words and links (spamScore), plus what its headers say: a failed SPF or DMARC, a Reply-To on another domain.
 *  The same scale: 5 and up is likely junk. Kept on the message after the first time. Pure but for that cache. */
export function messageScore(m) {
  if (m._score) return m._score;
  const s = spamScore({ subject: m.subject, body: m.html || m.text, from: (m.from[0] || {}).email || '' }), a = analyzeHeaders(m.headers), rules = [...s.rules];
  if (a.auth.spf === 'fail' || a.auth.spf === 'softfail') rules.push({ id: 'SPF_FAIL', points: a.auth.spf === 'fail' ? 2.5 : 1.2, why: 'The sending server is not allowed to send for that domain (SPF ' + a.auth.spf + ')' });
  if (a.auth.dmarc === 'fail') rules.push({ id: 'DMARC_FAIL', points: 2.5, why: 'The From domain\'s own policy rejects it (DMARC fail)' });
  if (a.auth.dkim === 'fail') rules.push({ id: 'DKIM_FAIL', points: 1.5, why: 'Its signature does not match (DKIM fail)' });
  if (a.warn.some((w) => /^Reply-To/.test(w))) rules.push({ id: 'REPLYTO_ELSEWHERE', points: 1.0, why: 'Replies would go to another domain than the sender\'s' });
  const score = Math.round(rules.reduce((x, r) => x + r.points, 0) * 10) / 10;
  return (m._score = { score, verdict: score >= 5 ? 'likely junk' : score >= 3 ? 'risky' : 'reads clean', rules });
}
// ---- what the headers say ----
/** a message's Received hops (oldest first) with the delay at each, its SPF, DKIM and DMARC results, and warnings: Reply-To or Return-Path on another
 *  domain than From, a failed check, a long delay. Takes a parsed message's headers, or raw header text. Pure. */
export function analyzeHeaders(hs) {
  if (typeof hs === 'string') hs = headersOf(split2(hs.replace(/^\s+/, ''))[0]);
  const hops = all(hs, 'received').map((v) => { const at = Date.parse((v.split(';').pop() || '').trim()); const f = /\bfrom\s+(\S+)(?:\s+\(([^)]*)\))?/i.exec(v), b = /\bby\s+(\S+)/i.exec(v), w = /\bwith\s+(\S+)/i.exec(v); return { from: f ? f[1] + (f[2] ? ' (' + f[2] + ')' : '') : '', by: b ? b[1] : '', with: w ? w[1] : '', at: Number.isFinite(at) ? at : 0 }; }).reverse();
  for (let i = 1; i < hops.length; i++) hops[i].delay = hops[i].at && hops[i - 1].at ? Math.round((hops[i].at - hops[i - 1].at) / 1000) : null;
  const ar = all(hs, 'authentication-results').join('; ') + '; ' + all(hs, 'arc-authentication-results').join('; '), res = (k) => { const m = new RegExp('\\b' + k + '=(\\w+)', 'i').exec(ar); return m ? m[1].toLowerCase() : ''; };
  const spfLine = get(hs, 'received-spf'), auth = { spf: res('spf') || (spfLine ? spfLine.split(/\s/)[0].toLowerCase() : ''), dkim: res('dkim') || (get(hs, 'dkim-signature') ? 'signed (not checked here)' : ''), dmarc: res('dmarc') };
  const dom = (v) => { const a = addresses(v)[0]; return a ? a.email.split('@')[1].toLowerCase() : ''; }, base = (d) => d.split('.').slice(-2).join('.');
  const fromD = dom(get(hs, 'from')), warn = [];
  const rt = dom(get(hs, 'reply-to')); if (rt && fromD && base(rt) !== base(fromD)) warn.push('Reply-To goes to ' + rt + ', not to ' + fromD);
  const rp = dom(get(hs, 'return-path')); if (rp && fromD && base(rp) !== base(fromD)) warn.push('Return-Path (bounces) is ' + rp + ', From is ' + fromD + ': common for mailing services, a warning sign otherwise');
  for (const k of ['spf', 'dkim', 'dmarc']) if (/^(fail|softfail|permerror|temperror|none)$/.test(auth[k])) warn.push(k.toUpperCase() + ': ' + auth[k]);
  const total = hops.length > 1 && hops[0].at && hops[hops.length - 1].at ? Math.round((hops[hops.length - 1].at - hops[0].at) / 1000) : null; if (total != null && total > 600) warn.push('It took ' + Math.round(total / 60) + ' minutes to arrive');
  return { from: fromD, hops, auth, warn, total, mailer: get(hs, 'x-mailer') || get(hs, 'user-agent'), id: get(hs, 'message-id') };
}
/** where to unsubscribe: the List-Unsubscribe header's mailto: and https links (one-click when List-Unsubscribe-Post says so) and the body's links that say
 *  unsubscribe, opt out or abmelden. Pure. */
export function unsubscribeOf(msg) {
  const lu = get(msg.headers, 'list-unsubscribe'), list = [...String(lu).matchAll(/<([^>]+)>/g)].map((m) => m[1]).filter((u) => /^(?:https?|mailto):/i.test(u));
  const oneClick = /List-Unsubscribe=One-Click/i.test(get(msg.headers, 'list-unsubscribe-post'));
  const body = []; const re = /<a\b[^>]*href=["']?(https?:\/\/[^"'\s>]+)[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of String(msg.html || '').matchAll(re)) if (/unsubscri|opt.?out|abmelden|abbestellen|preferences|désabonner/i.test(m[1] + ' ' + htmlText(m[2]))) body.push({ url: m[1].replace(/&amp;/g, '&'), text: htmlText(m[2]).slice(0, 80) });
  for (const m of String(msg.text || '').matchAll(/(unsubscri\S*|opt.?out|abmelden)[^\n]{0,80}?(https?:\/\/\S+)/gi)) body.push({ url: m[2], text: m[1] });
  return { header: list, oneClick, body: body.filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i).slice(0, 10), sender: (msg.from[0] || {}).email || '' };
}
// ---- writing ----
const enc = (s) => encodeURIComponent(String(s || '')).replace(/%20/g, '%20');
/** a mailto: link (RFC 6068): to in the path, cc, bcc, subject and body as fields, line breaks as %0D%0A. Pure. */
export function mailtoOf({ to = '', cc = '', bcc = '', subject = '', body = '' } = {}) {
  const q = [['cc', cc], ['bcc', bcc], ['subject', subject], ['body', String(body).replace(/\r?\n/g, '\r\n')]].filter(([, v]) => String(v).trim()).map(([k, v]) => k + '=' + enc(v));
  return 'mailto:' + String(to).split(/[,;]\s*/).filter(Boolean).map((a) => encodeURIComponent(a.trim()).replace(/%40/g, '@')).join(',') + (q.length ? '?' + q.join('&') : '');
}
/** the same draft opened in Gmail's or Outlook.com's own compose window (their public compose addresses; you send it from your own account there). Pure. */
export const gmailOf = ({ to = '', cc = '', bcc = '', subject = '', body = '' } = {}) => 'https://mail.google.com/mail/?view=cm&fs=1' + [['to', to], ['cc', cc], ['bcc', bcc], ['su', subject], ['body', body]].filter(([, v]) => String(v).trim()).map(([k, v]) => '&' + k + '=' + encodeURIComponent(v)).join('');
export const outlookOf = ({ to = '', cc = '', subject = '', body = '' } = {}) => 'https://outlook.live.com/mail/0/deeplink/compose?' + [['to', to], ['cc', cc], ['subject', subject], ['body', body]].filter(([, v]) => String(v).trim()).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
const qp = (s) => String(s).split('\n').map((line) => {
  let e = ''; for (const b of new TextEncoder().encode(line)) e += b === 61 || b > 126 || b < 32 ? '=' + b.toString(16).toUpperCase().padStart(2, '0') : String.fromCharCode(b);
  e = e.replace(/ $/, '=20'); const out = [];
  while (e.length > 75) { let cut = 75; if (e[cut - 1] === '=') cut -= 1; else if (e[cut - 2] === '=') cut -= 2; out.push(e.slice(0, cut) + '='); e = e.slice(cut); }
  out.push(e); return out.join('\r\n');
}).join('\r\n');
const word = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + btoa(String.fromCharCode(...new TextEncoder().encode(s))) + '?=');
/** a draft as an .eml (UTF-8, quoted-printable), marked X-Unsent so mail programs open it ready to send. Pure but for the date and id. */
export function emlOf({ from = '', to = '', cc = '', subject = '', body = '' } = {}, now = new Date()) {
  const id = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(16).padStart(2, '0')).join('');
  return ['MIME-Version: 1.0', 'Date: ' + now.toUTCString().replace('GMT', '+0000'), 'Message-ID: <' + id + '@draft.a-to-mind.com>', from ? 'From: ' + from : '', 'To: ' + to, cc ? 'Cc: ' + cc : '', 'Subject: ' + word(subject), 'X-Unsent: 1',
    'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: quoted-printable', '', qp(String(body).replace(/\r\n/g, '\n'))].filter((l, i, a) => l !== '' || i === a.length - 2).join('\r\n') + '\r\n';
}
/** templates in plain words, English and German: [{ id, name, subject, body }] with [brackets] to fill in. Written for Verse. */
export const TEMPLATES = Object.freeze({
  en: [
    { id: 'follow', name: 'Follow up', subject: 'Following up on [topic]', body: 'Hi [name],\n\nI wanted to follow up on [topic] from [when]. Is there anything you need from me to move it forward?\n\nThanks,\n[your name]' },
    { id: 'thanks', name: 'Thank you', subject: 'Thank you', body: 'Hi [name],\n\nThank you for [what they did]. It made a real difference to [how].\n\nBest,\n[your name]' },
    { id: 'meeting', name: 'Ask for a meeting', subject: 'Could we meet about [topic]?', body: 'Hi [name],\n\nCould we find 30 minutes to talk about [topic]? I am free [two or three times]. If none of those suit you, tell me a time that does.\n\nThanks,\n[your name]' },
    { id: 'late', name: 'Sorry for the late reply', subject: 'Re: [their subject]', body: 'Hi [name],\n\nSorry for the slow reply. [Your answer.]\n\nBest,\n[your name]' },
    { id: 'away', name: 'Out of office', subject: 'Out of office until [date]', body: 'Hello,\n\nI am away until [date] with little access to email. For anything urgent, please write to [colleague] at [address].\n\nI will reply when I am back.\n[your name]' },
    { id: 'intro', name: 'Introduce two people', subject: '[Name A], meet [Name B]', body: 'Hi both,\n\n[Name A], meet [Name B], who [one line about B]. [Name B], meet [Name A], who [one line about A].\n\nI think you two should talk about [why]. I will let you take it from here.\n\n[your name]' },
    { id: 'apply', name: 'Job application', subject: 'Application: [role]', body: 'Dear [hiring manager],\n\nI am applying for the [role] position. I [one line about your experience], and I would bring [what you would bring].\n\nMy CV is attached. I would be glad to talk.\n\nKind regards,\n[your name]\n[phone]' },
    { id: 'complain', name: 'A complaint', subject: 'Complaint about [order or service], reference [number]', body: 'Hello,\n\nOn [date] I [bought or booked] [what], reference [number]. [What went wrong.]\n\nPlease [refund, replace or fix it] by [date]. I have attached [proof].\n\nThank you,\n[your name]' },
  ],
  de: [
    { id: 'follow', name: 'Nachfassen', subject: 'Kurze Nachfrage zu [Thema]', body: 'Hallo [Name],\n\nich wollte kurz zu [Thema] vom [Datum] nachfragen. Brauchen Sie noch etwas von mir, damit es weitergeht?\n\nDanke und viele Grüße\n[Ihr Name]' },
    { id: 'thanks', name: 'Danke', subject: 'Vielen Dank', body: 'Hallo [Name],\n\nvielen Dank für [was die Person getan hat]. Das hat [wie] sehr geholfen.\n\nViele Grüße\n[Ihr Name]' },
    { id: 'meeting', name: 'Um ein Treffen bitten', subject: 'Können wir uns zu [Thema] treffen?', body: 'Hallo [Name],\n\nhätten Sie 30 Minuten Zeit, um über [Thema] zu sprechen? Ich kann [zwei, drei Zeiten]. Wenn nichts davon passt, nennen Sie mir gern eine Zeit.\n\nDanke und viele Grüße\n[Ihr Name]' },
    { id: 'late', name: 'Entschuldigung für die späte Antwort', subject: 'Re: [Betreff]', body: 'Hallo [Name],\n\nentschuldigen Sie die späte Antwort. [Ihre Antwort.]\n\nViele Grüße\n[Ihr Name]' },
    { id: 'away', name: 'Abwesenheit', subject: 'Abwesend bis [Datum]', body: 'Guten Tag,\n\nich bin bis [Datum] nicht im Büro und lese meine E-Mails nur selten. In dringenden Fällen schreiben Sie bitte an [Kollegin oder Kollege] unter [Adresse].\n\nIch antworte, sobald ich zurück bin.\n[Ihr Name]' },
    { id: 'intro', name: 'Zwei Menschen vorstellen', subject: '[Name A], darf ich vorstellen: [Name B]', body: 'Hallo Sie beide,\n\n[Name A], das ist [Name B], [ein Satz über B]. [Name B], das ist [Name A], [ein Satz über A].\n\nIch glaube, Sie sollten über [warum] sprechen. Ab hier überlasse ich es Ihnen.\n\n[Ihr Name]' },
    { id: 'apply', name: 'Bewerbung', subject: 'Bewerbung als [Stelle]', body: 'Sehr geehrte Damen und Herren,\n\nhiermit bewerbe ich mich als [Stelle]. Ich [ein Satz zu Ihrer Erfahrung] und würde [was Sie mitbringen] mitbringen.\n\nMeinen Lebenslauf finden Sie im Anhang. Ich freue mich auf ein Gespräch.\n\nMit freundlichen Grüßen\n[Ihr Name]\n[Telefon]' },
    { id: 'complain', name: 'Beschwerde', subject: 'Beschwerde zu [Bestellung oder Leistung], Nummer [Nummer]', body: 'Guten Tag,\n\nam [Datum] habe ich [was] [gekauft oder gebucht], Nummer [Nummer]. [Was schiefging.]\n\nBitte [erstatten, ersetzen oder beheben] Sie das bis zum [Datum]. [Belege] liegen bei.\n\nVielen Dank\n[Ihr Name]' },
  ],
});
