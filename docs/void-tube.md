# Verse Tube

Owner, 2026-10-15: "Verse should be its own version of YouTube, on top of sharing all the other sites"; "anyone can upload them, and every video should be its own ad; the more the better."

## Phase 1 (live)

- **Channel:** `a-to-mind.com/films/`: every Verse film (`record.yml`) and every daily ad clip (`clips.yml` posts each with `tools/film-post.mjs`) in one grid, newest first, with views and date.
- **Watch page:** `/films/?v=<id>`: player, title, description, views, Share it (X, Facebook, Reddit, WhatsApp, Bluesky, LinkedIn, copy link, the phone's share sheet), Upload it to your own channel, Up next (related videos).
- **Anyone uploads, free** (`lib/film-share.js`): tabs for YouTube, TikTok, Reels and X. 1. Download (free MP4), 2. Copy for <platform> (title, description that opens with the Verse call to action and a tracked `a-to-mind.com/c/<id>?p=<platform>&by=share` link, a share-this-ad line, hashtags), 3. Upload to <platform> (its own upload page, signed in as you). No API or token.
- **Views:** `functions/api/film-views.js`: one D1 row per video, one upsert per view (once per tab), no KV.
- **RSS:** `/films/rss`: each item links its watch page.
- **Hosting:** Cloudflare R2 `void-films` (10 GB and egress free on the free tier); a 20-second Short is about 5 MB, so about 2,000 videos fit free.
- Verse knows it: self.json `clips.upload`; "upload this to YouTube" opens the films skill's steps.

## Phase 2 (plan only, nothing built)

1. **User uploads with moderation:** signed-in accounts (passkey, `functions/api/passkey.js`) upload to an R2 `pending/` prefix; a size and length cap; Workers AI image moderation on sampled frames, then an owner review queue on `/films/` (like film reviews); published only after approval.
2. **Accounts and channels:** `/films/@name` per account (reuse the `/@name` public pages), subscribe = RSS per channel plus an in-site follow list.
3. **Creator monetization via Gumroad:** each creator links their Gumroad product or tip page; a "Support this creator" button on their watch pages; Verse Pro creators get a smaller platform cut (store plan).
4. **Comments:** D1 table, one per account per minute, keys and links masked, the owner can hide; reports go to the moderation queue.

## Wishlist (free path first)

| Item | Free path | Paid path, only if needed |
| --- | --- | --- |
| Video storage | R2 free 10 GB, then delete old drafts | R2 $0.015/GB-month |
| Views and comments | D1 free (5M reads, 100k writes a day) | Workers Paid $5/month |
| Moderation | Workers AI free neurons on a few frames, owner queue | more neurons on Workers Paid |
| Transcoding user uploads | browser-side (WebCodecs / ffmpeg.wasm) before upload | Cloudflare Stream $5 per 1,000 minutes stored |
| Thumbnails | `#t=0.5` frame in the browser; a still at render time | none |
| Creator payouts | Gumroad (creator's own account) | Stripe Connect |
