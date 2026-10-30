// Emoji combos (/emoji-combos/; against emojicombos.com, 2026-10-30, the next site in the ranking smallest first): a tagged catalog of emoji
// combinations, kaomoji and text art to search and copy, with fancy text, image-to-dot-art, a box that collects several, and combos of your own.
//
// The catalog is written for Verse, not copied from emojicombos.com's database: its count is what it is (catalogStats()), never padded.
// Your own combos and the ones you save stay on this device (lib/emoji-combos.js state, localStorage); nothing is sent anywhere.
// Pure except loadState() and saveState(). Tests: tools/emoji-combos.test.mjs.

/** [combo text, tags]: each tag a word a person types to find it. */
const RAW = [
  // animals
  ['🐱💕🐾', 'cat kitty animal love'], ['₍^. .^₎⟆', 'cat kitty kaomoji cute'], ['(=^･ω･^=)', 'cat kitty kaomoji'], ['ฅ^•ﻌ•^ฅ', 'cat kitty kaomoji paws cute'],
  ['🐈‍⬛🌙✨', 'cat black cat night halloween'], ['😺🧶', 'cat kitty play'], ['🐱☕📖', 'cat cozy coffee book'],
  ['🐶🦴💛', 'dog puppy animal'], ['U・ᴥ・U', 'dog puppy kaomoji'], ['▼・ᴥ・▼', 'dog puppy kaomoji'], ['🐕🎾🌳', 'dog puppy play park'], ['🐾🐶🐾', 'dog puppy paws'],
  ['ʕ•ᴥ•ʔ', 'bear kaomoji cute'], ['ʕっ•ᴥ•ʔっ', 'bear hug kaomoji'], ['ʕ ·ᴥ·ʔ🍯', 'bear honey kaomoji'], ['🧸🎀💤', 'bear teddy cute sleep'],
  ['(\\_/)\n( •.•)\n/ >🥕', 'bunny rabbit text art carrot'], ['🐰🌸🥚', 'bunny rabbit easter spring'], ['૮ ˶ᵔ ᵕ ᵔ˶ ა', 'bunny cute kaomoji kawaii'],
  ['🐦🎶🌿', 'bird music nature'], ['(・θ・)', 'bird kaomoji'], ['🦜🌴', 'bird parrot tropical'],
  ['🐠🐟🐡', 'fish ocean sea'], ['><(((º>', 'fish text art'], ['🌊🐚🐬', 'ocean sea beach dolphin'], ['🐳💦', 'whale ocean sea'],
  ['🦄🌈✨', 'unicorn rainbow magic'], ['🐸☕', 'frog tea'], ['🐼🎋', 'panda bamboo'], ['🦊🍂', 'fox autumn'],
  // feelings
  ['💕💞💓', 'love heart hearts'], ['(♡˙︶˙♡)', 'love heart kaomoji'], ['(｡♥‿♥｡)', 'love heart kaomoji happy'], ['💌🌹💋', 'love valentine kiss rose'],
  ['❤️‍🔥💘', 'love heart fire'], ['🫶💗', 'love heart hands'], ['♡⸝⸝', 'love heart blush cute'],
  ['(◕‿◕)', 'happy smile kaomoji'], ['٩(◕‿◕)۶', 'happy yay kaomoji'], ['😄🌈☀️', 'happy rainbow sun'], ['(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', 'happy magic sparkle kaomoji'], ['ヽ(•‿•)ノ', 'happy yay kaomoji'],
  ['(╥﹏╥)', 'sad cry kaomoji'], ['(ᗒᗣᗕ)՞', 'sad cry kaomoji'], ['😢💧🌧️', 'sad cry rain'], ['(｡•́︿•̀｡)', 'sad pout kaomoji cute'], ['( ˘︹˘ )', 'sad pout kaomoji'],
  ['(╬ಠ益ಠ)', 'angry mad kaomoji'], ['(ノಠ益ಠ)ノ彡┻━┻', 'angry mad table flip kaomoji'], ['😤💢🔥', 'angry mad fire'], ['ಠ_ಠ', 'disapproval stare kaomoji'], ['(¬_¬)', 'suspicious stare kaomoji'],
  ['¯\\_(ツ)_/¯', 'shrug whatever kaomoji'], ['🤷‍♀️🤷🤷‍♂️', 'shrug whatever'], ['┐(￣ヘ￣)┌', 'shrug whatever kaomoji'],
  ['(っ◔◡◔)っ ♥', 'hug love kaomoji'], ['(づ｡◕‿‿◕｡)づ', 'hug kaomoji cute'], ['🫂💗', 'hug love'],
  ['😘💋', 'kiss love'], ['(˘³˘)♥', 'kiss love kaomoji'],
  ['🤣🤣🤣', 'laugh lol funny'], ['(≧▽≦)', 'laugh happy kaomoji'], ['😂👌', 'laugh lol funny'],
  ['😱‼️', 'shock surprise scared'], ['(⊙_⊙)', 'shock surprise kaomoji'], ['Σ(°ロ°)', 'shock surprise kaomoji'],
  ['😎🤙', 'cool chill'], ['(⌐■_■)', 'cool sunglasses kaomoji'], ['🆒🔥', 'cool fire'],
  ['(✿◠‿◠)', 'cute kawaii flower kaomoji'], ['(◕ᴗ◕✿)', 'cute kawaii kaomoji'], ['🎀🍓🐰', 'cute kawaii bunny pink'], ['꒰ᐢ. .ᐢ꒱', 'cute kawaii kaomoji'],
  ['😴💤🛏️', 'sleep tired night'], ['(￣o￣) zzZZ', 'sleep tired kaomoji'], ['(－_－) zzZ', 'sleep tired kaomoji'], ['🌙😪', 'sleep tired night'],
  ['👋😊', 'hello hi wave'], ['(・ω・)ﾉ', 'hello hi wave kaomoji'], ['ヾ(＾∇＾)', 'hello hi wave kaomoji'], ['bye bye 👋✨', 'bye goodbye wave'],
  ['🙏💖', 'thanks thank you'], ['(人´∀`)', 'thanks please kaomoji'], ['👍✅', 'yes ok done'], ['👌😁', 'yes ok'], ['🙅‍♀️❌', 'no nope'], ['✋🚫', 'no stop'],
  // seasons and weather
  ['🌸🌷🌼', 'flower flowers spring'], ['✿◕ ‿ ◕✿', 'flower cute kaomoji'], ['💐🌹🌺', 'flower flowers bouquet'], ['❀ ❀ ❀', 'flower text art'],
  ['☀️🏖️🍹', 'summer beach sun holiday'], ['🌴🌊🌞', 'summer beach ocean sun tropical'], ['🍉🍦😎', 'summer food cool'], ['🕶️🏄‍♂️🌊', 'summer beach surf ocean'],
  ['❄️⛄☃️', 'winter snow snowman christmas'], ['🧣🧤☕', 'winter cozy coffee'], ['🎿🏔️❄️', 'winter snow ski mountain'],
  ['🌧️☔💧', 'rain weather'], ['☁️💧💧💧', 'rain weather text art'], ['⛈️⚡', 'storm weather thunder'],
  ['🌙✨⭐', 'moon night star stars'], ['🌌🔭🌠', 'space night star stars'], ['⋆｡°✩', 'star stars sparkle text art'], ['☾ ⋆*･ﾟ:⋆*･ﾟ', 'moon night star stars text art'],
  ['🍂🍁🎃', 'autumn fall halloween'], ['🍁☕🧣', 'autumn fall cozy coffee'], ['🌸🐣🌷', 'spring easter flower'], ['🌱🌼🐝', 'spring flower bee nature'],
  ['🌲🍄🌿', 'forest nature mushroom'], ['🌳🦌🍂', 'forest nature autumn'], ['🍃🌱🌻', 'nature plant sunflower'],
  // occasions
  ['🎂🎉🎁', 'birthday party gift cake'], ['🎈🥳🎊', 'birthday party celebrate'], ['ʜᴀᴘᴘʏ ʙɪʀᴛʜᴅᴀʏ 🎂', 'birthday cake happy birthday'], ['🕯️🎂🕯️', 'birthday cake candles'],
  ['🎉🪩💃', 'party dance celebrate'], ['🥂🍾🎊', 'party celebrate new year cheers'], ['ヾ(⌐■_■)ノ♪', 'party dance cool kaomoji music'],
  ['🎄🎅🎁', 'christmas xmas holiday gift'], ['⛄❄️🎄', 'christmas winter snow'], ['🦌🛷✨', 'christmas reindeer sleigh'], ['🔔🎶🎄', 'christmas music bells'],
  ['🎃👻🦇', 'halloween spooky'], ['💀🕸️🕷️', 'halloween spooky spider'], ['🧙‍♀️🔮🌕', 'halloween witch magic moon'], ['👻 boo', 'halloween ghost spooky'],
  ['💍💒🥂', 'wedding love marriage'], ['🎓📜🎉', 'graduation school celebrate'], ['🍀🌈💰', 'luck lucky st patricks'],
  // food and drink
  ['🍕🍕🍕', 'pizza food'], ['🍔🍟🥤', 'burger food fast food'], ['🍣🍱🍜', 'sushi food japanese'], ['🌮🌯🥑', 'taco food mexican'], ['(っ˘ڡ˘ς)', 'food yummy hungry kaomoji'],
  ['☕📖🍂', 'coffee book cozy autumn'], ['☕✨😌', 'coffee calm morning'], ['( ˘▽˘)っ♨', 'coffee tea hot kaomoji'], ['🍰🍓', 'cake food sweet'], ['🧁🎀', 'cake cupcake cute sweet'],
  ['🍩🍪🍫', 'sweet food dessert'], ['🍓🍒🍑', 'fruit food'], ['🍿🎬', 'movie popcorn film'],
  // things people do
  ['🎶🎧💃', 'music dance'], ['♪♫♬', 'music notes text art'], ['🎸🤘🔥', 'music rock guitar fire'], ['┏(・o・)┛♪┗ (・o・) ┓', 'dance music kaomoji'], ['🎤🎵', 'music sing karaoke'],
  ['📚✏️🎒', 'school study back to school'], ['🧠📖☕', 'study school coffee'], ['🖊️📝', 'study write notes'],
  ['⚽🥅🏆', 'football soccer sport'], ['🏀🔥', 'basketball sport fire'], ['🏈🏟️', 'american football sport'], ['🎾🏸🏓', 'tennis sport'], ['🏋️‍♀️💪', 'gym workout fitness sport'],
  ['🎮👾🕹️', 'gaming game video game'], ['🏆🎮🔥', 'gaming game win'], ['⬆️⬆️⬇️⬇️⬅️➡️⬅️➡️🅱️🅰️', 'gaming game cheat code'],
  ['✈️🌍🧳', 'travel holiday trip'], ['🚗💨🛣️', 'travel road trip car'], ['💻☕⌨️', 'work coding computer coffee'], ['🐛🔨💻', 'coding bug fix computer'],
  ['💸💰🤑', 'money rich cash'], ['💵💵💵', 'money cash'], ['📈💎🙌', 'money stocks'],
  // magic, space and fire
  ['✨🔮🪄', 'magic sparkle witch'], ['🧚‍♀️✨🌸', 'magic fairy flower'], ['(∩^o^)⊃━☆ﾟ.*･｡ﾟ', 'magic wand sparkle kaomoji'],
  ['🚀🪐👽', 'space rocket alien'], ['🌍🌕🛰️', 'space earth moon'], ['👾🛸', 'space alien ufo gaming'],
  ['🔥🔥🔥', 'fire hot lit'], ['🔥💯', 'fire hundred lit'], ['🌈✨🦋', 'rainbow butterfly sparkle'],
  // text art and borders
  ['▁▂▃▄▅▆▇█', 'text art bar loading'], ['･ﾟ✧*:･ﾟ✧', 'sparkle text art border'], ['꧁༺ ༻꧂', 'border text art name'], ['•°¯`•• ••´¯°•', 'border text art'],
  ['╔════╗\n║ ♡ ║\n╚════╝', 'text art box border love heart'], ['(╯°□°)╯︵ ┻━┻', 'table flip angry kaomoji'], ['┬─┬ノ( º _ ºノ)', 'table unflip calm kaomoji'],
  // dot art: drawn with brailleArt() below from a heart, a star and a smiling face worked out as shapes
  ['⠀⠀⢀⣀⣀⠀⠀⣀⣀⡀⠀⠀\n⠀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣷⠀\n⠐⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠂\n⠀⢻⣿⣿⣿⣿⣿⣿⣿⣿⡟⠀\n⠀⠀⠙⢿⣿⣿⣿⣿⡿⠋⠀⠀\n⠀⠀⠀⠀⠉⠻⠟⠉⠀⠀⠀⠀', 'dot art braille text art heart love'], ['⠀⠀⠀⠀⢠⣶⣶⡄⠀⠀⠀⠀\n⠀⣀⣤⣀⢸⣿⣿⡇⣀⣤⣀⠀\n⠸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠇\n⠀⠈⢉⣿⣿⣿⣿⣿⣿⡉⠁⠀\n⠀⠀⣾⣿⣿⡟⢻⣿⣿⣷⠀⠀\n⠀⠀⠈⠛⠉⠀⠀⠉⠛⠁⠀⠀', 'dot art braille text art star'], ['⠀⠀⣀⡤⠖⠒⠒⠲⢤⣀⠀⠀\n⠀⡼⠋⢀⡀⠀⠀⢀⡀⠙⢧⠀\n⢸⠁⠀⠙⠃⠀⠀⠘⠋⠀⠈⡇\n⢸⡀⠐⣦⠀⠀⠀⠀⣴⠂⢀⡇\n⠀⢳⣄⠈⠛⠲⠖⠛⠁⣠⡞⠀\n⠀⠀⠉⠓⠦⠤⠤⠴⠚⠉⠀⠀', 'dot art braille text art smile happy'],
];

