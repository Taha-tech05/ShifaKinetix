"""Live app answers under contract v2: each thing is asked once, follow-ups only for contradictions. Synthetic cases only."""

import json

import pytest
from safety_answers import answers as canon

from app.gate import SHARED_DIR, evaluate
from app.session_gate import (
    MOVEMENT_SET_SIZE,
    conflicts,
    evaluate_session_gate,
    followup_evidence,
    pending_followups,
)

DOCUMENT = json.loads((SHARED_DIR / "app_signal_test_cases.json").read_text(encoding="utf-8"))
CASES = DOCUMENT["cases"]
LABEL = "draft, awaiting clinician review"
MOVES = ["sideways_raise", "forward_raise", "can_position_hold", "outward_push_elbow_at_side", "belly_press", "hand_behind_back"]


def app(question_id, value, kind="yesno"):
    return {"questionId": question_id, "type": kind, "value": value, "state": "unknown" if value is None else "answered"}


def how(value):
    return app("Q_BASICS_HOW", value, "chooseone")


def pain_now(value):
    return app("Q_BASICS_PAIN_NOW", value, "scale0to10")


def move(movement_id="sideways_raise", state="answered", **flags):
    return {"movementId": movement_id, "painful": False, "weak": False, "unableToDo": False,
            "measuredAngle": None, "state": state, **flags}


def full_set(**special):
    return [move(m, **special.get(m, {})) for m in MOVES]


def rule_ids(gate):
    return [rule["ruleId"] for rule in gate["firedRules"]]


SAFE_ROUTINE = {"verdict": "SAFE", "level": "ROUTINE", "score": 0, "firedRules": []}
UNABLE_ONE = {"sideways_raise": {"unableToDo": True}}


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
    assert "APP_REVIEW" not in json.dumps(DOCUMENT)


# ---------------------------------------------------------------- nothing is asked twice


def test_movement_set_size_matches_the_app():
    assert MOVEMENT_SET_SIZE == len(MOVES)


@pytest.mark.parametrize("flags", [{"weak": True}, {"painful": True}, {"weak": True, "painful": True}, {"state": "unknown"},
                                   {"state": "skipped"}, {"state": "unknown", "unableToDo": True}])
def test_weak_painful_or_skipped_movements_are_not_safety_signals(flags):
    assert evaluate_session_gate(canon(), full_set(belly_press=flags)) == SAFE_ROUTINE


def test_a_failed_movement_waits_for_the_whole_set():
    partial = [move(m, unableToDo=m == "sideways_raise") for m in MOVES[:MOVEMENT_SET_SIZE - 1]]
    assert evaluate_session_gate(canon(), partial) == SAFE_ROUTINE
    result = evaluate_session_gate(canon(), full_set(**UNABLE_ONE))
    assert (result["verdict"], rule_ids(result)) == ("CLARIFY", ["F_unable"])


def test_the_check_names_its_reason_and_keeps_the_score():
    result = evaluate_session_gate(canon(onset="injury", shape=False), full_set(**UNABLE_ONE))
    assert result["firedRules"][-1] == {
        "ruleId": "F_unable", "matchedAnswers": ["unable"], "source": "docs/safety-integration.md",
        "reason": "A later answer differs from this earlier answer; please confirm it.",
    }
    assert (result["verdict"], result["level"], result["score"]) == ("CLARIFY", None, 2)


def test_a_reviewed_check_clears_but_a_new_failed_movement_is_new_evidence():
    assert evaluate_session_gate(canon(), full_set(**UNABLE_ONE), ["unable"]) == SAFE_ROUTINE
    first = followup_evidence(canon(), full_set(**UNABLE_ONE))["unable"]
    second = followup_evidence(canon(), full_set(sideways_raise={"unableToDo": True}, belly_press={"unableToDo": True}))["unable"]
    assert first != second


def test_a_confirmed_cannot_move_needs_no_check():
    for reviewed in ([], ["unable"]):
        result = evaluate_session_gate(canon(unable=True), full_set(**UNABLE_ONE), reviewed)
        assert (result["verdict"], rule_ids(result)) == ("RED_FLAG", ["H_unable"])


def test_no_check_without_a_given_answer_to_contradict():
    given = canon(missing=["unable"])
    result = evaluate_session_gate(given, full_set(**UNABLE_ONE))
    assert rule_ids(result) == ["M_unable"]
    assert conflicts(given, full_set(**UNABLE_ONE)) == []
    assert evaluate_session_gate(canon(unknown=["unable"]), full_set(**UNABLE_ONE))["verdict"] == "CLARIFY"


def test_basics_that_match_the_saved_answers_are_never_asked_again():
    assert evaluate_session_gate(canon() + [how("slowly"), pain_now(3)]) == SAFE_ROUTINE
    assert evaluate_session_gate(canon() + [how(None), pain_now(None)]) == SAFE_ROUTINE


@pytest.mark.parametrize("basics,question", [(how("after_injury"), "onset"), (how("suddenly"), "onset"), (pain_now(7), "pain_score")])
def test_changed_basics_ask_one_check_that_reviewing_clears(basics, question):
    result = evaluate_session_gate(canon() + [basics])
    assert (result["verdict"], rule_ids(result)) == ("CLARIFY", [f"F_{question}"])
    assert evaluate_session_gate(canon() + [basics], None, [question]) == SAFE_ROUTINE


def test_narrowing_questions_about_numbness_and_tingling_are_not_safety_signals():
    for value in (True, False, None):
        extra = [app("Q_ST_NUMB", value), app("Q_ST_TINGLE", value), app("Q_ST_BONE_POINT", value)]
        assert evaluate_session_gate(canon() + extra) == SAFE_ROUTINE


def test_a_pending_check_never_hides_danger():
    result = evaluate_session_gate(canon(chest=True) + [how("after_injury")])
    assert (result["verdict"], result["level"], rule_ids(result)) == ("RED_FLAG", "EMERGENCY", ["E_chest", "F_onset"])


def test_pending_followups_are_in_question_order_and_respect_reviews():
    given = canon() + [how("after_injury"), pain_now(8)]
    assert pending_followups(given, full_set(**UNABLE_ONE)) == ["onset", "unable", "pain_score"]
    assert pending_followups(given, full_set(**UNABLE_ONE), {"onset", "pain_score"}) == ["unable"]


def test_without_app_answers_it_is_exactly_the_canonical_gate():
    for given in (canon(), canon(chest=True), canon()[:5], [], canon() + canon(), canon(inflammation=True, redness=True)):
        assert evaluate_session_gate(given) == evaluate(given)


def test_client_review_records_are_ignored():
    record = {"questionId": "Q_SAFETY_REVIEW_unable", "type": "safety-review", "state": "answered", "value": "anything"}
    assert evaluate_session_gate(canon() + [record], full_set(**UNABLE_ONE))["verdict"] == "CLARIFY"
    assert evaluate_session_gate(canon() + [record]) == SAFE_ROUTINE


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


@pytest.mark.parametrize("extra", [how("yesterday"), app("Q_DANGER_NEW", False), {**app("Q_OTHER", True), "flagged": True}])
def test_unrecognised_safety_inputs_fail_closed(extra):
    assert rule_ids(evaluate_session_gate(canon() + [extra])) == ["INPUT_INVALID"]


def test_input_is_not_changed():
    given, movements = canon() + [how("after_injury")], full_set(**UNABLE_ONE)
    before = json.dumps([given, movements])
    evaluate_session_gate(given, movements, ["unable"])
    followup_evidence(given, movements)
    assert json.dumps([given, movements]) == before
