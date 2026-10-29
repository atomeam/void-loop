/**
 * password: Verse's password generator (the tower's passwordsgenerator.net floor, 2026-10-25). Pure but for the device's secure random numbers.
 *   - a password of 4..128 characters from the classes chosen (uppercase, lowercase, digits, symbols), with the rival's exclusions (look-alikes,
 *     ambiguous punctuation) and three it lacks: no repeated character, no three in a row (abc, 321), one of every chosen class;
 *   - a passphrase of 3..10 words from WORDS (common short English words), any separator, capitalised or not, a digit or not;
 *   - the strength of either, exact: the entropy in bits is log2 of how many passwords the setting can make (inclusion-exclusion for "one of
 *     each", falling factorials for "no repeats"), and the time to try them all at 1e10 guesses a second, worded;
 *   - every draw by rejection sampling from crypto.getRandomValues (a draw past the last whole multiple of the range is thrown away: no modulo
 *     bias), and nothing leaves the device.
 * Tests: tools/password.test.mjs.
 */
export const CLASSES = Object.freeze({
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower: 'abcdefghijklmnopqrstuvwxyz', digits: '0123456789',
  symbols: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
});
export const CLASS_NAMES = Object.freeze({ upper: 'uppercase', lower: 'lowercase', digits: 'numbers', symbols: 'symbols' });
/** the look-alikes passwordsgenerator.net excludes: i l 1 L o 0 O (and I, which reads as l in most faces) */
export const SIMILAR = 'il1LoO0I';
/** the punctuation it calls ambiguous: { } [ ] ( ) / \ ' " ` ~ , ; : . < > */
export const AMBIGUOUS = '{}[]()/\\\'"`~,;:.<>';
export const MIN_LENGTH = 4, MAX_LENGTH = 128, MAX_COUNT = 20, MIN_WORDS = 3, MAX_WORDS = 10;
export const RATE = 1e10; // guesses a second: a stolen hash list on one modern rig (the same figure /password-strength/ uses)

const DEFAULTS = Object.freeze({ length: 16, upper: true, lower: true, digits: true, symbols: true, similar: false, ambiguous: false, noRepeat: false, noSequential: false, each: true });
/** the options filled in and clamped. Pure. */
export function normalize(o = {}) {
  const n = { ...DEFAULTS, ...o };
  n.length = Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, Math.trunc(Number(n.length)) || DEFAULTS.length));
  for (const k of ['upper', 'lower', 'digits', 'symbols', 'similar', 'ambiguous', 'noRepeat', 'noSequential', 'each']) n[k] = !!n[k];
  if (!n.upper && !n.lower && !n.digits && !n.symbols) n.lower = true; // a password of nothing is not one: lowercase is the floor
  return n;
}
/** the character classes a setting draws from, each trimmed of the exclusions: [{ key, name, chars }], and the alphabet as one string. Pure. */
export function alphabetOf(o) {
  const n = normalize(o), drop = (n.similar ? SIMILAR : '') + (n.ambiguous ? AMBIGUOUS : '');
  const classes = Object.keys(CLASSES).filter((k) => n[k]).map((k) => ({ key: k, name: CLASS_NAMES[k], chars: [...CLASSES[k]].filter((c) => !drop.includes(c)).join('') })).filter((c) => c.chars.length);
  return { classes, all: classes.map((c) => c.chars).join('') };
}
/** why a setting cannot make a password, or '' when it can. Pure. */
export function problemOf(o) {
  const n = normalize(o), { classes, all } = alphabetOf(n);
  if (!all.length) return 'Every character is excluded: turn a class on or an exclusion off.';
  if (n.noRepeat && n.length > all.length) return 'Only ' + all.length + ' different characters are allowed, so ' + n.length + ' with no repeats cannot be made: allow repeats or a shorter password.';
  if (n.each && classes.length > n.length) return 'A password of ' + n.length + ' cannot hold one of each of ' + classes.length + ' classes.';
  return '';
}

// ---- randomness: unbiased integers from the device's secure random numbers
const buf = new Uint32Array(1);
/** an unbiased integer in [0, range) by rejection sampling on 32-bit secure randoms. */
export function below(range, rnd = globalThis.crypto) {
  const r = Math.trunc(range); if (!(r >= 1) || r > 4294967296) throw new RangeError('range must be 1..2^32');
  const lim = Math.floor(4294967296 / r) * r;
  for (;;) { rnd.getRandomValues(buf); if (buf[0] < lim) return buf[0] % r; }
}

