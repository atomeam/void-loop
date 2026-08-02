from pathlib import Path

from evaluator import CATEGORY_LICENSE, CATEGORY_SOURCE, CATEGORY_UNKNOWN, Evaluator
from scanner import ScannedFile


def _file(path: Path, name: str) -> ScannedFile:
    p = path / name
    p.write_text("x\n", encoding="utf-8")
    return ScannedFile(path=p, rel_path=name, size=2, mtime_ns=0, checksum=None)


def test_license_file_classified(tmp_path: Path) -> None:
    evaluation = Evaluator().evaluate(_file(tmp_path, "LICENSE.txt"))
    assert evaluation.category == CATEGORY_LICENSE
    assert evaluation.source == "heuristic"
    assert evaluation.confidence >= 0.9


def test_source_file_classified(tmp_path: Path) -> None:
    evaluation = Evaluator().evaluate(_file(tmp_path, "app.py"))
    assert evaluation.category == CATEGORY_SOURCE


def test_binary_detected_by_null_byte(tmp_path: Path) -> None:
    p = tmp_path / "blob.xyz"
    p.write_bytes(b"\x00\x01\x02")
    file = ScannedFile(path=p, rel_path="blob.xyz", size=3, mtime_ns=0, checksum=None)
    assert Evaluator().evaluate(file).category == "binary"


def test_unknown_classification(tmp_path: Path) -> None:
    evaluation = Evaluator().evaluate(_file(tmp_path, "weird.xyz"))
    assert evaluation.category == CATEGORY_UNKNOWN


def test_evaluate_all_returns_all(tmp_path: Path) -> None:
    for name in ("a.py", "LICENSE", "b.txt"):
        _file(tmp_path, name)
    from scanner import scan

    files = scan(tmp_path)
    evaluations = Evaluator().evaluate_all(files)
    assert len(evaluations) == 3
