# A red browser check on main

What starts it: Verse verify on main fails a browser-suite section, and the site test is still green. Catch-up closes the tracking issue only when both are green. One helper pull request, the section that failed, nothing else.

## What to read

The job log, not the summary. `gh run view <run-id> --repo atomeam/void-loop --log-failed` and the check's own JSON. The geometry is the bug: a card bottom and a dock top, a chip that moved, a millisecond.

## Three that kept failing the same way

- **A panel that meets the ask bar.** The panel is fitted, then `say()` wraps a line under the bar and the dock grows. The resize observer fixes it on the next frame. The suite reads the panel in the same turn, before that frame (#2250, phone 390×800, card bottom 652, dock top 647). Fit again in `say()`, in that turn, and measure the border box after the "more" fade.

- **A drag whose chip is not where it was measured.** The walkthrough bar is placed before the step's thing has an id, so it sits on the bottom, then jumps to the side once the thing is known. A slow runner measures the chip in that gap (`ghost: false`, `dropped: ""`). Place when the new thing is in the stage, and do not place again on the way out. Do not `setPointerCapture` on the chip: a re-place cancels the pointer.

- **A sum that waits for the skill lanes.** "how much is 5 dollars a day for a year" is the page's own calculator. It still waited out the fuzzy vocabulary and the files above a match: 4022 ms on run 42036332040, note `calc`, the answer already right. Answer that kind of ask before any await. Leave a loan payment on the loan skill. Do not raise the 4 second line.

## How to tell it worked

`VOID_TEST_BROWSER` pointed at Chrome, then the section: `node tools/test_void.mjs --only "<the heading words>"`. For the panel, the first sample (not a sample a frame later) has the card bottom above the dock. For the drag, the chip's centre does not move between the moment the new thing is saved and a quarter second later. For the sum, four asks in parallel with 80 ms per skill file, each under 4 s, the loan one still `skill:loan`.

## Mistakes

Sampling after a frame and calling the race fixed. Keeping `setPointerCapture` after moving the listeners to the window. Slowing the assertion instead of the wait.
