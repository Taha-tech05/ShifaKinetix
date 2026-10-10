import json

import pytest

from app.gate import SHARED_DIR

LABEL = "draft, awaiting clinician review"


def _items(filename, key):
    data = json.loads((SHARED_DIR / filename).read_text(encoding="utf-8"))
    return data[key]


ITEMS = (
    [("gate_rules.json", i) for i in _items("gate_rules.json", "rules")]
    + [("questions_shoulder.json", i) for i in _items("questions_shoulder.json", "questions")]
    + [("gate_test_cases.json", i) for i in _items("gate_test_cases.json", "cases")]
)


@pytest.mark.parametrize("filename,item", ITEMS)
def test_item_has_source_and_label(filename, item):
    assert str(item.get("source", "")).strip(), f"{filename}: missing source"
    assert item.get("label") == LABEL, f"{filename}: missing label '{LABEL}'"