// ---- counting: how many passwords a setting can make, exactly (BigInt), so the entropy is log2 of the truth and not a guess
const log2Big = (b) => { if (b <= 0n) return -Infinity; const s = b.toString(2); const head = s.slice(0, 53); return Math.log2(Number(BigInt('0b' + head))) + (s.length - head.length); };
const falling = (n, k) => { let p = 1n; for (let i = 0; i < k; i++) p *= BigInt(n - i); return k > n ? 0n : p; };
const pow = (n, k) => BigInt(n) ** BigInt(k);
/** how many passwords the setting can make (ignoring the no-three-in-a-row rule, which removes a small share), as a BigInt. Pure. */
export function spaceOf(o) {
  const n = normalize(o), { classes, all } = alphabetOf(n), N = all.length, L = n.length;
  if (problemOf(n)) return 0n;
  const count = (size) => (n.noRepeat ? falling(size, L) : pow(size, L));
  if (!n.each) return count(N);
  // inclusion-exclusion over the classes that must each appear: strings over the alphabet minus those that miss at least one class
  let total = 0n; const m = classes.length;
  for (let mask = 0; mask < 1 << m; mask++) { let size = N, bits = 0; for (let i = 0; i < m; i++) if (mask & (1 << i)) { size -= classes[i].chars.length; bits++; } total += (bits % 2 ? -1n : 1n) * count(size); }
  return total;
}
/** the entropy of a setting in bits (log2 of spaceOf), to 0.1; 0 when nothing can be made. Pure. */
export const bitsOf = (o) => { const s = spaceOf(o); return s > 0n ? Math.round(log2Big(s) * 10) / 10 : 0; };

