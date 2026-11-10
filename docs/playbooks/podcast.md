# Verse Out Loud: make an episode of Verse's podcast

**Starts when:** the daily `verse-podcast.yml` run, or a person runs it by hand ("force" for a second one the same day).

The spoken episode is written by `tools/show-pipe.mjs` from `docs/playbooks/shows.md`. It is a story about one real feat. It is not a readout of the git log, the queue, or the reflection asks.

1. `node tools/podcast.mjs --script` prints the next episode's lines without writing anything. A failing script is not printed as a fallback.
2. `PIPER="python -m piper" node tools/podcast.mjs --make --voices <dir>` voices it with Piper (`en_US-lessac-medium` for Verse, `en_US-ryan-medium` for the Critic) and the filters in `VOICE_AF`, then writes `void-live-deploy/podcast/verse-out-loud-<NNN>.mp3`, the transcript, `episodes.json`, `rss.xml`, and the judge's scores.
3. `node tools/podcast.test.mjs` checks the files and that the feed is fresh. Commit `void-live-deploy/podcast/`; the deploy puts it live.

**How to tell it worked:** "play the podcast" on a-to-mind.com plays the new episode with its transcript, and https://a-to-mind.com/podcast/rss.xml lists it with an enclosure.

**Costs:** nothing. Piper runs on the Actions machine (about 3 minutes a week); no Workers AI neurons, no API key. An episode is about 1 MB at 48 kbps mono (Pages' file limit is 25 MB).

**Mistakes already made:** a new-skill rank after `video-play` let "play the podcast" open the video player; the skill sits at rank 1150.

**What an episode covers:** one true feat, told by Verse and the Critic. A Loop Grid-style bed plays under the opening and the close; `PODCAST_NO_BED=1` leaves it out.

## Submitting the feed (owner only, by hand; nothing here is automated)

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
