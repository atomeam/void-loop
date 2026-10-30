# Card art forge: real, painted art of a card's subject

**Starts when:** the owner or a player says a card's art should be of its subject ("the art should be of the subject of each card", owner, 2026-10-17), or a frontier #35 step is claimed.

**How it works:** `keep()` in `lib/card-frame.js` builds a card's frame, then calls `forge(el, c)` (`lib/card-forge.js`). For an answer, merged or skill card (never a person or sky card; a card with a real photo or poster keeps it) it reads `GET /api/card-art?key=<subject>`. A cached picture fills the art box (cover-fit, over Verse's ink plate, under the foil frame). A miss shows a small "paint this card" button: one tap is one `POST` and nothing is spent by itself (`?art=auto` asks by itself, for testing). The route (`functions/api/card-art.js`) folds the subject (`lib/art-rules.js`, the merge cards' fold), refuses what must be refused, and asks Workers AI's text-to-image model (`models('art')`, FLUX schnell class, an illuminati/arcane engraving style) once; the picture is a base64 row in D1 `void_art`, kept for ever. The saved or copied whole-card PNG (`lib/card-image.js`) includes the picture.

**Money guard (owner, 2026-10-17: Verse spends only what it has earned; no earnings, no budget):** the cap is clamped to the free allowance (`FREE_CAP` 30), no setting goes past it; a higher cap later must read `/api/earnings` and log each paid painting publicly (not built).

**Detail:** a daily cap of new pictures stored in D1 (default 30, `ART_DAILY_CAP` overrides, 0 paints nothing), a per-connection limit of 3 paints a minute (`rateLimited()`, its own bucket), the kill switch `ART_OFF=1`, a cached picture never made again, and any failure or the cap returns `{ state: 'plate' }` so the card keeps its plate and nothing is cached. The card shows no evolve chrome (owner, 2026-10-18: "get rid of the distracting evolve stuff on the card art"): no stage badge, no Evolve or Evolve-again button, no dwell wait or flash; the seal is the quiet placeholder, the painting replaces it with a short opacity fade, and the seal stays if no painting arrives. The route still accepts `again` (one regeneration a day per subject) but the page does not send it.

**Prompt rules:** a fixed template (`ART_STYLE` in `lib/art-rules.js`) plus the folded key, the kind and the rarity, each from an allow-list. No artist, franchise, game, company or character is named by us; a subject that is one, a person, sexual or hateful, secret-shaped or refused by the keeper gets no model call.

**The subject is the answer's, not the ask's** (owner, 2026-10-17: the "pick a movie" card showed a generic door): `lib/card-subject.js` reads the answer text for its most repeated concrete words (no names), the paint prompt is those words, and until a painting lands the plate draws their motifs. A card with a real photo or poster is never painted over.

**Commands:**
1. `node --test tools/card-art-route.test.mjs tools/models.test.mjs` (route with a fake model and fake D1, the rules).
2. `node tools/heavy.mjs node tools/test_void.mjs --only "Verse art forge"` (the page, route stubbed).
3. Backfill every skill and miniature card (the Book of Verse's pages are the same skills): `node tools/prepaint-art.mjs --status` prints "N of M cards painted" and the days left at the cap (about 161 cards, 6 days at 30 a day, less whatever live cards use); `--go --max 10` paints a few and stops at the cap. The record is the server's cache, so reruns never repaint and any machine can resume. Real-art kinds (film, show, song, album, book) are skipped.
4. After a deploy, try it live once: ask "what is a cat" and look at `/api/card-art?key=cat`.

**Worked when:** the art box shows the picture under the card frame; a second visit shows it at once; a skill card is painted from its name (kind `skill`); with `ART_OFF=1` the plate stays.

**Mistakes made:** a card's frame is rebuilt when its stats arrive, so the first element can leave the page while its picture is on the way (keep a waiting list per subject and land the picture on whichever element is there; a rebuilt frame re-shows `el._vcForge` before any other check); a merged card turns into a skill-shaped card on the rebuild (`worthy()` accepts `data-card-own`); a skill card whose stats had not loaded yet looked like an answer card for a moment (check `el.dataset.skill`, not only the stats); a test that builds several fake worlds up front shares the module's "table is ready" flag (make each world just before it is used); a prompt-stealing-looking subject is refused by the keeper before any model, so a test of "markup in a subject" must use a harmless one.

**Next:** pre-paint the most asked subjects from the miss board (owner-set budget), art style packs per season, WebGPU or local fallbacks for people with a capable device, an owner-set cap on the owner page.
