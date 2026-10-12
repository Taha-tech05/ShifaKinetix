"""Live app-signal gate under the focused follow-up policy. Synthetic cases only."""

import json

import pytest

from app.gate import QUESTIONS, SHARED_DIR, evaluate
from app.session_gate import (
    ALIASES,
    assemble,
    evaluate_session_gate,
    followup_evidence,
    pending_followups,
    structured_gate_inputs,
)

DOCUMENT = json.loads((SHARED_DIR / "app_signal_test_cases.json").read_text(encoding="utf-8"))
CASES = DOCUMENT["cases"]
REQUIRED = [q for q in QUESTIONS if q["required"]]
LABEL = "draft, awaiting clinician review"
SENSORY = ["U_unable", "U_tingling", "U_numb"]


def canon(**changed):
    return [
        {"questionId": q["questionId"], "type": q["type"], "state": "answered",
         "value": changed.get(q["questionId"], False if q["type"] == "yesno" else "normal")}
        for q in REQUIRED
    ]


def app(question_id, value):
    return {"questionId": question_id, "type": "yesno", "value": value, "state": "unknown" if value is None else "answered"}


def how(value):
    return {"questionId": "Q_BASICS_HOW", "type": "chooseone", "value": value, "state": "unknown" if value is None else "answered"}


def move(movement_id="sideways_raise", state="answered", **flags):
    return {"movementId": movement_id, "painful": False, "weak": False, "unableToDo": False,
            "measuredAngle": None, "state": state, **flags}


def rule_ids(gate):
    return [rule["ruleId"] for rule in gate["firedRules"]]


def derived(answers, movements):
    return {a["questionId"]: a["value"] for a in structured_gate_inputs(answers, movements)}


# ---------------------------------------------------------------- shared fixtures


@pytest.mark.parametrize("case", CASES, ids=[c["caseId"] for c in CASES])
def test_shared_app_signal_case(case):
    result = evaluate_session_gate(case["answers"], case["movements"], case["reviewed"])
    assert result["verdict"] == case["expectedVerdict"]
    assert rule_ids(result) == case["expectedRuleIds"]
    if "mustNotBe" in case:
        assert result["verdict"] != case["mustNotBe"]


def test_fixture_file_is_draft_sourced_and_danger_first():
    assert DOCUMENT["label"] == LABEL
    verdicts = [c["expectedVerdict"] for c in CASES]
    assert verdicts == sorted(verdicts, key=["RED_FLAG", "CLARIFY", "SAFE"].index)
    for case in CASES:
        assert case["source"].strip() and case["label"] == LABEL
    assert "validated" not in json.dumps(DOCUMENT).lower().replace("clinical validation", "")


def test_no_app_review_stop_rules_remain():
    assert "APP_REVIEW" not in json.dumps(DOCUMENT)
    for case in CASES:
        assert not any(r.startswith("APP_REVIEW") for r in rule_ids(evaluate_session_gate(case["answers"], case["movements"])))


# ---------------------------------------------------------------- the server derives signals from raw movements


def test_raw_unable_or_weak_movement_with_canonical_negatives_is_not_safe():
    """Zaid's review case: no derived app answers are sent, only raw movement results."""
    assert evaluate_session_gate(canon(), [move(unableToDo=True)])["verdict"] == "CLARIFY"
    assert evaluate_session_gate(canon(), [move(weak=True)])["verdict"] == "CLARIFY"
    assert rule_ids(evaluate_session_gate(canon(), [move(unableToDo=True)])) == ["U_unable"]
    assert rule_ids(evaluate_session_gate(canon(), [move(weak=True)])) == SENSORY


