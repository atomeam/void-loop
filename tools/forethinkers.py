"""The Forethinkers cycle: one shared part or blocked Void stage per cycle, fanned into every track it touches.

Read domains/forethinkers/brief.md first. The map is domains/forethinkers/convergence.md; kept findings and every run
(dead ones too) are in domains/forethinkers/findings.json.

  python tools/forethinkers.py check       labels and findings hold to the brief (CI runs this; exit 1 on any break)
  python tools/forethinkers.py selftest    gate across the DST change, label rules, the convergence filter (no network)
  python tools/forethinkers.py gate [--at ISO]   prints run / skip: even ET hours run, odd hours skip
  python tools/forethinkers.py plan        prints the unit this cycle would take, its tracks and the model calls
  python tools/forethinkers.py cycle       runs one cycle (needs ANTHROPIC_API_KEY and `pip install anthropic`)

Env: ACTIVE_TRACKS (comma list, default "printing"), MAX_SEARCHES (per worker, default 3), UNIT (force a row id),
FORETHINKERS_MODEL (default claude-opus-5-5), FORETHINKERS_EFFORT (default medium).
"""
import json
import os
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / 'domains' / 'forethinkers'
MAP = DIR / 'convergence.md'
LEDGER = DIR / 'findings.json'
TRACKS = ['printing', 'figures', 'longevity', 'restoration']
STAGES = ['summon', 'spin', 'export', 'print']
ET = ZoneInfo('America/New_York')
NODE_COLS = ['id', 'kind', 'name', 'tracks', 'stages', 'status', 'source', 'dated', 'checked']
EDGE_COLS = ['from', 'to', 'via', 'status', 'source', 'dated']
DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
URL = re.compile(r'^https?://\S+$')
ID = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
TRACK_LENS = {
    'printing': 'printed machines: actuators, joints, sensors, materials, and how they are printed',
    'figures': 'living figures: why a person wants this body, what they would buy, original characters only',
    'longevity': 'life extension: the same parts in assistive or prosthetic motion for people',
    'restoration': 'planet restoration: the same parts in field robots that restore land, water or air',
}


# ---------- the map ----------

def split_list(s):
    return [x.strip() for x in s.split(',') if x.strip()]


def read_table(lines, heading):
    start = lines.index(heading)
    i = start + 1
    while not lines[i].startswith('|'):
        i += 1
    head = [c.strip() for c in lines[i].strip().strip('|').split('|')]
    rows, j = [], i + 2
    while j < len(lines) and lines[j].startswith('|'):
        cells = [c.strip() for c in lines[j].strip().strip('|').split('|')]
        rows.append(dict(zip(head, cells)))
        j += 1
    return head, rows, i, j


def load_map(text=None):
    text = MAP.read_text(encoding='utf-8') if text is None else text
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
        body = []
        for r in rows:
            cells = [', '.join(r[c]) if isinstance(r.get(c), list) else str(r.get(c, '')) for c in cols]
            body.append('| ' + ' | '.join(cells) + ' |')
        lines[i + 2:j] = body
    return '\n'.join(lines)


def load_ledger():
    return json.loads(LEDGER.read_text(encoding='utf-8'))


def edge_id(e):
    return e['from'] + '>' + e['to']


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


def check(m=None, ledger=None, today=None):
    m = m or load_map()
    ledger = ledger if ledger is not None else load_ledger()
    today = today or date.today().isoformat()
    errs = []
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
        bad = [t for t in n['tracks'] if t not in TRACKS]
        if bad or not n['tracks']:
            errs.append(f'{where}: tracks must be one or more of {TRACKS} (got {n["tracks"]})')
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
    seen = set()
    for e in m['edges']:
        where = f'edge {edge_id(e)}'
        for end in ('from', 'to'):
            if e.get(end) not in ids:
                errs.append(f'{where}: {end} "{e.get(end)}" is not a node')
        if e.get('via') not in TRACKS:
            errs.append(f'{where}: via must be a track')
        if edge_id(e) in seen:
            errs.append(f'{where}: repeated edge')
        seen.add(edge_id(e))
        errs += label_errors(where, e.get('status'), e.get('source'), e.get('dated'), today)
    for k, f in enumerate(ledger.get('findings', [])):
        errs += finding_errors(f, ids, f'finding {k + 1}', today)
    for k, r in enumerate(ledger.get('runs', [])):
        if r.get('result') not in ('changed', 'dead'):
            errs.append(f'run {k + 1}: result must be changed or dead')
        if r.get('unit') not in ids:
            errs.append(f'run {k + 1}: unit "{r.get("unit")}" is not a node')
    return errs


