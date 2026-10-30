# Wider use: every Verse version is usable by more people than the original

Owner rule, 2026-10-28 (paraphrased): when a Verse page is a version of an existing site, it should work for more kinds of people than that site does, not only match its features. This file is the checklist, how the gate and the lap use it, the first audit, and the niche list.

## The checklist (11 points)

1. **Beginners:** guided input, a plain example to try, no blank box.
2. **Experts:** shortcuts, and the raw or advanced mode kept.
3. **Phones and touch:** 360 px wide, no sideways scroll, targets big enough to tap.
4. **Screen readers and keyboards:** axe finds no serious issues; every control is reachable and named.
5. **Slow or offline:** works after load without the network, or says plainly what needs it.
6. **Other languages:** a language picker or translated strings, and a real lang attribute.
7. **Low vision:** at 200% zoom no text is cut off and nothing needs sideways scroll.
8. **Reduced motion:** prefers-reduced-motion is honoured.
9. **Sharing:** the URL restores what you made or picked.
10. **Copy and export:** a copy button or a download for the result.
11. **Broad niche:** a plain one-line job first, topic-agnostic presets, examples from several domains, no unexplained jargon, a hook for people who are not fans; fan depth kept.

## How it is checked

- `tools/wider-use.mjs` scores one page on all 11 points in a real browser (axe, 360 px, 200% zoom, keyboard, offline reload, URL round-trip). `node tools/wider-use.mjs /path/ ...` prints the score and what was missed.
- `tools/insider-flag.mjs` is the static niche check over every page's HTML (skips `/tournaments/`). It flags a page when (a) jargon, a franchise or a rival brand name comes before the plain job in the first 15 words, (b) scene labels sit on generic counting with no any-topic framing, or (c) the default example is insider-only with no everyday example. `node tools/insider-flag.mjs` lists them; test `tools/insider-flag.test.mjs`. It reads static HTML only, so text a script writes later is not seen.
- **Tower gate:** `wider use` is a required aspect in `lib/tower.js` COMMON_ASPECTS and `tools/tower-gate.mjs` MEASURES (higher is better, ideal 11). A floor beats its rival on it only when Verse scores at least the rival; if the rival cannot be read, the bar is 11.
- **Lap loop:** `lib/lap.js` puts wider use first in every overhaul ask, and every upgrade ask says to make the page usable by more people than the original.

## Decisions (owner, 2026-10-28)

- A tie passes: a Verse page that scores the same as its rival, including 11 against 11, passes the gate.
- The photo editor page keeps the name "Photo editor".
- When no visitor data is there, the pages to audit first are the top 40 in sitemap order.

Note (box): the front page (/) is one quiet input on purpose. Most of the score's text checks find nothing on an empty stage, so its low score comes from that design, not from a bug. Raising it means showing more on the empty stage, and that is the owner's call.

## First audit, 2026-10-28 (live site, 98 pages scored), worst first

There is no visitor-usage data, so the top pages are the tower floors, their lanes and the most linked pages. 10 pages lost their browser to box load twice and are not scored yet: /notes/, /boards/, /sports/, /scores/, /markets/, /markets/caps/, /markets/screener/, /news/, /photos/exifeditor/, /photos/exif/.

Most missed: experts 89, broad niche 77, beginners 73, sharing (link restores state) 66, other languages 57, copy and export 54, screen readers and keyboards 26, slow or offline 18, low vision (200% zoom) 12, phones 6. Average 7.6 of 11.

