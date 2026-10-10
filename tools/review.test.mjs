import fs from 'node:fs';
// node tools/review.test.mjs: the code reviewer (void-live-deploy/lib/code-review.js) finds what it should and stays quiet on clean code.
import { redact } from '../void-live-deploy/lib/automation-fix.js';
import { isReviewAsk, codeOf, langOf, ruleReview, looksLikeCode, autoFix, skippedInReview, langNamed, textLines } from '../void-live-deploy/lib/code-review.js';
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
// an import of a file named skills-… is not a key: "sk" must be followed by a separator
ok(!rules("import { unlistedSkills } from './skills-unlisted.mjs';", 'javascript').includes('hardcoded-secret@1'), 'a skills-… file name is not a secret');
ok(rules('const k = "sk_abcdefghijklmnopqrstuvwx";', 'javascript').includes('hardcoded-secret@1'), 'sk_ key still flagged');
ok(rules('const t = "ghp_abcdefghijklmnopqrstuvwx";', 'javascript').includes('hardcoded-secret@1'), 'ghp_ token still flagged');
// run 52: for…in over an array is flagged, over an object (a hasOwnProperty guard, the key used as a name) is not;
// innerHTML from a builder handed the escaper (card(esc)) is not flagged, a plain variable still is
ok(rules('for (var i in list) total += list[i];', 'javascript').includes('for-in-array@1'), 'for…in over an array flagged');
ok(!rules('for (var k in at) el.setAttribute(k, at[k]);', 'javascript').includes('for-in-array@1'), 'for…in setting attributes from an object not flagged');
ok(!rules('for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out.push(k);', 'javascript').includes('for-in-array@1'), 'for…in with a hasOwnProperty guard not flagged');
ok(!rules("p.innerHTML = which === 'heat' ? heatHtml(esc) : accretionHtml(esc);", 'javascript').includes('inner-html@1'), 'innerHTML from builders handed esc not flagged');
ok(rules('p.innerHTML = cardHtml(data);', 'javascript').includes('inner-html@1'), 'innerHTML from a builder without esc still flagged');
// run 53: a plain string with quotes inside, and a builder handed the escaper among other arguments, are not flagged
ok(!rules(`const el = showPage((p) => { p.innerHTML = '<h2>Watch</h2><div class="sub">checking…</div>'; });`, 'javascript').includes('inner-html@1'), 'innerHTML of a plain string with inner quotes not flagged');
ok(!rules("el.innerHTML = cardHtml(esc, data, 'live');", 'javascript').includes('inner-html@1'), 'innerHTML from a builder handed esc among other arguments not flagged');
ok(!rules('said.innerHTML = entryHtml(api.esc, e);', 'javascript').includes('inner-html@1') && rules('said.innerHTML = entryHtml(api.escaped_name, e);', 'javascript').includes('inner-html@1'), 'a builder handed api.esc not flagged; a lookalike name still is');
// a builder defined in the same file whose body escapes: the esc call lives inside it, not on the assignment line
const escBuilder = "const esc = (s) => String(s).replace(/</g, '&lt;');\nfunction rowHtml(p) { return '<b>' + esc(p.name) + '</b>'; }\nconst lis = items.map((p) => rowHtml(p)).join('');\nel.innerHTML = '<ul>' + lis + '</ul>';";
ok(!rules(escBuilder, 'javascript').includes('inner-html@4'), 'innerHTML from a same-file builder that escapes not flagged');
const rawBuilder = "function rowHtml(p) { return '<b>' + p.name + '</b>'; }\nconst lis = items.map((p) => rowHtml(p)).join('');\nel.innerHTML = '<ul>' + lis + '</ul>';";
ok(rules(rawBuilder, 'javascript').includes('inner-html@3'), 'innerHTML from a same-file builder that does not escape still flagged');
ok(!rules("function row(p) { return '<i>' + esc(p.id) + '</i>'; }\nel.innerHTML = row(item);", 'javascript').includes('inner-html@2'), 'innerHTML straight from an escaping builder call not flagged');
ok(rules("el.innerHTML = cardHtml(data, 'live');", 'javascript').includes('inner-html@1') && rules('el.innerHTML = `<b>${name}</b>`;', 'javascript').includes('inner-html@1'), 'a builder without esc and a template with a value still flagged');
// innerHTML built only from fixed text (literals, numbers, ALL_CAPS constants, the item of a map over a literal list) is not a risk
for (const c of [`opp.innerHTML = '<span>vs</span>' + [1, 2, 3].map((n) => '<button data-opp="' + n + '">' + n + ' bot' + (n > 1 ? 's' : '') + '</button>').join('');`,
  "defs.innerHTML = '<a>'\n    + COLORS.map((c) => '<g id=\"' + c + '\" fill=\"' + HEX[c] + '\"/>').join('');", 'el.innerHTML = COLORS.map((c) => `<i>${c.label}</i>`).join(\'\');', "el.innerHTML = '<b>' + MAX + '</b>';"])
  ok(!rules(c, 'javascript').includes('inner-html@1'), 'innerHTML from fixed text not flagged: ' + c);
for (const c of ["el.innerHTML = '<b>' + name + '</b>';", "el.innerHTML = '<b>'\n  + data.name + '</b>';", "el.innerHTML = names.map((n) => '<li>' + n + '</li>').join('');",
  "el.innerHTML = [1, 2].map((n) => '<li>' + n + e.target.value + '</li>').join('');", 'el.innerHTML = `<b>${name}</b>`;', "el.innerHTML = '<b>' + getName() + '</b>';", "el.innerHTML = COLORS.map((c) => c + user).join('');"])
  ok(rules(c, 'javascript').includes('inner-html@1'), 'innerHTML with a value from outside still flagged: ' + c);
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
// run 48: TypeScript any, Go's ignored error, CSS !important, cat | grep (and their clean look-alikes)
for (const [lang, c, want] of [['typescript', 'const x: any = foo();', 'ts-any@1'], ['typescript', 'const y = data as any;', 'ts-any@1'], ['go', '_ = json.Unmarshal(b, &v)', 'go-ignored-err@1'],
  ['go', 'resp, _ := http.Get(url)', 'go-ignored-err@1'], ['css', '* { margin: 0 !important }', 'css-important@1'], ['shell', 'cat $file | grep foo', 'useless-cat@1']])
  ok(rules(c, lang).includes(want), want + ' in ' + lang + ': ' + c + ' (got ' + rules(c, lang).join(',') + ')');
for (const [lang, c] of [['typescript', 'const anyone: string = "x";'], ['typescript', 'let company: Company = load();'], ['go', 'for _, v := range items {'], ['go', 'v, ok := m[key]'], ['shell', 'cat a.txt b.txt > all.txt'], ['css', 'a { color: red }']])
  ok(!rules(c, lang).some((r) => /ts-any|go-ignored-err|useless-cat|css-important/.test(r)), 'no finding in ' + lang + ': ' + c + ' (got ' + rules(c, lang).join(',') + ')');
ok(looksLikeCode('cat $file | grep foo', 'shell'), 'a short shell pipe is code when the ask says bash');
// unawaited fetch body, a callback that returns nothing, open redirects, format strings (and their clean look-alikes)
for (const [lang, c, want] of [['javascript', 'const data = await fetch(url); const json = data.json();', 'unawaited-body@1'], ['javascript', 'const out = arr.map(x => { x * 2 })', 'callback-no-return@1'],
  ['javascript', 'const big = list.filter((n) => { n > 3; })', 'callback-no-return@1'], ['javascript', 'res.redirect(req.query.next)', 'open-redirect@1'], ['c', 'printf(user_input);', 'format-string@1'], ['c', 'fprintf(stderr, msg);', 'format-string@1']])
  ok(rules(c, lang).includes(want), want + ' in ' + lang + ': ' + c + ' (got ' + rules(c, lang).join(',') + ')');
