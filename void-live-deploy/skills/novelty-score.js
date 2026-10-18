/**
 * novelty-score skill — idea-bank #94 (genuinely unclaimed utility/growth).
 * "novelty score for this idea", "how novel is this idea", "score the novelty of this".
 * Pure local heuristic from the ask text (length, rare words, specificity). No network.
 * Empty surface stays empty until matched.
 * Registered via skills/order/ only; do not hand-edit skills/index.json.
 */

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

/** Parse → { idea: string } or null. */
export function noveltyOf(text) {
  const t = CLEAN(text);
  let m = t.match(/^(?:(?:give\s+(?:me\s+)?)?(?:a\s+)?)?novelty\s+score\s+(?:for\s+)?(?:this\s+)?(?:idea\s+)?(?:[:\-–]\s*)?(.+)$/);
  if (!m) m = t.match(/^how\s+novel\s+is\s+(?:this\s+)?(?:idea\s+)?(?:[:\-–]\s*)?(.+)$/);
  if (!m) m = t.match(/^score\s+(?:the\s+)?novelty\s+of\s+(?:this\s+)?(?:[:\-–]\s*)?(.+)$/);
  if (!m) {
    // bare: "novelty score for X" already covered; also "novelty score" alone
    if (/^novelty\s+score$/.test(t) || /^how\s+novel\s+is\s+this(?:\s+idea)?$/.test(t)) {
      return { idea: '' };
    }
    return null;
  }
  const idea = (m[1] || '').replace(/^(?:this\s+idea|this|it)\s*/, '').trim();
  return { idea };
}

/** Stable 0–100 score from idea text. Pure. */
export function scoreIdea(idea) {
  const s = String(idea || '').trim();
  if (!s) return { score: 0, band: 'none', reasons: ['no idea text yet · add the idea after the ask'] };

  const words = s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const unique = new Set(words);
  const len = s.length;
  const wordCount = words.length;

  // specificity: longer + more unique words
  let score = 20;
  score += Math.min(25, Math.floor(len / 8));
  score += Math.min(20, unique.size * 2);
  score += Math.min(15, wordCount);

  // rare-ish tokens (not stopwords)
  const stop = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'is', 'this', 'that', 'with', 'my', 'me', 'i', 'it']);
  const rare = words.filter((w) => w.length > 5 && !stop.has(w));
  score += Math.min(15, rare.length * 3);

  // punctuation / structure hints at a worked idea
  if (/[0-9]/.test(s)) score += 3;
  if (/[:\-–]/.test(s)) score += 2;
  if (wordCount >= 6) score += 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let band = 'familiar';
  if (score >= 75) band = 'striking';
  else if (score >= 55) band = 'fresh';
  else if (score >= 35) band = 'mixed';
  else if (score >= 15) band = 'common';

  const reasons = [];
  if (unique.size >= 8) reasons.push('many distinct words');
  if (rare.length >= 3) reasons.push('specific vocabulary');
  if (len < 20) reasons.push('very short · add more detail to raise the score');
  if (wordCount >= 10) reasons.push('full sentence shape');
  if (!reasons.length) reasons.push('baseline from length and word variety');

  return { score, band, reasons };
}

async function run(text, api) {
  const want = noveltyOf(text);
  if (!want) return 'none';

  const { showPage, esc, say } = api;
  const result = scoreIdea(want.idea);

  if (!want.idea) {
    if (say) say('add the idea after the ask · e.g. novelty score for a stage that mutates kept cards');
    if (showPage) {
      showPage((p) => {
        p.innerHTML =
          '<h2>Novelty score</h2>' +
          '<p class="sub">Local heuristic · nothing leaves this browser</p>' +
          '<p>Say <em>novelty score for …</em> and include the idea in the same ask.</p>' +
          '<div class="src">Idea-bank #94 · empty surface stays empty</div>';
      });
    }
    return 'novelty-score';
  }

  if (showPage) {
    showPage((p) => {
      p.innerHTML =
        '<h2>Novelty score</h2>' +
        '<p class="sub">' + esc(want.idea.slice(0, 120)) + '</p>' +
        '<p style="font-size:2rem;margin:12px 0"><strong>' + result.score + '</strong> / 100 · ' + esc(result.band) + '</p>' +
        '<ul>' + result.reasons.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ul>' +
        '<div class="src">Pure local score · not a model judgment · idea-bank #94</div>';
    });
  } else if (say) {
    say(result.score + ' / 100 · ' + result.band);
  }
  return 'novelty-score';
}

export default {
  name: 'novelty-score',
  examples: [
    'novelty score for this idea',
    'how novel is this idea',
    'score the novelty of this',
    'novelty score for a stage that mutates kept cards',
  ],
  nearMisses: [
    'what is novelty',
    'family gravity',
    'skill gravity map',
    'novelty shop near me',
    'score a goal',
  ],
  match(lower, text) {
    return !!noveltyOf(text || lower);
  },
  run,
  noveltyOf,
  scoreIdea,
  suite() {
    const a = noveltyOf('novelty score for a stage that mutates kept cards');
    const b = noveltyOf('how novel is this idea');
    const c = noveltyOf('what is novelty');
    const s = scoreIdea('a stage that mutates kept cards every night');
    return {
      ok:
        !!a && a.idea.includes('mutates') &&
        !!b &&
        c === null &&
        s.score >= 20 && s.score <= 100,
    };
  },
};
