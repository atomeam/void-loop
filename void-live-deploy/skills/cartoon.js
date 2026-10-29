/**
 * cartoon skill: a 2D cartoon drawing of what you name (owner, 2026-10-23: "everything should be exactly what it sounds like it will be not a
 * representation"; "cartoons should be 2d ... cartoon should be cartoons literally").
 * "draw a cartoon cat", "cartoon version of a dog", "make a cartoon of a dragon", "draw a toon cat" put a flat cartoon card on the stage:
 * the subject drawn at once (its emoji, big, when it has one), then a painted 2D cartoon of that subject from the Art Forge
 * (functions/api/card-art.js, kind 'cartoon': bold outlines, flat colours, painted once per subject and kept for everyone, inside the forge's
 * daily cap). When no painting can be made the card says why in plain words. No 3D figure: 3D is the miniatures' job.
 * Plain shapes ("draw a red square") stay the shape skill's; the drawing canvas ("let me draw") stays the draw skill's.
 */
import { cleanLower } from '../lib/ask-text.js';
import { letWalk } from './walker.js'; // "Let it walk": the painting steps off the card and paces the stage floor (skills/walker.js)
const CLEAN = cleanLower; // shared: lib/ask-text.js

// slapstick lines for the hard subjects the skill began with (a grim subject stays a joke, never gore)
const TAKES = {
  'gg allin': 'a rubbery cartoon singer stage-dives off the card and bonks a pie',
  plague: 'a bright green cartoon germ sneezes confetti and slips on a banana',
  shipwreck: 'a rubber dinghy waves from a teacup and loses its tiny hat'
};
// the subject drawn the moment it is asked, before the painting arrives (a flat 2D emoji is a cartoon of it)
const EMOJI = { cat: '🐱', kitten: '🐱', dog: '🐶', puppy: '🐶', dragon: '🐉', horse: '🐴', cow: '🐮', pig: '🐷', frog: '🐸', fish: '🐟', bird: '🐦', owl: '🦉',
  fox: '🦊', bear: '🐻', panda: '🐼', lion: '🦁', tiger: '🐯', monkey: '🐵', rabbit: '🐰', bunny: '🐰', mouse: '🐭', duck: '🦆', penguin: '🐧', unicorn: '🦄',
  shark: '🦈', whale: '🐳', octopus: '🐙', dinosaur: '🦖', 't rex': '🦖', robot: '🤖', alien: '👽', ghost: '👻', house: '🏠', car: '🚗', tree: '🌳', flower: '🌸',
  sun: '☀️', moon: '🌙', rocket: '🚀', pizza: '🍕', apple: '🍎', banana: '🍌', cake: '🎂', taco: '🌮', plague: '🦠', germ: '🦠', shipwreck: '🚢', ship: '🚢',
  boat: '⛵', snail: '🐌', bee: '🐝', butterfly: '🦋', turtle: '🐢', snake: '🐍', elephant: '🐘', giraffe: '🦒', zebra: '🦓', koala: '🐨', sloth: '🦥',
  hamster: '🐹', chicken: '🐔', wizard: '🧙', pirate: '🏴‍☠️', astronaut: '🧑‍🚀', volcano: '🌋', cactus: '🌵', mushroom: '🍄', snowman: '⛄', clown: '🤡' };

const SHAPE = /^(?:[a-z]+\s+){0,2}(?:circle|line|square|triangle|rectangle|rect|star|heart|oval|dot|hexagon|pentagon|diamond|shape)s?$/;
const NOT_A_SUBJECT = /^(?:cards?|line chart|chart|graph|map|diagram|breath|blank|conclusion|straws?|number|canvas|brush|layer|arrow|me|something|anything|with|on|in|into|using|from|for)\b|^(?:cartoons?|toons?)$/;
const LEAD = /^(?:please\s+)?(?:can you\s+)?(?:cartoon version of |cartoon of |(?:draw|make|give|show|create|render|generate)\s+(?:me\s+)?(?:a |an )?(?:cartoon|toon|2d toon|low poly|\w+ style)\s+(?:version\s+)?(?:of\s+)?|style like (?:a |an )?|draw (?:me )?(?:a |an )?(?:toon )?(?:picture of |drawing of )?|(?:a )?(?:\w+\s+)?cartoon (?!network|series|show|character)(?:version of )?)(.+)$/;

