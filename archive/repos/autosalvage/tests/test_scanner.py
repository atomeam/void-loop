from pathlib import Path

from scanner import ScanOptions, scan


def test_scan_finds_files(tmp_path: Path) -> None:
    (tmp_path / "a.py").write_bytes(b"print('hi')\n")
    (tmp_path / "sub").mkdir()
    (tmp_path / "sub" / "b.txt").write_text("hello\n", encoding="utf-8")

    found = scan(tmp_path)

    assert [f.rel_path for f in found] == ["a.py", "sub/b.txt"]
    assert found[0].size == 12
    assert found[0].checksum is not None


def test_scan_excludes_dot_dirs(tmp_path: Path) -> None:
    (tmp_path / ".git").mkdir()
    (tmp_path / ".venv").mkdir()
    (tmp_path / "keep.py").write_text("x = 1\n", encoding="utf-8")

    found = scan(tmp_path)

    assert [f.rel_path for f in found] == ["keep.py"]


def test_scan_exclude_globs(tmp_path: Path) -> None:
    (tmp_path / "main.py").write_text("x = 1\n", encoding="utf-8")
    (tmp_path / "vendor.min.js").write_text("var x = 1;\n", encoding="utf-8")

    found = scan(tmp_path, ScanOptions(exclude_globs=("*.min.js",)))

    assert [f.rel_path for f in found] == ["main.py"]


def test_scan_respects_max_depth(tmp_path: Path) -> None:
    (tmp_path / "one").mkdir()
    (tmp_path / "one" / "two").mkdir()
    (tmp_path / "one" / "two" / "deep.txt").write_text("d\n", encoding="utf-8")
    (tmp_path / "one" / "shallow.txt").write_text("s\n", encoding="utf-8")

    found = scan(tmp_path, ScanOptions(max_depth=1))

    assert [f.rel_path for f in found] == ["one/shallow.txt"]
