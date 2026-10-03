/**
 * share skill — a link to this card (plan item 10, shared Voids)
 * Uses the share target already on Void (?share_text=). Does not publish, rename, or send.
 * "share this card", "share this card: rain in Lisbon".
 */
export function shareOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:please\s+)?(?:share|copy\s+a\s+link\s+(?:to|for))\s+(?:this|the\s+open)\s+card(?:\s*:\s*(.{1,240}))?$/i);
  if (!m) return null;
  return { words: (m[1] || '').trim() };
}

export function shareLink(text) {
  const hit = shareOf(text);
  if (!hit) return null;
  if (!hit.words) return 'https://a-to-mind.com/?share_text=';
  return 'https://a-to-mind.com/?share_text=' + encodeURIComponent(hit.words);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const hit = shareOf(text);
  if (!hit) return 'none';
  const href = shareLink(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Share this card</h2>'; });
  const body = hit.words
    ? '<p>Anyone with this link opens the same words in Void. Nothing is published and nothing is sent.</p><p><a href="' + esc(href) + '">' + esc(href) + '</a></p>'
    : '<p>No words on this card yet. Say share this card: and the words, and the link carries only those.</p>';
  el.innerHTML = '<h2>Share this card</h2>' + body
    + '<div class="src">Uses the share target already on Void. Not a published page.</div>';
  return 'share';
}

export default {
  name: 'share',
  examples: ['share this card', 'share this card: rain in Lisbon', 'copy a link to this card', 'share the open card', 'please share this card: a kept note'],
  nearMisses: ['publish this card', 'rename this card', 'share the whole stage', 'what is a share'],
  shareLink,
  match(lower, text) { return !!shareOf(text); },
  run
};
