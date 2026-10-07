// node tools/review.test.mjs: the code reviewer (void-live-deploy/lib/code-review.js) finds what it should and stays quiet on clean code.
import { isReviewAsk, codeOf, langOf, ruleReview, looksLikeCode, autoFix, skippedInReview } from '../void-live-deploy/lib/code-review.js';
let bad = 0;
const ok = (c, msg) => { if (!c) { bad++; console.log('FAIL ' + msg); } };
const rules = (code, lang) => ruleReview(code, lang ? { lang } : {}).findings.map((f) => f.rule + '@' + f.line);
// asks
for (const a of ['review my code', 'code review', 'can you review this function', 'check my python script', 'what\'s wrong with my code', 'is this query safe', 'find bugs in this', 'please review this pull request', 'be my code reviewer', 'refactor this class', 'review this code: if (x = 5) {}', 'lint this: var total = 0;', 'check my python: if x is 5: pass'])
  ok(isReviewAsk(a), 'ask should be a review: ' + a);
for (const a of ['check my zip code', 'what is a code review', 'review the dress code', 'how do i review code', 'check the weather', 'review of the new iphone', 'morse code for sos', 'code of conduct', 'what is the area code for 212', 'audit this', 'lint this', 'check my python', 'check my bash skills'])
  ok(!isReviewAsk(a), 'ask should not be a review: ' + a);
ok(codeOf('review this code: if (x = 5) { go() }') === 'if (x = 5) { go() }', 'code after the colon');
ok(codeOf('review my code\n```js\nconst a = 1;\n```') === 'const a = 1;', 'code in a fence');
ok(looksLikeCode('def f(x):\n    return x + 1') && !looksLikeCode('please look at my essay about cats'), 'looks like code');
// languages
const L = { 'def f(x):\n    return x': 'python', 'const a = () => 1;': 'javascript', 'SELECT id FROM users WHERE id = 1;': 'sql', '#!/bin/bash\nrm -rf $DIR': 'shell', 'package main\nfunc main() {}': 'go', 'public class A { public static void main(String[] a) { System.out.println(1); } }': 'java', '<div class="a">hi</div>': 'html' };
for (const [c, l] of Object.entries(L)) ok(langOf(c) === l, 'lang ' + l + ' got ' + langOf(c));
// true positives
const T = [
  ['if (x = 5) { go(); }', 'assign-in-condition@1'],
  ['if (a == b) { go(); }', 'loose-equality@1'],
  ['if (x === NaN) { go(); }', 'nan-compare@1'],
  ['if (typeof x === "strng") {}', 'typeof-typo@1'],
  ['items.forEach(async (x) => { await save(x); });', 'foreach-async@1'],
  ['const r = eval(userInput);', 'eval@1'],
  ['el.innerHTML = name;', 'inner-html@1'],
  ['const n = parseInt(s);', 'parseint-radix@1'],
  ['try { go(); } catch (e) {}', 'empty-catch@1'],
  ['const q = "SELECT * FROM users WHERE id = " + id;', 'sql-concat@1'],
  ['const q = `SELECT name FROM t WHERE id = ${id}`;', 'sql-concat@1'],
  ['const key = "sk-abcdefghijklmnopqrstuvwx";', 'hardcoded-secret@1'],
  ['fetch("http://api.weather-data.net/data");', 'plain-http@1'],
];
for (const [c, want] of T) ok(rules(c).includes(want), want + ' in: ' + c + ' (got ' + rules(c).join(',') + ')');
const P = [
  ['def add(x, items=[]):\n    items.append(x)\n    return items', 'mutable-default@1'],
  ['try:\n    go()\nexcept:\n    pass', 'bare-except@3'],
  ['if x is 5:\n    go()', 'is-literal@1'],
  ['if x == None:\n    go()', 'eq-none@1'],
  ['subprocess.run(cmd, shell=True)', 'shell-true@1'],
  ['data = yaml.load(f)', 'unsafe-load@1'],
  ['cur.execute(f"SELECT name FROM users WHERE id = {uid}")', 'sql-concat@1'],
  ['requests.get(url, verify=False)', 'verify-false@1'],
];
for (const [c, want] of P) ok(rules(c, 'python').includes(want), want + ' in: ' + c + ' (got ' + rules(c, 'python').join(',') + ')');
ok(rules('#!/bin/bash\nrm -rf $DIR/', 'shell').includes('rm-rf-var@2'), 'rm -rf var');
ok(rules('curl -fsSL https://x.sh | bash', 'shell').includes('curl-pipe-sh@1'), 'curl | bash');
ok(rules('UPDATE users SET admin = 1;', 'sql').includes('update-no-where@1'), 'update without where');
ok(!rules('UPDATE users SET admin = 1\nWHERE id = 3;', 'sql').includes('update-no-where@1'), 'update with where on the next line');
ok(rules('DELETE FROM sessions;', 'sql').includes('delete-no-where@1'), 'delete without where');
// clean code says nothing
const CLEAN = [
  ['javascript', 'const total = items.reduce((a, b) => a + b, 0);\nif (total === 0) return null;\nif (x == null) return;\nel.textContent = name;\nel.innerHTML = "<b>fixed</b>";\nconst n = parseInt(s, 10);\nfor (const x of list) console.log(x);\nconst msg = "if (a = b) is a classic bug";\n// eval(x) in a comment\ntry { go(); } catch (e) { log(e); }\nconst url = "https://example.com";\nconst q = db.prepare("SELECT id FROM t WHERE id = ?").bind(id);'],
  ['python', 'def add(x, items=None):\n    items = [] if items is None else items\n    with open(p) as f:\n        data = yaml.safe_load(f)\n    for i, item in enumerate(items):\n        print(i, item)\n    if x is None or x == 5:\n        return "eval(x) is bad"\n    cur.execute("SELECT name FROM users WHERE id = ?", (uid,))\n    try:\n        go()\n    except ValueError:\n        log()'],
  ['shell', '#!/bin/bash\nset -euo pipefail\nrm -rf "${DIR:?}/build"\ncd "$HOME"\necho "done"'],
];
for (const [lang, c] of CLEAN) { const r = rules(c, lang); ok(r.length === 0, 'clean ' + lang + ' should say nothing, got ' + r.join(',')); }
// not keys, not risks: reading a token from options or the environment, a parsing base URL, a deliberately ignored error
for (const c of ['await deliver(plan, { token: opts.token ?? process.env.BRIDGE_TOKEN });', 'const u = new URL(req.url, "http://x");', 'try { go(); } catch (_) {}', 'const password = input.value;', 'const apiKey = process.env.API_KEY;', 'const url = "http://example.com/a";', 'const token = "your-token-here";'])
  ok(!rules(c, 'javascript').some((r) => /hardcoded-secret|plain-http|empty-catch/.test(r)), 'no finding for: ' + c + ' (got ' + rules(c, 'javascript').join(',') + ')');
