"""Writes docs/triage-scenarios.md: realistic fictional cases and the care level each one gets (gate contract v2).

For supervisor and doctor review. The table is produced by the real Python
gate (server/app/gate.py), which the parity check keeps identical to the app.
Reviewers mark a row as wrong; the points or thresholds in
shared/gate_rules.json are then changed and this file is rebuilt.

Run from the repository root: python scripts/build_triage_scenarios.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))
from app.gate import QUESTIONS, THRESHOLDS, evaluate, is_asked_question  # noqa: E402

LOW_RISK = {"chest": False, "breathing": False, "onset": "gradual", "unable": False,
            "sensation": False, "inflammation": False, "illness": False, "pain_score": 3}
LEVEL_TEXT = {"EMERGENCY": "Emergency: call 1122", "URGENT": "Urgent: doctor today", "SOON": "Soon: doctor in a few days",
              "ROUTINE": "Routine: full assessment", None: "Unclear: more answers or a doctor"}
SCENARIOS = [
    ("Gradual ache after gardening, no other signs", {}),
    ("Gradual ache, pain 5", {"pain_score": 5}),
    ("Gradual ache, a little swelling only", {"inflammation": True, "temperature": "normal", "swelling": "mild", "redness": False, "fever": False}),
    ("Gradual ache, pins and needles that come and go", {"sensation": True, "numb": False, "tingling": "comes_goes", "temperature": "normal"}),
    ("Gradual ache, red skin, no fever, no infection risk", {"inflammation": True, "temperature": "normal", "swelling": "none", "redness": True,
                                                             "infection_risk": False, "fever": False}),
    ("Minor fall, arm moves, pain 4", {"onset": "injury", "shape": False, "pain_score": 4}),
    ("Woke up with sudden pain, pain 5", {"onset": "sudden", "shape": False, "pain_score": 5}),
    ("Gradual ache, pain 9", {"pain_score": 9, "bilateral": False}),
    ("Gradual ache, strong pain 7, both shoulders severe", {"pain_score": 7, "bilateral": True}),
    ("Gradual ache, feels feverish, shoulder not red", {"inflammation": True, "temperature": "normal", "swelling": "none", "redness": False, "fever": True}),
    ("Gradual ache, shoulder hot to touch", {"inflammation": True, "temperature": "hot", "swelling": "none", "redness": False, "fever": False}),
    ("Gradual ache, past cancer, no weight loss", {"illness": True, "systemic": False, "cancer": True}),
    ("Gradual ache, unexplained weight loss", {"illness": True, "systemic": True, "cancer": False}),
    ("Gradual ache, not sure about weight loss or cancer", {"illness": True, "systemic": None, "cancer": None}),
    ("Fall, pain 9", {"onset": "injury", "shape": False, "pain_score": 9, "bilateral": False}),
    ("Sudden pain, pain 8", {"onset": "sudden", "shape": False, "pain_score": 8, "bilateral": False}),
    ("Fall, hot and a little swollen", {"onset": "injury", "shape": False, "inflammation": True, "temperature": "hot", "swelling": "mild",
                                        "redness": False, "fever": False}),
    ("Feverish with past cancer", {"inflammation": True, "temperature": "normal", "swelling": "none", "redness": False, "fever": True,
                                   "illness": True, "systemic": False, "cancer": True}),
    ("Fall, shoulder changed shape", {"onset": "injury", "shape": True}),
    ("Cannot move the arm at all", {"unable": True}),
    ("No feeling in part of the arm", {"sensation": True, "numb": True, "tingling": "none", "temperature": "normal"}),
    ("Pins and needles that do not go away", {"sensation": True, "numb": False, "tingling": "persistent", "temperature": "normal"}),
    ("Arm cold to touch", {"sensation": True, "numb": False, "tingling": "none", "temperature": "cold"}),
    ("Badly swollen shoulder", {"inflammation": True, "temperature": "normal", "swelling": "severe", "redness": False, "fever": False}),
    ("Red shoulder and feverish", {"inflammation": True, "temperature": "normal", "swelling": "none", "redness": True, "infection_risk": False,
                                   "fever": True}),
    ("Red shoulder after a joint injection", {"inflammation": True, "temperature": "normal", "swelling": "none", "redness": True,
                                              "infection_risk": True, "fever": False}),
    ("Chest tightness with shoulder pain", {"chest": True}),
    ("Struggling to breathe", {"breathing": True}),
    ("Not sure about chest tightness, twice", {"chest": "?!"}),
    ("Not sure how it started, no other signs", {"onset": None, "shape": False}),
    ("Not sure whether the arm can move, even with the simpler question", {"unable": "?!"}),
    ("Not sure about feeling and swelling, even with the simpler questions", {"sensation": True, "numb": "?!", "tingling": "none", "temperature": "normal",
                                                                              "inflammation": True, "swelling": "?!", "redness": False, "fever": False}),
]


def answers(changes):
    values = {**LOW_RISK, **changes}
    out = []
    for q in QUESTIONS:
        if q["questionId"] not in values:
            continue
        value = values[q["questionId"]]
        record = {"questionId": q["questionId"], "type": q["type"], "value": None if value in (None, "?!") else value,
                  "state": "unknown" if value in (None, "?!") else "answered"}
        if value == "?!":
            record["clarificationAttempted"] = True
        out.append(record)
    return out


def questions_seen(given):
    """How many questions the questionnaire shows, in its order, stopping at the first urgent or emergency result."""
    by_id = {a["questionId"]: a for a in given}
    shown = []
    while True:
        nxt = next((q for q in QUESTIONS if is_asked_question(q, shown) and all(a["questionId"] != q["questionId"] for a in shown)), None)
        if nxt is None or nxt["questionId"] not in by_id:
            return len(shown)
        shown.append(by_id[nxt["questionId"]])
        out = evaluate(shown)
        unclear = any(r["ruleId"].startswith("U_") and r["reason"].startswith("Uncertainty persists") for r in out["firedRules"])
        if out["verdict"] == "RED_FLAG" or unclear:  # the app stops here (urgent, or the unclear screen)
            return len(shown)


def why(output):
    parts = []
    for rule in output["firedRules"]:
        if "level" in rule:
            parts.append(f"{rule['reason'].split(':')[0]} (stop)")
        elif rule["ruleId"].startswith("N_"):
            parts.append(rule["reason"])
        elif rule["ruleId"].startswith("W_"):
            parts.append(f"not sure: {rule['matchedAnswers'][0]} (+{rule['points']:g})")
        elif "points" in rule:
            parts.append(f"{rule['reason'].rstrip('.')} (+{rule['points']:g})")
        elif rule["ruleId"].startswith("U_"):
            parts.append(f"not sure about {rule['matchedAnswers'][0]}")
    return "; ".join(parts) or "no signs"


def main():
    rows = []
    for i, (title, changes) in enumerate(SCENARIOS, 1):
        given = answers(changes)
        out = evaluate(given)
        asked = questions_seen(given)
        rows.append(f"| {i} | {title} | {asked} | {LEVEL_TEXT[out['level']]} | {out['score']:g} | {why(out)} | |")
    text = f"""# Care-level scenarios for review