/** the catalog, each combo with its tags: frozen. */
export const COMBOS = Object.freeze(RAW.map(([t, tags], i) => Object.freeze({ id: i, t, tags: Object.freeze(tagList(tags)) })));

/** a tags string as its words: lower case, no repeats. Pure. */
function tagList(s) {
  const w = String(s).toLowerCase().split(/[\s,]+/).filter(Boolean), out = [];
  for (const t of w) if (!out.includes(t)) out.push(t);
  return out;
}

/** words people type for a tag the catalog files under another word. */
export const ALIASES = Object.freeze({
  kitten: 'cat', kittens: 'cat', kitties: 'cat', meow: 'cat', puppies: 'dog', doggo: 'dog', pup: 'dog', rabbit: 'bunny', bunnies: 'bunny', teddy: 'bear',
  hearts: 'heart', valentine: 'love', valentines: 'love', crying: 'cry', tears: 'cry', smile: 'happy', smiley: 'happy', joy: 'happy', yay: 'happy',
  mad: 'angry', rage: 'angry', lol: 'laugh', lmao: 'laugh', funny: 'laugh', hi: 'hello', hey: 'hello', goodbye: 'bye', thank: 'thanks', ty: 'thanks',
  xmas: 'christmas', bday: 'birthday', spooky: 'halloween', ghost: 'halloween', fall: 'autumn', sea: 'ocean', stars: 'star', snowman: 'snow',
  soccer: 'football', game: 'gaming', games: 'gaming', gamer: 'gaming', song: 'music', notes: 'music', kawai: 'kawaii', uwu: 'cute', aesthetic: 'sparkle',
  tired: 'sleep', sleepy: 'sleep', cash: 'money', rich: 'money', code: 'coding', programming: 'coding', holiday: 'travel', trip: 'travel',
});

