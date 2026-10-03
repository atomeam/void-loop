"""The Forethinkers runner (the even-hour backstop; a talking cycle doesn't wait for it).

Read domains/forethinkers/THINK-TANK-BRIEF.md first. The shared map is domains/forethinkers/convergence.md; kept findings
and placements are in domains/forethinkers/findings.json; domains/forethinkers/run-log.md is the human log.

Tracks are discovered, never listed: every file in domains/ (skipping only logs, queues and the QA sheet), every
numbered row of domains/void.assimilate.md, and every track file in domains/forethinkers/tracks/. A new file under
domains/ is a track on the next cycle. A domain's "Shared parts: ... uses:" line is a declared link: `sync` puts it on the
map and `check` fails while it is missing.

One cycle is one model call that sees every track and the whole map (no fan-out per track), with web searches capped.
Every change it proposes is held to the labels in code before anything is written; nothing that fails is kept.

  python tools/forethinkers.py check       map, labels, findings and declared links hold (CI; exit 1 on any break)
  python tools/forethinkers.py sync        puts every declared domain link on the map
  python tools/forethinkers.py tracks      lists every track, and whether it is on the map yet
  python tools/forethinkers.py plan        what the next cycle reads (no model call)
  python tools/forethinkers.py gate [--at ISO]   prints run / skip: even New York hours run, odd hours skip
  python tools/forethinkers.py cycle       one cycle; without ANTHROPIC_API_KEY it lists the tracks and calls nothing
  python tools/forethinkers.py selftest    gate across DST, labels, declared links, dead runs, the change filter

Env (optional): MAX_SEARCHES (default 5), MODEL or FORETHINKERS_MODEL (default claude-opus-5-5), FORETHINKERS_EFFORT
(default high).
"""
import json
import os
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
DOMAINS = ROOT / 'domains'
DIR = DOMAINS / 'forethinkers'
TRACK_DIR = DIR / 'tracks'
BRIEF = DIR / 'THINK-TANK-BRIEF.md'
MAP = DIR / 'convergence.md'
LEDGER = DIR / 'findings.json'
RUNLOG = DIR / 'run-log.md'
GROWTH = DOMAINS / 'void.growth.md'
ASSIMILATE = DOMAINS / 'void.assimilate.md'
# the brief: skip only logs, queues and the QA sheet
SKIP = {'void.agents.log.md', 'void.queue.md', 'void.surface-qa.md', 'growth-inbox.md'}
STAGES = ['summon', 'spin', 'export', 'print', 'own']
ET = ZoneInfo('America/New_York')
NODE_COLS = ['id', 'kind', 'name', 'tracks', 'stages', 'status', 'source', 'dated', 'checked']
EDGE_COLS = ['from', 'to', 'via', 'status', 'source', 'dated']
DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
URL = re.compile(r'^https?://\S+$')
ID = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
TRACK_ID = re.compile(r'^[a-z0-9]+([.-][a-z0-9]+)*$')
PER_TRACK_CHARS = 12000
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


# ---------- tracks: discovered from the repo ----------

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


def load_tracks():
    """Every track: each file in domains/ (minus logs and queues), each assimilate row, each Forethinkers track file."""
    tracks = {}
    for p in sorted(DOMAINS.glob('*.md')):
        if p.name in SKIP:
            continue
        t = read(p)
        title = re.search(r'^\*\*Title:\*\*\s*(.+?)\s*$', t, re.M) or re.search(r'^#\s+(.+?)\s*$', t, re.M)
        tid = p.stem.lower()
        tracks[tid] = {'id': tid, 'kind': 'domain', 'name': title.group(1) if title else p.stem,
                       'uses': domain_uses(t), 'file': rel(p)}
    if ASSIMILATE.exists():
        for line in read(ASSIMILATE).split('\n'):
            c = [x.strip() for x in line.strip().strip('|').split('|')] if re.match(r'^\|\s*\d+\s*\|', line) else []
            if len(c) >= 5:
                tid = f'assimilate-{c[0]}'
                tracks[tid] = {'id': tid, 'kind': 'assimilate', 'name': re.sub(r'\s*\(.*', '', c[1]).strip() or tid,
                               'text': f'{c[2]}. Void form: {c[3]} (status: {c[4]})', 'file': rel(ASSIMILATE)}
    for p in sorted(TRACK_DIR.glob('*.md')):
        t = read(p)
        name = re.search(r'^# (.+)$', t, re.M)
        lens = re.search(r'^Lens:\s*(.+)$', t, re.M)
        entry = {'id': p.stem, 'kind': 'track', 'name': name.group(1).strip() if name else p.stem,
                 'lens': lens.group(1).strip() if lens else '', 'file': rel(p)}
        if p.stem in tracks:
            entry['clash'] = tracks[p.stem]['file']
        tracks[p.stem] = entry
    return tracks


