// Stage tools (owner, 2026-10-18, "tools pack 4", items 61 to 90): the asks, the geometry, the card styles, the folders, tags, layouts, snapshots and diffs.
// Pure logic only; the browser section "tools pack 4" in test_void.mjs plays them on the stage.
// Run: node --test tools/stage-tools.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../void-live-deploy/lib/stage-tools.js';
import arrange from '../void-live-deploy/skills/stage-arrange.js';
import style from '../void-live-deploy/skills/stage-style.js';
import organize from '../void-live-deploy/skills/stage-organize.js';

test('arrange asks: what each takes and the look-alikes it leaves', () => {
  const op = (a) => (T.arrangeOf(a) || {}).op;
  assert.equal(op('align left'), 'align'); assert.equal(T.arrangeOf('align the notes to the right').mode, 'right'); assert.equal(T.arrangeOf('align everything centre').mode, 'center');
  assert.equal(T.arrangeOf('left align the clocks').mode, 'left');
  assert.equal(op('distribute spacing'), 'distribute'); assert.equal(T.arrangeOf('space out the clocks vertically').axis, 'v'); assert.equal(op('space them out evenly'), 'distribute');
  assert.equal(T.arrangeOf('snap to grid').on, true); assert.equal(T.arrangeOf('snap everything to the grid').on, false); assert.equal(T.arrangeOf('stop snapping').now, false);
  assert.deepEqual(T.arrangeOf('show the grid'), { op: 'grid', on: true }); assert.equal(T.arrangeOf('grid off').on, false); assert.equal(T.arrangeOf('grid size 40').size, 40);
  assert.deepEqual(T.arrangeOf('add a vertical guide at 300'), { op: 'guide', add: true, axis: 'v', at: 300 }); assert.equal(T.arrangeOf('horizontal guide').at, 'center'); assert.equal(T.arrangeOf('clear guides').clear, true);
  assert.equal(T.arrangeOf('select all clocks').mode, 'replace'); assert.deepEqual(T.arrangeOf('select the clock and the notes').who.kinds, ['clock', 'sticky']);
  assert.equal(T.arrangeOf('deselect all').mode, 'none'); assert.equal(T.arrangeOf('add the timer to the selection').mode, 'add');
  assert.deepEqual([T.arrangeOf('lock everything').on, T.arrangeOf('unlock all').on], [true, false]);
  for (const a of ['align my chakras', 'select all text', 'lock the screen', 'how do i unlock my phone', 'guide to paris', 'grid of 3 columns', 'what is align-items in css']) assert.equal(T.arrangeOf(a), null, a);
});

test('style asks: each property, the bounds, and the look-alikes it leaves', () => {
  const p = (a) => T.styleOf(a);
  assert.deepEqual([p('set opacity to 50%').prop, p('set opacity to 50%').value], ['opacity', 50]);
  assert.equal(p('make the clock 30% transparent').value, 70); assert.equal(p('opacity 500').value, 100); assert.equal(p('opacity 1').value, 5);
  assert.equal(p('tint the clock red').value, '#e5484d'); assert.equal(p('remove the tint').value, ''); assert.equal(p('tint blue').who.none, true);
  assert.equal(p('border weight 3').value, 3); assert.equal(p('remove the border').value, 0);
  assert.equal(p('round the corners').value, 24); assert.equal(p('square corners').value, 0); assert.equal(p('corner radius 10').prop, 'radius');
  assert.equal(p('add a shadow to the clock').value, true); assert.equal(p('shadow off').value, false); assert.equal(p('turn off the shadow').value, false);
  assert.deepEqual(p('set the background to #112233'), { op: 'bg', color: '#112233' }); assert.equal(p('make the background green').op, 'bg'); assert.equal(p('reset the background').color, '');
  assert.equal(p('use a picture from my files as the background').op, 'bgimage'); assert.equal(p('blur the background').px, 8); assert.equal(p('unblur the background').px, 0);
  assert.deepEqual([p('high contrast mode').on, p('turn off high contrast').on, p('larger type mode').on, p('turn off larger type mode').on], [true, false, true, false]);
  for (const a of ['what is opacity', 'tint my car windows', 'border collie puppies', 'shadow of the colossus', 'background check for a job', 'blur the face in my photo', 'make my void blue', 'bigger text', 'tax bracket for 2026']) assert.equal(p(a), null, a);
});

