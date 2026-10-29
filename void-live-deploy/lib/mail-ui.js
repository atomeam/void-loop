// /email/: the screen of Verse's email page (lib/mail-core.js), all on the device: write with templates and open the draft in your own mail
// (a mailto: link, Gmail's or Outlook.com's compose window, or an .eml file), a spam score as you type, read .eml and .mbox files with search, see
// what a message's headers say, and find where to unsubscribe. Kept on this device (localStorage a2m.void.email.v1): your drafts, signature and
// From line. Mail files you open stay in this tab's memory and are gone when it closes.
import { fromBytes, binaryOf, parseMessage, splitMbox, matcher, spamScore, messageScore, analyzeHeaders, unsubscribeOf, mailtoOf, gmailOf, outlookOf, emlOf, TEMPLATES } from './mail-core.js';

const STORE = 'a2m.void.email.v1';
const S = {
  en: { tabs: ['Write', 'Read mail files', 'Check a message'], honest: 'Verse cannot send or receive email: it has no mailbox and no address for you. Write here and send from your own mail in one tap; read the .eml and .mbox files your mail program saves; check a draft or a message you got. Nothing leaves this device.',
    tpl: 'Start from a template', none: 'Blank', from: 'From (optional, for the .eml)', to: 'To', cc: 'Cc', bcc: 'Bcc', subject: 'Subject', body: 'Message', sig: 'Signature (added at the end)', openApp: 'Open in my mail app', gmail: 'Open in Gmail', outlook: 'Open in Outlook.com', copy: 'Copy the text', copied: 'Copied', eml: 'Save as .eml', saveDraft: 'Save draft', drafts: 'Drafts on this device', del: 'Delete', open: 'Open', long: 'This draft is long for a mailto: link; some mail apps cut it. Save it as .eml instead.',
    score: 'Spam check of this draft', verdict: { 'reads clean': 'reads clean', risky: 'risky', 'likely junk': 'likely junk' }, scoreNote: 'Judges the words and links only. Whether mail lands also depends on the sending server (SPF, DKIM, DMARC, its reputation), which a draft cannot show.', noRules: 'Nothing a spam filter would mind.',
    pick: 'Choose .eml or .mbox files', drop: 'or drop them here', sample: 'Try a sample message', search: 'Search', searchPh: 'from:ana has:attachment after:2026/01/01 "exact words"', ops: 'Operators: from:, to:, cc:, subject:, has:attachment, filename:, is:junk, before:, after:, larger:, smaller:, -word, OR', junk: 'likely junk', msgs: (n) => n + (n === 1 ? ' message' : ' messages'), noMsgs: 'No mail files opened yet. They are read on this device and forgotten when you close the tab.',
    back: 'Back to the list', att: 'Attachments', showHtml: 'Show the formatted mail (remote pictures blocked)', plain: 'Plain text', headers: 'What the headers say', hops: 'Hops (oldest first)', auth: 'Checks', warn: 'Warnings', noWarn: 'No warning signs in the headers.', unsub: 'Unsubscribe', oneClick: 'one-click unsubscribe offered', noUnsub: 'No unsubscribe link found.', bodyLinks: 'Links in the mail that say unsubscribe',
    paste: 'Paste a whole message or just its headers (in Gmail: ⋮ → Show original)', check: 'Check it', delay: (s) => s == null ? '' : s < 60 ? s + ' s later' : Math.round(s / 60) + ' min later', from2: 'From', to2: 'To', date: 'Date', fwdSpam: 'Its spam score', reply: 'Reply', none2: '—', blocked: (n) => n + (n === 1 ? ' remote picture' : ' remote pictures') + ' blocked: a picture fetched from the sender’s server can tell them you opened the mail' },
  de: { tabs: ['Schreiben', 'Mail-Dateien lesen', 'Eine Nachricht prüfen'], honest: 'Verse kann keine E-Mails senden oder empfangen: Es hat kein Postfach und keine Adresse für Sie. Schreiben Sie hier und senden Sie mit einem Tipp aus Ihrem eigenen Mailprogramm; lesen Sie die .eml- und .mbox-Dateien, die Ihr Mailprogramm speichert; prüfen Sie einen Entwurf oder eine erhaltene Nachricht. Nichts verlässt dieses Gerät.',
    tpl: 'Mit einer Vorlage beginnen', none: 'Leer', from: 'Von (freiwillig, für die .eml)', to: 'An', cc: 'Cc', bcc: 'Bcc', subject: 'Betreff', body: 'Nachricht', sig: 'Signatur (wird am Ende angefügt)', openApp: 'In meinem Mailprogramm öffnen', gmail: 'In Gmail öffnen', outlook: 'In Outlook.com öffnen', copy: 'Text kopieren', copied: 'Kopiert', eml: 'Als .eml speichern', saveDraft: 'Entwurf speichern', drafts: 'Entwürfe auf diesem Gerät', del: 'Löschen', open: 'Öffnen', long: 'Dieser Entwurf ist lang für einen mailto:-Link; manche Mailprogramme schneiden ihn ab. Speichern Sie ihn lieber als .eml.',
    score: 'Spam-Prüfung dieses Entwurfs', verdict: { 'reads clean': 'unbedenklich', risky: 'riskant', 'likely junk': 'wahrscheinlich Spam' }, scoreNote: 'Bewertet nur Wörter und Links. Ob eine Mail ankommt, hängt auch vom sendenden Server ab (SPF, DKIM, DMARC, sein Ruf), den ein Entwurf nicht zeigen kann.', noRules: 'Nichts, woran sich ein Spamfilter stören würde.',
    pick: '.eml- oder .mbox-Dateien wählen', drop: 'oder hier ablegen', sample: 'Eine Beispielnachricht ansehen', search: 'Suchen', searchPh: 'from:ana has:attachment after:2026/01/01 "genaue Wörter"', ops: 'Operatoren: from:, to:, cc:, subject:, has:attachment, filename:, is:junk, before:, after:, larger:, smaller:, -Wort, OR', junk: 'wahrscheinlich Spam', msgs: (n) => n + (n === 1 ? ' Nachricht' : ' Nachrichten'), noMsgs: 'Noch keine Mail-Dateien geöffnet. Sie werden auf diesem Gerät gelesen und vergessen, wenn Sie den Tab schließen.',
    back: 'Zurück zur Liste', att: 'Anhänge', showHtml: 'Formatierte Mail zeigen (Bilder aus dem Netz gesperrt)', plain: 'Nur Text', headers: 'Was die Kopfzeilen sagen', hops: 'Stationen (älteste zuerst)', auth: 'Prüfungen', warn: 'Warnungen', noWarn: 'Keine Warnzeichen in den Kopfzeilen.', unsub: 'Abmelden', oneClick: 'Abmelden mit einem Klick angeboten', noUnsub: 'Kein Abmeldelink gefunden.', bodyLinks: 'Links in der Mail, die abmelden sagen',
    paste: 'Fügen Sie eine ganze Nachricht oder nur ihre Kopfzeilen ein (in Gmail: ⋮ → Original anzeigen)', check: 'Prüfen', delay: (s) => s == null ? '' : s < 60 ? s + ' s später' : Math.round(s / 60) + ' Min. später', from2: 'Von', to2: 'An', date: 'Datum', fwdSpam: 'Ihre Spam-Bewertung', reply: 'Antworten', none2: '—', blocked: (n) => n + (n === 1 ? ' Bild aus dem Netz' : ' Bilder aus dem Netz') + ' gesperrt: Ein Bild vom Server des Absenders kann ihm verraten, dass Sie die Mail geöffnet haben' },
};
const SAMPLE = ['From: Café Shop <news@shop.example>', 'To: You <you@example.org>', 'Subject: Our autumn menu is here', 'Date: Mon, 26 Oct 2026 09:00:00 +0000', 'Message-ID: <sample1@shop.example>',
  'Received: from app.shop.example (app.shop.example [198.51.100.7]) by mail.example-esp.com with ESMTP; Mon, 26 Oct 2026 09:00:05 +0000', 'Received: from mail.example-esp.com (mail.example-esp.com [203.0.113.5]) by mx.example.org with ESMTPS; Mon, 26 Oct 2026 09:00:40 +0000',
  'Authentication-Results: mx.example.org; spf=pass smtp.mailfrom=example-esp.com; dkim=pass header.d=shop.example; dmarc=pass header.from=shop.example', 'Return-Path: <bounce-1@example-esp.com>',
  'List-Unsubscribe: <https://shop.example/unsubscribe?u=1>, <mailto:unsub@shop.example>', 'List-Unsubscribe-Post: List-Unsubscribe=One-Click', 'MIME-Version: 1.0', 'Content-Type: multipart/alternative; boundary="b"', '',
  '--b', 'Content-Type: text/plain; charset=utf-8', '', 'Hello! Pumpkin soup and cinnamon buns are back. See the menu: https://shop.example/menu', '', 'Unsubscribe: https://shop.example/unsubscribe?u=1', '--b', 'Content-Type: text/html; charset=utf-8', '',
  '<p>Hello! <b>Pumpkin soup</b> and cinnamon buns are back.</p><p><a href="https://shop.example/menu">See the menu</a></p><img src="https://track.shop.example/open.gif" alt=""><p><a href="https://shop.example/unsubscribe?u=1">Unsubscribe</a></p>', '--b--', ''].join('\r\n');