// ---- words: common short English words (3 to 7 letters), no names, nothing rude; 1,368 of them, so each word is 10.4 bits (tools/password.test.mjs counts them)
export const WORDS = Object.freeze(('able acid acre acting actor added admit adult after again agent agree ahead aim air alarm album alert alive allow alone along'
  + ' alter amber amount angle ankle annual answer anvil apple april apron arch area arena argue arise armor army aroma array arrow art ash aside asset atom'
  + ' attic audio august aunt autumn avenue avoid awake award aware away awful axis baby back bacon badge bagel baker ball bamboo banana band banjo bank'
  + ' barn barrel basic basket bath beach beam bean bear beauty beaver bed beef begin being bell belt bench berry best bike bird birth black blade blank'
  + ' blast blend blind block bloom blue board boat body bold bolt bone bonus book boot border boss bottle bounce bowl brain brand brass brave bread'
  + ' breeze brick bridge brief bright bring broad broken bronze brook broom brown brush bubble bucket budget buffalo build bulb bulk bundle burst bus'
  + ' bush butter button cabin cable cactus cake calm camel camera camp canal candle candy canoe canvas canyon cap car card cargo carpet carrot cart'
  + ' castle cat cave cedar cell cement census cereal chain chair chalk champ change charm chart chase cheese cherry chess chest chief child chill chip'
  + ' choir chord cider cinema circle city civil claim clap clay clean clear clerk cliff climb clock cloth cloud clover club coach coast coat cobalt'
  + ' cocoa coffee coin cold color column comet comic common copper coral cord corn corner cost cotton couch count course cousin cover crab craft crane'
  + ' crate crayon cream credit creek crew cricket crisp crop cross crowd crown crumb crust cube cup curve cycle daily dairy daisy dance dash dawn'
  + ' day deal debut decade deck deep deer degree delta denim dense depth desert desk dial diary dice diesel diet digit dime dinner dish dock dollar'
  + ' dome donkey door dot double dough dove down dozen draft dragon drama draw dream dress drift drill drink drive drop drum dry duck dune dust duty'
  + ' eager eagle early earth east easy echo edge eel effort eight elbow elder elm ember empire empty energy engine enjoy enter entry envy equal'
  + ' era error essay event ever evil exact exit extra fable fabric face fact fair faith falcon fall family fancy farm fast fault feast feather fence'
  + ' fern ferry fever few fiber field fifty fig figure film final find fine finger fire first fish five flag flame flash flat fleet flight float flock'
  + ' flood floor flour flower fluid flute foam focus fog foggy fold folk food foot force forest forge fork form fort fossil fox frame free fresh fridge'
  + ' friend frog front frost fruit fuel full funny fur future galaxy gallon game garden garlic gas gate gather gear gem genre gentle giant gift ginger'
  + ' giraffe glad glass glide globe glove glow glue goal goat gold golf good goose grace grade grain grand grape graph grass gravel gravy gray great'
  + ' green grid grill grin grip group grove grow guard guest guide guitar gulf gym habit hair half hall hammer hand happy harbor hard harp hat haven'
  + ' hawk hay hazel head heart heat heavy hedge helmet help herb hero hidden high hill hint hive hobby hockey hold hollow home honey hood hook hope horn'
  + ' horse host hotel hour house humble humor hunt hurry husky ice icon idea idle igloo image inch index indigo ink inner input iron island item ivory'
  + ' ivy jacket jade jaguar jam jar jazz jeans jelly jet jewel jigsaw job jog join joke jolly joy judge juice jump jungle junior jury just kayak keen'
  + ' keep kettle key kick kid kind king kiosk kite kitten kiwi knee knife knight knock knot koala label lace ladder lake lamp land lane lantern'
  + ' lap large laser last late laugh launch lava lawn layer lead leaf learn lease leather ledge left legal lemon lens level lever light lilac lily'
  + ' limb lime line linen link lion lip liquid list little lively lizard llama load loaf lobby local lock lodge loft log logic long loop lotus loud'
  + ' love lower loyal lucky lumber lunar lunch lung lyric magic magnet maid main major make mango manor map maple marble march market marsh mask'
  + ' mason match math matter maze meadow meal medal media melon memory menu mercy merit merry metal meter method middle might mild mile milk mill'
  + ' mind mint minute mirror mist mix model modern moment monkey month moon moral morning moss motor motto mount mouse mouth move movie much mud mule'
  + ' muse music nail name napkin narrow nature navy near neat neck needle nest net never new next nice nickel night nine noble noise noon normal north'
  + ' nose note novel number nurse nut oak oasis oat ocean offer office often oil olive omega onion open opera orange orbit orchid order organ origin'
  + ' otter ounce outer oval oven owl oxygen oyster pace pack paddle page paint pair palace palm panda panel paper parade parcel park parrot party'
  + ' pasta patch path patio pause peace peach peak peanut pear pearl pebble pedal pen pencil penny pepper period permit petal phone photo piano pick'
  + ' pickle picnic piece pier pigeon pillow pilot pine pink pipe pirate pistol pitch pixel pizza place plain plan plane planet plant plate play plaza'
  + ' plenty plow plum pocket poem poet point polar pole polish pond pony pool poppy porch port post pot potato pound powder power praise press pretty'
  + ' price pride prime print prism prize proof proud prune public pulse pump punch pupil puppy pure purple purse puzzle quail quart queen quest quick'
  + ' quiet quill quilt quiz quota rabbit race radar radio raft rail rain raise rally ranch range rapid raven ray razor reach ready realm reason'
  + ' rebel record reef relax relay relic remedy render rent repair reply rescue resort rest return rhythm ribbon rice rich ride ridge rifle right ring'
  + ' rinse ripe rise risk river road roast robin robot rock rocket rod roll roof room root rope rose round route rover row royal ruby rug rule rumor'
  + ' run rural rust saddle safe sage sail salad salmon salt sand satin sauce sauna saw scale scarf scene scent school scoop scope score scout scrap'
  + ' screen script sea seal season seat second secret seed seek sense serve seven shade shadow shape share shark sharp sheep sheet shelf shell shield'
  + ' shift shine ship shirt shoe shop shore short shout show shrimp shrub shut side sign silk silver simple sing single sink sister six size skate'
  + ' sketch ski skill skin skirt sky slate sled sleep slice slide slim slope slow small smart smile smoke snack snail snake snow soap soccer sock soda'
  + ' sofa soft soil solar solid solo song sonic sort soul sound soup source south space spade spark speak speed spell spend sphere spice spider spin'
  + ' spine spiral spirit splash sponge spoon sport spot spray spring spruce square squid stable stack staff stage stair stamp stand star start state'
  + ' steam steel steep stem step stew stick stiff still sting stir stock stone stool stop store storm story stove strap straw stream street string'
  + ' strong studio study stuff style sugar suit summer sun sunny super surf swamp swan sweet swift swim swing sword syrup table tail talent talk'
  + ' tall tank tape target task taste tax taxi tea teach team tempo ten tennis tent term thank theme thick thin thing think third thorn thread three'
  + ' thrive throne thumb ticket tide tiger tight tile timber time tin tiny tire title toast today toe tomato tone tool tooth topic torch total touch'
  + ' tour towel tower town toy track trade trail train travel tray treat tree trend trial tribe trick trip trophy truck trumpet trunk trust truth tube'
  + ' tulip tuna tune tunnel turbo turkey turn turtle twelve twig twin two type ultra umpire uncle under unify union unit unity upper urban usual utter'
  + ' valley value van vapor vast vault velvet venue verb verse very vessel vest video view villa vine vinyl violet violin visit vital vivid vocal'
  + ' voice volume vote vowel voyage wafer wagon waist wake walk wall walnut walrus wand want warm wash wasp watch water wave wax way wealth weave web'
  + ' week weight well west whale wheat wheel while whisk white whole wide wild willow win wind window wing winter wire wise wish witty wolf wonder wood'
  + ' wool word work world worth wrap wren wrist write yacht yard yarn year yellow yield yogurt young youth zebra zero zest zinc zone zoo').split(' '));

