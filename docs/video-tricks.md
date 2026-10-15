# V01D's video tricks library

Every trick is a named, reusable effect in `tools/clips.mjs` (`TRICKS`). A clip names the tricks it uses; `plan` adds the defaults
(pattern-interrupt, hook-card, kinetic-captions, progress-bar, seamless-loop). All art is procedural and original: ffmpeg filters
(`drawtext`, `drawbox`, `zoompan`, `rgbashift`, `noise`, `geq`, `xfade`) over the live site filmed in headless Chrome, plus a beat
synthesized with `aevalsrc`. No stock footage, no model calls, no Workers AI.

| Trick | What it does | Built with |
|---|---|---|
| pattern-interrupt | white flash in the first frames, so the thumb stops | drawbox |
| hook-card | the hook line huge in the first 2 s, popping in | drawtext alpha |
| kinetic-captions | 3-word phrases timed across the clip, alternating color, above the thumb zone | drawtext enable windows |
| zoom-punch | 12% punch-ins on the beat | zoompan |
| ken-burns | slow push-in camera move (fake dolly) | zoompan |
| glitch-transition | RGB split + noise for a few frames mid-clip | rgbashift, noise |
| beat-flash | soft flash on each beat of the synthesized track (sound-sync) | drawbox mod(t, beat) |
| progress-bar | bar filling across the top so viewers stay to the end | drawbox width = t/dur |
| countdown | 3-2-1 before the reveal | drawtext |
| before-after | "BEFORE: an empty page / AFTER: one sentence" | drawtext |
| pov | "POV: ..." framing line | drawtext |
| vignette | darker edges so the miniature pops | vignette |
| seamless-loop | the end card crossfades into the first frame, so the Short replays without a seam | xfade |
| parallax camera | the mouse drifts over the 3D stage while filming, so the live miniature's camera moves | Playwright mouse during capture |
| explosion | fireball with turbulent edge, shockwave ring, embers, smoke, white flash | geq per-pixel layer + overlay |
| camera-shake | hard handheld shake for 0.6 s (rides with every explosion) | crop with sin/cos offsets |
| ufo-flyover | saucer with lit dome and blinking rim lights warps in, wobbles across, warps out | geq saucer + moving overlay |
| ufo-abduction | saucer stops over the card or mini; flickering tractor beam lifts it (the frame rises and shrinks) | geq beam + zoompan lift |

## Why these (sources)
- Hook in the first second or two; "shock, intrigue, satisfy": YouTube Shorts deep dive, YouTube Blog — https://blog.youtube/creator-and-artist-stories/youtube-shorts-deep-dive/
- Most Shorts are watched muted, so captions carry the message; one line, 4-7 words, word-boundary timing: https://picute.net/en/blog/youtube-shorts-caption-best-practices
- Pattern interrupt and on-screen hook text lift early retention; read the retention curve (early cliff = hook, slow decline = pacing): https://instavar.com/research/production-systems/youtube-shorts-retention-curve-guide-2026
- Visible result, before/after or a question in the first 3 s, not a logo: https://www.capcut.com/create/short-form-video-hooks
(The retention percentages in those third-party posts are their claims, not YouTube's.)

## Queue (not built yet)
match cuts between two moments, speed ramps (trim + setpts segments), split screen of two games (vstack), 3D-stage orbit camera
driven from the page instead of the mouse, word-level karaoke captions, sound-designed whooshes on transitions, debris chunks with
gravity in the explosion.

## It keeps growing
1. Void's daily reflection (`lib/voice.js`) now asks: "Which new video trick should you learn next for your own clips?" Its answer
   is saved word for word as `next_trick` (shown in `domains/void.voice.md` by `tools/reflect.mjs`).
2. A builder implements it as a new entry in `TRICKS`, adds a row here, and appends `{ trick, at, asked: "Void (daily <date>)" }`
   to `learned` in `domains/void.clips.json`. Commit trailer: `Suggested-by: Void (daily <date>)`.
3. `tools/self-context.mjs` puts the trick names, the `learned` list and clip visits into `self.json`, so Void knows its library
   and does not ask for a trick it already has.
4. The queue above is the fallback: when Void names nothing new, take the top queued trick.
