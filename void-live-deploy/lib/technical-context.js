/**
 * Technical context (asked by Verse: "Map the 'Rust unwrap' example sentences to a new 'technical-context' skill that triggers a
 * visual 'caution' or 'risk' shape on the stage"). A programmer's term whose danger the code review already knows (Rust's
 * unwrap, a force unwrap, shell=True, strcpy ...) comes with the sentence that explains it, the line that goes wrong, the
 * safer line, and a caution shape on the stage. The risk words are the review's own (lib/code-review.js RULES): the test
 * runs each sample through ruleReview, so this table cannot say something the review would not flag. Pure.
 * Tests: tools/technical-context.test.mjs.
 */
export const TERMS = [
  { id: 'unwrap', say: 'Rust unwrap()', re: /(?<!force[- ]?)\b(?:rust\s+)?unwrap(?:\s*\(\s*\))?(?!\s*_)(?:\s+in\s+rust)?\b/i, lang: 'rust', rule: 'unwrap',
    sentence: 'Calling unwrap() on a None or an Err does not return an error: the program panics and stops.',
    risky: 'let n = config.get("port").unwrap();', safer: 'let n = config.get("port").unwrap_or(8080);' },
  { id: 'force-unwrap', say: 'a force unwrap (Swift !)', re: /\bforce[- ]?unwrap(?:ping|s)?\b(?!.*\bkotlin\b)/i, lang: 'swift', rule: 'force-unwrap',
    sentence: 'A force unwrap tells Swift "this is never nil" and crashes the app the moment it is.',
    risky: 'let name = user!.name', safer: 'guard let name = user?.name else { return }' },
  { id: 'kotlin-!!', say: 'Kotlin !!', re: /\bkotlin\s+(?:!!|not-null assertion|double bang)\b|\b(?:!!|double bang)\s+(?:in\s+)?kotlin\b/i, lang: 'kotlin', rule: 'force-unwrap',
    sentence: 'The !! operator throws a NullPointerException when the value is null.',
    risky: 'val n = user!!.name', safer: 'val n = user?.name ?: "guest"' },
  { id: 'shell-true', say: 'shell=True', re: /\bshell\s*=\s*true\b|\bsubprocess\b.*\bshell\b/i, lang: 'python', rule: 'shell-true',
    sentence: 'With shell=True a filename containing ; or $( ) is run as a command.',
    risky: 'subprocess.run("ls " + path, shell=True)', safer: 'subprocess.run(["ls", path])' },
  { id: 'strcpy', say: 'C strcpy', re: /\b(?:strcpy|strcat|gets|sprintf)\b/i, lang: 'c', rule: 'c-unsafe-string',
    sentence: 'strcpy writes without checking the size of the buffer, so a long input overflows it.',
    risky: 'strcpy(buf, input);', safer: 'snprintf(buf, sizeof buf, "%s", input);' },
  { id: 'pickle', say: 'pickle / yaml.load', re: /\bpickle(?:\.loads?)?\b|\byaml\.load\b/i, lang: 'python', rule: 'unsafe-load',
    sentence: 'Loading a pickle runs code hidden in the data, so only unpickle what you made yourself.',
    risky: 'data = pickle.loads(blob)', safer: 'data = json.loads(blob)' },
];
const RISK_WORD = /\b(?:risk(?:y|s)?|dangerous|danger|unsafe|safe|caution|careful|panics?|crash(?:es)?|bad|harmful|hazard)\b/i;
/** the term an ask is about, when it asks about the risk of a programmer's term (or for its technical context); else null. Pure. */
export function termOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (t.length < 6 || t.length > 120) return null;
  const ask = /^(?:technical\s+context\s+(?:for|of|on)\s+.+|(?:why|how)\s+(?:is|are|does)\s+.+|is\s+.+|are\s+.+|(?:what(?:'s| is)\s+the\s+)?(?:risk|danger|caution)s?\s+(?:of|with|in)\s+.+|.+\s+(?:risk|caution|warning))$/i.test(t);
  if (!ask) return null;
  const wants = /^technical\s+context\b/i.test(t) || RISK_WORD.test(t);
  if (!wants) return null;
  if (/\b(?:present|gift|box|package|parcel|mystery)\b/i.test(t)) return null; // "unwrap a present"
  for (const term of TERMS) if (term.re.test(t)) return term;
  return null;
}
