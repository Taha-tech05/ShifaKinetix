"""Live app-signal gate: shared fixtures plus server-only edge cases. Synthetic cases only."""

import json

import pytest

from app.gate import QUESTIONS, SHARED_DIR, evaluate
from app.session_gate import (
    ALIASES,
    evaluate_session_gate,
    safety_answers_from,
    with_movement_uncertainty,
)

DOCUMENT = json.loads((SHARED_DIR / "app_signal_test_cases.json").read_text(encoding="utf-8"))
CASES = DOCUMENT["cases"]
REQUIRED = [q for q in QUESTIONS if q["required"]]
LABEL = "draft, awaiting clinician review"


def canon(**changed):
    return [
        {"questionId": q["questionId"], "type": q["type"], "state": "answered",
         "value": changed.get(q["questionId"], False if q["type"] == "yesno" else "normal")}
        for q in REQUIRED
    ]


def app(question_id, value):
    return {"questionId": question_id, "type": "yesno", "value": value, "state": "unknown" if value is None else "answered"}


@pytest.mark.parametrize("case", CASES, ids=[c["caseId"] for c in CASES])
def test_shared_app_signal_case(case):
    result = evaluate_session_gate(case["answers"], case["movements"])
    assert result["verdict"] == case["expectedVerdict"]
    assert [rule["ruleId"] for rule in result["firedRules"]] == case["expectedRuleIds"]
    if "mustNotBe" in case:
        assert result["verdict"] != case["mustNotBe"]


def test_fixture_file_is_draft_sourced_and_danger_first():
    assert DOCUMENT["label"] == LABEL
    verdicts = [c["expectedVerdict"] for c in CASES]
    assert verdicts == sorted(verdicts, key=["RED_FLAG", "CLARIFY", "SAFE"].index)
    for case in CASES:
        assert case["source"].strip() and case["label"] == LABEL
    assert "validated" not in json.dumps(DOCUMENT).lower().replace("clinical validation", "")


def test_without_app_answers_it_is_exactly_the_canonical_gate():
    for answers in (canon(), canon(chest=True), canon()[:5], [], canon() + canon()):
        assert evaluate_session_gate(answers) == evaluate(answers)


@pytest.mark.parametrize("signal", sorted(ALIASES))
def test_not_sure_on_any_app_signal_is_never_safe_and_never_becomes_no(signal):
    merged = safety_answers_from(canon() + [app(signal, None)])
    for target in ALIASES[signal]:
        record = next(a for a in merged if a["questionId"] == target)
        assert record["state"] == "unknown" and record["value"] is None
    assert evaluate_session_gate(canon() + [app(signal, None)])["verdict"] == "CLARIFY"


@pytest.mark.parametrize("signal", sorted(ALIASES))
def test_negative_app_signal_changes_nothing(signal):
    assert safety_answers_from(canon() + [app(signal, False)]) == canon()
    assert evaluate_session_gate(canon(fever=True) + [app(signal, False)]) == evaluate(canon(fever=True))


def test_app_review_rules_carry_source_and_draft_wording():
    rule = evaluate_session_gate(canon() + [app("Q_ST_NUMB", True)])["firedRules"][0]
    assert rule == {
        "ruleId": "APP_REVIEW_Q_ST_NUMB",
        "matchedAnswers": ["Q_ST_NUMB"],
        "source": "https://www.nhs.uk/symptoms/shoulder-pain/",
        "reason": "draft, awaiting clinician review: a new app safety signal requires clinical review before continuing.",
    }


def test_weak_movement_does_not_invent_a_numbness_answer():
    weak = [{"movementId": "M1", "painful": False, "weak": True, "unableToDo": False, "measuredAngle": None, "state": "done"}]
    assert with_movement_uncertainty(canon(), weak) == canon()
    assert evaluate_session_gate(canon(), weak) == {"verdict": "SAFE", "firedRules": []}


@pytest.mark.parametrize("state", ["skipped", "unknown", "", None, "pending"])
def test_any_unfinished_movement_restores_uncertainty(state):
    movement = {"movementId": "M1", "painful": False, "weak": False, "unableToDo": False, "measuredAngle": None, "state": state}
    result = evaluate_session_gate(canon(), [movement])
    assert result["verdict"] == "CLARIFY"
    assert [rule["ruleId"] for rule in result["firedRules"]] == ["U_unable", "U_numb"]


@pytest.mark.parametrize(
    "answers,movements",
    [
        (None, []), ("x", []), ([None], []), ([{"type": "yesno"}], []), ([{"questionId": 5}], []),
        (canon(), "x"), (canon(), [None]), (canon(), {}),
    ],
    ids=["none", "string", "null-item", "no-id", "numeric-id", "movements-string", "null-movement", "movements-object"],
)
def test_malformed_input_fails_closed_and_never_crashes(answers, movements):
    result = evaluate_session_gate(answers, movements)
    assert result["verdict"] != "SAFE"


def test_input_is_not_changed():
    answers = canon() + [app("Q_UNABLE_TO_MOVE_ARM", None)]
    before = json.dumps(answers)
    evaluate_session_gate(answers, [])
    assert json.dumps(answers) == before
