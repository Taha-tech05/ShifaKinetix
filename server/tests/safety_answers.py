"""Test helper: canonical safety answers for gate contract v2 (linked questions). Fictional values only."""

from app.gate import QUESTIONS

# The eight always-asked questions on the low-risk path: every answer gives no sign.
LOW_RISK = {
    "chest": False, "breathing": False, "onset": "gradual", "unable": False,
    "sensation": False, "inflammation": False, "illness": False, "pain_score": 3,
}
REQUIRED = [q for q in QUESTIONS if q["required"]]
REQUIRED_IDS = [q["questionId"] for q in REQUIRED]


def record(question_id, value, clarified=False):
    """One saved answer; value None means 'Not sure'."""
    q = next(q for q in QUESTIONS if q["questionId"] == question_id)
    out = {"questionId": question_id, "type": q["type"], "value": value, "state": "unknown" if value is None else "answered"}
    if clarified:
        out["clarificationAttempted"] = True
    return out


def answers(unknown=(), clarified=(), missing=(), **changed):
    """The low-risk complete path with changes, in question-bank order. Any question can be changed or added."""
    values = {**LOW_RISK, **changed}
    out = []
    for q in QUESTIONS:
        qid = q["questionId"]
        if qid in missing or not (qid in values or qid in unknown or qid in clarified):
            continue
        if qid in unknown or qid in clarified:
            out.append(record(qid, None, clarified=qid in clarified))
        else:
            out.append(record(qid, values[qid]))
    return out
