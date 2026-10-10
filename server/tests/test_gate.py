import json

import pytest

from app.gate import SHARED_DIR, evaluate

CASES = json.loads((SHARED_DIR / "gate_test_cases.json").read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["caseId"] for c in CASES])
def test_gate_case(case):
    result = evaluate(case["answers"])
    assert result["verdict"] == case["expectedVerdict"]
    if "mustNotBe" in case:
        assert result["verdict"] != case["mustNotBe"]
