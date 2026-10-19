"""Writes shared/gate_test_cases.json (gate contract v2: weighted triage with linked questions).

Expected verdicts, care levels, scores and fired rule ids are stated by hand in
this file from docs/gate-contract.md. Neither evaluator is imported or run, so
the fixtures stay independent of both implementations. Only the fixed text of
each rule (reason, source, level, points) is copied from the shared rule file.
Synthetic cases only. Danger cases come first.

Run from the repository root: python scripts/build_gate_cases.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES = {r["ruleId"]: r for r in json.loads((ROOT / "shared/gate_rules.json").read_text(encoding="utf-8"))["rules"]}
QUESTIONS = {q["questionId"]: q for q in json.loads((ROOT / "shared/questions_shoulder.json").read_text(encoding="utf-8"))["questions"]}
POLICY = "docs/gate-contract.md"
LABEL = "draft, awaiting clinician review"
REASONS = {
    "M": "Required safety answer is missing.",
    "U": "Safety answer is uncertain; ask the fixed clarification.",
    "U!": "Uncertainty persists after clarification; clinical review required.",
    "W": "Answer is uncertain; counted at half weight.",
    "INPUT_INVALID": "Invalid or conflicting answers; clinical review required.",
}
CASES: list[dict] = []


def ans(question_id, value):
    """One saved answer. value None means 'Not sure'; '?!' means 'Not sure' again after the clarification."""
    q = QUESTIONS[question_id]
    if value in (None, "?!"):
        record = {"questionId": question_id, "type": q["type"], "value": None, "state": "unknown"}
        if value == "?!":
            record["clarificationAttempted"] = True
        return record
    return {"questionId": question_id, "type": q["type"], "value": value, "state": "answered"}


BASE = {"chest": False, "breathing": False, "onset": "gradual", "unable": False,
        "sensation": False, "inflammation": False, "illness": False, "pain_score": 3}


def answers(drop=(), **changed):
    """The low-risk complete path (8 questions), with changes. Keys are added in question-bank order."""
    values = {**BASE, **changed}
    return [ans(qid, values[qid]) for qid in QUESTIONS if qid in values and qid not in drop]


def fired(rule_id):
    """Expected fired-rule entry. M_x, U_x (first 'Not sure'), U!_x (after clarification), W_x:points."""
    if rule_id == "INPUT_INVALID":
        return {"ruleId": rule_id, "matchedAnswers": [], "source": POLICY, "reason": REASONS[rule_id]}
    if rule_id.startswith("W_"):
        qid, points = rule_id[2:].split(":")
        return {"ruleId": f"W_{qid}", "matchedAnswers": [qid], "source": POLICY, "reason": REASONS["W"],
                "points": float(points) if "." in points else int(points)}
    for prefix in ("U!", "M", "U"):
        if rule_id.startswith(prefix + "_"):
            qid = rule_id[len(prefix) + 1:]
            return {"ruleId": f"{prefix[0]}_{qid}", "matchedAnswers": [qid], "source": POLICY, "reason": REASONS[prefix]}
    rule = RULES[rule_id]
    item = {"ruleId": rule_id, "matchedAnswers": [c["questionId"] for c in rule["all"]],
            "source": rule["source"], "reason": rule["description"]}
    if "level" in rule:
        item["level"] = rule["level"]
    else:
        item["points"] = rule["points"]
    return item


def case(case_id, description, given, verdict, level, score, rule_ids):
    CASES.append({
        "caseId": case_id, "description": description, "answers": given,
        "expectedVerdict": verdict, "expectedLevel": level, "expectedScore": score,
        "expectedOutput": {"verdict": verdict, "level": level, "score": score, "firedRules": [fired(r) for r in rule_ids]},
        **({"mustNotBe": "SAFE"} if verdict != "SAFE" else {}),
        "source": POLICY, "label": LABEL,
    })


SENSATION_NO_DETAILS = {"sensation": True, "numb": False, "tingling": "none", "temperature": "normal"}
INFLAMMATION_NO_DETAILS = {"inflammation": True, "temperature": "normal", "swelling": "none", "redness": False, "fever": False}

# ---------------------------------------------------------------- emergency and urgent hard stops
case("emergency_chest", "Chest tightness is an emergency on its own", answers(chest=True),
     "RED_FLAG", "EMERGENCY", 0, ["E_chest"])
case("emergency_breathing", "Struggling to breathe is an emergency on its own", answers(breathing=True),
     "RED_FLAG", "EMERGENCY", 0, ["E_breathing"])
case("emergency_outranks_urgent", "An emergency sign outranks an urgent one; both are listed",
     answers(chest=True, unable=True), "RED_FLAG", "EMERGENCY", 0, ["E_chest", "H_unable"])
case("urgent_unable", "Cannot move the arm at all is urgent on its own", answers(unable=True),
     "RED_FLAG", "URGENT", 0, ["H_unable"])
case("urgent_shape_after_injury", "Changed shape after an injury is urgent; the injury points are listed",
     answers(onset="injury", shape=True), "RED_FLAG", "URGENT", 2, ["H_shape", "P_onset_injury"])
case("urgent_numb", "No feeling in the arm is urgent", answers(**{**SENSATION_NO_DETAILS, "numb": True}),
     "RED_FLAG", "URGENT", 0, ["H_numb"])
case("urgent_tingling_persistent", "Pins and needles that do not go away are urgent",
     answers(**{**SENSATION_NO_DETAILS, "tingling": "persistent"}), "RED_FLAG", "URGENT", 0, ["H_tingling_persistent"])
case("urgent_cold_arm", "An arm cold to touch is urgent",
     answers(**{**SENSATION_NO_DETAILS, "temperature": "cold"}), "RED_FLAG", "URGENT", 0, ["H_temperature_cold"])
case("urgent_badly_swollen", "A badly swollen shoulder is urgent",
     answers(**{**INFLAMMATION_NO_DETAILS, "swelling": "severe"}), "RED_FLAG", "URGENT", 0, ["H_swelling_severe"])
case("urgent_fever_red_joint", "Fever with a red joint is urgent; its points are listed too",
     answers(**{**INFLAMMATION_NO_DETAILS, "redness": True, "infection_risk": False, "fever": True}),
     "RED_FLAG", "URGENT", 3, ["H_fever_redness", "P_fever", "P_redness"])
case("urgent_infection_risk_red_joint", "Infection risk with a red joint is urgent",
     answers(**{**INFLAMMATION_NO_DETAILS, "redness": True, "infection_risk": True}),
     "RED_FLAG", "URGENT", 1, ["H_infection_risk_redness", "P_redness"])
case("urgent_detail_counts_after_gateway_no", "A saved danger answer still counts after its opening question changes to No",
     answers(numb=True), "RED_FLAG", "URGENT", 0, ["H_numb"])
case("urgent_danger_outranks_missing", "Danger outranks missing answers, which are still listed",
     answers(drop=("sensation",), unable=True), "RED_FLAG", "URGENT", 0, ["H_unable", "M_sensation"])

# ---------------------------------------------------------------- urgent from points (two signs or more)
case("urgent_points_injury_very_bad_pain", "Injury plus very bad pain reach the urgent threshold",
     answers(onset="injury", shape=False, pain_score=9, bilateral=False),
     "RED_FLAG", "URGENT", 4, ["P_onset_injury", "P_pain_very_bad"])
case("urgent_points_sudden_very_bad_pain", "Sudden start plus very bad pain reach the urgent threshold",
     answers(onset="sudden", shape=False, pain_score=8, bilateral=False),
     "RED_FLAG", "URGENT", 4, ["P_onset_sudden", "P_pain_very_bad"])
case("urgent_points_add_up", "Several smaller signs add up to urgent",
     answers(**{**INFLAMMATION_NO_DETAILS, "temperature": "hot", "swelling": "mild"}, pain_score=6, bilateral=False),
     "RED_FLAG", "URGENT", 4, ["P_pain_moderate", "P_temperature_hot", "P_swelling_mild"])
case("urgent_points_fever_and_cancer", "Fever plus a history of cancer reach the urgent threshold",
     answers(**{**INFLAMMATION_NO_DETAILS, "fever": True}, illness=True, systemic=False, cancer=True),
     "RED_FLAG", "URGENT", 4, ["P_fever", "P_cancer"])

# ---------------------------------------------------------------- invalid input fails closed
case("input_invalid_string_boolean", "A string 'true' is not a yes/no answer",
     [*answers(drop=("chest",)), {"questionId": "chest", "type": "yesno", "value": "true", "state": "answered"}],
     "RED_FLAG", "URGENT", 0, ["INPUT_INVALID"])
case("input_invalid_duplicate", "Two answers to one question fail closed",
     [*answers(), ans("chest", True)], "RED_FLAG", "URGENT", 0, ["INPUT_INVALID"])
case("input_invalid_old_content", "A shoulder-2 question id (injury) fails closed; old intakes need a new assessment",
     [*answers(), {"questionId": "injury", "type": "yesno", "value": False, "state": "answered"}],
     "RED_FLAG", "URGENT", 0, ["INPUT_INVALID"])
case("input_invalid_choice", "A choice outside the declared options fails closed",
     answers(onset="slowly"), "RED_FLAG", "URGENT", 0, ["INPUT_INVALID"])

# ---------------------------------------------------------------- clarify: missing or uncertain hard-stop answers
case("missing_everything", "No answers: the eight always-asked questions are missing", [],
     "CLARIFY", None, 0, ["M_chest", "M_breathing", "M_onset", "M_unable", "M_sensation", "M_inflammation",
                          "M_illness", "M_pain_score"])
case("unknown_chest_first", "A first Not sure on a hard-stop question asks the clarification",
     answers(chest=None), "CLARIFY", None, 0, ["U_chest"])
case("unknown_chest_persistent", "Not sure again after the clarification stays CLARIFY",
     answers(chest="?!"), "CLARIFY", None, 0, ["U!_chest"])
case("unknown_unable_persistent", "Persistent Not sure about moving the arm stays CLARIFY",
     answers(unable="?!"), "CLARIFY", None, 0, ["U!_unable"])
case("gateway_yes_opens_details", "A Yes to an opening question asks its detail questions",
     answers(sensation=True), "CLARIFY", None, 0, ["M_numb", "M_tingling", "M_temperature"])
case("gateway_unknown_opens_details", "A Not sure to an opening question asks its details instead of blocking",
     answers(sensation=None), "CLARIFY", None, 0, ["M_numb", "M_tingling", "M_temperature"])
case("unknown_numb_persistent", "Persistent Not sure about feeling stays CLARIFY",
     answers(**{**SENSATION_NO_DETAILS, "numb": "?!"}), "CLARIFY", None, 0, ["U!_numb"])
case("redness_asks_infection_risk", "A red joint asks the infection-risk question",
     answers(**{**INFLAMMATION_NO_DETAILS, "redness": True}), "CLARIFY", None, 1, ["P_redness", "M_infection_risk"])
case("redness_unknown_asks_infection_risk", "Not sure about redness counts half and still asks infection risk",
     answers(**{**INFLAMMATION_NO_DETAILS, "redness": None}), "CLARIFY", None, 0.5,
     ["W_redness:0.5", "M_infection_risk"])
case("infection_risk_unknown_persistent", "Persistent Not sure about infection risk with redness stays CLARIFY",
     answers(**{**INFLAMMATION_NO_DETAILS, "redness": True, "infection_risk": "?!"}), "CLARIFY", None, 1,
     ["P_redness", "U!_infection_risk"])
case("injury_asks_shape", "An injury start asks about changed shape", answers(onset="injury"),
     "CLARIFY", None, 2, ["P_onset_injury", "M_shape"])
case("unknown_onset_asks_shape", "Not sure how it started counts half and asks about changed shape",
     answers(onset=None), "CLARIFY", None, 1, ["W_onset:1", "M_shape"])
case("strong_pain_asks_both_shoulders", "A pain score of 6 or more asks about both shoulders",
     answers(pain_score=7), "CLARIFY", None, 1, ["P_pain_moderate", "M_bilateral"])
case("unknown_pain_asks_both_shoulders", "Not sure about the pain score counts half and asks about both shoulders",
     answers(pain_score=None), "CLARIFY", None, 1, ["W_pain_score:1", "M_bilateral"])

# ---------------------------------------------------------------- safe: soon (one sign) or routine
case("routine_low_risk", "Low-risk complete path: eight answers, no signs", answers(),
     "SAFE", "ROUTINE", 0, [])
case("routine_one_minor_sign", "A little swelling alone stays routine",
     answers(**{**INFLAMMATION_NO_DETAILS, "swelling": "mild"}), "SAFE", "ROUTINE", 1, ["P_swelling_mild"])
case("routine_tingling_comes_goes", "Pins and needles that come and go alone stay routine",
     answers(**{**SENSATION_NO_DETAILS, "tingling": "comes_goes"}), "SAFE", "ROUTINE", 1, ["P_tingling_comes_goes"])
case("routine_gateway_unknown_resolved", "Not sure on an opening question, then No to every detail, is routine",
     answers(**{**SENSATION_NO_DETAILS, "sensation": None}), "SAFE", "ROUTINE", 0, [])
case("routine_uncertain_weighted_half", "Not sure about fever counts half and does not block",
     answers(**{**INFLAMMATION_NO_DETAILS, "fever": None}), "SAFE", "ROUTINE", 1, ["W_fever:1"])
case("routine_context_answers", "Optional context answers never change the result",
     [*answers(), ans("duration", 10), ans("side", "left")], "SAFE", "ROUTINE", 0, [])
case("routine_context_unknown", "Not sure on optional context never blocks",
     [*answers(), ans("duration", None)], "SAFE", "ROUTINE", 0, [])
case("soon_injury_only", "An injury start alone means see a doctor soon",
     answers(onset="injury", shape=False), "SAFE", "SOON", 2, ["P_onset_injury"])
case("soon_sudden_only", "A sudden start alone means see a doctor soon",
     answers(onset="sudden", shape=False), "SAFE", "SOON", 2, ["P_onset_sudden"])
case("soon_very_bad_pain_only", "Very bad pain alone means see a doctor soon",
     answers(pain_score=9, bilateral=False), "SAFE", "SOON", 2, ["P_pain_very_bad"])
case("soon_fever_only", "Feeling feverish alone means see a doctor soon",
     answers(**{**INFLAMMATION_NO_DETAILS, "fever": True}), "SAFE", "SOON", 2, ["P_fever"])
case("soon_hot_only", "A hot shoulder alone means see a doctor soon",
     answers(**{**INFLAMMATION_NO_DETAILS, "temperature": "hot"}), "SAFE", "SOON", 2, ["P_temperature_hot"])
case("soon_cancer_history", "A history of cancer alone means see a doctor soon",
     answers(illness=True, systemic=False, cancer=True), "SAFE", "SOON", 2, ["P_cancer"])
case("soon_systemic_only", "Unexplained weight loss alone means see a doctor soon",
     answers(illness=True, systemic=True, cancer=False), "SAFE", "SOON", 2, ["P_systemic"])
case("soon_both_shoulders", "Severe pain in both shoulders with a strong score means see a doctor soon",
     answers(pain_score=6, bilateral=True), "SAFE", "SOON", 3, ["P_pain_moderate", "P_bilateral"])
case("soon_two_uncertain_answers", "Two uncertain weighted answers add up to soon without blocking",
     answers(illness=True, systemic=None, cancer=None), "SAFE", "SOON", 2, ["W_systemic:1", "W_cancer:1"])


def main():
    out = {
        "schemaVersion": 2,
        "label": LABEL,
        "note": "Generated by scripts/build_gate_cases.py. Expected outputs are stated by hand; edit that script, not this file.",
        "cases": CASES,
    }
    (ROOT / "shared/gate_test_cases.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(CASES)} cases.")


if __name__ == "__main__":
    main()