def test_derivation_matches_the_mobile_rules():
    assert derived([], []) == {}
    assert derived([], [move()]) == {"Q_UNABLE_TO_MOVE_ARM": False}
    assert derived([], [move(unableToDo=True)]) == {"Q_UNABLE_TO_MOVE_ARM": True}
    assert derived([], [move(state="unknown")]) == {"Q_UNABLE_TO_MOVE_ARM": None}
    assert derived([], [move(state="unknown", unableToDo=True)]) == {"Q_UNABLE_TO_MOVE_ARM": None}, "unknown is not read"
    assert derived([], [move(weak=True)]) == {"Q_UNABLE_TO_MOVE_ARM": False, "Q_NUMB_OR_WEAK": True}
    assert derived([how("after_injury")], []) == {"Q_ONSET_SUDDEN_TRAUMA": True}
    assert derived([how("slowly")], []) == {"Q_ONSET_SUDDEN_TRAUMA": False}
    assert derived([how(None)], []) == {"Q_ONSET_SUDDEN_TRAUMA": None}
    assert derived([app("Q_ST_NUMB", False), app("Q_ST_TINGLE", False)], []) == {"Q_NUMB_OR_WEAK": False}
    assert derived([app("Q_ST_NUMB", False)], []) == {"Q_NUMB_OR_WEAK": False}
    assert derived([app("Q_ST_NUMB", False), app("Q_ST_TINGLE", None)], []) == {"Q_NUMB_OR_WEAK": None}
    assert derived([app("Q_ST_NUMB", True), app("Q_ST_TINGLE", False)], []) == {"Q_NUMB_OR_WEAK": True}
    assert derived([app("Q_ST_BONE_POINT", True), how("suddenly")], [])["Q_BONE_TENDER_AFTER_TRAUMA"] is True
    assert derived([app("Q_ST_BONE_POINT", True), how("slowly")], [])["Q_BONE_TENDER_AFTER_TRAUMA"] is False
    assert derived([app("Q_ST_BONE_POINT", False)], [])["Q_BONE_TENDER_AFTER_TRAUMA"] is False
    assert derived([app("Q_ST_BONE_POINT", True)], [])["Q_BONE_TENDER_AFTER_TRAUMA"] is None
    assert derived([app("Q_ST_BONE_POINT", None), how("after_injury")], [])["Q_BONE_TENDER_AFTER_TRAUMA"] is None


def test_painful_movement_alone_is_not_a_safety_signal():
    assert evaluate_session_gate(canon(), [move(painful=True)]) == {"verdict": "SAFE", "firedRules": []}


@pytest.mark.parametrize("state", ["unknown", "skipped", "", None, "pending"])
def test_any_unfinished_movement_asks_the_followups(state):
    result = evaluate_session_gate(canon(), [move(), move("belly_press", state=state)])
    assert result["verdict"] == "CLARIFY" and rule_ids(result) == SENSORY


# ---------------------------------------------------------------- focused follow-ups


def test_followup_is_asked_as_a_fresh_question_not_a_repeat():
    rule = evaluate_session_gate(canon(), [move(unableToDo=True)])["firedRules"][0]
    assert rule == {
        "ruleId": "U_unable",
        "matchedAnswers": ["unable"],
        "source": "docs/gate-contract.md",
        "reason": "Safety answer is uncertain; ask the fixed clarification.",
    }


def test_an_old_no_cannot_clear_new_evidence_but_a_reviewed_no_can():
    answers, movements = canon(unable=False), [move(unableToDo=True)]
    assert evaluate_session_gate(answers, movements)["verdict"] == "CLARIFY"
    assert evaluate_session_gate(answers, movements, ["unable"]) == {"verdict": "SAFE", "firedRules": []}


def test_reviewing_one_question_does_not_resolve_another():
    result = evaluate_session_gate(canon(), [move(weak=True)], ["numb"])
    assert rule_ids(result) == ["U_unable", "U_tingling"]


def test_reviewed_cannot_clear_a_question_with_no_canonical_answer():
    answers = [a for a in canon() if a["questionId"] != "unable"]
    result = evaluate_session_gate(answers, [move(unableToDo=True)], ["unable"])
    assert result["verdict"] == "CLARIFY" and rule_ids(result) == ["M_unable"]


def test_reviewed_cannot_hide_a_confirmed_yes():
    for reviewed in ([], ["unable"]):
        result = evaluate_session_gate(canon(unable=True), [move(unableToDo=True)], reviewed)
        assert result["verdict"] == "RED_FLAG" and rule_ids(result) == ["R_unable"]


