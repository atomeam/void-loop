/**
 * void-fact skill — a short true fact about Void, picked at random.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a Void fact", "void fact", "what is a fact about void".
 * Empty surface stays empty.
 */
const FACTS = [
  'Void is a blank stage where anything someone asks for appears.',
  'Void lives at a-to-mind.com and grows through skills that anyone can summon.',
  'Every skill in Void has examples, near misses, a match function and a run function.',
  'Void reads its own growth ledger to show how it has grown, newest first.',
  'Void asks for its own improvements every day at 2:09 PM New York time.',
  'The growth inbox collects ideas, but the frontier is the build order.',
  'Skills are registered in skills/index.json and ordered by files in skills/order/.',
  'Void never deletes an open or building row in the growth inbox.',
];

export function isVoidFact(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:tell\s+me\s+(?:a\s+)?|give\s+me\s+(?:a\s+)?|show\s+(?:me\s+)?(?:a\s+)?|what\s+is\s+(?:a\s+)?)?(?:void|v01d)\s+fact(?:\s+please)?$/.test(t) || /^void\s+fact$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!isVoidFact(text)) return 'none';
  const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
  showPage((p) => {
    p.innerHTML = '<h2>A Void fact</h2><p style="font-size:20px;line-height:1.45">' + esc(fact) + '</p><div class="sub">say “void fact” for another</div>';
  });
  return 'void-fact';
}

export default {
  name: 'void-fact',
  examples: ['tell me a Void fact', 'void fact', 'give me a void fact'],
  nearMisses: ['what is void', 'void facts history', 'how does void work'],
  match(lower, text) { return isVoidFact(text); },
  run,
  suite() {
    return { ok: isVoidFact('void fact') && !isVoidFact('what is void') && FACTS.length > 0 };
  },
};
