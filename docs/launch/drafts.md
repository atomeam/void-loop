# Launch drafts: alternative listings and community posts

Drafts only, for the owner to review and post by hand. Nothing here has been posted, no account was made and no one was contacted.
Written 2026-10-26 from `origin/main` at `7538d6f0`.

Where the facts come from:
- **What a page does:** that page's own `index.html` (title, description, intro and footer) and, for the privacy claims, its code (see "Checked in the code" below).
- **Numbers:** `void-live-deploy/tower.evidence.json`, written by `tools/tower-gate.mjs`. Every number below is copied from it, with the date of the run. "Surpassed" means the gate in `void-live-deploy/lib/tower.js` (`gate()`) passes: every aspect on that site's checklist is "better" or "equal-and-better". On 2026-10-26 that is 167 of 186 sites.
- **What Verse is:** `STANDING.md`.

How to read the numbers (say this if anyone asks):
- **Load time** is milliseconds to the browser's load event, the median of 3 loads at phone width (390 px), from the gate's own machine. It is one network on one day, not a lab benchmark.
- **Design defects** are low-contrast texts plus small tap targets plus layout shift, counted automatically at phone width.
- **Unnamed controls** are buttons, inputs or images with no accessible name.
- **Offline** means the page shows itself again with the network cut, after one visit.
- **"Things a full answer shows"** (completeness) is the gate's own checklist, read from the rival's public page **without signing in**. For big signed-in products (Google Calendar, Trello, Photopea, Google Photos) it undercounts what the real product has, so the listings below do not use it as a feature comparison. Use load time, defects, offline and accessibility instead.
- Where a site did not answer the gate (timeanddate.com, passwordsgenerator.net, gcmap.com, 4chan), Verse was held to a fixed bar instead of the site. That is not a head-to-head win, and the listings say so.

## Checked in the code before claiming "nothing uploaded"