const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s'-]+/gu, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['a', 'an', 'the', 'and', 'of', 'for', 'with', 'emoji', 'emojis', 'combo', 'combos', 'combination', 'combinations', 'kaomojis', 'face', 'faces']);

/** whole phrases people type for one tag. */
const PHRASES = Object.freeze([['happy birthday', 'birthday'], ['merry christmas', 'christmas'], ['happy halloween', 'halloween'], ['happy new year', 'new year'],
  ['good night', 'night'], ['good morning', 'morning'], ['thank you', 'thanks'], ['i love you', 'love'], ['love you', 'love'], ['miss you', 'love'], ['video game', 'gaming']]);
/** the words of a search, each mapped to the tag it means (a phrase, an alias, a plural). Pure. */
export function queryWords(q) {
  let s = norm(q); for (const [p, t] of PHRASES) s = s.replace(new RegExp('\\b' + p + '\\b', 'g'), t);
  return s.split(' ').filter((w) => w && !STOP.has(w)).map((w) => ALIASES[w] || (w.length > 3 && w.endsWith('s') && TAG_SET.has(w.slice(0, -1)) ? w.slice(0, -1) : w));
}

/** every tag with how many combos it has, most first. Pure. */
export function tagCounts(list = COMBOS) {
  const m = new Map(); for (const c of list) for (const t of c.tags) m.set(t, (m.get(t) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, n]) => ({ tag, n }));
}
const TAG_SET = new Set(COMBOS.flatMap((c) => c.tags));

