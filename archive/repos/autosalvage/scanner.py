"""Repository traversal and file discovery."""
from __future__ import annotations

import fnmatch
import os
from dataclasses import dataclass
from pathlib import Path

from utils import sha256

DEFAULT_EXCLUDE_DIRS: tuple[str, ...] = (
    ".git",
    ".hg",
    ".svn",
    ".autosalvage",
    "__pycache__",
    ".venv",
    "venv",
    "node_modules",
)

DEFAULT_INCLUDE_GLOBS: tuple[str, ...] = ("*",)


@dataclass(frozen=True)
class ScanOptions:
    include_globs: tuple[str, ...] = DEFAULT_INCLUDE_GLOBS
    exclude_globs: tuple[str, ...] = ()
    exclude_dirs: tuple[str, ...] = DEFAULT_EXCLUDE_DIRS
    max_depth: int | None = None
    follow_symlinks: bool = False
    compute_checksum: bool = True


@dataclass(frozen=True)
class ScannedFile:
    path: Path
    rel_path: str
    size: int
    mtime_ns: int
    checksum: str | None


def _is_excluded_dir(name: str, excludes: tuple[str, ...]) -> bool:
    return any(name == pat or fnmatch.fnmatch(name, pat) for pat in excludes)


def _matches(path: Path, options: ScanOptions) -> bool:
    rel = path.as_posix()
    if any(fnmatch.fnmatch(rel, pat) or fnmatch.fnmatch(path.name, pat) for pat in options.exclude_globs):
        return False
    return any(
        fnmatch.fnmatch(rel, pat) or fnmatch.fnmatch(path.name, pat)
        for pat in options.include_globs
    )


def scan(root: Path, options: ScanOptions | None = None) -> list[ScannedFile]:
    """Walk ``root`` and return discovered files sorted by relative path."""
    options = options or ScanOptions()
    root = root.resolve()
    base_depth = len(root.parts)
    found: list[ScannedFile] = []

    for dirpath, dirnames, filenames in os.walk(root, topdown=True, followlinks=options.follow_symlinks):
        current = Path(dirpath)
        depth = len(current.parts) - base_depth
        if options.max_depth is not None and depth > options.max_depth:
            dirnames[:] = []
            continue
        dirnames[:] = [d for d in dirnames if not _is_excluded_dir(d, options.exclude_dirs)]
        for name in filenames:
            path = current / name
            if not _matches(path, options):
                continue
            try:
                stat = path.stat()
            except OSError:
                continue
            checksum = sha256(path) if options.compute_checksum else None
            found.append(
                ScannedFile(
                    path=path,
                    rel_path=str(path.relative_to(root)).replace("\\", "/"),
                    size=stat.st_size,
                    mtime_ns=stat.st_mtime_ns,
                    checksum=checksum,
                )
            )

    found.sort(key=lambda f: f.rel_path)
    return found