/** the subject of a cartoon ask, or null when the ask is not one. Pure. */
export function cartoonOf(text) {
  const m = CLEAN(text).match(LEAD);
  if (!m) return null;
  const subject = m[1].replace(/^(?:a|an|the|my|your|some)\s+/, '').replace(/^hard subject$/, 'shipwreck').replace(/\s+(?:please|for me)$/, '').trim();
  if (!subject || SHAPE.test(subject) || NOT_A_SUBJECT.test(subject) || subject.length > 60) return null;
  return { subject };
}

/** what the card says about a subject: its name, its slapstick line (hard subjects only) and the emoji drawn at once. Pure. */
export function cartoonTake(subject) {
  const key = String(subject || '').toLowerCase().trim();
  const last = key.split(' ').pop();
  return { tone: 'cartoon', subject: key, name: 'Cartoon ' + key, line: TAKES[key] || '', emoji: EMOJI[key] || EMOJI[last] || EMOJI[last.replace(/s$/, '')] || '', published: false, ok: !!key };
}

/** the line the card shows when the forge gives no painting. Pure. */
export function plateLine(why) {
  return {
    off: 'Painting is switched off on this copy of Verse, so this is the quick drawing.',
    cap: "Today's paintings are used up; this cartoon gets painted once they reset at midnight UTC.",
    busy: 'The painter did not answer just now. Tap Paint it to try again.',
    slow: 'Painting too fast; tap Paint it again in a minute.',
    brand: "I don't draw brands or famous characters, only my own cartoons.",
    person: "I don't draw real people.",
    unsuitable: "I won't draw that one.",
    kept: "I won't draw that one.",
    secret: "That looks like a key or a secret, so I won't put it in a picture.",
    unreachable: "I couldn't reach the painter just now. Tap Paint it to try again.",
  }[why] || 'No painting this time. Tap Paint it to try again.';
}

const painted = new Map(); // subject -> { img } | { why } for this page, so a redraw never asks twice

