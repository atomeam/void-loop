"""The Forethinkers: research on everything, every cycle, anchored on shared parts and Void stages.

Read domains/forethinkers/brief.md first. The map is domains/forethinkers/convergence.md; kept findings, placements and
the runs that changed something are in domains/forethinkers/findings.json.

Tracks are not a fixed list. They are read from the repo every time: the Forethinkers' own track files
(domains/forethinkers/tracks/*.md), every venture domain file (domains/*.md with a **Title:** line), every numbered row of
domains/void.assimilate.md, and every open miss on domains/void.misses.md. A domain's "Shared parts: ... uses:" line is a
declared link: `sync` puts it on the map, and `check` fails while it is missing.

A cycle works every unit (each part, each blocked stage) through every track it touches, with one convergence pass per
unit that keeps only what changed the map or unblocked a stage. Tracks that touch no part yet are worked too, until they
link to a part, fit an existing track, or get their own track file.

  python tools/forethinkers.py check       the map, labels, findings and declared links hold (CI; exit 1 on any break)
  python tools/forethinkers.py sync        puts every declared domain link on the map
  python tools/forethinkers.py tracks      lists every track and where it came from
  python tools/forethinkers.py plan        prints what the next cycle works and how many model calls it makes
  python tools/forethinkers.py gate [--at ISO]   prints run / skip: even ET hours run, odd hours skip
  python tools/forethinkers.py cycle       runs one cycle (needs ANTHROPIC_API_KEY and `pip install anthropic`)
  python tools/forethinkers.py selftest    gate across DST, labels, dead runs, convergence and orphan filters (no network)

Env (all optional): ACTIVE_TRACKS ("all", the default, or a comma list), UNIT (work one row only), MAX_SEARCHES (per
worker, default 3), FORETHINKERS_MODEL or MODEL (default claude-opus-5-5), FORETHINKERS_EFFORT (default medium),
FORETHINKERS_PARALLEL (calls at once, default 6).
"""
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
DOMAINS = ROOT / 'domains'
DIR = DOMAINS / 'forethinkers'
TRACK_DIR = DIR / 'tracks'
MAP = DIR / 'convergence.md'
LEDGER = DIR / 'findings.json'
GROWTH = DOMAINS / 'void.growth.md'
ASSIMILATE = DOMAINS / 'void.assimilate.md'
MISSES = DOMAINS / 'void.misses.md'
STAGES = ['summon', 'spin', 'export', 'print', 'own']
ET = ZoneInfo('America/New_York')
NODE_COLS = ['id', 'kind', 'name', 'tracks', 'stages', 'status', 'source', 'dated', 'checked']
EDGE_COLS = ['from', 'to', 'via', 'status', 'source', 'dated']
DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
URL = re.compile(r'^https?://\S+$')
ID = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
# board rows that are probes and tests, not asks
NOISE = re.compile(r'test|probe|ping|^(dismiss|close)$|^zz')
# the same shared part, named two ways in the domain files
PART_ALIASES = {'licensed-partner bench': 'partner bench', 'one intake': 'shared intake'}


def read(p):
    return Path(p).read_text(encoding='utf-8-sig')


def rel(p):
    return os.path.relpath(p, ROOT)


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:48].strip('-')


def split_list(s):
    return [x.strip() for x in s.split(',') if x.strip()]


def top_split(s):
    out, depth, cur = [], 0, ''
    for ch in s:
        depth += (ch == '(') - (ch == ')')
        if ch == ',' and depth == 0:
            out.append(cur)
            cur = ''
        else:
            cur += ch
    return [x.strip() for x in out + [cur] if x.strip()]


# ---------- tracks: read from the repo, never a fixed list ----------

def domain_uses(text):
    m = re.search(r'^\*\*Shared parts:\*\*.*?uses:\s*(.*)$', text, re.M)
    if not m:
        return []
    body = re.split(r'\.\s+(?=[A-Z*])', m.group(1))[0]
    out = []
    for x in top_split(body):
        name = re.sub(r'\(.*', '', x).strip(' .*').lower()
        name = PART_ALIASES.get(name, name)
        if name and slug(name) not in out:
            out.append(slug(name))
    return out


def domain_lens(text, title):
    for pat in (r'^## One-liner\s*\n+(.+)$', r'^\*\*What it is:\*\*\s*(.+)$', r'^\*\*The thought:\*\*\s*(.+)$',
                r'^\*\*What we are:\*\*\s*(.+)$', r'^## Thesis\s*\n+(.+)$'):
        m = re.search(pat, text, re.M)
        if m:
            return m.group(1).strip()[:400]
    return title


def table_rows(text, first=r'\d+'):
    rows = []
    for line in text.split('\n'):
        if re.match(r'^\|\s*' + first + r'\s*\|', line):
            rows.append([c.strip() for c in line.strip().strip('|').split('|')])
    return rows


def open_misses():
    """Asks on the board that nothing answers yet: not grown, not in the benchmark, not a skill's fallback, not a probe."""
    if not MISSES.exists():
        return []
    def asks(p):
        try:
            data = json.loads(read(p))
        except (OSError, ValueError):
            return set()
        data = data if isinstance(data, list) else data.get('asks', [])
        return {(x.get('ask') or '').strip().lower() for x in data if isinstance(x, dict)}
    answered = asks(ROOT / 'tools' / 'grown.json') | asks(ROOT / 'tools' / 'bench.json')
    out = []
    for c in table_rows(read(MISSES)):
        if len(c) < 4:
            continue
        ask, fallback = c[1].strip().lower(), c[3]
        if ask in answered or fallback.startswith('skill:') or NOISE.search(ask) or ask in out:
            continue
        out.append(ask)
    return out


