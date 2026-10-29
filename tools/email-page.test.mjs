// Verse's email page (/email/): lib/mail-core.js, all on the device. The messages here are written by hand, byte by byte, as mail programs send
// them. Run: node --test tools/email-page.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../void-live-deploy/lib/mail-core.js';

import { NEWSLETTER } from './email-fixtures.mjs';
const PLAIN = 'From: Ben <ben@example.net>\nTo: ana@example.org\nSubject: Lunch\nDate: Tue, 20 Oct 2026 12:00:00 +0200\n\nSaturday at noon?\n';

test('a multipart mail: encoded-word subject and sender, quoted-printable text, base64 HTML, an RFC 2231 attachment name', () => {
  const m = M.parseMessage(NEWSLETTER);
  assert.equal(m.subject, 'Grüße aus dem Café');
  assert.deepEqual(m.from, [{ name: 'Café Shop', email: 'news@shop.example' }]);
  assert.deepEqual(m.to, [{ name: 'Ana', email: 'ana@example.org' }]);
  assert.match(m.text, /Herbstmenü ist da: Kürbissuppe und Zimtschnecken\. Eine lange Zeile\./);
  assert.match(m.html, /<b>Herbstmenü<\/b>/);
  assert.equal(m.attachments.length, 1); assert.equal(m.attachments[0].name, 'Menü.pdf'); assert.equal(m.attachments[0].type, 'application/pdf');
  assert.equal(Buffer.from(m.attachments[0].bytes).toString(), '%PDF-1.4 fake');
  assert.equal(m.date, Date.UTC(2026, 9, 26, 9));
});
test('an .mbox splits into its messages, ">From " lines unescaped; raw UTF-8 bodies and headers read', () => {
  const u = M.parseMessage(M.binaryOf('From: Zoë <z@x.org>\nSubject: Grüße\n\nNoon at Café Rosa?\n')); assert.equal(u.subject, 'Grüße'); assert.equal(u.from[0].name, 'Zoë'); assert.match(u.text, /Café Rosa/); assert.ok(M.matcher('cafe')(u));
  const mbox = 'From ana@example.org Mon Oct 26 09:00:00 2026\n' + PLAIN + '\nFrom MAILER-DAEMON Tue Oct 20 2026\n' + 'From: c@example.com\nSubject: Two\n\n>From the start\n';
  const parts = M.splitMbox(mbox); assert.equal(parts.length, 2);
  assert.equal(M.parseMessage(parts[0]).subject, 'Lunch'); assert.match(M.parseMessage(parts[1]).text, /^From the start/);
});
test('search with Gmail\'s operators', () => {
  const ms = [M.parseMessage(NEWSLETTER), M.parseMessage(PLAIN)], find = (q) => ms.filter(M.matcher(q)).map((m) => m.subject);
  assert.deepEqual(find('from:ben'), ['Lunch']);
  assert.deepEqual(find('has:attachment'), ['Grüße aus dem Café']);
  assert.deepEqual(find('kurbissuppe'), ['Grüße aus dem Café'], 'accents ignored');
  assert.deepEqual(find('subject:lunch OR subject:cafe'), ['Grüße aus dem Café', 'Lunch']);
  assert.deepEqual(find('after:2026/10/25'), ['Grüße aus dem Café']); assert.deepEqual(find('before:2026-10-25'), ['Lunch']);
  assert.deepEqual(find('-from:shop noon'), ['Lunch']); assert.deepEqual(find('filename:menu'), ['Grüße aus dem Café']);
  assert.deepEqual(find('larger:1k'), ['Grüße aus dem Café']);
});
test('a received message\'s own score adds what its headers say; is:junk finds it', () => {
  const phish = M.parseMessage(M.binaryOf('From: PayPal <service@paypa1-secure.example>\nReply-To: claims@freemail.example\nAuthentication-Results: mx; spf=fail; dkim=fail; dmarc=fail\nSubject: Your account is limited\n\nVerify your account now: http://192.0.2.7/login\n'));
  const s = M.messageScore(phish); assert.ok(s.score >= 5, String(s.score)); for (const id of ['SPF_FAIL', 'DMARC_FAIL', 'DKIM_FAIL', 'REPLYTO_ELSEWHERE', 'IP_LINK']) assert.ok(s.rules.some((r) => r.id === id), id);
  const fine = M.parseMessage(NEWSLETTER); assert.ok(M.messageScore(fine).score < 3);
  assert.deepEqual([phish, fine].filter(M.matcher('is:junk')).map((m) => m.subject), ['Your account is limited']);
  assert.deepEqual([phish, fine].filter(M.matcher('-is:junk')).map((m) => m.from[0].email), ['news@shop.example']);
});
test('the headers: hops oldest first with their delay, SPF, DKIM and DMARC, and the Return-Path on another domain said', () => {
  const a = M.analyzeHeaders(M.parseMessage(NEWSLETTER).headers);
  assert.equal(a.hops.length, 2); assert.match(a.hops[0].from, /app\.shop\.example/); assert.equal(a.hops[1].delay, 35);
  assert.deepEqual(a.auth, { spf: 'pass', dkim: 'pass', dmarc: 'pass' });
  assert.ok(a.warn.some((w) => /Return-Path/.test(w)));
  const raw = 'From: PayPal <service@paypa1-secure.example>\nReply-To: claims@freemail.example\nAuthentication-Results: mx; spf=fail; dkim=none; dmarc=fail\n\nbody';
  const b = M.analyzeHeaders(raw); assert.ok(b.warn.some((w) => /Reply-To/.test(w))); assert.ok(b.warn.some((w) => /SPF: fail/.test(w)) && b.warn.some((w) => /DMARC: fail/.test(w)));
});
test('unsubscribe: the header\'s one-click links and the body\'s', () => {
  const u = M.unsubscribeOf(M.parseMessage(NEWSLETTER));
  assert.deepEqual(u.header, ['mailto:unsub@shop.example?subject=stop', 'https://shop.example/u/123']); assert.equal(u.oneClick, true);
  assert.deepEqual(u.body.map((x) => x.url), ['https://shop.example/prefs?u=1&x=2']);
});
test('the spam score: a plain note reads clean; a shouting, link-hiding draft is likely junk, each reason named', () => {
  const ok = M.spamScore({ subject: 'Lunch on Saturday', body: 'Hi Ben, are you free at noon? Ana', from: 'ana@example.org' });
  assert.ok(ok.score < 3, 'clean: ' + ok.score); assert.equal(ok.verdict, 'reads clean');
  const bad = M.spamScore({ subject: 'URGENT!!! YOU HAVE WON', body: '<p>CLICK HERE to claim $5000 now! Act now!</p><a href="http://192.0.2.1/x">https://paypal.com/login</a> <a href="https://bit.ly/abc">verify your account</a>', from: 'x' });
  assert.ok(bad.score >= 5, 'junk: ' + bad.score); assert.equal(bad.verdict, 'likely junk');
  for (const id of ['SUBJ_ALL_CAPS', 'SPAM_PHRASES', 'LINK_MISMATCH', 'SHORT_LINK', 'IP_LINK', 'BAD_FROM']) assert.ok(bad.rules.some((r) => r.id === id), id);
});
test('writing: a mailto: link (RFC 6068), Gmail\'s and Outlook\'s compose links, and an .eml that reads back the same', () => {
  const d = { to: 'ana@example.org, ben@example.net', cc: 'c@x.org', subject: 'Grüße & more', body: 'Line one\nLine two = fine' };
  const mt = M.mailtoOf(d);
  assert.equal(mt, 'mailto:ana@example.org,ben@example.net?cc=c%40x.org&subject=Gr%C3%BC%C3%9Fe%20%26%20more&body=Line%20one%0D%0ALine%20two%20%3D%20fine');
  assert.match(M.gmailOf(d), /^https:\/\/mail\.google\.com\/mail\/\?view=cm&fs=1&to=ana%40example\.org/);
  assert.match(M.outlookOf(d), /^https:\/\/outlook\.live\.com\/mail\/0\/deeplink\/compose\?to=/);
  const eml = M.emlOf({ ...d, from: 'Ana <ana@example.org>', body: 'Grüße\n' + 'x'.repeat(200) + '\nend = ok' });
  assert.match(eml, /X-Unsent: 1/); assert.ok(eml.split('\r\n').every((l) => l.length <= 998)); assert.ok(eml.split('\r\n\r\n')[1].split('\r\n').every((l) => l.length <= 76));
  const back = M.parseMessage(eml); assert.equal(back.subject, 'Grüße & more'); assert.equal(back.text.replace(/\r\n/g, '\n').replace(/\n$/, ''), 'Grüße\n' + 'x'.repeat(200) + '\nend = ok');
  assert.equal(M.TEMPLATES.en.length, M.TEMPLATES.de.length);
});
test('HTML to words: tags, scripts and styles out, entities in', () => {
  assert.equal(M.htmlText('<style>p{}</style><p>a &amp; b&nbsp;c</p><script>x()</script><p>&#252;&#x00e4;</p>'), 'a & b c\nüä');
});
