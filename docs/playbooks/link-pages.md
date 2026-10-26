# Link pages that work together ("Send to")

Owner, 2026-10-26: "and link them all if they are usable together" (docs/RULES.md "Link what works together"). Every Verse page links to the pages it is usable with, and what one page makes can be sent to the next, on the device, with no account. One mechanism carries it: `void-live-deploy/lib/handoff.js`. The "Use with" row (`lib/toolkit.js` `mountRelated`) draws the "Send to" buttons and the related links; `/tools/` is the index of everything.

## What starts it

- You build a page that **makes** something another page could use (a date, a place, a list, text, a file, a job, a parcel), or that **takes** one.
- You build any new page: it needs a related row and it lands in the index by itself.
- `node tools/link-check.mjs` (checks.mjs `links`) fails.

## The contract

A payload is `{ kind, data, from }`. `clean()` checks every field and cuts it to size; anything malformed is `null`. Treat what arrives as untrusted **text**: put it in with `textContent`, `value`, or an escaping helper (`N.textToHtml` on /notes/), never `innerHTML`.

| kind | data | limits |
| --- | --- | --- |
| `text` | `{ text, title? }` | text 200,000 chars, title 200 |
| `list` | `{ items: [string], title? }` | 500 items of 500 chars |
| `event` | `{ events: [{ title, start, end?, allDay?, tz?, endTz?, location?, notes? }] }` (one event object is taken too) | 50 events; `start` is `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` local in `tz` (IANA) |
| `place` | `{ name, code? (IATA), lat?, lon?, tz? }` | |
| `route` | `{ stops: ['LHR', 'JFK'] }` | 2 to 20 IATA codes |
| `file` | `{ name, type, blob }` | 50 MB; the type must match the receiver's `files` patterns |
| `job` | `{ title, company?, when?, tz?, where?, url? (http/https), notes? }` | |
| `parcel` | `{ name, expected (YYYY-MM-DD), carrier?, tracking?, url? }` | |

Converters let a page take more than its own kind: `asEvents(p)` (a job's interview, a parcel's day, events), `asList(p)` (a line per item, event, place), `asText(p)` (a note or a word count of anything but a file).

How it travels: a page with a link (`LINKS` in `lib/handoff.js`) gets a plain URL (`/time/?at=...`, `/weather/?q=...`, `/flights/map/?route=...`, `/translate/?q=...`). Otherwise a small payload rides in the address after `#send=` (base64url JSON, under 1,800 characters, never sent to a server); a long one or any file goes into IndexedDB (`a2m.void.handoff`) and only `#send-id=<id>` is in the address: it is read once, deleted, and anything over an hour old is swept. Same origin only; no server, no account.

## The commands

A page that **makes** something (after its state exists; before or after the row is drawn):

```js
import('/lib/handoff.js').then((H) => H.offer('event', () => (events.length ? { events } : null), { label: 'the flights' }));
// a file: say its types so only pages that take them are offered
H.offer('file', async () => ({ name, type: 'image/png', blob }), { mime: ['image/*'], label: 'the picture' });
```

`get()` runs when the button is pressed, so it carries what is on the page now; `null` says "Nothing to send yet". Add the page and its kinds to `MAKES` in `lib/toolkit.js` (and its file types to `MAKES_FILES`). The tables live in the toolkit, plain data, so the related row can link the pages that work together without loading the hand-off code; `lib/handoff.js` is loaded only on a page that makes or takes something, after the first paint.

A page that **takes** something: add it to `RECEIVES` in `lib/toolkit.js` (`{ name, kinds, files? }`); when its address already reads the thing, give it a link in `LINKS` in `lib/handoff.js` and it needs no code of its own. Otherwise, when it starts:

```js
import('/lib/handoff.js').then((H) => H.receive('/calendar/', {
  event: (data, p) => { /* add H.asEvents(p) */ return 'added 2 events'; }, // what you say is shown as "From <page>: added 2 events"
}));
```

Related links: add the page to `RELATED` in `lib/toolkit.js` (closest first). `relatedOf()` adds the pages it works with by kind of data (`partnersOf`) and, for a hub (`HUBS`), the other hubs. A page that is not a tool goes in `PAGES` to be linked to. Every page's row ends with "Everything Verse does" (/tools/).

The index: `node tools/everything.mjs` writes `/tools/` from the sitemap, the skills and the tower; a new page lands in its group by `GROUPS` (or "More"). The deploy regenerates it (`tools/refresh.mjs`, step `everything`).

## How to tell it worked

- `node --test tools/handoff.test.mjs tools/toolkit.test.mjs`
- `node tools/link-check.mjs`: every sitemap page has its row and is in the index; every page in `MAKES` offers; every page in `RECEIVES` without a link receives.
- `node tools/heavy.mjs node tools/link-pages-e2e.mjs <dir>`: each wired pair pressed at 390 px, what arrived checked on the next page, a screenshot of each; look at them.

## Pairs wired (2026-10-26)

/flights/trip/ → /calendar/, /time/, /notes/, /kanban/ (the flights as events on the departure clock) and → /flights/map/ (the route); /flights/airports/ → /weather/, /time/, /flights/map/, /notes/ (a place); /flights/map/ → /notes/ (the route); /calendar/ → /time/, /notes/, /kanban/ (the open event or the next ones) and ← an .ics file, a job, a parcel; /notes/ → /kanban/ (a card), /word-count/, /translate/; /kanban/ → /notes/, /word-count/ (the cards as a list); /markets/ → /notes/, /kanban/, /word-count/ (the quote); /recipes/ → /notes/, /kanban/ (the shopping list); /translate/ → /notes/, /kanban/, /word-count/; /word-count/ → /notes/, /kanban/, /translate/; /pdf/ → /photos/ (a page as a picture); /photos/ → /pdf/ (the picture into Images to PDF).

## For the lane builders (wire yours the same way)

- /jobs/: an interview → `offer('job', ...)` with `when` and `tz`: it lands on /calendar/ as "Interview: ..." and on /kanban/ as a card with its due day.
- /shop/: a parcel's expected day → `offer('parcel', ...)`: an all-day "Parcel arrives" on /calendar/, a card on /kanban/.
- /maps/: a place → `offer('place', ...)`: /weather/, /time/, /flights/map/, /notes/.
- /search/, /chat/, /email/, /social/: a result, a message or a post → `offer('text', ...)` (title + text): /notes/, /kanban/, /word-count/, /translate/.
- /learn/: a lesson's schedule → `event`; flash cards → `list`.
- /video/, /games/, /models/: a file (a frame, a screenshot, a model's picture) → `offer('file', ..., { mime: [...] })`.
- /code/, /assistant/: text out; take `text` in (a note to explain, a paste to run) by adding the page to `RECEIVES` (lib/toolkit.js) and calling `receive`.
A new kind (say `contact`): add it to `KINDS` and `CLEAN` in lib/handoff.js with its limits, a converter if other pages can take it, and a test in `tools/handoff.test.mjs`.

## Mistakes made

- Playwright routes: the route added last wins, so a catch-all `/api/` stub must be added before the specific one it should not shadow.
- A floor's sister pages (/kanban/simple/, /pdf/merge/) share the leader's code: `targetsFor` never offers the leader to its own sisters.
- Cutting a string before testing its shape turns `nope` into the airport code `NOP`: test, then cut.
