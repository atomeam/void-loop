/**
 * reading-time skill — estimate how long it takes to read a piece of text.
 * "how long to read this: [text]", "reading time for this text", "reading time".
 * Uses ~200 words per minute for average adult reading. Empty surface stays empty.
 */
export function wordsOf(text) {
  const t = String(text || '').trim();
  const m = t.match(/^(?:how long to read(?: this)?|reading time(?: for this text)?)[:\s]+(.+)$/is);
  return m ? m[1].trim() : null;
}

export function estimate(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return { words, minutes };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const body = wordsOf(text);
  if (!body) {
    showPage((el) => {
      el.innerHTML = '<h2>Reading time</h2><p>Paste the text after the ask, like “reading time for this text: once upon a time…”</p>';
    });
    return 'reading-time';
  }
  const { words, minutes } = estimate(body);
  showPage((el) => {
    el.innerHTML = '<h2>Reading time</h2><p>' + esc(words + ' words · about ' + minutes + ' minute' + (minutes === 1 ? '' : 's') + ' at 200 wpm') + '</p><div class="src">Average adult reading speed</div>';
  });
  return 'reading-time';
}

export default {
  name: 'reading-time',
  examples: ['how long to read this', 'reading time for this text: hello world this is a short note', 'reading time'],
  nearMisses: ['read this book', "what's the time", 'how long until new year'],
  match(lower, text) { return !!wordsOf(text) || /^(?:how long to read this|reading time)$/i.test(lower.trim()); },
  run,
  suite() {
    return { ok: estimate('one two three four five').words === 5 && wordsOf('reading time for this text: hello') === 'hello' };
  },
};
