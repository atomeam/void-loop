// "New from Verse" on the store (owner audit, 2026-11-19: "the store API answering an empty body" and "unreachable: Unexpected end of JSON input" read as
// code to a shopper). The changelog keeps its lines as written (AGENTS.md); the page reads them through plainWhat(). Pure, no DOM.
const MB = (n) => (Number(n) >= 0.05 ? Number(n).toFixed(1) + ' MB' : 'under 0.1 MB');
/** one changelog line in plain words for a shopper. */
export function plainWhat(what) {
  const t = String(what || '').replace(/\bV01D\b/g, 'Verse').trim();
  if (/^republished:/i.test(t)) return 'Back in the store. It was taken down by mistake during a short outage on our side; the download itself was fine.';
  if (/^unpublished automatically:/i.test(t)) return 'Taken down for now because its download could not be reached when the store checked it.';
  const m = /^published by (?:Verse|V01D): (\d+) files?, ([\d.]+) MB(?: \(paid: [^)]*\))?/i.exec(t);
  if (m) return 'Added to the store: ' + m[1] + (m[1] === '1' ? ' file, ' : ' files, ') + MB(m[2]) + (/\(paid:/i.test(t) ? '. Not for sale yet.' : '.');
  return t;
}
/** true when a line still reads as code (an error message, an API name, a JSON word): the test keeps these out of the page. */
export const jargon = (s) => /\b(?:JSON|API|unreachable|empty body|fetch failed|undefined|null|HTTP|\d{3} error)\b/i.test(String(s || ''));
