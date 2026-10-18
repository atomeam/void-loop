/**
 * text-tools skill - "tools pack 9" (owner, 2026-10-18, a pasted list of simple text and editing things). One skill, one mode per ask:
 * "sort these lines: ...", "remove duplicate lines: ...", "extract emails: ...", "word frequency: ...", "wrap at 60: ...", "rot13 hello",
 * "slugify Hello World", "are listen and silent anagrams", "diff: first box --- second box", "date stamp", "random adjective" and the rest of the
 * table in lib/text-tools.js (a new transform is one line there). The answer is a card with the result and a copy button.
 * The text stays on the device: nothing is sent anywhere. Uppercase, lowercase, title case, reverse, palindrome, word and character count
 * are skills/util.js's (asked first); this skill never takes them.
 */
import { textToolOf, runTextTool, esc } from '../lib/text-tools.js';

function run(text, api) {
  const { showPage } = api;
  const r = runTextTool(text);
  if (!r) return 'none';
  let el;
  const out = r.text || '';
  el = showPage((p) => {
    p.innerHTML = '<h2>' + esc(r.title) + '</h2>'
      + (r.preview ? '<div class="tt-preview" style="margin:8px 0;line-height:1.6">' + r.preview + '</div>' : '')
      + (out ? '<pre class="tt-out" style="white-space:pre-wrap;word-break:break-word;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(255,255,255,.06);padding:10px 12px;border-radius:10px;margin:8px 0;max-height:46vh;overflow:auto">' + esc(out) + '</pre><button type="button" class="tr-copy tt-copy">copy</button>' : '')
      + (r.note ? '<p class="tt-note" style="color:#8a8a8a;margin:8px 0 0">' + esc(r.note) + '</p>' : '')
      + '<div class="src">Made in your browser · the text is not sent anywhere</div>';
  });
  const b = el && el.querySelector && el.querySelector('.tt-copy');
  if (b) b.addEventListener('click', async () => { let ok = false; try { await navigator.clipboard.writeText(out); ok = true; } catch (_) {} b.textContent = ok ? 'copied' : 'select it to copy'; setTimeout(() => { b.textContent = 'copy'; }, 1600); });
  return 'text-tools';
}

export default {
  name: 'text-tools',
  examples: [
    'sort these lines: pear ⏎ apple ⏎ fig',
    'remove duplicate lines: a ⏎ b ⏎ a',
    'extract emails: write to bob@example.com or ann@example.org',
    'word frequency: the cat and the dog',
    'rot13 hello world',
    'slugify Hello World',
    'are listen and silent anagrams'
  ],
  nearMisses: [
    'what is rot13',
    'sort my life out',
    'how do I remove duplicate lines in excel',
    'extract the juice from a lemon',
    'uppercase letters in spanish',
    'what is an anagram',
    'rot13 is a cipher',
    'word frequency in english'
  ],
  match(lower, text) { return !!textToolOf(text); },
  run
};
