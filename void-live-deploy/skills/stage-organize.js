/**
 * stage-organize skill — keep the stage in order (owner, 2026-10-18, "tools pack 4", items 81 to 90 of the list):
 * folders for kept items (81: "put the kept cards in folder recipes", "open folder recipes", "close folder"), tags (82: "tag the clock as work"),
 * filter by tag (83: "show only things tagged work"), colour labels (84: "colour label the clock red"), saved stage layouts (85: "save this layout as morning",
 * "restore layout morning"), named snapshots (86: "snapshot as before trip", "restore snapshot before trip"), a diff of two snapshots by name only
 * (87: "diff snapshot a and b"), template stage (88: "save this stage as template weekly", "use template weekly"), duplicate a layout (89), and
 * "clear unkept" (90: clears what is not a kept answer, locked or marked keep; a snapshot "before clear" is taken first so it can be brought back).
 * Tags, folder and colour sit on the card and are saved with the stage; layouts, snapshots and templates are kept on this device only. Nothing is sent anywhere.
 */
import { organizeOf, layoutOf, applyLayout, templateOf, putNamed, dropNamed, diffNames, diffLine, unkeptIds, foldersOf, tagCounts, shows, esc } from '../lib/stage-tools.js';
import { read, write, targets, plural } from '../lib/stage-tools-dom.js';

const LAYOUTS = 'a2m.void.layouts.v1', SNAPS = 'a2m.void.snaps.v1', TEMPLATES = 'a2m.void.templates.v1';
let folderOpen = '', tagOn = '', lastApi = null;

