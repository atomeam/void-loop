// The email worker (email-worker/index.js, docs/intake.md): a buyer's reply routed to it is always forwarded on to
// the owner's inbox; a subject carrying [sale:<id>] also has its text body read out of the raw MIME and posted to
// /api/handoff, which attaches it to the job. No outside service: this replaces the Gmail filter and the Zapier zap.
// Run: node --test tools/email-worker.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SALE_TAG_RE, textBodyOf, handleEmail } from '../email-worker/index.js';

const CRLF = (s) => s.replace(/\n/g, '\r\n');
const MULTIPART = CRLF(`From: Maria <maria@sunrisebakery.example>
Subject: Re: your receipt [sale:s-1]
Content-Type: multipart/alternative; boundary="b1"

--b1
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

Hi Adam, the Zapier zap double=
s every order =E2=80=94 please fix it.

--b1
Content-Type: text/html; charset="UTF-8"

<p>Hi Adam, the Zapier zap doubles every order</p>
--b1--
`);

const msg = (raw, subject, from = 'maria@sunrisebakery.example') => {
  const forwards = [];
  return { from, raw, headers: new Map([['subject', subject]]),
    forward: async (to) => { forwards.push(to); }, forwards,
    headersGetFix: null };
};

test('the text body is read out of real MIME: multipart picks text/plain and decodes quoted-printable; base64 and single-part work', () => {
  assert.equal(textBodyOf(MULTIPART), 'Hi Adam, the Zapier zap doubles every order — please fix it.');
  const b64 = CRLF('Subject: x\nContent-Type: text/plain\nContent-Transfer-Encoding: base64\n\n') + Buffer.from('hello from the bakery').toString('base64');
  assert.equal(textBodyOf(b64), 'hello from the bakery');
  assert.equal(textBodyOf(CRLF('Subject: x\n\nplain words, nothing else')), 'plain words, nothing else');
  assert.equal(textBodyOf(''), '');
});

test('a tagged reply is forwarded AND posted to the handoff with the job, the sender and the decoded body', async () => {
  const posts = [];
  const m = msg(MULTIPART, 'Re: your receipt [sale:s-1]');
  const out = await handleEmail(m, { FORWARD_TO: 'owner@example.com', HANDOFF_TOKEN: 't0ken', HANDOFF_URL: 'https://a-to-mind.com/api/handoff' },
    async (url, init) => { posts.push({ url, init }); return new Response('{}', { status: 201 }); });
  assert.equal(out, 'forwarded, handoff answered 201');
  assert.deepEqual(m.forwards, ['owner@example.com']);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].init.headers.authorization, 'Bearer t0ken');
  const b = JSON.parse(posts[0].init.body);
  assert.equal(b.job, 'sale:s-1'); assert.equal(b.author, 'maria@sunrisebakery.example');
  assert.match(b.body, /doubles every order/);
  assert.equal(b.name, 'Re: your receipt [sale:s-1]');
});

test('an untagged message is only forwarded; a failed post or forward never throws the mail away', async () => {
  let posted = 0;
  const m = msg(MULTIPART, 'lunch on friday?');
  assert.equal(await handleEmail(m, { FORWARD_TO: 'owner@example.com' }, async () => { posted++; return new Response('', { status: 201 }); }),
    'forwarded, no sale tag');
  assert.equal(posted, 0); assert.equal(m.forwards.length, 1);
  const m2 = msg(MULTIPART, 'Re [sale:s-2]');
  m2.forward = async () => { throw new Error('no destination'); };
  const out = await handleEmail(m2, { FORWARD_TO: 'owner@example.com', HANDOFF_TOKEN: 't' }, async () => { throw new Error('offline'); });
  assert.match(out, /^forward failed: no destination, post failed: offline$/);
  assert.ok(SALE_TAG_RE.exec('Re [sale:s-2]'));
});
