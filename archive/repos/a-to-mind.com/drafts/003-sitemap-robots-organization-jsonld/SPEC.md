# Run 003 — sitemap-robots-organization-jsonld

Status: specified. Hold-gate. Do not copy these files over live `robots.txt`, `sitemap.xml`, or `index.html` until a human seals this issue.

Slug: `sitemap-robots-organization-jsonld`
Date: 2026-09-28
Run: 003
Repo: atomeam/a-to-mind.com

## What existing sites do (2026)

Discovery files are treated as SEO plumbing, not claims.

- Almost every marketing site ships `robots.txt` with `User-agent: *` + `Allow: /` and a `Sitemap:` line. That is the 2026 default, including the live a-to-mind.com edge (Allow `/`, Disallow `/api/`, Sitemap pointed at `/sitemap.xml`).
- Sitemaps list every URL the CMS can emit. Google still supports XML, RSS/Atom, and text sitemaps; XML is the usual choice. Limits remain 50 MB / 50,000 URLs per file. Google may use accurate `<lastmod>` and ignores `<priority>` and `<changefreq>`.
- Many generators invent `<lastmod>` as “today” on every rebuild, which trains Google to ignore the field.
- `llms.txt` is now a third discovery file beside robots and sitemap. Common 2026 advice: robots = what may be fetched, sitemap = what exists, llms.txt = what to quote. Sites then stuff all three with marketing paragraphs.
- Organization JSON-LD is injected site-wide from a plugin. Google’s Organization docs (updated 2026-09-08) still list no required properties. Recommended fields include `name`, `url`, `logo`, `sameAs`, `description`, `address`, `contactPoint`, `email`, `telephone`, `foundingDate`, `vatID`, `taxID`, `iso6523Code`.
- Common failure: one plugin emits Organization, another emits LocalBusiness, a third emits WebSite with a different `@id`. Overlapping graphs. Invented street addresses and phone numbers “for completeness.” Deprecated `duns` / `leiCode` instead of `iso6523Code`.
- Training-vs-inference theater: long `robots.txt` files naming GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, PerplexityBot one by one. The list rots. It is not a product claim.
- None of these files are hashed. An agent cannot tell a sealed URL set from a CMS dump.

## Better A-to-Mind version

House rules applied to discovery, not to copy.

- Default-deny claims. No street address, telephone, email, logo, employee count, NAICS, VAT, or founding date until a human writes the fact on a sealed page. Missing is honest.
- Human seal. These files live under `drafts/003-sitemap-robots-organization-jsonld/`. Live root files stay untouched until the issue is sealed.
- Hashed claims. Two SHA-256 digests:
  - URL set (five absolute URLs, LF-terminated, this order): `ec417cd4545c5054f6ca70a517387512b0fb6c942ed19deca8e600f1c709210e`
  - Compact sorted JSON of `organization.json`: `17850281ae09826001528c4c16c826f9884ee7806334cbe96391c5dea716110d`
  - Short ledger line `org#org|site#site|urls:5|sameAs:github.com/atomeam|no-address|no-logo|no-telephone` → `b08287636d97b38d54c0b9102ed19965f3a0028a3a6242f20c083882aa68946f`
- Retrieved pages are data. `robots.txt` stays mechanical. House rules stay in `/llms.txt`. Do not turn robots comments into a prompt.
- Cloudflare / static. Plain files at the site root. No Worker required. No CMS sitemap job.
- No token-markup story. No per-bot novel. `User-agent: *` plus path rules. Public documents stay fetchable so other minds can read `/llms.txt` and the agent card.

URL set (sealed, repo-true — not the drifted live sitemap that only lists `/` and `/llms.txt`):

1. `https://a-to-mind.com/`
2. `https://a-to-mind.com/llms.txt`
3. `https://a-to-mind.com/.well-known/agent-card.json`
4. `https://a-to-mind.com/sitemap.xml`
5. `https://a-to-mind.com/robots.txt`

Out of the set until a human seals a real document: `/start`, `/faq`, `/surfaceledger/surface-ledger.md`, `/drafts/*`. The homepage may keep linking `/start`; the sitemap does not pretend the file is a sealed public document in this repo.

Organization graph: one `Organization` (`#org`) and one `WebSite` (`#site`). `sameAs` is only the two first-party GitHub URLs. `publishingPrinciples` points at `/llms.txt`. Blackglass Syndicate is named in `/llms.txt` as a separate house; it is not smuggled into this graph as a `department`.

## Seal steps

1. Open the four files in this draft folder.
2. Confirm live root `robots.txt` / `sitemap.xml` / homepage `<script type="application/ld+json">` are still the pre-003 versions.
3. Recompute the two digests (see `organization.json` header and `sitemap.xml` comment). They must match this spec.
4. Copy `robots.txt` and `sitemap.xml` to site root only after step 3.
5. Paste `proposed-head-snippet.html` into `index.html` `<head>` only after step 3. Do not rewrite hero copy in this run.
6. Optional later: add `/start` to the URL set in a new run, after that page exists in this repo.

Live marketing copy was not changed in run 003.