const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else if (k === 'value') e.value = v; else e.setAttribute(k, v === true ? '' : v); } for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : String(k)); return e; };
const when = (t) => (t ? new Date(t).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const who = (list) => list.map((a) => (a.name ? a.name + ' <' + a.email + '>' : a.email)).join(', ');
const download = (name, data, type) => { const a = h('a', { href: URL.createObjectURL(new Blob([data], { type })), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };

export function mountMail(root, { lang = 'en' } = {}) {
  const T = S[lang] || S.en, tpls = TEMPLATES[lang] || TEMPLATES.en;
  let st = { drafts: [], sig: '', from: '' }; try { st = { ...st, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch (_) { /* blocked storage */ }
  const keep = () => { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (_) { /* full or blocked: this visit only */ } };
  const q = new URLSearchParams(location.search);
  let tab = ['write', 'read', 'check'].includes(q.get('tab')) ? q.get('tab') : 'write', msgs = [], openIx = -1, query = q.get('q') || '';
  const sample = q.get('sample') === '1'; // ?sample=1: the read tab opens with the sample message, the check tab checks it
  if (sample) msgs.push(parseMessage(binaryOf(SAMPLE)));
  const draft = { to: q.get('to') || '', cc: '', bcc: '', subject: q.get('subject') || '', body: q.get('body') || '', from: st.from || '' };
  const live = h('p', { class: 'live', role: 'status', 'aria-live': 'polite' }), say = (t) => { live.textContent = t; clearTimeout(say.t); say.t = setTimeout(() => { live.textContent = ''; }, 3000); };
  const bar = h('div', { class: 'tabs', role: 'tablist' }), body = h('div', { class: 'mbody' });
  root.replaceChildren(h('p', { class: 'notice', id: 'm-honest' }, T.honest), bar, live, body);
  const setTab = (t) => { tab = t; const u = new URL(location.href); u.searchParams.set('tab', t); history.replaceState(null, '', u.pathname + u.search); draw(); };
  function draw() {
    bar.replaceChildren(...['write', 'read', 'check'].map((k, i) => h('button', { role: 'tab', id: 'tab-' + k, 'aria-selected': tab === k ? 'true' : 'false', on: { click: () => setTab(k) } }, T.tabs[i])));
    body.replaceChildren(tab === 'write' ? writeView() : tab === 'read' ? readView() : checkView());
    document.documentElement.dataset.mailReady = '1';
  }
  // ---- write ----
  const full = () => ({ ...draft, body: draft.body + (st.sig ? '\n\n-- \n' + st.sig : '') });
  function writeView() {
    const f = (k, label, type = 'text', extra = {}) => h('div', { class: 'field' }, h('label', { for: 'w-' + k }, label), h(type === 'area' ? 'textarea' : 'input', { id: 'w-' + k, ...(type === 'area' ? { rows: '9' } : { type }), value: draft[k], ...extra, on: { input: (e) => { draft[k] = e.target.value; if (k === 'from') { st.from = draft.from; keep(); } refresh(); } } }));
    const sel = h('select', { id: 'w-tpl', on: { change: (e) => { const t = tpls.find((x) => x.id === e.target.value); if (t) { draft.subject = t.subject; draft.body = t.body; document.getElementById('w-subject').value = t.subject; document.getElementById('w-body').value = t.body; refresh(); } } } }, h('option', { value: '' }, T.none), ...tpls.map((t) => h('option', { value: t.id }, t.name)));
    const links = h('div', { class: 'row', id: 'w-links' }), scoreBox = h('div', { class: 'panel', id: 'w-score', 'aria-live': 'polite' }), longNote = h('p', { class: 'soft', hidden: true }, T.long);
    function refresh() {
      const d = full(), mt = mailtoOf(d);
      links.replaceChildren(h('a', { class: 'btn go', id: 'w-mailto', href: mt }, T.openApp), h('a', { class: 'btn', id: 'w-gmail', href: gmailOf(d), target: '_blank', rel: 'noopener noreferrer' }, T.gmail), h('a', { class: 'btn', id: 'w-outlook', href: outlookOf(d), target: '_blank', rel: 'noopener noreferrer' }, T.outlook),
        h('button', { id: 'w-copy', on: { click: async () => { try { await navigator.clipboard.writeText((d.subject ? d.subject + '\n\n' : '') + d.body); say(T.copied); } catch (_) {} } } }, T.copy),
        h('button', { id: 'w-eml', on: { click: () => download((d.subject || 'draft').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) + '.eml', emlOf(d), 'message/rfc822') } }, T.eml),
        h('button', { id: 'w-save', on: { click: () => { st.drafts = [{ ...draft, at: Date.now() }, ...st.drafts.filter((x) => !(x.subject === draft.subject && x.to === draft.to))].slice(0, 30); keep(); draw(); } } }, T.saveDraft));
      longNote.hidden = mt.length < 2000;
      const s = spamScore({ subject: d.subject, body: d.body, from: d.from });
      scoreBox.replaceChildren(h('h2', {}, T.score), h('p', { class: 'big' }, String(s.score), h('small', { class: 'v-' + s.verdict.replace(/\s/g, '') }, ' · ' + T.verdict[s.verdict])),
        s.rules.length ? h('ul', { class: 'plain' }, ...s.rules.map((r) => h('li', {}, h('strong', {}, '+' + r.points + ' '), r.why, h('span', { class: 'soft' }, ' (' + r.id + ')')))) : h('p', { class: 'soft' }, T.noRules), h('p', { class: 'note' }, T.scoreNote));
    }
    const sig = h('details', { class: 'panel' }, h('summary', {}, T.sig), h('textarea', { id: 'w-sig', rows: '3', 'aria-label': T.sig, value: st.sig, on: { input: (e) => { st.sig = e.target.value; keep(); refresh(); } } }));
    const drafts = st.drafts.length ? h('div', { class: 'panel' }, h('h2', {}, T.drafts), h('ul', { class: 'plain' }, ...st.drafts.map((d, i) => h('li', { class: 'row' }, h('span', { class: 'grow' }, (d.subject || '…') + (d.to ? ' → ' + d.to : '')), h('button', { on: { click: () => { Object.assign(draft, d); draw(); } } }, T.open), h('button', { on: { click: () => { st.drafts.splice(i, 1); keep(); draw(); } } }, T.del))))) : '';
    const out = h('div', {}, h('div', { class: 'field' }, h('label', { for: 'w-tpl' }, T.tpl), sel), f('to', T.to, 'email', { multiple: true, autocomplete: 'email' }), h('div', { class: 'grid2' }, f('cc', T.cc, 'email', { multiple: true }), f('bcc', T.bcc, 'email', { multiple: true })), f('subject', T.subject), f('body', T.body, 'area'), sig, f('from', T.from, 'text', { autocomplete: 'email' }), links, longNote, scoreBox, drafts);
    setTimeout(refresh, 0); return out;
  }
  // ---- read ----
  async function addFiles(files) {
    for (const file of files) { const text = fromBytes(new Uint8Array(await file.arrayBuffer())); const raws = /^From \S+.*\n/.test(text.slice(0, 300)) ? splitMbox(text) : [text]; for (const r of raws) { try { msgs.push(parseMessage(r)); } catch (_) { /* a part that does not read is skipped */ } } }
    msgs.sort((a, b) => b.date - a.date); openIx = -1; tab = 'read'; draw();
  }
  function readView() {
    if (openIx >= 0 && msgs[openIx]) return messageView(msgs[openIx]);
    const pick = h('input', { type: 'file', id: 'r-file', multiple: true, accept: '.eml,.mbox,.txt,message/rfc822,application/mbox', class: 'pick', on: { change: (e) => addFiles([...e.target.files]) } });
    const drop = h('div', { class: 'drop', tabindex: '0', on: { dragover: (e) => { e.preventDefault(); drop.classList.add('over'); }, dragleave: () => drop.classList.remove('over'), drop: (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); } } },
      h('label', { for: 'r-file', class: 'btn go' }, T.pick), pick, h('span', { class: 'soft' }, ' ' + T.drop + ' · '), h('button', { id: 'r-sample', on: { click: () => { msgs.push(parseMessage(binaryOf(SAMPLE))); msgs.sort((a, b) => b.date - a.date); draw(); } } }, T.sample));
    const sinp = h('input', { type: 'search', id: 'r-q', value: query, placeholder: T.searchPh, 'aria-label': T.search, on: { input: (e) => { query = e.target.value; paint(); } } });
    const list = h('ul', { class: 'mlist', id: 'r-list' }), count = h('p', { class: 'soft' });
    function paint() {
      const test = query.trim() ? matcher(query) : () => true, rows = msgs.map((m, i) => [m, i]).filter(([m]) => test(m));
      count.textContent = msgs.length ? T.msgs(rows.length) + (query ? ' / ' + msgs.length : '') : T.noMsgs;
      list.replaceChildren(...rows.slice(0, 500).map(([m, i]) => h('li', {}, h('button', { class: 'mrow', on: { click: () => { openIx = i; draw(); } } }, h('span', { class: 'mf' }, who(m.from) || T.none2), h('span', { class: 'md' }, when(m.date)), h('span', { class: 'ms' }, (messageScore(m).score >= 5 ? '⚠ ' + T.junk + ' · ' : '') + (m.attachments.length ? '📎 ' : '') + (m.subject || '…')), h('span', { class: 'mx' }, m.text.replace(/\s+/g, ' ').slice(0, 120))))));
    }
    setTimeout(paint, 0);
    return h('div', {}, drop, h('div', { class: 'field' }, h('label', { for: 'r-q' }, T.search), sinp), h('p', { class: 'soft' }, T.ops), count, list);
  }
  function analysisOf(m) {
    const a = analyzeHeaders(m.headers), u = unsubscribeOf(m), s = messageScore(m);
    return h('div', {},
      h('details', { class: 'panel', open: true, id: 'm-head' }, h('summary', {}, T.headers),
        h('h3', {}, T.auth), h('dl', { class: 'dl' }, ...['spf', 'dkim', 'dmarc'].map((k) => h('div', {}, h('dt', {}, k.toUpperCase()), h('dd', { class: /pass/.test(a.auth[k]) ? 'ok' : a.auth[k] ? 'bad' : 'soft' }, a.auth[k] || T.none2)))),
        h('h3', {}, T.warn), a.warn.length ? h('ul', { class: 'plain' }, ...a.warn.map((w) => h('li', { class: 'bad' }, '⚠ ' + w))) : h('p', { class: 'ok' }, T.noWarn),
        a.hops.length ? h('div', {}, h('h3', {}, T.hops), h('ol', { class: 'hops' }, ...a.hops.map((x) => h('li', {}, h('strong', {}, x.from || '?'), ' → ', x.by || '?', x.with ? ' (' + x.with + ')' : '', h('span', { class: 'soft' }, ' ' + when(x.at) + (x.delay != null ? ' · ' + T.delay(x.delay) : '')))))) : ''),
      h('details', { class: 'panel', open: true, id: 'm-unsub' }, h('summary', {}, T.unsub),
        u.header.length || u.body.length ? h('ul', { class: 'plain' }, ...u.header.map((l) => h('li', {}, h('a', { class: 'btn', href: l, target: '_blank', rel: 'noopener noreferrer' }, (l.startsWith('mailto:') ? '✉ ' : '↗ ') + l.replace(/^mailto:|^https?:\/\//, '').slice(0, 60)), u.oneClick && /^https/.test(l) ? h('span', { class: 'soft' }, ' ' + T.oneClick) : '')),
          ...(u.body.length ? [h('li', { class: 'soft' }, T.bodyLinks), ...u.body.map((b) => h('li', {}, h('a', { href: b.url, target: '_blank', rel: 'noopener noreferrer nofollow' }, b.text || b.url)))] : [])) : h('p', { class: 'soft' }, T.noUnsub)),
      h('details', { class: 'panel' }, h('summary', {}, T.fwdSpam + ': ' + s.score + ' · ' + T.verdict[s.verdict]), s.rules.length ? h('ul', { class: 'plain' }, ...s.rules.map((r) => h('li', {}, '+' + r.points + ' ' + r.why))) : h('p', { class: 'soft' }, T.noRules)));
  }
  function messageView(m) {
    const frame = h('div', { id: 'm-frame' }), pre = h('pre', { class: 'mtext' }, m.text);
    const showHtml = (e) => { // the mail's HTML in a sandbox: no scripts, no forms, nothing fetched from the network (tracking pixels blocked), links open apart
      if (frame.firstChild) { frame.replaceChildren(); pre.hidden = false; e.target.textContent = T.showHtml; return; }
      const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'"><base target="_blank">';
      const f = h('iframe', { sandbox: 'allow-popups allow-popups-to-escape-sandbox', title: m.subject || 'mail', class: 'mframe', referrerpolicy: 'no-referrer' }); f.srcdoc = csp + m.html; const n = (m.html.match(/<img\b[^>]*\bsrc=["']?https?:/gi) || []).length; frame.replaceChildren(...(n ? [h('p', { class: 'soft', id: 'm-blocked' }, '🛡 ' + T.blocked(n))] : []), f); pre.hidden = true; e.target.textContent = T.plain;
    };
    const reply = { to: (m.replyTo[0] || m.from[0] || {}).email || '', subject: /^re:/i.test(m.subject) ? m.subject : 'Re: ' + m.subject, body: '\n\n' + (lang === 'de' ? 'Am ' + when(m.date) + ' schrieb ' : 'On ' + when(m.date) + ', ') + who(m.from) + (lang === 'de' ? ':' : ' wrote:') + '\n' + m.text.split('\n').map((l) => '> ' + l).join('\n') };
    return h('article', { class: 'msg' }, h('button', { id: 'm-back', on: { click: () => { openIx = -1; draw(); } } }, '← ' + T.back), h('h2', { id: 'm-subject' }, m.subject || '…'),
      h('dl', { class: 'dl' }, h('div', {}, h('dt', {}, T.from2), h('dd', {}, who(m.from))), h('div', {}, h('dt', {}, T.to2), h('dd', {}, who([...m.to, ...m.cc]))), h('div', {}, h('dt', {}, T.date), h('dd', {}, when(m.date)))),
      h('div', { class: 'row' }, m.html ? h('button', { id: 'm-html', on: { click: showHtml } }, T.showHtml) : '', h('button', { id: 'm-reply', on: { click: () => { Object.assign(draft, reply); tab = 'write'; openIx = -1; draw(); } } }, T.reply)),
      frame, pre,
      m.attachments.length ? h('div', { class: 'panel' }, h('h3', {}, T.att), h('ul', { class: 'plain' }, ...m.attachments.map((a) => h('li', {}, h('button', { on: { click: () => download(a.name, a.bytes, a.type) } }, '⬇ ' + a.name), h('span', { class: 'soft' }, ' ' + a.type + ' · ' + Math.max(1, Math.round(a.size / 1024)) + ' KB'))))) : '',
      analysisOf(m));
  }
  // ---- check a pasted message ----
  function checkView() {
    const ta = h('textarea', { id: 'c-raw', rows: '10', 'aria-label': T.paste, placeholder: 'Received: from …\nFrom: …\nSubject: …' }), out = h('div', { id: 'c-out' });
    if (sample) { ta.value = SAMPLE; out.append(analysisOf(parseMessage(binaryOf(SAMPLE)))); }
    return h('div', {}, h('div', { class: 'field' }, h('label', { for: 'c-raw' }, T.paste), ta), h('div', { class: 'row' }, h('button', { class: 'go', id: 'c-go', on: { click: () => { const raw = ta.value.trim(); if (!raw) return; out.replaceChildren(analysisOf(parseMessage(binaryOf(/\n\s*\n/.test(raw) ? raw : raw + '\n\n')))); } } }, T.check), h('button', { on: { click: () => { ta.value = SAMPLE; } } }, T.sample)), out);
  }
  draw();
  return { messages: () => msgs, draft };
}