def track_text(t):
    if t['kind'] == 'assimilate':
        return t['text']
    return read(ROOT / t['file'])[:PER_TRACK_CHARS]


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
    for k, v in (('findings', []), ('runs', []), ('placed', {})):
        led.setdefault(k, v)
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
    errs = [f'track {t}: a track file and {v["clash"]} share this id' for t, v in tracks.items() if v.get('clash')]
    errs += [f'{v["file"]}: a track file needs a "Lens:" line' for v in tracks.values() if v['kind'] == 'track' and not v['lens']]
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
        bad = [t for t in n['tracks'] if t not in tracks]
        if bad or not n['tracks']:
            errs.append(f'{where}: tracks must be tracks in the repo (python tools/forethinkers.py tracks); got {bad or "none"}')
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
        if e.get('via') not in tracks:
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
        if not TRACK_ID.match(orphan) or (home not in tracks and home not in ids):
            errs.append(f'placed {orphan}: must point at a track in the repo or a row on the map (got "{home}")')
    return errs


def finding_errors(f, ids, tracks, where, today):
    errs = []
    if not TRACK_ID.match(f.get('track') or ''):
        errs.append(f'{where}: no track')
    if not f.get('claim'):
        errs.append(f'{where}: no claim')
    effect = f.get('effect')
    if effect not in ('map', 'unblocks', 'placed'):
        errs.append(f'{where}: effect must be map, unblocks or placed')
    if effect != 'placed':
        if f.get('part') not in ids:
            errs.append(f'{where}: names no part on the map')
        if f.get('unit') not in ids:
            errs.append(f'{where}: unit "{f.get("unit")}" is not on the map')
    if effect == 'unblocks' and f.get('stage') not in STAGES:
        errs.append(f'{where}: unblocks names no stage')
    others = [h for h in f.get('helps') or [] if h != f.get('track') and (h in STAGES or h in tracks or h in ids)]
    if not others:
        errs.append(f'{where}: dead run: helps no other track and no product stage')
    errs += label_errors(where, f.get('type'), f.get('source'), f.get('dated'), today)
    return errs


# ---------- schedule gate ----------

def gate(at=None):
    at = at or datetime.now(timezone.utc)
    return 'run' if at.astimezone(ET).hour % 2 == 0 else 'skip'


# ---------- what a cycle reads ----------

def plan(m, tracks, ledger):
    touched = {t for n in m['nodes'] for t in n['tracks']}
    return {'tracks': list(tracks), 'blocked': [n['id'] for n in m['nodes'] if n['kind'] == 'stage' and n['status'] == 'blocked'],
            'hypotheses': [n['id'] for n in m['nodes'] if n['kind'] == 'part' and n['status'] == 'hypothesis'],
            'unjoined': [t for t in tracks if t not in touched and t not in ledger['placed']], 'calls': 1}


def map_brief(m):
    rows = [f"- {n['id']} ({n['kind']}, {n['status']}): {n['name']} | tracks {', '.join(n['tracks'])}"
            + (f" | stages {', '.join(n['stages'])}" if n['stages'] else '') for n in m['nodes']]
    rows += [f"- edge {edge_id(e)} via {e['via']} ({e['status']})" for e in m['edges']]
    return '\n'.join(rows)


