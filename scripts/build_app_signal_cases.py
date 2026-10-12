"""Writes shared/app_signal_test_cases.json.

Expected verdicts and rule ids are stated by hand in this file, from
docs/safety-integration.md. Neither evaluator is imported or run here, so the
fixtures stay independent of both implementations. Synthetic cases only.
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
SIGNALS = (
    "Q_ONSET_SUDDEN_TRAUMA",
    "Q_UNABLE_TO_MOVE_ARM",
    "Q_BONE_TENDER_AFTER_TRAUMA",
    "Q_NUMB_OR_WEAK",
    "Q_ST_NUMB",
    "Q_ST_TINGLE",
)
CASES: list[dict] = []


def canon(unknown=(), clarified=(), missing=(), clarified_no=(), **changed):
    """The 16 required canonical answers, all 'no' unless stated."""
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
            if qid in clarified_no:
                record["clarificationAttempted"] = True
        out.append(record)
    return out


def app(question_id, value):
    """A yes/no app signal; value None means 'not sure'."""
    return {"questionId": question_id, "type": "yesno", "value": value, "state": "unknown" if value is None else "answered"}


def how(value):
    return {"questionId": "Q_BASICS_HOW", "type": "chooseone", "value": value, "state": "unknown" if value is None else "answered"}


def move(movement_id, state, **flags):
    return {"movementId": movement_id, "painful": False, "weak": False, "unableToDo": False,
            "measuredAngle": None, "state": state, **flags}


def review(question_id):
    return f"APP_REVIEW_{question_id}"


def case(case_id, description, answers, verdict, rule_ids, movements=()):
    entry = {"caseId": case_id, "description": description, "answers": answers, "movements": list(movements),
             "expectedVerdict": verdict, "expectedRuleIds": rule_ids}
    if verdict != "SAFE":
        entry["mustNotBe"] = "SAFE"
    CASES.append({**entry, "source": SOURCE, "label": LABEL})


# ---------------------------------------------------------------- danger first
for signal in SIGNALS:
    case(f"signal_{signal}", f"Positive app signal {signal} requires clinical review",
         canon() + [app(signal, True)], "RED_FLAG", [review(signal)])
case("basics_after_injury", "Basics answer 'after an injury' requires clinical review",
     canon() + [how("after_injury")], "RED_FLAG", [review("Q_BASICS_HOW")])
case("basics_suddenly", "Basics answer 'suddenly' requires clinical review",
     canon() + [how("suddenly")], "RED_FLAG", [review("Q_BASICS_HOW")])
case("canonical_and_signal", "Canonical danger and app signal are both recorded, canonical first",
     canon(chest=True) + [app("Q_UNABLE_TO_MOVE_ARM", True)], "RED_FLAG", ["R_chest", review("Q_UNABLE_TO_MOVE_ARM")])
case("two_signals_in_input_order", "Several positive app signals are listed in input order",
     canon() + [app("Q_ST_TINGLE", True), app("Q_ONSET_SUDDEN_TRAUMA", True)], "RED_FLAG",
     [review("Q_ST_TINGLE"), review("Q_ONSET_SUDDEN_TRAUMA")])
case("signal_with_skipped_movement", "Positive signal takes priority over uncertainty from a skipped movement",
     canon() + [app("Q_UNABLE_TO_MOVE_ARM", True)], "RED_FLAG",
     ["U_unable", "U_numb", review("Q_UNABLE_TO_MOVE_ARM")], [move("M1", "skipped")])
case("unknown_signal_after_clarification", "App uncertainty that persists after the canonical clarification requires clinical review",
     canon(clarified=["unable"]) + [app("Q_UNABLE_TO_MOVE_ARM", None)], "RED_FLAG", ["U_unable"])
case("unknown_signal_not_erased_by_clarified_no", "An unresolved app signal is not erased by a canonical 'no' given at clarification",
     canon(clarified_no=["unable"]) + [app("Q_UNABLE_TO_MOVE_ARM", None)], "RED_FLAG", ["U_unable"])
case("unknown_movement_after_clarification", "Unknown movement after clarification of inability and numbness requires clinical review",
     canon(clarified_no=["unable", "numb"]), "RED_FLAG", ["U_unable", "U_numb"], [move("M1", "done"), move("M2", "unknown")])
case("unknown_does_not_hide_reported_yes", "App uncertainty never replaces a reported canonical 'yes'",
     canon(injury=True) + [app("Q_BONE_TENDER_AFTER_TRAUMA", None)], "RED_FLAG", ["R_injury"])
case("alias_wrong_type", "App safety signal with the wrong type fails closed, and its reported 'yes' is still recorded",
     canon() + [{"questionId": "Q_UNABLE_TO_MOVE_ARM", "type": "choice", "value": True, "state": "answered"}],
     "RED_FLAG", ["INPUT_INVALID", review("Q_UNABLE_TO_MOVE_ARM")])
case("alias_wrong_type_negative", "App safety signal with the wrong type fails closed even when it says 'no'",
     canon() + [{"questionId": "Q_UNABLE_TO_MOVE_ARM", "type": "choice", "value": False, "state": "answered"}],
     "RED_FLAG", ["INPUT_INVALID"])
case("alias_string_boolean", "App safety signal with a string instead of a boolean fails closed",
     canon() + [{"questionId": "Q_ST_NUMB", "type": "yesno", "value": "true", "state": "answered"}],
     "RED_FLAG", ["INPUT_INVALID"])
case("alias_unknown_with_value", "App safety signal marked unknown but carrying a value fails closed",
     canon() + [{"questionId": "Q_ST_TINGLE", "type": "yesno", "value": False, "state": "unknown"}],
     "RED_FLAG", ["INPUT_INVALID"])
case("alias_bad_state", "App safety signal with an unrecognised state fails closed",
     canon() + [{"questionId": "Q_NUMB_OR_WEAK", "type": "yesno", "value": False, "state": "done"}],
     "RED_FLAG", ["INPUT_INVALID"])
case("unmapped_danger_question", "An unmapped Q_DANGER_ input fails closed instead of disappearing",
     canon() + [app("Q_DANGER_NEW", False)], "RED_FLAG", ["INPUT_INVALID"])
case("unmapped_flagged_answer", "An unmapped flagged answer fails closed instead of disappearing",
     canon() + [{"questionId": "Q_SOMETHING_NEW", "type": "yesno", "value": True, "state": "answered", "flagged": True}],
     "RED_FLAG", ["INPUT_INVALID"])
case("basics_unrecognised_value", "An unrecognised basics answer fails closed",
     canon() + [how("gradually")], "RED_FLAG", ["INPUT_INVALID"])
case("invalid_canonical_among_app_answers", "A malformed canonical answer fails closed even with valid app answers",
     [dict(a, value="false") if a["questionId"] == "chest" else a for a in canon()] + [app("Q_ST_NUMB", False)],
     "RED_FLAG", ["INPUT_INVALID"])
case("invalid_and_signal", "Invalid input and a positive app signal are both recorded",
     canon() + [app("Q_DANGER_NEW", False), app("Q_ST_NUMB", True)], "RED_FLAG", ["INPUT_INVALID", review("Q_ST_NUMB")])

# ---------------------------------------------------------------- uncertainty
case("unknown_onset", "Unknown onset asks the injury and sudden clarifications",
     canon() + [app("Q_ONSET_SUDDEN_TRAUMA", None)], "CLARIFY", ["U_injury", "U_sudden"])
case("unknown_unable", "Unknown inability asks the unable clarification",
     canon() + [app("Q_UNABLE_TO_MOVE_ARM", None)], "CLARIFY", ["U_unable"])
case("unknown_bone", "Unknown bone tenderness after trauma asks the injury clarification",
     canon() + [app("Q_BONE_TENDER_AFTER_TRAUMA", None)], "CLARIFY", ["U_injury"])
case("unknown_numb_or_weak", "Unknown numbness or weakness asks the numb clarification",
     canon() + [app("Q_NUMB_OR_WEAK", None)], "CLARIFY", ["U_numb"])
case("unknown_st_numb", "Unknown structure-type numbness asks the numb clarification",
     canon() + [app("Q_ST_NUMB", None)], "CLARIFY", ["U_numb"])
case("unknown_st_tingle", "Unknown structure-type tingling asks the tingling clarification",
     canon() + [app("Q_ST_TINGLE", None)], "CLARIFY", ["U_tingling"])
case("unknown_basics", "Unknown basics answer asks the injury and sudden clarifications",
     canon() + [how(None)], "CLARIFY", ["U_injury", "U_sudden"])
case("skipped_movement", "A skipped movement asks the unable and numb clarifications",
     canon(), "CLARIFY", ["U_unable", "U_numb"], [move("M1", "done"), move("M2", "skipped")])
case("unknown_movement", "A movement answered 'not sure' asks the unable and numb clarifications",
     canon(), "CLARIFY", ["U_unable", "U_numb"], [move("M1", "unknown")])
case("negative_signal_never_clears_missing", "A negative app signal never stands in for a missing canonical answer",
     canon(missing=["unable"]) + [app("Q_UNABLE_TO_MOVE_ARM", False)], "CLARIFY", ["M_unable"])
case("negative_signal_never_clears_unknown", "A negative app signal never resolves canonical uncertainty",
     canon(unknown=["numb"]) + [app("Q_ST_NUMB", False)], "CLARIFY", ["U_numb"])
case("only_app_answers", "App answers alone are not a completed safety screen",
     [app("Q_UNABLE_TO_MOVE_ARM", False), app("Q_NUMB_OR_WEAK", False)], "CLARIFY",
     [f"M_{q['questionId']}" for q in REQUIRED])

# ---------------------------------------------------------------- safe
case("all_negative_signals", "All app signals negative with completed movements",
     canon() + [app(signal, False) for signal in SIGNALS], "SAFE", [],
     [move("M1", "done"), move("M2", "answered", painful=True)])
case("ordinary_answers_ignored", "Ordinary app answers are not gate inputs",
     canon() + [how("slowly"), {"questionId": "Q_DQ_OVERHEAD", "type": "yesno", "value": True, "state": "answered"},
                {"questionId": "Q_DQ_NIGHT", "type": "yesno", "value": None, "state": "unknown"}], "SAFE", [])
case("no_app_answers", "Canonical all-clear screen with no app answers or movements", canon(), "SAFE", [])
case("completed_weak_movement_is_not_a_gate_signal_by_itself",
     "A completed painful or weak movement is narrowing input; the app derives Q_NUMB_OR_WEAK from it separately",
     canon(), "SAFE", [], [move("M1", "done", painful=True, weak=True)])


if __name__ == "__main__":
    verdicts = [c["expectedVerdict"] for c in CASES]
    assert verdicts == sorted(verdicts, key=["RED_FLAG", "CLARIFY", "SAFE"].index), "danger cases must come first"
    assert len({c["caseId"] for c in CASES}) == len(CASES)
    document = {
        "schemaVersion": 1,
        "label": LABEL,
        "note": "Synthetic engineering fixtures for live app signals, not patient data or clinical validation. "
                "Expected verdicts and rule ids are specified independently of both evaluators in "
                "scripts/build_app_signal_cases.py, from docs/safety-integration.md. APP_REVIEW_* policies are "
                "conservative engineering precautions awaiting clinician review. Danger cases first.",
        "cases": CASES,
    }
    target = ROOT / "shared/app_signal_test_cases.json"
    target.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {len(CASES)} cases:", {v: verdicts.count(v) for v in ("RED_FLAG", "CLARIFY", "SAFE")})
