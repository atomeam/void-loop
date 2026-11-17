---
name: void-review-hygiene
description: The exact patterns Verse's own review (void-review, run by tools/review-pr.mjs over void-live-deploy/lib/code-review.js) flags in added lines, how to write code that does not trip them, and how to mark a line that is right as written. Use before pushing changes under void-live-deploy/, when void-review fails, or when writing innerHTML, SQL, Python, or workflow YAML in this repo.
paths:
  - "void-live-deploy/**/*.js"
  - "void-live-deploy/**/*.mjs"
  - "tools/**/*.mjs"
  - ".github/workflows/*.yml"
---

# Passing Verse's review (void-review)

`void-review.yml` runs `tools/review-pr.mjs` over the lines a PR **adds**, using the same checks the site runs when a visitor asks Verse to review code (`void-live-deploy/lib/code-review.js`). It keeps one PR comment and fails on a **bug** or **risk**. It runs in seconds, with no install and no browser.

Fix a real finding. A line that is right as written is marked, on that line:

```js
const html = esc(userText); // void-review: ok (esc() escapes before this reaches innerHTML)
```

## The rules that actually fire here

**risk — `inner-html`.** Putting a variable into `.innerHTML`/`.outerHTML` lets any HTML in it run (a `<script>`, an `onerror`): an XSS hole when the text can come from a user. It does **not** fire when the value is only fixed text (string literals, numbers, `ALL_CAPS` constants and things read off them), when an escaping call (`esc(...)`, `api.esc(...)`, `DOMPurify`) is in the same statement or the whole build, or when the build is handed to a builder that escapes (`card(esc, data)`). Otherwise use `textContent`, or escape first. Prefer `textContent` for plain text.

**risk — SQL built by string join.** A query built with `+`, template holes, `.format(` or `%` where the value is not bound fires. Use bound parameters (`?` with `.bind(...)`), not concatenation.

**risk — `drop-table`.** `DROP TABLE/DATABASE/SCHEMA` or `TRUNCATE` in added lines fires. Never in app code.

**risk — `assert-check` (Python).** An `assert` that guards `admin`, `auth`, `permission`, `allowed`, `logged_in`, `role`, `owner`, `can_...` fires: `assert` is stripped under `-O`. Use a real check and raise.

**risk — `bare-except` / `except-pass` (Python).** `except:` alone, or `except ...: pass`, fires. Catch the specific error and do something.

**risk — `docker-latest` / `image-latest`.** `FROM x` without a tag or with `:latest`, or a YAML `image:` the same way, fires. Pin a tag or a digest.

**risk — `gha-script-injection`.** A workflow `run:` that interpolates untrusted context (`${{ github.event... }}`, PR titles, issue bodies) fires. Put it in `env:` and read `"$VAR"`, and/or guard with `if:`.

**bug — `assign-in-condition`.** `if (x = y)` (an assignment, not a comparison) fires. Use `===`.

**bug — `typeof-typo`.** `typeof x === 'strng'` fires: the string is not one of `undefined|object|boolean|number|bigint|string|symbol|function`.

**bug — `mutable-default` (Python).** `def f(x=[])` fires. Use `None` and build inside.

**bug — `busy-loop` (Python).** `while True: pass` fires.

**bug — `py2-print` (Python).** `print 'x'` fires; use `print('x')`.

**style — `var`, `wildcard-import`, `open-no-with`, `lua-global`.** Prefer `const`/`let`; import names explicitly; use `with open(...)`; declare Lua locals. Style notes are suggestions — take them when cheap and right.

## Two other scanners on the added lines

- **`tools/secret-scan.mjs`** fails on a line shaped like a real key. A made-up key in a test is marked `secret-scan: ok` on that line.
- **`tools/privacy-scan.mjs`** fails on personal data (a real email, phone, IP). Use a placeholder (`[email]`, `[phone]`, `[ip]`); a placeholder on purpose is marked `privacy:ok`.

## Writing to avoid the round trip

- Plain text into the DOM: `el.textContent = value`, never `el.innerHTML = value`.
- Building markup from data: escape every interpolated value with the repo's `esc` (`api.esc`) in the same statement, or hand it to a builder that escapes.
- Queries: bind parameters.
- `if (a === b)`, not `if (a = b)`.
- In Python: specific `except`, no mutable defaults, `with open(...)`.
- In workflows: pin images, and never interpolate untrusted context straight into `run:`.

Full rule list and their exact conditions: `void-live-deploy/lib/code-review.js`. The review's own wording: `tools/review-pr.mjs`.
