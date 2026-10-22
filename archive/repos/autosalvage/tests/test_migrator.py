from pathlib import Path

from evaluator import Evaluator
from migrator import Migrator
from scanner import scan


def _evaluations(root: Path):
    files = scan(root)
    return Evaluator().evaluate_all(files)


def test_import_rewrite_dry_run_does_not_modify(tmp_path: Path) -> None:
    src = tmp_path / "legacy.py"
    src.write_text("from collections import Mapping\nx = Mapping\n", encoding="utf-8")

    results = Migrator().run(_evaluations(tmp_path), dry_run=True)

    assert results and results[0].status == "dry-run"
    assert src.read_text(encoding="utf-8") == "from collections import Mapping\nx = Mapping\n"


def test_import_rewrite_applies_and_backs_up(tmp_path: Path) -> None:
    src = tmp_path / "legacy.py"
    src.write_text("from collections import Mapping\n", encoding="utf-8")
    backup_dir = tmp_path / "backups"

    results = Migrator().run(_evaluations(tmp_path), dry_run=False, backup_dir=backup_dir)

    applied = [r for r in results if r.status == "applied"]
    assert applied
    assert "collections.abc" in src.read_text(encoding="utf-8")
    assert "---" in applied[0].diff
    assert (backup_dir / "legacy.py").exists()


def test_license_normalize_applies(tmp_path: Path) -> None:
    lic = tmp_path / "LICENSE.txt"
    lic.write_text("MIT\n", encoding="utf-8")
    backup_dir = tmp_path / "backups"

    results = Migrator().run(_evaluations(tmp_path), dry_run=False, backup_dir=backup_dir)

    applied = [r for r in results if r.status == "applied"]
    assert any(r.migration == "normalize-license-filename" for r in applied)
    assert (tmp_path / "LICENSE").exists()
    assert not lic.exists()


def test_migration_skipped_when_nothing_to_do(tmp_path: Path) -> None:
    (tmp_path / "clean.py").write_text("import os\n", encoding="utf-8")

    results = Migrator().run(_evaluations(tmp_path), dry_run=False)

    assert all(r.status == "skipped" for r in results if r.migration == "rewrite-deprecated-imports")