def load_tracks():
    """Every track: Forethinkers track files, venture domain files, assimilate rows, open misses."""
    tracks = {}
    for p in sorted(TRACK_DIR.glob('*.md')):
        t = read(p)
        name = re.search(r'^# (.+)$', t, re.M)
        lens = re.search(r'^Lens:\s*(.+)$', t, re.M)
        frm = re.search(r'^From:\s*(.+)$', t, re.M)
        tracks[p.stem] = {'id': p.stem, 'kind': 'track', 'name': name.group(1).strip() if name else p.stem,
                          'lens': lens.group(1).strip() if lens else '', 'from': frm.group(1).strip() if frm else '',
                          'file': rel(p)}
    for p in sorted(DOMAINS.glob('*.md')):
        t = read(p)
        m = re.search(r'^\*\*Title:\*\*\s*(.+?)\s*$', t, re.M)
        if not m:
            continue
        if p.stem in tracks:
            tracks[p.stem]['clash'] = rel(p)
            continue
        tracks[p.stem] = {'id': p.stem, 'kind': 'domain', 'name': m.group(1), 'lens': domain_lens(t, m.group(1)),
                          'uses': domain_uses(t), 'file': rel(p)}
    if ASSIMILATE.exists():
        for c in table_rows(read(ASSIMILATE)):
            if len(c) < 5:
                continue
            tid = f'assimilate-{c[0]}'
            tracks[tid] = {'id': tid, 'kind': 'assimilate', 'name': re.sub(r'\s*\(.*', '', c[1]).strip() or tid,
                           'lens': f'{c[2]}. Void form: {c[3]} (status: {c[4]})', 'file': rel(ASSIMILATE)}
    for ask in open_misses():
        tid = 'miss-' + slug(ask)
        tracks.setdefault(tid, {'id': tid, 'kind': 'miss', 'name': ask, 'lens': f'an ask Void could not answer yet: "{ask}"',
                                'file': rel(MISSES)})
    return tracks


def mappable(tracks):
    """Tracks a map row may name. Misses come and go with the board, so a miss is placed, never written into a row."""
    return {t for t, v in tracks.items() if v['kind'] != 'miss'}


# ---------- the map ----------

def read_table(lines, heading):
    i = lines.index(heading) + 1
    while not lines[i].startswith('|'):
        i += 1
    head = [c.strip() for c in lines[i].strip().strip('|').split('|')]
    rows, j = [], i + 2
    while j < len(lines) and lines[j].startswith('|'):
        rows.append(dict(zip(head, [c.strip() for c in lines[j].strip().strip('|').split('|')])))
        j += 1
    return head, rows, i, j


def load_map(text=None):
    text = read(MAP) if text is None else text
    lines = text.split('\n')
    nhead, nodes, _, _ = read_table(lines, '## Nodes')
    ehead, edges, _, _ = read_table(lines, '## Edges')
    for n in nodes:
        n['tracks'], n['stages'] = split_list(n.get('tracks', '')), split_list(n.get('stages', ''))
    return {'text': text, 'nhead': nhead, 'ehead': ehead, 'nodes': nodes, 'edges': edges}


def render_map(m):
    lines = m['text'].split('\n')
    for heading, cols, rows in (('## Nodes', NODE_COLS, m['nodes']), ('## Edges', EDGE_COLS, m['edges'])):
        _, _, i, j = read_table(lines, heading)
        lines[i + 2:j] = ['| ' + ' | '.join(', '.join(r[c]) if isinstance(r.get(c), list) else str(r.get(c, ''))
                                            for c in cols) + ' |' for r in rows]
    return '\n'.join(lines)


def load_ledger():
    led = json.loads(read(LEDGER))
    led.setdefault('findings', [])
    led.setdefault('runs', [])
    led.setdefault('placed', {})
    return led


def edge_id(e):
    return e['from'] + '>' + e['to']


def sync(m, tracks):
    """Put every declared domain link (its Shared parts uses: line) on the map. Returns what it added."""
    nodes = {n['id']: n for n in m['nodes']}
    added = []
    for t in tracks.values():
        for part in t.get('uses', []):
            n = nodes.get(part)
            if not n:
                n = {'id': part, 'kind': 'part', 'name': part.replace('-', ' ').capitalize() + ' (shared part, A2M.ops.md)',
                     'tracks': [], 'stages': [], 'status': 'hypothesis', 'source': '', 'dated': '', 'checked': ''}
                m['nodes'].append(n)
                nodes[part] = n
                added.append(part)
            if t['id'] not in n['tracks']:
                n['tracks'].append(t['id'])
                added.append(f"{part} < {t['id']}")
    return added


# ---------- labels ----------

def label_errors(where, status, source, dated, today):
    errs = []
    if status == 'established':
        if not URL.match(source or ''):
            errs.append(f'{where}: established without a source URL')
        if not DATE.match(dated or ''):
            errs.append(f'{where}: established without a date (YYYY-MM-DD)')
        elif dated > today:
            errs.append(f'{where}: dated in the future ({dated})')
    elif status == 'hypothesis':
        if source or dated:
            errs.append(f'{where}: hypothesis carries a source; a checked row is established, or it is removed')
    else:
        errs.append(f'{where}: status must be established or hypothesis, not "{status}"')
    return errs


