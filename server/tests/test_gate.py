"""Gate contract v2 on the Python side: shared cases, linked questions and safety properties. Synthetic cases only."""

import json
import random

import pytest
from safety_answers import REQUIRED, REQUIRED_IDS, answers, record

from app.gate import (
    EMERGENCY_IDS,
    QUESTIONS,
    RULES,
    SHARED_DIR,
    THRESHOLDS,
    evaluate,
    implied_answer,
    is_asked_question,
)

CASES = json.loads((SHARED_DIR / "gate_test_cases.json").read_text(encoding="utf-8"))["cases"]
RANK = {"ROUTINE": 0, "SOON": 1, "URGENT": 3, "EMERGENCY": 4}


def rank(out):
    """ROUTINE < SOON < CLARIFY < URGENT < EMERGENCY."""
    return 2 if out["verdict"] == "CLARIFY" else RANK[out["level"]]


def ids(out):
    return [r["ruleId"] for r in out["firedRules"]]


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


def test_low_risk_path_is_eight_questions_and_routine():
    given = answers()
    assert [q["questionId"] for q in QUESTIONS if is_asked_question(q, given)] == REQUIRED_IDS
    assert len(REQUIRED_IDS) == 8
    assert evaluate(given) == {"verdict": "SAFE", "level": "ROUTINE", "score": 0, "firedRules": []}


@pytest.mark.parametrize("qid", REQUIRED_IDS)
def test_missing_or_not_sure_on_an_always_asked_question_is_never_routine(qid):
    assert evaluate(answers(missing=[qid]))["verdict"] == "CLARIFY"
    assert evaluate(answers(unknown=[qid]))["verdict"] == "CLARIFY"
    assert rank(evaluate(answers(clarified=[qid]))) >= RANK["SOON"]


@pytest.mark.parametrize("question", [q for q in QUESTIONS if q["tier"] == "hardStop"], ids=lambda q: q["questionId"])
def test_not_sure_on_a_hard_stop_question_asks_its_simpler_question_then_one_may_stay_unresolved(question):
    opened = {c["questionId"]: (True if c.get("equals") is True else c.get("in", [None])[0]) for c in question.get("askWhen") or []}
    opened = {k: v for k, v in opened.items() if v is not None}
    if "pain_score" in opened or "redness" in opened:
        opened.setdefault("inflammation", True)
    qid = question["questionId"]
    first = evaluate(answers(unknown=[qid], **opened))
    again = evaluate(answers(clarified=[qid], **opened))
    assert first["verdict"] == "CLARIFY" and f"U_{qid}" in ids(first)
    if qid in EMERGENCY_IDS:
        assert again["verdict"] == "CLARIFY"
        assert next(r for r in again["firedRules"] if r["ruleId"] == f"U_{qid}")["reason"].startswith("Uncertainty persists")
    else:
        assert f"N_{qid}" in ids(again) and f"U_{qid}" not in ids(again)
        assert rank(again) >= RANK["SOON"]


def test_two_unresolved_answers_need_a_doctor():
    out = evaluate(answers(clarified=["unable", "numb"], sensation=True, tingling="none", temperature="normal"))
    assert out["verdict"] == "CLARIFY" and ids(out) == ["U_unable", "U_numb"]


@pytest.mark.parametrize(
    "bad_input",
    [None, "chest", 42, {}, {"questionId": "chest"}, [None], ["chest"], [[]], [{"questionId": ["chest"]}]],
    ids=repr,
)
def test_malformed_input_is_red_flag_not_a_crash(bad_input):
    result = evaluate(bad_input)
    assert (result["verdict"], result["level"]) == ("RED_FLAG", "URGENT")
    assert ids(result) == ["INPUT_INVALID"]


def test_old_content_question_fails_closed():
    """A shoulder-2 answer (injury yes/no) is not part of shoulder-3; old intakes need a new assessment."""
    assert ids(evaluate(answers() + [{"questionId": "injury", "type": "yesno", "value": False, "state": "answered"}])) == ["INPUT_INVALID"]


def test_one_is_not_true():
    given = answers()
    given[0]["value"] = 1
    assert ids(evaluate(given)) == ["INPUT_INVALID"]


def test_evaluate_does_not_change_its_input():
    given = answers(onset="injury", shape=False)
    before = json.dumps(given)
    evaluate(given)
    assert json.dumps(given) == before


def test_rules_are_well_formed():
    for rule in RULES:
        assert ("level" in rule) != ("points" in rule)
        if "points" in rule:
            assert len(rule["all"]) == 1 and rule["points"] > 0
        if "level" in rule and len(rule["all"]) == 1:
            q = next(q for q in QUESTIONS if q["questionId"] == rule["all"][0]["questionId"])
            assert q["tier"] == "hardStop", "a single-sign hard stop must ask for clarification on Not sure"
    assert THRESHOLDS["SOON"] < THRESHOLDS["URGENT"]


