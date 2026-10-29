# A review rule: teach Verse's code review a bug it missed

**Starts when:** a probe of buggy snippets finds one the quick checks miss, or Verse's closer read finds what the pattern checks didn't.

1. **Probe:** write 30–40 short snippets, each with one real bug, across languages; run them through `ruleReview(code, { lang })` from `void-live-deploy/lib/code-review.js` and list the ones with no finding.
2. **Keep only real holes.** Skip what is fine in modern versions (Go loop variables since 1.22) and deliberate forms (Rust `expect` with a message). Name why in the agent log.
3. **The rule:** `[id, kind, langs, test(m, r, x), message]` in `RULES`. `m` is the line with strings and comments blanked, `r` the raw line; `x.next(k)`, `x.prev()`, `x.all()` see around it. A pasted ask is usually ONE line ("review this c: p = malloc(n); p[0] = 1;"), so look later on the same line as well as the next lines.
4. **Tests first** in `tools/review.test.mjs`: the bug flagged, and every look-alike that must stay quiet (the checked version, the safe call).
5. **Bench asks:** `{ "ask": "review this <lang>: <code>", "want": "review", "says": "<a word from the message, not from the code>" }`.
6. A false positive later is a bug in the rule: fix the rule and add the case.

**Mistakes already made:** a comment line between two statements is blank once masked, so `if (!n) return false` stopped too early (skip blank lines).