def check(m=None, ledger=None, tracks=None, today=None):
    m = m or load_map()
    ledger = ledger if ledger is not None else load_ledger()
    tracks = tracks if tracks is not None else load_tracks()
    today = today or date.today().isoformat()
    ok_tracks = mappable(tracks)
    errs = [f'track {t}: a track file and a domain file share this id ({v["clash"]})' for t, v in tracks.items() if v.get('clash')]
    errs += [f'track file {v["file"]}: needs a "Lens:" line' for v in tracks.values() if v['kind'] == 'track' and not v['lens']]
    if m['nhead'] != NODE_COLS:
        errs.append(f'Nodes columns must be {NODE_COLS}')
    if m['ehead'] != EDGE_COLS:
        errs.append(f'Edges columns must be {EDGE_COLS}')
    ids = set()
    for n in m['nodes']:
        nid = n.get('id', '')
        where = f'node {nid}'
        if not ID.match(nid):
            errs.append(f'{where}: id must be lower-case words joined by -')
        if nid in ids:
            errs.append(f'{where}: repeated id')
        ids.add(nid)
        if not n.get('name'):
            errs.append(f'{where}: no name')
        bad = [t for t in n['tracks'] if t not in ok_tracks]
        if bad or not n['tracks']:
            errs.append(f'{where}: tracks must be tracks in the repo (track files, domain files, assimilate rows); got {bad or "none"}')
        if any(s not in STAGES for s in n['stages']):
            errs.append(f'{where}: stages must be from {STAGES}')
        if n.get('kind') == 'stage':
            if nid not in STAGES:
                errs.append(f'{where}: a stage id must be one of {STAGES}')
            if n.get('status') not in ('live', 'blocked'):
                errs.append(f'{where}: a stage is live or blocked')
        elif n.get('kind') == 'part':
            errs += label_errors(where, n.get('status'), n.get('source'), n.get('dated'), today)
        else:
            errs.append(f'{where}: kind must be part or stage')
        if n.get('checked') and not DATE.match(n['checked']):
            errs.append(f'{where}: checked must be YYYY-MM-DD')
    nodes = {n['id']: n for n in m['nodes']}
    for t in tracks.values():
        for part in t.get('uses', []):
            if part not in nodes or t['id'] not in nodes[part]['tracks']:
                errs.append(f'{t["file"]} uses {part}, and the map does not show it (run: python tools/forethinkers.py sync)')
    seen = set()
    for e in m['edges']:
        where = f'edge {edge_id(e)}'
        for end in ('from', 'to'):
            if e.get(end) not in ids:
                errs.append(f'{where}: {end} "{e.get(end)}" is not a node')
        if e.get('via') not in ok_tracks:
            errs.append(f'{where}: via must be a track in the repo')
        if edge_id(e) in seen:
            errs.append(f'{where}: repeated edge')
        seen.add(edge_id(e))
        errs += label_errors(where, e.get('status'), e.get('source'), e.get('dated'), today)
    for k, f in enumerate(ledger['findings']):
        errs += finding_errors(f, ids, tracks, f'finding {k + 1}', today)
    for k, r in enumerate(ledger['runs']):
        if r.get('result') not in ('changed', 'dead'):
            errs.append(f'run {k + 1}: result must be changed or dead')
    for orphan, home in ledger['placed'].items():
        if not ID.match(orphan) or (home not in ok_tracks and home not in ids):
            errs.append(f'placed {orphan}: must point at a track in the repo or a row on the map (got "{home}")')
    return errs


def finding_errors(f, ids, tracks, where, today):
    errs = []
    if not ID.match(f.get('track') or ''):
        errs.append(f'{where}: no track')
    if not f.get('claim'):
        errs.append(f'{where}: no claim')
    effect = f.get('effect')
    if effect not in ('map', 'unblocks', 'placed'):
        errs.append(f'{where}: effect must be map, unblocks or placed')
    if effect != 'placed' and f.get('part') not in ids:
        errs.append(f'{where}: names no part on the map')
    if effect == 'unblocks' and f.get('stage') not in STAGES:
        errs.append(f'{where}: unblocks names no stage')
    if effect != 'placed' and f.get('unit') not in ids:
        errs.append(f'{where}: unit "{f.get("unit")}" is not on the map')
    others = [h for h in f.get('helps') or [] if h != f.get('track') and (h in STAGES or h in tracks or h in ids)]
    if not others:
        errs.append(f'{where}: dead run: helps no other track and no product stage')
    errs += label_errors(where, f.get('type'), f.get('source'), f.get('dated'), today)
    return errs


# ---------- schedule gate ----------

def gate(at=None):
    at = at or datetime.now(timezone.utc)
    return 'run' if at.astimezone(ET).hour % 2 == 0 else 'skip'


# ---------- what a cycle works ----------

def active_tracks(tracks):
    raw = os.environ.get('ACTIVE_TRACKS', 'all').strip()
    if raw in ('', 'all'):
        return None
    act = split_list(raw)
    bad = [t for t in act if t not in tracks]
    if bad:
        sys.exit(f'ACTIVE_TRACKS has tracks that are not in the repo: {bad} (python tools/forethinkers.py tracks lists them)')
    return set(act)


def plan(m, tracks, ledger, active=None, force=None):
    """Every part and every blocked stage, each through every track it touches; then every track that touches nothing."""
    pool = [n for n in m['nodes'] if not (n['kind'] == 'stage' and n['status'] == 'live')]
    if force:
        pool = [n for n in m['nodes'] if n['id'] == force]
        if not pool:
            sys.exit(f'UNIT "{force}" is not on the map')
    units = []
    for n in pool:
        ts = [t for t in n['tracks'] if active is None or t in active]
        if ts:
            units.append({'unit': n, 'tracks': ts})
    touched = {t for n in m['nodes'] for t in n['tracks']}
    orphans = [] if force else [t for t in tracks if t not in touched and t not in ledger['placed']
                                and (active is None or t in active)]
    calls = sum(len(u['tracks']) + 1 for u in units) + len(orphans)
    return {'units': units, 'orphans': orphans, 'calls': calls}


# ---------- the model ----------

FENCE = re.compile(r'```json\s*(.*?)```', re.S)