/** how well one combo's tags answer one word: 3 a tag, 1 a tag that starts with it (3 letters or more), 0 none. Pure. */
const wordScore = (tags, w) => (tags.includes(w) ? 3 : w.length >= 3 && tags.some((t) => t.startsWith(w)) ? 1 : 0);

/** the combos for a search, best first: every word must match a tag; when none match all, the ones that match any. An empty search: none. Pure. */
export function search(q, list = COMBOS) {
  const words = queryWords(q); if (!words.length) return [];
  const scored = list.map((c, i) => { const s = words.map((w) => wordScore(c.tags, w)); return { c, i, all: s.every((x) => x > 0), sum: s.reduce((a, b) => a + b, 0) }; }).filter((r) => r.sum > 0);
  const all = scored.filter((r) => r.all), pick = all.length ? all : scored;
  return pick.sort((a, b) => b.sum - a.sum || a.i - b.i).map((r) => r.c);
}

/** what the catalog holds, counted, never padded. Pure. */
export function catalogStats(list = COMBOS) { return { combos: list.length, tags: new Set(list.flatMap((c) => c.tags)).size }; }

// ---- single emoji (lib/emoji.js: the 134 /emojis/ counts, with their names)

const NAME_STOP = new Set(['face', 'with', 'and', 'the', 'a', 'of', 'big', 'eyes', 'smiling', 'button']);
/** the emoji whose names hold every word of the search (aliases mapped), in list order. Pure. */
export function findEmoji(q, emoji) {
  const raw = norm(q).split(' ').filter(Boolean); if (!raw.length) return [];
  const words = raw.map((w) => ALIASES[w] || w);
  return emoji.filter((e) => words.every((w, k) => e.n.includes(w) || e.n.includes(raw[k]) || e.c === q.trim()));
}
/** up to n emoji whose names share a meaningful word with this one's (not "face" or "with"). Pure. */
export function similarEmoji(c, emoji, n = 8) {
  const me = emoji.find((e) => e.c === c); if (!me) return [];
  const words = me.n.split(' ').filter((w) => !NAME_STOP.has(w)); if (!words.length) return [];
  return emoji.filter((e) => e.c !== c && e.n.split(' ').some((w) => words.includes(w))).slice(0, n);
}