def finding_errors(f, ids, where, today):
    errs = []
    if f.get('unit') not in ids:
        errs.append(f'{where}: unit "{f.get("unit")}" is not on the map')
    if f.get('track') not in TRACKS:
        errs.append(f'{where}: track must be one of {TRACKS}')
    if not f.get('claim'):
        errs.append(f'{where}: no claim')
    if not f.get('part') or f.get('part') not in ids:
        errs.append(f'{where}: names no part on the map')
    helps = f.get('helps') or []
    if not any((h in TRACKS and h != f.get('track')) or h in STAGES for h in helps):
        errs.append(f'{where}: dead run: helps no other track and no product stage')
    if f.get('effect') not in ('map', 'unblocks'):
        errs.append(f'{where}: effect must be map (changed the map) or unblocks (a stage)')
    if f.get('effect') == 'unblocks' and f.get('stage') not in STAGES:
        errs.append(f'{where}: unblocks names no stage')
    errs += label_errors(where, f.get('type'), f.get('source'), f.get('dated'), today)
    return errs


# ---------- schedule gate ----------

def gate(at=None):
    at = at or datetime.now(timezone.utc)
    return 'run' if at.astimezone(ET).hour % 2 == 0 else 'skip'


# ---------- choosing the unit ----------

def active_tracks():
    act = split_list(os.environ.get('ACTIVE_TRACKS', 'printing'))
    bad = [t for t in act if t not in TRACKS]
    if bad:
        sys.exit(f'ACTIVE_TRACKS has unknown tracks {bad}; use {TRACKS}')
    return act


def plan(m, ledger, active, force=None, slot=0):
    """One part or one blocked stage, and the active tracks it touches. The pool is ordered blocked stages, then
    hypothesis parts, then established parts (to grow their edges). A dead run writes nothing, so the map can't say what
    was tried last; the schedule slot (one per even ET hour) walks the pool instead, so cycles rotate."""
    def rank(n):
        return 0 if n['kind'] == 'stage' else (1 if n['status'] == 'hypothesis' else 2)
    pool = [n for n in m['nodes'] if not (n['kind'] == 'stage' and n['status'] == 'live')]
    if force:
        pool = [n for n in m['nodes'] if n['id'] == force]
        if not pool:
            sys.exit(f'UNIT "{force}" is not on the map')
    pool = [n for n in sorted(pool, key=rank) if any(t in active for t in n['tracks'])]
    if not pool:
        return None
    n = pool[slot % len(pool)]
    tracks = [t for t in n['tracks'] if t in active]
    return {'unit': n, 'tracks': tracks, 'calls': len(tracks) + 1}


def slot(at=None):
    at = at or datetime.now(timezone.utc)
    return int(at.timestamp()) // 7200


# ---------- the model ----------

FENCE = re.compile(r'```json\s*(.*?)```', re.S)


def parse_json(text):
    hits = FENCE.findall(text)
    raw = hits[-1] if hits else text[text.find('{'):text.rfind('}') + 1]
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None


def call(client, prompt, searches):
    """One model call. Returns (text, urls the web search actually returned)."""
    import anthropic
    model = os.environ.get('FORETHINKERS_MODEL', 'claude-opus-5-5')
    kw = dict(model=model, max_tokens=16000, betas=['server-side-fallback-2026-07-01'],
              extra_body={'fallbacks': 'default', 'output_config': {'effort': os.environ.get('FORETHINKERS_EFFORT', 'medium')}})
    if searches:
        kw['tools'] = [{'type': 'web_search_20260209', 'name': 'web_search', 'max_uses': searches}]
    messages = [{'role': 'user', 'content': prompt}]
    urls = set()
    for _ in range(4):
        try:
            r = client.beta.messages.create(messages=messages, **kw)
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


