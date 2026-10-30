"""Verse watches TV and listens to the radio on its own, to learn (owner, 2026-10-30: "make it so verse can watch tv or listen to the radio on
its own to learn if it wants to").

  python tools/watch.py              (.github/workflows/verse-watch.yml runs this every hour)
  python tools/watch.py --options    prints the stations Verse could pick from, and stops (no token, no network for TV)

Each run: Verse is shown up to 12 free stations (TV from the site's own lists in void-live-deploy/local/tv/, radio from Radio Browser's most
voted talk and news stations), with how often it watched each lately, and chooses one or none (/api/watchalong mode choose, the owner key).
For TV this runner reads about 75 seconds of the live stream with ffmpeg, takes the closed captions (CEA-608) and one still of the screen,
and sends them to /api/watchalong mode learn; for radio the site hears a few seconds itself (Whisper on its own binding). Verse keeps only the
short notes it writes. The stream, the captions and the picture live in a temporary folder that is deleted when the run ends.
Needs env VOID_OWNER_TOKEN.
"""
import base64, json, os, pathlib, random, re, shutil, subprocess, sys, tempfile, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://a-to-mind.com"
TOK = os.environ.get("VOID_OWNER_TOKEN", "")
UA = "VerseBot/1.0 (+https://a-to-mind.com/local/)"
H = {"authorization": "Bearer " + TOK, "content-type": "application/json", "user-agent": "a2m-verse-watch/1.0"}
SECONDS = 75
IP = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


def playable(url):
    """the same rule as void-live-deploy/lib/local-media.js playableStream: https, the standard port, a host name, no signed token."""
    try:
        u = urllib.parse.urlsplit(str(url or ""))
    except ValueError:
        return False
    host = (u.hostname or "").lower()
    if u.scheme != "https" or (u.port and u.port != 443) or u.username or not host or "." not in host or IP.match(host):
        return False
    if re.search(r"eyJ[\w-]{8,}\.[\w-]{8,}\.", url) or re.search(r"(^|\.)(localhost|local|internal|lan|home)$", host):
        return False
    return True


def tv_options(rng, n=8):
    """TV stations with a free stream a browser can play, from the site's own lists (local first, then the world lists when present)."""
    out = []
    for f in sorted((ROOT / "void-live-deploy" / "local" / "tv").glob("**/*.json")):
        if f.name == "index.json":
            continue
        try:
            file = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        cc = str(file.get("cc") or f.stem).upper()[:2]
        for s in file.get("stations") or []:
            urls = [u for u in (s.get("s") or []) if playable(u)]
            if urls and s.get("id"):
                out.append({"kind": "tv", "cc": cc, "id": s["id"], "name": s.get("t") or s["id"], "network": s.get("n") or "", "streams": urls})
    rng.shuffle(out)
    return out[:n]


def radio_options(rng, n=4):
    """Radio Browser's most voted talk and news stations with an https MP3 stream (the kind Verse's server can hear)."""
    out = []
    for tag in ("news", "talk"):
        q = "/json/stations/search?" + urllib.parse.urlencode({"tag": tag, "codec": "MP3", "hidebroken": "true", "order": "votes", "reverse": "true", "limit": 40})
        for host in ("de1.api.radio-browser.info", "all.api.radio-browser.info"):
            try:
                rows = json.load(urllib.request.urlopen(urllib.request.Request("https://" + host + q, headers={"user-agent": UA}), timeout=20))
                break
            except Exception:
                rows = []
        for r in rows:
            if playable(r.get("url_resolved")) and r.get("stationuuid"):
                out.append({"kind": "radio", "cc": str(r.get("countrycode") or "")[:2], "id": r["stationuuid"], "name": (r.get("name") or "").strip()[:90], "network": ""})
    uniq = list({o["id"]: o for o in out}.values())
    rng.shuffle(uniq)
    return uniq[:n]


def call(body=None, path="/api/watchalong"):
    req = urllib.request.Request(SITE + path, data=json.dumps(body).encode() if body is not None else None, headers=H, method="POST" if body is not None else "GET")
    return json.load(urllib.request.urlopen(req, timeout=120))


