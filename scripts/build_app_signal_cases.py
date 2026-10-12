"""Writes shared/app_signal_test_cases.json (focused follow-ups, contract v1.1 and v1.2).

Expected verdicts and rule ids are stated by hand in this file, from
docs/safety-integration.md and docs/gate-contract.md. Neither evaluator is
imported or run here, so the fixtures stay independent of both
implementations. Synthetic cases only.

Each case gives the RAW inputs: canonical answers, raw app answers and raw
movement results. Both platforms derive the safety signals themselves.
`reviewed` lists canonical questions answered for the current evidence.
`staleReview` describes an earlier state whose reviews no longer apply.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    q
    for q in json.loads((ROOT / "shared/questions_shoulder.json").read_text(encoding="utf-8"))["questions"]
    if q["required"]
]
SOURCE = "docs/safety-integration.md"
LABEL = "draft, awaiting clinician review"
SENSORY = ["U_unable", "U_tingling", "U_numb"]  # question order: unable, tingling, numb
CASES: list[dict] = []


def canon(unknown=(), clarified=(), missing=(), **changed):
    """The 16 always-required canonical answers, all 'no' unless stated."""
    out = []
    for q in REQUIRED:
        qid = q["questionId"]
        if qid in missing:
            continue
        if qid in unknown or qid in clarified:
            record = {"questionId": qid, "type": q["type"], "value": None, "state": "unknown"}
            if qid in clarified:
                record["clarificationAttempted"] = True
        else:
            value = changed.get(qid, False if q["type"] == "yesno" else "normal")
            record = {"questionId": qid, "type": q["type"], "value": value, "state": "answered"}
        out.append(record)
    return out


def app(question_id, value):
    """A yes/no app answer; value None means 'not sure'."""
    return {"questionId": question_id, "type": "yesno", "value": value, "state": "unknown" if value is None else "answered"}


def how(value):
    return {"questionId": "Q_BASICS_HOW", "type": "chooseone", "value": value, "state": "unknown" if value is None else "answered"}


def risk(value):
    return {"questionId": "infection_risk", "type": "yesno", "value": value, "state": "unknown" if value is None else "answered"}


def move(movement_id, state="answered", **flags):
    return {"movementId": movement_id, "painful": False, "weak": False, "unableToDo": False,
            "measuredAngle": None, "state": state, **flags}


def case(case_id, description, answers, verdict, rule_ids, movements=(), reviewed=(), stale=None):
    entry = {"caseId": case_id, "description": description, "answers": answers, "movements": list(movements),
             "reviewed": list(reviewed)}
    if stale is not None:
        entry["staleReview"] = stale
    entry.update(expectedVerdict=verdict, expectedRuleIds=rule_ids)
    if verdict != "SAFE":
        entry["mustNotBe"] = "SAFE"
    CASES.append({**entry, "source": SOURCE, "label": LABEL})


WEAK = [move("can_position_hold", weak=True)]
UNABLE = [move("sideways_raise", unableToDo=True)]

# ---------------------------------------------------------------- danger first
case("confirmed_danger_with_weak_movement", "A confirmed canonical danger outranks pending follow-ups, which are still listed",
     canon(chest=True), "RED_FLAG", ["R_chest", *SENSORY], WEAK)
case("confirmed_yes_survives_app_uncertainty", "App uncertainty never replaces a reported canonical 'yes'",
     canon(injury=True) + [how(None)], "RED_FLAG", ["R_injury", "U_sudden"])
case("unable_movement_with_canonical_yes", "Raw inability plus a canonical 'unable = yes' stops under the unchanged rule",
     canon(unable=True), "RED_FLAG", ["R_unable"], UNABLE)
case("followup_answered_yes", "A focused follow-up answered 'yes' stops under the unchanged sourced rule",
     canon(injury=True) + [how("after_injury")], "RED_FLAG", ["R_injury"], reviewed=["injury"])
case("weakness_followup_answered_yes", "Weak movement, then 'numb = yes' at the follow-up, stops under the unchanged rule",
     canon(numb=True), "RED_FLAG", ["R_numb"], WEAK, reviewed=["unable", "numb", "tingling"])
case("redness_with_infection_risk", "Redness with a confirmed infection risk fires the existing combination rule",
     canon(redness=True) + [risk(True)], "RED_FLAG", ["R_local_infection_risk"])
case("alias_wrong_type", "An app safety signal with the wrong type fails closed",
     canon() + [{"questionId": "Q_UNABLE_TO_MOVE_ARM", "type": "choice", "value": True, "state": "answered"}],
     "RED_FLAG", ["INPUT_INVALID"])
case("alias_string_boolean", "An app safety signal with a string instead of a boolean fails closed",
     canon() + [{"questionId": "Q_ST_NUMB", "type": "yesno", "value": "true", "state": "answered"}],
     "RED_FLAG", ["INPUT_INVALID"])
case("alias_unknown_with_value", "An app safety signal marked unknown but carrying a value fails closed",
     canon() + [{"questionId": "Q_ST_TINGLE", "type": "yesno", "value": False, "state": "unknown"}],
     "RED_FLAG", ["INPUT_INVALID"])
case("alias_bad_state", "An app safety signal with an unrecognised state fails closed",
     canon() + [{"questionId": "Q_NUMB_OR_WEAK", "type": "yesno", "value": False, "state": "done"}],
     "RED_FLAG", ["INPUT_INVALID"])
case("unmapped_danger_question", "An unmapped Q_DANGER_ input fails closed instead of disappearing",
     canon() + [app("Q_DANGER_NEW", False)], "RED_FLAG", ["INPUT_INVALID"])
case("unmapped_flagged_answer", "An unmapped flagged answer fails closed instead of disappearing",
     canon() + [{"questionId": "Q_SOMETHING_NEW", "type": "yesno", "value": True, "state": "answered", "flagged": True}],
     "RED_FLAG", ["INPUT_INVALID"])
case("basics_unrecognised_value", "An unrecognised basics answer fails closed",
     canon() + [how("gradually")], "RED_FLAG", ["INPUT_INVALID"])
case("basics_bad_state", "A basics answer with an unrecognised state fails closed",
     canon() + [{"questionId": "Q_BASICS_HOW", "type": "chooseone", "value": "slowly", "state": "done"}],
     "RED_FLAG", ["INPUT_INVALID"])
case("invalid_canonical_among_app_answers", "A malformed canonical answer fails closed even with valid app answers",
     [dict(a, value="false") if a["questionId"] == "chest" else a for a in canon()] + [app("Q_ST_NUMB", False)],
     "RED_FLAG", ["INPUT_INVALID"])

# ---------------------------------------------------------------- raw movement results (server derives the signals)
case("raw_unable_movement", "Raw unableToDo with canonical negatives asks the 'unable' follow-up; it is not SAFE",
     canon(), "CLARIFY", ["U_unable"], UNABLE)
case("raw_weak_movement", "Raw weakness with canonical negatives asks the unable, tingling and numb follow-ups",
     canon(), "CLARIFY", SENSORY, WEAK)
case("raw_unable_and_weak_movement", "Raw inability and weakness together ask the same three follow-ups",
     canon(), "CLARIFY", SENSORY, [move("sideways_raise", unableToDo=True, weak=True)])
case("raw_unknown_movement", "A movement answered 'not sure' asks the unable, tingling and numb follow-ups",
     canon(), "CLARIFY", SENSORY, [move("sideways_raise", "unknown")])
case("raw_skipped_among_done", "One unfinished movement among completed ones still asks the follow-ups",
     canon(), "CLARIFY", SENSORY, [move("sideways_raise"), move("belly_press", "skipped")])
case("derived_negative_never_clears_missing", "A completed movement never stands in for a missing canonical answer",
     canon(missing=["unable"]), "CLARIFY", ["M_unable"], [move("sideways_raise")])

# ---------------------------------------------------------------- app answers
case("app_unable_signal", "An app-sent inability signal asks the 'unable' follow-up",
     canon() + [app("Q_UNABLE_TO_MOVE_ARM", True)], "CLARIFY", ["U_unable"])
case("app_onset_without_basics", "A combined onset signal without its basics answer asks injury and sudden",
     canon() + [app("Q_ONSET_SUDDEN_TRAUMA", True)], "CLARIFY", ["U_injury", "U_sudden"])
case("basics_after_injury", "Basics 'after an injury' asks only the injury follow-up",
     canon() + [how("after_injury")], "CLARIFY", ["U_injury"])
case("basics_suddenly", "Basics 'suddenly' asks only the sudden follow-up",
     canon() + [how("suddenly")], "CLARIFY", ["U_sudden"])
case("basics_unknown", "Basics 'not sure' asks the injury and sudden follow-ups",
     canon() + [how(None)], "CLARIFY", ["U_injury", "U_sudden"])
case("sensory_numb_yes", "Structure-type numbness asks unable, tingling and numb through the combined signal",
     canon() + [app("Q_ST_NUMB", True)], "CLARIFY", SENSORY)
case("sensory_tingle_unknown", "Structure-type tingling 'not sure' asks unable, tingling and numb",
     canon() + [app("Q_ST_TINGLE", None)], "CLARIFY", SENSORY)
case("bone_point_after_injury", "A sore bone spot with an injury onset asks the injury follow-up",
     canon() + [how("after_injury"), app("Q_ST_BONE_POINT", True)], "CLARIFY", ["U_injury"])
case("bone_point_without_onset", "A sore bone spot with no onset answer is uncertain and asks the injury follow-up",
     canon() + [app("Q_ST_BONE_POINT", True)], "CLARIFY", ["U_injury"])
case("only_app_answers", "App answers alone are not a completed safety screen",
     [app("Q_ST_NUMB", False), app("Q_ST_TINGLE", False)], "CLARIFY", [f"M_{q['questionId']}" for q in REQUIRED])

# ---------------------------------------------------------------- clarification, correction and changed evidence
case("partly_reviewed", "Answered follow-ups are resolved one by one; the unanswered one is still asked",
     canon(), "CLARIFY", ["U_tingling"], WEAK, reviewed=["unable", "numb"])
case("reviewed_but_not_sure", "A follow-up answered 'not sure' is still uncertain",
     canon(unknown=["numb"]), "CLARIFY", ["U_numb"], WEAK, reviewed=["unable", "numb", "tingling"])
case("reviewed_not_sure_after_clarification", "Uncertainty that persists after clarification stays CLARIFY (contract v1.1)",
     canon(clarified=["numb"]), "CLARIFY", ["U_numb"], WEAK, reviewed=["unable", "numb", "tingling"])
case("persistent_canonical_uncertainty", "Persistent canonical uncertainty without any app signal stays CLARIFY",
     canon(clarified=["chest"]), "CLARIFY", ["U_chest"])
case("changed_movement_evidence", "A new movement result is new evidence: earlier follow-up answers no longer resolve it",
     canon(), "CLARIFY", SENSORY, [*WEAK, move("belly_press")],
     stale={"answers": canon(), "movements": WEAK, "ids": ["unable", "numb", "tingling"]})
case("changed_signal_evidence", "A different app signal for the same question is new evidence",
     canon() + [how("suddenly")], "CLARIFY", ["U_sudden"],
     stale={"answers": canon() + [how(None)], "movements": [], "ids": ["injury", "sudden"]})
case("corrected_basics_keeps_other_review", "Correcting the basics answer leaves an unrelated resolved follow-up resolved",
     canon() + [how("after_injury")], "CLARIFY", ["U_injury"], UNABLE, reviewed=["unable"])
case("untrusted_review_record", "A review record with an arbitrary value resolves nothing",
     canon() + [{"questionId": "Q_SAFETY_REVIEW_unable", "type": "safety-review", "state": "answered", "value": "reviewed"}],
     "CLARIFY", ["U_unable"], UNABLE)
case("redness_without_infection_risk", "Redness makes infection risk required (contract v1.2)",
     canon(redness=True), "CLARIFY", ["M_infection_risk"])
case("redness_with_unknown_infection_risk", "Redness with 'not sure' about infection risk is not SAFE (contract v1.2)",
     canon(redness=True) + [risk(None)], "CLARIFY", ["U_infection_risk"])

# ---------------------------------------------------------------- safe
case("painful_movements_only", "Completed painful movements are narrowing input, not safety signals",
     canon(), "SAFE", [], [move("sideways_raise", painful=True), move("can_position_hold", painful=True)])
case("weak_movement_followups_answered_no", "Weakness with all three follow-ups answered 'no' for this evidence clears",
     canon(), "SAFE", [], WEAK, reviewed=["unable", "numb", "tingling"])
case("unable_movement_followup_answered_no", "One failed movement with 'unable = no' confirmed at the follow-up clears",
     canon(), "SAFE", [], UNABLE, reviewed=["unable"])
case("basics_after_injury_followup_answered_no", "Basics 'after an injury' with 'injury = no' confirmed at the follow-up clears",
     canon() + [how("after_injury")], "SAFE", [], reviewed=["injury"])
case("redundant_onset_with_basics", "A combined onset signal is ignored when the specific basics answer is present",
     canon() + [how("slowly"), app("Q_ONSET_SUDDEN_TRAUMA", True)], "SAFE", [])
case("sensory_both_no", "Structure-type numbness and tingling both 'no' raise no follow-up",
     canon() + [app("Q_ST_NUMB", False), app("Q_ST_TINGLE", False)], "SAFE", [], [move("sideways_raise")])
case("bone_point_with_slow_onset", "A sore bone spot with a slow onset raises no follow-up",
     canon() + [how("slowly"), app("Q_ST_BONE_POINT", True)], "SAFE", [])
case("ordinary_answers_ignored", "Ordinary app answers are not gate inputs",
     canon() + [how("slowly"), {"questionId": "Q_DQ_OVERHEAD", "type": "yesno", "value": True, "state": "answered"},
                {"questionId": "Q_DQ_NIGHT", "type": "yesno", "value": None, "state": "unknown"}], "SAFE", [])
case("redness_with_no_infection_risk", "Redness with an explicit 'no' to infection risk can clear (contract v1.2)",
     canon(redness=True) + [risk(False)], "SAFE", [])
case("no_app_answers", "Canonical all-clear screen with no app answers or movements", canon(), "SAFE", [])


if __name__ == "__main__":
    verdicts = [c["expectedVerdict"] for c in CASES]
    assert verdicts == sorted(verdicts, key=["RED_FLAG", "CLARIFY", "SAFE"].index), "danger cases must come first"
    assert len({c["caseId"] for c in CASES}) == len(CASES)
    document = {
        "schemaVersion": 2,
        "label": LABEL,
        "note": "Synthetic engineering fixtures for live app signals under the focused follow-up policy, not patient "
                "data or clinical validation. Inputs are raw: both platforms derive safety signals from the app "
                "answers and movement results. Expected verdicts and rule ids are specified independently of both "
                "evaluators in scripts/build_app_signal_cases.py. Follow-up mappings are conservative draft policy "
                "awaiting clinician review. Danger cases first.",
        "cases": CASES,
    }
    target = ROOT / "shared/app_signal_test_cases.json"
    target.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {len(CASES)} cases:", {v: verdicts.count(v) for v in ("RED_FLAG", "CLARIFY", "SAFE")})
