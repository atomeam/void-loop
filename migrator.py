"""Migration engine: rule-driven, dry-run and backup aware."""
from __future__ import annotations

import difflib
import shutil
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

from evaluator import CATEGORY_LICENSE, CATEGORY_SOURCE, Evaluation
from scanner import ScannedFile
from utils import ensure_dir

_LICENSE_NAMES = frozenset({"license", "licence", "copying", "notice"})


@dataclass
class MigrationResult:
    migration: str
    file: ScannedFile
    status: str  # "applied" | "dry-run" | "skipped" | "failed"
    details: str = ""
    backup_path: Path | None = None
    diff: str = ""


class Migration(ABC):
    """Interface for a single rule-driven transformation."""

    name: str

    @abstractmethod
    def matches(self, evaluation: Evaluation) -> bool:
        """True when this migration might apply to the evaluated asset."""

    @abstractmethod
    def plan(self, evaluation: Evaluation) -> tuple[bool, str]:
        """Return (should_apply, human-readable description)."""

    @abstractmethod
    def apply(self, evaluation: Evaluation, backup_dir: Path | None) -> MigrationResult:
        """Perform the transformation; never called in dry-run mode."""

    @staticmethod
    def _backup(src: Path, backup_dir: Path | None) -> Path | None:
        if backup_dir is None:
            return None
        ensure_dir(backup_dir)
        dst = backup_dir / src.name
        shutil.copy2(src, dst)
        return dst


class LicenseNormalizeMigration(Migration):
    """Rename LICENSE.txt / LICENCE / COPYING ... to a canonical LICENSE."""

    name = "normalize-license-filename"

    def matches(self, evaluation: Evaluation) -> bool:
        return evaluation.category == CATEGORY_LICENSE

    def plan(self, evaluation: Evaluation) -> tuple[bool, str]:
        path = evaluation.file.path
        name = path.name
        if name == "LICENSE":
            return False, "already canonical"
        if path.stem.lower() not in _LICENSE_NAMES:
            return False, "not a license-named file"
        target = path.parent / "LICENSE"
        if target.exists():
            return False, "target LICENSE already exists"
        return True, f"rename {name} -> LICENSE"

    def apply(self, evaluation: Evaluation, backup_dir: Path | None) -> MigrationResult:
        path = evaluation.file.path
        target = path.parent / "LICENSE"
        backup = self._backup(path, backup_dir)
        try:
            path.rename(target)
        except OSError as exc:
            return MigrationResult(self.name, evaluation.file, "failed", str(exc), backup)
        return MigrationResult(self.name, evaluation.file, "applied", "renamed to LICENSE", backup)


class ImportRewriteMigration(Migration):
    """Rewrite stdlib imports that moved between Python versions."""

    name = "rewrite-deprecated-imports"

    _REWRITES: dict[str, str] = {
        "from collections import Mapping": "from collections.abc import Mapping",
        "from collections import MutableMapping": "from collections.abc import MutableMapping",
        "from collections import Sequence": "from collections.abc import Sequence",
        "from collections import Iterator": "from collections.abc import Iterator",
    }

    def matches(self, evaluation: Evaluation) -> bool:
        return evaluation.category == CATEGORY_SOURCE and evaluation.file.path.suffix == ".py"

    def plan(self, evaluation: Evaluation) -> tuple[bool, str]:
        try:
            content = evaluation.file.path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            return False, "unreadable"
        matched = [old for old in self._REWRITES if old in content]
        if not matched:
            return False, "no deprecated imports found"
        return True, "replace " + "; ".join(f"'{old}'" for old in matched)

    def apply(self, evaluation: Evaluation, backup_dir: Path | None) -> MigrationResult:
        path = evaluation.file.path
        backup = self._backup(path, backup_dir)
        try:
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            return MigrationResult(self.name, evaluation.file, "failed", str(exc), backup)

        new_content = content
        for old, new in self._REWRITES.items():
            new_content = new_content.replace(old, new)
        if new_content == content:
            return MigrationResult(self.name, evaluation.file, "skipped", "no textual change", backup)

        try:
            path.write_text(new_content, encoding="utf-8")
        except OSError as exc:
            return MigrationResult(self.name, evaluation.file, "failed", str(exc), backup)

        diff = "".join(
            difflib.unified_diff(
                content.splitlines(keepends=True),
                new_content.splitlines(keepends=True),
                fromfile=f"{path.name} (before)",
                tofile=f"{path.name} (after)",
            )
        )
        return MigrationResult(self.name, evaluation.file, "applied", "rewrote deprecated imports", backup, diff)


class Migrator:
    """Runs a list of migrations over classified assets."""

    def __init__(self, migrations: list[Migration] | None = None) -> None:
        self.migrations = migrations or [LicenseNormalizeMigration(), ImportRewriteMigration()]

    def run(
        self,
        evaluations: list[Evaluation],
        dry_run: bool = True,
        backup_dir: Path | None = None,
    ) -> list[MigrationResult]:
        results: list[MigrationResult] = []
        for evaluation in evaluations:
            for migration in self.migrations:
                if not migration.matches(evaluation):
                    continue
                should, description = migration.plan(evaluation)
                if not should:
                    continue
                if dry_run:
                    results.append(MigrationResult(migration.name, evaluation.file, "dry-run", description))
                else:
                    results.append(migration.apply(evaluation, backup_dir))
        return results