| Page | What runs | Network calls found | Verdict |
| --- | --- | --- | --- |
| `/pdf/` and `/pdf/*/` | `lib/pdf-ui.js`, `lib/pdf-tools.js`, pdf-lib 1.17.1 and pdf.js, both served from `/vendor/` on the same site | Only a same-site prefetch of those three library files (`lib/pdf-ui.js` line 258). No upload, no `/api/` call. | Claim holds: files are read and written in the browser. |
| `/photos/` and `/photos/*/` | `photos/app.js`, `lib/photo-edit.js`, `lib/safety.js`, `lib/pay-share.js` | None (no `fetch`, XHR, beacon or `/api/`). | Claim holds. Saved copies are redrawn from pixels, so camera and GPS data is dropped (footer). |
| `/fantasy/` | `fantasy/app.js`, `lib/fantasy.js` | Only `/api/scores` with a league, a date or a game id, for the "Stats from box scores" tab (ESPN's public feed behind it). The pasted sheet is never sent. | Claim holds for the sheet. Box scores are fetched from the server. |
| `/music/` tools | `lib/music-tools.js`, `lib/music-audio.js`, `lib/music-ui.js` | None. The tuner uses the microphone (`getUserMedia`), and the audio is analysed in the browser. | Claim holds. |
| `/flights/` | `lib/flights-ui.js`, `lib/flights-core.js` | Only `/flights/airports.json` and `/flights/routes.json` (static files on the same site). Fares are links out to Google Flights, Skyscanner, Kayak, Momondo and Expedia. | No live fares, as the page says. The page's meta description says "six providers" but the code builds five. Fix the meta or say five (the drafts say five). |

Not on-device: the main ask box on the home page. What you type there goes to the server (`/api/answer`, an embedding model on Cloudflare Workers AI routes it), and an ask Verse cannot answer is stored as words only, with no IP or cookie (`functions/api/miss.js`), so it can be built later. The Show HN draft says this.

## 1. AlternativeTo listings

**Fields unverified.** alternativeto.net could not be reached from this machine (DNS closed). From a web search of its FAQ (alternativeto.net/faq): you add an app after signing up, through **User icon → "Suggest new application"**. The form asks for **platforms, license, description and tags**, and submissions are reviewed before they appear. To place an app on a rival's page, open that rival, click **"Contribute to this page"** and choose to suggest an alternative. The FAQ also says **a user profile used to advertise products gets blocked for spam**. So add each tool once, say on your profile that you made it, and don't post promotional comments. Check the live form for a name field, a website field, a short tagline, screenshots and a character limit before pasting.

Suggested structure: list each Verse tool as its own application ("Verse PDF tools", "Verse Kanban"…). Each is a separate page with its own URL, and AlternativeTo compares apps one by one. Then suggest each one as an alternative on the rival's page. Every tool is a free web app with no account. Platform: Web (Online), plus works offline after one visit. License: Free. Don't pick "Open Source" unless you choose to: the repository is public, but no license was checked for this draft.

### Recommended (in posting order)

#### Verse Kanban: alternative to Trello
- **URL:** https://a-to-mind.com/kanban/
- **Tagline:** A kanban board that lives in your browser: no account, works offline.
- **Description (~60 words):** Boards with columns and cards you move by drag and drop or the keyboard. Cards take labels, due dates, checklists and comments. There are WIP limits, swimlanes, a card timer, repeating cards, archive and search. Export and import JSON, including a Trello export. Everything is kept on your device, so there is no sign-up and no sync between devices. English and German.
- **Tags:** kanban, project-management, todo, offline, no-account
- **Why switch (measured 2026-10-26):** loads in 284 ms against Trello's 1,492 ms. 0 design defects against Trello's 13. 0 unnamed controls against 1. Opens with the network cut, and Trello's page does not.
- **Say plainly:** no shared boards and no sync across devices. It is one person's board on one browser.

#### Verse PDF tools: alternative to iLovePDF, Smallpdf, PDF24, Sejda, PDF Candy
- **URL:** https://a-to-mind.com/pdf/ (one page per rival: `/pdf/studio/` for Smallpdf, `/pdf/suite/` for PDF24, `/pdf/editor/` for Sejda, `/pdf/toolbox/` for PDF Candy)
- **Tagline:** Merge, split, compress and edit PDF pages without uploading them.
- **Description:** Merge, split, reorder, rotate and delete pages, compress, turn images into a PDF and pages into images, add page numbers and a watermark, and crop. Everything runs in your browser with pdf-lib and pdf.js, so files are never uploaded. No account, no daily limit, and it works offline after one visit. It cannot open password-protected PDFs or edit the text inside a PDF.
- **Tags:** pdf, pdf-merge, compress-pdf, privacy, offline
- **Why switch (measured 2026-10-26):** against iLovePDF, 158 ms to load against 284 ms and 0 design defects against 25. Against Smallpdf, 0 unnamed controls against 6 and 0 design defects against 5. Neither rival's page reopened offline, and Verse's did.
- **Say plainly:** no OCR, no Word or Excel conversion, no e-signature, and no text editing.

#### Verse image compressor: alternative to Squoosh and TinyPNG
- **URL:** https://a-to-mind.com/photos/squoosh/ (Squoosh), https://a-to-mind.com/photos/tinypng/ (TinyPNG)
- **Tagline:** Compress and convert JPEG, PNG, WebP and AVIF on your device, with a before-and-after slider.
- **Description:** Pick a quality, format and size, and drag the slider to compare. PNGs can drop to a palette of up to 256 colours. Do many files at once and download a zip, with no size or count limit. Resize, crop, rotate and strip EXIF too. Pictures never leave the device, saved copies carry no camera or location data, and AVIF is offered where your browser can write it.
- **Tags:** image-compression, webp, avif, png, privacy
- **Why switch (measured 2026-10-26):** against TinyPNG, 125 ms to load against 1,065 ms, 0 unnamed controls against 6, and 1 design defect against 14. Against Squoosh, 1 design defect against 8 and 0 unnamed controls against 1. Squoosh loaded faster (87 ms against Verse's 161 ms). Both work offline, so offline is not a reason to switch from Squoosh.
- **Say plainly:** compression uses the browser's own encoders, not Squoosh's MozJPEG or OxiPNG builds, so files may come out larger at the same quality.

#### Verse wheel: alternative to Wheel of Names
- **URL:** https://a-to-mind.com/wheel/
- **Tagline:** A fair random name picker: the winner is drawn before the wheel turns.
- **Description:** Type names or choices, spin, get a winner. The winner is drawn first with the browser's cryptographic random numbers, and the spin is planned to land on it. A weight like `Pizza*3` triples a chance. Remove winners, shuffle, sort, and share the wheel as a link. No ads, no account, nothing sent anywhere.
- **Tags:** random-picker, spin-wheel, classroom, giveaway, no-ads
- **Why switch (measured 2026-10-26):** 155 ms to load against 333 ms. 2 design defects against 14. 0 unnamed controls against 2. Opens offline, and wheelofnames.com's page does not.

#### Verse Flights: alternative to Google Flights (planning, not fares)
- **URL:** https://a-to-mind.com/flights/
- **Tagline:** Plan a flight and open the same search on five fare sites in one click.
- **Description:** Find airports by city, name or code, with nearby airports. Build one search and open it on Google Flights, Skyscanner, Kayak, Momondo and Expedia. See distance, flight time, time difference, local arrival and CO2, all worked out on your device. Keep a log of fares you saw, with the lowest and a target. **Verse has no live fares:** prices are on those sites.
- **Tags:** flights, travel-planning, airport-codes, flight-distance, co2
- **Why switch (measured 2026-10-26):** 117 ms to load against Google Flights' 741 ms. 2 design defects against 12. Opens offline, and Google Flights does not.
- **Say plainly:** no live prices, no booking and no price alerts sent to you. The "price log" is fares you type in. Some deep links prefill only part of the search: the code marks the Google Flights and Momondo links "unconfirmed" and Kayak's passenger part "not confirmed".

Also list, as their own small entries, the flight tools that are surpassed:
- `/flights/trip/` against TripWaffle: paste a confirmation, get a timeline with layover warnings and a .ics. 115 ms against 230 ms, and 0 design defects against 18.
- `/flights/time/` against clock7's flight calculator: 178 ms against 218 ms, and 0 px sideways overflow at phone width against clock7's 80 px.

Do **not** list `/flights/distance/` against Air Miles Calculator, `/flights/co2/` against myclimate, or `/flights/routes/` against FlightConnections yet. The gate still has them losing on load time, completeness or design, so they are not surpassed.

#### Verse Metronome: alternative to Metronome Online
- **URL:** https://a-to-mind.com/metronome/
- **Tagline:** A metronome with tap tempo, accents, subdivisions and setlists that works offline.
- **Description:** 20 to 400 BPM, tap tempo, every time signature, accents on each beat, subdivisions, nine sounds, a visual beat, a practice timer, a speed trainer, and setlists of saved tempos shared by link. No account, and it works offline.
- **Tags:** metronome, music-practice, tap-tempo, musicians, offline
- **Why switch (measured 2026-10-26):** 0 unnamed controls against 5. 3 design defects against 19. Opens offline. metronomeonline.com loaded faster (146 ms against Verse's 191 ms).

#### Verse Piano: alternative to Virtual Piano
- **URL:** https://a-to-mind.com/piano/
- **Tagline:** An online piano for the computer keyboard, touch or a MIDI keyboard.
- **Description:** Play with the computer keyboard, the mouse, a touch screen or a MIDI keyboard. Twelve instruments, a sustain pedal, key labels, sheet music in plain letters, record and replay, transpose and reverb. No account, and it works offline.
- **Tags:** piano, virtual-piano, midi, music, offline
- **Why switch (measured 2026-10-26):** 174 ms to load against 795 ms. 0 unnamed controls against 7. 3 design defects against 45. Opens offline.

#### Verse Calendar: alternative to Google Calendar (for one person, on one device)
- **URL:** https://a-to-mind.com/calendar/
- **Tagline:** A calendar that stays on your device: month, week and day, repeats, reminders, .ics.
- **Description:** Month, week and day views. Events repeat daily, weekly, monthly, yearly or on chosen weekdays. Reminders fire on the device. Invites go out as a link or an email with the .ics. Import and export .ics, quick add in plain words, search, keyboard arrows. Nothing goes to a server, and it works offline.
- **Tags:** calendar, ics, privacy, offline, no-account
- **Why switch (measured 2026-10-25):** 147 ms to load against Google Calendar's 1,932 ms (its public page, signed out). 0 design defects against 136. Opens offline.
- **Say plainly:** no sync between devices and no shared team calendars.

#### Verse Random Number: alternative to RANDOM.ORG
- **URL:** https://a-to-mind.com/random/
- **Tagline:** Random numbers from your device's secure generator, many at once, with or without repeats.
- **Description:** A random number between any two numbers, many at once, with or without repeats, or a pick from your own list. It uses your device's cryptographic random numbers with no bias. Or tick the public draw: one round from the drand randomness beacon, and the link carries the round so anyone can re-derive the same numbers. No ads.
- **Tags:** random-number, rng, picker, dice, no-ads
- **Why switch (measured 2026-10-25):** 120 ms to load against 330 ms. 0 design defects against 29. Opens offline.
- **Say plainly:** RANDOM.ORG's numbers come from atmospheric noise. Verse's come from your device's CSPRNG, or from drand when you choose the public draw (the page's only network use). Some people care about the difference.

#### Verse Word Counter: alternative to WordCounter.net
- **URL:** https://a-to-mind.com/word-count/
- **Tagline:** Words, characters, sentences and reading time as you type, nothing sent anywhere.
- **Description:** Type or paste text and see words, characters with and without spaces, sentences, paragraphs, reading and speaking time, reading level and keyword density change as you type. Kept on this device, works offline, no ads.
- **Tags:** word-counter, character-count, writing, seo, no-ads
- **Why switch (measured 2026-10-26):** 139 ms to load against 1,029 ms. 0 design defects against 31. 0 unnamed controls against 2. Feature checklist is a tie (14 of 14 each).

#### Verse Notes: alternative to Simplenote / aNotepad
- **URL:** https://a-to-mind.com/notes/
- **Tagline:** Rich-text notes with search and version history, kept on your device.
- **Description:** Notes and documents with bold, italic, headings, lists, checklists, code and links. Many documents, search across all of them, and version history to preview and restore. Export to .md, .html and .txt. Nothing goes to a server, and it works offline.
- **Tags:** notes, notepad, markdown, offline, privacy
- **Why switch (measured 2026-10-25):** against Simplenote, 94 ms to load against 269 ms, 0 design defects against 13, and opens offline while Simplenote's page does not. Don't pitch it against Notion or Evernote: no sync, no sharing, no databases.

### Considered and not recommended (yet)

| Rival | Verse page | Why not |
| --- | --- | --- |
| finviz.com | `/markets/screener/` | Surpassed by the gate (95 ms against 10,586 ms, and 0 px sideways overflow against 815 px), but the screener filters **a fixed set of 12 US stocks, 4 indices and 30 coins**, and prices may be delayed. People searching for a finviz alternative want the whole market. Listing it would mislead. |
| timeanddate.com | `/time/` | timeanddate.com turned the gate away on all 3 loads (2026-10-26), so Verse was measured against a fixed bar, not the site. The page is good (world clock, converter, meeting planner, offline), but there is no head-to-head number. If you list it, leave "why switch" to features only. |
| Spotify, Google Photos, Google Translate, the big news and sports sites | `/music/`, `/photos/`, `/translate/`, `/news/`, `/scores/` | The gate passes, but these pages are not substitutes for what people use those products for (a streaming catalogue, a cloud photo library). Leave them off. |
| photopea.com | `/photos/photopea/` | Surpassed, but the page itself says "one picture at a time, no layers". Photopea users want layers and PSD. Photopea also loaded faster (73 ms against 145 ms). |

## 2. Launch posts

**Read this first (both HN and Reddit).** A web search found Hacker News quoting its guidelines as "Don't post generated comments or AI-edited comments", and a moderator (dang) saying text posted to HN should not be LLM-generated and that HN already prohibits AI-generated text in submissions and comments. These drafts were written by an AI, so on HN they are **notes for you to rewrite in your own words**, not text to paste. For Reddit, check each subreddit for a similar rule. Some music communities reportedly ban anything AI-related (see the musicians post).

None of the community pages could be opened from here (DNS closed). The rules below come from web-search summaries. Each is marked **confirmed** (seen in a search result from the site itself) or **unconfirmed** (read the sidebar before posting).

General Reddit norms (unconfirmed per subreddit): say you made it, don't ask for upvotes, don't post the same link to many subreddits on the same day, reply to comments, and expect removal where self-promotion is limited to a weekly thread.

### 2a. Show HN: the whole stage

**Rules (confirmed via search of news.ycombinator.com/showhn.html):**
- A Show HN must be something people can try. Landing pages, sign-up pages, blog posts and newsletters don't qualify.
- It must be your own work, and you must be around to discuss it.
- Make it easy to try, ideally without sign-ups or emails.
- Minor updates don't qualify.
- The title starts with "Show HN:".
- Search results also point to a moderator note: give a clear statement of what it does plus the backstory, and don't use an LLM to write it.

**Title (keep it plain, under 80 characters):**
`Show HN: Verse – ask for a tool and it appears; 60+ tool pages, no account`

**Text (rewrite in your words before posting):**

> I built Verse (a-to-mind.com). The home page is an empty stage with one box: you ask for something ("timer for 10 minutes", "merge pdf", "time in Tokyo") and a card or a tool appears. Behind it are about 300 small skills and an embedding-model router on Cloudflare Workers AI that picks one.
>
> Many of the answers became standalone pages: about 60 tool pages (PDF, image compression, kanban, calendar, notes, metronome, piano, tuner, flights planning, a wheel picker, unit converter, calculator…). Most do their work in the browser: the PDF and image tools never upload a file, and the pages reopen offline after one visit. No account, no ads on the tools.
>
> The part I find most interesting: each tool page is checked by a script against a named real site (Trello, iLovePDF, TinyPNG, Google Flights…). It loads both at phone width and compares load time, accessibility (unnamed controls), tap targets and contrast, whether the page reopens offline, link previews, and a feature checklist. A page only counts as "surpassed" when every aspect is equal or better. The results, with the measured numbers, are public at /conquered/ and /compare/. Example from yesterday's run: /kanban/ loaded in 284 ms against Trello's public page at 1,492 ms. That is one machine, median of 3 loads, not a lab benchmark, and the feature checklist reads rivals signed-out, so it undercounts big products.
>
> What it doesn't do: there is no sync between devices (your boards, notes and calendars live in your browser). The flights page has no live fares (it builds links to five fare sites). The markets screener covers a fixed set of 46 symbols. Asks you type into the main box are sent to the server, and an ask it can't answer is kept (words only, no IP or cookie) so it can be built later. There is a paid tier ($49/month for a custom Verse) and a store, but every tool page is free.
>
> The code is public on GitHub. I'd like feedback on which tools are actually useful and where the measurements are unfair.

- Post the home page URL (https://a-to-mind.com/) or `/tools/`. HN visitors try what's in front of them, so check the home stage works well on a cold visit before posting. **Owner to confirm:** link the repo in the text or not.
- Unconfirmed: whether HN currently allows a link to a site that sells something. Show HN generally does, if the thing can be tried for free.

### 2b. Privacy-minded PDF and image users

**Where:**
- **Privacy Guides forum, "Project Showcase" category** (discuss.privacyguides.net). **Confirmed** via search: this category is the only place on that forum where you may promote your own site or project. Don't link it in other threads, and open only one thread about it.
- r/privacy and r/degoogle: **unconfirmed**. Both are reported strict on self-promotion. Read the sidebar, and message the mods first if unsure.
- r/InternetIsBeautiful: **unconfirmed**. Self-promotion posts are common there, and an "I made a website that…" title has done well (one anecdote). Rules not seen.

**Title:** `PDF and image tools that run entirely in the browser (no upload, no account, works offline)`

**Body:**

> I made a set of PDF and image tools that do all the work in your browser, so the file never leaves your device.
>
> PDF (https://a-to-mind.com/pdf/): merge, split, reorder, rotate and delete pages, compress, images to PDF and PDF to images, page numbers, watermark, crop. It uses pdf-lib and pdf.js, both served from the same site (no third-party CDN).
>
> Images (https://a-to-mind.com/photos/): compress and convert JPEG, PNG, WebP and AVIF with a before-and-after slider, resize, crop, rotate, adjust, text, and batch to a zip. EXIF is shown, and saved copies are redrawn from the pixels, so they carry no camera or GPS data.
>
> How you can check it: open the network tab while you merge or compress. After the page loads, the only requests are the PDF library files from the same site. Both pages also work with the network off after one visit (a service worker caches them). The source is public on GitHub.
>
> What it doesn't do: no OCR, no Word or Excel conversion, no e-signatures, and it can't edit text inside a PDF or open password-protected PDFs. Image compression uses your browser's own encoders, so it won't always match dedicated encoders on size. The site does have a main AI ask box on the home page, and that does go to a server. These two tool pages don't use it.

- Don't quote load-time numbers here. This audience cares about the network tab, not milliseconds.
- **Before posting, check** whether Cloudflare Web Analytics is on (see the checklist). If it is, the pages load Cloudflare's beacon script (the CSP allows `static.cloudflareinsights.com`), and privacy readers will see that request. Either say "cookieless Cloudflare Web Analytics counts page views" in the post, or turn it off for `/pdf/` and `/photos/`. The current draft does not mention it, so update the "only requests" line to match what the network tab really shows.

### 2c. Fantasy sports

**Where:** r/fantasyfootball, r/fantasybball, r/fantasybaseball. **Unconfirmed.** No current rules were found. Large fantasy subreddits commonly keep tools to a weekly or daily discussion thread, so post as a comment there unless the sidebar allows a standalone post. Other options: r/FantasyFootballers, or the forum of your own league host.

**Title / opening line:** `I made a free tool that compares players from your own spreadsheet: start/sit, trades, draft board (no projections included)`

**Body:**

> I built a fantasy page (https://a-to-mind.com/fantasy/) that works from a sheet you already have. Paste or open a CSV, TSV or JSON with a name column and whatever numbers you use (your projections, floor, ceiling, ADP, rank, value). Then:
>
> - Compare 2 to 4 players on every column
> - Start or sit: the better number wins, with the margin, and floor and ceiling if your sheet has them
> - Trade: what each side adds up to in your own value column
> - Draft board and a mock draft, ranked by any column
> - Stats from box scores: add finished games and it works out averages, last few games, and home and away splits
>
> To be clear about what it is not: there are **no projections, rankings or expert data built in**. The numbers are the ones you paste. No live injury news, no league sync (Sleeper, ESPN, Yahoo), no betting. The box-score tab pulls finished games from a public scores feed. Everything else, including your sheet, stays in your browser and is never sent anywhere. The share link copies the page address, not your sheet.
>
> There's a made-up example sheet on the page if you want to see it work first. Free, no account, no ads.

### 2d. Musicians

**Where:** r/WeAreTheMusicMakers (**unconfirmed**; a 2026 marketing guide says it bans AI-related posts outright and runs weekly feedback threads), r/guitar, r/piano, r/drums, r/musictheory (all **unconfirmed**). The tools themselves don't use AI. But the site's home page is an AI ask box, and `/music/` links to "Make me a song". On a sub that bans AI, post only if the mods say a link to this site is fine, or leave that sub out.

**Title:** `Free metronome, tuner, piano, BPM counter and chord finder that work offline, no account`

**Body:**

> I made a small set of music practice tools, all at https://a-to-mind.com/music/:
>
> - **Metronome** (/metronome/): 20 to 400 BPM, tap tempo, any time signature, accents per beat, subdivisions, nine sounds, practice timer, speed trainer, setlists you can share by link
> - **Tuner** (/tuner/): chromatic, with presets for guitar, bass, ukulele, violin, viola, cello, mandolin and banjo plus alternate tunings, a needle in cents, and adjustable A4. It listens through your mic, and the sound is analysed in the browser, never sent.
> - **Piano** (/piano/): play with the computer keyboard, touch or a MIDI keyboard, 12 instruments, sustain, record and replay, transpose
> - **BPM counter** (/bpm/): tap along, half and double time, note lengths in ms and Hz, or find the tempo of an audio file on your device
> - **Chords and scales** (/chords/): chord notes with piano and guitar shapes, name a chord from notes, scales that fit, chords in a key, circle of fifths
>
> What they don't do: no recording studio or DAW features, no sheet-music import, no lessons. The piano's "sheet music" is plain letters, not notation. Everything works offline after the first visit. No account, no ads.

- Optional fact if someone asks why not metronomeonline.com: in the 2026-10-26 run, Verse's metronome had 0 unnamed controls against 5 and opened offline. Don't lead with it.

### 2e. Travel (flights)

**Where:** r/travel (**unconfirmed**; travel subreddits found in search ban advertising and self-promotion or require mod approval first, so message the mods before posting), r/TravelHacks, r/solotravel (**unconfirmed**), r/flights (no rules found). The safest route is to message the mods first.

**Title:** `I made a flight-planning page: one search opened on five fare sites, plus distance, flight time and CO2 (no live fares)`

**Body:**

> https://a-to-mind.com/flights/ is a planning page, not a booking site. **It has no live fares.** You pick the airports, dates, passengers and cabin, and it opens the same search on Google Flights, Skyscanner, Kayak, Momondo and Expedia in one click, so you compare prices on those sites.
>
> What it works out itself, on your device, from a list of about 4,000 airports (OurAirports, public domain):
> - airports by city, name or code, with nearby airports
> - distance, typical flight time, time difference and local arrival
> - an estimate of CO2 per passenger
> - a log of fares you saw, with the lowest and your target (you enter them; it doesn't watch prices)
> - your itinerary: paste a booking confirmation and get a timeline with warnings for tight, long or overnight layovers, plus a calendar file (/flights/trip/)
>
> Limits: flight times and CO2 are estimates from averages, not a timetable. Some provider links may not prefill every field (passengers on Kayak, for example). There are no price alerts. Free, no account, no ads, works offline after one visit.

## 3. Posting order and checklist

### Order (easiest and most relevant first)

1. **AlternativeTo:** Verse Kanban (Trello), Verse PDF tools (iLovePDF, Smallpdf), Verse image compressor (TinyPNG, Squoosh), Verse wheel (Wheel of Names). Low risk, and it brings search traffic for years. One app a day, so reviews don't pile up.
2. **Privacy Guides forum, Project Showcase:** the PDF and image post (the rule is confirmed and this audience can check the claim). Settle the analytics question first.
3. **The rest of AlternativeTo:** Flights, Metronome, Piano, Calendar, Random number, Word counter, Notes.
4. **Show HN:** once the home stage has been checked on a cold visit and you have rewritten the text yourself. Post on a weekday morning US Eastern time and stay to answer for a few hours.
5. **Music subreddits:** after messaging mods where AI rules are strict.
6. **Fantasy:** inside each subreddit's weekly thread, timed to its season (football: August to December).
7. **Travel subreddits:** only after mod approval.

### Checklist before the first post

- [ ] **Google Search Console:** a-to-mind.com verified (a DNS TXT record on Cloudflare is easiest) and `https://a-to-mind.com/sitemap.xml` submitted. The repo has no Google verification file or meta tag, so check the console itself. The sitemap lists 120 URLs, and `robots.txt` points to it.
- [ ] **Bing Webmaster Tools:** site added (it can import from Search Console) and the sitemap submitted. `tools/indexnow_submit.py` already pings IndexNow (Bing, Yandex) after a deploy. Confirm it runs.
- [ ] **Cloudflare Web Analytics on** for a-to-mind.com (Cloudflare dashboard → Analytics & Logs → Web Analytics). The CSP in `void-live-deploy/_headers` already allows `static.cloudflareinsights.com`, but whether it is switched on could not be seen from the repo. See the privacy-post note above.
- [ ] **Tag each link** so each post can be told apart: Cloudflare Web Analytics shows referrers, so plain links are fine for Reddit, HN and AlternativeTo. Add `?ref=hn`, `?ref=pg` and so on only if referrers turn out to be missing. Check first that a query string doesn't change what a tool page shows (some pages read `?q=`, `?tool=` and `?c=`).
- [ ] **Link previews:** check that each linked page has its title and image. The gate's "sharing" aspect found 4 of 4 on every page listed here.
- [ ] Fix the `/flights/` meta description ("six providers" while the page builds five).
- [ ] Rewrite the Show HN text in your own words.