def parse_json(text):
    hits = FENCE.findall(text or '')
    raw = hits[-1] if hits else (text or '')[(text or '').find('{'):(text or '').rfind('}') + 1]
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None


def call(client, prompt, searches):
    """One model call. Returns (text, urls the web search actually returned)."""
    import anthropic
    model = os.environ.get('FORETHINKERS_MODEL') or os.environ.get('MODEL') or 'claude-opus-5-5'
    kw = dict(model=model, max_tokens=16000, betas=['server-side-fallback-2026-07-01'],
              extra_body={'fallbacks': 'default', 'output_config': {'effort': os.environ.get('FORETHINKERS_EFFORT', 'medium')}})
    if searches:
        kw['tools'] = [{'type': 'web_search_20260209', 'name': 'web_search', 'max_uses': searches}]
    messages = [{'role': 'user', 'content': prompt}]
    urls = set()
    r = None
    for _ in range(4):
        try:
            r = client.beta.messages.create(messages=messages, **kw)
        except anthropic.APIStatusError as e:
            print(f'  model call failed ({e.status_code}): {e.message}')
            return '', urls
        except anthropic.APIConnectionError:
            print('  model call failed: network error')
            return '', urls
        for b in r.content:
            if b.type == 'web_search_tool_result' and isinstance(b.content, list):
                urls.update(x.url for x in b.content if getattr(x, 'url', None))
        if r.stop_reason == 'refusal':
            return '', urls
        if r.stop_reason != 'pause_turn':
            break
        messages = [messages[0], {'role': 'assistant', 'content': r.content}]
    return ''.join(b.text for b in r.content if b.type == 'text'), urls


def map_brief(m):
    rows = [f"- {n['id']} ({n['kind']}, {n['status']}): {n['name']} | tracks {', '.join(n['tracks'])}"
            + (f" | stages {', '.join(n['stages'])}" if n['stages'] else '') for n in m['nodes']]
    rows += [f"- edge {edge_id(e)} via {e['via']} ({e['status']})" for e in m['edges']]
    return '\n'.join(rows)


def track_brief(t):
    text = f"{t['id']} ({t['kind']}): {t['name']}\nLens: {t['lens']}\nFile: {t['file']}"
    if t['kind'] == 'domain':
        text += '\n\nFrom the file:\n' + read(ROOT / t['file'])[:5000]
    return text


def brief():
    return read(DIR / 'brief.md')


def worker_prompt(m, unit, t, searches):
    return f"""{brief()}

## The map now
{map_brief(m)}

## This unit
{unit['id']} ({unit['kind']}): {unit['name']}

## Your track
{track_brief(t)}

Search (at most {searches} searches) for what this unit means through your track. Only report what would change the map
(establish a hypothesis row, add a part, add an edge) or unblock a Void stage ({', '.join(STAGES)}). A source must be a
page your search returned in this cycle, with the date shown on that page. If you find nothing like that, return no
findings: silence is the right answer, not a weak finding.

Answer with one JSON block:
```json
{{"findings": [{{"claim": "one sentence", "part": "<node id, or a new id>", "new_part": {{"name": "", "tracks": [], "stages": []}},
  "helps": ["<other track ids and/or stages>"], "source": "<url>", "dated": "YYYY-MM-DD"}}]}}
```"""


def convergence_prompt(m, unit, worker_out):
    return f"""You are the convergence pass of the Forethinkers (domains/forethinkers/brief.md). The unit is
{unit['id']}: {unit['name']}.

The map:
{map_brief(m)}

What each track's worker reported:
{json.dumps(worker_out, indent=1)}

Keep only what changes the map or unblocks a stage. Drop anything that helps no other track and no stage, anything without
a dated source, and repeats of what the map already says. Answer with one JSON block:
```json
{{"changes": [
  {{"op": "establish", "id": "<node id or from>to edge id>", "track": "", "claim": "", "source": "", "dated": "", "helps": []}},
  {{"op": "add_part", "id": "", "name": "", "tracks": [], "stages": [], "track": "", "claim": "", "source": "", "dated": "", "helps": []}},
  {{"op": "add_edge", "from": "", "to": "", "via": "", "track": "", "claim": "", "source": "", "dated": "", "helps": []}},
  {{"op": "unblocks", "stage": "{'|'.join(STAGES)}", "part": "", "track": "", "claim": "", "source": "", "dated": "", "helps": []}}
], "note": "one plain sentence if this is a breakthrough, else empty"}}
```"""


def orphan_prompt(m, t, tracks, searches):
    others = '\n'.join(f"- {v['id']} ({v['kind']}): {v['name']}" for v in tracks.values() if v['kind'] != 'miss')
    return f"""{brief()}

## The map now
{map_brief(m)}

## Tracks in the repo
{others}

## Your track touches no part on the map yet
{track_brief(t)}

Find where it joins the system (at most {searches} searches). Prefer, in order:
1. touch: a part or stage already on the map that this track uses or moves;
2. add_part: a new part this track shares with at least one other track (name both);
3. fits: (a miss or an old project only) an existing track it belongs to;
4. add_track: (a miss or an old project only) it fits nothing: a new track, with a one-line lens.
Return nothing rather than a weak link. Answer with one JSON block:
```json
{{"links": [
  {{"op": "touch", "part": "<node id>", "claim": "why, one sentence"}},
  {{"op": "add_part", "id": "", "name": "", "tracks": ["{t['id']}", "<other track>"], "stages": [], "claim": "", "source": "", "dated": ""}},
  {{"op": "fits", "track": "<track id>", "claim": ""}},
  {{"op": "add_track", "id": "", "name": "", "lens": "", "claim": ""}}
]}}
```"""


# ---------- applying what came back ----------