Status: draft, awaiting clinician review. Demo only, not for real patients. Fictional cases.

Generated by `scripts/build_triage_scenarios.py` from the real gate (contract v2). Do not edit by hand.

**How to review:** for each row, write OK or the level it should be in the last column. We then change the
draft points or thresholds in `shared/gate_rules.json` and rebuild this table. Current thresholds: **{THRESHOLDS['SOON']:g}
or more points = Soon**, **{THRESHOLDS['URGENT']:g} or more = Urgent**. Emergency and Urgent stops ignore points.

| Level | Meaning in the app |
| --- | --- |
| Emergency | Call 1122 now; the flow stops. |
| Urgent | See a doctor today; the flow stops. |
| Soon | See a doctor in the next few days; questions continue, the movement checks are skipped. |
| Routine | No warning signs; full assessment with movements. |
| Unclear | Chest or breathing still "not sure", or two or more key answers still "not sure" after their simpler questions; see a doctor. |

"Questions" counts the safety questions this patient sees, in the app's order, stopping at the first urgent
or emergency result, or where uncertainty stops the check; it includes any filled from the earlier basics screen.
The low-risk path is 8 (7 when the basics already say how it started, 6 when they also give the pain score).

| # | Fictional case | Questions | Level | Points | Why | Reviewer |
| --- | --- | --- | --- | --- | --- | --- |
""" + "\n".join(rows) + "\n"
    (ROOT / "docs/triage-scenarios.md").write_text(text, encoding="utf-8")
    print(f"Wrote {len(rows)} scenarios.")


if __name__ == "__main__":
    main()