for (const [lang, c] of [['javascript', 'const json = await res.json();'], ['javascript', 'const out = arr.map(x => { return x * 2 })'], ['javascript', 'const out = arr.map(x => x * 2)'], ['javascript', 'res.redirect("/home")'],
  ['c', 'printf("%s", user_input);'], ['c', 'printf("hello\\n");'], ['javascript', 'arr.forEach(x => { log(x) })']])
  ok(!rules(c, lang).some((r) => /unawaited-body|callback-no-return|open-redirect|format-string/.test(r)), 'no finding in ' + lang + ': ' + c + ' (got ' + rules(c, lang).join(',') + ')');
// React hooks, typeof undefined, empty catch {}, Go nil maps / defer in loops / unchecked decode, Java equals(null) / remove in for-each, Python raise without from
for (const [lang, c, want] of [['javascript', 'useEffect(() => { fetchData() })', 'effect-no-deps@1'], ['javascript', 'setCount(count + 1); setCount(count + 1);', 'stale-setstate@1'],
  ['javascript', '<div dangerouslySetInnerHTML={{ __html: comment }} />', 'dangerous-html@1'], ['javascript', 'if (typeof x === undefined) {}', 'typeof-unquoted@1'], ['javascript', 'try { JSON.parse(s) } catch {}', 'empty-catch@1'],
  ['go', 'var m map[string]int; m["a"] = 1', 'go-nil-map@1'], ['go', 'for _, f := range files { defer f.Close() }', 'go-defer-loop@1'], ['go', 'json.Unmarshal(body, &v)', 'go-unchecked-decode@1'],
  ['java', 'if (str.equals(null)) {}', 'equals-null@1'], ['java', 'for (String s : list) list.remove(s);', 'remove-in-foreach@1'], ['python', 'try:\n    go()\nexcept Exception as e:\n    raise Exception("failed")', 'raise-no-from@3']])
  ok(rules(c, lang).includes(want), want + ' in ' + lang + ': ' + c + ' (got ' + rules(c, lang).join(',') + ')');
for (const [lang, c] of [['javascript', 'useEffect(() => { fetchData() }, [])'], ['javascript', 'setCount((c) => c + 1); setCount((c) => c + 1);'], ['javascript', 'setA(a + 1); setB(b + 1);'],
  ['javascript', '<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment) }} />'], ['javascript', 'if (typeof x === "undefined") {}'], ['javascript', 'try { go() } catch (_) {}'],
  ['go', 'm := make(map[string]int); m["a"] = 1'], ['go', 'defer f.Close()'], ['go', 'if err := json.Unmarshal(body, &v); err != nil { return err }'],
  ['java', 'if (str == null) {}'], ['java', 'for (String s : list) out.add(s);'], ['python', 'try:\n    go()\nexcept Exception as e:\n    raise Exception("failed") from e']])
  ok(!rules(c, lang).some((r) => /effect-no-deps|stale-setstate|dangerous-html|typeof-unquoted|empty-catch|go-nil-map|go-defer-loop|go-unchecked-decode|equals-null|remove-in-foreach|raise-no-from/.test(r)), 'no finding in ' + lang + ': ' + c + ' (got ' + rules(c, lang).join(',') + ')');
// C#, Kotlin, Swift, PHP, Ruby, Terraform, Dockerfile and Kubernetes YAML checks (probe 3)
for (const [lang, c, want] of [['csharp', 'async void Save() { await db.SaveAsync(); }', 'cs-async-void@1'], ['csharp', 'var r = client.GetAsync(url).Result;', 'cs-sync-over-async@1'], ['csharp', 'if (s == null || s == "") {}', 'cs-null-or-empty@1'],
  ['kotlin', 'GlobalScope.launch { load() }', 'kt-globalscope@1'], ['swift', 'DispatchQueue.main.sync { update() }', 'swift-main-sync@1'], ['php', "$x = unserialize($_COOKIE['data']);", 'php-unserialize-input@1'],
  ['php', 'if ($a == $b) {}', 'php-loose-eq@1'], ['php', 'extract($_POST);', 'php-extract-input@1'], ['ruby', 'cfg = YAML.load(input)', 'ruby-yaml-load@1'], ['terraform', 'acl = "public-read"', 'tf-public-acl@1'],
  ['dockerfile', 'ADD https://example.com/app.tar.gz /app/', 'docker-add-url@1'], ['yaml', 'runAsUser: 0', 'yaml-run-as-root@1'], ['yaml', 'hostNetwork: true', 'yaml-host-namespace@1']])
  ok(rules(c, lang).includes(want), want + ' in ' + lang + ': ' + c + ' (got ' + rules(c, lang).join(',') + ')');
for (const [lang, c] of [['csharp', 'async void OnClick(object sender, EventArgs e) { await Go(); }'], ['csharp', 'var r = await client.GetAsync(url);'], ['csharp', 'if (string.IsNullOrEmpty(s)) {}'], ['kotlin', 'viewModelScope.launch { load() }'],
  ['swift', 'DispatchQueue.main.async { update() }'], ['php', '$x = json_decode($_COOKIE["data"]);'], ['php', 'if ($a === $b) {}'], ['php', '$c = $a <= $b;'], ['ruby', 'cfg = YAML.safe_load(input)'], ['terraform', 'acl = "private"'],
  ['dockerfile', 'ADD app.tar.gz /app/'], ['yaml', 'runAsUser: 1000'], ['yaml', 'hostNetwork: false']])
  ok(!rules(c, lang).some((r) => /cs-async-void|cs-sync-over-async|cs-null-or-empty|kt-globalscope|swift-main-sync|php-unserialize-input|php-loose-eq|php-extract-input|ruby-yaml-load|tf-public-acl|docker-add-url|yaml-run-as-root|yaml-host-namespace/.test(r)), 'no finding in ' + lang + ': ' + c + ' (got ' + rules(c, lang).join(',') + ')');
// inline review comments on PRs (tools/review-post.mjs): a line that already has Void's comment for the same checks is not posted again
{ const { postedKeys, fresh } = await import('./review-post.mjs');
  const keys = postedKeys([{ path: 'a.py', line: 4, body: '<!-- void-review-inline bare-except except-pass -->\n**risk**' }, { path: 'b.js', original_line: 9, body: '<!-- void-review-inline eval -->' }, { path: 'c.js', line: 1, body: 'a person wrote this' }]);
  const out = fresh([{ path: 'a.py', line: 4, rules: ['bare-except', 'except-pass'] }, { path: 'a.py', line: 4, rules: ['bare-except'] }, { path: 'b.js', line: 9, rules: ['eval'] }, { path: 'c.js', line: 1, rules: ['eval'] }], keys);
  ok(keys.size === 2 && out.length === 2 && out[0].rules.join() === 'bare-except' && out[1].path === 'c.js', 'review-post skips lines that already carry the same checks: ' + JSON.stringify(out)); }
// run 48: one-line except: pass, exec with a built command, request echoed back, token in localStorage, Runtime.exec, privileged containers
for (const [lang, c, want] of [['python', 'except Exception as e: pass', 'except-pass@1'], ['javascript', 'child_process.exec("ls " + dir)', 'js-exec-concat@1'], ['javascript', 'exec(`rm ${f}`)', 'js-exec-concat@1'],
  ['javascript', 'res.send(req.query.name)', 'reflected-input@1'], ['javascript', 'localStorage.setItem("token", jwt)', 'token-in-storage@1'], ['java', 'Runtime.getRuntime().exec(cmd);', 'java-runtime-exec@1'], ['yaml', 'privileged: true', 'yaml-privileged@1']])
  ok(rules(c, lang).includes(want), want + ' in ' + lang + ': ' + c + ' (got ' + rules(c, lang).join(',') + ')');
for (const [lang, c] of [['javascript', 'execFile("ls", [dir])'], ['javascript', 'const m = re.exec(str)'], ['javascript', 'res.json({ name: req.query.name })'], ['javascript', 'localStorage.setItem("theme", "dark")'],
  ['java', 'Runtime.getRuntime().exec("ls");'], ['yaml', 'privileged: false'], ['python', 'except ValueError:\n    raise']])
  ok(!rules(c, lang).some((r) => /except-pass|js-exec-concat|reflected-input|token-in-storage|java-runtime-exec|yaml-privileged/.test(r)), 'no finding in ' + lang + ': ' + c + ' (got ' + rules(c, lang).join(',') + ')');