def cycle_prompt(m, tracks, ledger, searches):
    p = plan(m, tracks, ledger)
    body = '\n\n'.join(f"### track {t['id']} ({t['kind']}): {t['name']}\n{track_text(t)}" for t in tracks.values())
    return f"""{read(BRIEF)}

## How this runner holds you to it
Every change below is checked in code before it is written; anything that fails is dropped.
- A source counts only if your web search returned that exact URL in this call, with the date on the page (YYYY-MM-DD).
  Then the row is established. Without both it lands as hypothesis, with no source.
- Every change names the row it advances ("unit": a node id) and the track ids it helps. A change that helps no other
  track and no stage ({', '.join(STAGES)}) is a dead run and is dropped.
- Track ids are exactly the ids after "### track" below. Node ids are lower-case words joined by -.
- You have at most {searches} web searches.

## The map now
{map_brief(m)}

Blocked stages: {', '.join(p['blocked'])}
Tracks not on the map yet: {', '.join(p['unjoined'])}

## Every track
{body}

## Answer
Advance the most promising open question that changes the shared map or unblocks a stage. If nothing does, return no
changes: silence is the right answer, not a weak finding. One JSON block:
```json
{{"changes": [
  {{"op": "establish", "id": "<node id or from>to edge id>", "unit": "", "track": "", "claim": "", "source": "", "dated": "", "helps": []}},
  {{"op": "add_part", "id": "", "name": "", "tracks": [], "stages": [], "unit": "", "track": "", "claim": "", "source": "", "dated": "", "helps": []}},
  {{"op": "add_edge", "from": "", "to": "", "via": "", "unit": "", "track": "", "claim": "", "source": "", "dated": "", "helps": []}},
  {{"op": "unblocks", "stage": "", "part": "", "unit": "", "track": "", "claim": "", "source": "", "dated": "", "helps": []}},
  {{"op": "touch", "track": "<a track not on the map>", "part": "<node id it uses>", "claim": ""}},
  {{"op": "add_track", "id": "", "name": "", "lens": "", "from": "<the miss or old project>", "part": "<node id it touches>", "claim": ""}}
], "note": "one plain sentence with the source link if this is a breakthrough, else empty"}}
```"""


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
    """The cycle's one model call. Returns (text, urls the web search actually returned)."""
    import anthropic
    model = os.environ.get('FORETHINKERS_MODEL') or os.environ.get('MODEL') or 'claude-opus-5-5'
    kw = dict(model=model, max_tokens=32000, betas=['server-side-fallback-2026-07-01'],
              tools=[{'type': 'web_search_20260209', 'name': 'web_search', 'max_uses': searches}],
              extra_body={'fallbacks': 'default', 'output_config': {'effort': os.environ.get('FORETHINKERS_EFFORT', 'high')}})
    messages = [{'role': 'user', 'content': prompt}]
    urls, r = set(), None
    for _ in range(4):
        try:
            with client.beta.messages.stream(messages=messages, **kw) as s:
                r = s.get_final_message()
        except anthropic.APIStatusError as e:
            sys.exit(f'model call failed ({e.status_code}): {e.message}')
        except anthropic.APIConnectionError:
            sys.exit('model call failed: network error')
        for b in r.content:
            if b.type == 'web_search_tool_result' and isinstance(b.content, list):
                urls.update(x.url for x in b.content if getattr(x, 'url', None))
        if r.stop_reason == 'refusal':
            return '', urls
        if r.stop_reason != 'pause_turn':
            break
        messages = [messages[0], {'role': 'assistant', 'content': r.content}]
    return ''.join(b.text for b in r.content if b.type == 'text'), urls


# ---------- applying what came back ----------

