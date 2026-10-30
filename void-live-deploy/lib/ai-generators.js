// AI name generators (owner, 2026-10-25: perchance's AI name generators): built-in list-language generators whose names are written by Verse's
// free language model through {ai: ...} (lib/listgen.js; /api/answer mode aitext, its 12-a-minute limit, each text cached by prompt and seed).
// The lists pick the kind of name, so each prompt differs and every result is reproducible from its seed. Opened at /generators/make/?t=<id>.
// Pure data. Tests: tools/listgen.test.mjs.
const gen = (title, body) => '$title = ' + title + '\n$layout = cards\n' + body.trim() + '\n';
export const AI_GENERATORS = Object.freeze([
  { id: 'ai-fantasy-names', title: 'AI fantasy names', text: gen('AI fantasy names', `
output
  [r = race, ""][c = role, ""]{ai: invent one original [style] fantasy name for a [r] [c]. Answer with only the name}<br>[r.titleCase] [c]
race
  elf
  dwarf
  human
  orc
  halfling
  dragonborn ^0.5
role
  ranger
  wizard
  blacksmith
  queen
  thief
  bard
style
  melodic
  harsh
  ancient
  short`) },
  { id: 'ai-character-names', title: 'AI character names', text: gen('AI character names', `
$inputs
  genre = select any|fantasy|sci-fi|mystery|western|cozy
output
  [p = person, ""]{ai: invent one first and last name for a [p] in a [genre] story. Answer with only the name}<br>[p.sentenceCase]
person
  shy librarian
  retired sea captain
  young inventor
  travelling cook
  grumpy detective
  cheerful farmer`) },
  { id: 'ai-town-names', title: 'AI town names', text: gen('AI town names', `
output
  [k = kind, ""]{ai: invent one name for a [k] [where]. Answer with only the name}<br>{A} [k] [where]
kind
  fishing village
  mountain town
  desert city
  river port
  forest hamlet
where
  in the north
  on an island
  by a volcano
  in the marshes`) },
  { id: 'ai-pet-names', title: 'AI pet names', text: gen('AI pet names', `
output
  [a = animal, ""][m = mood, ""]{ai: suggest one cute name for a [m] [a]. Answer with only the name}<br>for {a} [m] [a]
animal
  kitten
  puppy
  rabbit
  goldfish
  parrot
  hamster
mood
  sleepy
  bouncy
  fluffy
  curious`) },
  { id: 'ai-band-names', title: 'AI band names', text: gen('AI band names', `
output
  [g = genre, ""]{ai: invent one original name for a [g] band. Answer with only the name}<br>[g.titleCase]
genre
  indie folk
  synthwave
  punk rock
  jazz trio
  heavy metal
  dream pop`) },
]);
export const aiGeneratorOf = (id) => AI_GENERATORS.find((g) => g.id === id) || null;
