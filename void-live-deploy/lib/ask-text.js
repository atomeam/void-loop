/**
 * ask-text — the one place an ask is tidied before a skill matches it (convergence step 1, docs/convergence.md).
 * Twenty-three skills each kept their own copy of these two lines; they now import them from here.
 *   clean(s):      trim, drop trailing ? ! ., collapse spaces       ("  Show   me X?! " -> "Show me X")
 *   cleanLower(s): the same, lower-cased                             ("  Show   me X?! " -> "show me x")
 */
export const clean = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
export const cleanLower = (s) => clean(s).toLowerCase();
