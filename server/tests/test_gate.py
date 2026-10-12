import json

import pytest

from app.gate import QUESTIONS, SHARED_DIR, evaluate

CASES = json.loads((SHARED_DIR / "gate_test_cases.json").read_text(encoding="utf-8"))["cases"]
REQUIRED = [q for q in QUESTIONS if q["required"]]


def _all_clear():
    """Every required safety question answered with a non-danger value."""
    return [
        {
            "questionId": q["questionId"],
            "type": q["type"],
            "value": False if q["type"] == "yesno" else "normal",
            "state": "answered",
        }
        for q in REQUIRED
    ]


@pytest.mark.parametrize("case", CASES, ids=[c["caseId"] for c in CASES])
def test_gate_case(case):
    result = evaluate(case["answers"])
    assert result["verdict"] == case["expectedVerdict"]
    assert result == case["expectedOutput"]
    if "mustNotBe" in case:
        assert result["verdict"] != case["mustNotBe"]


def test_danger_cases_come_first():
    verdicts = [c["expectedVerdict"] for c in CASES]
    first_other = next(i for i, v in enumerate(verdicts) if v != "RED_FLAG")
    assert "RED_FLAG" not in verdicts[first_other:]


def test_all_clear_baseline_is_safe():
    assert evaluate(_all_clear()) == {"verdict": "SAFE", "firedRules": []}


@pytest.mark.parametrize("question", REQUIRED, ids=[q["questionId"] for q in REQUIRED])
def test_not_sure_is_never_safe(question):
    qid = question["questionId"]
    for clarified, expected in ((False, "CLARIFY"), (True, "RED_FLAG")):
        answers = [a for a in _all_clear() if a["questionId"] != qid]
        unknown = {"questionId": qid, "type": question["type"], "value": None, "state": "unknown"}
        if clarified:
            unknown["clarificationAttempted"] = True
        result = evaluate(answers + [unknown])
        assert result["verdict"] == expected
        assert result["firedRules"][-1]["ruleId"] == f"U_{qid}"


@pytest.mark.parametrize("question", REQUIRED, ids=[q["questionId"] for q in REQUIRED])
def test_missing_required_answer_is_never_safe(question):
    qid = question["questionId"]
    result = evaluate([a for a in _all_clear() if a["questionId"] != qid])
    assert result["verdict"] == "CLARIFY"
    assert [r["ruleId"] for r in result["firedRules"]] == [f"M_{qid}"]


@pytest.mark.parametrize(
    "bad_input",
    [None, "chest", 42, {}, {"questionId": "chest"}, [None], ["chest"], [[]], [{"questionId": ["chest"]}]],
    ids=repr,
)
def test_malformed_input_is_red_flag_not_a_crash(bad_input):
    result = evaluate(bad_input)
    assert result["verdict"] == "RED_FLAG"
    assert [r["ruleId"] for r in result["firedRules"]] == ["INPUT_INVALID"]


def test_one_is_not_true():
    answers = _all_clear()
    answers[0]["value"] = 1
    assert evaluate(answers)["firedRules"][0]["ruleId"] == "INPUT_INVALID"


def test_evaluate_does_not_change_its_input():
    answers = _all_clear()
    before = json.dumps(answers)
    evaluate(answers)
    assert json.dumps(answers) == before
