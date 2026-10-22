# autosalvage

Scan, classify, and migrate legacy repositories safely. Pipeline:
`scan -> evaluate -> migrate`, with every step recorded to SQLite telemetry.

## Layout

- `autosalvage.py` — orchestrator (`run(Config) -> RunReport`)
- `cli.py` — argparse CLI
- `scanner.py` — repo traversal and file discovery (`ScannedFile`)
- `evaluator.py` — asset classification: rule-based heuristics + pluggable ML adapter
- `migrator.py` — dry-run/backup-aware migration engine
- `telemetry.py` — SQLite event sequence + dead-letter queue (DLQ)
- `models/` — ML `ModelAdapter` stub (swap in a real classifier later)

## Requirements

- Python >= 3.10, standard library only at runtime
- `pytest` for tests (`pip install -r requirements.txt`)

## Usage

Dry-run (default, never modifies files):

```bash
python cli.py --path /path/to/repo --verbose
```

Apply migrations with backups:

```bash
python cli.py --path /path/to/repo --apply --backup
```

JSON config file (CLI flags win over file values):

```json
{ "path": "/path/to/repo", "dry_run": true, "backup": false, "state_dir": ".autosalvage" }
```

```bash
python cli.py --config config.json
```

## Safety model

- Dry-run is the default; `--apply` is explicit.
- Backups are copied under `.autosalvage/backups/<timestamp>/` before applying.
- Every session emits ordered events (`session.start`, `scan.complete`, ...)
  to `.autosalvage/telemetry.db`; failures go to the `dlq` table.

## Telemetry schema

- `events(id, timestamp, session_id, step, status, payload)` — ordered sequence per session
- `dlq(id, payload, error, created_at)` — failed operations

## Adding migrations

Subclass `migrator.Migration` (implement `matches`, `plan`, `apply`), then
register the instance in `Migrator.__init__`. Example built-ins:

- `LicenseNormalizeMigration` — rename `LICENSE.txt` / `LICENCE` / `COPYING` -> `LICENSE`
- `ImportRewriteMigration` — rewrite `from collections import ...` -> `collections.abc`

## ML

`models.ModelAdapter` is a stub that always signals "no model", so the evaluator
uses heuristics. To plug in a real classifier, implement `load`/`predict` and
pass `--model <path>`.

## Tests

```bash
pytest -q
```