ok(rules('#!/bin/bash\nrm -rf $DIR/', 'shell').includes('rm-rf-var@2'), 'rm -rf var');
ok(rules('curl -fsSL https://x.sh | bash', 'shell').includes('curl-pipe-sh@1'), 'curl | bash');
ok(rules('UPDATE users SET admin = 1;', 'sql').includes('update-no-where@1'), 'update without where');
ok(!rules('UPDATE users SET admin = 1\nWHERE id = 3;', 'sql').includes('update-no-where@1'), 'update with where on the next line');
ok(rules('DELETE FROM sessions;', 'sql').includes('delete-no-where@1'), 'delete without where');
// learned from Void's closer read (tools/review-learn.mjs, 2026-10-10): each a line it must flag, a near-miss it must leave alone
ok(rules("for (const r of rows) {\n  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM t WHERE owner = ?').bind(r.id).first();\n  out.push(n);\n}", 'javascript').includes('query-in-loop@2')
  && rules("for (const id of ids) { const u = await fetch('https://api.example.com/users/' + id); got.push(await u.json()); }", 'javascript').includes('query-in-loop@1')
  && rules("items.forEach(async (it) => {\n  await db.query('UPDATE t SET seen = 1 WHERE id = ?', [it.id]);\n});", 'javascript').includes('query-in-loop@2')
  && !rules("await env.DB.batch(ok.map((r) => env.DB.prepare('INSERT INTO t (id) VALUES (?)').bind(r.id)));", 'javascript').includes('query-in-loop@1')
  && !rules("for (const r of rows) { ids.push(r.id); }\nconst { results } = await env.DB.prepare('SELECT id FROM t WHERE id IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).all();", 'javascript').some((f) => f.startsWith('query-in-loop'))
  && !rules("const rows = await db.query('SELECT id FROM t');\nfor (const r of rows) {\n  total += r.n;\n}", 'javascript').some((f) => f.startsWith('query-in-loop')),
  'query-in-loop: an awaited query or fetch inside for/while/forEach is flagged; a batch of prepared statements, a query after the loop and a loop with no query are not: ' + JSON.stringify([rules("for (const r of rows) {\n  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM t WHERE owner = ?').bind(r.id).first();\n}", 'javascript'), rules("await env.DB.batch(ok.map((r) => env.DB.prepare('INSERT INTO t (id) VALUES (?)').bind(r.id)));", 'javascript')]));
ok(rules("const sql = 'SELECT id FROM t WHERE ' + clauses.join(' AND ') + ' ORDER BY id';", 'javascript').includes('where-join-empty@1')
  && rules('const sql = `SELECT id FROM t WHERE ${where.join(" AND ")}`;', 'javascript').includes('where-join-empty@1')
  && !rules("const sql = 'SELECT id FROM t' + (clauses.length ? ' WHERE ' + clauses.join(' AND ') : '') + ' ORDER BY id';", 'javascript').includes('where-join-empty@1')
  && !rules('const q = `SELECT id FROM t${where ? " WHERE " + where : ""} ORDER BY updated DESC`;', 'javascript').includes('where-join-empty@1')
  && !rules("const sql = 'SELECT id FROM t WHERE id IN (' + ids.map(() => '?').join(',') + ')';", 'javascript').includes('where-join-empty@1'),
  'where-join-empty: a WHERE pasted straight from a joined list is flagged; a guarded one and a join inside IN (…) are not: ' + JSON.stringify(rules("const sql = 'SELECT id FROM t WHERE ' + clauses.join(' AND ');", 'javascript')));
ok(rules("ta.rows = Math.min(12, Math.max(3, j.draft.split('\\n').length + 1));", 'javascript').includes('split-to-count@1')
  && rules("const words = text.split(' ').length;", 'javascript').includes('split-to-count@1')
  && !rules("const parts = line.split(',');\nif (parts.length !== 2) return null;", 'javascript').some((f) => f.startsWith('split-to-count'))
  && !rules("if (s.split('/').length === 3) go();", 'javascript').includes('split-to-count@1')
  && !rules("const n = (s.match(/\\n/g) || []).length + 1;", 'javascript').includes('split-to-count@1'),
  'split-to-count: .split(sep).length used as a count is flagged; a split kept for its pieces, a length compared to a number, and the match count are not: ' + JSON.stringify(rules("const words = text.split(' ').length;", 'javascript')));
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
{ // a token read from the environment: no finding, and the closer read is shown the lookup, not a "[redacted]" that reads as a hard-coded key
  const env = 'const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID, TOKEN = process.env.CLOUDFLARE_API_TOKEN;', lit = 'const TOKEN = "sk_live_abcdef1234567890XYZ";';
  ok(!rules(env, 'javascript').includes('hardcoded-secret@1') && redact(env) === env, 'an env lookup is no hard-coded secret and is not masked: ' + redact(env));
  ok(rules(lit, 'javascript').includes('hardcoded-secret@1') && redact(lit) === 'const TOKEN = "[redacted]";', 'a literal token is flagged and masked: ' + redact(lit));
}
{ // the name of an environment variable is no secret: an ALL_CAPS_NAME in quotes names where the key lives (model-bench's
  // "secret ? x : 'CLOUDFLARE_ACCOUNT_ID'" read as a hard-coded key, 2026-10-10); a literal value is still a finding
  for (const named of ["const why = `${!token ? secret : 'CLOUDFLARE_ACCOUNT_ID'} is empty`;", "const secret = process.env.NAME || 'CLOUDFLARE_API_TOKEN';", "const tokenName = 'GITHUB_TOKEN';"])
    ok(!rules(named, 'javascript').includes('hardcoded-secret@1') && redact(named) === named, 'an env var name is no secret and is not masked: ' + named + ' -> ' + redact(named));
  ok(rules("const secret = 'Zx9qLm42RtWv';", 'javascript').includes('hardcoded-secret@1') && redact("secret: 'Zx9qLm42RtWv'") === "secret: '[redacted]'", 'a literal secret still is, and is masked');
  ok(rules("const token = 'ABCD1234EFGH5678';", 'javascript').includes('hardcoded-secret@1'), 'an all-caps value with no underscore is no env name');
  // narrowed (2026-10-10, owner): only an env-shaped name is kept: upper case and underscores, no digits, short, ending in
  // _KEY/_TOKEN/_SECRET/_ID/_URL/_PASSWORD, and never as the value of a password field
  for (const lit of ["PASSWORD: 'MY_SECRET_PASSWORD'", "password = 'DB_ADMIN_PASSWORD'", "secret: 'AKIAIOSFODNN7EXAMPLE'", "token: 'ABCD_1234_EFGH_TOKEN'", "secret: 'SOME_VERY_LONG_NAME_THAT_GOES_ON_AND_ON_AND_ON_TOKEN'", "token: 'NOT_AN_ENV_NAME'"])
    ok(redact(lit) !== lit && /\[redacted\]/.test(redact(lit)) && rules('const x = { ' + lit + ' };', 'javascript').includes('hardcoded-secret@1'), 'still masked and flagged: ' + lit + ' -> ' + redact(lit));
  for (const name of ["secret: 'GITHUB_TOKEN'", "token: 'CLOUDFLARE_API_TOKEN'", "apiKey: 'OPENWEATHER_KEY'", "secret = 'WEBHOOK_SECRET'"])
    ok(redact(name) === name, 'an env-shaped name is kept: ' + name + ' -> ' + redact(name));
}
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
ok(rules('for (var i = 0; i < 5; i++) setTimeout(() => log(i))', 'javascript').includes('var-loop-closure@1') && !rules('for (let i = 0; i < 5; i++) setTimeout(() => log(i))', 'javascript').includes('var-loop-closure@1') && rules('for (var i = 0; i < 3; i++) { btn[i].onclick = function () { go(i) } }', 'javascript').includes('var-loop-closure@1') && !rules('for (var i = 2; i < n; i++) t.push(i * 2); return t.sort(function (a, b) { return a - b })', 'javascript').includes('var-loop-closure@1') && !rules('for (var i = 0; i < n; i++) if (!q.some(function (x) { return x.i === i })) out.push(i);', 'javascript').includes('var-loop-closure@1') && rules('for (var i = 0; i < 3; i++) fns.push(function () { return i })', 'javascript').includes('var-loop-closure@1'), 'var captured by loop callbacks flagged, let not');
ok(rules("const s = JSON.parse(localStorage.getItem('x'))", 'javascript').includes('json-parse-storage@1') && !rules("try { s = JSON.parse(localStorage.getItem('x')) } catch (_) {}", 'javascript').includes('json-parse-storage@1'), 'unguarded JSON.parse of storage flagged, inside try not');
ok(rules("const l = JSON.parse(localStorage.getItem('log') || '[]').filter((x) => x.ok)", 'javascript').includes('json-array-shape@1')
  && rules("const n = JSON.parse(sessionStorage.getItem('n')).map(f)", 'javascript').includes('json-array-shape@1')
  && !rules("const v = JSON.parse(localStorage.getItem('log') || '[]'); const l = (Array.isArray(v) ? v : []).filter(f)", 'javascript').includes('json-array-shape@1')
  && !rules("const have = new Set(JSON.parse(text).map((x) => x.ask))", 'javascript').includes('json-array-shape@1'),
  'an array call straight on parsed saved data is flagged (valid JSON that is not a list throws); a shape check or a repo file is not');
