# Free pictures: every source Verse can use, ranked (researched 2026-10-26, owner: "dont forget to find free pics")

Extends `docs/sports-pictures.md` (which stays: the sports licence map, what is not safe). This page is the whole field: sports first, then the cards in general. Code: `lib/free-pics.js` (one registry, `findPictures`). Live behaviour: the weekly probe, `domains/free-pics.probe.json` (what each source actually answered from a GitHub runner; see "Probe results" at the end). Marks: **[confirm]** = the evidence was a secondary source (a guide, a library's README, a search summary), read the provider's own page before relying on it; **[owner]** = the owner supplied it, not checked. Nothing here is legal advice; where a rule is unclear Verse takes the safer path (refuse, or keep the drawing).

## Rules that apply to every row
- Accept only CC0, public domain (PDM, NASA, no known restrictions), CC BY, CC BY-SA and a source's own open-access licence (Pexels, Pixabay, Unsplash). Refuse NC, ND, "all rights reserved", unknown.
- Always credit: author, title, licence with link, source with link, a report link; label an archive picture as an archive picture.
- A picture's licence covers the photographer's rights only. Still not allowed: identifiable people used for publicity or endorsement, trademarks and sponsor logos in the frame, children and youth sport, a venue's or event's own terms (Commons notes these in a `Restrictions` field; the filter refuses "personality rights").
- Stock sources (Pexels, Pixabay, Unsplash) are for generic pictures only: never for a named player, team or event.
- Queries are closed: a vetted subject (league, sport, generic word) or text from a fetched answer. A visitor's words are never sent to a source.

## Ranked table
Keyless first. "Key" = a free instant key (owner action) or none. Rate limits are the provider's stated defaults where found.

| # | Source | Endpoint | Key | Licence and how the API says it | Attribution | Rate limit | Hotlink / copy | Good for | Not allowed or watch |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Wikimedia Commons** | `commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&prop=imageinfo&iiprop=extmetadata...` (also categories, featured pictures, Wikidata P18 via the same file name) | none | per file in `extmetadata`: `LicenseShortName`, `LicenseUrl`, `Artist`, `NonFree`, `Restrictions`; CC0, PD, CC BY, CC BY-SA (also NC/ND files exist: filtered) | author + licence + link | no hard number; polite User-Agent, serial requests **[confirm]** | thumbnails on upload.wikimedia.org may be hotlinked; Verse copies the small one | sports history, venues, players, places, animals, art | personality/venue/event terms, sponsor-logo categories, children; the licence is the photographer's only |
| 2 | **Library of Congress** (Prints & Photographs, Free to Use and Reuse) | `loc.gov/photos/?fo=json&q=` (JSON on any loc.gov URL with `fo=json`) | none | per item `rights_advisory` / `rights` text ("No known restrictions on publication") and `access_restricted`; the Free to Use sets are curated | credit line "Library of Congress" + creator | **official: 20 requests a minute for the JSON API, over it blocks the caller for an hour**; images 150/min; CAPTCHA/429 when busy | hotlink tile.loc.gov / cdn.loc.gov | public-domain sports photos (Bain collection), history, people of the past | data still being restored since the 30 June 2025 platform change: parse defensively; budgeted at 6 a minute site-wide, answers cached 2 days |
| 3 | **Openverse** | `api.openverse.org/v1/images/?q=&license=cc0,pdm,by,by-sa&mature=false` | none (a free client id/secret raises limits) | per result `license`, `license_version`, `license_url`, `creator`, `foreign_landing_url`, `mature` | author + licence + origin | anonymous lower, registered "slightly higher", more on request; limits in response headers **[confirm numbers]** | thumbnails served by the API | anything (aggregates Flickr, Commons, museums) | inherits each origin's rights; same refusals |
| 4 | **NASA Image and Video Library** | `images-api.nasa.gov/search?q=&media_type=image` (+ `/asset/{nasa_id}`) | none | NASA media is generally not copyrighted; no licence field per item **[confirm]** against NASA's media usage guidelines | "NASA" + credit line | not stated **[confirm]** | images-assets.nasa.gov | space, aircraft, earth, history of flight | no endorsement; NASA logos; third-party or copyrighted items (filtered if the text says so); identifiable astronauts for ads |
| 5 | **The Met Collection** | `collectionapi.metmuseum.org/public/collection/v1/search` and `/objects/{id}` (**[owner]** says `/v1.1/search` replaced the legacy search on 1 Oct 2026: the probe asks v1.1 first, then v1) | none | CC0; object record has `isPublicDomain` (required `true`) | credit "The Met" | undocumented **[confirm]**; asked about 1 a second | images.metmuseum.org | art, antiquities, animals in art, history | only `isPublicDomain === true` objects |
| 6 | **Art Institute of Chicago** | `api.artic.edu/api/v1/artworks/search?query[term][is_public_domain]=true&fields=...image_id` | none | data CC0; descriptions CC BY 4.0 **[confirm]**; images of public-domain works CC0 via IIIF `.../iiif/2/{image_id}/full/843,/0/default.jpg` | credit museum | 60 a minute per IP **[confirm]**; send an `AIC-User-Agent` | IIIF server | art | public-domain flag required |
| 7 | **Cleveland Museum of Art** | `openaccess-api.clevelandart.org/api/artworks/?cc0=1&has_image=1&q=` | none | `share_license_status: "CC0"` per record | credit museum | not stated **[confirm]** | openaccess-cdn.clevelandart.org | art | CC0 flag required |
| 8 | **Smithsonian Open Access** | `api.si.edu/openaccess/api/v1.0/search?api_key=&q=...` | free api.data.gov key | CC0 per media item (`content.descriptiveNonRepeating.online_media.media[].usage.access`) | credit the unit | api.data.gov default 1,000 an hour **[confirm]**; one community report says detailed responses may no longer carry media URLs **[confirm]** | ids.si.edu | history, science, animals, sport memorabilia | only items with a CC0 media usage |
| 9 | **Europeana** | `api.europeana.eu/record/v2/search.json?wskey=&reusability=open&qf=TYPE:IMAGE` | free key | `rights` URL per item (CC0, PDM, CC BY, CC BY-SA are "open") | creator + data provider | 100 rows a request; daily quota per key **[confirm]** | `edmPreview` thumbnails | European history, art, sport history | rights URLs come as `http://`; NC/ND and rightsstatements.org are refused |
| 10 | **Internet Archive** | `archive.org/advancedsearch.php?q=...licenseurl:(*creativecommons.org*)&output=json` | none | `licenseurl` field (uploader-set, so only accepted when it is a CC/PD URL) | creator + link | not stated **[confirm]** | `archive.org/services/img/{id}` (small) | old books, photos, posters | uploader-declared licences are weaker evidence |
| 11 | **Flickr** | `api.flickr.com/services/rest/?method=flickr.photos.search&license=...` | key | licence id per photo (4 BY, 5 BY-SA, 7 no known copyright, 8 US gov, 9 CC0, 10 PDM, 11/12 BY/BY-SA 4.0; NC/ND ids refused) | author + licence | 3,600 a query an hour per key **[confirm]** | static.flickr.com | sport, places, people | **a free key is non-commercial; commercial use needs Flickr's approval [confirm]**: off unless `FREE_PICS_FLICKR_COMMERCIAL=1` |
| 12 | **Pexels** | `api.pexels.com/v1/search` | free key | Pexels License (free commercial use); per photo `url`, `photographer` | **API terms: a prominent link to Pexels and credit the photographer where you can** | 200 an hour, 20,000 a month; higher free on request (headers `X-Ratelimit-*`) | cache 24 h; images.pexels.com | generic sport, places, animals | no implied endorsement; not for named people/teams; do not replicate Pexels itself |
| 13 | **Pixabay** | `pixabay.com/api/?key=&q=` | free key | Pixabay Content License | link to Pixabay when showing results | **[confirm]** 100 a minute or 5,000 an hour (sources disagree); cache 24 h | **do not hotlink; copy [confirm]** | generic sport, places | no standalone redistribution; not for named people |
| 14 | **Unsplash** | `api.unsplash.com/search/photos` | free key (demo mode: low hourly cap **[confirm]**; production on approval) | Unsplash License | **photographer + Unsplash, links with UTM; hotlink `photo.urls`; call `links.download_location` when used** | demo 50 an hour, production 5,000 **[confirm]** | hotlink required | generic sport, places | no competing service; not for named people; images are hotlinked (the route copies bytes, so Unsplash is best used only where hotlinking is possible) |
| 15 | **Wikipedia / Wikidata page images (P18)** | `wikidata.org/w/api.php?action=wbgetentities&props=claims` then the Commons file | none | the file's own Commons licence (read from Commons, never assumed) | as Commons | as Commons | as Commons | a named place, club or person's lead picture | a Wikipedia page image can be fair-use and local to one language wiki: only Commons files |
| 16 | **Giphy / Tenor** | — | — | GIF platforms: the content is third-party and copyrighted; their terms limit use to their embed/attribution and forbid storing | — | — | — | **skipped**: not openly licensed pictures, no per-item licence, and their API terms tie use to their branding and player |

Other possible later sources (not built): Rijksmuseum (new open data at data.rijksmuseum.nl, key status unconfirmed **[confirm]**), Wellcome Collection (CC BY/PD, keyless), Biodiversity Heritage Library, Geograph, NOAA/USGS public-domain photo libraries.

## What to use for what
- **Sports league/sport headers and venues:** Commons, Library of Congress, Openverse, Europeana, then Pexels/Pixabay generic (archive-labelled where not from the game). Real photos of the game itself still need money (`docs/sports-pictures.md` rank 10).
- **Space, planets, aircraft:** NASA first.
- **Art, history cards:** Met, Chicago, Cleveland, Smithsonian, Europeana, Commons.
- **Animals and places:** Commons, Smithsonian, then the stock sources.
- Always a drawing as the fallback, always the credit line, always the report link.

## Owner actions (free keys; GitHub and Cloudflare secrets only, never a file)
| Source | Where to get it | Variable (set in both GitHub repo secrets and Cloudflare Pages secrets) |
| --- | --- | --- |
| Pexels | pexels.com/api | `PEXELS_API_KEY` |
| Pixabay | pixabay.com/api/docs | `PIXABAY_API_KEY` |
| Unsplash | unsplash.com/developers (demo app) | `UNSPLASH_ACCESS_KEY` |
| Smithsonian | api.data.gov/signup | `SMITHSONIAN_API_KEY` |
| Europeana | pro.europeana.eu (API keys) | `EUROPEANA_API_KEY` |
| Flickr | flickr.com/services/apps (commercial key needs approval) | `FLICKR_API_KEY` and, only once approved, `FREE_PICS_FLICKR_COMMERCIAL=1` |
| Openverse (raises limits) | `POST api.openverse.org/v1/auth_tokens/register/` | `OPENVERSE_CLIENT_ID`, `OPENVERSE_CLIENT_SECRET` |
Switches: `FREE_PICS_OFF=1`, `FREE_PICS_<ID>=0`, `FREE_PICS_DAY` (global daily cap, default 400).

## Probe results (GitHub runner, 2026-10-26; `domains/free-pics.probe.json`, refreshed weekly)
| Source | Result | Notes |
| --- | --- | --- |
| Commons | works, 200, 0.8 s, 9 of 10 accepted for "football" | real thumbnail host is `thumb.wikimedia.org`, not only `upload.wikimedia.org` (the first probe lost 8 of 10 to that; fixed here and in `lib/daily-photo.js`); a named-player query keeps 9, refuses sponsor/logo categories; no rate-limit headers |
| Openverse | works, 200, 4 to 6 s (slow), 10 of 10 | anonymous; `license_url` per result; no rate-limit headers seen anonymously |
| NASA | works, 200, 0.4 s, 10 of 10 | keyless; no licence field per item, accepted as public domain with the NASA media guidelines link **[confirm]** |
| Met | works, 200, 0.3 s | **the owner's `/v1.1/search` answered (via primary)**; objects checked for `isPublicDomain === true` |
| Art Institute of Chicago | works, 200, 0.4 s, 10 of 10 | IIIF `/full/843,/0/default.jpg` built from `image_id` and `config.iiif_url` |
| Cleveland | works, 200, 0.4 to 1 s, 10 of 10 | `share_license_status: CC0` |
| Internet Archive | works, 200, 0.5 to 0.8 s, 10 of 10 | licence is a `licenseurl` (often `http://`); thumbnails are small |
| Library of Congress | the first answers were 200 with results at `results[]` (ids as `http://`, `image_url` with `#h=..&w=..` fragments, `access_restricted`); **the later probes were blocked with a 403** (the documented one-hour block: the probe asked four extra variants and several runs came close together). Parser fixed from the shapes seen; the rights statement field still needs one clean look (the next single-request probe records `rightsFields`) | do not probe it more than once a day; `explore` is by hand only |
| Smithsonian, Europeana, Flickr, Pexels, Pixabay, Unsplash | needs key (not probed) | owner actions above |
| Rate-limit headers | none of the keyless sources sent `X-RateLimit-*` headers to an anonymous caller | Pexels/Unsplash send them with a key **[confirm]** |
