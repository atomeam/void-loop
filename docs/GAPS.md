# Gaps: asks Verse was seen to fail on

Owner, 2026-10-30: "come up with 100 things verse still cant do and add them all".

A gap is on this list only when someone typed the ask at https://a-to-mind.com/?q=... and saw it fail: an article about the thing instead of the thing, a code snippet, a wrong answer, or nothing. A guess about what might fail is not a gap.

Rank is smallest and highest value first: a pure card in the page before a page with a game, before anything that needs outside data. Each gap is built with a test, merged on a green main, and checked live again at the same address.

Evidence states, in order: **open** (seen failing, not built), **implemented** (code and test on a branch), **merged** (on main), **deployed** (on a-to-mind.com), **verified live** (the same ask, typed again, does the thing).

Not on the list, by rule: recreations of a named game (wordle, tetris), tests that need an invented score or make a medical claim (iq test, personality test, color blindness test, hearing test), and fake card numbers. These were seen failing too, and stay out on purpose.

Seen: what the live answer was, and the day. Batch 1 is in `tools/gaps-batch1.test.mjs` and `tools/my-device.test.mjs`; batch 2 in `tools/gaps-batch2.test.mjs`.

| # | Ask | Seen | Done when | State |
|---|-----|------|-----------|-------|
| 1 | remove duplicate lines | 2026-10-30: nothing | the tool named alone opens a box; pasted lines come back without repeats as you type | implemented |
| 2 | what is my ip address | 2026-11-06: article on proxy auto-config | the card shows the connection's public address, IPv4 or IPv6, and says it is not kept | implemented |
| 3 | what is my user agent | 2026-11-06: article on an AI agent | the card shows the browser's user agent string, with the browser and its version named | implemented |
| 4 | what is my screen resolution | 2026-11-06: article on display size | the card shows screen size, window size and pixel ratio, read in the page | implemented |
| 5 | generate a random color | 2026-11-06: a Python snippet | a colour is picked in the page and shown with its hex code | implemented |
| 6 | contrast ratio between #000000 and #ffffff | 2026-11-06: nothing | the card shows 21:1 and the four WCAG AA and AAA checks with a sample | implemented |
| 7 | convert markdown to html: **bold** | 2026-11-06: nothing | the converter opens with the text in it and shows `<strong>bold</strong>` | implemented |
| 8 | make a barcode for 12345 | 2026-11-06: a Python snippet | a Code 128 barcode is drawn in the page, with a box to change the text | implemented |
| 9 | spin a wheel with pizza tacos sushi | 2026-11-06: a Python snippet | the wheel opens with three entries: pizza, tacos, sushi | implemented |
| 10 | random word | 2026-11-06: article on random stimulus | the card gives a common English word and its part of speech | implemented |
| 11 | generate a random date | 2026-11-06: a Python snippet | the card gives a date, any day from 1970 to this year equally likely, and takes "between 1990 and 2000" | implemented |
| 12 | fibonacci sequence | 2026-11-06: an article that lists the first terms | the card lists the terms, exactly, and takes "first 50" | implemented |
| 13 | age calculator born 1990-05-01 | 2026-11-06: "34 years old as of May 2024", wrong today | the age calculator opens with the date filled in and today's age | implemented |
| 14 | discount 30% off 80 | 2026-11-06: 30% of 80 = 24 | the card says the price after the discount, 56, and the saving, 24 | implemented |
| 15 | fuel cost for 300 miles at 30 mpg | 2026-11-06: only 300 miles in km | the card says 10 gallons, and the cost when a price per gallon is given | implemented |
| 16 | make a table from a,b,c | 2026-11-06: raw Markdown pipes in a paragraph | a drawn table, with a box to add rows and copy as CSV or Markdown | implemented |
| 17 | alarm at 7am | 2026-11-06: nothing | an alarm card set for 7:00 that rings in the page | open |
| 18 | ring size chart | 2026-11-06: article on industrial back-up rings | a chart of US, UK, EU and Japan ring sizes with inside diameter in mm | open |
| 19 | country codes list | 2026-11-06: an explanation of the code systems | a searchable list of ISO 3166 codes and calling codes, from the published standard | open |
| 20 | gas mileage calculator | 2026-11-06: an explanation of mpg | a calculator: distance and fuel in, mpg and L/100 km out | implemented |
| 21 | currency converter 100 usd to eur | 2026-11-06: "rates change, check a live service" | the amount at a published reference rate, with the rate's date and source | open |
| 22 | inflation calculator 100 in 1990 | 2026-11-06: "I have no CPI values" | the value today from the published US CPI series, with the series named | open |
| 23 | how many calories do i burn running 3 miles | 2026-11-06: only 3 miles in km | an estimate from the MET formula with weight asked, the formula shown | open |
| 24 | times tables quiz | 2026-11-06: a Python script | a quiz in the page: questions, typed answers, a score | implemented |
| 25 | math quiz | 2026-11-06: article on a Ghana school competition | a quiz in the page with levels and a score | implemented |
| 26 | typing speed test | 2026-11-06: an explanation | a passage to type, words per minute and accuracy measured in the page | open |
| 27 | reaction time test | 2026-11-06: a definition | wait for the colour change, click, see the time in ms over five tries | implemented |
| 28 | click speed test | 2026-11-06: an explanation | clicks per second over 5 or 10 seconds | implemented |
| 29 | aim trainer | 2026-11-06: article on aim-trainer games | targets to click, with hits, misses and average time | implemented |
| 30 | white noise | 2026-11-06: article on the signal | white, pink and brown noise played in the page, with volume and a timer | implemented |
| 31 | rain sounds | 2026-11-06: article on an album | a rain sound made in the page from filtered noise, said to be made, not recorded | implemented |
| 32 | drum machine | 2026-11-06: an article | a step sequencer with kick, snare and hat drawn from synthesised sounds | open |
| 33 | periodic table | 2026-11-06: an article | the 118 elements in their grid, each with symbol, number and mass from IUPAC | open |
| 34 | text to speech hello world | 2026-10-30: a Python snippet | the words are read aloud by the browser's own voice, with a voice and rate to pick | open |
| 35 | speech to text | 2026-10-30: an article | dictation in the page where the browser supports it, the text to copy | open |
| 36 | record my voice | 2026-10-30: "I cannot record your voice" | a recorder in the page; the file stays on the device and can be saved | open |
| 37 | voice changer | 2026-11-06: an article | record or use the mic, pitch and effects applied in the page | open |
| 38 | play sudoku | 2026-11-06: "I cannot play Sudoku with you" | a new puzzle with one solution, notes, checks and three levels | open |
| 39 | play solitaire | 2026-11-06: an article | a playable Klondike with draw 1 or 3 and undo | open |
| 40 | play blackjack | 2026-11-06: "find a deck" | a playable hand against the dealer, no money | open |
| 41 | play trivia | 2026-11-06: "none of my sources answered" | questions from an openly licensed question set, credited, with a score | open |
| 42 | words with friends helper | 2026-10-30: not found | a word finder: letters in, playable words out from an open word list | open |
| 43 | spelling bee | 2026-11-06: article on competitions | a word is spoken by the browser, you type it, it is checked | open |
| 44 | numerology for my name | 2026-10-30: not found | the Pythagorean letter sum worked out step by step, said to be a tradition, not a science | open |
| 45 | tarot reading | 2026-10-30: an article | cards drawn at random from the 78, with their traditional meanings, said to be for fun | open |
| 46 | horoscope for leo | 2026-10-30: not found | the sign's dates, element and planet; no invented prediction | open |
| 47 | make a budget | 2026-11-06: how-to text | a budget table: income, lines, what is left, kept on the device | open |
| 48 | expense tracker | 2026-11-06: a definition | add expenses by category and see totals, kept on the device | open |
| 49 | net worth tracker | 2026-11-06: a definition | assets and debts in, net worth out, kept on the device | open |
| 50 | make a business card | 2026-11-06: a card about Verse itself | a card from your name, role and contact, to print or save as PNG | open |
| 51 | make a resume | 2026-11-06: how-to text | a resume form that becomes a clean page to print or save | open |

51 so far. The second set of live checks (104 more asks) is running; the list grows to 100 from what it sees fail.
