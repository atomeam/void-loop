# Feature maps (Versus tower)

One JSON file per tower floor: every user-facing feature of the floor's leader and its lane sites (`void-live-deploy/lib/tower.js` LANES), each marked against Verse's page as `has`, `partial` or `missing` with evidence, paid features marked `paid: true`.

Schema: `{"floor","verse_page","researched","sites":{"<host>":{"sources":[],"features":[{"name","detail","paid","verse","verse_evidence"}]}},"union_gaps":[],"verse_extra":[]}`

`union_gaps` is the build list: deduplicated, most valuable first, naming the sites that have each. Builders read it before building a floor. Owner (2026-10-25): "make sure you research all features of every site so we have everything".

## Verse's own scan (`tools/feature-scan.mjs`, `docs/playbooks/feature-research.md`)

Verse reads the sites itself (owner, 2026-10-25: "make it so verse does this on its own automatically also"). In a file people wrote, its findings go under `"auto": {"scanned", "sites": {"<host>": {"url", "scanned", "method", "pages", "problem"?, "features": [...]}}, "gaps": [{"name", "sites"}], "queued": [{"target", "feature", "host", "at"}]}` and nothing else in the file changes. A floor nobody has researched gets a whole file with `"source": "auto"` (same `sites`, `gaps` in place of `union_gaps`), which the scan may rewrite until a person writes over it. A feature Verse has that its page does not name in words can carry `"shows": "<regex>"`: the gate (`withFeatureFacts` in `tools/tower-probes.mjs`) counts the first six features marked `has` toward the floor's completeness.

## Reverse engineering (`tools/site-re.mjs`, `docs/playbooks/site-re.md`)

Owner (2026-10-26): "make sure you reverse-engineer each site so we dont miss any hidden features". Each site's own client code and loaded page are read once for what its marketing does not say (URL parameters, shortcuts, API paths, flags, export and import formats, offline and share support, routes, languages). Facts per site are in `re/<id>.json`; the candidates are folded into the floor's file under `"re": {"scanned", "sites": {"<host>": {"url", "scanned", "blocked"?, "features": [{"name", "detail", "paid", "verse": "missing", "verse_evidence": "unbuilt (found by reverse engineering)", "found_by": "re", "tag": "read|observed|inferred", "evidence"}]}}}`. Nothing else in a file changes. A builder who builds a row sets its `verse` to `has` (the next scan keeps it).