| Page | Score /11 | Missed |
|---|---|---|
| / | 3.5 | beginners, experts, screen readers and keyboards, slow or offline, other languages, sharing (link restores state), copy and export, broad niche |
| /exif/ | 3.5 | beginners, experts, slow or offline, other languages, low vision (200% zoom), sharing (link restores state), copy and export, broad niche |
| /store/receipt/ | 4.5 | beginners, experts, phones, screen readers and keyboards, slow or offline, other languages, sharing (link restores state), broad niche |
| /code-review/ | 5.5 | beginners, experts, slow or offline, other languages, sharing (link restores state), copy and export, broad niche |
| /compare/ | 5.5 | beginners, experts, slow or offline, other languages, copy and export, broad niche |
| /conquered/ | 5.5 | beginners, phones, screen readers and keyboards, slow or offline, other languages, copy and export, broad niche |
| /cpan/ | 5.5 | beginners, experts, screen readers and keyboards, other languages, low vision (200% zoom), sharing (link restores state), broad niche |
| /flip/ | 5.5 | beginners, experts, other languages, sharing (link restores state), copy and export, broad niche |
| /obituaries/ | 5.5 | beginners, experts, screen readers and keyboards, other languages, sharing (link restores state), copy and export, broad niche |
| /store/ | 5.5 | beginners, experts, phones, screen readers and keyboards, other languages, sharing (link restores state), broad niche |
| /cheat-codes/ | 6 | beginners, experts, screen readers and keyboards, slow or offline, other languages, copy and export, broad niche |
| /g/ | 6 | beginners, experts, screen readers and keyboards, other languages, sharing (link restores state), broad niche |
| /generators/forum/ | 6 | beginners, experts, screen readers and keyboards, other languages, sharing (link restores state), copy and export, broad niche |
| /podcasts/ | 6 | beginners, experts, other languages, low vision (200% zoom), sharing (link restores state), copy and export, broad niche |
| /weather/ | 6 | beginners, experts, other languages, sharing (link restores state), copy and export, broad niche |
| /boards/rules/ | 6.5 | beginners, experts, slow or offline, other languages, copy and export, broad niche |
| /calendar/embed/ | 6.5 | beginners, experts, slow or offline, copy and export, broad niche |
| /emojis/ | 6.5 | beginners, experts, other languages, sharing (link restores state), copy and export, broad niche |
| /films/ | 6.5 | beginners, experts, slow or offline, other languages, copy and export, broad niche |
| /first-automation-setup/ | 6.5 | beginners, experts, slow or offline, other languages, copy and export, broad niche |
| /fix/ | 6.5 | beginners, experts, phones, slow or offline, other languages, copy and export, broad niche |
| /fix/zapier-401-unauthorized/ | 6.5 | beginners, experts, slow or offline, other languages, copy and export, broad niche |
| /full-stack-audit/ | 6.5 | beginners, experts, slow or offline, other languages, copy and export, broad niche |
| /keep-it-running/ | 6.5 | beginners, experts, slow or offline, other languages, copy and export, broad niche |
| /one-time-fix/ | 6.5 | beginners, experts, slow or offline, other languages, copy and export, broad niche |
| /privacy/ | 6.5 | beginners, experts, slow or offline, other languages, copy and export, broad niche |
| /recipes/ | 6.5 | beginners, experts, low vision (200% zoom), sharing (link restores state), copy and export, broad niche |
| /bpm/ | 7 | beginners, experts, sharing (link restores state), copy and export, broad niche |
| /calendar/ | 7 | beginners, experts, low vision (200% zoom), sharing (link restores state), copy and export, broad niche |
| /color/ | 7 | beginners, experts, screen readers and keyboards, other languages, sharing (link restores state), broad niche |
| /password/ | 7 | beginners, experts, other languages, sharing (link restores state), broad niche |
| /pdf/ | 7 | beginners, experts, screen readers and keyboards, other languages, sharing (link restores state), copy and export, broad niche |
| /pdf/studio/ | 7 | beginners, experts, screen readers and keyboards, other languages, sharing (link restores state), copy and export, broad niche |
| /pdf/suite/ | 7 | beginners, experts, screen readers and keyboards, other languages, sharing (link restores state), copy and export, broad niche |
| /pdf/toolbox/ | 7 | beginners, experts, screen readers and keyboards, other languages, sharing (link restores state), copy and export, broad niche |
| /podcast/ | 7 | beginners, experts, slow or offline, other languages, copy and export, broad niche |
| /resize-image/ | 7 | experts, screen readers and keyboards, other languages, sharing (link restores state), copy and export |
| /time/ | 7 | beginners, experts, screen readers and keyboards, other languages, sharing (link restores state), broad niche |
| /tools/ | 7 | experts, other languages, sharing (link restores state), copy and export |
| /word-count/ | 7 | beginners, experts, other languages, sharing (link restores state), broad niche |
| /base-converter/ | 7.5 | beginners, experts, other languages, sharing (link restores state), broad niche |
| /base64/ | 7.5 | beginners, experts, phones, other languages, sharing (link restores state), broad niche |
| /books/ | 7.5 | beginners, experts, other languages, low vision (200% zoom), broad niche |
| /chords/ | 7.5 | beginners, experts, screen readers and keyboards, sharing (link restores state), copy and export, broad niche |
| /convert/ | 7.5 | beginners, experts, other languages, sharing (link restores state), copy and export, broad niche |
| /convert/unit-converter-2/ | 7.5 | beginners, experts, other languages, sharing (link restores state), copy and export, broad niche |
| /convert/unit-converter/ | 7.5 | beginners, experts, other languages, sharing (link restores state), copy and export, broad niche |
| /generators/make/ | 7.5 | beginners, experts, screen readers and keyboards, other languages, sharing (link restores state), broad niche |
| /identity/ | 7.5 | beginners, experts, screen readers and keyboards, other languages, low vision (200% zoom), broad niche |
| /password-strength/ | 7.5 | beginners, experts, other languages, sharing (link restores state), copy and export, broad niche |
| /pdf/editor/ | 7.5 | beginners, experts, screen readers and keyboards, other languages, sharing (link restores state), broad niche |
| /pdf/merge/ | 7.5 | beginners, experts, other languages, sharing (link restores state), copy and export, broad niche |
| /piano/ | 7.5 | beginners, experts, screen readers and keyboards, low vision (200% zoom), sharing (link restores state), broad niche |
| /random/ | 7.5 | beginners, experts, other languages, broad niche |
| /fantasy/ | 8 | experts, other languages, low vision (200% zoom), sharing (link restores state), copy and export |
| /flights/airports/ | 8 | beginners, experts, sharing (link restores state), copy and export, broad niche |
| /flights/time/ | 8 | beginners, experts, screen readers and keyboards, sharing (link restores state), copy and export, broad niche |
| /generators/chat/ | 8 | experts, screen readers and keyboards, sharing (link restores state), copy and export |
| /hosting/ | 8 | beginners, experts, other languages, low vision (200% zoom), broad niche |
| /paint/ | 8 | beginners, experts, other languages, sharing (link restores state), broad niche |
| /pdf/organize/ | 8 | beginners, experts, other languages, sharing (link restores state), broad niche |
| /random-user/ | 8 | beginners, experts, screen readers and keyboards, other languages, broad niche |
| /translate/ | 8 | beginners, experts, low vision (200% zoom), sharing (link restores state), broad niche |
| /tuner/ | 8 | beginners, experts, sharing (link restores state), copy and export, broad niche |
| /calculator/ | 8.5 | beginners, other languages, sharing (link restores state), broad niche |
| /flights/ | 8.5 | beginners, experts, screen readers and keyboards, sharing (link restores state), broad niche |
| /flights/co2/ | 8.5 | beginners, experts, sharing (link restores state), copy and export, broad niche |
| /flights/distance/ | 8.5 | beginners, experts, sharing (link restores state), copy and export, broad niche |
| /flights/routes/ | 8.5 | beginners, experts, sharing (link restores state), copy and export, broad niche |
| /image/ | 8.5 | experts, sharing (link restores state), copy and export |
| /metronome/ | 8.5 | beginners, experts, sharing (link restores state), broad niche |
| /photos/ | 8.5 | experts, sharing (link restores state), copy and export |
| /photos/iloveimg/ | 8.5 | experts, sharing (link restores state), copy and export |
| /photos/photopea/ | 8.5 | experts, sharing (link restores state), copy and export |
| /photos/squoosh/ | 8.5 | experts, sharing (link restores state), copy and export |
| /photos/tinypng/ | 8.5 | experts, sharing (link restores state), copy and export |
| /stopwatch/ | 8.5 | experts, screen readers and keyboards, other languages, sharing (link restores state) |
| /wheel/ | 8.5 | beginners, other languages, copy and export, broad niche |
| /flights/map/ | 9 | beginners, experts, copy and export, broad niche |
| /flights/trip/ | 9 | beginners, experts, sharing (link restores state), broad niche |
| /generators/ | 9 | beginners, experts, low vision (200% zoom), broad niche |
| /generators/story/ | 9 | experts, sharing (link restores state) |
| /gradient/ | 9 | experts, phones, other languages |
| /is-it/christmas | 9 | beginners, experts, broad niche |
| /kanban/flow/ | 9 | sharing (link restores state), broad niche |
| /kanban/quick/ | 9 | beginners, sharing (link restores state), broad niche |
| /music/ | 9 | beginners, experts, sharing (link restores state), broad niche |
| /kanban/ | 9.5 | sharing (link restores state), broad niche |
| /kanban/simple/ | 9.5 | sharing (link restores state), broad niche |
| /kanban/teams/ | 9.5 | sharing (link restores state), broad niche |
| /jobs/ | 10.5 | experts |
| /jobs/alerts/ | 10.5 | experts |
| /jobs/categories/ | 10.5 | experts |
| /jobs/companies/ | 10.5 | experts |
| /jobs/europe/ | 10.5 | experts |
| /jobs/regions/ | 10.5 | experts |
| /jobs/tags/ | 10.5 | experts |
| /jobs/salary/ | 11 | none |