@pytest.mark.parametrize("signal", sorted(ALIASES))
def test_not_sure_on_any_app_signal_is_never_safe(signal):
    result = evaluate_session_gate(canon() + [app(signal, None)])
    assert result["verdict"] == "CLARIFY"
    assert {r[2:] for r in rule_ids(result)} >= set(ALIASES[signal])


@pytest.mark.parametrize("signal", sorted(ALIASES))
def test_positive_app_signal_asks_its_followups_and_reviewing_them_clears(signal):
    answers = canon() + [app(signal, True)]
    asked = {r[2:] for r in rule_ids(evaluate_session_gate(answers))}
    assert asked >= set(ALIASES[signal])
    assert evaluate_session_gate(answers, None, asked)["verdict"] == "SAFE"


def test_negative_app_signals_change_nothing():
    negatives = [app(signal, False) for signal in sorted(ALIASES)]
    assert evaluate_session_gate(canon() + negatives) == evaluate(canon())
    assert evaluate_session_gate(canon(fever=True) + negatives) == evaluate(canon(fever=True))


def test_without_app_answers_it_is_exactly_the_canonical_gate():
    for answers in (canon(), canon(chest=True), canon()[:5], [], canon() + canon(), canon(redness=True)):
        assert evaluate_session_gate(answers) == evaluate(answers)


def test_client_review_records_are_ignored():
    record = {"questionId": "Q_SAFETY_REVIEW_unable", "type": "safety-review", "state": "answered", "value": "anything"}
    assert evaluate_session_gate(canon() + [record], [move(unableToDo=True)])["verdict"] == "CLARIFY"
    assert evaluate_session_gate(canon() + [record]) == {"verdict": "SAFE", "firedRules": []}


# ---------------------------------------------------------------- evidence fingerprints (used by the server's history)


def test_evidence_exists_only_for_questions_with_signals():
    assert followup_evidence([], []) == {}
    assert followup_evidence([], [move(painful=True)]) == {}
    assert set(followup_evidence([], [move(unableToDo=True)])) == {"unable"}
    assert set(followup_evidence([], [move(weak=True)])) == {"unable", "numb", "tingling"}
    assert set(followup_evidence([how("after_injury")], [])) == {"injury"}
    assert set(followup_evidence([how(None)], [])) == {"injury", "sudden"}


def test_evidence_changes_when_the_signal_or_the_movements_change():
    weak = followup_evidence([], [move(weak=True)])
    assert weak == followup_evidence([], [move(weak=True)])
    assert weak["numb"] != followup_evidence([], [move(weak=True), move("belly_press")])["numb"], "a new movement is new evidence"
    assert weak["numb"] != followup_evidence([], [move(weak=True, painful=True)])["numb"]
    onset = followup_evidence([how("after_injury")], [])["injury"]
    assert onset == followup_evidence([how("after_injury")], [move(painful=True)])["injury"], "onset does not depend on movements"
    assert onset != followup_evidence([how(None)], [])["injury"]


def test_pending_followups_are_in_question_order():
    combined = assemble(canon() + [how(None)], [move(weak=True)])
    assert pending_followups(combined) == ["injury", "unable", "tingling", "numb", "sudden"]
    assert pending_followups(combined, {"numb", "injury"}) == ["unable", "tingling", "sudden"]


# ---------------------------------------------------------------- malformed input


@pytest.mark.parametrize(
    "answers,movements",
    [
        (None, []), ("x", []), ([None], []), ([{"type": "yesno"}], []), ([{"questionId": 5}], []),
        (canon(), "x"), (canon(), [None]), (canon(), {}), (canon(), [5]),
    ],
    ids=["none", "string", "null-item", "no-id", "numeric-id", "movements-string", "null-movement",
         "movements-object", "numeric-movement"],
)
def test_malformed_input_fails_closed_and_never_crashes(answers, movements):
    result = evaluate_session_gate(answers, movements)
    assert result["verdict"] == "RED_FLAG" and rule_ids(result) == ["INPUT_INVALID"]
    assert followup_evidence(answers, movements) == {}


def test_input_is_not_changed():
    answers, movements = canon() + [how(None)], [move(weak=True)]
    before = json.dumps([answers, movements])
    evaluate_session_gate(answers, movements, ["numb"])
    followup_evidence(answers, movements)
    assert json.dumps([answers, movements]) == before
