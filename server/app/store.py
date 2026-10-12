"""Database operations for intakes, sync events, gate runs and reports.

Every function takes an open connection, so each API request is one
transaction: an event is acknowledged only after it and its audit row are
committed. The gate is always recomputed from the stored answers; a verdict
sent by a client is never read.
"""

import hashlib
import json
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import Connection, insert, select

from app import db
from app.audit import build_row
from app.gate import CONTENT_VERSION, QUESTIONS
from app.narrowing import MOVEMENTS
from app.session_gate import (
    CANONICAL_IDS,
    COMPLETED_MOVEMENT_STATES,
    evaluate_session_gate,
)

SESSION_HOURS = 12
ROLES = ("patient", "doctor")


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return (value if value.tzinfo else value.replace(tzinfo=UTC)).astimezone(UTC).isoformat()


def request_hash(payload: Any) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


# ---------------------------------------------------------------- users and sessions


def upsert_user(c: Connection, user_id: str, role: str, display_name: str = "") -> dict[str, Any]:
    if role not in ROLES:
        raise ValueError(f"role must be one of {ROLES}")
    existing = c.execute(select(db.users).where(db.users.c.id == user_id)).mappings().first()
    if existing is None:
        c.execute(insert(db.users).values(id=user_id, role=role, display_name=display_name))
        return {"id": user_id, "role": role, "displayName": display_name}
    if existing["role"] != role:
        raise ValueError("user already exists with a different role")
    return {"id": existing["id"], "role": existing["role"], "displayName": existing["display_name"]}


def create_session(c: Connection, user_id: str) -> tuple[str, datetime]:
    """Return a new bearer token. Only its hash is stored."""
    token = secrets.token_urlsafe(32)
    expires = datetime.now(UTC) + timedelta(hours=SESSION_HOURS)
    c.execute(insert(db.sessions).values(
        token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=user_id, expires_at=expires))
    return token, expires


def user_for_token(c: Connection, token: str) -> dict[str, Any] | None:
    row = c.execute(
        select(db.users.c.id, db.users.c.role, db.users.c.display_name, db.sessions.c.expires_at)
        .join(db.sessions, db.sessions.c.user_id == db.users.c.id)
        .where(db.sessions.c.token_hash == hashlib.sha256(token.encode()).hexdigest())
    ).mappings().first()
    if row is None:
        return None
    expires = row["expires_at"] if row["expires_at"].tzinfo else row["expires_at"].replace(tzinfo=UTC)
    if expires <= datetime.now(UTC):
        return None
    return {"id": row["id"], "role": row["role"], "displayName": row["display_name"]}


# ---------------------------------------------------------------- intakes and events


def get_intake(c: Connection, intake_id: str) -> dict[str, Any] | None:
    row = c.execute(select(db.intakes).where(db.intakes.c.id == intake_id)).mappings().first()
    return dict(row) if row else None


def create_intake(c: Connection, intake_id: str, patient_id: str, content_version: str) -> None:
    c.execute(insert(db.intakes).values(id=intake_id, patient_id=patient_id, content_version=content_version))


def find_event(c: Connection, table, idempotency_key: str) -> dict[str, Any] | None:
    row = c.execute(select(table).where(table.c.idempotency_key == idempotency_key)).mappings().first()
    return dict(row) if row else None


def add_answer_event(c: Connection, event: dict[str, Any]) -> int:
    result = c.execute(insert(db.answer_events).values(
        idempotency_key=event["idempotencyKey"], intake_id=event["intakeId"],
        question_id=event["answer"]["questionId"], answer_json=json.dumps(event["answer"]),
        content_version=event["contentVersion"], request_hash=request_hash(event)))
    return result.inserted_primary_key[0]


def add_context_event(c: Connection, event: dict[str, Any]) -> int:
    result = c.execute(insert(db.context_events).values(
        idempotency_key=event["idempotencyKey"], intake_id=event["intakeId"],
        context_json=json.dumps(event["context"]), content_version=event["contentVersion"],
        request_hash=request_hash(event)))
    return result.inserted_primary_key[0]


