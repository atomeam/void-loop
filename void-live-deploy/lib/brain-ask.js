// brain-ask: the asks that open Verse Brain full screen (/brain/): "full screen brain", "show me your brain full screen", "open verse brain".
// One table for the stage (skills/verse-brain.js shows a card that links there) and the tool pages' ask box (lib/toolkit.js routeAsk goes
// there itself). Pure. Tests: tools/brain-page.test.mjs.
export const BRAIN_FULL = /^(?:(?:show|open|give)\s+(?:me\s+)?)?(?:(?:the|your|verse'?s)\s+)?(?:verse\s+)?(?:brain|mind)\s+(?:in\s+)?full\s?-?screen$|^(?:(?:show|open)\s+(?:me\s+)?)?(?:a\s+|the\s+)?full\s?-?screen\s+(?:verse\s+)?brain$|^open\s+(?:the\s+)?verse\s+brain$/i;
/** true when the ask is one of them (trailing punctuation, extra spaces and a "please" do not count). Pure. */
export const brainFullAsk = (t) => BRAIN_FULL.test(String(t || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').replace(/\s+please$/i, ''));