ok(rules("const git = (...a) => execFileSync('git', a, { encoding: 'utf8' });", 'javascript').includes('exec-no-timeout@1')
  && rules("execFileSync('gh', ['api', '-X', 'POST', path]);", 'javascript').includes('exec-no-timeout@1')
  && !rules("const git = (...a) => execFileSync('git', a, { encoding: 'utf8', timeout: 120e3 });", 'javascript').includes('exec-no-timeout@1')
  && !rules("const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });", 'javascript').includes('exec-no-timeout@1'),
  'a network git/gh call with no timeout is flagged (a git wrapper too); a timeout, or a local git command, is not');
ok(rules('<table id="t">\n  <tr><td>a</td><td>1</td></tr>\n</table>', 'javascript').includes('table-no-header@1')
  && !rules('<table>\n  <thead><tr><th scope="col">Measure</th></tr></thead>\n</table>', 'javascript').includes('table-no-header@1')
  && !rules("el.innerHTML = '<table><tr><th>Name</th></tr></table>';", 'javascript').includes('table-no-header@1')
  && !rules('<table role="presentation"><tr><td>x</td></tr></table>', 'javascript').includes('table-no-header@1'),
  'a table with no header cells is flagged; a header row, a header in the same string, or a layout table is not');
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
// a typed array sorts numerically with no compare: a receiver declared as one (this line or the one above) is not flagged; a plain array, another name and a call result still are
{ const flagged = (c) => rules(c, 'javascript').some((r) => r.startsWith('sort-no-compare@'));
  ok(!flagged('const v = new Float32Array(n); v.sort();') && !flagged('const ds = new Float32Array(count);\nds.sort();') && !flagged('let $a = new Uint8Array(4);\n$a.sort();') && !flagged('const big = new BigInt64Array(3);\nbig.sort();') && !flagged('const u = new Uint16Array(3);\nu.sort();') && !flagged('const i = new Int32Array(3);\ni.sort();') && !flagged('const c = new Uint8ClampedArray(3);\nc.sort();'), 'typed-array sort() is not flagged');
  ok(flagged('const list = [10, 9, 1];\nlist.sort();') && flagged('const v = new Float32Array(3);\nother.sort();') && flagged('const v = new Array(3);\nv.sort();') && flagged('getList().sort();') && flagged('const a = new Float32Array(3);\nconst b = [3, 1];\nb.sort();'), 'plain arrays, other names and call results are still flagged'); }
ok(rules('if (arr.indexOf(x)) {}', 'javascript').includes('indexof-truthy@1') && rules('if (!s.indexOf("a") && ok) {}', 'javascript').includes('indexof-truthy@1') && !rules('if (arr.indexOf(x) !== -1) {}', 'javascript').includes('indexof-truthy@1') && !rules('if (arr.indexOf(x) > 0) {}', 'javascript').includes('indexof-truthy@1'), 'indexOf as a truth test flagged, compared indexOf not');
ok(rules("el.addEventListener('click', handler())", 'javascript').includes('listener-called@1') && !rules("el.addEventListener('click', handler)", 'javascript').includes('listener-called@1') && !rules("el.addEventListener('click', makeHandler(1), false)", 'javascript').includes('listener-called@1') && !rules("el.addEventListener('click', () => go())", 'javascript').includes('listener-called@1'), 'handler() passed to addEventListener flagged, a function, a factory or an arrow not');
ok(rules('const ok = 0.1 + 0.2 === 0.3', 'javascript').includes('float-equality@1') && rules('if price == 0.1:', 'python').includes('float-equality@1') && !rules('if (x === 1) {}', 'javascript').includes('float-equality@1') && !rules('if (v === 1.0) {}', 'javascript').includes('float-equality@1') && !rules('if (s === "0.5") {}', 'javascript').includes('float-equality@1') && !rules('if (a <= 0.5) {}', 'javascript').includes('float-equality@1') && rules('if (0.1 == price):', 'python').includes('float-equality@1') && !rules('if (0.5 <= x) {}', 'javascript').includes('float-equality@1'), 'exact == on a decimal flagged; whole numbers, 1.0, strings and <= not');
ok(!rules("&& groupOf('make the group bigger').by === 1.25 && x", 'javascript').includes('float-equality@1') && !rules('if (half === 0.5) {}', 'javascript').includes('float-equality@1') && rules('if (total === 0.3) {}', 'javascript').includes('float-equality@1') && rules('if (a + 0.1 === 1.25) {}', 'javascript').includes('float-equality@1'), 'exact == on a decimal that binary holds exactly (1.25, 0.5) is not flagged; 0.3 and a sum with 0.1 still are');
ok(!rules('if (woa(1, 2, 1.5) !== .5) fail();', 'javascript').includes('float-equality@1') && !rules('if (median(xs) === 2.25) ok();', 'javascript').includes('float-equality@1') && rules('if (x === 0.3) {}', 'javascript').includes('float-equality@1'), 'selftest-style comparisons with .5 and 2.25 not flagged; 0.3 still is');
ok(rules('os.chmod(path, 0o777)', 'python').includes('chmod-777@1') && !rules('os.chmod(path, 0o644)', 'python').includes('chmod-777@1') && rules('chmod 777 f', 'shell').includes('chmod-777@1'), 'os.chmod 0o777 flagged in Python, 0o644 not, shell still flagged');
ok(!rules("SELECT name FROM users WHERE email LIKE '%' + @q + '%'", 'sql').includes('sql-concat@1'), 'a LIKE pattern built around an @parameter is not SQL injection');
// a template SQL literal whose only ${} are bare clause fragments right after WHERE/AND/OR/HAVING, with the values bound (a ? placeholder and .bind): not pasted
{ const BT = '`';
  const flags = (code) => rules(code, 'javascript').includes('sql-concat@1');
  ok(!flags('const { results } = await env.DB.prepare(' + BT + 'SELECT id, kind, name, summary, links, state, remote, last_commit, digest, sha256, updated FROM void_memory WHERE ${where} ORDER BY updated DESC LIMIT ?' + BT + ').bind(...args, n).all();'), 'the memory search query (fixed fragments, every value bound) is not SQL built by pasting');
  ok(!flags('const { results } = await env.DB.prepare(' + BT + 'SELECT a FROM t WHERE ${where} ORDER BY n LIMIT ?' + BT + ').bind(...args, 5).all();') && !flags('db.prepare(' + BT + 'SELECT a FROM t WHERE id = ? AND ${cond}' + BT + ').bind(id)'), 'a clause fragment after WHERE or AND with the values bound is fine');
  ok(flags('db.prepare(' + BT + 'SELECT a FROM t WHERE name = ${name} AND id = ?' + BT + ').bind(id)'), 'a value pasted into a comparison still flags even when other values are bound');
  ok(flags('db.prepare(' + BT + "SELECT a FROM t WHERE name = '${name}' AND id = ?" + BT + ').bind(id)'), 'a value pasted inside quotes still flags');
  ok(flags('db.prepare(' + BT + 'SELECT a FROM t WHERE ${where}' + BT + ').all()'), 'a clause fragment with nothing bound still flags');
  ok(flags('db.prepare(' + BT + 'SELECT a FROM ${table} WHERE id = ?' + BT + ').bind(id)'), 'a table name pasted in still flags');
  ok(flags('db.prepare(' + BT + 'SELECT a FROM t WHERE ${build(x)} AND id = ?' + BT + ').bind(id)'), 'a call inside the hole still flags'); }
