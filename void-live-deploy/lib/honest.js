// Zero lies in Verse's own words (the owner, 2026-10-12: "its also lying aboout it being the most frequent . we have a 0 lie policy").
// The will's model writes each want's reason, but it only sees a ranked list, so a sentence that ranks, counts or generalises
// ("the most frequent thing people ask", "everyone wants", "always") is a claim it cannot back. Such a sentence is replaced by the
// fact the candidate came with (how many times it was asked and when, which list it is on); a plain reason stays in Verse's words.
export const CLAIM_RE = /\b(?:most|least|top|biggest|largest|highest|lowest|best|worst|every(?:one|body|thing)?|always|never|nobody|no one|all (?:the )?(?:people|users|visitors)|frequent(?:ly)?|common(?:ly)?|popular|usually|often|rarely|majority|minority|percent|times)\b|\d/i;

/** the reason a want shows: Verse's sentence when it claims nothing it cannot back, else the recorded fact. Pure. */
export function honestBecause(said, fact) {
  const s = String(said || '').trim(), f = String(fact || '').trim();
  if (s && !CLAIM_RE.test(s)) return s;
  return f || 'it is on my list of open work';
}