def apply_changes(m, tracks, ledger, answer, seen_urls, today, run_id, new_files):
    """Hold every proposed change to the labels; apply the ones that pass. Returns the kept findings."""
    nodes = {n['id']: n for n in m['nodes']}
    edges = {edge_id(e): e for e in m['edges']}
    touched = {t for n in m['nodes'] for t in n['tracks']}
    kept = []
    for c in (answer or {}).get('changes', []):
        src, dated = c.get('source', ''), c.get('dated', '')
        sourced = src in seen_urls and bool(DATE.match(dated or '')) and dated <= today
        f = {'at': today, 'run': run_id, 'unit': c.get('unit'), 'track': c.get('track'), 'claim': c.get('claim', ''),
             'helps': c.get('helps') or [], 'type': 'established' if sourced else 'hypothesis',
             'source': src if sourced else '', 'dated': dated if sourced else '', 'effect': 'map'}
        op = c.get('op')
        if op == 'establish':
            target = nodes.get(c.get('id')) or edges.get(c.get('id'))
            if not sourced or not target or target.get('status') != 'hypothesis' or target.get('kind') == 'stage':
                continue
            f['part'] = c['id'] if c['id'] in nodes else target['to']
            f['unit'] = f['unit'] if f['unit'] in nodes else f['part']
            if finding_errors(f, set(nodes), tracks, 'x', today):
                continue
            target.update(status='established', source=src, dated=dated)
        elif op == 'add_part':
            pid = c.get('id', '')
            ts = [t for t in c.get('tracks', []) if t in tracks]
            if not ID.match(pid) or pid in nodes or not ts or not c.get('name'):
                continue
            node = {'id': pid, 'kind': 'part', 'name': c['name'].replace('|', '/'), 'tracks': ts,
                    'stages': [s for s in c.get('stages', []) if s in STAGES], 'status': f['type'],
                    'source': f['source'], 'dated': f['dated'], 'checked': today}
            f['part'] = pid
            f['unit'] = f['unit'] if f['unit'] in nodes else pid
            if finding_errors(f, set(nodes) | {pid}, tracks, 'x', today):
                continue
            m['nodes'].append(node)
            nodes[pid] = node
        elif op == 'add_edge':
            e = {'from': c.get('from'), 'to': c.get('to'), 'via': c.get('via'), 'status': f['type'],
                 'source': f['source'], 'dated': f['dated']}
            if e['from'] not in nodes or e['to'] not in nodes or e['via'] not in tracks or edge_id(e) in edges:
                continue
            f['part'] = e['from'] if nodes[e['from']]['kind'] == 'part' else e['to']
            f['unit'] = f['unit'] if f['unit'] in nodes else f['part']
            if finding_errors(f, set(nodes), tracks, 'x', today):
                continue
            m['edges'].append(e)
            edges[edge_id(e)] = e
        elif op == 'unblocks':
            # a stage is unblocked by building, not by reading: the finding needs a real source and names the part
            stage = nodes.get(c.get('stage'))
            if not sourced or not stage or stage['kind'] != 'stage' or stage['status'] != 'blocked':
                continue
            f.update(effect='unblocks', stage=stage['id'], part=c.get('part'),
                     unit=f['unit'] if f['unit'] in nodes else stage['id'])
            if finding_errors(f, set(nodes), tracks, 'x', today):
                continue
        elif op == 'touch':
            t, n = c.get('track'), nodes.get(c.get('part'))
            if t not in tracks or t in touched or not n:
                continue
            f.update(type='hypothesis', source='', dated='', unit=n['id'], part=n['id'],
                     helps=[x for x in n['tracks'] if x != t] + n['stages'] + ([n['id']] if n['kind'] == 'stage' else []))
            if finding_errors(f, set(nodes), tracks, 'x', today):
                continue
            n['tracks'].append(t)
            touched.add(t)
        elif op == 'add_track':
            # a miss or an old project that fits no file: a track file and a map row in the same cycle
            tid, name, lens, n = c.get('id', ''), (c.get('name') or '').strip(), (c.get('lens') or '').strip(), nodes.get(c.get('part'))
            if not ID.match(tid) or tid in tracks or tid in new_files or not name or not lens or not n:
                continue
            f.update(type='hypothesis', source='', dated='', track=tid, unit=n['id'], part=n['id'],
                     helps=[x for x in n['tracks'] if x != tid] + n['stages'] + ([n['id']] if n['kind'] == 'stage' else []))
            if finding_errors(f, set(nodes), dict(tracks, **{tid: {'id': tid}}), 'x', today):
                continue
            new_files[tid] = f'# {name}\n\nLens: {lens}\nFrom: {c.get("from") or "a miss or old project"}; added by Forethinkers run {run_id}, {today}\n'
            tracks[tid] = {'id': tid, 'kind': 'track', 'name': name, 'lens': lens, 'file': rel(TRACK_DIR / f'{tid}.md')}
            n['tracks'].append(tid)
            touched.add(tid)
        else:
            continue
        if f['unit'] in nodes:
            nodes[f['unit']]['checked'] = today
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
        if stages:
            lines.append(f"\n[think-tank] {f['at']} {' / '.join(dict.fromkeys(stages))}: {f['claim']} ({f['source']}, {f['dated']})\n")
    return lines


def log_run(run_id, kept, note):
    """Newest first, under the run log's header."""
    head, sep, rest = read(RUNLOG).partition('\n## ')
    stamp = datetime.now(ET).strftime('%Y-%m-%d %H:%M ET')
    lines = [f'## {stamp} backstop run {run_id}', ''] + [
        f"- {f['type'].capitalize()}: {f['claim']}" + (f" {f['source']} ({f['dated']})" if f['source'] else '') for f in kept]
    if note:
        lines += ['', f'Breakthrough: {note}']
    RUNLOG.write_text(head.rstrip('\n') + '\n\n' + '\n'.join(lines) + '\n' + (('\n## ' + rest) if sep else ''), encoding='utf-8')


