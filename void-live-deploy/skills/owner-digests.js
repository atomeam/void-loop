/**
 * owner-digests — the 16 prompts from the owner's Grok account, invocable in Verse by name.
 * "morning brief", "workout coach", "ai news digest", "meal planner", etc. Each runs the full
 * original prompt through /api/answer so the same content lands as a card. Empty surface stays empty.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite() }
 */
const DIGESTS = [
  { id: 'morning-brief', names: ['morning brief', 'my morning brief'], when: 'daily 07:30 ET',
    prompt: 'Put together my morning brief: the top world, business, and tech headlines from the last 24 hours with one-line summaries, any major overnight market moves, and today’s weather for my location. End with one story worth reading in depth and why. Keep the whole thing scannable.' },
  { id: 'workout-coach', names: ['workout coach', 'today\'s workout', 'my workout'], when: 'daily 06:30 ET',
    prompt: 'Give me today’s workout, rotating between push, pull, legs, and recovery days through the week. List exercises with sets and reps, a ten-minute warm-up, and one mobility exercise. Keep the session around 45 minutes and note which day of the rotation this is.' },
  { id: 'daily-planner', names: ['daily planner', 'plan my day', 'today\'s plan'], when: 'daily 08:30 ET',
    prompt: 'Based on my recent conversations and anything I’ve told you I’m working on, draft a realistic plan for today: two or three deep-work blocks with concrete goals, a short list of quick wins, and one thing I should explicitly not spend time on today.' },
  { id: 'void-news-scout', names: ['void news scout', 'news scout'], when: 'daily 08:00 ET',
    prompt: 'You are the news scout for Void. You are not a builder and not a salesperson. Read STANDING.md, then domains/void.plan.md, in the private repo atomeam/void-loop. Do not call /api/memory/context or /api/ingest. Those routes are retired. One cheap pass, then stop. Open only these four primary pages, in order: 1. https://developers.cloudflare.com/changelog/ 2. https://developer.chrome.com/blog 3. https://github.com/webmachinelearning/webmcp/commits/main 4. https://blog.modelcontextprotocol.io/ A hit is a primary-source change (official doc, changelog, or lab post) dated after the Written line in void.plan.md, that changes how to build an open Now or Next item, and is not already stated in that plan. Ignore founders\' letters, vision posts, enterprise access products, and anything the plan already names. If there is no hit: output nothing. If there is a hit: at most 3 bullets. Each bullet is what changed, the source link, and the plan item number. Then stop. Void\'s front page stays empty. Do not claim the build queue. Do not deploy. Do not edit the repo.' },
  { id: 'ai-news-digest', names: ['ai news digest', 'ai news', 'ai digest'], when: 'daily 08:00 ET',
    prompt: 'Summarize the most important AI news from the last 24 hours: model releases, notable research papers, funding rounds, and policy changes. For each item add one sentence on why it matters. Skip minor product updates and rumors.' },
  { id: 'x-trends-digest', names: ['x trends digest', 'x trends', 'twitter trends'], when: 'daily 12:00 ET',
    prompt: 'Look at what’s trending on X right now and give me the five most interesting conversations: what happened, why it’s taking off, and the sharpest take you can find on each side of the debate.' },
  { id: 'portfolio-news-scan', names: ['portfolio news scan', 'portfolio news', 'holdings news'], when: 'daily 16:30 ET',
    prompt: 'Scan for news affecting my holdings and summarize only material items: earnings, guidance changes, analyst rating moves, lawsuits, and major product or leadership news. Note the likely impact of each. Start by asking for my tickers if I haven’t shared them yet.' },
  { id: 'task-extractor', names: ['task extractor', 'extract tasks', 'action items'], when: 'daily 17:00 ET',
    prompt: 'Review my recent messages and notes, extract action items, and summarize next steps with owners and suggested priorities.' },
  { id: 'all-languages', names: ['language practice', 'all-languages practice', 'language drill'], when: 'daily 19:00 ET',
    prompt: 'Run a short language-practice session for the user. Goal: over time, cover as many living world languages as practical. Use today\'s date (YYYY-MM-DD) to pick an index from a rotating pool of living languages (day-of-year modulo list length). Default level A2–B1. Session: (A) five new useful words/phrases with romanization if needed, English gloss, and one example sentence each; (B) one grammar point plus a 4-item exercise with answer key; (C) a short English paragraph (4–6 sentences) for the user to translate into today\'s language — do not provide the translation until they reply. End with tomorrow\'s language preview.' },
  { id: 'earnings-calendar', names: ['earnings calendar', 'earnings this week'], when: 'weekly Mon 08:00 ET',
    prompt: 'List the notable companies reporting earnings this week with dates and times, consensus expectations, and one thing to watch in each report. Flag the reports most likely to move the broader market.' },
  { id: 'competitor-watch', names: ['competitor watch', 'competitors news'], when: 'weekly Mon 09:00 ET',
    prompt: 'Track news about my key competitors from the past week: product launches, pricing changes, notable hires, funding, and press coverage. Note anything that should change how I position my own product. Start by asking me to list the companies if I haven’t already told you.' },
  { id: 'paper-watch', names: ['paper watch', 'research papers', 'new papers'], when: 'weekly Wed 09:00 ET',
    prompt: 'Find the most interesting new research papers from this week in my field. For the top three, explain the core idea in plain language, why it matters, and one limitation to keep in mind. Ask me which field to track if I haven’t told you.' },
  { id: 'weekly-review', names: ['weekly review', 'week review'], when: 'weekly Fri 16:00 ET',
    prompt: 'Help me run a weekly review: summarize what I worked on this week based on my recent conversations, list open loose ends and unanswered questions, and propose my top three priorities for next week with a one-line rationale for each.' },
  { id: 'weekend-deep-dive', names: ['weekend deep dive', 'deep dive'], when: 'weekly Sat 10:00 ET',
    prompt: 'Pick the most important development from this week in a topic I’m following and go deep: background, what changed, competing viewpoints, and what to watch next. Write it like a briefing memo. Ask me which topic to follow if I haven’t picked one.' },
  { id: 'meal-planner', names: ['meal planner', 'plan dinners', 'dinner plan'], when: 'weekly Sun 17:00 ET',
    prompt: 'Plan my dinners for the coming week: seven healthy recipes across a variety of cuisines, each under 45 minutes to cook, with rough calories per serving. Include a single consolidated grocery list organized by store section.' },
  { id: 'void-growth', names: ['void growth', 'grow void'], when: 'hourly Mon–Fri 08–20 ET + deploy success',
    prompt: 'You grow Void (atomeam/void-loop, live at a-to-mind.com). Work every open inbox row you can finish. Do not retest publish, rename, or unpublish. Do not open a pull request. Ship path: push helper/<slug>. Inbox: domains/growth-inbox.md. Mark a row building in the same commit as its skill. Never delete an open or building row. When ship helper succeeds, mark that row shipped with the main SHA. Check domains/void.existing-tools.md and use what exists. Add void-live-deploy/skills/<name>.js, register it in skills/index.json, add examples, add one suite check. Empty surface stays empty. If a row cannot finish, leave it open or building. Reply with each ask and its helper branch. no open items is not an option; come up with new ideas.' },
];

function digestsOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:show|list|open)\s+)?(?:my\s+)?(?:owner\s+)?digests?$|^what\s+digests\s+(?:do\s+i\s+have|are\s+there)$/.test(t)) return { list: true };
  for (const d of DIGESTS) {
    for (const n of d.names) {
      if (t === n || t === 'run ' + n || t === 'my ' + n) return { digest: d };
    }
  }
  return null;
}

async function run(text, api) {
  const q = digestsOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  if (q.list) {
    showPage((p) => {
      p.innerHTML = '<h2>Owner digests</h2><div class="sub">the 16 prompts from the Grok account, runnable by name</div><ul>'
        + DIGESTS.map((d) => '<li><b>' + esc(d.names[0]) + '</b> · ' + esc(d.when) + '</li>').join('')
        + '</ul><div class="src">Say any name to run it · schedules stay on Grok until Verse automations grow a full prompt runner</div>';
    });
    api.say('16 digests · say a name to run one');
    return 'owner-digests';
  }
  const d = q.digest;
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(d.names[0]) + '</h2><div class="sub">' + esc(d.when) + ' · running…</div>'; });
  try {
    const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: d.prompt }) });
    const j = await r.json().catch(() => ({}));
    if (!api._pageStill(el)) return 'owner-digests';
    const body = (j && (j.answer || j.text || j.said)) || (j && j.error) || 'no answer just now';
    el.innerHTML = '<h2>' + esc(d.names[0]) + '</h2><div class="sub">' + esc(d.when) + '</div>'
      + '<div style="white-space:pre-wrap;margin-top:8px">' + esc(String(body)) + '</div>'
      + '<div class="src">Full Grok-account prompt · via /api/answer</div>';
    api.say(String(body).split('\n')[0].slice(0, 160));
  } catch (_) {
    if (api._pageStill(el)) el.innerHTML = '<h2>' + esc(d.names[0]) + '</h2><p>Could not reach the answer path just now. Ask again in a moment.</p>';
  }
  return 'owner-digests';
}

export default {
  name: 'owner-digests',
  examples: ['morning brief', 'workout coach', 'ai news digest', 'meal planner', 'owner digests', 'weekly review'],
  nearMisses: ['what is a digest', 'digest this article', 'morning coffee', 'evening workout plan'],
  match(lower, text) { return !!digestsOf(text); },
  run,
  suite() {
    const a = digestsOf('morning brief');
    const b = digestsOf('owner digests');
    const c = digestsOf('what is a digest');
    return { ok: !!(a && a.digest && a.digest.id === 'morning-brief' && b && b.list && c === null) };
  },
};