def watched_counts():
    try:
        notes = call(None, "/api/watchalong?limit=200").get("notes", [])
    except Exception:
        return {}
    counts = {}
    for n in notes:
        counts[n.get("station")] = counts.get(n.get("station"), 0) + 1
    return counts


def srt_text(srt):
    """the words of an SRT file: no cue numbers, no times, no tags, each line once."""
    out, last = [], ""
    for line in srt.splitlines():
        line = re.sub(r"<[^>]+>|\{[^}]+\}", "", line).strip()
        if not line or line.isdigit() or "-->" in line or line == last:
            continue
        out.append(line)
        last = line
    return "\n".join(out)


def watch_tv(st, work):
    """about SECONDS of the stream into a temporary file, then its captions and one still: (captions, frame data URL)."""
    ts = work / "s.ts"
    for url in st["streams"]:
        r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-user_agent", UA, "-rw_timeout", "15000000", "-i", url, "-t", str(SECONDS), "-map", "0:v:0?", "-map", "0:a:0?", "-c", "copy", str(ts)], capture_output=True, text=True, timeout=SECONDS + 90)
        if ts.exists() and ts.stat().st_size > 200000:
            break
        print("  stream did not play:", (r.stderr or "").strip()[:160])
    if not ts.exists() or ts.stat().st_size < 200000:
        return None, None
    cc = work / "cc.srt"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "movie=" + str(ts) + "[out0+subcc]", "-map", "0:1", str(cc)], capture_output=True, text=True, timeout=120)
    captions = srt_text(cc.read_text(encoding="utf-8", errors="replace")) if cc.exists() else ""
    jpg = work / "f.jpg"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(SECONDS // 2), "-i", str(ts), "-frames:v", "1", "-vf", "scale=512:-2", "-q:v", "5", str(jpg)], capture_output=True, text=True, timeout=60)
    frame = "data:image/jpeg;base64," + base64.b64encode(jpg.read_bytes()).decode() if jpg.exists() and jpg.stat().st_size < 290000 else ""
    return captions, frame


def main():
    rng = random.Random()
    options = tv_options(rng) + radio_options(rng)
    if "--options" in sys.argv:
        print(json.dumps([{k: v for k, v in o.items() if k != "streams"} for o in options], indent=1))
        return
    if not TOK:
        print("no VOID_OWNER_TOKEN: Verse cannot choose or keep notes from here")
        return
    counts = watched_counts()
    for o in options:
        o["watched"] = counts.get(o["name"], 0)
    pick = call({"mode": "choose", "options": [{k: v for k, v in o.items() if k != "streams"} for o in options]})
    if pick.get("index", -1) < 0:
        print("Verse chose not to watch anything this hour:", pick.get("why"))
        return
    tried = [options[pick["index"]]] + [o for i, o in enumerate(options) if i != pick["index"]][:2]
    print("Verse chose", tried[0]["name"], "(" + tried[0]["kind"] + "):", pick.get("why"), "" if pick.get("chosen") else "[fallback pick]")
    for st in tried:
        body = {"mode": "learn", "source": "auto", "station": {k: st[k] for k in ("kind", "cc", "id", "name", "network")}}
        if st["kind"] == "tv":
            work = pathlib.Path(tempfile.mkdtemp(prefix="verse-watch-"))
            try:
                captions, frame = watch_tv(st, work)
            finally:
                shutil.rmtree(work, ignore_errors=True)  # nothing of the stream is kept
            if captions is None:
                print("-", st["name"], "did not play; trying the next station")
                continue
            body.update({"captions": captions[-4000:]} if captions else {"frame": frame})
            print("-", st["name"] + ":", len(captions), "characters of captions" if captions else "no captions, sent one still")
        else:
            body["listen"] = True
        try:
            out = call(body)
        except Exception as e:
            print("- learn failed:", e)
            continue
        print("- show:", out.get("show") or "(not named)", "| notes kept:", out.get("kept", 0), "|", out.get("say") or out.get("couldNot") or "")
        for n in out.get("notes", []):
            print("  -", n.get("kind") + ":", n.get("note"))
        return


if __name__ == "__main__":
    main()
