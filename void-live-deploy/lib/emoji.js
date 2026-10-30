// The emoji this wall counts (owner, 2026-10-26: "the real-time emoji streaming engine for emojitracker").
//
// A closed list, like every tally (lib/tally.js): a copy is counted only if the emoji is on this list, and the
// list is a code change and a review, never a request. Names are here so the wall can be searched and so every
// row can be named for a screen reader, rather than being an unlabelled character.
//
// The count is of emojis copied FROM THIS PAGE. It is not a feed of anyone's messages and nothing else is ever
// sent: no text, no account, no address, only which emoji on this list was copied.

/** [{ c: the character, n: its name }], in name order. */
export const EMOJI = Object.freeze([
  { c: '😀', n: 'grinning face' }, { c: '😃', n: 'grinning face with big eyes' }, { c: '😄', n: 'grinning face with smiling eyes' },
  { c: '😁', n: 'beaming face' }, { c: '😆', n: 'grinning squinting face' }, { c: '😅', n: 'grinning face with sweat' },
  { c: '🤣', n: 'rolling on the floor laughing' }, { c: '😂', n: 'face with tears of joy' }, { c: '🙂', n: 'slightly smiling face' },
  { c: '🙃', n: 'upside down face' }, { c: '😉', n: 'winking face' }, { c: '😊', n: 'smiling face with smiling eyes' },
  { c: '😇', n: 'smiling face with halo' }, { c: '🥰', n: 'smiling face with hearts' }, { c: '😍', n: 'heart eyes' },
  { c: '🤩', n: 'star struck' }, { c: '😘', n: 'face blowing a kiss' }, { c: '😗', n: 'kissing face' },
  { c: '😚', n: 'kissing face with closed eyes' }, { c: '😋', n: 'face savouring food' }, { c: '😛', n: 'face with tongue' },
  { c: '😜', n: 'winking face with tongue' }, { c: '🤪', n: 'zany face' }, { c: '😝', n: 'squinting face with tongue' },
  { c: '🤑', n: 'money mouth face' }, { c: '🤗', n: 'hugging face' }, { c: '🤭', n: 'face with hand over mouth' },
  { c: '🤫', n: 'shushing face' }, { c: '🤔', n: 'thinking face' }, { c: '🤐', n: 'zipper mouth face' },
  { c: '🤨', n: 'raised eyebrow' }, { c: '😐', n: 'neutral face' }, { c: '😑', n: 'expressionless face' },
  { c: '😶', n: 'face without mouth' }, { c: '😏', n: 'smirking face' }, { c: '😒', n: 'unamused face' },
  { c: '🙄', n: 'face with rolling eyes' }, { c: '😬', n: 'grimacing face' }, { c: '😮‍💨', n: 'face exhaling' },
  { c: '🤥', n: 'lying face' }, { c: '😌', n: 'relieved face' }, { c: '😔', n: 'pensive face' },
  { c: '😪', n: 'sleepy face' }, { c: '🤤', n: 'drooling face' }, { c: '😴', n: 'sleeping face' },
  { c: '😷', n: 'face with medical mask' }, { c: '🤒', n: 'face with thermometer' }, { c: '🤕', n: 'face with head bandage' },
  { c: '🤢', n: 'nauseated face' }, { c: '🤮', n: 'vomiting face' }, { c: '🤧', n: 'sneezing face' },
  { c: '🥵', n: 'hot face' }, { c: '🥶', n: 'cold face' }, { c: '🥴', n: 'woozy face' },
  { c: '😵', n: 'dizzy face' }, { c: '🤯', n: 'exploding head' }, { c: '🤠', n: 'cowboy hat face' },
  { c: '🥳', n: 'partying face' }, { c: '😎', n: 'smiling face with sunglasses' }, { c: '🤓', n: 'nerd face' },
  { c: '🧐', n: 'face with monocle' }, { c: '😕', n: 'confused face' }, { c: '😟', n: 'worried face' },
  { c: '🙁', n: 'slightly frowning face' }, { c: '😮', n: 'face with open mouth' }, { c: '😯', n: 'hushed face' },
  { c: '😲', n: 'astonished face' }, { c: '😳', n: 'flushed face' }, { c: '🥺', n: 'pleading face' },
  { c: '😦', n: 'frowning face with open mouth' }, { c: '😧', n: 'anguished face' }, { c: '😨', n: 'fearful face' },
  { c: '😰', n: 'anxious face with sweat' }, { c: '😥', n: 'sad but relieved face' }, { c: '😢', n: 'crying face' },
  { c: '😭', n: 'loudly crying face' }, { c: '😱', n: 'screaming in fear' }, { c: '😖', n: 'confounded face' },
  { c: '😣', n: 'persevering face' }, { c: '😞', n: 'disappointed face' }, { c: '😓', n: 'downcast face with sweat' },
  { c: '😩', n: 'weary face' }, { c: '😫', n: 'tired face' }, { c: '🥱', n: 'yawning face' },
  { c: '😤', n: 'face with steam from nose' }, { c: '😡', n: 'enraged face' }, { c: '😠', n: 'angry face' },
  { c: '🤬', n: 'face with symbols on mouth' }, { c: '😈', n: 'smiling face with horns' }, { c: '👿', n: 'angry face with horns' },
  { c: '💀', n: 'skull' }, { c: '💩', n: 'pile of poo' }, { c: '🤡', n: 'clown face' },
  { c: '👻', n: 'ghost' }, { c: '👽', n: 'alien' }, { c: '🤖', n: 'robot' },
  { c: '😺', n: 'grinning cat' }, { c: '😹', n: 'cat with tears of joy' }, { c: '😻', n: 'heart eyes cat' },
  { c: '🙀', n: 'weary cat' }, { c: '😿', n: 'crying cat' }, { c: '🙈', n: 'see no evil monkey' },
  { c: '🙉', n: 'hear no evil monkey' }, { c: '🙊', n: 'speak no evil monkey' }, { c: '❤️', n: 'red heart' },
  { c: '🧡', n: 'orange heart' }, { c: '💛', n: 'yellow heart' }, { c: '💚', n: 'green heart' },
  { c: '💙', n: 'blue heart' }, { c: '💜', n: 'purple heart' }, { c: '🖤', n: 'black heart' },
  { c: '🤍', n: 'white heart' }, { c: '💔', n: 'broken heart' }, { c: '💯', n: 'hundred points' },
  { c: '🔥', n: 'fire' }, { c: '✨', n: 'sparkles' }, { c: '🎉', n: 'party popper' },
  { c: '👍', n: 'thumbs up' }, { c: '👎', n: 'thumbs down' }, { c: '👏', n: 'clapping hands' },
  { c: '🙏', n: 'folded hands' }, { c: '💪', n: 'flexed biceps' }, { c: '🤝', n: 'handshake' },
  { c: '👀', n: 'eyes' }, { c: '🧠', n: 'brain' }, { c: '🚀', n: 'rocket' },
  { c: '☕', n: 'hot beverage' }, { c: '🍕', n: 'pizza' }, { c: '🍰', n: 'shortcake' },
  { c: '🌈', n: 'rainbow' }, { c: '🌙', n: 'crescent moon' }, { c: '⭐', n: 'star' },
  { c: '🌊', n: 'water wave' }, { c: '🌸', n: 'cherry blossom' },
]);

/** the characters, which is what the closed tally list holds */
export const EMOJI_CHARS = Object.freeze(EMOJI.map((e) => e.c));

/** the name of one character, for a row's label ('an emoji not on the list' if it is not) */
export const nameOf = (c) => (EMOJI.find((e) => e.c === c) || { n: 'an emoji not on the list' }).n;
