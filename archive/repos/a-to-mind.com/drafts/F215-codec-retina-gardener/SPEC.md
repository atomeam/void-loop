# F-215 Codec Retina Gardener

Open `index.html` over http(s) or localhost (WebCodecs needs a secure context). Chrome or Edge gives the full path; anything without `VideoEncoder` still runs the world, but the retina is blind.

What it is: a Gray-Scott reaction-diffusion world (WebGPU compute at 256², Canvas2D at 128² as fallback) split into 16 patches. Each patch is watched by its own `VideoEncoder` (VP9 in constant-quantizer mode, 64×64, realtime). The size of each delta frame is the part of the patch that motion-compensated prediction could not explain, so it is a free, hardware-backed surprise signal. A gardener agent steers every patch toward the edge of chaos: not dead, not noise.

Controls: click the world to seed life, click a retina card for its learned action values (a native `popover`), and use Pause, Storm or Drought to test it.

Bench: `bench.cjs` (see the header comment). See `ledger/frontier/F-215-codec-retina-gardener.md` for results.