// ---- fancy text: the Unicode letter styles (Mathematical Alphanumeric Symbols and friends), letter for letter

const range = (upper, lower, digits, holes = {}) => (ch) => {
  if (holes[ch]) return holes[ch];
  const c = ch.codePointAt(0);
  if (upper != null && c >= 65 && c <= 90) return String.fromCodePoint(upper + c - 65);
  if (lower != null && c >= 97 && c <= 122) return String.fromCodePoint(lower + c - 97);
  if (digits != null && c >= 48 && c <= 57) return String.fromCodePoint(digits + c - 48);
  return ch;
};
const table = (from, to) => { const a = Array.from(from), b = Array.from(to), m = {}; a.forEach((ch, i) => { m[ch] = b[i]; }); return (ch) => m[ch] || m[ch.toLowerCase()] || ch; };
const UPSIDE = table("abcdefghijklmnopqrstuvwxyz.,?!'()[]{}<>_&", "ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz˙'¿¡,)(][}{><‾⅋");

/** the styles, in the order the page lists them: [name, how one character is written]. */
export const STYLES = Object.freeze([
  ['Bold', range(0x1D400, 0x1D41A, 0x1D7CE)],
  ['Italic', range(0x1D434, 0x1D44E, null, { h: 'ℎ' })],
  ['Bold italic', range(0x1D468, 0x1D482, null)],
  ['Script', range(0x1D49C, 0x1D4B6, null, { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' })],
  ['Bold script', range(0x1D4D0, 0x1D4EA, null)],
  ['Fraktur', range(0x1D504, 0x1D51E, null, { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' })],
  ['Double-struck', range(0x1D538, 0x1D552, 0x1D7D8, { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' })],
  ['Sans bold', range(0x1D5D4, 0x1D5EE, 0x1D7EC)],
  ['Monospace', range(0x1D670, 0x1D68A, 0x1D7F6)],
  ['Circled', (ch) => (ch === '0' ? '⓪' : /[1-9]/.test(ch) ? String.fromCodePoint(0x2460 + Number(ch) - 1) : range(0x24B6, 0x24D0, null)(ch))],
  ['Squared', (ch) => range(0x1F130, null, null)(ch.toUpperCase())],
  ['Full width', (ch) => { const c = ch.codePointAt(0); return ch === ' ' ? '　' : c >= 0x21 && c <= 0x7E ? String.fromCodePoint(c + 0xFEE0) : ch; }],
  ['Small caps', table('abcdefghijklmnopqrstuvwxyz', 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ')],
  ['Upside down', null], // written by fancy(): mapped and read backwards
  ['Strikethrough', (ch) => (ch === ' ' || ch === '\n' ? ch : ch + '̶')],
  ['Underline', (ch) => (ch === '\n' ? ch : ch + '̲')],
]);

/** one text in one style (by name), letter for letter; what a style has no letter for stays as it is. Pure. */
export function fancy(text, style) {
  const s = String(text == null ? '' : text).slice(0, 2000), chars = Array.from(s);
  if (style === 'Upside down') return chars.map((ch) => UPSIDE(ch)).reverse().join('');
  const f = (STYLES.find((x) => x[0] === style) || [])[1]; if (!f) return s;
  return chars.map(f).join('');
}
/** the text in every style: [{ style, text }]. Pure. */
export const fancyAll = (text) => STYLES.map(([style]) => ({ style, text: fancy(text, style) }));

// ---- dot art: a picture as Braille cells, each cell 2 dots wide and 4 high (U+2800 + the dots that are set)

const DOT = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]]; // [row][column] -> the dot's bit (dots 1-8)
/**
 * Braille dot art from a grey picture: gray is w*h brightness 0 (black) .. 255 (white), row by row. A dot is set where the picture is darker
 * than the threshold (or lighter, with invert), so dark ink on white paper comes out as dots. A cell with no dot is U+2800, never a space,
 * so the shape keeps its width when pasted. Lines are joined with \n. Pure.
 */
export function brailleArt(gray, w, h, { threshold = 128, invert = false } = {}) {
  const lines = [];
  for (let y = 0; y < h; y += 4) {
    let line = '';
    for (let x = 0; x < w; x += 2) {
      let bits = 0;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
        const px = x + c, py = y + r; if (px >= w || py >= h) continue;
        const v = gray[py * w + px], on = invert ? v >= threshold : v < threshold;
        if (on) bits |= DOT[r][c];
      }
      line += String.fromCodePoint(0x2800 + bits);
    }
    lines.push(line);
  }
  return lines.join('\n');
}
/** the grey of an RGBA pixel buffer (ImageData.data), transparent counted as white. Pure. */
export function grayOf(rgba, w, h) {
  const g = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) { const a = rgba[i * 4 + 3] / 255; const y = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]; g[i] = Math.round(y * a + 255 * (1 - a)); }
  return g;
}
/** a cell grid's size in pixels for a picture of iw x ih at cols cells wide (2 x 4 dots a cell; cells are about twice as high as wide). Pure. */
export function dotSize(iw, ih, cols) { const w = Math.max(2, Math.round(cols) * 2); const h = Math.max(4, Math.round((w * ih) / iw / 4) * 4); return { w, h }; }
/** dot art turned the other way: every dot set becomes unset. Pure. */
export const invertDots = (art) => Array.from(String(art)).map((ch) => { const c = ch.codePointAt(0); return c >= 0x2800 && c <= 0x28FF ? String.fromCodePoint(0x2800 + (0xFF ^ (c - 0x2800))) : ch; }).join('');

// ---- the link: the search and what was collected travel in it (no account, nothing stored anywhere else)

const MAX_LINK = 1500;
/** the page's address for a search and a collected combo. Pure. */
export function linkOf({ q = '', c = '' } = {}, base = '/emoji-combos/') {
  const p = new URLSearchParams(); if (String(q).trim()) p.set('q', String(q).trim().slice(0, 100)); if (String(c)) p.set('c', String(c).slice(0, MAX_LINK));
  const s = p.toString(); return base + (s ? '?' + s : '');
}
/** what a link carries: { q, c, t } (t: text handed over by another page, for the fancy text box). Pure. */
export function fromLink(search) {
  const p = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  return { q: (p.get('q') || '').slice(0, 100), c: (p.get('c') || '').slice(0, MAX_LINK), t: (p.get('t') || '').slice(0, 2000) };
}

// ---- your own combos and the saved ones, on this device

export const STORE_KEY = 'a2m.void.emoji-combos.v1';
const MAX_MINE = 200, MAX_TEXT = 2000;
/** a fresh state: { mine: [{ t, tags }], saved: [combo text] }. Pure. */
export const emptyState = () => ({ mine: [], saved: [] });
/** a state read back, kept to its shape whatever was stored. Pure. */
export function cleanState(s) {
  const o = s && typeof s === 'object' ? s : {};
  const mine = Array.isArray(o.mine) ? o.mine.filter((m) => m && typeof m.t === 'string' && m.t.trim()).slice(0, MAX_MINE).map((m) => ({ t: m.t.slice(0, MAX_TEXT), tags: Array.isArray(m.tags) ? m.tags.map(String).slice(0, 8) : [] })) : [];
  const saved = Array.isArray(o.saved) ? [...new Set(o.saved.filter((x) => typeof x === 'string' && x))].slice(0, 500) : [];
  return { mine, saved };
}
/** your combo added (tags split on commas or spaces, lower case, up to 8, "yours" always one): { state, error }. Pure. */
export function addMine(state, text, tagsText) {
  const t = String(text == null ? '' : text).replace(/\s+$/g, '');
  if (!t.trim()) return { state, error: 'Type or collect a combo first.' };
  if (t.length > MAX_TEXT) return { state, error: 'That combo is longer than ' + MAX_TEXT + ' characters.' };
  if (state.mine.some((m) => m.t === t)) return { state, error: 'That combo is already one of yours.' };
  const tags = ['yours', ...tagList(String(tagsText || '').replace(/[^\p{L}\p{N}\s,'-]+/gu, ' ')).filter((x) => x !== 'yours')].slice(0, 8);
  return { state: { ...state, mine: [{ t, tags }, ...state.mine].slice(0, MAX_MINE) }, error: '' };
}
/** your combo taken out. Pure. */
export const removeMine = (state, t) => ({ ...state, mine: state.mine.filter((m) => m.t !== t) });
/** a combo saved, or unsaved if it was. Pure. */
export const toggleSaved = (state, t) => ({ ...state, saved: state.saved.includes(t) ? state.saved.filter((x) => x !== t) : [t, ...state.saved] });
/** the catalog with your combos first, as combos (ids "m0", "m1", ...). Pure. */
export const withMine = (state) => [...state.mine.map((m, i) => ({ id: 'm' + i, t: m.t, tags: m.tags, mine: true })), ...COMBOS];

export function loadState(store = globalThis.localStorage) { try { return cleanState(JSON.parse(store.getItem(STORE_KEY) || 'null')); } catch (_) { return emptyState(); } }
export function saveState(state, store = globalThis.localStorage) { try { store.setItem(STORE_KEY, JSON.stringify(cleanState(state))); return true; } catch (_) { return false; } }