test('organize asks: names, the folders, tags, layouts, snapshots, diffs, templates and the look-alikes it leaves', () => {
  const o = (a) => T.organizeOf(a);
  assert.deepEqual(o('put the kept cards in folder recipes'), { op: 'folder-put', who: { kinds: ['kept'] }, name: 'recipes' }); assert.equal(o('open folder recipes').op, 'folder-open'); assert.equal(o('close folder').op, 'folder-close');
  assert.deepEqual(o('tag the notes with home, errands').tags, ['home', 'errands']); assert.equal(o('show only things tagged work').tag, 'work'); assert.equal(o('filter by tag work').op, 'tag-filter'); assert.equal(o('clear the tag filter').op, 'tag-clear');
  assert.equal(o('remove tag work from the notes').op, 'untag'); assert.equal(o('colour label the clock red').color, '#e5484d'); assert.equal(o('colour code the notes green').op, 'dot');
  assert.equal(o('save this layout as Morning').name, 'morning'); assert.equal(o('restore layout morning').op, 'layout-restore'); assert.deepEqual([o('duplicate layout morning as evening').from, o('duplicate layout morning as evening').name], ['morning', 'evening']);
  assert.equal(o('duplicate this layout').from, ''); assert.equal(o('snapshot as before trip').name, 'before trip'); assert.equal(o('restore snapshot before trip').op, 'snap-restore'); assert.equal(o('list snapshots').op, 'snap-list');
  assert.deepEqual([o('diff snapshot a and b').a, o('compare snapshots a and b').b], ['a', 'b']);
  assert.equal(o('save this stage as template weekly').name, 'weekly'); assert.equal(o('make this stage a template called weekly').op, 'template-save'); assert.equal(o('use template weekly').op, 'template-use');
  assert.equal(o('clear unkept').op, 'clear-unkept'); assert.equal(o('clear everything except the kept ones').op, 'clear-unkept');
  for (const a of ['tag me in the photo', 'folder structure for a react project', 'what is a snapshot in git', 'template for a cover letter', 'layout of a newspaper', 'clear my browser history', 'diff two files in linux', 'save this page as pdf', 'tag heuer watches']) assert.equal(o(a), null, a);
});

test('the three skills each take their own examples and none of their near misses', () => {
  for (const [s, other] of [[arrange, [style, organize]], [style, [arrange, organize]], [organize, [arrange, style]]]) {
    for (const e of s.examples) { assert.ok(s.match(e.toLowerCase(), e), s.name + ' takes ' + e); for (const o of other) assert.ok(!o.match(e.toLowerCase(), e), o.name + ' must not take ' + e); }
    for (const n of s.nearMisses) assert.ok(!s.match(n.toLowerCase(), n), s.name + ' must not take ' + n);
  }
});

test('who: kinds, everything, the pick and the selection; the default is the multi-selection, then the pick, then everything', () => {
  const things = { a: { kind: 'clock' }, b: { kind: 'sticky' }, c: { kind: 'sticky' }, f: { kind: 'figure' } };
  const ids = (phrase, ctx = {}) => T.resolveWho(T.whoOf(phrase), { things, multi: [], selected: null, ...ctx });
  assert.deepEqual(ids('the notes'), ['b', 'c']); assert.deepEqual(ids('all clocks'), ['a']); assert.deepEqual(ids('everything'), ['a', 'b', 'c']);
  assert.deepEqual(ids('', {}), ['a', 'b', 'c']); assert.deepEqual(ids('', { selected: 'b' }), ['b']); assert.deepEqual(ids('', { selected: 'b', multi: ['a', 'c'] }), ['a', 'c']);
  assert.deepEqual(ids('this', { selected: 'c' }), ['c']); assert.deepEqual(ids('the selection', { multi: ['a'] }), ['a']); assert.deepEqual(ids('the selection'), []);
  assert.equal(T.whoOf('my chakras'), null); assert.deepEqual(T.whoOf('the clock and the notes').kinds, ['clock', 'sticky']);
});

