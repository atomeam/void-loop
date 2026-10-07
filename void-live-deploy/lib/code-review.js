// void-review: skip-file (its rules contain the very patterns they look for)
// Void reviews code. Shared by the page (instant checks) and /api/answer mode 'review' (the deeper read by the model).
// Someone pastes code and asks for a review: the quick checks below run in the browser at once (bugs, security holes, risky
// habits, with line numbers), then the model reads the whole thing. Keys and passwords in the paste are masked before
// anything is shown, logged or sent (redact, lib/automation-fix.js). The checks are tuned to say nothing rather than
// something wrong: each one looks for a pattern that is almost always a real problem.
import { redact } from './automation-fix.js';

// "review my code", "code review", "check this script", "what's wrong with my function", "is this query safe", "find bugs in this"
const NOUN = '(?:code|script|function|snippet|program|pull\\s+request|pr|diff|class|method|query|sql|component|module|file|regex)';
const ASKS = [
  new RegExp('^(?:please\\s+|pls\\s+|hey\\s+void,?\\s+)?(?:(?:can|could|would|will)\\s+you\\s+)?(?:please\\s+)?(?:do\\s+a\\s+)?(?:code[- ]?review|review|critique|audit|lint|look\\s+over|go\\s+over|sanity[- ]check|check|proofread|improve|refactor|clean\\s+up|find\\s+(?:the\\s+)?bugs?\\s+in|spot\\s+(?:the\\s+)?bugs?\\s+in)\\s+(?:of\\s+)?(?:my|this|the|these|that|our|a|some|following)?\\s*(?:[\\w#+.-]+\\s+){0,2}?' + NOUN + 's?\\b', 'i'),
  /^(?:code[- ]?review|review\s+(?:please|pls|this|it))\b/i,
  /^(?:lint|critique|audit)\s+(?:this|it|that)\s*:\s*\S/i,
  /^(?:check|review|lint|audit)\s+(?:my|this|the)\s+(?:python|py|javascript|js|typescript|ts|sql|bash|shell|go|golang|rust|java|php|ruby|c\+\+|c#|swift|kotlin)\s*:\s*\S/i, // "check my python: <code>" // "lint this: var x = 1" (a colon and something after it, so "audit this" alone stays a word ask)
  new RegExp('\\b(?:what\'?s|what\\s+is|anything|something)\\s+wrong\\s+with\\s+(?:my|this|the)\\s+(?:[\\w#+.-]+\\s+)?' + NOUN + '\\b', 'i'),
  new RegExp('\\b(?:is|does)\\s+(?:my|this|the)\\s+(?:[\\w#+.-]+\\s+)?' + NOUN + '\\s+(?:ok|okay|good|fine|right|correct|safe|secure|look\\s+(?:ok|okay|good|right|fine))\\b', 'i'),
  /\b(?:any|find(?:\s+the)?|spot(?:\s+the)?)\s+bugs?\s+in\s+(?:my|this|the|these)\b/i,
  /\b(?:be\s+my|act\s+as\s+(?:a|my)|you\s+are\s+my)\s+code\s+reviewer\b/i,
];
// "check my zip code", "review the dress code": a code that isn't program code
const NOT_CODE = /\b(?:zip|area|postal|post|promo|promotional|discount|dress|morse|country|qr|coupon|gift|access|bar|cheat|tax|airport|iata|swift|sort|colou?r|hex|status|referral|invite|invitation|verification|confirmation|security|activation|redeem|voucher|pin|source\s+of)\s+codes?\b|\bcode\s+of\s+conduct\b|\bda\s+vinci\s+code\b/i;

export function isReviewAsk(text) {
  const s = String(text || '').trim(), first = s.split('\n')[0].replace(/\s*⏎.*$/, '').slice(0, 300);
  if (NOT_CODE.test(first)) return false;
  return ASKS.some((re) => re.test(first));
}

// the code itself: the lines after the ask, or what follows "review this code:" on one line
export function codeOf(text) {
  const s = String(text || '').replace(/\s*⏎\s*/g, '\n');
  const lines = s.split('\n');
  let code = '';
  if (lines.length > 1 && isReviewAsk(lines[0])) code = lines.slice(1).join('\n');
  else if (lines.length > 1) code = s;
  else { const k = s.search(/[:?]/); code = k > 0 && k < 120 && isReviewAsk(s.slice(0, k) + ': x') ? s.slice(k + 1).trim() : (isReviewAsk(s) ? '' : s); } // "review this: <code>", "is this code safe? <code>"
  code = code.replace(/^\s*```[\w.+#-]*[ \t]*\n?/, '').replace(/\n?```\s*$/, '');
  return code.replace(/^\n+|\s+$/g, '');
}

// enough code-like text to review (not a sentence)
// lang: the language the ask names ("review this python: ..."), so one short line in that language is enough
export function looksLikeCode(code, lang) {
  const s = String(code || '');
  if (s.trim().length < 8) return false;
  let n = 0;
  if (/[{};]\s*$/m.test(s)) n++;
  if (/\b(?:function|const|let|var|def|class|import|from|return|if|else|elif|for|while|public|private|static|void|func|fn|package|SELECT|INSERT|UPDATE|DELETE|CREATE|echo|fi|done|then|async|await|lambda|struct|impl|module|require|except|raise|try|catch|throw)\b/.test(s)) n++;
  if (/[=!<>]=|=>|->|\+\+|&&|\|\||::|:=|\w\(|\)\s*[{:]|\w\.\w+\s*[-+*/]?=[^=]/.test(s)) n++;
  if (/^(?: {2,}|\t)\S/m.test(s)) n++;
  if (/^\s*(?:#!|<\?php|<[a-z]+[\s>]|#include|@\w+)/m.test(s)) n++;
  if (/^\s*(?:const\s+|let\s+|var\s+)?[A-Za-z_$][\w$.]*\s*=\s*(?:["'`\[{]|-?\d|true\b|false\b|null\b|None\b)[^\n]*$/.test(s.trim())) n += 2; // the whole paste is one assignment: password = "…"
  if (/^\s*[\w$.]+\([^()]*\)\s*;?\s*$/.test(s) && /[.(_$]|[a-z][A-Z]/.test(s.replace(/\(.*/, '(').slice(0, 60))) n++; // the whole paste is one call: eval(userInput)
  return n >= 2 || (n >= 1 && (!!lang || /^(?:shell|sql|python)$/.test(langOf(s)))) || /^\s*(?:sudo\s+)?(?:rm|cp|mv|chmod|chown|curl|wget|git|npm|pip|docker|kubectl)\s+-?\S/m.test(s);
}

// the language when the ask names it: "is this python code ok"
const NAMED = [['python', /\bpython\b|\bpy\b/], ['typescript', /\btypescript\b|\bts\b/], ['javascript', /\bjavascript\b|\bjs\b|\bnode(?:\.?js)?\b|\breact\b/], ['sql', /\bsql\b|\bquery\b/], ['shell', /\bbash\b|\bshell\b|\bsh\b|\bzsh\b/], ['go', /\bgolang\b|\bgo\s+code\b/], ['rust', /\brust\b/], ['java', /\bjava\b/], ['csharp', /\bc#|\bc\s*sharp\b/], ['php', /\bphp\b/], ['ruby', /\bruby\b/], ['c', /\bc\+\+|\bcpp\b|\bc\s+code\b/]];
export function langNamed(ask) { const a = String(ask || '').toLowerCase(); for (const [l, re] of NAMED) if (re.test(a)) return l; return null; }

export function langOf(code) {
  const s = String(code || '');
  if (/^\s*#!.*\b(?:ba|z|k)?sh\b/m.test(s) || (/\b(?:fi|done|esac)\s*$/m.test(s) && /\b(?:then|do)\b/.test(s)) || /^\s*(?:sudo\s+)?(?:rm|cp|mv|echo|export|cd|apt(?:-get)?|chmod|curl|wget)\s/m.test(s) && !/[;{]\s*$/m.test(s)) return 'shell';
  if (/<\?php|\$\w+\s*->/.test(s)) return 'php';
  if (/^\s*(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+(?:TABLE|INDEX|VIEW)|ALTER\s+TABLE|DROP\s+TABLE|WITH\s+\w+\s+AS)\b/im.test(s) && !/[{}]|\bdef\b|\bfunction\b|=>/.test(s)) return 'sql';
  if (/^\s*def\s+\w+\s*\([^)]*\)\s*(?:->\s*[\w\[\], ]+)?:/m.test(s) && !/[{};]\s*$/m.test(s)) return 'python';
  if (/^\s*(?:def|class)\s+\w+.*:\s*$|^\s*(?:import\s+\w+|from\s+[\w.]+\s+import)\b|^\s*(?:elif|except|try)\b.*:\s*$|\bprint\(|\bself\.|\bNone\b|\bTrue\b|\bFalse\b/m.test(s) && !/[{};]\s*$/m.test(s)) return 'python';
  if (/^\s*package\s+\w+|\bfunc\s+\w*\s*\(|:=/m.test(s) && !/\bfunction\b|=>/.test(s)) return 'go';
  if (/\bfn\s+\w+\s*\(|\blet\s+mut\b|\bimpl\b|println!/.test(s)) return 'rust';
  if (/\bpublic\s+(?:static\s+)?(?:class|void|int|string|String)\b|System\.out\.|Console\.Write/.test(s)) return /Console\.|\bstring\b|\busing\s+System/.test(s) ? 'csharp' : 'java';
  if (/^\s*#include\b|\bstd::|\bprintf\s*\(|\bint\s+main\s*\(/m.test(s)) return 'c';
  if (/^\s*(?:def\s+\w+|end|puts\s)/m.test(s) && /^\s*end\s*$/m.test(s)) return 'ruby';
  if (/^\s*<(?:!doctype|html|div|body|head|p|span|a|ul|li|form|input|button|section|main)\b/im.test(s) && !/\bfunction\b|=>/.test(s.replace(/<script[\s\S]*?<\/script>/gi, ''))) return 'html';
  if (/^\s*[.#]?[\w-]+(?:\s*[,>+~]\s*[.#]?[\w-]+)*\s*\{[^}]*:[^}]*\}/m.test(s) && !/\bfunction\b|=>|\bconst\b/.test(s)) return 'css';
  if (/\b(?:interface|type)\s+\w+\s*[={]|:\s*(?:string|number|boolean|any)\b|\bas\s+const\b/.test(s)) return 'typescript';
  if (/\b(?:function|const|let|var|=>|console\.|document\.|require\(|import\s.+\sfrom\s|export\s+(?:default|const|function))\b|=>/.test(s)) return 'javascript';
  return 'code';
}
const C_LIKE = new Set(['javascript', 'typescript', 'java', 'csharp', 'c', 'go', 'rust', 'php', 'css', 'code']);

// strings and comments become spaces (quotes kept, line breaks kept), so a rule never fires on text inside a string or a comment
export function mask(code, lang) {
  const s = String(code || ''), py = lang === 'python', sh = lang === 'shell' || lang === 'ruby', sql = lang === 'sql';
  let out = '', i = 0;
  const blank = (t) => t.replace(/[^\n]/g, ' ');
  while (i < s.length) {
    const c = s[i], two = s.slice(i, i + 2);
    if ((C_LIKE.has(lang) && two === '//') || (sql && two === '--') || ((py || sh) && c === '#' && !(sh && s[i - 1] === '$')) || (lang === 'php' && c === '#')) {
      const j = s.indexOf('\n', i); const end = j < 0 ? s.length : j; out += blank(s.slice(i, end)); i = end; continue;
    }
    if ((C_LIKE.has(lang) || sql) && two === '/*') { const j = s.indexOf('*/', i + 2); const end = j < 0 ? s.length : j + 2; out += blank(s.slice(i, end)); i = end; continue; }
    if (py && (s.startsWith('"""', i) || s.startsWith("'''", i))) { const q = s.slice(i, i + 3), j = s.indexOf(q, i + 3), end = j < 0 ? s.length : j + 3; out += q + blank(s.slice(i + 3, Math.max(i + 3, end - 3))) + (j < 0 ? '' : q); i = end; continue; }
    if (c === '"' || c === "'" || (c === '`' && !py && !sql)) {
      let j = i + 1;
      while (j < s.length && s[j] !== c && !(s[j] === '\n' && c !== '`')) { if (s[j] === '\\') j++; j++; }
      out += c + blank(s.slice(i + 1, j)) + (s[j] === c ? c : ''); i = s[j] === c ? j + 1 : j; continue;
    }
    out += c; i++;
  }
  return out;
}

// One rule = [id, kind, languages ('*' = any), test(maskedLine, rawLine, ctx) -> bool, plain message, fix (optional)]
// kind: 'bug' (wrong result or crash), 'risk' (security or data loss), 'style' (works, but easy to get wrong later)
const JS = ['javascript', 'typescript'];
const RULES = [
  ['assign-in-condition', 'bug', [...JS, 'java', 'csharp', 'c', 'php'], (m) => /\b(?:if|while)\s*\(\s*!?\s*[A-Za-z_$][\w$.[\]]*\s*=\s*[^=>]/.test(m),
    'an assignment (=) inside the condition: it sets the value and is then always true or false. To compare, use === (or == outside JavaScript).'],
  ['loose-equality', 'style', JS, (m) => /[^=!<>]==[^=]|!=[^=]/.test(m) && !/[=!]=\s*null\b|\bnull\s*[=!]=[^=]/.test(m),
    '== and != convert types before comparing ("0" == 0 and "" == false are both true). === and !== compare exactly.'],
  ['nan-compare', 'bug', [...JS, 'java', 'csharp', 'python'], (m) => /[=!]==?\s*(?:NaN|float\(\s*'nan'\s*\))|\bNaN\s*[=!]==?/.test(m),
    'nothing is equal to NaN, not even NaN, so this comparison is always false. Use Number.isNaN(x) (math.isnan(x) in Python).'],
  ['typeof-typo', 'bug', JS, (m, r) => { const t = r.match(/typeof\s+[\w$.]+\s*[=!]==?\s*(['"])(\w*)\1/); return !!t && !/^(?:undefined|object|boolean|number|bigint|string|symbol|function)$/.test(t[2]); },
    'typeof never returns that word, so this check never passes. It returns one of: "undefined", "object", "boolean", "number", "bigint", "string", "symbol", "function".'],
  ['foreach-async', 'bug', JS, (m) => /\.forEach\(\s*async\b/.test(m),
    'forEach does not wait for async callbacks: the code after it runs before they finish, and their errors are lost. Use for (const x of items) { await … } or await Promise.all(items.map(async …)).'],
  ['for-in-array', 'risk', JS, (m) => /\bfor\s*\(\s*(?:const|let|var)\s+\w+\s+in\s+\w+/.test(m),
    'for…in walks property names as strings (and inherited ones), not array values. For an array use for (const x of list), or for (let i = 0; i < list.length; i++).'],
  ['eval', 'risk', [...JS, 'python', 'php', 'ruby'], (m) => /(?:^|[^\w$.])(?:eval|exec)\s*\(|\bnew\s+Function\s*\(/.test(m),
    'eval/exec runs text as code: if any of that text comes from a user, a URL or a file, they can run anything. Parse the data instead (JSON.parse, a lookup table, ast.literal_eval in Python).'],
  ['inner-html', 'risk', JS, (m, r) => /\.(?:innerHTML|outerHTML)\s*\+?=/.test(m) && !/\.(?:innerHTML|outerHTML)\s*\+?=\s*(['"`])[^'"`$]*\1\s*;?\s*$/.test(r) && !/\besc(?:ape)?(?:Html)?\s*\(|DOMPurify|sanitize/i.test(r),
    'putting a variable into innerHTML lets any HTML in it run (a script tag, an onerror handler): an XSS hole if the text can come from a user. Use textContent, or escape the text first.'],
  ['document-write', 'risk', JS, (m) => /\bdocument\.write(?:ln)?\s*\(/.test(m),
    'document.write wipes the whole page if it runs after loading, and writes raw HTML (XSS risk). Build elements with createElement and textContent.'],
  ['settimeout-string', 'risk', JS, (m) => /\bset(?:Timeout|Interval)\s*\(\s*['"`]/.test(m),
    'a string passed to setTimeout/setInterval is run like eval. Pass a function: setTimeout(() => doThing(), 1000).'],
  ['parseint-radix', 'style', JS, (m) => /\bparseInt\s*\(\s*[^,()]+(?:\([^()]*\))?\s*\)/.test(m),
    'parseInt without a base reads "0x1A" as hex and stops at the first non-digit. Give the base: parseInt(s, 10), or use Number(s).'],
  ['var', 'style', JS, (m) => /^\s*var\s+\w/.test(m),
    'var is visible across the whole function and can be re-declared by mistake. Use const (or let if it changes).'],
  ['debugger', 'bug', JS, (m) => /(?:^|[;{}\s])debugger\s*;?\s*$/.test(m),
    'a debugger statement pauses the page whenever developer tools are open. Remove it before shipping.'],
  ['empty-catch', 'risk', [...JS, 'java', 'csharp', 'php'], (m) => /\bcatch\s*\(\s*(?!_|ignored?\b|unused\b)[^)]*\)\s*\{\s*\}/.test(m), // catch (_) {} is the usual "ignored on purpose" mark
    'an empty catch hides every error, including real bugs, so failures happen silently. At least log it, or catch only the error you expect.'],
  ['bare-except', 'risk', ['python'], (m) => /^\s*except\s*:/.test(m),
    'a bare except also catches Ctrl+C and typos (NameError), hiding real bugs. Catch the error you expect: except ValueError:'],
  ['except-pass', 'risk', ['python'], (m, r, x) => /^\s*except\b.*:\s*$/.test(m) && /^\s*pass\s*$/.test(x.next(1)),
    'except … : pass swallows the error silently, so the program carries on with bad data. Log it or handle it.'],
  ['mutable-default', 'bug', ['python'], (m) => /^\s*def\s+\w+\s*\(.*=\s*(?:\[\s*\]|\{\s*\}|set\(\s*\)|list\(\s*\)|dict\(\s*\))\s*[,)]/.test(m),
    'a default of [] or {} is created once and shared by every call, so changes leak between calls. Use None and create it inside: def f(x=None): x = [] if x is None else x'],
  ['is-literal', 'bug', ['python'], (m) => /\bis\s+(?:not\s+)?(?:-?\d|['"])/.test(m),
    '"is" checks whether two things are the same object, not equal values, so it can be False for equal numbers or strings. Use == (keep "is" for None, True and False).'],
  ['eq-none', 'style', ['python'], (m) => /[=!]=\s*None\b/.test(m),
    'compare with None using "is None" / "is not None": == can be overridden by a class and give a wrong answer.'],
  ['range-len', 'style', ['python'], (m) => /\bfor\s+\w+\s+in\s+range\s*\(\s*len\s*\(/.test(m),
    'for i in range(len(x)) is easy to get off by one. Use for item in x, or for i, item in enumerate(x).'],
  ['open-no-with', 'style', ['python'], (m) => /^\s*\w+\s*=\s*open\s*\(/.test(m),
    'a file opened without "with" stays open if anything fails before close(). Use: with open(path) as f:'],
  ['shell-true', 'risk', ['python'], (m) => /\bshell\s*=\s*True\b/.test(m),
    'shell=True runs the command through a shell, so a filename or input with ; or $( ) can run other commands. Pass a list: subprocess.run(["ls", path])'],
  ['unsafe-load', 'risk', ['python'], (m) => /\byaml\.load\s*\((?![^)]*Loader\s*=\s*(?:yaml\.)?SafeLoader)|\bpickle\.loads?\s*\(/.test(m),
    'yaml.load and pickle can run code hidden in the data. Use yaml.safe_load, and only unpickle data you created yourself.'],
  ['verify-false', 'risk', ['python', ...JS], (m) => /\bverify\s*=\s*False\b|rejectUnauthorized\s*:\s*false\b|NODE_TLS_REJECT_UNAUTHORIZED/.test(m),
    'certificate checks are turned off, so anyone on the network can read or change this traffic. Fix the certificate (or point to the right CA bundle) instead.'],
  ['rm-rf-var', 'risk', ['shell'], (m, r) => /\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(?:"?\$\{?\w+\}?"?\/?)(?:\s|$|\/)/i.test(r) && !/\$\{\w+:\?/.test(r),
    'rm -rf with a variable: if the variable is empty or unset, this deletes from the current folder or from /. Guard it: rm -rf "${DIR:?}" (stops if DIR is empty).'],
  ['curl-pipe-sh', 'risk', ['shell'], (m, r) => /\b(?:curl|wget)\b[^|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/.test(r),
    'piping a download straight into a shell runs whatever the server sends, unseen. Download it, read it, then run it.'],
  ['chmod-777', 'risk', ['shell'], (m) => /\bchmod\s+(?:-[a-zA-Z]+\s+)*(?:0?777|a\+rwx|o\+w)\b/.test(m),
    'chmod 777 lets everyone on the machine read, change and run these files, including any other user or a compromised service. Give the owner what it needs instead: chmod 755 for folders and programs, 644 for files.'],
  ['unquoted-var', 'style', ['shell'], (m, r) => /^\s*(?:cd|cp|mv|rm|cat|ls|mkdir|touch|source|\.)\s+[^"'\n]*\$\{?\w+\}?/.test(r) && !/["']\$/.test(r),
    'an unquoted variable is split on spaces, so a path like "My Files" becomes two arguments. Quote it: "$path"'],
  ['update-no-where', 'bug', ['sql', '*'], (m, r, x) => /^\s*UPDATE\s+[\w."`[\]]+\s+SET\b/i.test(r) && !/\bWHERE\b/i.test(x.statement()),
    'UPDATE without WHERE changes every row in the table. Add the WHERE that picks the rows you mean.'],
  ['delete-no-where', 'bug', ['sql', '*'], (m, r, x) => /^\s*DELETE\s+FROM\s+[\w."`[\]]+\s*;?\s*$/i.test(r) && !/\bWHERE\b/i.test(x.statement()),
    'DELETE without WHERE removes every row in the table. Add a WHERE (or use TRUNCATE if that is really what you want).'],
  ['select-star', 'style', ['sql'], (m) => /\bSELECT\s+\*\s+FROM\b/i.test(m),
    'SELECT * returns every column, so the query breaks or slows down when columns are added. Name the columns you use.'],
  ['sql-concat', 'risk', ['*'], (m, r) => /(['"`]|\bf['"])\s*(?:SELECT\b[\s\S]*\bFROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i.test(r)
      && (/['"]\s*\+\s*[\w$]|[\w$)\]]\s*\+\s*['"]/.test(r) || /`[^`]*\$\{/.test(r) || /\bf['"][^'"]*\{/.test(r) || /['"]\s*%\s*[\w(]/.test(r) || /\.format\s*\(/.test(r)),
    'the SQL is built by pasting values into the text: a value like \' OR 1=1 -- changes the query (SQL injection). Use placeholders and pass the values separately: query("… WHERE id = ?", [id]).'],
  ['hardcoded-secret', 'risk', ['*'], (m, r, x) => hasSecret(r, x.lang),
    'a key, token or password is written into the code. Anyone who sees the code (or the repo history) has it. Move it to an environment variable or a secret store, and change the key if this code was ever shared.'],
  ['plain-http', 'risk', ['*'], (m, r) => /['"`]http:\/\/(?!localhost\b|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[\w-]+\.local\b|[\w.-]*example\.(?:com|org|net)\b|(?:www\.)?w3\.org\b)[\w-]+\.[\w.-]+/.test(r),
    'an http:// address sends data unencrypted, so it can be read or changed on the way. Use https:// if the server supports it.'],
  ['todo', 'note', ['*'], (m, r) => /\b(?:TODO|FIXME|HACK|XXX)\b/.test(r),
    'a TODO/FIXME is left here: something is known to be unfinished.'],
];
// a key written into the code: a known key format inside a string, a long string assigned to a key-like name, a password in a URL,
// or (in shell and .env files, where values aren't quoted) NAME=value. Reading one from the environment or a variable is fine.
const KEYNAME = /(?:api[_-]?key|apikey|secret|client[_-]?secret|password|passwd|pwd|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|private[_-]?key)\w*["']?\s*[:=]\s*$/i;
function hasSecret(r, lang) {
  const strs = [...r.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)];
  for (const s of strs) {
    const v = s[2];
    if (redact(v) !== v && !/^\[redacted/.test(v)) return true;
    if (/^[^\s${}<>]{8,}$/.test(v) && !/^(?:https?:\/\/|\/|\.|[\w-]+\.(?:js|json|html|css|md|txt|py|sh)$)/i.test(v) && !/^(?:x{3,}|\*{3,}|your[_-]|<|changeme|placeholder|example|test|dummy|redacted)/i.test(v) && KEYNAME.test(r.slice(0, s.index))) return true;
  }
  if ((lang === 'shell' || lang === 'code') && /^\s*(?:export\s+)?[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASS|PWD)[A-Z0-9_]*=(?!["']?\$)[^\s"'$]{8,}/.test(r)) return true;
  return /\b[a-z][\w+.-]*:\/\/[^\s:@/'"`]+:[^\s@/'"`$]{3,}@/.test(r) && !/:\$\{|:\{\{/.test(r);
}
const ORDER = { bug: 0, risk: 1, style: 2, note: 3 };
// Files a pull-request review does not read: generated or copied files, data, and tests (their fixtures are bad code on purpose:
// planted fake keys, planted TODOs). Test names in every language this repo writes: test_*, *_test.py|js|mjs, *.test.js|mjs.
export const REVIEW_SKIP = /^(?:void-live-deploy\/(?:index|void)\.html|tools\/(?:bench|grown|fringe)(?:\.best)?\.json|.*\.(?:json|md|txt|lock|svg|png|jpg|gif|ico|woff2?)|(?:.*\/)?(?:test_[^/]*|[^/]*_test\.(?:py|m?js)|[^/]*\.test\.m?js))$/;
export const skippedInReview = (path) => REVIEW_SKIP.test(String(path || ''));
export const KIND_WORD = { bug: 'bug', risk: 'risk', style: 'style', note: 'note' };

// The quick checks: [{ line, kind, rule, message, text }] most serious first, at most `max`. `text` is the line as written, keys masked.
export function ruleReview(code, opts = {}) {
  const raw = String(code || '').replace(/\r\n?/g, '\n').slice(0, 60000), lang = opts.lang || langOf(raw);
  const as = lang === 'code' ? 'javascript' : lang; // a snippet with no clear language gets the C-style checks (JavaScript's are the broadest)
  const rawLines = raw.split('\n'), maskedLines = mask(raw, as).split('\n'), found = [], seen = new Set();
  for (let i = 0; i < rawLines.length; i++) {
    const r = rawLines[i], m = maskedLines[i] || '';
    if (!r.trim()) continue;
    const ctx = { lang: as,
      next: (k) => { let n = 0; for (let j = i + 1; j < rawLines.length; j++) if (rawLines[j].trim() && ++n === k) return maskedLines[j] || ''; return ''; },
      statement: () => { let st = ''; for (let j = i; j < rawLines.length && j < i + 12; j++) { st += ' ' + (maskedLines[j] || ''); if (/;\s*$/.test(maskedLines[j] || '')) break; } return st; },
    };
    for (const [id, kind, langs, test, message] of RULES) {
      if (!(langs.includes('*') || langs.includes(as))) continue;
      if (!test(m, r, ctx)) continue;
      const key = id + ':' + i; if (seen.has(key)) continue; seen.add(key);
      // the same style point on many lines is said once, with the count (opts.collapse === false keeps each line: the PR review
      // filters to added lines afterwards, so a first hit on an old line must not hide the new ones)
      const same = opts.collapse !== false && found.find((f) => f.rule === id && (kind === 'style' || kind === 'note'));
      if (same) { same.also = (same.also || 0) + 1; continue; }
      found.push({ line: i + 1, kind, rule: id, message, text: redact(r.trim()).slice(0, 160) });
    }
  }
  found.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.line - b.line);
  return { lang, findings: found.slice(0, opts.max || 25), lines: rawLines.length };
}

// Fixes Void can make by itself because they never change what correct code means. Each works on the masked line (strings and
// comments blanked, same length), so a match inside a string is never touched, and edits the raw line at the same position.
// Returns { code, changes: [{ line, rule, what }] }; code is unchanged when nothing applied.
export function autoFix(code, opts = {}) {
  const raw = String(code || '').replace(/\r\n?/g, '\n'), lang0 = opts.lang || langOf(raw), lang = lang0 === 'code' ? 'javascript' : lang0;
  const lines = raw.split('\n'), masked = mask(raw, lang).split('\n'), out = [], changes = [];
  const at = (r, m, re, fn) => { let res = '', last = 0; re.lastIndex = 0; let x; while ((x = re.exec(m))) { res += r.slice(last, x.index) + fn(r.slice(x.index, x.index + x[0].length), x); last = x.index + x[0].length; if (!x[0].length) re.lastIndex++; } return res + r.slice(last); };
  for (let i = 0; i < lines.length; i++) {
    let r = lines[i]; const m = masked[i] || '', before = r;
    const note = (rule, what) => changes.push({ line: out.length + 1, rule, what });
    if (JS.includes(lang)) {
      if (/^\s*debugger\s*;?\s*$/.test(m)) { note('debugger', 'removed the debugger line'); continue; }
      // == → ===, var → let and a parseInt radix stay warnings only: each can change what working code does
      // ("5" == 5 is true, a var used after its block, parseInt("0x10") is 16), and this version promises it doesn't
    }
    if (lang === 'python') {
      if (/[=!]=\s*None\b/.test(m)) { const b = r; r = at(r, m, /==\s*None\b|!=\s*None\b/g, (t) => t.startsWith('!') ? 'is not None' : 'is None'); if (r !== b) note('eq-none', '== None → is None'); }
      if (/^\s*except\s*:/.test(m)) { r = r.replace(/^(\s*)except\s*:/, '$1except Exception:'); note('bare-except', 'except: → except Exception: (Ctrl+C and exits are no longer swallowed)'); }
      if (/\byaml\.load\s*\(/.test(m) && !/Loader\s*=/.test(m)) { const b = r; r = at(r, m, /\byaml\.load\s*\(/g, () => 'yaml.safe_load('); if (r !== b) note('unsafe-load', 'yaml.load → yaml.safe_load'); }
      const d = m.match(/^(\s*)def\s+\w+\s*\((.*)\)\s*(?:->[^:]*)?:\s*$/);
      if (d && /=\s*(?:\[\s*\]|\{\s*\}|set\(\s*\)|list\(\s*\)|dict\(\s*\))\s*(?:,|$)/.test(d[2])) {
        const fixes = [];
        r = at(r, m, /(\w+)(\s*(?::\s*[^=,()]+)?=\s*)(\[\s*\]|\{\s*\}|set\(\s*\)|list\(\s*\)|dict\(\s*\))(?=\s*(?:,|\)))/g, (t, x) => { fixes.push([x[1], /^\[|^list/.test(x[3]) ? '[]' : /^set/.test(x[3]) ? 'set()' : '{}']); return x[1] + x[2] + 'None'; });
        if (fixes.length) {
          let ind = d[1] + '    '; for (let j = i + 1; j < lines.length; j++) if (lines[j].trim()) { ind = (lines[j].match(/^\s*/) || [''])[0]; break; }
          out.push(r); note('mutable-default', 'default [] / {} → None, created fresh inside');
          for (const [name, empty] of fixes) out.push(ind + name + ' = ' + empty + ' if ' + name + ' is None else ' + name);
          continue;
        }
      }
    }
    if (lang === 'shell' && /\brm\s+-[a-z]*r[a-z]*\s+"?\$\{?(\w+)\}?"?/i.test(r) && !/\$\{\w+:\?/.test(r)) {
      r = r.replace(/(\brm\s+-[a-z]*r[a-z]*\s+)"?\$\{?(\w+)\}?"?/i, '$1"${$2:?}"'); note('rm-rf-var', 'rm -rf $DIR → rm -rf "${DIR:?}" (stops if DIR is empty)');
    }
    out.push(r);
  }
  return { code: out.join('\n'), changes, lang: lang0 };
}

// The same findings as plain text (for the model, which confirms, drops or adds to them)
export function findingsText(res) {
  if (!res || !res.findings.length) return 'The quick checks found nothing.';
  return res.findings.map((f) => 'line ' + f.line + ' [' + f.kind + '] ' + f.message + (f.also ? ' (and ' + f.also + ' more like it)' : '')).join('\n');
}

export const REVIEW_SYSTEM = 'You are Void, doing a code review for the person who pasted this code. Be the reviewer a careful senior engineer would be: find what is actually wrong before anything cosmetic. In order: bugs (wrong results, crashes, off-by-one, unhandled cases, race conditions), security holes (injection, XSS, secrets, unsafe deserialisation, missing auth checks), data loss, then performance, then readability. For each point give the line number, what is wrong in one plain sentence, why it matters, and the fix as a short corrected code block. You are also given the results of quick pattern checks: confirm the real ones, drop any that are wrong in context, and add what they missed. Never invent problems: if the code is fine, say so plainly and stop. Do not rewrite the whole program unless asked; do not lecture; no headings beyond a short list. Plain language for someone who may be learning. Keys, tokens and passwords appear as [redacted]: never ask for them. Keep it under 450 words.';
export { redact };
