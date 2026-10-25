// The generators page's pure half (void-live-deploy/generators/index.html, Versus' perchance.org floor): text generators that run on the device and
// are deterministic from a seed, so a link (?g=<id>&seed=<n>) reproduces the result. A seeded PRNG (mulberry32), word lists, 27 generators, and the
// words for a German browser. Nothing is fetched; pure. Tests: tools/generators.test.mjs
export function prng(seed) {
  let a = (Number(seed) >>> 0) || 0x9e3779b9;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = () => next();
  r.int = (n) => Math.floor(next() * n);
  r.pick = (xs) => xs[Math.floor(next() * xs.length)];
  r.chance = (p) => next() < p;
  return r;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const title = (s) => s.replace(/(^|[\s-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
const a_ = (w) => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
const w = (s) => s.split(/\s+/);

const L = {
  onset: w('B Br C Ch D Dr El F Fa G Gr H I J K Kr L M Mal N Na O P Q R Ra S Sh Sy T Th Tr V Va W Y Z Zo Ael Ar Cal Del Eld Fen Gal Kael Lor Mor Nim Oro Per Riv Sil Tor Ul Vor'),
  mid: w('a e i o u ae ia ou an en in or ar el il ir al un ath eth oro ala ira'),
  end: w('dor ron wen wyn dric lian mir nor ras thas vyn zar lis rel dal mund ion eth ik os us an en or'),
  place1: w('Oak Elm Ash Stone River Mill Red Black White Green Gold Iron Wolf Raven Fox Storm Thorn Wind Bright Dun Hollow Cold Salt Mist Amber Briar Cinder Lark Marsh Pine Willow'),
  place2: w('ford ton bury field wick worth haven bridge stead vale mere hill dale holm gate crest brook minster port cross moor wood by'),
  bandA: w('Neon Velvet Electric Midnight Paper Broken Silent Golden Crystal Hollow Savage Lonely Atomic Cosmic Rusty Wild Frozen Burning Gentle Static Pale Crimson Quiet Rapid Sleepy Lunar Feral Plastic Glass Marble'),
  bandB: w('Wolves Tigers Parade Ghosts Echoes Engines Satellites Pilots Hearts Monsters Orchestra Gardens Bandits Comets Mirrors Giants Pirates Harvest Cathedral Machines Sparrows Thieves Canyons Lanterns Circus Skeletons Dreamers Rivers Anthem'),
  adj: w('swift clever bright dark silver quiet bold happy cosmic tiny lucky mellow rapid sunny frosty crimson electric hidden gentle wild lazy pixel turbo ultra mega'),
  noun: w('fox owl wolf comet pixel ninja panda otter falcon wizard rocket tiger raven badger lynx dragon cactus robot mango biscuit pilot ranger bear moth'),
  petG: w('Biscuit Mochi Pepper Waffles Olive Maple Ziggy Pickles Cosmo Nugget Peanut Bean Noodle Clover Juniper Teddy Poppy Sprout Muffin Gizmo Willow Basil Pretzel Bubbles Ginger Marshmallow Toast Cricket Misty Pumpkin Rocket Sunny Tofu Waffle Button Daisy Fudge'),
  bizA: w('Bright Blue Summit Nimble Golden Harbor Northern Urban Pioneer Quick Oak Clear Stellar Prime Vivid Anchor Cedar Lumen Maple Orbit Atlas Beacon Copper Fable Granite Ember Meadow Keystone Willow'),
  bizB: w('Works Labs Studio Supply Collective Co. Partners Goods Forge Group Mill Market Workshop Kitchen Garage Trading House Foundry Outfitters Dynamics Systems Roasters Bakery Designs Solutions Cycles'),
  heroA: w('Captain Doctor Lady Lord Professor Agent Major Mister Madame Sergeant Baron'),
  heroB: w('Thunder Shadow Blaze Frost Vortex Quantum Iron Nova Phantom Falcon Echo Titan Cobalt Comet Rune Static Gravity Mirage Tempest Onyx'),
  heroC: w('Fist Wing Storm Strike Blade Knight Guard Hawk Pulse Surge Viper Flame Shield Lance Spark Wolf Mind Tide Claw Hammer'),
  potionA: w('Draught Elixir Tonic Philter Brew Tincture Serum Infusion Cordial Essence'),
  potionB: w('Invisibility Courage Moonlight Heartache Swiftness Clear Sight Giant Strength Forgetting Luck Dragon Breath Frost Walking Starlight Truthful Tongues Sweet Dreams Deep Sleep Warm Feet Second Wind Shrinking Levity'),
  planetA: w('Zor Kep Xan Vel Ora Tal Mir Nyx Hal Cor Ety Gli Ura Pho Ixi Sol Dra Eri Lyr Tau'),
  planetB: w('ion ara os ex ia is oth ar un ea ulo ine ax ora ilo ium'),
  planetKind: ('an ocean world|a desert world|a gas giant|a frozen moon|a jungle world|a volcanic world|a ringed giant|a tidally locked world|a rogue planet|a storm world|a crystal world|a city-covered world').split('|'),
  planetLine: ['two suns that never set', 'a sky full of green aurora', 'skies the colour of copper', 'twelve moons and no tides', 'floating islands', 'forests that glow at night', 'a year that lasts six hours', 'oceans of liquid glass', 'mountains that sing in the wind', 'one lonely city', 'rain made of tiny diamonds', 'a ruined ring of old satellites'],
  villainWho: ['a retired lighthouse keeper', 'the royal librarian', 'a charming duke', 'a pair of twin sisters who share one secret', 'the kingdom\'s oldest wizard', 'a bored AI', 'a disgraced knight', 'the mayor', 'a travelling circus master', 'a mouse who was always overlooked', 'the head chef', 'a grieving inventor'],
  villainWant: ['steal every clock in the city so time stops', 'poison the well that feeds the capital', 'wake the sleeping giant under the mountain', 'replace the king with a perfect double', 'drown the harbour in fog forever', 'collect every shadow in town', 'forge a crown that makes people obey', 'sell the moon to the highest bidder', 'burn all the maps so no one can leave', 'steal the first snow of winter'],
  villainHow: ['using a forged royal decree', 'with the help of an army of crows', 'by tricking the heroes into doing it for them', 'through a ritual only done at midnight', 'hiding behind a charity', 'with a machine built from stolen bells', 'by turning the town against a scapegoat', 'while everyone is at the festival'],
  villainFlaw: ['a single honest child can see through the plan', 'the plan needs one thing the hero already carries', 'the villain cannot bear to hurt the one who raised them', 'the final step must be done at sunrise', 'a forgotten law forbids it', 'the villain\'s own mirror knows the truth'],
  prompt1: ['A lighthouse keeper', 'A girl with a pocket full of stars', 'Two rival bakers', 'The last dragon', 'A robot who learned to paint', 'A cartographer', 'A ghost who is afraid of the dark', 'A kid on the last train', 'A thief with a conscience', 'An old sailor', 'A town where it never rains', 'A librarian'],
  prompt2: ['finds a door that was not there yesterday', 'receives a letter from their future self', 'must return something borrowed a hundred years ago', 'discovers everyone has forgotten a single colour', 'wakes up one hour older than yesterday', 'is asked to keep a secret that is not theirs', 'hears the sea inside a seashell speak', 'is hired to find a missing song', 'has one day to say goodbye', 'learns that the map is alive'],
  prompt3: ['and the only witness is a cat.', 'but the clocks all disagree.', 'while a storm closes every road.', 'and nobody believes them.', 'at the edge of the world.', 'and it changes everything by morning.', 'and the price is a memory.', 'under a sky with two moons.'],
  wprompt: ['Write about the last time you felt completely lost.', 'Describe a room using only sounds.', 'A character finds a key with no lock. Write the next page.', 'Write a conversation between two people who are both lying.', 'Describe your favourite place without naming it.', 'Write a letter you will never send.', 'Start a story with the line "It was the quietest the city had ever been."', 'Write about an ordinary object as if it were magic.', 'Describe a meal from the point of view of someone who has never eaten.', 'Write a scene where the weather is the villain.', 'Write the opening of a story that ends with a door closing.', 'Describe a stranger on a bus in exactly five sentences.', 'Write about something you were certain of and were wrong about.', 'Retell a fairy tale from the monster\'s side.', 'Write a story that takes place in one minute.', 'Write a poem about a Tuesday.', 'Describe the smell of rain to someone who has never been outside.', 'Write a monologue for a lighthouse.', 'Write about a promise that was kept too late.', 'Two sentences: one that opens a story, one that ends it. Now write what is between.'],
  npcFirst: w('Aldric Brenna Corwin Dara Edric Fenna Gorm Hilda Ivor Jessa Kellan Lyra Marek Nessa Orrin Pella Quill Rowan Sabine Tamsin Ulric Vessa Wynn Yara Zephyr'),
  npcLast: w('Ashdown Blackwood Cobbler Dunmere Fairweather Greywind Hartwell Ironfoot Larkspur Moonbrook Nettleby Oakheart Pennywhistle Quickwater Redfern Stonehelm Thistlewood Underhill Whitlock'),
  npcJob: w('innkeeper blacksmith fisher herbalist guard scribe peddler ferryman baker cartographer gravedigger minstrel fortune-teller horse-trader tax collector hermit apothecary shipwright'),
  npcTrait: ['speaks in a whisper', 'laughs at the wrong moments', 'is fiercely loyal', 'never forgets a face', 'is secretly very wealthy', 'distrusts all magic', 'is unusually cheerful', 'tells tall tales', 'is terrified of birds', 'is always hungry', 'counts everything', 'is deeply superstitious', 'collects buttons'],
  npcQuirk: ['hums while thinking', 'always carries a lucky coin', 'talks to a pet rat', 'refuses to sit with their back to the door', 'cannot lie when staring at fire', 'ends every sentence with a question', 'wears three hats at once', 'knits during conversations', 'quotes a dead poet', 'never says their own name'],
  backA: ['Raised by', 'Abandoned as a child and found by', 'Trained for years by', 'Sold into service to', 'Born in the shadow of', 'Orphaned by', 'Saved from a shipwreck by'],
  backB: ['a travelling band of players', 'monks on a mountain', 'a retired assassin', 'a family of smugglers', 'a failing noble house', 'a plague that took the village', 'a kind-hearted witch', 'a rogue general'],
  backC: ['left home after discovering a family secret', 'now carries a debt that cannot be paid in coin', 'is searching for a sibling thought lost', 'swore never to touch a sword again', 'hears a voice no one else can', 'wants only to see the sea', 'is hiding a real name', 'was marked by a prophecy they do not believe'],
  backD: ['Their greatest fear is being ordinary.', 'They trust nobody with a smile.', 'They keep a locket they never open.', 'They sleep with one eye open.', 'They have never lost a bet, and it worries them.'],
  tagA: w('Taste Feel Find Make Live Dream Discover Think Build Imagine Believe Choose Own Wake Break Fuel Move'),
  tagB: ['the difference', 'something better', 'what is next', 'your best day', 'tomorrow, today', 'the simple way', 'more with less', 'it your way', 'what matters', 'every moment', 'the future', 'the good stuff'],
  prodA: w('Zen Nova Flux Aero Pulse Lumi Echo Volt Kinetic Nimbus Orbit Pixel Quanta Terra Vivo Zephyr Helix Prism Axiom Byte'),
  prodB: w('Buds Pad Pro Hub Max Mini Core Cube Lite Band Tag Pod Air Loop One Go Sync Dock Flex Wave'),
  recA: w('Spicy Crispy Creamy Smoky Lemony Garlic Honey Maple Roasted Sticky Cheesy Herby Peanut Caramelised Crunchy Buttery Tangy'),
  recB: w('chickpea pumpkin salmon mushroom aubergine sweet potato halloumi chicken tofu cauliflower noodle lentil prawn cabbage black bean'),
  recC: w('tacos stew pie skewers fritters curry wraps bake risotto flatbread soup bowl dumplings pasta salad'),
  dateIdea: ['Cook a dish neither of you has made before', 'Visit a bookshop and pick each other a book', 'Watch the sunrise with a flask of something warm', 'Build a blanket fort and watch a film', 'Take a long walk with no destination', 'Have a picnic in the park, rain or shine', 'Try a dance class together', 'Go to a museum and invent stories about the exhibits', 'Play board games and bake something', 'Take photos of each other\'s favourite places', 'Stargaze with a map of the constellations', 'Go to a farmers market and cook what you buy', 'Write each other a letter to open in a year', 'Go bowling and loser buys dessert', 'Take the first bus somewhere and explore'],
  riddleThing: [['a map', 'cities, but no houses', 'mountains, but no trees', 'water, but no fish'], ['a clock', 'hands, but no arms', 'a face, but no eyes', 'numbers, but cannot count'], ['a river', 'a mouth, but never eats', 'a bed, but never sleeps', 'banks, but no money'], ['a book', 'a spine, but no bones', 'pages, but no wings', 'a story, but no voice'], ['a keyboard', 'keys, but no locks', 'a space, but no room', 'a shift, but no job'], ['a tree', 'a trunk, but no luggage', 'rings, but no fingers', 'leaves, but never goes'], ['a shadow', 'a shape, but no body', 'a head, but no thought', 'a long life at dusk'], ['an egg', 'no door, but a golden room', 'a shell, but no sea', 'a crack, and then it begins'], ['a bell', 'a tongue, but cannot talk', 'a ring, but no finger', 'a voice only when struck'], ['a comb', 'teeth, but cannot bite', 'a handle, but opens no door', 'tangles, and then tames them']],
  hkN: { 1: w('moon sky rain snow wind leaf frost dawn mist pond stone wave bird dusk cloud tide fog'), 2: w('river morning autumn silence winter petal water willow mountain lantern shadow whisper meadow blossom cricket'), 3: w('butterfly dragonfly waterfall memory horizon afternoon wildflower lullaby'), 4: w('dandelion caterpillar anemone') },
  hkV: { 1: w('glows falls fades sleeps drifts calls sings turns waits breathes'), 2: w('shimmers settles whispers lingers wanders rises awakens'), 3: w('disappears remembers') },
  hkA: { 1: w('cold pale still deep soft warm slow bare green gray'), 2: w('quiet silver gentle distant hollow golden fragile sleepy endless'), 3: w('forgotten wandering beautiful unbroken remembered'), 4: w('mysterious incredible') },
  dream: ['Describe the last dream you remember, starting from the end.', 'Who was with you in the dream, and who were they really?', 'What colour was the sky, and what did it feel like?', 'Which place in the dream felt familiar, and why?', 'Did you fly, fall or run? What were you trying to reach?', 'What was the strangest object you held?', 'What did you say that you could not hear yourself say?', 'What emotion stayed with you after you woke?', 'If the dream were a film, what would its title be?', 'Which detail in it relates to something from yesterday?', 'Write the dream as a short fairy tale.'],
  palA: w('Dusty Burnt Midnight Faded Electric Soft Deep Wild Pale Smoky Sunlit Frosted Velvet Salted Honeyed Wet Gilded Ashen'),
  palB: w('Rose Sage Ink Terracotta Lavender Mustard Teal Peach Moss Plum Slate Coral Mint Cinnamon Indigo Clay Sand Berry Olive Cherry'),
  albA: w('Songs Letters Echoes Postcards Ghosts Tapes Lullabies Dreams Daylight Memories Tides Maps Fires Machines Hymns Pictures'),
  albB: ('from the Basement|for Nobody|at Midnight|in Blue|of a Quiet Town|from Another Summer|Under Glass|for the Last Train|on the Edge|in the Rain|Without Names|After the Flood|of the Lonely Hours|for Daylight').split('|'),
  bookA: w('The Last Secret Midnight Whispering Forgotten Silent Crimson Hidden Broken Glass Paper Stolen Wandering Burning Winter Salt'),
  bookB: w('Garden Cartographer Lighthouse Sparrow Orchard Archive Kingdom Letters Harbour Clockmaker Inheritance Thief Compass Rivers Violin Cathedral Hours'),
  bookC: ['of Ashes', 'of the Sea', 'of Glass', 'of Salt', 'of the North', 'of Bells', 'of Thorns', 'of the Last Light'],
  power: ['Talk to houseplants and understand their complaints', 'Turn invisible whenever nobody is looking', 'Always know the exact time without a clock', 'Pause time for exactly eleven seconds a day', 'Speak every language, but only while singing', 'Make any food taste perfect', 'Walk through walls, but only at walking pace', 'Sense where lost things are', 'Control the weather in a 10-metre bubble', 'Never be lost', 'Heal any plant with a touch', 'Fly, but only as high as a first floor', 'Hear music in everyone\'s footsteps', 'Always find a parking space', 'Copy any handwriting at a glance', 'Shrink to the size of a thumb for one minute'],
  quest: ['Deliver a letter to a hermit who refuses visitors', 'Find the missing bell of the village chapel', 'Escort a nervous merchant through the haunted wood', 'Retrieve a stolen recipe from a rival inn', 'Count the stars above the old tower, and report the number that is wrong', 'Return a lost child\'s toy to the giant it belongs to', 'Judge a pie contest where every contestant is cheating', 'Find out who has been moving the milestones at night', 'Guard a door that leads nowhere', 'Lure a river spirit out of the well', 'Collect three feathers from three very rude birds', 'Teach an old dragon how to read', 'Find the thief who steals only left shoes', 'Win a staring contest against a statue'],
  lim: [
    { first: 'A baker who lived by the sea', a: ['Made pies that were big as a tree', 'Said, "Come in and have tea!"', 'Gave a slice to each gull, rather free', 'Was as happy as anyone could be'], b: ['He baked until night', 'Till the stars shone bright', 'By lamp and by candlelight'] },
    { first: 'A curious cat in a hat', a: ['Chased a mouse who was terribly fat', 'Sat down on the kitchen mat', 'Said, "Well, fancy that!"', 'Never once thought of a chat'], b: ['She leapt in the air', 'Without any care', 'Then she hurried up the stair'] },
    { first: 'A dragon who lived on a hill', a: ['Found fighting a terrible chill', 'Would rather sit still', 'Knitted scarves with great skill', 'Is knitting up there even still'], b: ['The knights came to war', 'But he opened the door', 'Said, "Tea? What a bore!"'] },
    { first: 'A robot who longed to be free', a: ['Wrote poems at half past three', 'Said, "Nobody understands me!"', 'Built a boat for the sea', 'Is as happy as robots can be'], b: ['It sang out of tune', 'To the cold silver moon', 'And was done very soon'] },
    { first: 'A wizard whose spells went askew', a: ['Turned his hat into soup, then a shoe', 'Said, "What am I to do?"', 'Made the cat turn bright blue', 'Is still sorting it out, it is true'], b: ['He waved with a frown', 'And the tower fell down', 'Then he left for the town'] },
  ],
}

// every generator: id, English name, German name, a function (r) => one result string
const g = (id, en, de, fn) => ({ id, en, de, fn });
const syl = (r) => cap(r.pick(L.onset).toLowerCase()) + (r.chance(0.7) ? r.pick(L.mid) : '') + r.pick(L.end);
export const GENERATORS = Object.freeze([
  g('fantasy-names', 'Fantasy names', 'Fantasy-Namen', (r) => { const n = syl(r); return r.chance(0.35) ? n + ' ' + cap(syl(r).toLowerCase()) : n; }),
  g('town-names', 'Town names', 'Ortsnamen', (r) => r.pick(L.place1) + r.pick(L.place2)),
  g('band-names', 'Band names', 'Bandnamen', (r) => (r.chance(0.3) ? 'The ' : '') + r.pick(L.bandA) + ' ' + r.pick(L.bandB)),
  g('usernames', 'Usernames', 'Benutzernamen', (r) => cap(r.pick(L.adj)) + cap(r.pick(L.noun)) + (r.chance(0.7) ? String(r.int(100)) : '')),
  g('pet-names', 'Pet names', 'Haustiernamen', (r) => r.pick(L.petG)),
  g('business-names', 'Business names', 'Firmennamen', (r) => r.pick(L.bizA) + ' ' + r.pick(L.bizB)),
  g('superhero-names', 'Superhero names', 'Superhelden-Namen', (r) => r.chance(0.4) ? r.pick(L.heroA) + ' ' + r.pick(L.heroB) : r.pick(L.heroB) + r.pick(L.heroC).toLowerCase()),
  g('potion-names', 'Potion names', 'Trank-Namen', (r) => r.pick(L.potionA) + ' of ' + r.pick(L.potionB)),
  g('planet-names', 'Planet names', 'Planetennamen', (r) => { const n = r.pick(L.planetA) + r.pick(L.planetB); return n + (r.chance(0.4) ? ' ' + 'IVX'.charAt(r.int(3)) + ['', 'I', 'II'][r.int(3)] : '') + ': ' + cap(r.pick(L.planetKind)) + ' with ' + r.pick(L.planetLine); }),
  g('villain-plots', 'Villain plots', 'Schurkenpläne', (r) => cap(r.pick(L.villainWho)) + ' plans to ' + r.pick(L.villainWant) + ', ' + r.pick(L.villainHow) + '; ' + r.pick(L.villainFlaw) + '.'),
  g('story-prompts', 'Story prompts', 'Geschichtenideen', (r) => r.pick(L.prompt1) + ' ' + r.pick(L.prompt2) + ' ' + r.pick(L.prompt3)),
  g('writing-prompts', 'Writing prompts', 'Schreibanregungen', (r) => r.pick(L.wprompt)),
  g('dnd-npcs', 'D&D NPCs', 'D&D-NSCs', (r) => r.pick(L.npcFirst) + ' ' + r.pick(L.npcLast) + ', ' + a_(r.pick(L.npcJob)) + ' who ' + r.pick(L.npcTrait) + ' and ' + r.pick(L.npcQuirk)),
  g('backstories', 'Character backstories', 'Charakter-Hintergründe', (r) => r.pick(L.backA) + ' ' + r.pick(L.backB) + ', this character ' + r.pick(L.backC) + '. ' + r.pick(L.backD)),
  g('taglines', 'Taglines', 'Slogans', (r) => r.pick(L.tagA) + ' ' + r.pick(L.tagB) + '.'),
  g('product-names', 'Product names', 'Produktnamen', (r) => r.pick(L.prodA) + ' ' + r.pick(L.prodB) + (r.chance(0.3) ? ' ' + (2 + r.int(8)) : '')),
  g('recipe-ideas', 'Recipe ideas', 'Rezeptideen', (r) => r.pick(L.recA) + ' ' + r.pick(L.recB) + ' ' + r.pick(L.recC)),
  g('date-ideas', 'Date ideas', 'Date-Ideen', (r) => r.pick(L.dateIdea)),
  g('riddles', 'Riddles', 'Rätsel', (r) => { const t = r.pick(L.riddleThing), o = t.slice(1); const a = o.splice(r.int(o.length), 1)[0], b = o[r.int(o.length)]; return 'I have ' + a + ', and ' + b + '. What am I?  (' + cap(t[0]) + ')'; }),
  g('haiku', 'Haiku (5-7-5)', 'Haiku (5-7-5)', (r) => [5, 7, 5].map((n) => hline(r, n)).join(' / ')),
  g('limericks', 'Limericks', 'Limericks', (r) => { const G = r.pick(L.lim), A = G.a.slice(), B = G.b.slice(); const a1 = A.splice(r.int(A.length), 1)[0], a2 = A[r.int(A.length)], b1 = B.splice(r.int(B.length), 1)[0], b2 = B[r.int(B.length)]; return [G.first + ',', a1 + ',', b1 + ',', b2 + ',', a2 + '.'].join('\n'); }),
  g('dream-prompts', 'Dream journal prompts', 'Traumtagebuch-Fragen', (r) => r.pick(L.dream)),
  g('palette-names', 'Colour palette names', 'Farbpaletten-Namen', (r) => r.pick(L.palA) + ' ' + r.pick(L.palB) + ' + ' + r.pick(L.palA) + ' ' + r.pick(L.palB)),
  g('album-titles', 'Album titles', 'Albumtitel', (r) => r.pick(L.albA) + ' ' + r.pick(L.albB)),
  g('book-titles', 'Book titles', 'Buchtitel', (r) => (r.chance(0.5) ? 'The ' + r.pick(L.bookB) + ' ' + r.pick(L.bookC) : r.pick(L.bookA) + ' ' + r.pick(L.bookB)).replace('The The', 'The')),
  g('superpowers', 'Superpowers', 'Superkräfte', (r) => r.pick(L.power)),
  g('side-quests', 'Side quests', 'Nebenquests', (r) => r.pick(L.quest)),
]);
// haiku: a line of exactly n syllables built from word kinds whose lengths are known (the word lists above are keyed by syllables)
const PATTERNS = [['A', 'N'], ['N', 'V'], ['the', 'N', 'V'], ['the', 'A', 'N', 'V'], ['A', 'A', 'N']];
const POOL = { A: L.hkA, N: L.hkN, V: L.hkV };
function fits(pat, n) { // every way to give each kind a length so the line sums to n
  const out = []; const rec = (i, left, acc) => { if (i === pat.length) { if (left === 0) out.push(acc.slice()); return; } if (pat[i] === 'the') return rec(i + 1, left - 1, acc.concat('the')); for (const k of Object.keys(POOL[pat[i]])) if (+k <= left) rec(i + 1, left - +k, acc.concat([[pat[i], +k]])); }; rec(0, n, []); return out;
}
function hline(r, n) {
  const all = []; for (const pat of PATTERNS) for (const f of fits(pat, n)) all.push(f);
  const f = r.pick(all); return cap(f.map((x) => (x === 'the' ? 'the' : r.pick(POOL[x[0]][x[1]]))).join(' '));
}
export const syllablesOf = (word) => { const m = String(word).toLowerCase().match(/[aeiouy]+/g); return m ? m.length : 1; };
export const idsOf = () => GENERATORS.map((x) => x.id);
export const byId = (id) => GENERATORS.find((x) => x.id === id) || null;
/** n unique results from generator `id` for `seed` (same inputs, same output). n is clamped to 1..20. Pure. */
export function generate(id, seed, n = 5) {
  const gen = byId(id); if (!gen) return [];
  const count = Math.max(1, Math.min(20, Math.floor(Number(n)) || 5)), r = prng(seed), out = [], seen = new Set();
  for (let tries = 0; out.length < count && tries < count * 60; tries++) { const s = gen.fn(r); if (s && !seen.has(s)) { seen.add(s); out.push(s); } }
  return out;
}
/** "Make your own": shuffled picks from the lines a person typed, by seed. Pure. */
export function fromList(text, seed, n = 5) {
  const items = [...new Set(String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean))].slice(0, 500), r = prng(seed), a = items.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = r.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, Math.max(1, Math.min(20, Math.floor(Number(n)) || 5)));
}
export const newSeed = () => (Math.floor(Math.random() * 99999) + 1);
export const wordsFor = (lang) => (/^de\b/i.test(lang || '') ? { title: 'Zufallsgeneratoren', sub: 'Namen, Ideen und Geschichten per Knopfdruck. Derselbe Link zeigt immer dasselbe Ergebnis. Alles auf deinem Gerät, auch offline.', many: 'Ergebnisse', regenerate: 'Neu würfeln', copy: 'Kopieren', copyAll: 'Alle kopieren', copied: 'Kopiert', share: 'Link teilen', linked: 'Link kopiert', keep: 'Merken', kept: 'Gemerkt', picture: 'Bild dazu', painting: 'Ich male', noArt: 'Der Maler ist heute müde. Versuch es morgen wieder.', favs: 'Gemerkte', none: 'Noch nichts gemerkt.', gens: 'Generatoren', own: 'Eigenen Generator bauen', ownHint: 'Eine Zeile pro Eintrag', seed: 'Zahl', remove: 'Entfernen', ofN: 'Ergebnisse' } : { title: 'Random generators', sub: 'Names, ideas and stories at a tap. The same link always shows the same result. Everything runs on your device, offline too.', many: 'Results', regenerate: 'Regenerate', copy: 'Copy', copyAll: 'Copy all', copied: 'Copied', share: 'Share link', linked: 'Link copied', keep: 'Keep', kept: 'Kept', picture: 'Picture it', painting: 'Painting', noArt: 'The painter is resting for today. Try again tomorrow.', favs: 'Kept', none: 'Nothing kept yet.', gens: 'generators', own: 'Make your own generator', ownHint: 'One entry per line', seed: 'seed', remove: 'Remove', ofN: 'results' });
