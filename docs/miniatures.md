# Card miniatures: the shared 3D scene

Every card can show a small, detailed 3D version of itself that behaves like the real thing (a clock whose hands keep
time, a weather diorama that rains or shines). This file is the API for building one. The engine is
`void-live-deploy/skills/scene3d.js`; the template miniature is `void-live-deploy/skills/mini/sample.js`.

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
| `THREE` | three.js r180 (vendored at `/vendor/three-r180/`) |
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


## Card miniatures that ship today

| kind | card | what it does |
|---|---|---|
| `clock` | worldtime ("time in Tokyo", "world clock", "3pm London to Tokyo") | brass desk clock per place, hands on that zone's real time with a sweeping second hand; a converted time stops the hands at that moment |
| `weather` | weather ("weather in Oslo") | diorama: sun or moon by local day/night, clouds, rain or snow falling, fog, lightning, wind in the trees, thermometer at the real temperature |
| `chess`, `checkers` | the playable boards | see above |
| `stopwatch` | the stopwatch page ("start a stopwatch") | chrome stopwatch lying on the desk, sweep hand and 30-minute register read the card's time; tap the crown to start or stop, the pusher to reset |
| `calculator` | the calculator stage card ("calculate 12*7") | solar pocket calculator: a new sum presses its keys one by one, the seven-segment LCD follows the typing, then `=` and the result |

Stage cards (the calculator) mount into a small host inside the card with `stageApi.miniature(host, kind, data, { key: kind + ':' + th.id })`: render() rebuilds the card DOM, and the same key moves the live miniature into the new host and calls `update(data)` instead of building it again.
Tests read a kind's own `state()` with `window.__voidMini.state(key)`.

Page cards (weather, worldtime) put the miniature in a `.vmini` band at the top of the page: create the band, `el.prepend`
it, call `api.stage.miniature(band, kind, data, { key })`, and remove the band in `.catch` so a browser without WebGL
shows the plain card. A page that redraws its text keeps the band by re-prepending it (see `clockMini` in worldtime.js).