def converge(m, tracks, unit, conv, seen_urls, today, run_id):
    """Apply a unit's convergence pass, holding every change to the labels. A source counts only if a worker's search
    returned it this cycle. Returns the kept findings; the map changes in place."""
    nodes = {n['id']: n for n in m['nodes']}
    edges = {edge_id(e): e for e in m['edges']}
    ok_tracks = mappable(tracks)
    kept = []
    for c in (conv or {}).get('changes', []):
        src, dated = c.get('source', ''), c.get('dated', '')
        sourced = src in seen_urls and bool(DATE.match(dated or '')) and dated <= today
        f = {'at': today, 'run': run_id, 'unit': unit['id'], 'track': c.get('track'), 'claim': c.get('claim', ''),
             'helps': c.get('helps') or [], 'type': 'established' if sourced else 'hypothesis',
             'source': src if sourced else '', 'dated': dated if sourced else '', 'effect': 'map'}
        op = c.get('op')
        if op == 'establish':
            target = nodes.get(c.get('id')) or edges.get(c.get('id'))
            if not sourced or not target or target.get('status') != 'hypothesis' or target.get('kind') == 'stage':
                continue
            f['part'] = c['id'] if c['id'] in nodes else target['to']
            if finding_errors(f, set(nodes), tracks, 'x', today):
                continue
            target.update(status='established', source=src, dated=dated)
        elif op == 'add_part':
            pid = c.get('id', '')
            ts = [t for t in c.get('tracks', []) if t in ok_tracks]
            if not ID.match(pid) or pid in nodes or not ts or not c.get('name'):
                continue
            node = {'id': pid, 'kind': 'part', 'name': c['name'].replace('|', '/'), 'tracks': ts,
                    'stages': [s for s in c.get('stages', []) if s in STAGES], 'status': f['type'],
                    'source': f['source'], 'dated': f['dated'], 'checked': ''}
            f['part'] = pid
            if finding_errors(f, set(nodes) | {pid}, tracks, 'x', today):
                continue
            m['nodes'].append(node)
            nodes[pid] = node
        elif op == 'add_edge':
            e = {'from': c.get('from'), 'to': c.get('to'), 'via': c.get('via'), 'status': f['type'],
                 'source': f['source'], 'dated': f['dated']}
            if e['from'] not in nodes or e['to'] not in nodes or e['via'] not in ok_tracks or edge_id(e) in edges:
                continue
            f['part'] = e['from'] if nodes[e['from']]['kind'] == 'part' else e['to']
            if finding_errors(f, set(nodes), tracks, 'x', today):
                continue
            m['edges'].append(e)
            edges[edge_id(e)] = e
        elif op == 'unblocks':
            # a stage is unblocked by building, not by reading: the finding needs a real source and names the part
            stage = nodes.get(c.get('stage'))
            if not sourced or not stage or stage['kind'] != 'stage' or stage['status'] != 'blocked':
                continue
            f.update(effect='unblocks', stage=stage['id'], part=c.get('part'))
            if finding_errors(f, set(nodes), tracks, 'x', today):
                continue
        else:
            continue
        kept.append(f)
    return kept


def place_orphan(m, tracks, ledger, orphan, out, seen_urls, today, run_id, new_files):
    """Join a track that touched nothing to the map: touch a row, add a shared part, fit a track, or get a track file."""
    t = tracks[orphan]
    nodes = {n['id']: n for n in m['nodes']}
    ok_tracks = mappable(tracks)
    can_place = t['kind'] in ('miss', 'assimilate')
    kept = []
    for c in (out or {}).get('links', []):
        if orphan in ledger['placed'] or (t['kind'] != 'miss' and any(orphan in n['tracks'] for n in m['nodes'])):
            break  # one home is enough
        op = c.get('op')
        f = {'at': today, 'run': run_id, 'unit': '', 'track': orphan, 'claim': c.get('claim', ''), 'type': 'hypothesis',
             'source': '', 'dated': '', 'effect': 'map'}
        if op == 'touch':
            n = nodes.get(c.get('part'))
            if not n:
                continue
            f.update(unit=n['id'], part=n['id'], helps=[x for x in n['tracks'] if x != orphan] + n['stages']
                     + ([n['id']] if n['kind'] == 'stage' else []))
            if finding_errors(f, set(nodes), tracks, 'x', today):
                continue
            if t['kind'] == 'miss':
                ledger['placed'][orphan] = n['id']
                f['effect'] = 'placed'
            else:
                n['tracks'].append(orphan)
        elif op == 'add_part':
            pid = c.get('id', '')
            ts = [x for x in c.get('tracks', []) if x in ok_tracks]
            if t['kind'] != 'miss' and orphan not in ts:
                ts.insert(0, orphan)
            src, dated = c.get('source', ''), c.get('dated', '')
            sourced = src in seen_urls and bool(DATE.match(dated or '')) and dated <= today
            if not ID.match(pid) or pid in nodes or not c.get('name') or len([x for x in ts if x != orphan]) < 1:
                continue
            f.update(unit=pid, part=pid, helps=[x for x in ts if x != orphan] + [s for s in c.get('stages', []) if s in STAGES],
                     type='established' if sourced else 'hypothesis', source=src if sourced else '', dated=dated if sourced else '')
            node = {'id': pid, 'kind': 'part', 'name': c['name'].replace('|', '/'), 'tracks': ts,
                    'stages': [s for s in c.get('stages', []) if s in STAGES], 'status': f['type'],
                    'source': f['source'], 'dated': f['dated'], 'checked': ''}
            if finding_errors(f, set(nodes) | {pid}, tracks, 'x', today):
                continue
            m['nodes'].append(node)
            nodes[pid] = node
            if t['kind'] == 'miss':
                ledger['placed'][orphan] = pid
        elif op == 'fits' and can_place:
            home = c.get('track')
            if home not in ok_tracks or home == orphan:
                continue
            f.update(effect='placed', helps=[home])
            ledger['placed'][orphan] = home
        elif op == 'add_track' and can_place:
            tid, name, lens = c.get('id', ''), (c.get('name') or '').strip(), (c.get('lens') or '').strip()
            if not ID.match(tid) or tid in tracks or tid in new_files or not name or not lens:
                continue
            new_files[tid] = f'# {name}\n\nLens: {lens}\nFrom: {orphan} ({t["name"]}), placed by Forethinkers run {run_id}, {today}\n'
            f.update(effect='placed', helps=[tid])
            ledger['placed'][orphan] = tid
        else:
            continue
        kept.append(f)
    return kept