def current_answers(c: Connection, intake_id: str) -> list[dict[str, Any]]:
    """The intake's assembled answers: the latest event for each question."""
    rows = c.execute(
        select(db.answer_events.c.question_id, db.answer_events.c.answer_json)
        .where(db.answer_events.c.intake_id == intake_id).order_by(db.answer_events.c.seq)
    ).all()
    latest: dict[str, Any] = {}
    for question_id, answer_json in rows:
        latest[question_id] = json.loads(answer_json)
    return list(latest.values())


def current_context(c: Connection, intake_id: str) -> dict[str, Any]:
    """The latest context snapshot: {regionId, appAnswers, movements}. Empty if none was synced."""
    row = c.execute(
        select(db.context_events.c.context_json).where(db.context_events.c.intake_id == intake_id)
        .order_by(db.context_events.c.seq.desc()).limit(1)
    ).first()
    return json.loads(row[0]) if row else {}


# ---------------------------------------------------------------- gate and audit


def gate_inputs(c: Connection, intake_id: str) -> tuple[Any, Any]:
    """(answers, movements) exactly as the session gate needs them. Malformed context stays malformed."""
    answers = current_answers(c, intake_id)
    context = current_context(c, intake_id)
    app_answers = context.get("appAnswers", [])
    movements = context.get("movements", [])
    if not isinstance(app_answers, list):
        return None, movements
    # Canonical answers come only from answer events; a copy inside the context snapshot is not a second answer.
    extra = [a for a in app_answers if not (isinstance(a, dict) and a.get("questionId") in CANONICAL_IDS)]
    return answers + extra, movements


def run_gate(c: Connection, intake_id: str, cause: str) -> dict[str, Any]:
    """Recompute the gate from stored data and write one audit row, whatever the verdict."""
    answers, movements = gate_inputs(c, intake_id)
    gate = evaluate_session_gate(answers, movements)
    row = build_row(intake_id, gate, answers)
    c.execute(insert(db.audit_log).values(
        intake_id=intake_id, cause=cause, verdict=row["verdict"],
        fired_rules_json=json.dumps(row["fired_rules"]),
        matched_answers_json=json.dumps(row["matched_answers"]), rule_version=row["rule_version"]))
    return gate


class DbAuditLog:
    """Audit log for the supervisor agent, backed by the audit_log table."""

    def __init__(self, c: Connection, cause: str = "agent") -> None:
        self._c, self._cause = c, cause

    def record(self, thread_id: str, gate: dict[str, Any], answers: list[dict[str, Any]]) -> dict[str, Any]:
        row = build_row(thread_id, gate, answers)
        self._c.execute(insert(db.audit_log).values(
            intake_id=thread_id, cause=self._cause, verdict=row["verdict"],
            fired_rules_json=json.dumps(row["fired_rules"]),
            matched_answers_json=json.dumps(row["matched_answers"]), rule_version=row["rule_version"]))
        return row


def record_doctor_action(c: Connection, intake_id: str, doctor_id: str, action: str) -> None:
    c.execute(insert(db.doctor_actions).values(intake_id=intake_id, doctor_id=doctor_id, action=action))