## Niche pages (insider flag), with a broadened lead line and preset

| Page | Why flagged | Broadened lead line | Everyday preset |
|---|---|---|---|
| /base-converter/ | (a) "hex", "Hex" comes before the plain job in the first 15 words (the job is never said there) | Turn a number into binary, hex or any base and back: for colours, file sizes, permissions or homework. | Try: colour #FF8800, chmod 755, 1 KB in bytes |
| /bpm/ | (a) "BPM" comes before the plain job in the first 15 words | Find how fast a song is (beats per minute): tap along for a workout, a dance class, a DJ set or a rehearsal. | Try: tap a song, a running pace, a heartbeat |
| /cpan/ | (a) "CPAN", "Perl", "CPAN" comes before the plain job in the first 15 words (the job is never said there) | Look up a code library and its docs: search Perl modules, see what they do, who keeps them and what they need. | Try: read a CSV, send an email, parse dates |
| /films/ | (a) "LMS" comes before the plain job in the first 15 words (the job is never said there) | Pick something to watch: a shared film list for a household, a club or a class, with who has seen what. | Try: family movie night, a film class list, book adaptations |
| /flights/airports/ | (a) "IATA", "ICAO" comes before the plain job in the first 15 words (the job is never said there) | Find an airport by city or name and get its short code: for booking, a boarding pass or a trip plan. | Try: London, Tokyo, the airport on my ticket |
| /g/ | (a) "Gist" comes before the plain job in the first 15 words | A note, list or code snippet in a link, nothing stored; gist kept as an alias (fixed in its own PR). | Presets: meeting notes, locked note, code snippet |
| /identity/ | (a) "SSO" comes before the plain job in the first 15 words | One sign-in for many apps: let your team or club log in once with the account they already have. | Try: small team, school club, family apps |
| /kanban/ | (a) "Kanban" comes before the plain job in the first 15 words | A to-do board with columns: move tasks from To do to Doing to Done, for a project, a move, a wedding or a class. | Try: moving house, a school project, a sprint |
| /kanban/flow/ | (a) "kanban" comes before the plain job in the first 15 words | A to-do board that shows where work piles up, for a shop floor, a support queue or a software team. | Try: orders, help requests, a sprint |
| /kanban/quick/ | (a) "kanban" comes before the plain job in the first 15 words | A quick to-do board in your browser: three columns, no account, for today or this week. | Try: chores, homework, errands |
| /kanban/simple/ | (a) "kanban" comes before the plain job in the first 15 words | A plain three-column to-do board: drag tasks from To do to Done. | Try: chores, a trip, a party |
| /kanban/teams/ | (a) "Kanban", "WIP" comes before the plain job in the first 15 words | A shared to-do board for a team, with a cap on how many tasks are in progress at once. | Try: a volunteer group, a newsroom, a dev team |
| /markets/ | (a) "ETFs" comes before the plain job in the first 15 words (the job is never said there) | See how shares, funds and prices moved today, in plain numbers: for savers, students and traders. | Try: a pension fund, a big company, gold |
| /metronome/ | (a) "BPM" comes before the plain job in the first 15 words | A steady click to keep time: for practising an instrument, a workout, a dance or a speech. | Try: piano practice 80, running 170, a slow speech 60 |
| /photos/exif/ | (a) "EXIF" comes before the plain job in the first 15 words | See what a photo quietly records (when, where, which camera) and remove it before you share. | Try: a photo to sell something, a holiday photo, a document scan |

Also on the niche queue from owner steering (the static check misses them because their visible titles are already plain or set by script): /photos/iloveimg/, /photos/photopea/, /photos/tinypng/, /photos/exifeditor/ (plain titles and plain-URL aliases, old URLs kept), /random/ (everyday presets first, proof kept), /random-user/ (mock profiles, sample rosters and character placeholders, with a hand-off to /wheel/ or /tournaments/), /is-it/christmas (a holiday and event countdown for any date, Christmas default), /color/ (readable text pairs, brand palette, print vs screen presets). Done already: /hosting/, /boards/, /resize-image/, /g/.