def map_brief(m):
    rows = [f"- {n['id']} ({n['kind']}, {n['status']}): {n['name']} | tracks {', '.join(n['tracks'])}"
            + (f" | stages {', '.join(n['stages'])}" if n['stages'] else '') for n in m['nodes']]
    rows += [f"- edge {edge_id(e)} via {e['via']} ({e['status']})" for e in m['edges']]
    return '\n'.join(rows)


def worker_prompt(m, unit, track, searches):
    brief = (DIR / 'brief.md').read_text(encoding='utf-8')
    return f"""{brief}

## The map now
{map_brief(m)}

## This cycle
Unit: {unit['id']} ({unit['kind']}): {unit['name']}
Your track: {track} ({TRACK_LENS[track]})

Search (at most {searches} searches) for what this unit means through your track. Only report what would change the map
(establish a hypothesis row, add a part, add an edge) or unblock a Void stage (export, print). A source must be a page
your search returned in this cycle, with the date shown on that page. If you find nothing like that, return no findings:
silence is the right answer, not a weak finding.

Answer with one JSON block:
```json
{{"findings": [{{"claim": "one sentence", "part": "<node id, or a new id>", "new_part": {{"name": "", "tracks": [], "stages": []}},
  "helps": ["<other tracks and/or stages>"], "source": "<url>", "dated": "YYYY-MM-DD"}}]}}
```
(new_part only when the part is not on the map yet.)"""


def convergence_prompt(m, unit, worker_out):
    return f"""You are the convergence pass of the Forethinkers (domains/forethinkers/brief.md). The cycle's unit is
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
  {{"op": "unblocks", "stage": "export|print", "part": "", "track": "", "claim": "", "source": "", "dated": "", "helps": []}}
], "note": "one plain sentence if this is a breakthrough, else empty"}}
```"""


def converge(m, unit, conv, seen_urls, today, run_id):
    """Apply the convergence pass to the map, holding every change to the labels. A source counts only if a worker's
    search returned it this cycle. Returns the kept findings; the map is changed in place."""
    nodes = {n['id']: n for n in m['nodes']}
    edges = {edge_id(e): e for e in m['edges']}
    kept = []
    for c in (conv or {}).get('changes', []):
        src, dated = c.get('source', ''), c.get('dated', '')
        sourced = src in seen_urls and bool(DATE.match(dated or '')) and dated <= today
        op = c.get('op')
        f = {'at': today, 'run': run_id, 'unit': unit['id'], 'track': c.get('track'), 'claim': c.get('claim', ''),
             'helps': c.get('helps') or [], 'type': 'established' if sourced else 'hypothesis',
             'source': src if sourced else '', 'dated': dated if sourced else '', 'effect': 'map'}
        if op == 'establish':
            target = nodes.get(c.get('id')) or edges.get(c.get('id'))
            if not sourced or not target or target.get('status') != 'hypothesis' or target.get('kind') == 'stage':
                continue
            f['part'] = c['id'] if c['id'] in nodes else target['to']
            if finding_errors(f, set(nodes), 'x', today):
                continue
            target.update(status='established', source=src, dated=dated)
        elif op == 'add_part':
            pid = c.get('id', '')
            tracks = [t for t in c.get('tracks', []) if t in TRACKS]
            if not ID.match(pid) or pid in nodes or not tracks or not c.get('name'):
                continue
            node = {'id': pid, 'kind': 'part', 'name': c['name'].replace('|', '/'), 'tracks': tracks,
                    'stages': [s for s in c.get('stages', []) if s in STAGES], 'status': f['type'],
                    'source': f['source'], 'dated': f['dated'], 'checked': ''}
            f['part'] = pid
            if finding_errors(f, set(nodes) | {pid}, 'x', today):
                continue
            m['nodes'].append(node)
            nodes[pid] = node
        elif op == 'add_edge':
            e = {'from': c.get('from'), 'to': c.get('to'), 'via': c.get('via'), 'status': f['type'],
                 'source': f['source'], 'dated': f['dated']}
            if e['from'] not in nodes or e['to'] not in nodes or e['via'] not in TRACKS or edge_id(e) in edges:
                continue
            f['part'] = e['from'] if nodes[e['from']]['kind'] == 'part' else e['to']
            if finding_errors(f, set(nodes), 'x', today):
                continue
            m['edges'].append(e)
            edges[edge_id(e)] = e
        elif op == 'unblocks':
            # a stage is unblocked by building, not by reading: the finding needs a real source and names the part
            stage = nodes.get(c.get('stage'))
            if not sourced or not stage or stage['kind'] != 'stage' or stage['status'] != 'blocked':
                continue
            f.update(effect='unblocks', stage=stage['id'], part=c.get('part'))
            if finding_errors(f, set(nodes), 'x', today):
                continue
        else:
            continue
        kept.append(f)
    return kept