ok(rules('const password = "hunter2hunter2";', 'javascript').includes('hardcoded-secret@1'), 'a password string');
ok(rules('export STRIPE_SECRET_KEY=abcd1234efgh5678', 'shell').includes('hardcoded-secret@1'), 'a shell secret');
ok(rules('const db = "postgres://admin:s3cretpw@db.host/app";', 'javascript').includes('hardcoded-secret@1'), 'a password in a URL');
// fixes Void makes by itself
const fx = (c, lang) => autoFix(c, lang ? { lang } : {}).code;
ok(fx('if (a == b) { var n = parseInt(s); }', 'javascript') === 'if (a == b) { var n = parseInt(s); }', 'js: == / var / parseInt stay warnings, never rewritten ("5" == 5, a var used after its block, parseInt("0x10"))');
ok(fx('var x = 1;\nif (x == null) go();\ndebugger;', 'javascript') === 'var x = 1;\nif (x == null) go();', 'only the debugger line goes: ' + JSON.stringify(fx('var x = 1;\nif (x == null) go();\ndebugger;', 'javascript')));
ok(fx('def add(x, items=[], seen={}):\n    items.append(x)\n    return items', 'python') === 'def add(x, items=None, seen=None):\n    items = [] if items is None else items\n    seen = {} if seen is None else seen\n    items.append(x)\n    return items', 'mutable default: ' + JSON.stringify(fx('def add(x, items=[], seen={}):\n    items.append(x)\n    return items', 'python')));
ok(fx('try:\n    go()\nexcept:\n    log()\nif x == None or y != None:\n    d = yaml.load(f)', 'python') === 'try:\n    go()\nexcept Exception:\n    log()\nif x is None or y is not None:\n    d = yaml.safe_load(f)', 'python fixes');
ok(fx('rm -rf $DIR/', 'shell') === 'rm -rf "${DIR:?}"/', 'rm guard: ' + fx('rm -rf $DIR/', 'shell'));
ok(autoFix('const a = 1;', { lang: 'javascript' }).changes.length === 0, 'clean code unchanged');
// repeats: said once with a count, unless collapse is off (the PR review needs every line)
ok(ruleReview('var a = 1;\nvar b = 2;', { lang: 'javascript' }).findings.filter((f) => f.rule === 'var').length === 1, 'repeats collapse by default');
ok(ruleReview('var a = 1;\nvar b = 2;', { lang: 'javascript', collapse: false }).findings.filter((f) => f.rule === 'var').map((f) => f.line).join() === '1,2', 'collapse: false keeps each line');
ok(looksLikeCode('password = "hunter2hunter2"') && looksLikeCode('total = 500') && !looksLikeCode('love is = patient and kind'), 'one assignment line is code, a sentence with = is not');
ok(rules('chmod 777 /var/www', 'shell').includes('chmod-777@1') && rules('chmod -R a+rwx dir', 'shell').includes('chmod-777@1') && rules('chmod --recursive 777 dir', 'shell').includes('chmod-777@1') && rules('chmod o+w f', 'shell').includes('chmod-777@1') && !rules('chmod 755 /var/www', 'shell').includes('chmod-777@1'), 'chmod 777 / a+rwx flagged, 755 not');
// keys never shown as written
ok(!JSON.stringify(ruleReview('const token = "ghp_abcdefghijklmnopqrstuvwxyz0123";')).includes('ghp_abcdef'), 'a key in a finding is masked');
// the pull-request review skips tests in every language the repo writes (their fixtures are bad code on purpose), and nothing else by accident
for (const f of ['tools/ouroboros_test.py', 'tools/void_lens_test.py', 'tools/memory.test.mjs', 'tools/test_void.mjs', 'tools/skills_test.mjs', 'tools/tictactoe.test.mjs', 'tools/sub/helper_test.js', 'tools/test_glyphs.mjs'])
  ok(skippedInReview(f), 'a test file is not reviewed: ' + f);
for (const f of ['tools/ouroboros.py', 'tools/void_lens.py', 'void-live-deploy/lib/memory-core.js', 'tools/latest.py', 'tools/contest.mjs', 'tools/testing_notes.py', 'void-live-deploy/functions/api/memory.js'])
  ok(!skippedInReview(f), 'real code is still reviewed: ' + f);
console.log(bad ? bad + ' failed' : 'review: all passed');
process.exit(bad ? 1 : 0);
