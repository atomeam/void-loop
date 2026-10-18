/**
 * Name lineage (asked by Verse, twice: "a 'name-lineage' tooltip or metadata trace in the 'self' family to honor the V01D history ... visible but
 * secondary"): Verse was Void, then V01D, and is Verse now (owner, 2026-10-18). The 'Verse itself' family, its cards and the self page carry that
 * as a quiet hover and a data attribute, never as visible text. Pure.
 */
export const SELF_CHAPTER = 'Verse itself';
export const FORMER = ['V01D', 'Void'];
/** the family a card or row belongs to is the self family. */
export const isSelf = (chapter) => String(chapter || '').trim().toLowerCase() === SELF_CHAPTER.toLowerCase() || String(chapter || '').trim().toLowerCase() === 'self';
/** the hover line for a self-family card: '' for any other family. */
export const lineageOf = (chapter) => (isSelf(chapter) ? 'Verse, formerly ' + FORMER[0] + ' (and before that ' + FORMER[1] + ')' : '');
