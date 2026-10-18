"""Create three clearly fake demo cases for the doctor screens. Demo only, not for real patients.

From the server folder:   .venv\\Scripts\\python -m app.seed_cases

The cases are saved through the same store functions the sync endpoints use, and the server's own gate decides each verdict
(nothing is hard-coded): one confirmed danger answer (RED_FLAG), one all-clear screen with movements (SAFE) and one screen
answered "Not sure" (CLARIFY). Running it again changes nothing: a case that already exists is left as it is.
"""

from sqlalchemy.engine import Engine

from app import db, store
from app.config import load_env
from app.gate import CONTENT_VERSION, QUESTIONS
from app.session_gate import evaluate_session_gate

SEED_PATIENT = "demo-seed-patient"
CASES = (
    ("demo-case-danger", "Danger: chest pressure reported"),
    ("demo-case-safe", "Safe: all safety answers clear, movements done"),
    ("demo-case-unsure", "Not sure: safety answers unclear"),
)
REQUIRED = [q for q in QUESTIONS if q["required"]]


def _answer(question_id: str, how: str) -> dict:
    q = next(q for q in QUESTIONS if q["questionId"] == question_id)
    if how == "unsure":
        return {"questionId": question_id, "type": q["type"], "value": None, "state": "unknown"}
    if how == "yes":
        return {"questionId": question_id, "type": q["type"], "value": True, "state": "answered"}
    # the low-risk answer to each always-asked question (contract v2)
    value = {"onset": "gradual", "pain_score": 3}.get(question_id, False)
    return {"questionId": question_id, "type": q["type"], "value": value, "state": "answered"}


def _movement(movement_id: str) -> dict:
    return {"movementId": movement_id, "painful": False, "weak": False, "unableToDo": False, "measuredAngle": None, "state": "done"}


def _answers_for(case_id: str) -> list[dict]:
    if case_id == "demo-case-danger":
        return [_answer(q["questionId"], "yes" if q["questionId"] == "chest" else "no") for q in REQUIRED]
    if case_id == "demo-case-unsure":
        return [_answer(q["questionId"], "unsure" if i % 2 == 0 else "no") for i, q in enumerate(REQUIRED)]
    return [_answer(q["questionId"], "no") for q in REQUIRED]


def _context_for(case_id: str) -> dict:
    movements = [_movement(m) for m in ("sideways_raise", "forward_raise")] if case_id == "demo-case-safe" else []
    return {"regionId": "shoulder_right_front", "appAnswers": [], "movements": movements}


def seed_cases(engine: Engine) -> list[tuple[str, str, str]]:
    """Create the three cases that do not exist yet. Returns (intakeId, label, verdict) for each, as the server's gate sees them."""
    results = []
    with engine.begin() as c:
        store.upsert_user(c, SEED_PATIENT, "patient", "Demo seed patient (fake)")
        for case_id, label in CASES:
            if store.get_intake(c, case_id) is None:
                store.create_intake(c, case_id, SEED_PATIENT, CONTENT_VERSION)
                for given in _answers_for(case_id):
                    store.add_answer_event(c, {"idempotencyKey": f"seed:{case_id}:{given['questionId']}", "intakeId": case_id,
                                               "contentVersion": CONTENT_VERSION, "answer": given})
                store.add_context_event(c, {"idempotencyKey": f"seed:{case_id}:context", "intakeId": case_id,
                                            "contentVersion": CONTENT_VERSION, "context": _context_for(case_id)})
                store.run_gate(c, case_id, "seed_cases")
            # read only: the audit log is append-only, so a second run must not add rows
            answers, movements = store.gate_inputs(c, case_id)
            verdict = evaluate_session_gate(answers, movements, store.reviewed_followups(c, case_id))["verdict"]
            results.append((case_id, label, verdict))
    return results


def main() -> None:
    load_env()
    for case_id, label, verdict in seed_cases(db.make_engine()):
        print(f"{case_id:<18} {verdict:<9} {label}")


if __name__ == "__main__":
    main()
