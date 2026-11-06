# Gaps: asks Verse was seen to fail on

Owner, 2026-10-30: "come up with 100 things verse still cant do and add them all".

A gap is on this list only when someone typed the ask at https://a-to-mind.com/?q=... and saw it fail: an article about the thing instead of the thing, a code snippet, a wrong answer, or nothing. A guess about what might fail is not a gap.

Rank is smallest and highest value first: a pure card in the page before a page with a game, before anything that needs outside data. Each gap is built with a test, merged on a green main, and checked live again at the same address.

Evidence states, in order: **open** (seen failing, not built), **implemented** (code and test on a branch), **merged** (on main), **deployed** (on a-to-mind.com), **verified live** (the same ask, typed again, does the thing).

Not on the list, by rule: recreations of a named game (wordle, tetris), tests that need an invented score or make a medical claim (iq test, personality test, color blindness test, hearing test), and fake card numbers. These were seen failing too, and stay out on purpose.

Seen: what the live answer was, and the day. Batch 1 is in `tools/gaps-batch1.test.mjs` and `tools/my-device.test.mjs`; batch 2 in `tools/gaps-batch2.test.mjs`; batch 3 in `tools/gaps-batch3.test.mjs`.

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
| 17 | alarm at 7am | 2026-11-06: nothing | an alarm card set for 7:00 that rings in the page | implemented |
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
| 52 | word counter for essay | 2026-11-06: an explanation | the word counter opens, the same as "word counter" | implemented |
| 53 | grocery list | 2026-11-06: nothing | a list card on the stage that takes items and ticks them off | open |
| 54 | strikethrough text | 2026-11-06: an article on the character | the text comes back with combining strokes, ready to copy | open |
| 55 | upside down text | 2026-11-06: an article on the effect | the text comes back flipped from a mapping table, ready to copy | open |
| 56 | small caps text | 2026-11-06: nothing | the text in Unicode small capitals, letters with no small capital left as they are | open |
| 57 | bubble text | 2026-11-06: article on contrast ultrasound | the text in circled Unicode letters, ready to copy | open |
| 58 | zalgo text | 2026-11-06: an article on the effect | the text with combining marks, a slider for how many | open |
| 59 | invisible character | 2026-11-06: a disambiguation card | the blank characters (U+200B, U+3164, U+2800) with a copy button for each and what each is | open |
| 60 | text art big letters hello | 2026-11-06: nothing | the words in big block letters drawn from a font grid, ready to copy | open |
| 61 | phonetic alphabet | 2026-11-06: a disambiguation card | the NATO and ICAO spelling alphabet, and the words spelled out letter by letter | open |
| 62 | html color names | 2026-11-06: an explanation | the named colours of the CSS Color specification, each with its swatch and hex, searchable | open |
| 63 | box shadow generator | 2026-11-06: how-to text | sliders for offset, blur, spread and colour, a live sample, the CSS to copy | open |
| 64 | border radius generator | 2026-11-06: how-to text | a corner for each radius, a live sample, the CSS to copy | open |
| 65 | css grid generator | 2026-11-06: how-to text | columns, rows and gap set in boxes, a drawn grid, the CSS to copy | open |
| 66 | flexbox playground | 2026-11-06: article on pyrimidine dimers | the flex options as buttons, boxes that move live, the CSS to copy | open |
| 67 | favicon generator | 2026-11-06: article on the Ford Falcon | a letter or emoji and colours in, a favicon drawn in the page, saved as PNG and ICO | open |
| 68 | cat age calculator | 2026-11-06: an explanation | a cat's age in human years from a published life-stage chart, the chart named | open |
| 69 | meditation timer | 2026-11-06: an explanation | a timer that rings a soft bell at the start, the end and at a chosen interval | open |
| 70 | 7 minute workout | 2026-11-06: "not found" and an album | the 12 exercises of the published routine on a timer, 30 seconds each with 10 between, the source named | open |
| 71 | water reminder | 2026-11-06: an explanation | a reminder in the page at the chosen interval while it is open, with a count of glasses | open |
| 72 | habit tracker | 2026-11-06: an explanation | habits as rows and days as columns, ticks kept on the device | open |
| 73 | chore chart | 2026-11-06: an article on the idea | chores by person and day, ticks kept on the device, printable | open |
| 74 | allowance tracker | 2026-11-06: an explanation | money in and out per child, the balance, kept on the device | open |
| 75 | time sheet | 2026-11-06: an article on timesheets | start and end times for each day, breaks taken off, the week's total hours | open |
| 76 | shift schedule maker | 2026-11-06: an explanation | people and shifts on a week grid, hours per person, printable | open |
| 77 | final exam grade needed | 2026-11-06: an explanation | current grade, exam weight and target in, the exam score needed out, worked out | open |
| 78 | event countdown | 2026-11-06: an explanation | a countdown card to the date the ask names, days to seconds | open |
| 79 | random team generator | 2026-11-06: an explanation | names in, split at random into the number of teams asked for | open |
| 80 | secret santa draw | 2026-11-06: an explanation | names in, a draw where nobody gets themselves, each pairing shown one at a time | open |
| 81 | tournament bracket | 2026-11-06: an article on brackets | names in, a single elimination bracket with byes, winners picked by clicking | open |
| 82 | keyboard tester | 2026-11-06: an explanation | a keyboard drawn in the page, each key lights when pressed, the key code shown | open |
| 83 | mouse tester | 2026-11-06: an explanation | each button, the wheel and double clicks shown as they happen | open |
| 84 | dead pixel test | 2026-11-06: article on defective pixels | full screen colours to step through with a click, said to be a visual check | open |
| 85 | webcam test | 2026-11-06: an explanation | the camera shown in the page after the browser asks, its resolution read, nothing sent | open |
| 86 | microphone test | 2026-11-06: a disambiguation card | a level meter from the mic after the browser asks, a playback of 5 seconds, nothing sent | open |
| 87 | screen recorder | 2026-11-06: an article on screen recorders | the browser's screen capture, recorded in the page, saved as a file on the device | open |
| 88 | battery status | 2026-11-06: article on grid storage | the battery level and charging state where the browser gives them, and says so where it does not | open |
| 89 | online notepad | 2026-11-06: "none of my sources answered" | a note box that keeps its text on the device, with a word count and a save as file | open |
| 90 | whiteboard | 2026-11-06: an article on whiteboards | a canvas to draw on with pens, an eraser, undo and save as PNG | open |
| 91 | flowchart maker | 2026-11-06: an explanation | boxes and arrows drawn from typed lines like "start -> check -> end", saved as SVG | open |
| 92 | svg editor | 2026-11-06: an explanation | SVG code and its drawing side by side, each updating the other's view | open |
| 93 | code editor | 2026-11-06: an article on code editors | an editor with line numbers and colouring for HTML, CSS and JavaScript, with a live preview | open |
| 94 | sql formatter | 2026-11-06: an explanation | pasted SQL comes back indented with keywords in capitals | open |
| 95 | xml to json | 2026-11-06: an explanation | pasted XML comes back as JSON, with the error line when it does not parse | open |
| 96 | html to markdown | 2026-11-06: an explanation | pasted HTML comes back as Markdown | open |
| 97 | encrypt a message | 2026-11-06: an explanation | a message and a passphrase in, AES-GCM text out, and the same card decrypts it; nothing sent | open |
| 98 | make a strong passphrase | 2026-11-06: an explanation | words picked in the page from the EFF long word list, the list credited, with the entropy in bits | open |
| 99 | generate an ssh key | 2026-11-06: an explanation | an Ed25519 key pair made in the page with Web Crypto, saved as files, said never to leave the device | open |
| 100 | two factor code | 2026-11-06: nothing | a TOTP code from a pasted secret by RFC 6238, worked out in the page, the secret not kept | open |

100 gaps. The second live check typed 209 asks; 129 of them failed. Failures that need outside data (whois, dns, ping, a site's status, link safety, plagiarism, tax tables) or that other threads own are left off this list.