def growth_lines(kept):
    """A [think-tank] line on the growth board for each established finding that reaches a Void stage, with its source.
    Hypotheses stay on the map; the board hears only what a dated source backs."""
    lines = []
    for f in kept:
        if f['type'] != 'established':
            continue
        stages = [h for h in f.get('helps', []) if h in STAGES] + ([f['stage']] if f.get('stage') else [])
        if not stages:
            continue
        lines.append(f"\n[think-tank] {f['at']} {' / '.join(dict.fromkeys(stages))}: {f['claim']} ({f['source']}, {f['dated']})\n")
    return lines


def cycle():
    import anthropic
    m, ledger, tracks = load_map(), load_ledger(), load_tracks()
    synced = sync(m, tracks)
    active = active_tracks(tracks)
    searches = max(1, min(int(os.environ.get('MAX_SEARCHES', '3')), 10))
    p = plan(m, tracks, ledger, active, os.environ.get('UNIT') or None)
    today, run_id = date.today().isoformat(), len(ledger['runs']) + 1
    client = anthropic.Anthropic()
    pool = ThreadPoolExecutor(max_workers=max(1, int(os.environ.get('FORETHINKERS_PARALLEL', '6'))))
    print(f"Forethinkers run {run_id}: {len(p['units'])} units, {len(p['orphans'])} unjoined tracks, up to {p['calls']} calls")

    # every unit through every track it touches, at once
    jobs = {(u['unit']['id'], t): pool.submit(call, client, worker_prompt(m, u['unit'], tracks[t], searches), searches)
            for u in p['units'] for t in u['tracks']}
    orphan_jobs = {o: pool.submit(call, client, orphan_prompt(m, tracks[o], tracks, searches), searches) for o in p['orphans']}
    seen, worker_out = set(), {}
    for (uid, t), fut in jobs.items():
        text, urls = fut.result()
        seen |= urls
        found = (parse_json(text) or {}).get('findings', [])
        if found:
            worker_out.setdefault(uid, {})[t] = found
    orphan_out = {}
    for o, fut in orphan_jobs.items():
        text, urls = fut.result()
        seen |= urls
        orphan_out[o] = parse_json(text)

    # one convergence pass per unit that had anything to say
    units = {u['unit']['id']: u['unit'] for u in p['units']}
    conv_jobs = {uid: pool.submit(call, client, convergence_prompt(m, units[uid], said), 0) for uid, said in worker_out.items()}
    kept, notes = [], []
    for uid, fut in conv_jobs.items():
        conv = parse_json(fut.result()[0])
        got = converge(m, tracks, units[uid], conv, seen, today, run_id)
        kept += got
        if got and (conv or {}).get('note'):
            notes.append(conv['note'].strip())
    new_files = {}
    for o, links in orphan_out.items():
        kept += place_orphan(m, tracks, ledger, o, links, seen, today, run_id, new_files)
    pool.shutdown()
    for n in m['nodes']:
        if n['id'] in units:
            n['checked'] = today

    calls = len(jobs) + len(orphan_jobs) + len(conv_jobs)
    result = 'changed' if kept or synced or new_files else 'dead'
    ledger['runs'].append({'run': run_id, 'at': today, 'units': len(units), 'tracks': len({t for _, t in jobs} | set(orphan_jobs)),
                           'calls': calls, 'max_searches': searches, 'result': result, 'kept': len(kept)})
    ledger['findings'] += kept
    for tid, text in new_files.items():
        tracks[tid] = {'id': tid, 'kind': 'track', 'name': tid, 'lens': 'x', 'file': f'domains/forethinkers/tracks/{tid}.md'}
    errs = check(m, ledger, tracks, today)
    if errs:
        sys.exit('cycle produced a map that fails the check:\n' + '\n'.join(errs))
    summary = f"Forethinkers run {run_id}: {len(units)} units, {calls} calls: {result}, {len(kept)} kept"
    print(summary)
    for f in kept:
        print(f"  [{f['type']}] {f['track']}: {f['claim']} ({f['source'] or 'no source'})")
    if result == 'changed':
        # Silence is the default: only a cycle that changed something writes.
        MAP.write_text(render_map(m), encoding='utf-8')
        LEDGER.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        TRACK_DIR.mkdir(exist_ok=True)
        for tid, text in new_files.items():
            (TRACK_DIR / f'{tid}.md').write_text(text, encoding='utf-8')
        board = growth_lines(kept)
        if board:
            with open(GROWTH, 'a', encoding='utf-8', newline='') as fh:
                fh.write(''.join(board))
    established = any(f['type'] == 'established' for f in kept)
    note = ' '.join(notes) if established else ''
    return out(changed=result == 'changed', breakthrough=bool(note), note=note, summary=summary)


def out(**kv):
    path = os.environ.get('GITHUB_OUTPUT')
    if path:
        with open(path, 'a', encoding='utf-8') as fh:
            for k, v in kv.items():
                v = str(v).lower() if isinstance(v, bool) else str(v).replace('\n', ' ')
                fh.write(f'{k}={v}\n')
    return kv