test('align and distribute: edges, the middle, one card to the stage edge, equal gaps, and nothing to do', () => {
  const b = [{ id: 'a', x: 10, y: 10, w: 100, h: 50 }, { id: 'b', x: 200, y: 80, w: 60, h: 50 }, { id: 'c', x: 400, y: 300, w: 80, h: 20 }];
  assert.deepEqual(T.align(b, 'left', { w: 800, h: 600 }), { b: { x: 10, y: 80 }, c: { x: 10, y: 300 } });
  assert.equal(T.align(b, 'right', { w: 800, h: 600 }).a.x, 380); // right edge 480
  assert.equal(T.align(b, 'center', { w: 800, h: 600 }).b.x, 215); // the group's middle 245 minus half of 60
  assert.equal(T.align(b, 'bottom', { w: 800, h: 600 }).a.y, 270); assert.equal(T.align(b, 'middle', { w: 800, h: 600 }).c.y, 155);
  assert.deepEqual(T.align([{ id: 'a', x: 300, y: 40, w: 100, h: 50 }], 'left', { w: 800, h: 600 }), { a: { x: 10, y: 40 } });
  assert.deepEqual(T.align([{ id: 'a', x: 10, y: 40, w: 100, h: 50 }], 'left', { w: 800, h: 600 }), {});
  const d = T.distribute([{ id: 'a', x: 0, y: 0, w: 100, h: 10 }, { id: 'b', x: 120, y: 0, w: 100, h: 10 }, { id: 'c', x: 500, y: 0, w: 100, h: 10 }], 'h');
  assert.deepEqual(d, { b: { x: 250, y: 0 } }); // gap (600-300)/2 = 150
  assert.deepEqual(T.distribute(b.slice(0, 2), 'h'), {});
  assert.deepEqual(T.distribute([{ id: 'a', x: 0, y: 0, w: 10, h: 100 }, { id: 'b', x: 0, y: 130, w: 10, h: 100 }, { id: 'c', x: 0, y: 500, w: 10, h: 100 }], 'v'), { b: { x: 0, y: 250 } });
});

test('grid: snapping rounds to the size and moves only what is off the grid', () => {
  assert.equal(T.snapTo(31, 20), 40); assert.equal(T.snapTo(29, 20), 20); assert.equal(T.snapTo(7, 0), 0); assert.equal(T.snapTo(11, 1), 12); // a size under 2 is taken as 20 only when not a number
  assert.deepEqual(T.snapAll([{ id: 'a', x: 33, y: 41 }, { id: 'b', x: 40, y: 60 }], 20), { a: { x: 40, y: 40 } });
});

test('card styles: opacity, tint, border, corners and shadow draw as one small style, and clearing a property removes it', () => {
  const s = T.fxStyle({ opacity: 50, tint: '#e5484d', border: 3, radius: 12, shadow: true });
  assert.equal(s.opacity, '0.5'); assert.match(s.boxShadow, /inset 0 0 0 999px rgba\(229,72,77,0\.3\)/); assert.match(s.boxShadow, /0 12px 28px/); assert.equal(s.borderWidth, '3px'); assert.equal(s.borderStyle, 'solid'); assert.equal(s.borderRadius, '12px');
  assert.equal(T.fxStyle({ shadow: false }).boxShadow, 'none'); assert.equal(T.fxStyle({ border: 0 }).borderStyle, 'none'); assert.equal(T.fxStyle(null).opacity, '');
  assert.deepEqual(T.withFx(null, 'opacity', 40), { opacity: 40 }); assert.equal(T.withFx({ opacity: 40 }, 'opacity', 100), null); assert.deepEqual(T.withFx({ opacity: 40, tint: '#fff' }, 'tint', ''), { opacity: 40 });
  assert.deepEqual(T.withFx({}, 'shadow', false), { shadow: false });
  assert.deepEqual(T.solidLook('#112233'), { bg: '#112233', glow: '#112233' }); assert.equal(T.solidLook('nonsense'), null); assert.equal(T.colorOf('#abc'), '#aabbcc'); assert.equal(T.rgba('#ffffff', 0.5), 'rgba(255,255,255,0.5)');
});

