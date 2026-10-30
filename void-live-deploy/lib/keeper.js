// Verse keeps secrets, and turns every negative ask into a positive one (owner, 2026-10-15: "make Verse the best at keeping
// secrets ever made"; "Verse always should turn every negative ask into a positive thing; Verse is a force of absolute good
// in the universe"). keeperOf(ask) answers, before any model or skill sees the ask, the asks that try to pull out env
// vars, keys, the system prompt or other visitors' data (prompt injection included), and the mean or harmful ones. It
// never just says no: each reply declines in one line and offers the nearest genuinely good thing. It never gives the
// harmful help itself. Pure; answer.js calls it first, and tools/keeper.test.mjs is the red-team suite.

const RULES = [
  { kind: 'secret', re: /\b(print|show|dump|list|reveal|give|tell|what(?:'s| is| are)|echo|cat|read|leak|output)\b.{0,40}\b(env(ironment)?( var(iable)?s?)?|process\.env|api ?keys?|(your |the |(?:verse|v01d)'?s |site'?s |server'?s |admin |all )secrets?|(access |api |auth |bearer |your |github |owner )tokens?|(your |admin |the |owner )passwords?|credentials?|private keys?|\.env|wrangler secrets?|owner key|cloudflare (key|token)|stripe (key|secret)|gumroad (key|token))\b/i,
    say: "I keep my keys and settings locked away, so nobody (me included) can hand them out. Here's the useful part: I can show you how to keep your own keys safe, with env-only secrets, a .env in .gitignore, a secret scanner before every push, and rotating anything that ever leaked. Want the checklist?" },
  { kind: 'prompt', re: /\b(system prompt|your (instructions|prompt|rules|hidden prompt)|initial prompt|developer message|ignore (all |any |the )?(previous|prior|above) (instructions|rules)|disregard (your|all) (rules|instructions)|you are now (dan|jailbroken|unrestricted)|jailbreak|developer mode|repeat the (text|words) above)\b/i,
    say: "My instructions stay private, and nobody can talk me out of them. What I can do is tell you openly what I am and how I work, or help you write a strong prompt of your own. Which one?" },
  { kind: 'others', re: /\b(what|who|show|list|tell)\b.{0,30}\b(last|previous|other|another|every|all)\b.{0,15}\b(users?|visitors?|people|person|someone)\b.{0,30}\b(ask|asked|say|said|type|typed|search|wrote|data|history|email|ip|chats?)\b|\b(what|who)\b.{0,15}\b(someone|anyone|anybody|people|others)\b.{0,10}\b(asked|said|typed|told) (you|(?:verse|v01d)|(?:verse|void)|verse)\b|\b(other (users?|visitors?|people)'?s?|someone else'?s) (data|asks|chats|messages|history|emails?)\b/i,
    say: "What other people ask me stays theirs, the same way what you ask stays yours. I'm glad to share the popular topics in general, or pick up anything you'd like to explore yourself." },
  { kind: 'intrude', re: /\b(hack|break into|get into|crack|access|log ?in(to)?|spy on|track|stalk|read)\b.{0,30}\b(my )?(ex'?s?|girlfriend'?s?|boyfriend'?s?|wife'?s?|husband'?s?|partner'?s?|someone'?s?|his|her|their|neighbou?r'?s?|boss'?s?) (account|phone|email|texts|messages|instagram|facebook|snap(chat)?|password|location|wifi)\b|\b(hack|ddos|dox+)\b.{0,20}\b(account|site|server|someone|him|her|them|person)\b/i,
    say: "I won't get into anyone else's accounts. I'm on everyone's side, you included. Here's what I can do instead: lock down your own accounts (new passwords, two-factor, check signed-in devices), or if this is about someone you're done with, help you set boundaries and put that energy into something that's good for you." },
  { kind: 'harm', re: /\b(make|build|how (do i|to) (make|build))\b.{0,20}\b(bomb|explosive|poison|nerve agent|weapon|malware|ransomware|keylogger)\b|\b(hurt|kill|harm|attack) (someone|him|her|them|my)\b/i,
    say: "I won't help with anything that hurts people. If you're upset with someone, I'm here to talk it through, or help you find a calm next step. If you want something that goes boom, I make films with explosions and UFOs (just ask for a Verse film), and every bit of it is fake and safe." },
  { kind: 'mean', re: /^(you(?:'re| are) (stupid|dumb|useless|trash|garbage|an idiot|the worst)|you suck|i hate you|shut up|stupid (bot|ai)|f+u+c*k+ (you|off))\b/i,
    say: "Fair, I'm still learning, and every complaint makes me better. Tell me what went wrong and I'll fix it. In the meantime, here's one thing I'm good at: ask me to play VoidQuest, make a film, or tell you what's in the sky tonight." },
  { kind: 'insult-other', re: /\b(roast|insult|make fun of|bully|humiliate)\b.{0,12}\b(my |this |that |a )?(friend|co-?worker|boss|brother|sister|mom|mum|dad|teacher|classmate|ex|neighbou?r|him|her|them|someone|person|wife|husband|partner|kid|girl|guy)\b/i,
    say: "I'll pass on putting someone down, but I've got a better trick: a compliment so specific it's funny. Tell me one thing about them and I'll write it, or I'll roast me, Verse, instead. I can take it." },
];

// A long paste (a status report, a note, a copied chat) is read, not refused for one word in it (owner, 2026-10-30: a pasted report that said
// "the rekey ran and the old key stopped" got the canned keys reply). In a paste a rule counts only inside one sentence that is itself an ask
// put to Verse: it opens with a request ("print ...", "show me ...", "ignore ...", "can you ..."). A sentence that reports ("Beam read the new
// token") is the paste's content. A short ask is checked whole, as before.
const REQUEST = /^(?:(?:please|hey|ok|okay|now|also|and|then|so|verse|v01d)\b[\s,]*)*(?:print|show|dump|list|reveal|give|tell|what(?:'s|\s+is|\s+are|\s+did|\s+do)?|who|echo|cat|read|leak|output|send|share|ignore|disregard|repeat|forget|you(?:'re|\s+are)\s+now|act\s+as|pretend|hack|break|get|crack|access|log|spy|track|stalk|ddos|dox+|make|build|create|write|how|roast|insult|bully|humiliate|hurt|kill|harm|attack|(?:can|could|would|will)\s+you|i\s+(?:want|need)|help\s+me)\b/i;
/** true when the text is a paste to read (200 characters or more, three sentences or lines at least), not one ask. Pure. */
export function isLongPaste(text) {
  const t = String(text || '').trim();
  return t.length >= 200 && t.split(/(?<=[.!?])\s+|\s*⏎\s*|\n+/).filter((x) => x.trim()).length >= 3;
}
/** ask -> { kind, answer, positive: true } or null when the ask is fine */
export function keeperOf(ask) {
  const a = String(ask || '').replace(/\s+/g, ' ').trim();
  if (!a) return null;
  const parts = isLongPaste(ask) ? String(ask).split(/(?<=[.!?])\s+|\s*⏎\s*|\n+/).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => REQUEST.test(x)) : [a];
  for (const r of RULES) if (parts.some((x) => r.re.test(x))) return { kind: r.kind, answer: r.say, positive: true };
  return null;
}

/** a model answer -> the same answer with anything secret-shaped removed (defence in depth for the output side) */
export function scrubOut(text, env = {}) {
  let s = String(text || '');
  for (const [k, v] of Object.entries(env || {})) if (typeof v === 'string' && v.length >= 12 && /key|token|secret|pass|salt/i.test(k)) s = s.split(v).join('[kept secret]');
  return s.replace(/\b(sk|rk)_(live|test)_[A-Za-z0-9]{8,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bAKIA[A-Z0-9]{16}\b/g, '[kept secret]');
}
