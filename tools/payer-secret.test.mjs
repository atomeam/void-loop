import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { memberJoinedSay } from '../void-live-deploy/lib/team.js';

const root = new URL('../void-live-deploy/', import.meta.url).pathname;
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// Buyer-facing copy must not talk about Atom's cut, a "secret" about reinvestment, or the budget split
// (owner, 2026-11-20: keep paying the 30% cut; the budget is not the buyers' business).
const CUT = /Here's a secret:|even Atom(?:'s)?|Atom's own cut|Atom's cut is reinvest|PAYER_SECRET|payer-secret\.js/i;

function walk(d, found, pred) {
  for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
    const rel = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!/^(vendor|local|node_modules|findings)$/.test(e.name)) walk(rel, found, pred);
    } else if (/\.(js|mjs|html)$/.test(e.name) && pred(rel, read(rel))) found.push(rel);
  }
}

test('receipts and thank-yous stay warm and never mention the cut or a payer secret', () => {
  assert.match(memberJoinedSay('Ada'), /Welcome, Ada\./);
  assert.doesNotMatch(memberJoinedSay('Ada'), CUT);
  for (const f of ['store/index.html', 'store/receipt/index.html']) {
    const t = read(f);
    assert.doesNotMatch(t, CUT, f);
    assert.doesNotMatch(t, /id="psecret"/, f);
    assert.match(t, /receiptText\(r\) \{ return \[[^\n]*Verse receipt/, f + ': the saved receipt still exists');
    assert.doesNotMatch(t, /PAYER_SECRET/, f + ': the saved receipt has no budget line');
    assert.match(t, /Your receipt\./, f + ': the receipt still greets the buyer');
  }
  assert.doesNotMatch(read('members/members.js'), CUT);
  assert.match(read('members/members.js'), /You are a member\. Thank you for building Verse\./);
  const api = read('functions/api/store/[[path]].js');
  assert.doesNotMatch(api, CUT);
  assert.doesNotMatch(api, /secret:\s*PAYER_SECRET/);
});

test('the old secret line is gone from the live site files', () => {
  const found = [];
  walk('.', found, (_rel, t) => /even Atom|Here's a secret: even Atom/.test(t));
  assert.deepEqual(found, [], 'buyer-facing or leftover copies of the old secret: ' + found.join(', '));
  assert.equal(fs.existsSync(path.join(root, 'lib/payer-secret.js')), false, 'the secret module is gone');
});