test('snapshots and layouts: names only in a diff, layouts move what is still there, templates keep no words', () => {
  const a = { 1: { kind: 'clock', x: 10, y: 10 }, 2: { kind: 'sticky', x: 100, y: 100, label: 'groceries', text: 'secret milk' } };
  const b = { 1: { kind: 'clock', x: 300, y: 10 }, 3: { kind: 'timer', x: 5, y: 5 }, 2: { kind: 'sticky', x: 100, y: 100, label: 'groceries' } };
  const d = T.diffNames(a, b);
  assert.deepEqual(d, { added: ['timer'], removed: [], moved: ['clock'] });
  assert.match(T.diffLine(d, 'a', 'b'), /only in b timer · moved clock/); assert.doesNotMatch(T.diffLine(T.diffNames(a, b), 'a', 'b'), /secret/);
  assert.match(T.diffLine(T.diffNames(a, a), 'a', 'b'), /same things in the same places/);
  assert.deepEqual(T.namesOf({ x: { kind: 'sticky' }, y: { kind: 'sticky' }, z: { kind: 'clock', name: 'kitchen' } }), { x: 'sticky', y: 'sticky 2', z: 'kitchen' });
  const live = { 1: { kind: 'clock', x: 999, y: 10 }, 2: { kind: 'sticky', x: 1, y: 1 } };
  const lay = T.layoutOf(a); assert.deepEqual(lay[1], { x: 10, y: 10, kind: 'clock' });
  assert.deepEqual(T.applyLayout(live, { ...lay, 9: { x: 0, y: 0, kind: 'x' } }), { moved: 2, missing: 1 }); assert.equal(live[1].x, 10); assert.equal(live[1].pinned, true);
  const tp = T.templateOf(a); assert.deepEqual(tp, [{ kind: 'clock', x: 10, y: 10 }, { kind: 'sticky', x: 100, y: 100 }]); assert.doesNotMatch(JSON.stringify(tp), /secret|groceries/);
  const bag1 = T.putNamed({}, 'one', { at: 1, v: 1 }, 2), bag2 = T.putNamed(bag1, 'two', { at: 2 }, 2), bag3 = T.putNamed(bag2, 'three', { at: 3 }, 2);
  assert.deepEqual(Object.keys(bag3).sort(), ['three', 'two']); assert.deepEqual(T.dropNamed(bag3, 'two').had, true); assert.equal(T.dropNamed(bag3, 'nope').had, false);
});

test('kept things, folders and tags: what clear unkept leaves, what a folder and a tag show', () => {
  const things = { k: { kind: 'kept' }, l: { kind: 'clock', locked: true }, m: { kind: 'sticky', keep: true }, u: { kind: 'timer' }, v: { kind: 'sticky', folder: 'home', tags: ['work', 'home'] }, f: { kind: 'figure' } };
  assert.deepEqual(T.unkeptIds(things), ['u', 'v']); assert.equal(T.isKept(things.k), true); assert.equal(T.isKept(things.u), false);
  assert.deepEqual(T.foldersOf(things), [{ name: 'home', n: 1 }]); assert.deepEqual(T.tagCounts(things).map((x) => x.name), ['home', 'work']);
  assert.equal(T.shows(things.v, 'home', 'work'), true); assert.equal(T.shows(things.v, 'other', ''), false); assert.equal(T.shows(things.u, '', 'work'), false); assert.equal(T.shows(things.u, '', ''), true);
  assert.deepEqual(T.tagsOf('Work, home and #errands'), ['work', 'home', 'errands']); assert.equal(T.tagsOf('a,b,c,d,e,f,g').length, 5);
  assert.equal(T.esc('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
});

test('the live-stage half: targets read the stage through its api, the picked card is ignored when arranging, and storage failures are harmless', async () => {
  const D = await import('../void-live-deploy/lib/stage-tools-dom.js');
  const things = { a: { kind: 'clock', x: 1, y: 1 }, b: { kind: 'sticky', x: 2, y: 2 }, c: { kind: 'sticky', x: 3, y: 3 } };
  const api = { stage: { things: () => things, selected: () => 'c' } };
  assert.deepEqual(D.targets(api, T.whoOf('')), ['c']); // style, tag and lock act on the picked card
  assert.deepEqual(D.targets(api, T.whoOf(''), false, true), ['a', 'b', 'c']); // align, spacing and snap act on every card
  D.multi.add('a'); D.multi.add('gone');
  assert.deepEqual(D.targets(api, T.whoOf(''), false, true), ['a']); assert.equal(D.multi.has('gone'), false); D.multi.clear();
  assert.deepEqual(D.targets({ stage: { things: () => ({ a: { kind: 'clock' } }), selected: () => null } }, T.whoOf(''), true), []);
  assert.equal(D.plural(1, 'card'), '1 card'); assert.equal(D.plural(3, 'card'), '3 cards');
  assert.equal(D.read('k', 7), 7); assert.equal(D.write('k', { a: 1 }), false); // no localStorage in node: read falls back, write reports its failure
});
test('blur off in plain words: "blur the background off" and "background sharp again" clear the blur (the restore of 2026-10-21 kept this change)', () => {
  for (const t of ['blur the background off', 'turn the blur background off', 'background sharp again', 'make the background sharp again', 'the background clear again']) assert.deepEqual(T.styleOf(t), { op: 'blur', px: 0 }, t);
  assert.deepEqual(T.styleOf('blur the background'), { op: 'blur', px: 8 }); assert.equal(typeof T.resolveWho, 'function', 'stage-tools-dom.js imports it');
});
