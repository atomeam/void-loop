# Verse Out Loud: make an episode of Verse's podcast

**Starts when:** Monday's `verse-podcast.yml` run, or the owner runs it by hand ("force" for a second one in a week).

1. `node tools/podcast.mjs --script` prints the next episode's lines without writing anything. Every line comes from `void.growth.json` (the week), `claims-verified.json` (only proven asks are read aloud), Verse's newest daily readout in `domains/void.voice.md` (quoted, tags removed) and `incidents.json` (counts). Never add a line that is not from those files, and never a visitor's words.
2. `PIPER="python -m piper" node tools/podcast.mjs --make --voices <dir>` voices it with Piper (`en_US-lessac-medium` for Verse, `en_US-ryan-medium` for the Critic, from huggingface.co/rhasspy/piper-voices) and ffmpeg, then writes `void-live-deploy/podcast/verse-out-loud-NNN.mp3`, the `.txt` transcript, `episodes.json` and `rss.xml`.
3. `node tools/podcast.test.mjs` checks the files and that the feed is fresh. Commit `void-live-deploy/podcast/`; the deploy puts it live.

**How to tell it worked:** "play the podcast" on a-to-mind.com plays the new episode with its transcript, and https://a-to-mind.com/podcast/rss.xml lists it with an enclosure.

**Costs:** nothing. Piper runs on the Actions machine (about 3 minutes a week); no Workers AI neurons, no API key. An episode is about 1 MB at 48 kbps mono (Pages' file limit is 25 MB).

**Mistakes already made:** a new-skill rank after `video-play` let "play the podcast" open the video player; the skill sits at rank 1150.