ok(!rules("await ctx.env.DB.prepare('UPDATE void_queue SET note = ? WHERE id = ? AND state = ?').bind(r.ok ? 'builder woken' : 'builder wake failed ' + r.status, item.id, 'queued').run();", 'javascript').includes('sql-concat@1')
  && !rules("const r = await db.query('SELECT a FROM t WHERE id = ?', [prefix + id]);", 'javascript').includes('sql-concat@1')
  && rules("const q = 'SELECT ' + cols + ' FROM t';", 'javascript').includes('sql-concat@1')
  && rules('cur.execute("SELECT name FROM users WHERE id = %s" % uid)', 'python').includes('sql-concat@1')
  && rules('cur.execute("SELECT name FROM users WHERE id = {}".format(uid))', 'python').includes('sql-concat@1'), 'a concatenation in a bound value or an argument is not SQL built by pasting; concatenation, % and .format() on the SQL literal itself still are');
// run 40: DROP/TRUNCATE, comma joins without WHERE, for over ls, unquoted [ $x ], md5/sha1 for passwords, CORS * with credentials, debug=True, JWT "none"
ok(looksLikeCode('DROP TABLE users', 'sql') && rules('DROP TABLE users', 'sql').includes('drop-table@1') && rules('TRUNCATE orders;', 'sql').includes('drop-table@1') && !rules('SELECT drop_count FROM t', 'sql').includes('drop-table@1'), 'DROP TABLE and TRUNCATE flagged, a column named drop_count not');
ok(rules('SELECT * FROM a, b', 'sql').includes('comma-join@1') && !rules('SELECT * FROM a, b WHERE a.id = b.a_id', 'sql').includes('comma-join@1') && !rules('SELECT * FROM a JOIN b ON a.id = b.a_id', 'sql').includes('comma-join@1'), 'comma join without WHERE flagged, with WHERE or JOIN ON not');
ok(rules('for f in $(ls *.txt); do echo $f; done', 'shell').includes('for-ls@1') && !rules('for f in *.txt; do echo "$f"; done', 'shell').includes('for-ls@1'), 'for over ls flagged, a glob not');
ok(rules('if [ $x == 1 ]; then echo hi; fi', 'shell').includes('unquoted-test@1') && !rules('if [ "$x" = 1 ]; then echo hi; fi', 'shell').includes('unquoted-test@1') && !rules('if [[ $x == 1 ]]; then echo hi; fi', 'shell').includes('unquoted-test@1'), 'unquoted [ $x == 1 ] flagged, quoted and [[ ]] not');
ok(rules('$hash = md5($password);', 'php').includes('weak-hash@1') && rules('h = hashlib.md5(password.encode()).hexdigest()', 'python').includes('weak-hash@1') && rules("const h = crypto.createHash('sha1').update(pw).digest('hex')", 'javascript').includes('weak-hash@1') && !rules('const etag = md5(body)', 'javascript').includes('weak-hash@1'), 'md5/sha1 of a password flagged, md5 of a file body not');
ok(rules("app.use(cors({ origin: '*', credentials: true }))", 'javascript').includes('cors-any@1') && !rules("app.use(cors({ origin: '*' }))", 'javascript').includes('cors-any@1') && !rules("cors({ origin: ['https://a.example'], credentials: true })", 'javascript').includes('cors-any@1'), 'CORS * with credentials flagged, * alone or a listed origin not');
ok(rules('app.run(debug=True)', 'python').includes('debug-true@1') && rules('DEBUG = True', 'python').includes('debug-true@1') && !rules('app.run(debug=os.environ.get("DEBUG") == "1")', 'python').includes('debug-true@1'), 'debug=True flagged, debug from the environment not');
ok(rules("jwt.verify(token, secret, { algorithms: ['none'] })", 'javascript').includes('jwt-none@1') && !rules("jwt.verify(token, secret, { algorithms: ['HS256'] })", 'javascript').includes('jwt-none@1'), 'JWT algorithm none flagged, HS256 not');
ok(!rules('etag = md5(body) // skip password check', 'javascript').includes('weak-hash@1') && rules('$h = sha1($pwd . $salt);', 'php').includes('weak-hash@1'), 'weak-hash looks at what is hashed, not at other words on the line');
{ const multi = ruleReview("app.use(cors({\n  origin: '*',\n  credentials: true,\n}))", { lang: 'javascript' }).findings.some((f) => f.rule === 'cors-any');
  const apart = ruleReview("const a = { origin: '*' };\nconst b = { credentials: true };", { lang: 'javascript' }).findings.some((f) => f.rule === 'cors-any');
  ok(multi && !apart, 'CORS * with credentials found across lines of one object, not across two objects'); }
