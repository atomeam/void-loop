# Capability gaps

A ranked list of easy, high-value jobs a first-time visitor still cannot really do on Verse: the ask returns an article, a snippet, a placeholder, or a lab experiment they would never find. This list is a build order. It is not a replacement for `docs/GAPS.md`, which only records asks that were typed live and seen to fail.

Before building any of these, search existing pages, skills, lab tools, and abandoned branches or pull requests. Salvage working code. Fold everything for one job into one super page. Redirect old addresses. Close leftover duplicate branches and pull requests with a reason. Do not invent a second page when a page already covers the job.

Standard internet names. Full tool pages stay behind Uni. A free homepage card for the same job still has to be useful. Visitor data only goes to Workers AI or Groq. Do not name other products here.

Checked against the site, `docs/GAPS.md`, skills, the lab catalog, open and closed pull requests, and leftover `helper/*` branches on 20 November 2026.

## Already on the site (do not rebuild)

These jobs already have a page or a card. New work, if any, belongs on that page or in the Ask card that should open it.

| Job | Where it already lives | What is still missing |
| --- | --- | --- |
| Speech to text / dictation / voice typing | `/lab/dictation/` (live microphone, 17 languages, copy and download). Ask names in `skills/open-tool.js` already point here. | GAPS #35 is still marked open. "Transcribe this audio" and a file upload are not on the page. A second lab tool does almost the same job (see salvage). |
| File conversion (image, audio, video, documents) | `/converter/` — a 106-tool catalog, most of it already on the device. | Catalog still marks a few tools as not built: Remove Image Background, Change Image Background, Compress MP3, Compress AZW3, PPTX to Video. Ask cards should do the conversion, not only open the catalog. |
| Unit conversion | `/convert/` and `skills/convert.js`. Old unit-converter self-sites already redirect here. | Currency is a deliberate near-miss of this skill (GAPS #21). Lab `/lab/f651-unit-converter/` is a leftover duplicate. |
| Time zones | `/time/`. "Time zone converter" is a near-miss of the unit card so it can open this page. | A meeting-planner ("what time is 3pm in Tokyo for someone in London") may still be thin. |
| QR codes | `/qr/`. Lab `/lab/f649-qr-code-generator/` is a leftover duplicate. | Wi-Fi and vCard QR asks should land on this page. |
| Photo edit, compress, crop, convert, EXIF | `/photos/` and `skills/photo-tools.js`. Old editor and compressor addresses already redirect here. | No upscale. No background removal (the converter catalog also lists those two as not built). |
| PDF tools | `/pdf/`. | Sign / signature, and some "make a form" asks, may still fall through. |
| Text to speech | Homepage voice card (`lib/speak.js`). Routing fixed in #3257 so a spoken sentence with a day in it is not a calendar event. | One live stranger check still due. Downloading an audio file of the speech may still be missing. |
| Charts | `helper/chart-card` / pull request #3263 (rebased, not merged at the time of this list). | A first-time visitor still gets matplotlib-style code until that lands. |
| Notepad | `skills/notepad.js` opens a pad on the stage. | GAPS #89 ("online notepad") is still marked open; confirm the live ask and close it if the pad appears. |
| Timer / pomodoro | `skills/timer.js`. Lab `/lab/f620-pomodoro-task-timer/` is a close cousin. | Meditation timer (GAPS #69) should fold into the same timer, not a new page. |
| Habits | `skills/habit-ring.js`, `skills/health-habits.js`, and lab `/lab/f646-habit-tracker/`. | GAPS #72 is still open; fold the lab tracker into the existing habit card or one habits page. |
| Tips, VAT, loans | `skills/tip.js`, `skills/vat.js`, `skills/loan.js`. Lab `/lab/f613-tip-calculator/` is a leftover cousin. | Split-a-bill can live on the tip card. |
| Notes | `/notes/` and the note skills. | Do not start a second notepad page. |
| Password | `/password/`. | A strong passphrase (GAPS #98) belongs on this page. |

`certainty-budget.js` is a card about hard claims, not a household money plan. `skills/writing-aids.js` transforms text; it does not write a resume. `skills/draft-triad.js` leaves "write a draft email" and "draft of my resume" as near-misses on purpose. `skills/whisper-network.js` is stage notes, not speech to text.

Leftover branches that already shipped and should be closed, not rebuilt: `helper/convert-card` and `helper/convert-shipped` (unit convert card, already on main), `helper/memory-preview` and `helper/memory-preview-ship` (shipped as pull request #1204). `helper/capability-sweep-workflow` landed as #3281.

No abandoned pull request was found that already builds a resume writer, a cover letter, a household budget, background removal, an upscale, a code runner, or a website preview. The salvage for those jobs is in the lab, or they are genuinely new.

## Salvage first

Working lab tools, already graded as tools, that should be folded into a public super page rather than left as a numbered experiment a stranger will not find.

| Lab tool | Job | Fold into | Also closes |
| --- | --- | --- | --- |
| `/lab/f660-voice-note-transcriber/` (Voice note to text: live transcript, record, copy, download text and audio, stays on the device) | Transcribe / record a voice note | `/lab/dictation/` — add a Record tab and a Transcribe a file tab beside live dictation. Redirect `/lab/f660-voice-note-transcriber/` and `/transcribe/` here. | GAPS #35, #36 |
| `/lab/f647-spatial-budget-allocator/` (monthly income, categories, drag bars, remaining updates live, stays on the device) | Make a budget | New public `/budget/` (household money). Sections for a plan, expenses, net worth, and allowance. | GAPS #47, #48, #49, #74 |
| `/lab/f643-receipt-to-expense/` | Expense list from a receipt | `/budget/?tab=expenses` | GAPS #48 |
| `/lab/f753-local-business-card-maker/` | Business card | `/business-card/`, and link it from the resume / cover letter / email writing page. | GAPS #50 |
| `/lab/f820-flowchart-maker/`, `/lab/f645-text-to-flowchart-spatial/`, `/lab/f821-speech-driven-spatial-flowchart/` | Flowchart | One `/flowchart/` page. Redirect the three lab addresses. | GAPS #91 |
| `/lab/f646-habit-tracker/` | Habit tracker | Existing habit card or one `/habits/` page; redirect the lab address. | GAPS #72 |
| `/lab/f631-chore-rota/`, `/lab/f663-chore-rota-spatial/`, `/lab/f749-chore-rota-generator/` | Chore chart | One `/chores/` page. Redirect the three lab addresses. | GAPS #73 |
| `/lab/f630-time-card/` | Time sheet | `/timesheet/`, or a tab on a small work-time page with a shift schedule. | GAPS #75 |
| `/lab/f751-local-message-encryptor/` | Encrypt a message | `/encrypt/` (or the existing encodings family if one already fits). | GAPS #97 |
| `/lab/f752-local-ssh-key-generator/` | Generate an SSH key | `/ssh-key/` or a tab on `/password/`. | GAPS #99 |
| `/lab/f651-unit-converter/` | Unit converter | Redirect to `/convert/`. Do not keep a second converter. | duplicate |
| `/lab/f649-qr-code-generator/` | QR code | Redirect to `/qr/`. | duplicate |
| `/lab/f620-pomodoro-task-timer/` | Pomodoro | Fold into the existing timer card; redirect the lab address. | cousin of the timer |
| `/lab/f613-tip-calculator/` | Tip calculator | Redirect to the tip card / its page. | duplicate |
| `/lab/f619-spatial-memory-palace-flashcards/` | Flashcards | Keep as the seed for a study / flashcards page if a quiz card stays thin. | related |

## Ranked build list

Smallest useful surface first. "Done" means a stranger can type the ask, get the thing (not an article), and take a copy or a download. Full pages stay on Uni; the free card still has to be useful.

| Rank | Job | Why it is worth doing | Super page | Salvage | Notes |
| ---: | --- | --- | --- | --- | --- |
| 1 | Transcribe audio | People ask to turn speech or a recording into text and currently miss the existing dictation page, or cannot upload a file. | `/lab/dictation/` | `f660-voice-note-transcriber` | Add live dictation, record, and transcribe a file on one page. File transcription can use Workers AI speech-to-text. Redirect `/transcribe/` and the lab URL. Wire "transcribe this audio" and "speech to text" so the card is the tool. Then close GAPS #35 and #36. |
| 2 | Resume | "Make a resume" still returns how-to text (GAPS #51). | `/resume/` (resume, cover letter, and a professional email on one writing page) | None found. `draft-triad.js` leaves this ask open on purpose. | Real copy and a download. No `[Your Name]` placeholders: ask the visitor or fill only what is clearly known. Link the business card maker. |
| 3 | Cover letter | Same family, same failure mode. | `/resume/?tab=cover` | None found | Same rules as the resume. |
| 4 | Professional email | "Write a draft email to …" is a known near-miss. | `/resume/?tab=email` | None found | Same rules as the resume. Offer a `.txt` or `.eml` download. |
| 5 | Budget planner | "Make a budget" still returns how-to text (GAPS #47). | `/budget/` | `f647-spatial-budget-allocator` | Household plan with income, categories, remaining, and a download. Not `certainty-budget`. |
| 6 | Expense tracker | GAPS #48. | `/budget/?tab=expenses` | `f643-receipt-to-expense` | Fold receipts and a simple expense list into the budget page. |
| 7 | Remove image background | Listed as not built in the `/converter/` catalog; asked constantly of any photo tool. | `/photos/` (and mark the converter catalog tool live, linking here) | None found in branches or pull requests | Add the mode on `/photos/`. Redirect a plain `/remove-background/` name here. Free card must return a usable picture. |
| 8 | Upscale a picture | Photo page can compress, crop, and convert, but cannot enlarge. | `/photos/` | None found | Same page as background removal. Redirect `/upscale/` here. |
| 9 | Code runner | "Code editor" still returns an article (GAPS #93). | `/code/` (editor, runner, and website preview together) | None found | A stranger pastes or writes HTML, CSS, JS, or a short script, runs it, and sees the result. Stay on the device for ordinary web code. |
| 10 | Website preview | Same job as a live HTML preview. | `/code/?tab=preview` | None found | One page with the runner. Redirect `/preview/` and `/html-preview/` here. |
| 11 | Conversion cards that actually convert | `/converter/`, `/convert/`, `/qr/`, and `/time/` already exist, but a homepage card should do the job, not only point at the catalog. | Those four pages | Already built | No new pages. Make the free Ask card carry the file or the numbers and show a result. |
| 12 | Currency converter | GAPS #21 still open: the unit card correctly refuses this and the visitor is told to check a live service. | `/convert/?tab=currency` | None | Live mid-market rates, with a dated source line. |
| 13 | Chart from numbers | Visitors still get plotting code instead of a chart. | Homepage chart card, with a link to keep or download it | Pull request #3263 (`helper/chart-card`) | Rebased onto main. Merge when checks are green. Do not start a second chart skill. |
| 14 | Business card | GAPS #50. | `/business-card/` | `f753-local-business-card-maker` | Promote the lab tool, polish it, link it from `/resume/`. |
| 15 | Invoice | A billed page with a download is a common utility ask. | `/invoice/`, linked from `/budget/` and `/resume/` | None found | Visitor's own name, items, totals, and a downloadable document. |
| 16 | Flowchart | GAPS #91. | `/flowchart/` | `f820`, `f645`, `f821` | One page; three lab URLs redirect. |
| 17 | OCR / image to text | A photo of text should become editable text. | `/photos/?tab=ocr` (and a link from `/pdf/`) | None found in the public pages | Workers AI or Groq only for the file. |
| 18 | Habit tracker | GAPS #72, with skills already nearby. | Existing habit card or `/habits/` | `f646-habit-tracker` | Do not make a third tracker. |
| 19 | Chore chart | GAPS #73, with three lab tools. | `/chores/` | `f631`, `f663`, `f749` | One page; redirect the three lab URLs. |
| 20 | Time sheet | GAPS #75. | `/timesheet/` | `f630-time-card` | A shift schedule (GAPS #76) can be a second tab on the same page. |
| 21 | Encrypt a message | GAPS #97. | `/encrypt/` | `f751-local-message-encryptor` | Stays on the device. |
| 22 | SSH key | GAPS #99. | `/password/?tab=ssh` or `/ssh-key/` | `f752-local-ssh-key-generator` | Fold into the password family if it fits. |
| 23 | Strong passphrase | GAPS #98. | `/password/` | The existing password page | A memorable phrase option on the same generator. |
| 24 | Favicon generator | GAPS #67. | `/favicon/`, or a mode on `/photos/` | None found | A simple icon from initials, an uploaded picture, or text. |
| 25 | CSS helpers (box shadow, radius, grid, flexbox, colour names) | GAPS #62–#66. Five thin generators should be one page, not five. | `/css/` | None found as public pages | Tabs for each helper. Redirect `/box-shadow/`, `/border-radius/`, `/flexbox/`, `/grid/` here. |
| 26 | Net worth tracker | GAPS #49. | `/budget/?tab=net-worth` | Budget page above | Do not start a separate money product. |
| 27 | Allowance tracker | GAPS #74. | `/budget/?tab=allowance` | Budget page above | Same rule. |
| 28 | Sign a PDF / signature | A frequent document ask that should not invent a new document home. | `/pdf/?tab=sign` | `/pdf/` already exists | Keep signatures on the PDF page. |
| 29 | Flashcards / quiz from notes | Quiz asks have been thin (text, not a tool). Trivia has its own card in flight. | A study page, seeded from lab flashcards, linked from notes | `f619-spatial-memory-palace-flashcards` | Do not fight the trivia round work already in open pull requests. |
| 30 | Inflation calculator | GAPS #22. | `/convert/?tab=inflation` | The unit converter page | Historical value of money belongs with currency, not a new calculator site. |
| 31 | Meeting notes from a transcript | Natural follow-on once transcribe works. | `/lab/dictation/` (a "Clean up into notes" action) and a link into notes | Dictation + notes | No third writing page. |
| 32 | Two-factor / one-time code | GAPS #100. | `/password/?tab=otp` | None found | Generate and display a one-time code from a secret the visitor pastes; do not store the secret. |
| 33 | Periodic table | GAPS #33. | `/periodic-table/` | None found | A straightforward reference card and page. Easy, self-contained. |
| 34 | Cat and pet age | GAPS #68. | A small `/pet-age/` card, or a tab beside the existing age calculator | Existing age calculator in `skills/time-math.js` | Do not invent a new maths home. |
| 35 | Ring size chart | GAPS #18. | A size-chart section on `/convert/` | Unit converter | Printable chart, not an article about industrial rings. |
| 36 | Country codes | GAPS #19. | A reference tab on `/convert/` or a small `/country-codes/` page that links to phone and country tools | None found | Calling codes and ISO codes together. |
| 37 | Webcam and microphone test | GAPS #85, #86. | One `/device-test/` page | `skills/my-device.js` already shows IP, user agent, and screen | Record-my-voice stays on dictation; this page only checks that the camera and mic work. |
| 38 | Screen recorder | GAPS #87. | `/record/` or a tab on `/device-test/` | Dictation already records mic audio | Browser `MediaRecorder` of the screen, with a download, on the device. |
| 39 | Voice changer | GAPS #37. | A tab on `/lab/dictation/` or `/record/` | Related to record-my-voice | Keep all voice toys on the speech page. |
| 40 | Meditation timer | GAPS #69. | The existing timer card, with a calm preset | `skills/timer.js`, `f620` | No new timer page. |
| 41 | Water reminder and workout timer | GAPS #70, #71. | Timer + habits | Existing timer and habit skills | Presets, not new products. |
| 42 | Drum machine | GAPS #32. | `/drum/` in the music family, next to piano and metronome if those pages already exist | Check piano / metronome before adding a page | Easy and self-contained, lower than writing and money tools. |
| 43 | UTM builder | Everyday marketing utility, easy, no new data store. | `/utm/`, linked from `/qr/` | None found | Standard name, copyable result. |
| 44 | JWT decoder | Everyday developer utility. | A tab on the existing encodings / developer tools family | Check `skills` for a decoder before adding a page | Decode and explain, on the device. Do not verify signatures with a secret the site keeps. |
| 45 | Meme / caption a picture | Caption and meme verbs already sit in photo-ask; the ask has still failed in sweeps. | `/photos/?tab=text` | `/photos/` | Fix the card so a visitor gets a picture they can download, not an article. |

Out of scope here, on purpose: the visitor video maker (already owned under Videos), medical or score claims, recreations of named games, and anything that needs a wholesale paywall opening.

## Build order for the next pull requests

Small `helper/*` pull requests, automerge, one job (or one super page) each:

1. Transcribe: fold `f660` into `/lab/dictation/`, add file transcription, redirect old URLs, wire the Ask card.
2. Resume / cover letter / email: one writing page, real copy, downloads, no placeholders.
3. Budget: promote `f647` and `f643` to `/budget/` with expenses, net worth, and allowance tabs.
4. Background removal and upscale: modes on `/photos/`, catalog entries flipped to live, plain-name redirects.
5. Code runner and website preview: one `/code/` page.
6. Conversion Ask cards: no new pages; make the existing converter, unit, QR, and time cards do the work.
7. Then the salvage promotions in rank order: business card, flowchart, chores, timesheet, encrypt, SSH / passphrase, CSS helpers, and the rest of the list.

When a pull request lands, mark the row here and, if it was a live-seen fail, move the matching `docs/GAPS.md` row to merged or verified live after the stranger check.