def cycle():
    m, ledger, tracks = load_map(), load_ledger(), load_tracks()
    synced = sync(m, tracks)
    p = plan(m, tracks, ledger)
    print(f"tracks={len(tracks)} blocked={','.join(p['blocked'])} not on the map yet={len(p['unjoined'])}")
    if not os.environ.get('ANTHROPIC_API_KEY'):
        print('no key: no model call. A talking cycle still writes findings by hand.')
        print('\n'.join(tracks))
        return out(changed=False)
    import anthropic
    searches = max(1, min(int(os.environ.get('MAX_SEARCHES', '5')), 20))
    today, run_id = date.today().isoformat(), len(ledger['runs']) + 1
    text, seen = call(anthropic.Anthropic(), cycle_prompt(m, tracks, ledger, searches), searches)
    answer = parse_json(text)
    new_files = {}
    kept = apply_changes(m, tracks, ledger, answer, seen, today, run_id, new_files)
    result = 'changed' if kept or synced else 'dead'
    ledger['runs'].append({'run': run_id, 'at': today, 'tracks': len(tracks), 'calls': 1, 'max_searches': searches,
                           'searched': len(seen), 'result': result, 'kept': len(kept)})
    ledger['findings'] += kept
    errs = check(m, ledger, tracks, today)
    if errs:
        sys.exit('cycle produced a map that fails the check:\n' + '\n'.join(errs))
    established = any(f['type'] == 'established' for f in kept)
    note = ((answer or {}).get('note') or '').strip() if established else ''
    summary = f"Forethinkers run {run_id}: {len(tracks)} tracks, 1 call: {result}, {len(kept)} kept"
    print(summary)
    for f in kept:
        print(f"  [{f['type']}] {f['track']}: {f['claim']} ({f['source'] or 'no source'})")
    if result == 'changed':
        # silence is the default: only a cycle that changed something writes
        MAP.write_text(render_map(m), encoding='utf-8')
        LEDGER.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        TRACK_DIR.mkdir(exist_ok=True)
        for tid, body in new_files.items():
            (TRACK_DIR / f'{tid}.md').write_text(body, encoding='utf-8')
        log_run(run_id, kept, note)
        board = growth_lines(kept)
        if board:
            with open(GROWTH, 'a', encoding='utf-8', newline='') as fh:
                fh.write(''.join(board))
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
    # 02:03 New York time on both sides of the 2026-11-01 change; odd hours skip
    ok(gate(u('2026-10-31T06:03')) == 'run', '02:03 EDT (Oct 31) runs')
    ok(gate(u('2026-11-01T07:03')) == 'run', '02:03 EST (Nov 1) runs')
    ok(gate(u('2026-11-01T06:03')) == 'skip', '01:03 EST (second 1 am, Nov 1) skips')
    ok(gate(u('2026-11-01T05:03')) == 'skip', '01:03 EDT (first 1 am, Nov 1) skips')
    ok(gate(u('2027-03-14T07:03')) == 'skip', '03:03 EDT (Mar 14, 2 am does not exist) skips')
    ok(gate(u('2027-03-14T08:03')) == 'run', '04:03 EDT (Mar 14) runs')

    tracks, m, empty = load_tracks(), load_map(), {'findings': [], 'runs': [], 'placed': {}}
    domain_files = {p.stem.lower() for p in DOMAINS.glob('*.md') if p.name not in SKIP}
    ok(domain_files <= set(tracks), 'every file in domains/ (minus logs and queues) is a track')
    ok(not ({'void.agents.log', 'void.queue'} & set(tracks)), 'logs and queues are not tracks')
    ok(sum(1 for t in tracks if t.startswith('assimilate-')) >= 13, 'every assimilate row is a track')
    ok({'printed-machines', 'living-figures', 'influence-science'} <= set(tracks), 'Forethinkers track files are tracks')
    ok('shared-intake' in tracks['handoff-studio']['uses'] and 'partner-bench' in tracks['control-ledger']['uses'],
       'a domain uses: line is read, aliases folded (licensed-partner bench is the partner bench)')
    errs = check(m, empty, tracks)
    ok(not errs, 'the committed map passes: ' + '; '.join(errs[:5]))
    est = sorted(n['id'] for n in m['nodes'] if n['kind'] == 'part' and n['status'] == 'established')
    ok(est == ['fiber-muscle', 'printed-linear-motor', 'stamped-muscle'], f'the dated actuator family is established, nothing else (got {est})')
    p = plan(m, tracks, empty)
    ok(p['calls'] == 1 and len(p['tracks']) == len(tracks), 'one call sees every track')

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
    dead = {'unit': 'soft-actuator', 'track': 'printed-machines', 'claim': 'x', 'part': 'soft-actuator',
            'helps': ['printed-machines'], 'type': 'hypothesis', 'source': '', 'dated': '', 'effect': 'map'}
    ok(any('dead run' in e for e in check(m, dict(empty, findings=[dead]), tracks)), 'a finding that helps only its own track is dead')

    # what one call proposes is held to the labels in code
    m2, t2, led, files = load_map(), load_tracks(), {'findings': [], 'runs': [], 'placed': {}}, {}
    url = 'https://example.org/joint-2026'
    orphan = next(t for t in plan(m2, t2, led)['unjoined'] if t.startswith('assimilate-'))
    answer = {'changes': [
        {'op': 'establish', 'id': 'soft-actuator', 'track': 'printed-machines', 'claim': 'from memory',
         'source': 'https://nowhere.example/x', 'dated': '2026-01-01', 'helps': ['living-figures']},
        {'op': 'establish', 'id': 'printed-actuator-joint', 'track': 'printed-machines', 'claim': 'a printed joint moves a figure arm',
         'source': url, 'dated': '2026-05-01', 'helps': ['living-figures', 'print']},
        {'op': 'add_part', 'id': 'printed-gear', 'name': 'Printed gear', 'tracks': ['printed-machines'], 'track': 'printed-machines',
         'claim': 'gears print', 'source': url, 'dated': '2026-05-01', 'helps': ['printed-machines']},
        {'op': 'add_edge', 'from': 'printed-joint-sensor', 'to': 'assistive-joint', 'via': 'life-extension', 'track': 'printed-machines',
         'claim': 'the same sensor reads a prosthetic knee', 'helps': ['life-extension']},
        {'op': 'touch', 'track': orphan, 'part': 'export', 'claim': 'its pages export'},
        {'op': 'add_track', 'id': 'everyday-lists', 'name': 'Everyday lists', 'lens': 'lists people keep', 'from': 'miss: add milk',
         'part': 'summon', 'claim': 'no track for lists yet'},
    ]}
    kept = apply_changes(m2, t2, led, answer, {url}, '2026-10-03', 1, files)
    ids = {n['id']: n for n in m2['nodes']}
    ok(ids['soft-actuator']['status'] == 'hypothesis', 'a source the search never returned does not establish')
    ok(ids['printed-actuator-joint']['status'] == 'established', 'a searched, dated source establishes')
    ok('printed-gear' not in ids, 'a new part that helps no other track or stage is dropped')
    ok(any(e['from'] == 'printed-joint-sensor' and e['status'] == 'hypothesis' for e in m2['edges']), 'an unsourced edge lands as hypothesis')
    ok(orphan in ids['export']['tracks'], 'a track not on the map joins the row it touches')
    ok('everyday-lists' in ids['summon']['tracks'] and 'Lens: lists people keep' in files.get('everyday-lists', ''),
       'a miss that fits no file gets a track file and a map row in the same cycle')
    ok(len(kept) == 4, f'four changes kept (got {len(kept)})')
    led['findings'] = kept
    errs = check(m2, led, t2, '2026-10-03')
    ok(not errs, 'the map after a cycle passes the check: ' + '; '.join(errs[:5]))
    ok(load_map(render_map(m2))['nodes'] == m2['nodes'], 'the map round-trips through markdown')
    board = growth_lines(kept)
    ok(len(board) == 1 and url in board[0], 'only an established finding that reaches a Void stage goes on the growth board')

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
            where = 'on the map' if v['id'] in touched else (f"placed: {led['placed'][v['id']]}" if v['id'] in led['placed'] else 'not on the map yet')
            print(f"{v['kind']:10} {v['id']:36} {where:20} {v['name'][:60]}")
        print(f'{len(tracks)} tracks')
        return 0
    if cmd == 'plan':
        p = plan(load_map(), load_tracks(), load_ledger())
        print(f"{len(p['tracks'])} tracks, read in one call")
        print(f"blocked stages: {', '.join(p['blocked'])}")
        print(f"hypothesis parts: {len(p['hypotheses'])}")
        print(f"tracks not on the map yet ({len(p['unjoined'])}): {', '.join(p['unjoined'])}")
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
    if cmd == 'cycle':
        cycle()
        return 0
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main())
