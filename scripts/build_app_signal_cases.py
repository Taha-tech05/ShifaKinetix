"""Writes shared/app_signal_test_cases.json (follow-ups for live app answers, contract v2).

Expected verdicts and rule ids are stated by hand in this file, from
docs/safety-integration.md and docs/gate-contract.md. Neither evaluator is
imported or run here, so the fixtures stay independent of both
implementations. Synthetic cases only.

Each case gives the RAW inputs: canonical answers, raw app answers and raw
movement results. Both platforms derive any contradiction themselves.
`reviewed` lists canonical questions answered again for the current evidence.
`staleReview` describes an earlier state whose reviews no longer apply.

Run from the repository root: python scripts/build_app_signal_cases.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUESTIONS = {q["questionId"]: q for q in json.loads((ROOT / "shared/questions_shoulder.json").read_text(encoding="utf-8"))["questions"]}
SOURCE = "docs/safety-integration.md"
LABEL = "draft, awaiting clinician review"
MOVES = ["sideways_raise", "forward_raise", "can_position_hold", "outward_push_elbow_at_side", "belly_press", "hand_behind_back"]
BASE = {"chest": False, "breathing": False, "onset": "gradual", "unable": False,
        "sensation": False, "inflammation": False, "illness": False, "pain_score": 3}
CASES: list[dict] = []


def canon(drop=(), **changed):
    """The low-risk complete canonical path, with changes."""
    values = {**BASE, **changed}
    return [{"questionId": qid, "type": QUESTIONS[qid]["type"], "value": values[qid], "state": "answered"}
            for qid in QUESTIONS if qid in values and qid not in drop]


def app(question_id, value, kind="yesno"):
    """A raw app answer; value None means 'not sure'."""
    return {"questionId": question_id, "type": kind, "value": value, "state": "unknown" if value is None else "answered"}


def how(value):
    return app("Q_BASICS_HOW", value, "chooseone")


def pain_now(value):
    return app("Q_BASICS_PAIN_NOW", value, "scale0to10")


def move(movement_id, state="answered", **flags):
    return {"movementId": movement_id, "painful": False, "weak": False, "unableToDo": False,
            "measuredAngle": None, "state": state, **flags}


def full_set(**special):
    """All six movements answered; special maps a movement id to its flags (or a state)."""
    out = []
    for movement_id in MOVES:
        flags = dict(special.get(movement_id, {}))
        state = flags.pop("state", "answered")
        out.append(move(movement_id, state, **flags))
    return out


def case(case_id, description, answers, verdict, rule_ids, movements=(), reviewed=(), stale=None):
    entry = {"caseId": case_id, "description": description, "answers": answers, "movements": list(movements),
             "reviewed": list(reviewed)}
    if stale is not None:
        entry["staleReview"] = stale
    entry.update(expectedVerdict=verdict, expectedRuleIds=rule_ids)
    if verdict != "SAFE":
        entry["mustNotBe"] = "SAFE"
    CASES.append({**entry, "source": SOURCE, "label": LABEL})


UNABLE_SIDEWAYS = {"sideways_raise": {"unableToDo": True, "painful": True}}

# ---------------------------------------------------------------- danger first
case("confirmed_danger_lists_followup", "A confirmed danger keeps RED_FLAG and also lists the pending follow-up",
     [*canon(chest=True), how("after_injury")], "RED_FLAG", ["E_chest", "F_onset"])
case("confirmed_unable_no_followup", "A confirmed 'cannot move the arm' is urgent; nothing to confirm",
     [*canon(unable=True), how("slowly")], "RED_FLAG", ["H_unable"], movements=full_set(**UNABLE_SIDEWAYS))
case("invalid_basics_value", "An unknown basics value fails closed", [*canon(), how("yesterday")],
     "RED_FLAG", ["INPUT_INVALID"])
case("unmapped_danger_id", "An unmapped Q_DANGER_ answer fails closed",
     [*canon(), app("Q_DANGER_NEW", False)], "RED_FLAG", ["INPUT_INVALID"])
case("unmapped_flagged_answer", "An unmapped answer flagged as dangerous fails closed",
     [*canon(), {**app("Q_OTHER", True), "flagged": True}], "RED_FLAG", ["INPUT_INVALID"])

# ---------------------------------------------------------------- follow-ups only for real contradictions
case("basics_changed_after_prefill", "The basics now say 'after an injury' but the saved answer says gradual",
     [*canon(), how("after_injury")], "CLARIFY", ["F_onset"])
case("basics_change_stale_review", "A follow-up answered for an earlier basics value does not cover the new one",
     [*canon(), how("after_injury")], "CLARIFY", ["F_onset"],
     stale={"answers": [*canon(), how("suddenly")], "movements": [], "ids": ["onset"]})
case("pain_basics_differs", "The basics pain score differs from the saved pain score",
     [*canon(), pain_now(6)], "CLARIFY", ["F_pain_score"])
case("unable_after_full_set", "Said the arm moves, then could not do a movement: one check after the set",
     [*canon(), how("slowly")], "CLARIFY", ["F_unable"], movements=full_set(**UNABLE_SIDEWAYS))
case("unable_new_movement_stale_review", "A check answered for one failed movement does not cover a new one",
     [*canon(), how("slowly")], "CLARIFY", ["F_unable"],
     movements=full_set(sideways_raise={"unableToDo": True}, forward_raise={"unableToDo": True}),
     stale={"answers": [*canon(), how("slowly")], "movements": full_set(**UNABLE_SIDEWAYS), "ids": ["unable"]})
case("soon_with_check_becomes_clarify", "A pending check turns a SAFE (soon) result into CLARIFY; points stay listed",
     [*canon(onset="injury", shape=False), how("after_injury")], "CLARIFY", ["P_onset_injury", "F_unable"],
     movements=full_set(**UNABLE_SIDEWAYS))
case("missing_canonical_with_app_answers", "Missing canonical answers still need answering",
     [*canon(drop=("sensation",)), how("slowly")], "CLARIFY", ["M_sensation"])

# ---------------------------------------------------------------- no repeated questions
case("basics_match_prefill", "The basics answer filled the saved answer: nothing is asked again",
     [*canon(), how("slowly"), pain_now(3)], "SAFE", [])
case("basics_changed_reviewed", "The patient confirmed the saved answer after the basics changed",
     [*canon(), how("after_injury")], "SAFE", [], reviewed=["onset"])
case("basics_unknown_no_followup", "Not sure in the basics: the safety question was asked once, nothing more",
     [*canon(), how(None)], "SAFE", [])
case("weak_movement_not_a_signal", "A weak movement goes to narrowing, never back to the safety questions",
     [*canon(), how("slowly")], "SAFE", [], movements=full_set(can_position_hold={"weak": True, "painful": True}))
case("skipped_movement_not_a_signal", "A skipped movement is not a safety signal",
     [*canon(), how("slowly")], "SAFE", [], movements=full_set(belly_press={"state": "unknown"}))
case("unable_mid_set_waits", "A failed movement before the set is complete does not interrupt the movements",
     [*canon(), how("slowly")], "SAFE", [], movements=[move("sideways_raise", unableToDo=True), move("forward_raise")])
case("unable_reviewed", "The patient confirmed the arm moves but is painful or limited",
     [*canon(), how("slowly")], "SAFE", [], movements=full_set(**UNABLE_SIDEWAYS), reviewed=["unable"])
case("unable_on_skipped_movement_ignored", "'Could not do' on a skipped movement is not counted",
     [*canon(), how("slowly")], "SAFE", [], movements=full_set(sideways_raise={"unableToDo": True, "state": "unknown"}))
case("structure_numb_tingle_not_signals", "Narrowing questions about numbness or tingling no longer re-open safety questions",
     [*canon(), how("slowly"), app("Q_ST_NUMB", True), app("Q_ST_TINGLE", None)], "SAFE", [])
case("soon_level_kept", "One weighted sign keeps SAFE (soon) with its points listed",
     [*canon(onset="injury", shape=False), how("after_injury")], "SAFE", ["P_onset_injury"])


def main():
    out = {
        "schemaVersion": 2,
        "label": LABEL,
        "note": "Generated by scripts/build_app_signal_cases.py. Expected results are stated by hand; edit that script, not this file.",
        "cases": CASES,
    }
    (ROOT / "shared/app_signal_test_cases.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(CASES)} cases.")


if __name__ == "__main__":
    main()