def history(c: Connection, intake_id: str) -> dict[str, Any]:
    """Everything recorded for one intake, oldest first."""
    gate_runs = [
        {"id": r["id"], "ts": _iso(r["ts"]), "cause": r["cause"], "verdict": r["verdict"],
         "firedRules": json.loads(r["fired_rules_json"]), "matchedAnswers": json.loads(r["matched_answers_json"]),
         "ruleVersion": r["rule_version"]}
        for r in c.execute(select(db.audit_log).where(db.audit_log.c.intake_id == intake_id)
                           .order_by(db.audit_log.c.id)).mappings()
    ]
    answer_history = [
        {"seq": r["seq"], "receivedAt": _iso(r["received_at"]), "questionId": r["question_id"],
         "answer": json.loads(r["answer_json"]), "contentVersion": r["content_version"],
         "idempotencyKey": r["idempotency_key"]}
        for r in c.execute(select(db.answer_events).where(db.answer_events.c.intake_id == intake_id)
                           .order_by(db.answer_events.c.seq)).mappings()
    ]
    context_history = [
        {"seq": r["seq"], "receivedAt": _iso(r["received_at"]), "context": json.loads(r["context_json"]),
         "contentVersion": r["content_version"], "idempotencyKey": r["idempotency_key"]}
        for r in c.execute(select(db.context_events).where(db.context_events.c.intake_id == intake_id)
                           .order_by(db.context_events.c.seq)).mappings()
    ]
    actions = [
        {"id": r["id"], "at": _iso(r["created_at"]), "doctorId": r["doctor_id"], "action": r["action"]}
        for r in c.execute(select(db.doctor_actions).where(db.doctor_actions.c.intake_id == intake_id)
                           .order_by(db.doctor_actions.c.id)).mappings()
    ]
    return {"intakeId": intake_id, "ruleVersion": CONTENT_VERSION, "gateRuns": gate_runs,
            "answerHistory": answer_history, "contextHistory": context_history, "doctorActions": actions}


# ---------------------------------------------------------------- facts for reports


def usable_movements(movements: Any) -> tuple[list[dict[str, Any]], list[str]]:
    """Movement results the server's narrowing tables know, in its format; and the ids it had to leave out."""
    usable, ignored, seen = [], [], set()
    for m in movements if isinstance(movements, list) else []:
        movement_id = m.get("movementId") if isinstance(m, dict) else None
        if movement_id not in MOVEMENTS or movement_id in seen:
            ignored.append(str(movement_id))
            continue
        seen.add(movement_id)
        flags = {key: m.get(key) for key in ("painful", "weak", "unableToDo")}
        complete = m.get("state") in COMPLETED_MOVEMENT_STATES and all(isinstance(v, bool) for v in flags.values())
        angle = m.get("measuredAngle")
        usable.append({
            "movementId": movement_id,
            **({k: v for k, v in flags.items()} if complete else {"painful": False, "weak": False, "unableToDo": False}),
            "measuredAngle": angle if isinstance(angle, (int, float)) and not isinstance(angle, bool) else None,
            "state": "answered" if complete else "unknown",
        })
    return usable, ignored


def _say(answer: dict[str, Any], unit: str = "") -> str:
    if answer.get("state") == "unknown":
        return "Not sure (after clarification)" if answer.get("clarificationAttempted") else "Not sure"
    value = answer.get("value")
    if isinstance(value, bool):
        return "Yes" if value else "No"
    return f"{value} {unit}".strip()


def facts(answers: Any, context: dict[str, Any]) -> list[dict[str, str]]:
    """What the patient reported, as label and value pairs for the doctor report."""
    by_id = {a["questionId"]: a for a in answers if isinstance(a, dict) and isinstance(a.get("questionId"), str)} \
        if isinstance(answers, list) else {}
    out = []
    region = context.get("regionId")
    out.append({"label": "Tapped region", "value": str(region) if region else "Not recorded"})
    for q in QUESTIONS:
        if q["questionId"] in by_id:
            out.append({"label": q["wording"], "value": _say(by_id.pop(q["questionId"]), q.get("unit", ""))})
        elif q["required"]:
            out.append({"label": q["wording"], "value": "Not answered"})
    for question_id, answer in by_id.items():
        out.append({"label": f"App answer {question_id}", "value": _say(answer)})
    for m in context.get("movements", []) if isinstance(context.get("movements"), list) else []:
        if not isinstance(m, dict):
            continue
        if m.get("state") not in COMPLETED_MOVEMENT_STATES:
            value = "Not completed or not sure"
        else:
            found = [name for key, name in (("painful", "painful"), ("weak", "weak"), ("unableToDo", "unable to do"))
                     if m.get(key) is True]
            value = ", ".join(found) or "no pain, weakness or inability reported"
            if isinstance(m.get("measuredAngle"), (int, float)) and not isinstance(m.get("measuredAngle"), bool):
                value += f"; measured angle {m['measuredAngle']}"
        out.append({"label": f"Movement {m.get('movementId')}", "value": value})
    return out