// ---- the generators
/** one password from the setting; a password that breaks a rule is thrown away and drawn again, so every allowed one is equally likely.
 *  rng(n) is an integer in [0, n) (below() by default). Throws on a setting that can make none (problemOf says why). */
export function generate(o = {}, rng = below) {
  const n = normalize(o), why = problemOf(n); if (why) throw new Error(why);
  const { classes, all } = alphabetOf(n), L = n.length;
  const seq = (a, b, c) => (a.charCodeAt(0) + 1 === b.charCodeAt(0) && b.charCodeAt(0) + 1 === c.charCodeAt(0)) || (a.charCodeAt(0) - 1 === b.charCodeAt(0) && b.charCodeAt(0) - 1 === c.charCodeAt(0));
  for (let tries = 0; tries < 10000; tries++) {
    let pool = all, out = '';
    for (let i = 0; i < L; i++) {
      // the characters still allowed here: no repeats drops the ones used; no three in a row drops the two that would end abc or cba
      let here = pool;
      if (n.noSequential && i >= 2) { const a = out[i - 2], b = out[i - 1], d = b.charCodeAt(0) - a.charCodeAt(0); if (d === 1 || d === -1) { const ban = String.fromCharCode(b.charCodeAt(0) + d); here = [...here].filter((c) => c !== ban).join(''); } }
      if (!here.length) { out = null; break; }
      const c = here[rng(here.length)]; out += c;
      if (n.noRepeat) pool = pool.replace(c, '');
    }
    if (out === null) continue;
    if (n.each && !classes.every((cl) => [...out].some((ch) => cl.chars.includes(ch)))) continue;
    return out;
  }
  throw new Error('Could not make a password that fits every rule.');
}
/** n passwords from the setting (1..MAX_COUNT). */
export const generateMany = (o = {}, n = 1, rng = below) => Array.from({ length: Math.max(1, Math.min(MAX_COUNT, Math.trunc(Number(n)) || 1)) }, () => generate(o, rng));

const PHRASE = Object.freeze({ words: 4, sep: '-', capitalize: false, digit: false });
export function normalizePhrase(o = {}) {
  const n = { ...PHRASE, ...o };
  n.words = Math.max(MIN_WORDS, Math.min(MAX_WORDS, Math.trunc(Number(n.words)) || PHRASE.words));
  n.sep = String(n.sep ?? '-').slice(0, 3); n.capitalize = !!n.capitalize; n.digit = !!n.digit;
  return n;
}
/** a passphrase: words from WORDS, joined by sep, each capitalised when asked, one digit 0-9 on the end when asked. */
export function passphrase(o = {}, rng = below) {
  const n = normalizePhrase(o);
  const ws = Array.from({ length: n.words }, () => WORDS[rng(WORDS.length)]).map((w) => (n.capitalize ? w[0].toUpperCase() + w.slice(1) : w));
  return ws.join(n.sep) + (n.digit ? String(rng(10)) : '');
}
/** the entropy of a passphrase setting in bits: words × log2(WORDS) (+ log2 10 for the digit; capitals add nothing, every word gets one). Pure. */
export const phraseBits = (o = {}) => { const n = normalizePhrase(o); return Math.round((n.words * Math.log2(WORDS.length) + (n.digit ? Math.log2(10) : 0)) * 10) / 10; };

