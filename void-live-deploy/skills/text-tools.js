/**
 * text-tools skill - "tools pack 9" (owner, 2026-10-18, a pasted list of simple text and editing things). One skill, one mode per ask:
 * "sort these lines: ...", "remove duplicate lines: ...", "extract emails: ...", "word frequency: ...", "wrap at 60: ...", "rot13 hello",
 * "slugify Hello World", "are listen and silent anagrams", "diff: first box --- second box", "date stamp", "random adjective" and the rest of the
 * table in lib/text-tools.js (a new transform is one line there). The answer is a card with the result and a copy button.
 * The text stays on the device: nothing is sent anywhere. Uppercase, lowercase, title case, reverse, palindrome, word and character count
 * are skills/util.js's (asked first); this skill never takes them.
 */
import { textToolOf, runTextTool, applyTool, esc } from '../lib/text-tools.js';

// 2026-11-06 (docs/GAPS.md): "remove duplicate lines" with no text gave nothing at all. A tool named on its own, like the sites that are only
// that tool (a box and a result), now opens the box: paste or type, and the result follows as you type. One word is a tool only when it can
// mean nothing else ("rot13", "slugify", "dedupe"); "frequency" alone is a word to look up.
const ONE_WORD = new Set(['rot13', 'slugify', 'dedupe', 'deduplicate', 'unwrap']);
/** the parsed tool (body empty) when the ask names a text tool and gives no text, else null. Pure. */
export function textToolByName(text) {
  const s = String(text || '').trim();
  if (!s || s.length > 60 || /[\n:⏎]/.test(s) || textToolOf(s)) return null;
  const words = s.toLowerCase().replace(/[?!.]+$/, '').split(/\s+/);
  if (/^(?:how|what|why|when|where|who|is|are|does|do|can|should)$/.test(words[0])) return null;
  if (words.some((w) => /^(?:the|my|this|that|these|those|it)$/.test(w))) return null; // "sort the list" is a list already on the stage (skills/list-tools.js)
  if (words.length === 1 && !ONE_WORD.has(words[0])) return null;
  const p = textToolOf(s.replace(/[?!.]+$/, '') + '\nx');
  return p ? { ...p, body: '' } : null;
}

function run(text, api) {
  const { showPage } = api;
  const r = runTextTool(text);
  if (!r) { const named = textToolByName(text); return named ? toolBox(named, api) : 'none'; }
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

// the tool as a box: the result is worked out here, in the page, on every keystroke (applyTool is pure), and nothing is sent anywhere
function toolBox(parsed, api) {
  const el = api.showPage((p) => {
    p.innerHTML = '<h2>' + esc(parsed.title) + '</h2><textarea class="tt-in" rows="6" maxlength="50000" placeholder="Paste or type the text here" aria-label="Text" style="display:block;width:100%;box-sizing:border-box;resize:vertical;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:inherit;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 8px"></textarea>'
      + '<pre class="tt-out" style="white-space:pre-wrap;word-break:break-word;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(255,255,255,.06);padding:10px 12px;border-radius:10px;margin:8px 0;max-height:46vh;overflow:auto"></pre><button type="button" class="tr-copy tt-copy">copy</button>'
      + '<p class="tt-note" style="color:#8a8a8a;margin:8px 0 0"></p><div class="src">Made in your browser · the text is not sent anywhere</div>';
  });
  const q = (c) => el && el.querySelector && el.querySelector(c), box = q('.tt-in'), out = q('.tt-out'), note = q('.tt-note'), b = q('.tt-copy');
  const paint = () => { if (!box || !out) return; const r = box.value.trim() ? applyTool({ ...parsed, body: box.value }) : null; out.textContent = r ? r.text || '' : ''; if (note) note.textContent = r ? r.note || '' : ''; };
  if (box) box.addEventListener('input', paint);
  if (b) b.addEventListener('click', async () => { let ok = false; try { await navigator.clipboard.writeText(out ? out.textContent : ''); ok = true; } catch (_) {} b.textContent = ok ? 'copied' : 'select it to copy'; setTimeout(() => { b.textContent = 'copy'; }, 1600); });
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
    'are listen and silent anagrams',
    'remove duplicate lines',
    'extract emails'
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
  match(lower, text) { return !!textToolOf(text) || !!textToolByName(text); },
  run
};
