# Card miniatures: the shared 3D scene

Every card can show a small, detailed 3D version of itself that behaves like the real thing (a clock whose hands keep
time, a weather diorama that rains or shines). This file is the API for building one. The engine is
`void-live-deploy/skills/scene3d.js`; the template miniature is `void-live-deploy/skills/mini/sample.js`, and the reference for
how a finished one behaves is the countdown's calendar (see "The reference miniature" below).

## Quick start

1. Copy `skills/mini/sample.js` to `skills/mini/<kind>.js`, where `<kind>` is lowercase letters, digits and dashes
   (use the card's kind, e.g. `clock`, `weather`). The file's default export is the build function.
2. In the card's mount code, give the miniature a host element and call:

```js
stageApi.miniature(slotEl, 'clock', { tz: th.tz }, { key: th.id, place: 'inside' })
  .catch(() => { /* no WebGL: keep the card's 2D look */ });
// Don't keep the returned handle on th (th._mini = mini): the stage saves things with JSON.stringify, and the
// handle holds the canvas and scene, so every save would throw. Mounting again with the same key returns it.
```

   Skills reach the same function as `api.stage.miniature(...)`. Pass the card's id as `key`: the stage re-renders
   cards often, and the same key moves the live miniature into the new element instead of rebuilding it.
3. When the card's data changes, the next render mounts again with the same key and new data, which calls the
   miniature's `update(newData)` for you. When the card is thrown away, do nothing: a miniature
   whose element stays off the page for about 1.5 s frees itself. Call `mini.dispose()` only to remove it on purpose.

## The build function

```js
export default async function build(ctx, data) {
  const { THREE, root } = ctx;           // add your meshes to ctx.root
  // ... make meshes; set castShadow / receiveShadow on them ...
  ctx.frame(root, { view: [0, 0.6, 1] }); // fit the camera, key light, shadow box and ground to the model
  return {
    update(d) { /* data changed: change the model, then the scene redraws */ },
    tick(dt, t) { /* every frame while visible; return false when nothing changed, 'view' when only small parts moved (a clock hand: redraw without recomputing the soft shadows) */ },
    dispose() { /* free what you made (geometries, materials, textures) */ },
  };
}
```

`ctx` gives you:

| field | what it is |
|---|---|
| `THREE` | three.js r180 (vendored at `/vendor/three-r180a/`) |
| `lib` | add-ons: `GLTFLoader`, `OrbitControls`, `RoomEnvironment`, `MeshoptDecoder`, `KTX2Loader`, blur shaders |
| `scene`, `root`, `camera`, `controls` | this miniature's own scene, the group to fill, its camera, its orbit controls |
| `keyLight`, `sky` | warm shadow-casting key light and cool hemisphere fill; adjust intensity or colour for mood (night, storm) |
| `frame(obj, opts)` | fit camera and light to `obj`. `opts.view` camera direction, `pad` margin, `light` key direction, `minZoom`/`maxZoom`, `ground: 'none'` to drop the floor shadow |
| `loadGLTF(url)` | `{ scene }` clone of a cached glTF/GLB (meshopt and KTX2 supported) |
| `loadTexture(url, { srgb, repeat })` | cached texture; `srgb: true` for colour maps, false for normal/roughness maps |
| `addContactShadow({ y, size, exclude, opacity, blur, darkness, height })` | another soft contact shadow, e.g. pieces settling onto a board top; `exclude` lists objects that must not cast it (the board itself) |
| `requestRender()` | redraw after you change something outside `update` or `tick` |
| `animate(fn)` | run `fn` once on the next frame |
| `onTap(fn)`, `pick(x, y, objects)` | taps that did not orbit (`fn(hits, event)`, hits nearest first), and raycasts from a client point |
| `handle` | the live miniature: `handle.data` is always the latest data the card passed (read callbacks like `onSquare` from it) |
| `still` | true when the visitor asked for less motion |
| `phone` | true on a phone: load lighter assets |

## Rules that keep it beautiful and fast

- Make things in real-world metres (a clock is about 0.1 m). The lights, shadow box and camera are fitted to the model's
  size by `frame`, and real proportions make the soft shadows and reflections look right.
- Use `MeshStandardMaterial` or `MeshPhysicalMaterial` with real roughness and metalness values. The scene lights them
  with a room environment map, so metals, glass and lacquer reflect naturally without extra lights.
- Set `castShadow = true` on meshes that stand on the ground and `receiveShadow = true` on surfaces that catch shadows;
  the contact shadow under the model is automatic.
- Use enough segments on curved surfaces (48–96 around a lathe or cylinder). The renderer supersamples on desktop, and
  smooth silhouettes are what make a miniature read as real.
- Drive behaviour from `data` (real time, real weather, the card's own numbers) so the miniature acts like what it is.
- Keep decorative idle motion (bobbing, spinning) off when `ctx.still` is true; behaviour that carries information, like a
  clock's hands, keeps running. Return `false` from `tick` on frames where nothing changed, so idle cards cost nothing.
- Keep each miniature's download small: build from code where you can; put models under `void-live-deploy/models/` as
  meshopt-compressed GLB with WebP textures (1k maximum on phones, check `ctx.phone`). Give a changed asset a new file
  name, because `/models/*` and `/vendor/*` are cached as immutable by the service worker and `_headers`.
- Credit every outside asset in `void-live-deploy/models/CREDITS.md` (CC0 or CC-BY only).

## How it draws (so you know what is free and what costs)

One hidden WebGL renderer draws each visible miniature in turn and copies the frame into that card's own 2D canvas.
That keeps cards in their DOM order (a covered card stays covered, tilt and drag work) and the page never runs out of
WebGL contexts. Light: ACES filmic tone mapping, sRGB output, PMREM room environment, PCF soft shadows from the key
light, blurred contact shadows. A miniature redraws only when it is on screen and something changed (orbit, zoom,
`update`, a `tick` that returned true). The empty page loads none of this: `scene3d.js` and three.js load on the first
`miniature(...)` call.

When a miniature has drawn its first frame it says so (asked by Verse, 2026-10-14: a rendered signal): its wrapper goes
from `data-rendered="false"` to `"true"`, its canvas from `aria-busy="true"` to `"false"` and fades in from transparent,
and one `void:mini-rendered` event bubbles up with `{ key, kind }`; `liveMiniatures()` lists `rendered`. Before that the card
shows a low-poly wire shape turning slowly on its own small canvas (`.void-mini-wire`, plain 2D, there the moment the card asks and
before three.js has loaded; still with reduced motion), never a half-built scene; it fades out as the first frame fades in (asked by
Verse, 2026-10-14: a progressive loading state during 3D card transitions). A test or a skill that must wait for the 3D can wait on
`.void-mini[data-rendered="true"]` or the event instead of polling `draws`.

A model that fails (its module missing, its build throwing, three.js not loading on a device that has WebGL) leaves a small status
card where the empty space would have been (`.void-mini-status`: "3D <kind> did not load", why in plain words, "Ask for it again to
retry"), marks the wrap `data-rendered="failed"` and bubbles one `void:mini-failed` event with `{ key, kind, why }`; the mount still
rejects, so a card that shows its flat version on rejection still does (asked by Verse, 2026-10-12). Without WebGL nothing is put in and
the rejection alone tells the card to go flat, as before.

**Detail (asked by Verse, 2026-10-15: a low-poly toggle for older hardware).** One setting, `a2m.void.3d.v1`: `low` draws every
miniature at 1x pixels (`REGRESS_DPR`) with no key-light or contact shadows and keeps the stage figures at their light mesh tier;
`full` never steps down; unset is auto, where the quality governor, having reached its lowest pixel step and still running late,
takes low-poly as the step below it and climbs back once frames keep up (`governStep`, pure, `tools/scene3d.test.mjs`). "low poly 3d",
"full 3d" and "auto 3d" set it (`skills/figures.js`); `setDetail(mode)`, `detail()` and `lowPoly()` are exported, a `void:3d-detail`
event follows every change, and `window.__voidMini.detail()` shows it in the console.

## Tests

`tools/test_3d.mjs` (run inside `node tools/test_void.mjs`) checks the empty page stays at zero 3D bytes, a miniature
mounts with the realistic settings and draws pixels, and re-mounting by key moves it. Add a check there for each new
miniature: mount it with sample data, wait for `window.__voidMini.list()[0].draws > 0`, and assert on what `update` does.
To tap something in a test, `window.__voidMini.project(key, [x, y, z])` turns a point in the miniature's scene into client
pixels for `page.mouse.click`, so the test taps exactly what a visitor sees. The headless browser renders with
SwiftShader (a first frame can take several seconds), so wait on `draws`, never on a fixed delay.

## Playable miniatures: chess and checkers

`skills/mini/chess.js` and `skills/mini/checkers.js` are the first miniatures you can play. Read them as the pattern for
any card whose miniature takes input:

- The card owns the state and the rules (`skills/chess-rules.js`, `skills/checkers-rules.js`, plain JS that the tests
  run without a browser); the miniature only shows `data` and reports taps through `data.onSquare(sq, candidates)`.
  Keeping the rules out of the 3D code means the same game also runs on the flat fallback board where WebGL is missing.
- Taps report every square along the ray, nearest first (`tapSquares` in `skills/mini/tabletop.js`), and the card picks
  the first one that means something. A tall piece in front never swallows a tap meant for the one behind it.
- When the data carries the move that just happened (`last`), the miniature animates it (a lift and glide, captured
  pieces set beside the board); any other change re-lays the scene. Animate what the visitor did, re-lay everything else.
- `skills/mini/tabletop.js` holds the shared wooden table, board coordinates, highlight decals and tweens; reuse it for
  any other board game so they all sit on the same table under the same light.
- Search work that takes more than a frame goes in a Web Worker (`skills/chess-worker.js`) or waits until the
  animation has landed, so the pieces never stutter.


## The reference miniature: the countdown's calendar

`skills/mini/countdown.js` is the reference for how a living miniature behaves (the gear-pair explainer, frontier #17, is the reference for explainers, with its own required tests): copy its shape, and run a new kind through the same
behaviour contract before it ships. It is small (one file, built from code, no downloads), its state comes only from the
card's data, and every rule below is checked in `tools/test_3d.mjs` by `miniContract(fresh, { kind, a, b })`.

| rule | how the countdown does it | how the contract checks it |
|---|---|---|
| state comes from data only | `days` from `data.target` (local date) or `data.days`; nothing else is kept | `state()` after mounting with `a`, then with `b` |
| a change is shown, not just stored | the old leaf flips up over the rings and the new count is underneath | the canvas pixels differ after the update |
| re-render keeps the live one | the card mounts again with the same key | the same handle comes back (nothing rebuilt) |
| idle costs nothing | `tick` returns `false` once the flip has landed | no redraws for 1.5 s once settled |
| reduced motion | `ctx.still`: the new count lands at once, no flip | under `prefers-reduced-motion` the state is settled right after the update |
| it cleans up | `dispose` frees its geometries, materials and canvas textures | `unmountMiniature` removes it from the live list |
| it can be inspected | `state()` returns `{ days, label, flipping }` | the contract reads it with `window.__voidMini.state(key)` |

To check a new kind: give it a `state()` that returns what it shows (plus a `flipping`-style flag while it animates; pass
its name as `settledWhen`), then add one `miniContract` call in `tools/test_3d.mjs` with two data values that should look
different. A kind that carries live information (a clock's hands) redraws while idle by design; check its idle rule
yourself instead of asserting `idleDraws === 0`.

## Card miniatures that ship today

| kind | card | what it does |
|---|---|---|
| `clock` | worldtime ("time in Tokyo", "world clock", "3pm London to Tokyo") | brass desk clock per place, hands on that zone's real time with a sweeping second hand; a converted time stops the hands at that moment |
| `weather` | weather ("weather in Oslo") | diorama: sun or moon by local day/night, clouds, rain or snow falling, fog, lightning, wind in the trees, thermometer at the real temperature |
| `chess`, `checkers` | the playable boards | see above |
| `stopwatch` | the stopwatch page ("start a stopwatch") | chrome stopwatch lying on the desk, sweep hand and 30-minute register read the card's time; tap the crown to start or stop, the pusher to reset |
| `calculator` | the calculator stage card ("calculate 12*7") | a calculator in five Verse models that take turns on new cards (owner, 2026-10-25; `MODELS` in the file, one builder, `data.model`, round-robin in `skills/calc.js` from `a2m.void.calcmodel.v1`; `tools/calculator-models.test.mjs`): SL-200 SOLAR pocket, FX-900 SCIENTIFIC (two-line display, six columns, amber SHIFT), DT-12 DESK (a wedge, big keys, 12 digits, 00 and tax keys, a paper roll that prints), RP-11 FINANCIAL (landscape, gold on brown, ENTER bar, n i PV PMT FV), GX-84 GRAPHING (tall, pixel screen with a sine wave, arrows, F1–F5). The badge says VERSE, the model and what kind it is, never a maker's name. A new sum presses its keys one by one, the display follows the typing, then `=` and the result; tapped keys work it by hand on every model (ENTER is `=`, AC is `C`; a key the four-function logic has no use for presses and does nothing else) |
| `notepad` | the notepad stage card ("make a notepad") | yellow legal pad with gummed red binding, ruled sheet and red margin; the card's title and text are handwritten on it and rewrite as you type; a sharpened pencil beside it |
| `piggybank` | savings goals ("how long to save 50000 if i save 500 a month", "how much to save a month for 1 million in 30 years", "savings calculator") | blown-glass piggy bank filling with coins from where you start to the goal while coins drop through the slot; silver paid in, gold growth (the colours of the `savings` coin stacks); the calculator's piggy follows its inputs |
| `go` | the Go board ("play go", "play baduk") | a 9×9 kaya goban standing in the void with slate and shell stones; the newest stone drops in and wears a red ring; dead stones go translucent once play ends; its card is separate (`skills/side-card.js`) |
| `battleship` | Battleship ("play battleship") | the folding case: your ocean flat with your grey fleet and Verse's pegs, your target board upright with yours; Verse's fleet is never in the data, so it can't be drawn |
| `poker` | Poker ("play poker") | a felt card table: your cards face up, Verse's face down across from you (they are only in the data after a showdown), the board in the middle, the stacks and pot as clay chips |
| `fireworks` | Fireworks, co-op ("play fireworks", "play hanabi") | Verse's cards stand facing you, yours face Verse with what hints told you chalked on their backs; the five rows in the middle, blue hint tokens and red mistakes at the sides |
| `connect4` | Connect Four ("play connect 4") | the upright blue frame with real holes; discs drop down the column and settle; the winning four ringed in light |
| `monopoly` | Monopoly ("play monopoly") | the property board in the void: the forty spaces drawn on its top, a turned pawn per seat that walks space by space, owner markers, green houses and red hotels, the roll on two dice |
| `rack` | the game rack ("games", "what games do you have", "play a game") | a walnut shelf of boxed board games with drawn covers; tap a box and it slides out, the rack is put away and that game opens |
| `ringer` | Ringer, single player ("play marbles", "marbles", "shoot marbles", "ringer") | a schoolyard ring on packed dirt: a hand-drawn chalk line, thirteen 16 mm glass marbles in a cross (cat's eyes, swirls, clearies, each its own from `figures.js` `marbleLook`) and a worn agate shooter; tap the dirt to aim, Flick on the card; nothing is simulated in the miniature: every frame poses the marbles from the card's one state (`skills/ringer-rules.js`), the spin from how far each rolled |
| `book` | on the salvage shelf (`docs/SALVAGE.md`, 2026-10-16): no card mounts it now that "open the book" is the full-screen tome (`lib/tome.js`) | a hardcover lying on the desk: tap the cover and it swings open on its spine; the leaves really turn and curl; every face is a page of `skills/guide.json` laid out by `lib/book-face.js`. Could become the book as a thing on the stage (drag it, open it where it lies) |
| `tower` | the Versus card ("versus", "the tower", "which sites have you surpassed") | Versus in 3D, a tower of floors on a dark plinth in deep space: one floor per site, the first conquest at the bottom, surpassed floors solid with the site's name in gold on the face, the current floor a glowing scaffold with its n-of-m ring, the next three of the queue as outlines, Verse's mark on top; names stop at the last twelve plus the current one ("+N more below" on the plinth); tap a floor to pick it on the card |
| `heart` | heart rate ("heart rate zones for a 40 year old", "is a resting heart rate of 55 good", "heart rate zone calculator") | glossy red heart on a walnut stand beating lub-dub at the card's rate (the middle of the asked zone or target band, or your resting rate) beside a bedside monitor with a live ECG trace and bpm |
| `dice` | the random number ("random number between 1 and 100") | an ivory number die on the desk: the number drawn on top in red, other numbers of the range on its sides; a new number tumbles it and it lands with that number up (owner, 2026-10-25: "3d figure if possible"; tool cards mount through `lib/card-mini.js` `bandMini`) |
| `padlock` | the password generator and "how secure is my password" | brass padlock with a steel shackle and a five-bar strength strip in the rating's colour (`lib/pwcheck.js` score); weak (0-2) springs the shackle open, strong shuts it; the check card's padlock follows the box as you type |
| `swatch` | the colour card ("color #ff5733") | a riveted paint-chip fan spread on the desk: the colour on the top chip with its hex printed at the free end, tints and shades under it; a new colour sweeps it open again |
| `wheel` | the wheel card ("spin the wheel with ann, bob and cat") | a prize wheel on a wooden stand, one slice per choice with its name (weights widen a slice), a red pointer; it spins two turns and stops on the winner the card drew (lib/wheel.js) |
| `bubbles` | the translate card ("translate hello to spanish") | two speech bubbles face to face: your words in white, the translation in violet with the language under it; a new translation swings the reply round once |
| `pot` | the recipe card ("recipe for pancakes") | a steel pot on a cutting board with the recipe card leaning on it (the dish and how many ingredients); a new dish lifts the lid in a puff of steam |
| `page` | the word count card ("count words in ...") | a sheet on a small stack, written over with as many lines as the words fill and the count pencilled big at its foot; a new count slides a fresh sheet on |

Stage cards (the calculator) mount into a small host inside the card with `stageApi.miniature(host, kind, data, { key: kind + ':' + th.id })`: render() rebuilds the card DOM, and the same key moves the live miniature into the new host and calls `update(data)` instead of building it again.
Tests read a kind's own `state()` with `window.__voidMini.state(key)`.

Page cards (weather, worldtime) put the miniature in a `.vmini` band at the top of the page: create the band, `el.prepend`
it, call `api.stage.miniature(band, kind, data, { key })`, and remove the band in `.catch` so a browser without WebGL
shows the plain card. A page that redraws its text keeps the band by re-prepending it (see `clockMini` in worldtime.js).

## Boards in the void, cards beside them

A game's board stands in the void as a 3D object with no card around it, and its card (whose turn, buttons, counts) is a
separate panel you move on its own (Adam, 2026-10-08). `skills/side-card.js` gives you both halves: `grip(label)` is the
slim handle under the board (the canvas takes taps and orbits), and `sideCard(th, stageApi, card, { boardW, boardH })`
places the card beside the board, or under it on a narrow screen, and remembers where it was left in `th.card`. Go, the
game rack, and the desktop chess and checkers boards use it.
