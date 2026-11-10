# Paint by number pictures

What starts it: a picture on /paint/ looks crude, or a new one should join the library.

The pictures live in `void-live-deploy/paint/templates/<id>.json` (width, height, palette, run-length labels). The index lists them. `node tools/paint-pictures.mjs` only adds a template the index does not name yet. It does not redraw a picture.

Two paintings are public domain and stay as they are: The Great Wave (Hokusai) and The Starry Night (Van Gogh). The others are original drawings made for Verse, public domain (CC0). Do not copy a colouring app's pictures.

A photo becomes a sheet with `python tools/paint-template.py <image> <out.json> --name "..." --credit "..."`. Credit a public-domain source on the template. Then run `node tools/paint-pictures.mjs` so the index picks it up.

How to tell it worked: open `/paint/?p=<id>`. The library shows the coloured picture, the sheet is white with a number in each area, a tap of the matching colour fills that area, and a reload brings the areas back. `node tools/test_void.mjs --only "paint probe"` checks the wave.
