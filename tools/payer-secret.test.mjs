import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PAYER_SECRET, withSecret, secretHtml } from '../void-live-deploy/lib/payer-secret.js';
import { memberJoinedSay } from '../void-live-deploy/lib/team.js';

const root = new URL('../void-live-deploy/', import.meta.url).pathname;
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('the secret is one short, warm line framed as a little secret', () => {
  assert.match(PAYER_SECRET, /^Here's a secret: /);
  assert.match(PAYER_SECRET, /Atom's own cut goes back into making everything in Verse better\.$/);
  assert.ok(PAYER_SECRET.length < 120);
  assert.equal(withSecret('Thank you. '), 'Thank you. ' + PAYER_SECRET);
  const h = secretHtml(); assert.match(h, /data-payer-secret/); assert.ok(h.includes('Atom&#39;s own cut'), 'escaped, never raw markup');
});
test('every place a payer is thanked reads the one shared string', () => {
  assert.ok(memberJoinedSay('Ada').endsWith(PAYER_SECRET) || memberJoinedSay('Ada').includes(PAYER_SECRET));
  assert.match(memberJoinedSay('Ada'), /Welcome, Ada\./);
  for (const f of ['store/index.html', 'store/receipt/index.html']) {
    const t = read(f);
    assert.ok(t.includes("from '/lib/payer-secret.js'"), f); assert.ok(t.includes('id="psecret"'), f);
    assert.match(t, /receiptText\(r\) \{ return \[[^\n]*PAYER_SECRET/, f + ': the saved receipt carries it');
    assert.match(t, /r\.status !== 'free'\) \$\('#psecret'\)\.hidden = false/, f + ': a paid receipt shows it, a free one does not');
  }
  assert.ok(read('members/members.js').includes('withSecret('));
  assert.ok(read('functions/api/store/[[path]].js').includes('secret: PAYER_SECRET'));
});
test('the words live in one file: nobody copies the line', () => {
  const found = [];
  const walk = (d) => { for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) { const rel = path.join(d, e.name); if (e.isDirectory()) { if (!/^(vendor|local|node_modules|findings)$/.test(e.name)) walk(rel); } else if (/\.(js|mjs|html)$/.test(e.name) && read(rel).includes('even Atom')) found.push(rel); } };
  walk('.');
  assert.deepEqual(found.filter((f) => f !== 'lib/payer-secret.js'), [], 'copies of the secret: import PAYER_SECRET instead');
});
test('a new page that thanks a payer must read the shared secret', () => {
  // the words a confirmation to a payer uses; any file that says them has to import lib/payer-secret.js
  const THANKS = /Paid, thank you|You are a member\.|thank you for (?:your |the )?(?:order|payment|purchase|support)|payment (?:received|confirmed)|purchase complete/i;
  const missing = [];
  const walk = (d) => { for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) { const rel = path.join(d, e.name); if (e.isDirectory()) { if (!/^(vendor|local|node_modules|findings|fix)$/.test(e.name)) walk(rel); } else if (/\.(js|html)$/.test(e.name)) { const t = read(rel); if (THANKS.test(t) && !/payer-secret/.test(t)) missing.push(rel); } } };
  walk('.');
  assert.deepEqual(missing, [], 'say the secret here: import { PAYER_SECRET } from lib/payer-secret.js');
});