function decorate(stageApi) {
  lastApi = { stage: stageApi };
  const things = stageApi.things(), st = stageApi.stage;
  let layer = document.getElementById('stage-badges');
  const labelled = Object.values(things).some((t) => t && (t.dot || (t.tags && t.tags.length) || t.folder));
  if (!labelled && !folderOpen && !tagOn) { if (layer) layer.remove(); }
  else {
    if (!layer) { layer = document.createElement('div'); layer.id = 'stage-badges'; layer.setAttribute('aria-hidden', 'true'); layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5'; document.body.appendChild(layer); }
    layer.textContent = '';
  }
  for (const el of st.querySelectorAll(':scope > [data-id]')) {
    const t = things[el.dataset.id]; if (!t) continue;
    const hide = !shows(t, folderOpen, tagOn);
    if (hide) { el.setAttribute('data-organized-hidden', ''); el.style.display = 'none'; } else if (el.hasAttribute('data-organized-hidden')) { el.removeAttribute('data-organized-hidden'); el.style.display = ''; }
    if (hide || !layer || !(t.dot || (t.tags && t.tags.length) || t.folder)) continue;
    const r = el.getBoundingClientRect(), b = document.createElement('div');
    b.className = 'stage-badge'; b.dataset.for = el.dataset.id;
    b.style.cssText = 'position:absolute;left:' + Math.round(r.left) + 'px;top:' + Math.max(0, Math.round(r.top) - 20) + 'px;display:flex;gap:5px;align-items:center;font:11px system-ui,sans-serif;color:#ddd;white-space:nowrap';
    if (t.dot) { const d = document.createElement('span'); d.className = 'stage-dot'; d.style.cssText = 'width:10px;height:10px;border-radius:50%;background:' + String(t.dot).replace(/[^#0-9a-fA-F]/g, '') + ';border:1px solid rgba(255,255,255,.6)'; b.appendChild(d); }
    const words = (t.folder ? ['in ' + t.folder] : []).concat((t.tags || []).map((g) => '#' + g));
    if (words.length) { const s = document.createElement('span'); s.className = 'stage-tags'; s.textContent = words.join(' '); s.style.cssText = 'background:rgba(20,18,34,.85);border-radius:6px;padding:1px 6px'; b.appendChild(s); }
    layer.appendChild(b);
  }
  const bar = document.getElementById('stage-chipbar');
  if (bar) for (const c of bar.querySelectorAll('button[data-chip]')) c.setAttribute('aria-pressed', String(c.dataset.chip === 'f:' + folderOpen || c.dataset.chip === 't:' + tagOn));
}

function chipBar(api, title, chips) {
  let bar = document.getElementById('stage-chipbar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'stage-chipbar'; bar.setAttribute('role', 'toolbar');
    bar.style.cssText = 'position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:7;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:min(94vw,640px);padding:6px 10px;border-radius:999px;background:rgba(20,18,34,.92);border:1px solid rgba(255,255,255,.25);color:#eee;font:13px system-ui,sans-serif';
    document.body.appendChild(bar);
    bar.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button'); if (!b) return;
      if (b.dataset.close !== undefined) { folderOpen = ''; tagOn = ''; bar.remove(); api.stage.render(); return; }
      const [k, v] = String(b.dataset.chip).split(/:(.*)/s);
      if (k === 'f') folderOpen = folderOpen === v ? '' : v; else tagOn = tagOn === v ? '' : v;
      api.stage.render();
    });
  }
  const chip = 'cursor:pointer;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:transparent;color:inherit;padding:3px 11px;font:inherit';
  bar.setAttribute('aria-label', title);
  bar.innerHTML = chips.map((c) => '<button type="button" data-chip="' + esc(c.key) + '" aria-pressed="false" style="' + chip + '">' + esc(c.label) + '</button>').join('')
    + '<button type="button" data-close aria-label="Close and show everything" style="' + chip + ';opacity:.7">×</button>'; // void-review: ok: every label is escaped
}

const ownerLine = (n) => (n ? '' : ' · nothing is named yet');
const readSnaps = () => read(SNAPS, {}), readLayouts = () => read(LAYOUTS, {}), readTemplates = () => read(TEMPLATES, {});
const copyOf = (things) => JSON.parse(JSON.stringify(things));
/** keep a snapshot of the stage as it is, under a name */
function takeSnap(api, name) {
  const at = Date.now(), bag = putNamed(readSnaps(), name, { at, things: copyOf(api.stage.things()) }, 12);
  return write(SNAPS, bag);
}
function putBack(api, snapThings) {
  const live = api.stage.things();
  for (const k of Object.keys(live)) delete live[k];
  Object.assign(live, copyOf(snapThings));
  api.stage.select(null); api.stage.save(); api.stage.render();
}
const names = (bag) => Object.keys(bag || {});

function run(text, api) {
  const h = organizeOf(text);
  if (!h) return 'none';
  lastApi = { stage: api.stage };
  const say = api.say || (() => {}), things = api.stage.things(), done = 'stage-organize';
  const need = (what) => { if (!h.name) { say('name it: "' + what + '"'); return true; } return false; };
  const pick = (needPick = true) => {
    const ids = targets(api, h.who, needPick);
    if (!ids.length) say(needPick && h.who && h.who.none ? 'pick a card first, or say which: "tag the clocks as work"' : 'nothing like that on the stage');
    return ids;
  };
  switch (h.op) {
    case 'clear-unkept': {
      const ids = unkeptIds(things);
      if (!ids.length) { say('nothing unkept to clear'); return done; }
      if (!takeSnap(api, 'before clear')) { say('could not keep a snapshot first, so nothing was cleared'); return done; }
      for (const id of ids) delete things[id];
      api.stage.select(null); api.stage.save(); api.stage.render();
      say('cleared ' + plural(ids.length, 'unkept thing') + ' · "restore snapshot before clear" brings them back');
      return done;
    }
    case 'snap-save': {
      if (need('snapshot as before trip')) return done;
      if (!Object.keys(things).length) { say('the stage is empty · nothing to snapshot'); return done; }
      say(takeSnap(api, h.name) ? 'snapshot "' + h.name + '" kept on this device · ' + plural(Object.keys(things).length, 'thing') : 'too big to keep on this device');
      return done;
    }
    case 'snap-restore': {
      if (need('restore snapshot before trip')) return done;
      const s = readSnaps()[h.name];
      if (!s) { const n = names(readSnaps()); say('no snapshot "' + h.name + '"' + (n.length ? ' · you have ' + n.join(', ') : ownerLine(0))); return done; }
      takeSnap(api, 'before restore'); putBack(api, s.things);
      say('stage back as "' + h.name + '" · ' + plural(Object.keys(s.things).length, 'thing') + ' · "restore snapshot before restore" undoes it');
      return done;
    }
    case 'snap-list': { const n = names(readSnaps()); say(n.length ? 'snapshots: ' + n.join(', ') : 'no snapshots yet · say "snapshot as before trip"'); return done; }
    case 'snap-delete': { const r = dropNamed(readSnaps(), h.name); if (r.had) write(SNAPS, r.bag); say(r.had ? 'snapshot "' + h.name + '" deleted' : 'no snapshot "' + h.name + '"'); return done; }
    case 'snap-diff': {
      const bag = readSnaps(), pick2 = (n) => (n === 'now' || n === 'the stage' || n === 'current' ? { things: things } : bag[n]);
      const a = pick2(h.a), b = pick2(h.b);
      if (!a || !b) { say('no snapshot "' + (!a ? h.a : h.b) + '"' + (names(bag).length ? ' · you have ' + names(bag).join(', ') : ownerLine(0))); return done; }
      say(diffLine(diffNames(a.things, b.things), h.a, h.b));
      return done;
    }
    case 'layout-save': {
      if (need('save this layout as morning')) return done;
      if (!Object.keys(things).length) { say('the stage is empty · nothing to lay out'); return done; }
      say(write(LAYOUTS, putNamed(readLayouts(), h.name, { at: Date.now(), places: layoutOf(things) }, 12)) ? 'layout "' + h.name + '" saved · ' + plural(Object.keys(layoutOf(things)).length, 'place') : 'could not keep that');
      return done;
    }
    case 'layout-restore': {
      if (need('restore layout morning')) return done;
      const l = readLayouts()[h.name];
      if (!l) { const n = names(readLayouts()); say('no layout "' + h.name + '"' + (n.length ? ' · you have ' + n.join(', ') : ownerLine(0))); return done; }
      const r = applyLayout(things, l.places);
      if (r.moved) { api.stage.save(); api.stage.render(); }
      say(r.moved ? 'layout "' + h.name + '": moved ' + plural(r.moved, 'thing') + (r.missing ? ' · ' + r.missing + ' not on the stage now' : '') : 'everything is already where "' + h.name + '" had it');
      return done;
    }
    case 'layout-list': { const n = names(readLayouts()); say(n.length ? 'layouts: ' + n.join(', ') : 'no layouts yet · say "save this layout as morning"'); return done; }
    case 'layout-delete': { const r = dropNamed(readLayouts(), h.name); if (r.had) write(LAYOUTS, r.bag); say(r.had ? 'layout "' + h.name + '" deleted' : 'no layout "' + h.name + '"'); return done; }
    case 'layout-duplicate': {
      const bag = readLayouts(), src = h.from ? bag[h.from] : null;
      if (!h.from) { // "duplicate this layout": the stage as it is now, saved under a new name
        if (!Object.keys(things).length) { say('the stage is empty · nothing to duplicate'); return done; }
        const name = h.name || 'layout copy';
        say(write(LAYOUTS, putNamed(bag, name, { at: Date.now(), places: layoutOf(things) }, 12)) ? 'this layout is kept as "' + name + '"' : 'could not keep that');
        return done;
      }
      if (!src) { say('no layout "' + h.from + '"' + (names(bag).length ? ' · you have ' + names(bag).join(', ') : ownerLine(0))); return done; }
      if (!h.name) { say('name the copy: "duplicate layout ' + h.from + ' as evening"'); return done; }
      say(write(LAYOUTS, putNamed(bag, h.name, { at: Date.now(), places: { ...src.places } }, 12)) ? 'layout "' + h.from + '" copied as "' + h.name + '"' : 'could not keep that');
      return done;
    }
    case 'template-save': {
      if (need('save this stage as template weekly')) return done;
      const kinds = templateOf(things);
      if (!kinds.length) { say('the stage is empty · nothing to make a template of'); return done; }
      say(write(TEMPLATES, putNamed(readTemplates(), h.name, { at: Date.now(), items: kinds }, 12)) ? 'template "' + h.name + '" kept · ' + plural(kinds.length, 'place') + ', no words or numbers from this stage' : 'could not keep that');
      return done;
    }
    case 'template-use': {
      if (need('use template weekly')) return done;
      const tp = readTemplates()[h.name];
      if (!tp) { const n = names(readTemplates()); say('no template "' + h.name + '"' + (n.length ? ' · you have ' + n.join(', ') : ownerLine(0))); return done; }
      let made = 0, skipped = 0;
      for (const it of tp.items) { let ok = null; try { ok = api.summon(it.kind, { x: it.x, y: it.y, pinned: true }); } catch (_) {} if (ok) made++; else skipped++; }
      say(made ? 'template "' + h.name + '": ' + plural(made, 'fresh card') + (skipped ? ' · ' + skipped + ' kind(s) cannot be made empty' : '') : 'nothing in "' + h.name + '" can be made empty');
      return done;
    }
    case 'template-list': { const n = names(readTemplates()); say(n.length ? 'templates: ' + n.join(', ') : 'no templates yet · say "save this stage as template weekly"'); return done; }
    case 'template-delete': { const r = dropNamed(readTemplates(), h.name); if (r.had) write(TEMPLATES, r.bag); say(r.had ? 'template "' + h.name + '" deleted' : 'no template "' + h.name + '"'); return done; }
    case 'folder-put': {
      const ids = pick(); if (!ids.length) return done;
      for (const id of ids) { if (h.name) things[id].folder = h.name; else delete things[id].folder; }
      api.stage.save(); api.stage.render();
      say(h.name ? plural(ids.length, 'card') + ' in folder "' + h.name + '" · "open folder ' + h.name + '" shows only those' : plural(ids.length, 'card') + ' out of their folders');
      return done;
    }
    case 'folder-new': { say('folder "' + h.name + '" is ready · say "put the kept cards in folder ' + h.name + '"'); return done; }
    case 'folder-open': {
      if (!foldersOf(things).some((f) => f.name === h.name)) { const f = foldersOf(things); say('no folder "' + h.name + '"' + (f.length ? ' · you have ' + f.map((x) => x.name).join(', ') : ' · nothing is filed yet')); return done; }
      folderOpen = h.name; api.stage.render(); say('folder "' + h.name + '" · "close folder" shows everything');
      return done;
    }
    case 'folder-close': { folderOpen = ''; tagOn = ''; const b = document.getElementById('stage-chipbar'); if (b) b.remove(); api.stage.render(); say('everything is back'); return done; }
    case 'folder-list': {
      const f = foldersOf(things);
      if (!f.length) { say('no folders yet · say "put the kept cards in folder recipes"'); return done; }
      chipBar(api, 'Folders', f.map((x) => ({ key: 'f:' + x.name, label: x.name + ' ' + x.n })));
      say('tap a folder to open it; tap it again for everything'); decorate(api.stage);
      return done;
    }
    case 'tag': {
      const ids = pick(); if (!ids.length) return done;
      for (const id of ids) things[id].tags = Array.from(new Set([...(things[id].tags || []), ...h.tags])).slice(0, 8);
      api.stage.save(); api.stage.render();
      say('tagged ' + plural(ids.length, 'card') + ' ' + h.tags.map((x) => '#' + x).join(' '));
      return done;
    }
    case 'untag': {
      const ids = pick(); if (!ids.length) return done;
      let n = 0;
      for (const id of ids) { const t = things[id]; if (!t.tags || !t.tags.length) continue; const keep = h.tags.length ? t.tags.filter((g) => !h.tags.includes(g)) : []; if (keep.length !== t.tags.length) { n++; if (keep.length) t.tags = keep; else delete t.tags; } }
      api.stage.save(); api.stage.render();
      say(n ? 'untagged ' + plural(n, 'card') : 'no such tag on them');
      return done;
    }
    case 'tag-list': {
      const g = tagCounts(things);
      if (!g.length) { say('no tags yet · say "tag the clock as work"'); return done; }
      chipBar(api, 'Tags', g.map((x) => ({ key: 't:' + x.name, label: '#' + x.name + ' ' + x.n })));
      say('tap a tag to show only those; tap it again for everything'); decorate(api.stage);
      return done;
    }
    case 'tag-filter': {
      if (!tagCounts(things).some((x) => x.name === h.tag)) { say('nothing is tagged #' + h.tag); return done; }
      tagOn = h.tag; api.stage.render(); say('showing only #' + h.tag + ' · "clear the tag filter" shows everything');
      return done;
    }
    case 'tag-clear': { tagOn = ''; api.stage.render(); say('every card is back'); return done; }
    case 'dot': {
      const ids = pick(); if (!ids.length) return done;
      for (const id of ids) { if (h.color) things[id].dot = h.color; else delete things[id].dot; }
      api.stage.save(); api.stage.render();
      say(h.color ? 'colour-labelled ' + plural(ids.length, 'card') : 'colour labels removed from ' + plural(ids.length, 'card'));
      return done;
    }
    default: return 'none';
  }
}

export default {
  name: 'stage-organize',
  organizeOf,
  examples: ['put the kept cards in folder recipes', 'open folder recipes', 'tag the clock as work', 'show only things tagged work', 'colour label the clock red',
    'save this layout as morning', 'restore layout morning', 'snapshot as before trip', 'restore snapshot before trip', 'diff snapshot before trip and after trip',
    'save this stage as template weekly', 'use template weekly', 'duplicate layout morning as evening', 'clear unkept'],
  nearMisses: ['tag me in the photo', 'folder structure for a react project', 'what is a snapshot in git', 'template for a cover letter', 'layout of a newspaper', 'clear my browser history',
    'diff two files in linux', 'colour code my calendar', 'save this page as pdf', 'tag heuer watches'],
  match(lower, text) { return !!organizeOf(text || lower); },
  run,
  decorate,
};
