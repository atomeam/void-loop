import fs from 'node:fs';
// node tools/review.test.mjs: the code reviewer (void-live-deploy/lib/code-review.js) finds what it should and stays quiet on clean code.
import { isReviewAsk, codeOf, langOf, ruleReview, looksLikeCode, autoFix, skippedInReview, langNamed } from '../void-live-deploy/lib/code-review.js';
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
// run 37: Go's := and short passwords, PHP printing request input, Python shell commands built from text
ok(langNamed('review this go: x := 1') === 'go' && looksLikeCode('password := "hunter2"', 'go') && rules('password := "hunter2"', 'go').includes('hardcoded-secret@1'), 'a short Go password is a hard-coded secret');
ok(!rules('password = None', 'python').includes('hardcoded-secret@1') && !rules('pwd = ""', 'python').includes('hardcoded-secret@1') && !rules('password = "changeme"', 'python').includes('hardcoded-secret@1') && !rules('if password == "abcd1234":', 'python').includes('hardcoded-secret@1'), 'empty, None, placeholder and compared passwords are not flagged');
ok(rules("echo $_GET['name'];", 'php').includes('php-echo-input@1') && !rules("echo htmlspecialchars($_GET['name'], ENT_QUOTES, 'UTF-8');", 'php').includes('php-echo-input@1') && rules("echo htmlspecialchars($_GET['safe']) . $_GET['unsafe'];", 'php').includes('php-echo-input@1'), 'PHP echo of request input flagged, escaped echo not');
ok(rules("os.system('rm -rf ' + path)", 'python').includes('os-system-concat@1') && rules('os.system(f"ls {d}")', 'python').includes('os-system-concat@1') && !rules("os.system('clear')", 'python').includes('os-system-concat@1'), 'os.system with text pasted in flagged, a fixed command not');
ok(rules('system("ls #{dir}")', 'ruby').includes('ruby-shell-interp@1') && !rules('system("ls", dir)', 'ruby').includes('ruby-shell-interp@1'), 'Ruby shell command with #{} flagged, separate arguments not');
ok(rules(`$q = "SELECT * FROM t WHERE id=" . $_GET['id'];`, 'php').includes('sql-concat@1') && rules('$q = "SELECT * FROM t WHERE id=$id";', 'php').includes('sql-concat@1') && !rules('const q = "SELECT a FROM t WHERE id = $1";', 'javascript').includes('sql-concat@1'), 'PHP SQL built with . or "$id" flagged, a $1 placeholder not');
ok(rules('assert user.is_admin', 'python').includes('assert-check@1') && !rules('assert x > 0', 'python').includes('assert-check@1'), 'assert as an access check flagged, a plain assert not');
ok(rules('const re = new RegExp(userInput)', 'javascript').includes('regexp-input@1') && !rules('const re = new RegExp("^a")', 'javascript').includes('regexp-input@1'), 'RegExp from a variable flagged, from a literal not');
ok(rules('token = random.random()', 'python').includes('weak-random@1') && rules('const resetCode = Math.random()', 'javascript').includes('weak-random@1') && !rules('const t = Math.random()', 'javascript').includes('weak-random@1'), 'predictable random for a token flagged, for anything else not');
// run 38: C string functions, Rust unwrap, Kotlin/Swift force unwraps, Java string ==, var in loop closures, JSON.parse of storage, a busy loop
ok(langNamed('review this c') === 'c' && langNamed('review this go') === 'go' && langNamed('review this code') !== 'c' && langNamed('review this c: gets(buf);') === 'c' && langNamed('review this c#: x') === 'csharp' && rules('gets(buf);', 'c').includes('c-unsafe-string@1') && rules('strcpy(d, s);', 'c').includes('c-unsafe-string@1') && !rules('fgets(buf, sizeof buf, stdin);', 'c').includes('c-unsafe-string@1') && !rules('strncpy(d, s, n);', 'c').includes('c-unsafe-string@1'), 'gets/strcpy flagged in C, fgets/strncpy not');
ok(rules('let v = x.unwrap();', 'rust').includes('unwrap@1') && !rules('let v = x.unwrap_or(0);', 'rust').includes('unwrap@1'), 'unwrap() flagged, unwrap_or not');
ok(rules('val n = user!!.name', 'kotlin').includes('force-unwrap@1') && !rules('val n = user?.name ?: ""', 'kotlin').includes('force-unwrap@1') && !rules('if (a != b) {}', 'kotlin').includes('force-unwrap@1'), 'Kotlin !! flagged, ?. and != not');
ok(rules('let n = Int(s)!', 'swift').includes('force-unwrap@1') && !rules('if a != b { }', 'swift').includes('force-unwrap@1') && !rules('if !done { }', 'swift').includes('force-unwrap@1') && !rules('let n = Int(s) ?? 0', 'swift').includes('force-unwrap@1'), 'Swift force unwrap flagged, != / !done / ?? not');
ok(rules('if (s == "yes") {}', 'java').includes('string-eq@1') && !rules('if ("yes".equals(s)) {}', 'java').includes('string-eq@1') && !rules('if (s == null) {}', 'java').includes('string-eq@1'), 'Java string == flagged, equals and == null not');
ok(rules('for (var i = 0; i < 5; i++) setTimeout(() => log(i))', 'javascript').includes('var-loop-closure@1') && !rules('for (let i = 0; i < 5; i++) setTimeout(() => log(i))', 'javascript').includes('var-loop-closure@1') && rules('for (var i = 0; i < 3; i++) { btn[i].onclick = function () { go(i) } }', 'javascript').includes('var-loop-closure@1') && !rules('for (var i = 2; i < n; i++) t.push(i * 2); return t.sort(function (a, b) { return a - b })', 'javascript').includes('var-loop-closure@1'), 'var captured by loop callbacks flagged, let not');
ok(rules("const s = JSON.parse(localStorage.getItem('x'))", 'javascript').includes('json-parse-storage@1') && !rules("try { s = JSON.parse(localStorage.getItem('x')) } catch (_) {}", 'javascript').includes('json-parse-storage@1'), 'unguarded JSON.parse of storage flagged, inside try not');
ok(rules('while True: pass', 'python').includes('busy-loop@1') && rules('while True:\n    pass', 'python').includes('busy-loop@1') && !rules('while True:\n    time.sleep(1)', 'python').includes('busy-loop@1'), 'while True: pass flagged, a loop that sleeps not');
// the page names the language from the ask's title, cut at the first colon ("review this c"), so every review ask in the
// bench must name the same language that way as it does in full; a mismatch is a probe miss nobody can see locally
{
  const bench = JSON.parse(fs.readFileSync(new URL('./bench.json', import.meta.url), 'utf8'));
  for (const b of bench.filter((x) => /(^|\|)review(\||$)/.test(x.want) && /:/.test(x.ask))) {
    const full = langNamed(b.ask.split(':')[0] + ':'), title = langNamed(b.ask.split('\n')[0].replace(/:\s*$/, '').split(':')[0]);
    ok(full === title, 'the page names the same language as the full ask: ' + b.ask.slice(0, 40) + ' (' + full + ' vs ' + title + ')');
  }
}
// run 39: sort() without a compare, indexOf used as a truth test, a handler called instead of passed, exact == on decimals, os.chmod 0o777
ok(rules('arr.sort()', 'javascript').includes('sort-no-compare@1') && !rules('arr.sort((a, b) => a - b)', 'javascript').includes('sort-no-compare@1'), 'sort() flagged, sort with a compare not');
ok(rules('if (arr.indexOf(x)) {}', 'javascript').includes('indexof-truthy@1') && rules('if (!s.indexOf("a") && ok) {}', 'javascript').includes('indexof-truthy@1') && !rules('if (arr.indexOf(x) !== -1) {}', 'javascript').includes('indexof-truthy@1') && !rules('if (arr.indexOf(x) > 0) {}', 'javascript').includes('indexof-truthy@1'), 'indexOf as a truth test flagged, compared indexOf not');
ok(rules("el.addEventListener('click', handler())", 'javascript').includes('listener-called@1') && !rules("el.addEventListener('click', handler)", 'javascript').includes('listener-called@1') && !rules("el.addEventListener('click', makeHandler(1), false)", 'javascript').includes('listener-called@1') && !rules("el.addEventListener('click', () => go())", 'javascript').includes('listener-called@1'), 'handler() passed to addEventListener flagged, a function, a factory or an arrow not');
ok(rules('const ok = 0.1 + 0.2 === 0.3', 'javascript').includes('float-equality@1') && rules('if price == 0.1:', 'python').includes('float-equality@1') && !rules('if (x === 1) {}', 'javascript').includes('float-equality@1') && !rules('if (v === 1.0) {}', 'javascript').includes('float-equality@1') && !rules('if (s === "0.5") {}', 'javascript').includes('float-equality@1') && !rules('if (a <= 0.5) {}', 'javascript').includes('float-equality@1') && rules('if (0.1 == price):', 'python').includes('float-equality@1') && !rules('if (0.5 <= x) {}', 'javascript').includes('float-equality@1'), 'exact == on a decimal flagged; whole numbers, 1.0, strings and <= not');
ok(rules('os.chmod(path, 0o777)', 'python').includes('chmod-777@1') && !rules('os.chmod(path, 0o644)', 'python').includes('chmod-777@1') && rules('chmod 777 f', 'shell').includes('chmod-777@1'), 'os.chmod 0o777 flagged in Python, 0o644 not, shell still flagged');
ok(!rules("SELECT name FROM users WHERE email LIKE '%' + @q + '%'", 'sql').includes('sql-concat@1'), 'a LIKE pattern built around an @parameter is not SQL injection');
// keys never shown as written
ok(!JSON.stringify(ruleReview('const token = "ghp_abcdefghijklmnopqrstuvwxyz0123";')).includes('ghp_abcdef'), 'a key in a finding is masked');
// the pull-request review skips tests in every language the repo writes (their fixtures are bad code on purpose), and nothing else by accident
for (const f of ['tools/ouroboros_test.py', 'tools/void_lens_test.py', 'tools/memory.test.mjs', 'tools/test_void.mjs', 'tools/skills_test.mjs', 'tools/tictactoe.test.mjs', 'tools/sub/helper_test.js', 'tools/test_glyphs.mjs'])
  ok(skippedInReview(f), 'a test file is not reviewed: ' + f);
for (const f of ['tools/ouroboros.py', 'tools/void_lens.py', 'void-live-deploy/lib/memory-core.js', 'tools/latest.py', 'tools/contest.mjs', 'tools/testing_notes.py', 'void-live-deploy/functions/api/memory.js'])
  ok(!skippedInReview(f), 'real code is still reviewed: ' + f);
console.log(bad ? bad + ' failed' : 'review: all passed');
process.exit(bad ? 1 : 0);
