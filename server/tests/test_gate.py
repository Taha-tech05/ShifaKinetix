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
    # Contract v1.1: uncertainty that persists after the clarification stays CLARIFY. It is never SAFE.
    for clarified, expected in ((False, "CLARIFY"), (True, "CLARIFY")):
        answers = [a for a in _all_clear() if a["questionId"] != qid]
        unknown = {"questionId": qid, "type": question["type"], "value": None, "state": "unknown"}
        if clarified:
            unknown["clarificationAttempted"] = True
        result = evaluate(answers + [unknown])
        assert result["verdict"] == expected
        assert result["firedRules"][-1]["ruleId"] == f"U_{qid}"
        assert result["firedRules"][-1]["reason"].startswith("Uncertainty persists" if clarified else "Safety answer is uncertain")


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


def test_conditional_question_is_required_only_when_its_trigger_is_answered_yes():
    """Contract v1.2: redness = yes makes infection_risk required."""

    def with_redness(value, *extra):
        answers = [a for a in _all_clear() if a["questionId"] != "redness"]
        if value is None:
            answers.append({"questionId": "redness", "type": "yesno", "value": None, "state": "unknown"})
        else:
            answers.append({"questionId": "redness", "type": "yesno", "value": value, "state": "answered"})
        return answers + list(extra)

    def risk(value, **more):
        state = "unknown" if value is None else "answered"
        return {"questionId": "infection_risk", "type": "yesno", "value": value, "state": state, **more}

    def ids(result):
        return [rule["ruleId"] for rule in result["firedRules"]]

    assert evaluate(with_redness(False)) == {"verdict": "SAFE", "firedRules": []}
    assert evaluate(with_redness(False, risk(None))) == {"verdict": "SAFE", "firedRules": []}
    assert ids(evaluate(with_redness(None))) == ["U_redness"], "an unknown trigger does not add the requirement"
    for answers, verdict, expected in (
        (with_redness(True), "CLARIFY", ["M_infection_risk"]),
        (with_redness(True, risk(None)), "CLARIFY", ["U_infection_risk"]),
        (with_redness(True, risk(None, clarificationAttempted=True)), "CLARIFY", ["U_infection_risk"]),
        (with_redness(True, risk(False)), "SAFE", []),
        (with_redness(True, risk(True)), "RED_FLAG", ["R_local_infection_risk"]),
    ):
        result = evaluate(answers)
        assert (result["verdict"], ids(result)) == (verdict, expected)


def test_one_is_not_true():
    answers = _all_clear()
    answers[0]["value"] = 1
    assert evaluate(answers)["firedRules"][0]["ruleId"] == "INPUT_INVALID"


def test_evaluate_does_not_change_its_input():
    answers = _all_clear()
    before = json.dumps(answers)
    evaluate(answers)
    assert json.dumps(answers) == before
