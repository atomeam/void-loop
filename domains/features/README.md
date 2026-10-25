# Feature maps (Versus tower)

One JSON file per tower floor: every user-facing feature of the floor's leader and its lane sites (`void-live-deploy/lib/tower.js` LANES), each marked against Verse's page as `has`, `partial` or `missing` with evidence, paid features marked `paid: true`.

Schema: `{"floor","verse_page","researched","sites":{"<host>":{"sources":[],"features":[{"name","detail","paid","verse","verse_evidence"}]}},"union_gaps":[],"verse_extra":[]}`

`union_gaps` is the build list: deduplicated, most valuable first, naming the sites that have each. Builders read it before building a floor. Owner (2026-10-25): "make sure you research all features of every site so we have everything".
