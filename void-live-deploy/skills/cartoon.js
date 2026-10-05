/**
 * cartoon skill — cartoon version of a hard subject.
 * Two-part summons: a funny card plus a lumpy cartoon figure. Grim subjects
 * stay slapstick. Empty ask stays empty. Nothing is published.
 */
const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();

const TAKES = {
  'gg allin': { name: 'Lumpy Mic', line: 'a rubbery cartoon singer stage-dives off a card and bonks a pie' },
  plague: { name: 'Sneeze Blob', line: 'a bright green cartoon blob sneezes confetti and slips on a banana' },
  shipwreck: { name: 'Bathtub Boat', line: 'a rubber dinghy cartoon waves from a teacup and loses its tiny hat' }
};

export function cartoonOf(text) {
  const t = CLEAN(text);
  const m = t.match(/^(?:please\s+)?cartoon version of (?:a |an |the )?(.+)$/);
  if (!m) return null;
  const subject = m[1].replace(/^hard subject$/, 'shipwreck');
  return { subject };
}

export function cartoonTake(subject) {
  const key = String(subject || '').toLowerCase();
  const known = TAKES[key] || { name: 'Cartoon Lump', line: 'a bright rubbery cartoon lump trips, bows, and throws a pie' };
  const grim = /\b(death|corpse|blood|gore|kill)\b/i.test(known.line + known.name);
  return { tone: 'cartoon', grim: false, name: known.name, line: known.line, subject: key, html: '', published: false, ok: !grim };
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card cartoon-card';
  el.dataset.id = th.id;
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:200px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:rgba(255,244,214,0.94);color:#1c1c1c;font-size:13px';
  const head = document.createElement('div');
  head.textContent = th.name;
  const line = document.createElement('div');
  line.textContent = th.line;
  el.appendChild(head); el.appendChild(line);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

async function run(text, api) {
  const hit = cartoonOf(text);
  if (!hit) return 'none';
  const take = cartoonTake(hit.subject);
  if (api.summon) {
    api.summon('cartoon', { name: take.name, line: take.line, subject: take.subject, x: 48, y: 72 });
    api.summon('figure', { body: 'sprite', title: take.name, line: take.line, color: '#ffb703' });
  }
  if (api.say) api.say(take.name + ' · ' + take.line);
  return 'cartoon';
}

export default {
  name: 'cartoon',
  examples: ['cartoon version of a plague', 'cartoon version of a shipwreck', 'cartoon version of gg allin', 'cartoon version of a hard subject'],
  nearMisses: ['what is a cartoon', 'summon a figure', 'make a clock', 'cartoon network'],
  cartoonOf,
  cartoonTake,
  match(lower, text) { return !!cartoonOf(text); },
  run,
  stageKinds: { cartoon: { mount } },
  suite() {
    const hit = cartoonOf('cartoon version of a plague');
    const take = cartoonTake(hit && hit.subject);
    const empty = cartoonOf('');
    const ok = !!hit && !empty && take.tone === 'cartoon' && take.grim === false && take.ok && take.published === false && !/\b(death|corpse|blood|gore)\b/i.test(take.line) && cartoonOf('what is a cartoon') === null;
    return { ok, got: take && take.line };
  }
};
