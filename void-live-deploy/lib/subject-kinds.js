// The subject-kind table (owner, 2026-10-26: "it should do that with all things like that"). One row per kind of thing a card can be about; Verse extends the
// table, not an if-chain. The kind itself is read from the fetched description (lib/card-kinds.js KINDS), never from a word in the ask. Each row says:
//   theme   the card's frame (CSS in lib/card-frame.js, data-theme): collectible (blister pack), postcard, sleeve, portrait, cinema, specimen, plain
//   badges  facts that become small badges, each read from the ANSWER'S OWN TEXT with a regex; a badge whose fact is not in the text is not shown
//   art     what the picture is drawn from: 'motif' (the answer's nouns), or a fixed neutral drawing; a real person is never drawn as a likeness
//   photo   the free-pictures kind (lib/free-pics.js) to ask for a real, licensed picture of the subject, with its credit; absent = Verse draws it (a fictional character, a real person's neutral plate)
//   notice  true when the card is about someone else's work: it carries "A Verse card · not affiliated with ..." (no logos, no trade dress, ever)
// Badge patterns capture one group. Pure data; badgesOf() applies it.
const YEAR = /\b((?:1[5-9]|20)\d\d)\b/;
export const SUBJECT_KINDS = {
  Character: { theme: 'collectible', art: 'motif', notice: true, badges: [['Voice', /\bvoiced by ((?:[A-Z]\. )*[A-Z][\w'-]+(?: [A-Z][\w'-]+){0,2})/], ['Debut', /\b(?:debut(?:s|ed)?|first appear(?:s|ed|ance)?)[^."“]{0,40}["“]([^"”]{2,40})["”]/], ['Played by', /\b(?:played|portrayed) by ((?:[A-Z]\. )*[A-Z][\w'-]+(?: [A-Z][\w'-]+){0,2})/]] },
  Episode: { theme: 'cinema', art: 'motif', notice: true, badges: [['Aired', YEAR], ['Directed', /\bdirected by ((?:[A-Z]\. )*[A-Z][\w'-]+(?: [A-Z][\w'-]+){0,2})/]] },
  Film: { theme: 'cinema', art: 'motif', notice: false, badges: [['Year', YEAR], ['Director', /\bdirected by ((?:[A-Z]\. )*[A-Z][\w'-]+(?: [A-Z][\w'-]+){0,2})/]] },
  Show: { theme: 'cinema', art: 'motif', notice: false, badges: [['Began', YEAR], ['Created', /\bcreated by ((?:[A-Z]\. )*[A-Z][\w'-]+(?: [A-Z][\w'-]+){0,2})/]] },
  Song: { theme: 'sleeve', art: 'motif', notice: false, badges: [['Year', YEAR], ['By', /\b(?:by|from) ((?:[A-Z]\. )*[A-Z][\w'&-]+(?: [A-Z][\w'&-]+){0,3})/]] },
  Album: { theme: 'sleeve', art: 'motif', notice: false, badges: [['Year', YEAR], ['By', /\b(?:by|from) ((?:[A-Z]\. )*[A-Z][\w'&-]+(?: [A-Z][\w'&-]+){0,3})/]] },
  Band: { theme: 'sleeve', art: 'motif', notice: false, badges: [['Formed', /\bformed\b[^.;]{0,50}?\b((?:1[5-9]|20)\d\d)\b/]] },
  Book: { theme: 'plain', art: 'motif', notice: false, badges: [['Year', YEAR], ['Author', /\b(?:written )?by ((?:[A-Z]\. )*[A-Z][\w'-]+(?: [A-Z][\w'-]+){0,2})/]] },
  Game: { theme: 'plain', art: 'motif', notice: false, badges: [['Year', YEAR]] },
  Person: { theme: 'portrait', art: 'silhouette', notice: false, badges: [['Born', /(?<![-\w])born\b[^.;)]{0,40}?\b((?:1[5-9]|20)\d\d)\b/], ['Known for', /\bis (?:an? |the )?((?:[a-z-]+ ){0,3}(?:footballer|actor|actress|singer|songwriter|rapper|musician|politician|writer|author|scientist|physicist|mathematician|comedian|director|painter|inventor|athlete|chef|astronaut))\b/]] },
  Place: { photo: 'place', theme: 'postcard', art: 'motif', notice: false, badges: [['Population', /\bpopulation of ([\d,.]+(?: million)?)/]] }, // a country badge was dropped: "coast of Queensland," is a state, and a guess at a fact is not a badge
  Creature: { photo: 'animal', theme: 'specimen', art: 'motif', notice: false, badges: [['Genus', /\bgenus ([A-Z][a-z]+)/]] },
  Food: { photo: 'place', theme: 'specimen', art: 'motif', notice: false, badges: [['From', /\b(?:originat\w+|traditional|popular) (?:in|from) ((?:the )?[A-Z][a-z]+(?: [A-Z][a-z]+)?)/]] },
  Vehicle: { photo: 'place', theme: 'plain', art: 'motif', notice: false, badges: [['Year', YEAR], ['Maker', /\b(?:made|built|produced|manufactured) by ((?:[A-Z]\. )*[A-Z][\w'&-]+(?: [A-Z][\w'&-]+){0,2})/]] },
  Myth: { photo: 'art', theme: 'collectible', art: 'motif', notice: false, badges: [['Domain', /\bgod(?:dess)? of ([a-z ]{3,30}?)(?:[.,;]| and )/]] },
  Organisation: { theme: 'plain', art: 'neutral', notice: false, badges: [['Founded', /\bfounded (?:in |by [^.]{0,40}? in )?((?:1[5-9]|20)\d\d)/]] },
  Team: { theme: 'plain', art: 'neutral', notice: false, badges: [['Founded', /\b(?:founded|established) (?:in )?((?:1[5-9]|20)\d\d)/]] },
  Event: { photo: 'history', theme: 'plain', art: 'motif', notice: false, badges: [['Year', YEAR]] },
  Concept: { theme: 'plain', art: 'motif', notice: false, badges: [] },
  Card: { theme: 'collectible', art: 'motif', notice: false, badges: [['Year', YEAR]] },
  Idea: { theme: '', art: 'motif', notice: false, badges: [] },
};
export const themeOf = (kind) => (SUBJECT_KINDS[kind] || {}).theme || '';
/** the badges a kind earns from an answer's text: [[label, value]], at most 3, only facts the text states. Pure. */
export function badgesOf(kind, text) {
  const row = SUBJECT_KINDS[kind]; if (!row) return [];
  const t = String(text || '').replace(/\s+/g, ' '), out = [];
  for (const [label, re] of row.badges) { const m = re.exec(t); if (m && m[1]) out.push([label, m[1].trim().slice(0, 40)]); if (out.length === 3) break; }
  return out;
}
/** the line on a card about someone else's characters or work; '' for the rest. `series` is the work the card is from when the source names one. Pure. */
export function noticeOf(kind, series = '') {
  const row = SUBJECT_KINDS[kind]; if (!row || !row.notice) return '';
  return 'A Verse card · not affiliated with ' + (series ? 'the ' + String(series).replace(/^the /i, '').slice(0, 60) + ' series or its makers' : 'its makers');
}
/** the work a list page is about, from its title: "List of Aqua Teen Hunger Force characters" -> "Aqua Teen Hunger Force". Pure. */
export const seriesOfList = (title) => { const m = /^List of (?:recurring |minor |supporting |fictional )?(.+?) (?:characters|episodes|songs|tracks|albums)\b/i.exec(String(title || '')); return m ? m[1].replace(/^The /, '').trim() : ''; };
/** a short description for a section of a list page, from the page's title (a fetched fact): "fictional character from X". Pure. */
export function describeSection(pageTitle) {
  const t = String(pageTitle || ''), s = seriesOfList(t);
  if (/characters/i.test(t) && s) return 'fictional character from ' + s;
  if (/episodes/i.test(t) && s) return 'television episode of ' + s;
  if (/(?:songs|tracks)/i.test(t) && s) return 'song by ' + s;
  if (/albums/i.test(t) && s) return 'album by ' + s;
  if (/chess openings/i.test(t)) return 'chess opening';
  if (/\btrack(?:s| listing)\b/i.test(t)) return 'song on ' + t.replace(/\s*tracks?(?: listing)?$/i, '');
  return '';
}
/** the lib/free-pics.js kind for a card's kind, or '' when the card keeps Verse's own drawing (a fictional character, a real person, a company). Pure. */
export const photoKindOf = (kind) => (SUBJECT_KINDS[kind] || {}).photo || '';