// run 41: Go empty err handling, a goroutine changing shared state, Rails where("...#{}"), requests with no timeout
ok(rules('if err != nil { }', 'go').includes('go-empty-err@1') && !rules('if err != nil { return err }', 'go').includes('go-empty-err@1'), 'empty err handling flagged, returning it not');
ok(rules('go func() { counter++ }()', 'go').includes('go-race@1') && !rules('go func() { mu.Lock(); counter++; mu.Unlock() }()', 'go').includes('go-race@1') && !rules('go func() { atomic.AddInt64(&n, 1) }()', 'go').includes('go-race@1') && !rules('go func() { ch <- 1 }()', 'go').includes('go-race@1'), 'unlocked change in a goroutine flagged; mutex, atomic and channel not');
ok(rules(`User.where("name = '#{params[:name]}'")`, 'ruby').includes('rails-where-interp@1') && !rules('User.where("name = ?", params[:name])', 'ruby').includes('rails-where-interp@1') && !rules('User.where(name: params[:name])', 'ruby').includes('rails-where-interp@1'), 'Rails where with #{} flagged, ? and hash forms not');
ok(rules('r = requests.get(url)', 'python').includes('requests-no-timeout@1') && rules('requests.get(url, timeout=None)', 'python').includes('requests-no-timeout@1') && !rules('requests.get(url, timeout=10)', 'python').includes('requests-no-timeout@1') && !rules('r = requests.post(\n    url,\n    json=data,\n    timeout=5,\n)', 'python').includes('requests-no-timeout@1'), 'requests without a timeout flagged; timeout=10, also on a later line, not');
// run 42: Python 2 print, from x import *, a variable set to null then used, PHP include of request input
ok(looksLikeCode("print 'hello'", 'python') && rules("print 'hello'", 'python').includes('py2-print@1') && !rules("print('hello')", 'python').includes('py2-print@1'), 'Python 2 print flagged, print() not');
ok(rules('from os import *', 'python').includes('wildcard-import@1') && !rules('from os import path', 'python').includes('wildcard-import@1'), 'import * flagged, named imports not');
ok(rules('String s = null; s.length();', 'java').includes('null-deref@1') && !rules('String s = null; s = read(); s.length();', 'java').includes('null-deref@1') && !rules('let a = null; b.go();', 'javascript').includes('null-deref@1') && !rules('String s = null; if (s != null) s.length();', 'java').includes('null-deref@1') && !rules('let a = null; if (a) a.go();', 'javascript').includes('null-deref@1'), 'null then .method flagged; reassigned first, or another variable, not');
ok(rules("include($_GET['page']);", 'php').includes('php-include-input@1') && !rules("include 'header.php';", 'php').includes('php-include-input@1'), 'include of request input flagged, a fixed file not');
// run 43: ORDER BY RAND(), Rust unsafe without a SAFETY note
ok(rules('SELECT * FROM users ORDER BY RAND()', 'sql').includes('order-by-rand@1') && rules('SELECT id FROM t ORDER BY random()', 'sql').includes('order-by-rand@1') && !rules('SELECT id FROM t ORDER BY created_at', 'sql').includes('order-by-rand@1'), 'ORDER BY RAND() flagged, a real column not');
ok(rules('unsafe { *ptr = 5; }', 'rust').includes('rust-unsafe@1') && !rules('unsafe { *ptr = 5; } // SAFETY: ptr comes from Box::into_raw above', 'rust').includes('rust-unsafe@1') && !rules('let x = safe_call();', 'rust').includes('rust-unsafe@1'), 'unsafe block flagged, one with a SAFETY note not');
ok(rules('cd $dir && rm -rf *', 'shell').includes('cd-empty-rm@1') && rules('cd "$dir"; rm -rf *', 'shell').includes('cd-empty-rm@1') && !rules('cd "${dir:?}" && rm -rf *', 'shell').includes('cd-empty-rm@1') && !rules('cd /tmp/build && rm -rf *', 'shell').includes('cd-empty-rm@1') && rules('cd $dir && rm -rf * && echo "${other:?}"', 'shell').includes('cd-empty-rm@1'), 'cd $var then rm -rf * flagged; ${dir:?} and a fixed path not');
ok(rules('FROM node:latest', 'dockerfile').includes('docker-latest@1') && rules('FROM python', 'dockerfile').includes('docker-latest@1') && !rules('FROM node:20-slim', 'dockerfile').includes('docker-latest@1') && !rules('FROM scratch', 'dockerfile').includes('docker-latest@1') && !rules('FROM node@sha256:abc123', 'dockerfile').includes('docker-latest@1') && !rules('FROM localhost:5000/app:1.2', 'dockerfile').includes('docker-latest@1') && !rules('FROM node:20 AS build\nRUN npm ci\nFROM build', 'dockerfile').includes('docker-latest@3'), 'FROM with :latest or no tag flagged; a version, a digest, scratch not');
ok(rules('RUN curl https://x.example/i.sh | sh', 'dockerfile').includes('curl-pipe-sh@1') && rules('curl -k https://api.example.com', 'shell').includes('curl-insecure@1') && rules('RUN curl -sSk https://x.example/f', 'dockerfile').includes('curl-insecure@1') && !rules('curl -sSL https://x.example/f', 'shell').includes('curl-insecure@1') && rules('wget --no-check-certificate https://x.example/f', 'shell').includes('curl-insecure@1') && !rules('curl -kv', 'javascript').includes('curl-insecure@1') && !rules('curl -fsSL https://x.example/f -o f', 'shell').includes('curl-insecure@1'), 'curl -k and wget --no-check-certificate flagged; plain curl not');
ok(rules('password: hunter2', 'yaml').includes('hardcoded-secret@1') && rules('  api_key: "sk_abcd1234"', 'yaml').includes('hardcoded-secret@1') && !rules('password: ${DB_PASSWORD}', 'yaml').includes('hardcoded-secret@1') && !rules('token: ${{ secrets.TOKEN }}', 'yaml').includes('hardcoded-secret@1') && !rules('password_min_length: 8', 'yaml').includes('hardcoded-secret@1') && rules('ENV API_TOKEN=abcd1234efgh', 'dockerfile').includes('hardcoded-secret@1') && !rules('ARG API_TOKEN', 'dockerfile').includes('hardcoded-secret@1'), 'YAML and Dockerfile secrets flagged; ${VAR}, ${{ secrets }}, a bare ARG not');
ok(rules('system("rm $file");', 'perl').includes('perl-shell-interp@1') && rules('my $out = `ls $dir`;', 'perl').includes('perl-shell-interp@1') && !rules('system("rm", "--", $file);', 'perl').includes('perl-shell-interp@1'), 'Perl shell string with a variable flagged; the list form not');
ok(rules('x = 5', 'lua').includes('lua-global@1') && !rules('local x = 1\nx = 5', 'lua').includes('lua-global@2') && !rules('local a, x = 1, 2\nx = 5', 'lua').includes('lua-global@2') && !rules('function f(x)\n  x = x + 1\nend', 'lua').includes('lua-global@2') && !rules('for i, x in ipairs(t) do\n  x = 1\nend', 'lua').includes('lua-global@2') && !rules('local function f() end\nf = nil', 'lua').includes('lua-global@2') && !rules('t.x = 5', 'lua').includes('lua-global@1') && !rules('if x == 5 then end', 'lua').includes('lua-global@1'), 'Lua assignment with no local flagged; locals, parameters, loop names, fields and == not');
ok(langNamed('review this dockerfile') === 'dockerfile' && langNamed('check my docker file') === 'dockerfile' && langNamed('review this yaml') === 'yaml' && langNamed('is this yml ok') === 'yaml' && langNamed('review this lua') === 'lua' && langNamed('review this perl') === 'perl' && looksLikeCode('FROM node:latest', 'dockerfile') && looksLikeCode('password: hunter2', 'yaml') && looksLikeCode('local x = 1\nx = 5', 'lua') && !looksLikeCode('please look at my yaml file', null), 'Dockerfile, YAML, Lua and Perl are named and their short pastes read as code');
ok(rules('eval "$1"', 'shell').includes('shell-eval@1') && !rules('# eval "$1" is unsafe', 'shell').includes('shell-eval@1') && !rules('eval "echo hi"', 'shell').includes('shell-eval@1'), 'shell eval of a variable flagged; a comment and a fixed string not');
ok(rules('Invoke-Expression $userInput', 'powershell').includes('ps-invoke-expression@1') && rules('iex $script', 'powershell').includes('ps-invoke-expression@1') && !rules('Invoke-Expression "Get-Date"', 'powershell').includes('ps-invoke-expression@1'), 'PowerShell Invoke-Expression of a variable flagged');
ok(rules('cidr_blocks = ["0.0.0.0/0"]', 'terraform').includes('tf-open-ingress@1') && rules('  ipv6_cidr_blocks = ["::/0"]', 'terraform').includes('tf-open-ingress@1') && !rules('cidr_blocks = ["10.0.0.0/16"]', 'terraform').includes('tf-open-ingress@1') && !rules('egress {\n  from_port = 0\n  cidr_blocks = ["0.0.0.0/0"]\n}', 'terraform').includes('tf-open-ingress@3') && rules('ingress {\n  from_port = 22\n  cidr_blocks = ["0.0.0.0/0"]\n}', 'terraform').includes('tf-open-ingress@3') && !rules('resource "aws_security_group_rule" "out" {\n  type = "egress"\n  cidr_blocks = ["0.0.0.0/0"]\n}', 'terraform').includes('tf-open-ingress@3'), 'Terraform open to the internet flagged; a private range not');
ok(rules("GRANT ALL PRIVILEGES ON *.* TO 'app'@'%';", 'sql').includes('grant-all@1') && !rules('GRANT SELECT, INSERT ON shop.orders TO app;', 'sql').includes('grant-all@1'), 'GRANT ALL flagged; narrow grants not');
ok(rules('<a href="https://x.com" target="_blank">', 'html').includes('blank-no-opener@1') && !rules('<a href="/x" target="_blank" rel="noopener">', 'html').includes('blank-no-opener@1') && rules('<img src="cat.png">', 'html').includes('img-no-alt@1') && !rules('<img src="cat.png" alt="a cat">', 'html').includes('img-no-alt@1') && !rules('<img src="line.png" alt="">', 'html').includes('img-no-alt@1') && rules('<img src="cat.png" data-alt="cat">', 'html').includes('img-no-alt@1') && rules('<a href="/x" target="_blank" data-rel="noopener">', 'html').includes('blank-no-opener@1'), 'target=_blank without rel and img without alt flagged');
ok(langNamed('review this powershell') === 'powershell' && langNamed('review this terraform') === 'terraform' && langNamed('review this html') === 'html' && langNamed('review this css') === 'css' && langNamed('review this js that builds html') === 'javascript' && looksLikeCode('Invoke-Expression $userInput', 'powershell') && looksLikeCode('<img src="cat.png">', 'html') && looksLikeCode('* { box-sizing: border-box !important; }', 'css') && looksLikeCode('eval "$1"', 'shell'), 'PowerShell, Terraform, HTML and CSS are named and their short pastes read as code');
ok(rules('Random r = new Random(); String token = Long.toString(r.nextLong());', 'java').includes('weak-random-jvm@1') && !rules('Random r = new Random(42); int dice = r.nextInt(6);', 'java').includes('weak-random-jvm@1') && !rules('SecureRandom r = new SecureRandom(); String token = next(r);', 'java').includes('weak-random-jvm@1') && rules('var r = new java.util.Random(); String token = next(r);', 'java').includes('weak-random-jvm@1') && rules('var r = new System.Random(); var token = r.Next();', 'csharp').includes('weak-random-jvm@1') && rules('val r = Random(); val token = r.nextLong()', 'kotlin').includes('weak-random-jvm@1') && !rules('val token = SecureRandom().nextLong()', 'kotlin').includes('weak-random-jvm@1'), 'java.util.Random for a token flagged; dice and SecureRandom not');
ok(rules('image: postgres:latest', 'yaml').includes('image-latest@1') && rules('  - image: redis', 'yaml').includes('image-latest@1') && !rules('image: postgres:16', 'yaml').includes('image-latest@1') && !rules('image: ${IMAGE}', 'yaml').includes('image-latest@1') && !rules('image: ghcr.io/a/b@sha256:abc', 'yaml').includes('image-latest@1'), 'YAML image with :latest or no tag flagged; a version, a variable and a digest not');
ok(rules('USER root', 'dockerfile').includes('docker-root@1') && rules('USER 0', 'dockerfile').includes('docker-root@1') && !rules('USER app', 'dockerfile').includes('docker-root@1') && !rules('USER rootless', 'dockerfile').includes('docker-root@1'), 'Dockerfile USER root flagged; another user not');
// keys never shown as written
ok(!JSON.stringify(ruleReview('const token = "ghp_abcdefghijklmnopqrstuvwxyz0123";')).includes('ghp_abcdef'), 'a key in a finding is masked');
// run 64: thin-area probes (a language-named ask with the paste on the next lines; Python sort-None, [i + 1] in range(len()), counting into a missing key;
// Go log-and-carry-on, <= len(); Rust use-after-move, literal index past the end; SQL = NULL, reversed BETWEEN)
ok(isReviewAsk('review this python:\nfor i in range(len(xs)):\n    print(xs[i+1])') && codeOf('review this python:\nfor i in range(len(xs)):\n    print(xs[i+1])') === 'for i in range(len(xs)):\n    print(xs[i+1])', 'a language-named ask with the paste on the next lines is a review of those lines');
ok(!isReviewAsk('here is python:\nfor i in range(3):\n    print(i)'), 'a paste without a review ask is not a review');
for (const [lang, c, want] of [['python', 'sorted_items = items.sort()', 'sort-none@1'], ['python', 'for i in range(len(xs)):\n    print(xs[i+1])', 'range-next@2'], ['python', 'd = {}\nfor k in keys:\n    d[k] = d[k] + 1', 'dict-add-missing@3'],
  ['go', 'data, err := os.ReadFile(name)\nif err != nil {\n    log.Println(err)\n}\nreturn string(data)', 'go-err-log-continue@2'],
  ['go', 'for i := 0; i <= len(nums); i++ { total += nums[i] }', 'len-le-loop@1'],
  ['rust', 'let s = String::from("hi"); let t = s; println!("{}", s);', 'rust-moved-use@1'],
  ['rust', 'let v = vec![1, 2, 3]; println!("{}", v[10]);', 'rust-literal-index@1'],
  ['sql', 'SELECT * FROM users WHERE email = NULL', 'null-compare@1'],
  ['sql', 'SELECT * FROM users WHERE age BETWEEN 20 AND 10', 'between-reversed@1']])
  ok(rules(c, lang).includes(want), want + ' in ' + lang + ': ' + c.slice(0, 60) + ' (got ' + rules(c, lang).join(',') + ')');
