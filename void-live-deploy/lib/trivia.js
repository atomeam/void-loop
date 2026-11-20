// Trivia: a round of five questions with four choices each, from a bank Verse wrote (plain, settled facts, nothing that goes out of date).
// "quiz me" on an empty stage and "trivia" play it (skills/trivia.js). Pure.
export const BANK = [
  ['Which planet is closest to the Sun?', 'Mercury', ['Venus', 'Mars', 'Earth']],
  ['How many legs does a spider have?', '8', ['6', '10', '12']],
  ['What is the largest ocean on Earth?', 'The Pacific', ['The Atlantic', 'The Indian', 'The Arctic']],
  ['What gas do plants take in from the air to make food?', 'Carbon dioxide', ['Oxygen', 'Nitrogen', 'Helium']],
  ['How many continents are there?', '7', ['5', '6', '8']],
  ['What is the hardest natural material?', 'Diamond', ['Gold', 'Iron', 'Quartz']],
  ['Which animal is the largest that has ever lived?', 'The blue whale', ['The African elephant', 'Tyrannosaurus rex', 'The giraffe']],
  ['What is the boiling point of water at sea level, in Celsius?', '100°', ['90°', '110°', '212°']],
  ['Which planet is known for its rings?', 'Saturn', ['Mars', 'Mercury', 'Venus']],
  ['How many sides does a hexagon have?', '6', ['5', '7', '8']],
  ['What is the capital of Japan?', 'Tokyo', ['Kyoto', 'Osaka', 'Seoul']],
  ['What is the capital of Australia?', 'Canberra', ['Sydney', 'Melbourne', 'Perth']],
  ['What is the capital of Canada?', 'Ottawa', ['Toronto', 'Vancouver', 'Montreal']],
  ['Which is the longest river in South America?', 'The Amazon', ['The Nile', 'The Mississippi', 'The Danube']],
  ['Who painted the Mona Lisa?', 'Leonardo da Vinci', ['Vincent van Gogh', 'Pablo Picasso', 'Claude Monet']],
  ['Who wrote Romeo and Juliet?', 'William Shakespeare', ['Charles Dickens', 'Jane Austen', 'Mark Twain']],
  ['How many minutes are in a day?', '1,440', ['1,200', '1,000', '2,400']],
  ['What is the chemical symbol for gold?', 'Au', ['Ag', 'Go', 'Gd']],
  ['What is the chemical symbol for water?', 'H₂O', ['CO₂', 'O₂', 'NaCl']],
  ['Which organ pumps blood around the body?', 'The heart', ['The lungs', 'The liver', 'The brain']],
  ['How many bones are in an adult human body?', '206', ['106', '186', '306']],
  ['What do bees make?', 'Honey', ['Milk', 'Silk', 'Wax paper']],
  ['Which is the tallest mountain above sea level?', 'Mount Everest', ['K2', 'Kilimanjaro', 'Mont Blanc']],
  ['What is the largest planet in our solar system?', 'Jupiter', ['Saturn', 'Neptune', 'Earth']],
  ['How many players are on a soccer team on the field?', '11', ['9', '10', '12']],
  ['In which sport would you hit a shuttlecock?', 'Badminton', ['Tennis', 'Squash', 'Golf']],
  ['How many strings does a standard guitar have?', '6', ['4', '5', '8']],
  ['What color do you get by mixing blue and yellow?', 'Green', ['Purple', 'Orange', 'Brown']],
  ['Which month has the fewest days?', 'February', ['April', 'June', 'November']],
  ['What is 12 × 12?', '144', ['124', '132', '154']],
  ['What is the square root of 81?', '9', ['8', '7', '11']],
  ['Which is the smallest prime number?', '2', ['1', '3', '5']],
  ['What is the largest desert in the world, counting cold deserts?', 'Antarctica', ['The Sahara', 'The Gobi', 'The Kalahari']],
  ['What is the main language spoken in Brazil?', 'Portuguese', ['Spanish', 'French', 'Italian']],
  ['Which country gave the Statue of Liberty to the United States?', 'France', ['England', 'Spain', 'Italy']],
  ['What is a baby kangaroo called?', 'A joey', ['A kit', 'A cub', 'A calf']],
  ['How many hearts does an octopus have?', '3', ['1', '2', '8']],
  ['What is the fastest land animal?', 'The cheetah', ['The lion', 'The horse', 'The greyhound']],
  ['Which instrument has 88 keys?', 'The piano', ['The organ', 'The accordion', 'The harp']],
  ['What is frozen water called?', 'Ice', ['Steam', 'Dew', 'Fog']],
  ['Which planet is called the Red Planet?', 'Mars', ['Jupiter', 'Venus', 'Mercury']],
  ['How many hours are in a week?', '168', ['144', '160', '172']],
].map(([q, a, wrong]) => ({ q, a, wrong }));

/** a small seeded random, so a round can be the same on a link. Pure. */
export function rng(seed) { let x = (seed >>> 0) || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
/** five questions, each with its four choices shuffled. Pure. */
export function round(seed = Date.now(), n = 5, bank = BANK) {
  const r = rng(seed), idx = bank.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, Math.min(n, bank.length)).map((i) => { const it = bank[i], ch = [it.a, ...it.wrong];
    for (let k = ch.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [ch[k], ch[j]] = [ch[j], ch[k]]; }
    return { q: it.q, a: it.a, choices: ch }; });
}
/** a new game. Pure. */
export const create = (seed = Date.now()) => ({ seed: seed >>> 0, qs: round(seed), at: 0, picks: [], score: 0 });
/** the game after a pick on the current question; a pick after the end changes nothing. Pure. */
export function pick(s, choice) {
  if (!s || s.at >= s.qs.length) return s;
  const right = s.qs[s.at].a === choice;
  return { ...s, at: s.at + 1, picks: [...s.picks, { choice, right }], score: s.score + (right ? 1 : 0) };
}
/** the line after a round. Pure. */
export function verdict(score, n = 5) {
  return score === n ? 'Perfect round.' : score >= n - 1 ? 'So close to perfect.' : score >= Math.ceil(n / 2) ? 'Not bad at all.' : 'Tough round. Try another.';
}
/** "trivia", "play trivia", "a trivia game", "ask me trivia questions". Pure. */
export function triviaOf(text) {
  const t = String(text || '').toLowerCase().trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:let'?s |can we |i want to )?(?:play|start|do|give me|ask me) )?(?:a |some )?(?:round of )?(?:trivia|general knowledge)(?: (?:game|quiz|round|questions?|night))?$/.test(t);
}
