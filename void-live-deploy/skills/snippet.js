/**
 * snippet skill — a short Python function the ask names, written on the card. No model and no network.
 * "write a python function factorial of n", "a python function that reverses a string".
 * A bare "code" says there is more than one thing it could mean.
 */
const FACTORIAL = 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n';
const REVERSE = 'def reverse(s):\n    return s[::-1]\n';

/** { kind: 'factorial'|'reverse'|'which' } or null. Pure. */
export function snippetOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t || t.length > 180) return null;
  if (/^(?:code|coding|program(?:ming)?)$/i.test(t)) return { kind: 'which' };
  // "what is 7 factorial", "factorial of 10": a number to work out, which the page's calculator answers (5,040); the code card is for an ask about the function
  if (/\b\d+\s*factorial\b|\bfactorial\s+of\s+\d+\b/i.test(t) && !/python|function|funci[oó]n|\bdef\b|\bcode\b|\breturn\b|\bwrite\b|\bimplement/i.test(t)) return null;
  if (/factorial/i.test(t)) return { kind: 'factorial' };
  if (/(?:reverse|invierta|invertir)/i.test(t) && /python|function|funci[oó]n|string|texto|text/i.test(t)) return { kind: 'reverse' };
  return null;
}

function run(text, api) {
  const q = snippetOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  showPage((el) => {
    el.dataset.cardKind = 'Code';
    if (q.kind === 'which') {
      el.innerHTML = '<h2>Code</h2><p>That can mean several things. Which one: a Python function, an HTTP status, or a formatter?</p>';
      return;
    }
    const src = q.kind === 'factorial' ? FACTORIAL : REVERSE;
    const note = q.kind === 'factorial' ? 'factorial(0) and factorial(1) return 1. factorial(5) is 120.' : 'reverse("ab") is "ba".';
    el.innerHTML = '<h2>' + q.kind + '</h2><pre><code>' + esc(src) + '</code></pre><p>' + esc(note) + '</p><div class="src">Written on this device. Nothing is sent away.</div>';
  });
  return 'snippet';
}

export default {
  name: 'snippet',
  examples: ['write a python function factorial of n', 'write a python function reverse that reverses a string', 'code'],
  nearMisses: ['http status 404', 'what is code', 'dress code', 'zip code 10001', 'country code for france', 'what is 7 factorial', "what's 10 factorial", 'factorial of 5'],
  match(lower, text) { return !!snippetOf(text || lower); },
  run,
};