def test_every_nhs_urgent_list_sign_alone_is_at_least_soon():
    """NHS shoulder-pain urgent advice lists each of these on its own; none may be ROUTINE alone."""
    singles = [
        answers(onset="injury", shape=False), answers(onset="sudden", shape=False),
        answers(pain_score=9, bilateral=False), answers(inflammation=True, temperature="hot", swelling="none", redness=False, fever=False),
        answers(inflammation=True, temperature="normal", swelling="none", redness=False, fever=True),
        answers(pain_score=6, bilateral=True), answers(unable=True), answers(onset="injury", shape=True),
        answers(sensation=True, numb=True, tingling="none", temperature="normal"),
        answers(sensation=True, numb=False, tingling="persistent", temperature="normal"),
        answers(sensation=True, numb=False, tingling="none", temperature="cold"),
        answers(inflammation=True, temperature="normal", swelling="severe", redness=False, fever=False),
    ]
    for given in singles:
        assert rank(evaluate(given)) >= RANK["SOON"], ids(evaluate(given))


# ---------------------------------------------------------------- safety properties over many generated answer sets


def scale(question):
    """Answer values from least to most worrying."""
    if question["type"] == "yesno":
        return [False, True]
    if question["type"] == "choice":
        return ["gradual", "sudden", "injury"] if question["questionId"] == "onset" else [o["value"] for o in question["options"]]
    return [0, 3, 5, 6, 7, 8, 10] if question["type"] == "number" else [0, 10, 400]


def random_answers(rng):
    out = []
    for q in QUESTIONS:
        roll = rng.random()
        if roll < 0.15:
            continue
        if roll < 0.25:
            out.append(record(q["questionId"], None, clarified=rng.random() < 0.5))
            continue
        values = scale(q)
        out.append(record(q["questionId"], values[0] if rng.random() < 0.6 else rng.choice(values)))
    return out


def replace(given, new):
    return [a for a in given if a["questionId"] != new["questionId"]] + [new]


def test_a_more_worrying_answer_never_lowers_the_care_level():
    rng = random.Random(7)
    for _ in range(800):
        given = random_answers(rng)
        before = rank(evaluate(given))
        for a in [a for a in given if a["state"] == "answered"]:
            values = scale(next(q for q in QUESTIONS if q["questionId"] == a["questionId"]))
            for worse in values[values.index(a["value"]) + 1:]:
                assert rank(evaluate(replace(given, {**a, "value": worse}))) >= before


def test_not_sure_never_gives_a_lower_care_level_than_no():
    rng = random.Random(11)
    for _ in range(800):
        given = random_answers(rng)
        for q in QUESTIONS:
            no = replace(given, record(q["questionId"], scale(q)[0]))
            unsure = replace(given, record(q["questionId"], None))
            assert rank(evaluate(unsure)) >= rank(evaluate(no))


def test_a_hard_stop_always_wins_over_the_points():
    rng = random.Random(13)
    for _ in range(1500):
        out = evaluate(random_answers(rng))
        if any("level" in r for r in out["firedRules"]):
            assert out["verdict"] == "RED_FLAG" and out["level"] in ("URGENT", "EMERGENCY")


def covered(qid, given):
    q = next(q for q in QUESTIONS if q["questionId"] == qid)
    if any(a["questionId"] == qid and a["state"] == "answered" for a in given):
        return True
    if q["required"] or not q.get("askWhen"):
        return False
    return not is_asked_question(q, given) and all(covered(c["questionId"], given) for c in q["askWhen"])


def test_every_questionnaire_path_to_safe_covers_every_hard_stop_question():
    rng = random.Random(17)
    safe = 0
    for _ in range(1500):
        given = []
        for _ in range(len(QUESTIONS)):
            nxt = next((q for q in QUESTIONS if is_asked_question(q, given) and all(a["questionId"] != q["questionId"] for a in given)), None)
            if nxt is None:
                break
            unknown = rng.random() < 0.1
            given.append(record(nxt["questionId"], None if unknown else (scale(nxt)[0] if rng.random() < 0.7 else rng.choice(scale(nxt))), clarified=unknown))
        out = evaluate(given)
        if out["verdict"] != "SAFE":
            continue
        safe += 1
        # answered, closed by its opening question, or left unresolved (at most one, never chest/breathing, then SOON)
        unresolved = [q for q in QUESTIONS if q["tier"] == "hardStop" and not covered(q["questionId"], given)]
        assert len(unresolved) <= 1 and not any(q["questionId"] in EMERGENCY_IDS for q in unresolved)
        for q in unresolved:
            assert next(a for a in given if a["questionId"] == q["questionId"]).get("clarificationAttempted") is True
            assert out["level"] == "SOON"
        for q in QUESTIONS:
            if q["tier"] == "hardStop" and q not in unresolved:
                implied = implied_answer(given, q["questionId"])
                assert implied is not None and implied["state"] == "answered"
    assert safe > 100


def test_required_questions_have_no_link_conditions():
    assert all(not q.get("askWhen") for q in REQUIRED)