for (const [lang, c] of [['python', 'items.sort()\nprint(items[0])'], ['python', 'for i, x in enumerate(xs):\n    print(x)'], ['python', 'd[k] = d.get(k, 0) + 1'],
  ['go', 'if err != nil {\n    return err\n}'], ['go', 'for i := 0; i < len(nums); i++ { total += nums[i] }'],
  ['rust', 'let n = 5; let m = n; println!("{}", n);'], ['rust', 'let v = vec![1, 2, 3]; println!("{}", v[2]);'],
  ['sql', 'SELECT * FROM users WHERE email IS NULL'], ['sql', 'SELECT * FROM users WHERE age BETWEEN 10 AND 20']])
  ok(!rules(c, lang).some((r) => /sort-none|range-next|dict-add-missing|go-err-log-continue|len-le-loop|rust-moved-use|rust-literal-index|null-compare|between-reversed/.test(r)), 'no finding in ' + lang + ': ' + c.slice(0, 60) + ' (got ' + rules(c, lang).join(',') + ')');
// run 65: batch 2 (helper/bench-thin-areas-2) - six rules the first thin-area round did not cover
for (const [lang, c, want] of [
  ['python', 'for u in users:\n    users.remove(u)', 'remove-while-iterating@1'],
  ['python', 'if type(x) == dict:\n    return x["a"]', 'type-eq-dict@1'],
  ['go', 'for _, it := range items {\n\tit.Price *= 2\n}', 'range-value-copy@1'],
  ['go', 'go func() {\n\twg.Add(1)\n\tdefer wg.Done()\n\tfetch(u)\n}()', 'wg-add-in-goroutine@2'],
  ['rust', 'let mut g = state.lock().expect("poisoned");\nfetch(url).await;', 'lock-across-await@1'],
  ['sql', 'SELECT u.name, o.total FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE o.total > 50;', 'left-join-where-filter@1'],
  // the same six as one-line pastes, which is the shape the bench asks in
  ['python', 'for u in users: users.remove(u)', 'remove-while-iterating@1'],
  ['python', 'if type(x) == dict: return x["a"]', 'type-eq-dict@1'],
  ['go', 'for _, it := range items { it.Price *= 2 }', 'range-value-copy@1'],
  ['go', 'go func() { wg.Add(1); defer wg.Done(); fetch(u) }()', 'wg-add-in-goroutine@1'],
  ['rust', 'let mut g = state.lock().expect("poisoned"); fetch(url).await;', 'lock-across-await@1'],
  ['sql', 'SELECT u.name, o.total FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE o.total > 50;', 'left-join-where-filter@1']])
  ok(rules(c, lang).includes(want), want + ' in ' + lang + ': ' + c.slice(0, 60) + ' (got ' + rules(c, lang).join(',') + ')');
for (const [lang, c] of [
  ['python', 'for u in users[:]:\n    users.remove(u)'], ['python', 'for u in users:\n    keep.append(u)'],
  ['python', 'if isinstance(x, dict):\n    return x["a"]'], ['python', 'for x in items:\n    print(x)'],
  ['go', 'for _, it := range items {\n\tfmt.Println(it.Price)\n}'], ['go', 'for i := range items {\n\titems[i].Price *= 2\n}'],
  ['go', 'var wg sync.WaitGroup\nwg.Add(1)\ngo func() {\n\tdefer wg.Done()\n\tfetch(u)\n}()'], ['go', 'wg.Wait()'],
  ['rust', 'let mut g = state.lock().expect("x");\ndrop(g);\nfetch(url).await;'], ['rust', 'let n = 5;\nlet m = n;\nprintln!("{}", n);'],
  ['sql', 'SELECT u.name, o.total FROM users u LEFT JOIN orders o ON o.user_id = u.id AND o.total > 50;'],
  ['sql', 'SELECT u.name, o.total FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE u.id = 3;'],
  ['sql', 'SELECT u.name FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE o.total IS NULL;']])
  ok(!rules(c, lang).some((r) => /remove-while-iterating|type-eq-dict|range-value-copy|wg-add-in-goroutine|lock-across-await|left-join-where-filter/.test(r)), 'no finding in ' + lang + ': ' + c.slice(0, 60) + ' (got ' + rules(c, lang).join(',') + ')');