// ---- strength, in words a person can weigh
const YEAR = 365.25 * 86400;
/** how long it takes to try every password of `bits` at `rate` a second: { seconds, text } in plain words. Pure. */
export function crackTime(bits, rate = RATE) {
  const seconds = 2 ** bits / rate;
  const one = (v, unit) => { const r = v < 10 ? Math.round(v * 10) / 10 : Math.round(v); return r.toLocaleString('en') + ' ' + unit + (r === 1 ? '' : 's'); };
  let text;
  if (seconds < 1) text = 'less than a second';
  else if (seconds < 60) text = one(seconds, 'second');
  else if (seconds < 3600) text = one(seconds / 60, 'minute');
  else if (seconds < 86400) text = one(seconds / 3600, 'hour');
  else if (seconds < YEAR) text = one(seconds / 86400, 'day');
  else if (seconds < 100 * YEAR) text = one(seconds / YEAR, 'year');
  else if (seconds < 1e3 * YEAR) text = one(seconds / (100 * YEAR), 'century').replace('centurys', 'centuries');
  else if (seconds < 1e6 * YEAR) text = one(seconds / (1e3 * YEAR), 'thousand year');
  else if (seconds < 1e9 * YEAR) text = one(seconds / (1e6 * YEAR), 'million year');
  else if (seconds < 1e12 * YEAR) text = one(seconds / (1e9 * YEAR), 'billion year');
  else if (seconds < 1e15 * YEAR) text = one(seconds / (1e12 * YEAR), 'trillion year');
  else text = 'longer than ' + (seconds / (13.8e9 * YEAR)).toExponential(0).replace('e+', ' × 10^') + ' times the age of the universe';
  return { seconds, text };
}
/** a strength label from bits (the thresholds /password-strength/ uses): 0 very weak .. 4 very strong. Pure. */
export function strengthOf(bits) {
  const score = bits < 28 ? 0 : bits < 36 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  return { score, label: ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'][score], bits, crack: crackTime(bits).text };
}

// ---- "remember me": each character as a word (the NATO alphabet for letters, number words, symbol names), as passwordsgenerator.net does
const NATO = 'alfa bravo charlie delta echo foxtrot golf hotel india juliett kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu'.split(' ');
const NUMS = 'ZERO ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE'.split(' ');
const SYMS = { '!': 'EXCLAMATION', '"': 'DOUBLE-QUOTE', '#': 'HASH', $: 'DOLLAR', '%': 'PERCENT', '&': 'AMPERSAND', "'": 'QUOTE', '(': 'OPEN-PAREN', ')': 'CLOSE-PAREN', '*': 'STAR', '+': 'PLUS', ',': 'COMMA', '-': 'HYPHEN', '.': 'DOT', '/': 'SLASH', ':': 'COLON', ';': 'SEMICOLON', '<': 'LESS-THAN', '=': 'EQUALS', '>': 'GREATER-THAN', '?': 'QUESTION', '@': 'AT', '[': 'OPEN-BRACKET', '\\': 'BACKSLASH', ']': 'CLOSE-BRACKET', '^': 'CARET', _: 'UNDERSCORE', '`': 'BACKTICK', '{': 'OPEN-BRACE', '|': 'PIPE', '}': 'CLOSE-BRACE', '~': 'TILDE', ' ': 'SPACE' };
/** a password read aloud, one word a character: "Zebra" for Z, "bravo" for b, "NINE" for 9, "HASH" for #. Pure. */
export function sayable(pw) {
  return [...String(pw || '')].map((c) => {
    if (/[a-z]/.test(c)) return NATO[c.charCodeAt(0) - 97];
    if (/[A-Z]/.test(c)) { const w = NATO[c.charCodeAt(0) - 65]; return w[0].toUpperCase() + w.slice(1); }
    if (/[0-9]/.test(c)) return NUMS[+c];
    return SYMS[c] || c;
  }).join(' ');
}