def cycle():
    import anthropic
    m, ledger = load_map(), load_ledger()
    active = active_tracks()
    searches = max(1, min(int(os.environ.get('MAX_SEARCHES', '3')), 10))
    p = plan(m, ledger, active, os.environ.get('UNIT') or None, slot())
    if not p:
        print('no unit touches the active tracks; nothing to do')
        return out(changed=False)
    unit, today = p['unit'], date.today().isoformat()
    run_id = len(ledger['runs']) + 1
    client = anthropic.Anthropic()
    worker_out, seen = {}, set()
    for t in p['tracks']:
        text, urls = call(client, worker_prompt(m, unit, t, searches), searches)
        seen |= urls
        worker_out[t] = (parse_json(text) or {}).get('findings', [])
    conv = None
    if any(worker_out.values()):
        text, _ = call(client, convergence_prompt(m, unit, worker_out), 0)
        conv = parse_json(text)
    kept = converge(m, unit, conv, seen, today, run_id)
    for n in m['nodes']:
        if n['id'] == unit['id']:
            n['checked'] = today
    result = 'changed' if kept else 'dead'
    ledger['runs'].append({'run': run_id, 'at': today, 'unit': unit['id'], 'tracks': p['tracks'],
                           'calls': len(p['tracks']) + (1 if conv is not None else 0), 'max_searches': searches,
                           'result': result, 'kept': len(kept)})
    ledger['findings'] += kept
    errs = check(m, ledger, today)
    if errs:
        sys.exit('cycle produced a map that fails the check:\n' + '\n'.join(errs))
    note = ((conv or {}).get('note') or '').strip() if kept else ''
    summary = f"Forethinkers run {run_id}: unit {unit['id']}, tracks {', '.join(p['tracks'])}: {result}, {len(kept)} kept"
    print(summary)
    for f in kept:
        print(f"  [{f['type']}] {f['claim']} ({f['source'] or 'no source'})")
    if kept:
        # Silence is the default: only a cycle that changed something writes the map. Dead runs are logged in the job
        # summary, and in the ledger only when something else is written.
        MAP.write_text(render_map(m), encoding='utf-8')
        LEDGER.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    established = any(f['type'] == 'established' for f in kept)
    return out(changed=bool(kept), breakthrough=bool(note and established), note=note, summary=summary)


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

    m = load_map()
    ok(not check(m, {'findings': [], 'runs': []}), 'the committed map passes: ' + '; '.join(check(m, {'findings': [], 'runs': []})))
    est = [n for n in m['nodes'] if n['kind'] == 'part' and n['status'] == 'established']
    ok([n['id'] for n in est] == ['printed-linear-motor'], 'the MIT motor is the only established node')

    bad = load_map()
    soft = next(n for n in bad['nodes'] if n['id'] == 'soft-actuator')
    soft['source'] = 'https://example.org/soft'
    ok(any('hypothesis carries a source' in e for e in check(bad, {'findings': [], 'runs': []})), 'hypothesis with a source fails')
    soft.update(status='established', source='https://example.org/soft', dated='')
    ok(any('without a date' in e for e in check(bad, {'findings': [], 'runs': []})), 'established without a date fails')
    soft.update(dated='2099-01-01')
    ok(any('future' in e for e in check(bad, {'findings': [], 'runs': []})), 'a future date fails')

    dead = {'unit': 'soft-actuator', 'track': 'printing', 'claim': 'x', 'part': 'soft-actuator', 'helps': ['printing'],
            'type': 'hypothesis', 'source': '', 'dated': '', 'effect': 'map'}
    ok(any('dead run' in e for e in check(m, {'findings': [dead], 'runs': []})), 'a finding that helps only its own track is dead')

    # plan: printing only -> a blocked stage first, two calls (one worker + convergence)
    p = plan(m, {'runs': []}, ['printing'])
    ok(p and p['unit']['id'] == 'export' and p['calls'] == 2, f'printing-only plan takes export with 2 calls (got {p and p["unit"]["id"]})')
    p = plan(m, {'runs': []}, TRACKS, 'print')
    ok(p['calls'] == 5, 'print fans into all four tracks: 5 calls')
    units = {plan(m, {'runs': []}, ['printing'], None, k)['unit']['id'] for k in range(20)}
    ok({'export', 'print', 'printed-linear-motor'} <= units, f'slots rotate the unit (got {sorted(units)})')

    # convergence: a URL the search did not return is not a source; a sourced change lands; a dead one is dropped
    m2, unit = load_map(), next(n for n in load_map()['nodes'] if n['id'] == 'printed-actuator-joint')
    url = 'https://example.org/joint-2026'
    conv = {'changes': [
        {'op': 'establish', 'id': 'soft-actuator', 'track': 'printing', 'claim': 'from memory', 'source': 'https://nowhere.example/x',
         'dated': '2026-01-01', 'helps': ['figures']},
        {'op': 'establish', 'id': 'printed-actuator-joint', 'track': 'printing', 'claim': 'a printed joint moves a figure arm',
         'source': url, 'dated': '2026-05-01', 'helps': ['figures', 'print']},
        {'op': 'add_part', 'id': 'printed-gear', 'name': 'Printed gear', 'tracks': ['printing'], 'stages': [], 'track': 'printing',
         'claim': 'gears print', 'source': url, 'dated': '2026-05-01', 'helps': ['printing']},
        {'op': 'add_edge', 'from': 'printed-joint-sensor', 'to': 'assistive-joint', 'via': 'longevity', 'track': 'printing',
         'claim': 'the same sensor reads a prosthetic knee', 'helps': ['longevity']},
    ], 'note': ''}
    kept = converge(m2, unit, conv, {url}, '2026-10-03', 1)
    ids = {n['id']: n for n in m2['nodes']}
    ok(ids['soft-actuator']['status'] == 'hypothesis', 'a source the search never returned does not establish')
    ok(ids['printed-actuator-joint']['status'] == 'established', 'a searched, dated source establishes')
    ok('printed-gear' not in ids, 'a new part that helps no other track or stage is dropped')
    ok(any(e['from'] == 'printed-joint-sensor' and e['to'] == 'assistive-joint' and e['status'] == 'hypothesis'
           for e in m2['edges']), 'an unsourced edge lands as hypothesis')
    ok(len(kept) == 2, f'two changes kept (got {len(kept)})')
    ok(not check(m2, {'findings': kept, 'runs': [{'unit': 'printed-actuator-joint', 'result': 'changed'}]}, '2026-10-03'),
       'the map after convergence passes the check')
    ok(load_map(render_map(m2))['nodes'] == m2['nodes'], 'the map round-trips through markdown')

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
        p = plan(load_map(), load_ledger(), active_tracks(), os.environ.get('UNIT') or None, slot())
        if not p:
            print('no unit touches the active tracks')
            return 0
        print(f"unit {p['unit']['id']} ({p['unit']['kind']}, {p['unit']['status']}): {p['unit']['name']}")
        print(f"tracks {', '.join(p['tracks'])}; up to {p['calls']} model calls")
        return 0
    if cmd == 'cycle':
        cycle()
        return 0
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main())
