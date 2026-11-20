# The money playbook and the revenue lane

Verse's top loop (owner, 2026-11-20): earn real money. `tools/revenue-lane.mjs` runs first in every house-loops run (11 a day,
`.github/workflows/house-loops.yml`, unchanged), so it needs no workflow of its own. `node tools/house-loops.mjs run revenue` runs only it.

## What it copies

Only patterns from documented businesses that earn largely on their own, each with the page that was read
(`void-live-deploy/offers/playbook.json`):

| Pattern | Proof | Source |
| --- | --- | --- |
| Free core, paid plus | Read the Docs: free community site plus a paid Business plan; donations alone did not work. Photopea: free editor, paid Premium | about.readthedocs.com/blog/2024/08/10-year-anniversary/, failory.com/interview/photopea |
| Offer where people already are | Photopea earns from the hours people already spend in it; Read the Docs runs one non-tracking ad on the pages readers already use | same two |
| One click to checkout | Gumroad documents `?wanted=true` to open the payment form directly | gumroad.com/help/article/144-send-customers-directly-to-your-payment-form |
| Honest trial | Plausible: $1M ARR with no popups or dark patterns, cancel any time, a reminder before renewal | plausible.io/blog/open-source-saas |
| Pay per use for builders | x402: the open standard for charging per HTTP request, for people and agents | docs.x402.org |

A new pattern goes in with its source, or not at all.

## What a run does

1. Reads realized income (`/api/treasury`), fetches every live paid checkout, and reads offer counts (`/api/buy?stats=1`: showings and clicks
   to checkout, people only).
2. A checkout that stopped answering: its offers come down at once.
3. An experiment whose 7-day window is over and whose variants have each been shown 40 times (or 28 days, whichever first): the variant
   with the best click rate is kept only if it beats the control with at least 3 clicks; the rest are cut. Every variant's counts go into its
   pattern's `results` in the playbook, so the next experiments start from what worked, and the winner is copied to the related pages
   (same product) that have no champion yet.
4. Every free slot starts a new experiment at once: the slot's champion as control, then the best-scoring patterns from the playbook (patterns
   tied on score are spread across slots, so the parallel experiments cover the whole playbook). No cap on slots: add a
   `<div data-offer="name">` and a row in `offers/offers.json`.
5. Writes a row to `void-live-deploy/progress/loops/revenue-runs/<time>.json` (income, sales, checkouts up, offer counts, the changes made; a new file each run) and the lane card `progress/loops/revenue.json`.

## Which pages carry a card

Only pages anyone can open (the list in `lib/page-pass.js` `openPath`, the same one the UniVerse gate uses). A page behind the gate is seen only by
members, so a card there would pitch people what they already have: the lane retires any slot whose page is gated. Traffic (`/api/visit`, 14 days):
of the ten busiest pages only `/` (left alone) and `/films/` are open; `/team/`, `/lab/`, `/brain/`, `/starboard/`, `/podcasts/`, `/conquered/`, `/treasury/`
and `/arcade/` are gated now. Slots: `films` and `blub` (the page strangers land on from a shared blobfish link). The `gate` slot is the UniVerse
screen itself: its showing and its Subscribe click are counted by `/api/buy` (id `universe`, source `gate.base.a`) and read into every run's row;
it is measured only, no experiment runs on it yet. A signed-in MultiVerse member or the owner is shown no card (`offers/offer.js`); a UniVerse member
or a stranger is offered MultiVerse (Verse Monthly, a real checkout), the next plan up.

## Honesty

`honestCopy` refuses urgency, scarcity, counts of buyers, ratings, guarantees and any dollar amount that is not the product's own price; a
free week is named only where the hosted checkout itself shows one (the catalog's `trial`). No fake numbers: an unreadable source is logged
as null, never guessed. The counts can be inflated by someone with many addresses; they steer which honest copy is kept, never a price.