# ---------- selftest (no network) ----------

def selftest():
    fails = []

    def ok(cond, what):
        if not cond:
            fails.append(what)
    u = lambda s: datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    # 02:03 ET on both sides of the 2026-11-01 change; odd ET hours skip
    ok(gate(u('2026-10-31T06:03')) == 'run', '02:03 EDT (Oct 31) runs')
    ok(gate(u('2026-11-01T07:03')) == 'run', '02:03 EST (Nov 1) runs')
    ok(gate(u('2026-11-01T06:03')) == 'skip', '01:03 EST (second 1 am, Nov 1) skips')
    ok(gate(u('2026-11-01T05:03')) == 'skip', '01:03 EDT (first 1 am, Nov 1) skips')
    ok(gate(u('2027-03-14T06:03')) == 'skip', '01:03 EST (Mar 14) skips')
    ok(gate(u('2027-03-14T07:03')) == 'skip', '03:03 EDT (Mar 14, 2 am does not exist) skips')
    ok(gate(u('2027-03-14T08:03')) == 'run', '04:03 EDT (Mar 14) runs')

    tracks, m, empty = load_tracks(), load_map(), {'findings': [], 'runs': [], 'placed': {}}
    kinds = {k: sum(1 for v in tracks.values() if v['kind'] == k) for k in ('track', 'domain', 'assimilate', 'miss')}
    ok(kinds['domain'] >= 18, f'every venture domain file is a track (got {kinds["domain"]})')
    ok(kinds['assimilate'] >= 13, f'every assimilate row is a track (got {kinds["assimilate"]})')
    ok(kinds['track'] >= 4, 'the first four are track files, not the whole list')
    ok(not any(v['kind'] == 'miss' and NOISE.search(v['name']) for v in tracks.values()), 'probes on the board are not tracks')
    ok('shared-intake' in tracks['handoff-studio']['uses'] and 'partner-bench' in tracks['control-ledger']['uses'],
       'a domain uses: line is read, aliases folded (licensed-partner bench is the partner bench)')
    errs = check(m, empty, tracks)
    ok(not errs, 'the committed map passes: ' + '; '.join(errs[:5]))
    est = [n['id'] for n in m['nodes'] if n['kind'] == 'part' and n['status'] == 'established']
    ok(est == ['printed-linear-motor'], f'the MIT motor is the only established node (got {est})')

    bad = load_map()
    next(n for n in bad['nodes'] if n['id'] == 'shared-intake')['tracks'].remove('handoff-studio')
    ok(any('uses shared-intake' in e for e in check(bad, empty, tracks)), 'a declared domain link missing from the map fails')
    ok(sync(bad, tracks) == ['shared-intake < handoff-studio'], 'sync puts it back')
    soft = next(n for n in bad['nodes'] if n['id'] == 'soft-actuator')
    soft['source'] = 'https://example.org/soft'
    ok(any('hypothesis carries a source' in e for e in check(bad, empty, tracks)), 'hypothesis with a source fails')
    soft.update(status='established', dated='')
    ok(any('without a date' in e for e in check(bad, empty, tracks)), 'established without a date fails')
    soft.update(dated='2099-01-01')
    ok(any('future' in e for e in check(bad, empty, tracks)), 'a future date fails')
    soft.update(status='hypothesis', source='', dated='', tracks=['printed-machines', 'miss-anything'])
    ok(any('tracks must be' in e for e in check(bad, empty, tracks)), 'a miss is placed, never written into a row')

    dead = {'unit': 'soft-actuator', 'track': 'printed-machines', 'claim': 'x', 'part': 'soft-actuator',
            'helps': ['printed-machines'], 'type': 'hypothesis', 'source': '', 'dated': '', 'effect': 'map'}
    ok(any('dead run' in e for e in check(m, dict(empty, findings=[dead]), tracks)), 'a finding that helps only its own track is dead')

    # everything, every cycle: every unit through every track it touches, plus every track that touches nothing
    p = plan(m, tracks, empty)
    unit_ids = {x['unit']['id'] for x in p['units']}
    ok({'export', 'print', 'own', 'printed-linear-motor', 'shared-intake', 'persuadetron'} <= unit_ids,
       f'every part and blocked stage is worked (missing {sorted({"export", "print", "own", "shared-intake"} - unit_ids)})')
    ok(not ({'summon', 'spin'} & unit_ids), 'live stages are not units')
    si = next(x for x in p['units'] if x['unit']['id'] == 'shared-intake')
    ok(len(si['tracks']) >= 14, f'a shared part fans into every track that uses it (shared intake: {len(si["tracks"])})')
    touched = {t for n in m['nodes'] for t in n['tracks']}
    ok(set(p['orphans']) == set(tracks) - touched, 'every track that touches nothing is worked too')
    ok(p['calls'] == sum(len(x['tracks']) + 1 for x in p['units']) + len(p['orphans']), 'the call count adds up')
    one = plan(m, tracks, empty, None, 'print')
    ok(len(one['units']) == 1 and not one['orphans'], 'UNIT works one row only')

    # a unit's convergence: a URL the search did not return is not a source; a sourced change lands; a dead one drops
    m2 = load_map()
    unit = next(n for n in m2['nodes'] if n['id'] == 'printed-actuator-joint')
    url = 'https://example.org/joint-2026'
    conv = {'changes': [
        {'op': 'establish', 'id': 'soft-actuator', 'track': 'printed-machines', 'claim': 'from memory',
         'source': 'https://nowhere.example/x', 'dated': '2026-01-01', 'helps': ['living-figures']},
        {'op': 'establish', 'id': 'printed-actuator-joint', 'track': 'printed-machines', 'claim': 'a printed joint moves a figure arm',
         'source': url, 'dated': '2026-05-01', 'helps': ['living-figures', 'print']},
        {'op': 'add_part', 'id': 'printed-gear', 'name': 'Printed gear', 'tracks': ['printed-machines'], 'stages': [],
         'track': 'printed-machines', 'claim': 'gears print', 'source': url, 'dated': '2026-05-01', 'helps': ['printed-machines']},
        {'op': 'add_edge', 'from': 'printed-joint-sensor', 'to': 'assistive-joint', 'via': 'life-extension', 'track': 'printed-machines',
         'claim': 'the same sensor reads a prosthetic knee', 'helps': ['life-extension']},
    ], 'note': ''}
    kept = converge(m2, tracks, unit, conv, {url}, '2026-10-03', 1)
    ids = {n['id']: n for n in m2['nodes']}
    ok(ids['soft-actuator']['status'] == 'hypothesis', 'a source the search never returned does not establish')
    ok(ids['printed-actuator-joint']['status'] == 'established', 'a searched, dated source establishes')
    ok('printed-gear' not in ids, 'a new part that helps no other track or stage is dropped')
    ok(any(e['from'] == 'printed-joint-sensor' and e['to'] == 'assistive-joint' and e['status'] == 'hypothesis'
           for e in m2['edges']), 'an unsourced edge lands as hypothesis')
    ok(len(kept) == 2, f'two changes kept (got {len(kept)})')

    # tracks that touched nothing: an old project joins a part; a miss fits a track or gets its own track file
    led = {'findings': [], 'runs': [], 'placed': {}}
    files = {}
    orphan_old = next(t for t in tracks if t.startswith('assimilate-') and t not in touched)
    kept += place_orphan(m2, tracks, led, orphan_old, {'links': [{'op': 'touch', 'part': 'export', 'claim': 'its pages export'}]},
                         set(), '2026-10-03', 1, files)
    ok(orphan_old in ids['export']['tracks'], 'an old project that touches a stage joins its row')
    misses = [t for t, v in tracks.items() if v['kind'] == 'miss']
    if len(misses) >= 2:
        kept += place_orphan(m2, tracks, led, misses[0], {'links': [{'op': 'fits', 'track': 'living-figures', 'claim': 'x'}]},
                             set(), '2026-10-03', 1, files)
        kept += place_orphan(m2, tracks, led, misses[1], {'links': [{'op': 'add_track', 'id': 'everyday-lists',
                             'name': 'Everyday lists', 'lens': 'lists people keep', 'claim': 'fits nothing yet'}]},
                             set(), '2026-10-03', 1, files)
        ok(led['placed'].get(misses[0]) == 'living-figures', 'a miss that fits a track is placed there')
        ok(led['placed'].get(misses[1]) == 'everyday-lists' and 'Lens: lists people keep' in files['everyday-lists'],
           'a miss that fits nothing gets a track file')
        tracks2 = dict(tracks, **{'everyday-lists': {'id': 'everyday-lists', 'kind': 'track', 'name': 'Everyday lists',
                                                     'lens': 'lists people keep', 'file': 'x'}})
    else:
        tracks2 = tracks
    led['findings'] = kept
    errs = check(m2, led, tracks2, '2026-10-03')
    ok(not errs, 'the map after a cycle passes the check: ' + '; '.join(errs[:5]))
    ok(load_map(render_map(m2))['nodes'] == m2['nodes'], 'the map round-trips through markdown')
    board = growth_lines(kept)
    ok(len(board) == 1 and url in board[0], 'only the established finding that reaches a Void stage goes on the growth board')

    for f in fails:
        print('FAIL', f)
    print(f'forethinkers selftest: {"all passed" if not fails else str(len(fails)) + " failed"}')
    return 1 if fails else 0


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    if cmd == 'check':
        errs = check()
        for e in errs:
            print('FAIL', e)
        print(f'forethinkers check: {"ok" if not errs else str(len(errs)) + " broken"}')
        return 1 if errs else 0
    if cmd == 'sync':
        m = load_map()
        added = sync(m, load_tracks())
        if added:
            MAP.write_text(render_map(m), encoding='utf-8')
        print('\n'.join(added) or 'map already shows every declared link')
        return 0
    if cmd == 'tracks':
        tracks, m, led = load_tracks(), load_map(), load_ledger()
        touched = {t for n in m['nodes'] for t in n['tracks']}
        for v in tracks.values():
            where = 'on the map' if v['id'] in touched else (f"placed: {led['placed'][v['id']]}" if v['id'] in led['placed'] else 'unjoined')
            print(f"{v['kind']:10} {v['id']:40} {where:24} {v['name'][:60]}")
        print(f'{len(tracks)} tracks')
        return 0
    if cmd == 'selftest':
        return selftest()
    if cmd == 'gate':
        at = None
        if '--at' in sys.argv:
            at = datetime.fromisoformat(sys.argv[sys.argv.index('--at') + 1])
            at = at if at.tzinfo else at.replace(tzinfo=timezone.utc)
        g = gate(at)
        print(g)
        out(run=g == 'run')
        return 0
    if cmd == 'plan':
        tracks = load_tracks()
        p = plan(load_map(), tracks, load_ledger(), active_tracks(tracks), os.environ.get('UNIT') or None)
        for x in p['units']:
            print(f"unit {x['unit']['id']} ({x['unit']['kind']}, {x['unit']['status']}): {len(x['tracks'])} tracks: {', '.join(x['tracks'])}")
        if p['orphans']:
            print(f"unjoined tracks ({len(p['orphans'])}): {', '.join(p['orphans'])}")
        print(f"{len(p['units'])} units, {len(p['orphans'])} unjoined tracks, up to {p['calls']} model calls")
        return 0
    if cmd == 'cycle':
        cycle()
        return 0
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main())
