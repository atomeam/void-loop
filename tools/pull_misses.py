"""Pull Void's unanswered asks and write domains/void.misses.md (run daily).
Needs env VOID_MISSES_TOKEN (same value as the worker's READ_TOKEN).
The file is git-ignored: these are real asks people typed, and the repo is public."""
import json, os, urllib.request, datetime, pathlib
tok = os.environ["VOID_MISSES_TOKEN"]
req = urllib.request.Request("https://a-to-mind.com/api/misses", headers={"authorization": "Bearer " + tok, "user-agent": "a2m-pull-misses/1.0"})  # Cloudflare blocks the default Python-urllib agent (error 1010)
rows = json.load(urllib.request.urlopen(req, timeout=30))
now = datetime.datetime.now().astimezone().isoformat(timespec="minutes")
lines = [f"# void.misses: asks Void could not answer yet", "",
         f"Updated {now}. Most-asked first. Each row is a skill Void could learn next.", "",
         "| asks | ask | last asked | fallback that ran |", "| ---: | --- | --- | --- |"]
for r in rows[:200]:
    ask = r["ask"].replace("|", "/")
    lines.append(f"| {r['count']} | {ask} | {r['last'][:10]} | {r.get('fallback','')} |")
out = pathlib.Path(__file__).resolve().parent.parent / "domains" / "void.misses.md"
out.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8")
print(f"wrote {out} ({len(rows)} asks)")