async function paint(subject, post) {
  const hit = painted.get(subject);
  if (hit && (hit.img || !post)) return hit;
  let out;
  try {
    const r = post
      ? await fetch('/api/card-art', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject, kind: 'cartoon' }) })
      : await fetch('/api/card-art?kind=cartoon&key=' + encodeURIComponent(subject));
    const j = await r.json();
    out = j && j.state === 'art' && /^data:image\//.test(j.img || '') ? { img: j.img, name: typeof j.name === 'string' ? j.name : '' } : { why: (j && (j.state === 'none' ? 'none' : j.why)) || 'busy' };
  } catch (_) { out = { why: 'unreachable' }; }
  painted.set(subject, out);
  return out;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card cartoon-card';
  el.dataset.id = th.id;
  el.dataset.subject = th.subject || '';
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:300px;padding:12px;border:3px solid #1d1d1d;border-radius:18px;background:#fffdf4;color:#1d1d1d;font:14px/1.4 system-ui,sans-serif;box-shadow:6px 6px 0 #1d1d1d';
  const head = document.createElement('div');
  head.style.cssText = 'font-weight:800;font-size:17px;margin-bottom:8px;text-transform:capitalize';
  head.textContent = th.name || ('Cartoon ' + (th.subject || ''));
  const pic = document.createElement('div');
  pic.className = 'cartoon-pic';
  pic.style.cssText = 'width:100%;aspect-ratio:16/9;border:2px solid #1d1d1d;border-radius:12px;background:#ffe9b8;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:96px;line-height:1';
  pic.textContent = th.emoji || '✏️';
  pic.setAttribute('role', 'img');
  pic.setAttribute('aria-label', 'a quick drawing of ' + (th.subject || 'it'));
  const line = document.createElement('div');
  line.style.cssText = 'margin-top:8px';
  line.textContent = th.line || '';
  const status = document.createElement('div');
  status.className = 'cartoon-status';
  status.style.cssText = 'margin-top:6px;font-size:12px;color:#5b5446';
  status.textContent = 'Painting a cartoon ' + (th.subject || '') + ' now.';
  const again = document.createElement('button');
  again.type = 'button'; again.textContent = 'Paint it'; again.hidden = true;
  again.style.cssText = 'margin-top:6px;font:inherit;font-size:12px;border:2px solid #1d1d1d;border-radius:999px;background:#fff;color:#1d1d1d;-webkit-text-fill-color:#1d1d1d;opacity:1;padding:3px 12px;cursor:pointer;font-weight:700';
  // "Let it walk" (owner, 2026-10-25: "drop him onto a solid floor so he actually walks across a stage"): the picture as painted (or the quick emoji) walks the stage floor
  const walk = document.createElement('button');
  walk.type = 'button'; walk.textContent = 'Let it walk'; walk.className = 'cartoon-walk'; walk.title = 'the cartoon steps off the card and walks the stage';
  walk.style.cssText = again.style.cssText + ';margin-left:6px';
  walk.addEventListener('pointerdown', (e) => e.stopPropagation()); // a tap on the button is not a drag of the card
  walk.addEventListener('click', (e) => { e.stopPropagation(); const img = pic.querySelector('img'); letWalk({ src: img ? img.getAttribute('src') || '' : '', emoji: th.emoji || '', subject: th.subject || '', ask: 'let it walk' }, { say: stageApi.say }); });
  const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center';
  row.append(again, walk);
  el.append(head, pic, line, status, row);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  const show = (r) => {
    // the name as usually spelled, when the forge knows it ("dimebag darrel" is shown as Dimebag Darrell)
    if (r.name && typeof r.name === 'string') { th.name = 'Cartoon ' + r.name.slice(0, 60); head.textContent = th.name; if (stageApi.save) stageApi.save(); }
    if (r.img) {
      const img = document.createElement('img');
      img.src = r.img; img.alt = 'a 2D cartoon of ' + (th.subject || 'it');
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      pic.textContent = ''; pic.removeAttribute('role'); pic.removeAttribute('aria-label'); pic.appendChild(img);
      status.textContent = ''; again.hidden = true;
    } else if (r.why === 'none') { status.textContent = 'Not painted yet.'; again.hidden = false; }
    else { status.textContent = plateLine(r.why); again.hidden = !/^(?:busy|slow|unreachable)$/.test(r.why || 'busy'); }
  };
  again.addEventListener('click', (e) => { e.stopPropagation(); status.textContent = 'Painting it now.'; again.hidden = true; painted.delete(th.subject); paint(th.subject, true).then(show); });
  const post = !!th.fresh; th.fresh = false; // a new ask paints (the forge returns the kept picture when it exists); a reload only reads
  paint(th.subject, post).then(show);
}

async function run(text, api) {
  const hit = cartoonOf(text);
  if (!hit) return 'none';
  const take = cartoonTake(hit.subject);
  if (api.summon) api.summon('cartoon', { subject: take.subject, name: take.name, line: take.line, emoji: take.emoji, fresh: true, x: 48, y: 72 });
  if (api.say) api.say('Drawing a cartoon ' + take.subject + '.');
  return 'cartoon';
}

export default {
  name: 'cartoon',
  examples: ['draw a cartoon cat', 'cartoon version of a dog', 'make a cartoon of a dragon', 'draw a toon cat', 'cartoon version of a plague', 'draw me a robot', 'make a 2d toon dog', 'create a toon style bird', 'funny cartoon dog', 'render a cartoon dragon', 'render a low poly dog', 'style like mickey mouse', 'generate a toon style dog'],
  nearMisses: ['what is a cartoon', 'cartoon network', 'make a clock', 'draw a red square', 'let me draw', 'draw a card'],
  cartoonOf,
  cartoonTake,
  plateLine,
  match(lower, text) { return !!cartoonOf(text || lower); },
  run,
  stageKinds: { cartoon: { mount } },
  suite() {
    const hit = cartoonOf('draw a cartoon cat');
    const take = cartoonTake(hit && hit.subject);
    const ok = !!hit && hit.subject === 'cat' && take.emoji === '🐱' && take.name === 'Cartoon cat' && cartoonOf('') === null && cartoonOf('what is a cartoon') === null && cartoonOf('draw a red square') === null;
    return { ok, got: take && take.name };
  }
};
