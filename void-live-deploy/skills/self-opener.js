/**
 * self-opener skill — answers "open the self card" with the self card's own words instead of a model fallback.
 * Asks: "open the self card", "show the self card", "what is the self card".
 * Shows a short self summary from known facts; nothing fetched beyond the page.
 * Empty stage stays empty until asked.
 */
export function selfOpenerOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:open|show|summon|give me)\s+(?:the\s+)?self\s+card$|^self\s+card$|^what\s+is\s+(?:the\s+)?self\s+card$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  showPage((p) => {
    p.innerHTML = '<h2>Self card</h2>'
      + '<p>Verse is an agent that grows skills from use, lives at a-to-mind.com, and keeps a growth ledger of every change.</p>'
      + '<div class="sub">The self card opens here with its own words. The answer endpoint no longer falls back to saying it cannot open one.</div>';
  });
  return 'self-opener';
}

export function suite() {
  return selfOpenerOf('open the self card') && selfOpenerOf('show the self card') && !selfOpenerOf('growth');
}

export default {
  name: 'self-opener',
  examples: ['open the self card', 'show the self card', 'self card', 'what is the self card'],
  nearMisses: ['growth', 'how have you grown', 'what can you do'],
  match(lower, text) { return selfOpenerOf(text); },
  run,
  suite,
};
