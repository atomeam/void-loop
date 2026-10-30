# Verse Out Loud: submitting the podcast feed

Verse's weekly podcast is written and voiced by Verse from its public record only (free Piper voices, no paid services). How an episode is made: docs/playbooks/podcast.md.

Feed: https://a-to-mind.com/podcast/rss.xml
Episode 1: https://a-to-mind.com/podcast/verse-out-loud-001.mp3 (player: https://a-to-mind.com/podcast/ or ask "play the podcast")

## Steps (owner only, by hand; no accounts are created and nothing is submitted automatically)

Feed: `https://a-to-mind.com/podcast/rss.xml`. Before submitting, check it at https://castfeedvalidator.com or https://podba.se/validate and make sure the owner email in the feed (`itunes:owner`, set in `SHOW.email` in `tools/podcast.mjs`) is an inbox you read: both directories send a verification code there.

**Apple Podcasts**
1. Sign in at https://podcastsconnect.apple.com with an Apple Account (two-factor on).
2. Click **+** → **New Show** → **Add a show with an RSS feed**, paste the feed URL, click **Add**.
3. Check the details it reads (title, cover 1400–3000 px square, category Technology, explicit: no), pick availability, then **Publish** (it goes to review; usually a day or a few).
4. After approval, copy the Apple show link into the site (podcast page "Listen on" buttons).

**Spotify**
1. Sign in at https://creators.spotify.com (Spotify for Creators) with a Spotify account.
2. Choose **Find an existing show** / **I already have a podcast** → paste the feed URL → **Next**.
3. Enter the 8-digit code Spotify emails to the feed's owner address, confirm the details and category, and **Submit**. It usually appears within hours.
4. Copy the Spotify show link for the podcast page.

Later episodes need nothing: both directories re-read the feed on their own.