// the pull-request review skips tests in every language the repo writes (their fixtures are bad code on purpose), and nothing else by accident
for (const f of ['tools/ouroboros_test.py', 'tools/void_lens_test.py', 'tools/memory.test.mjs', 'tools/test_void.mjs', 'tools/skills_test.mjs', 'tools/tictactoe.test.mjs', 'tools/sub/helper_test.js', 'tools/test_glyphs.mjs'])
  ok(skippedInReview(f), 'a test file is not reviewed: ' + f);
for (const f of ['tools/ouroboros.py', 'tools/void_lens.py', 'void-live-deploy/lib/memory-core.js', 'tools/latest.py', 'tools/contest.mjs', 'tools/testing_notes.py', 'void-live-deploy/functions/api/memory.js'])
  ok(!skippedInReview(f), 'real code is still reviewed: ' + f);
// run 54: XML namespace and package-type names (xmlns="http://…", schemas.microsoft.com, schemas.openxmlformats.org) are identifiers, never fetched
for (const c of ['const m = \'<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\';', 'const t = \'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\';',
  'const r = \'<Relationship Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\';', 'const x = \'<svg xmlns:xl="http://ns.vendor-xml.net/x">\';'])
  ok(!rules(c, 'javascript').some((r) => /plain-http/.test(r)), 'no plain-http for: ' + c + ' (got ' + rules(c, 'javascript').join(',') + ')');
for (const c of ['fetch("http://schemas.microsoft.com.evil.net/x");', 'const feed = "http://api.vendor-xml.net/feed";', 'img.src = "http://cdn.shop.net/a.png"; // xmlns="https://ok"'])
  ok(rules(c, 'javascript').includes('plain-http@1'), 'still plain-http: ' + c);
// run 56: a null start guarded by short-circuit or a ternary is not a null dereference (the best-so-far loop); unguarded still is
for (const c of ['var best=null;xs.forEach(function(w){if(!best||w.t<best.t)best=w});', 'let m = null; if (m == null || m.size < 2) m = next();', 'let r = null; const n = r ? r.length : 0;'])
  ok(!rules(c, 'javascript').includes('null-deref@1'), 'no null-deref for: ' + c);
for (const c of ['let best = null; if (best.t > 1) go();', 'let r = null; const n = r?.x || r.length;'])
  ok(rules(c, 'javascript').includes('null-deref@1'), 'still null-deref: ' + c);
// run 57: GitHub Actions workflows (GitHub's security hardening guide): a pasted workflow is read as YAML, and five risks are found
{
  const wf = ['on:', '  pull_request_target:', 'permissions: write-all', 'jobs:', '  build:', '    runs-on: ubuntu-latest', '    steps:', '      - uses: actions/checkout@v4', '        with:',
    '          ref: ${{ github.event.pull_request.head.sha }}', '      - uses: some-org/deploy-action@v2', '      - uses: other/tool@main', '      - uses: actions/setup-node@0a44ba7841725637a19e28fa30b79a866c81b0a6',
    '      - env:', '          TITLE: ${{ github.event.issue.title }}', '        run: |', '          echo "${{ github.event.issue.title }}"', '          echo "$TITLE"', '          echo ${{ secrets.DEPLOY_KEY }}',
    '      - if: ${{ github.event.pull_request.title != \'\' }}', '        run: npm test'].join('\n');
  ok(langOf(wf) === 'yaml', 'a workflow is yaml, got ' + langOf(wf));
  const got = ruleReview(wf).findings.map((f) => f.line + ':' + f.rule).sort().join(' ');
  ok(got === ['10:gha-prt-checkout', '11:gha-unpinned-action', '12:gha-unpinned-action', '17:gha-script-injection', '19:gha-secret-echo', '3:gha-write-all'].sort().join(' '), 'workflow findings: ' + got);
  // the same checkout under pull_request (not _target) is fine; a k8s manifest is yaml too
  ok(!ruleReview(wf.replace('pull_request_target', 'pull_request')).findings.some((f) => f.rule === 'gha-prt-checkout'), 'pull_request checkout is fine');
  ok(langOf('apiVersion: v1\nkind: Pod\nspec:\n  containers:\n    - image: nginx') === 'yaml', 'a k8s manifest is yaml');
  ok(isReviewAsk('audit my github actions') && isReviewAsk('check this CI workflow') && isReviewAsk('review my GitHub Actions workflow') && !isReviewAsk('is my workflow good') && !isReviewAsk('check my actions'), 'actions review asks');
}
// speed: Void's reviewer is the first reviewer on every PR, so it has to be fast. A string with many backslashes (a regex like
// /\s+\w+\s+/ written out) once sent the string finder into exponential backtracking: one line of go.js took 2.5 s, and
// code-review.js itself never finished. Each case below must finish in well under a second.
{
  const slow = [];
  for (const [name, code] of [
    ['backslashes in a string', "if (/^(?:a\\s+|b\\s+|c\\s+|d\\s+|e\\s+|f\\s+|g\\s+|h\\s+|i\\s+)?(?:x|y)$/.test(t) && t !== 'go' && t !== \"let's\") return { kind: 'x' };"],
    ['an unclosed quote then backslashes', "const s = 'it\\'s " + '\\d'.repeat(200) + ";"],
    ['a long minified line', 'var a=' + Array.from({ length: 3000 }, (_, i) => '"k' + i + '\\n"').join('+') + ';'],
    ['the reviewer reading itself', fs.readFileSync(new URL('../void-live-deploy/lib/code-review.js', import.meta.url), 'utf8')],
  ]) { const t = performance.now(); ruleReview(code, { lang: 'javascript', max: 5000, collapse: false }); const ms = performance.now() - t; if (ms > 800) slow.push(name + ' ' + Math.round(ms) + ' ms'); }
  ok(!slow.length, 'review too slow: ' + slow.join(', '));
}
// an HTML page's <textarea> and <pre> hold text, not code: a PR review leaves those lines out
{
  const page = ['<p>hi</p>', '<textarea id="code">if (x = 5) {', '  el.innerHTML = name;', '}</textarea>', '<script>', 'if (y = 6) go();', '</script>', '<pre>eval(input)</pre>', '<pre class="a">', 'q = "SELECT " + id', '</pre><p>after</p>'];
  ok([...textLines(page)].join(',') === '2,3,4,8,9,10,11', 'text lines: ' + [...textLines(page)].join(','));
}
{ // conflict markers: a bug in any file, whatever its language; a lone ======= (a Markdown heading underline) only beside a start line
  const { conflictMarkers } = await import('../void-live-deploy/lib/code-review.js');
  const json = '[\n  {"a": 1},\n' + '<'.repeat(7) + ' HEAD\n  {"b": 2}\n' + '='.repeat(7) + '\n  {"c": 3}\n' + '>'.repeat(7) + ' origin/main\n]';
  ok(conflictMarkers(json).map((c) => c.line).join(',') === '3,5,7', 'markers found on lines 3, 5 and 7 of a JSON ledger: ' + JSON.stringify(conflictMarkers(json)));
  ok(rules(json.replace(/^\[|\]$/g, ''), 'javascript').filter((r) => r.startsWith('conflict-markers@')).length === 3, 'the rule flags all three marker lines as a bug in code too');
  const md = 'Title\n' + '='.repeat(7) + '\n\ntext ' + '<'.repeat(7) + ' not at the start\n';
  ok(!conflictMarkers(md).length && !rules(md, 'javascript').some((r) => r.startsWith('conflict-markers@')), 'a Markdown underline and a marker that does not start a line are left alone');
  ok(conflictMarkers('>'.repeat(7) + '\n').length === 1 && !conflictMarkers('>'.repeat(8) + ' x\n').length, 'an end marker with no branch name counts; eight > is not git\'s');
}
console.log(bad ? bad + ' failed' : 'review: all passed');
process.exit(bad ? 1 : 0);
