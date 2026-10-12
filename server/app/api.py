"""HTTP API. Demo only, not for real patients. Contracts are documented in docs/server-api.md.

Rules enforced here, on the server, whatever the client says:
- every request except /health and dev login needs a bearer token;
- a patient can only reach their own intakes;
- the gate is recomputed from stored answers before anything else runs;
- narrowing, ranking and the write-up run only when that gate is SAFE;
- the differential is returned to doctor accounts only.
"""

# ruff: noqa: B008 - Depends() and Body() in argument defaults are how FastAPI declares inputs

import os
from datetime import UTC, datetime
from typing import Any

from fastapi import Body, Depends, FastAPI, Header, HTTPException
from sqlalchemy import Engine
from sqlalchemy.exc import IntegrityError

from app import db, store
from app.gate import CONTENT_VERSION, is_valid_answer
from app.narrowing import narrow
from app.ranking import rank
from app.report import BANNER, REFERRAL, build_patient_report
from app.writeup import LABEL, LLM, write_doctor_summary

INCOMPLETE = "Please finish the safety questions before continuing."


def error(status: int, code: str, message: str) -> HTTPException:
    headers = {"WWW-Authenticate": "Bearer"} if status == 401 else None
    return HTTPException(status_code=status, detail={"code": code, "message": message}, headers=headers)


def _text(value: Any, limit: int = 200) -> bool:
    return isinstance(value, str) and 0 < len(value.strip()) <= limit


def _check_envelope(event: dict[str, Any], body_key: str) -> None:
    if not (_text(event.get("idempotencyKey")) and _text(event.get("intakeId")) and _text(event.get("contentVersion"), 100)):
        raise error(422, "EVENT_MALFORMED", "idempotencyKey, intakeId and contentVersion are required strings.")
    if not isinstance(event.get(body_key), dict):
        raise error(422, "EVENT_MALFORMED", f"{body_key} must be an object.")
    if event["contentVersion"] != CONTENT_VERSION:
        raise error(409, "CONTENT_VERSION_MISMATCH",
                    f"Server safety content is {CONTENT_VERSION}; the event was written for {event['contentVersion']}. "
                    "Keep the event queued and update the app.")


def create_app(database_url: str | None = None, dev_login: bool | None = None, writer: LLM | None = None) -> FastAPI:
    engine: Engine = db.make_engine(database_url)
    allow_dev_login = os.environ.get("SHIFA_DEV_LOGIN") == "1" if dev_login is None else dev_login
    app = FastAPI(title="ShifaKinetix server", description="Demo only, not for real patients.")
    app.state.engine = engine

    # ------------------------------------------------------------ identity

    def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        scheme, _, token = (authorization or "").partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise error(401, "NOT_AUTHENTICATED", "Send 'Authorization: Bearer <token>'.")
        with engine.connect() as c:
            user = store.user_for_token(c, token.strip())
        if user is None:
            raise error(401, "NOT_AUTHENTICATED", "The token is unknown or has expired.")
        return user

    def doctor(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        if user["role"] != "doctor":
            raise error(403, "DOCTOR_ONLY", "This is available to doctor accounts only.")
        return user

    def patient(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        if user["role"] != "patient":
            raise error(403, "PATIENT_ONLY", "Only the patient's own account can sync an intake.")
        return user

    def readable_intake(c, intake_id: str, user: dict[str, Any]) -> dict[str, Any]:
        intake = store.get_intake(c, intake_id)
        if user["role"] == "patient" and (intake is None or intake["patient_id"] != user["id"]):
            # Same answer for "not yours" and "does not exist", so intake ids cannot be probed.
            raise error(403, "NOT_YOUR_INTAKE", "This intake does not belong to your account.")
        if intake is None:
            raise error(404, "INTAKE_NOT_FOUND", "No intake with this id.")
        return intake

    # ------------------------------------------------------------ general

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/auth/dev-login")
    def dev_login_route(body: dict[str, Any] = Body(...)) -> dict[str, Any]:
        """Development only: issue a token for a named demo user. Off unless SHIFA_DEV_LOGIN=1."""
        if not allow_dev_login:
            raise error(404, "NOT_FOUND", "Not found.")
        if not _text(body.get("userId"), 100) or body.get("role") not in store.ROLES:
            raise error(422, "LOGIN_MALFORMED", "userId and role ('patient' or 'doctor') are required.")
        try:
            with engine.begin() as c:
                user = store.upsert_user(c, body["userId"].strip(), body["role"], str(body.get("displayName") or ""))
                token, expires = store.create_session(c, user["id"])
        except ValueError as problem:
            raise error(409, "ROLE_CONFLICT", str(problem)) from problem
        return {"token": token, "tokenType": "Bearer", "expiresAt": expires.isoformat(), "user": user}

    @app.get("/auth/me")
    def me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        return user

    # ------------------------------------------------------------ offline sync

    def sync(event: dict[str, Any], user: dict[str, Any], body_key: str, table, add) -> dict[str, Any]:
        _check_envelope(event, body_key)
        for attempt in (1, 2):
            try:
                with engine.begin() as c:
                    previous = store.find_event(c, table, event["idempotencyKey"])
                    if previous is not None:
                        if previous["request_hash"] != store.request_hash(event):
                            raise error(409, "IDEMPOTENCY_KEY_REUSED",
                                        "This idempotencyKey was already used for a different event.")
                        intake = store.get_intake(c, previous["intake_id"])
                        if intake is None or intake["patient_id"] != user["id"]:
                            raise error(403, "NOT_YOUR_INTAKE", "This intake does not belong to your account.")
                        gate = store.run_gate(c, previous["intake_id"], f"{body_key}_sync_retry")
                        return {"status": "duplicate", "eventSeq": previous["seq"], "gate": gate}
                    intake = store.get_intake(c, event["intakeId"])
                    if intake is None:
                        store.create_intake(c, event["intakeId"], user["id"], event["contentVersion"])
                    elif intake["patient_id"] != user["id"]:
                        raise error(403, "NOT_YOUR_INTAKE", "This intake does not belong to your account.")
                    seq = add(c, event)
                    gate = store.run_gate(c, event["intakeId"], f"{body_key}_sync")
                    return {"status": "stored", "eventSeq": seq, "gate": gate}
            except IntegrityError:
                # Two copies of the same event (or of an intake's first event) arrived together: retry once,
                # and the second pass finds the row the other request committed.
                if attempt == 2:
                    raise error(503, "TRY_AGAIN", "The event could not be saved. Keep it queued and retry.") from None
        raise AssertionError("unreachable")

    def acknowledged(event: dict[str, Any], outcome: dict[str, Any], **extra: Any) -> dict[str, Any]:
        return {
            "status": outcome["status"],  # "stored" or "duplicate": either way it is durably saved
            "idempotencyKey": event["idempotencyKey"],
            "intakeId": event["intakeId"],
            "eventSeq": outcome["eventSeq"],
            "contentVersion": CONTENT_VERSION,
            "serverTime": datetime.now(UTC).isoformat(),
            **extra,
            "gate": outcome["gate"],
        }

    @app.post("/sync/answers")
    def sync_answer(event: dict[str, Any] = Body(...), user: dict[str, Any] = Depends(patient)) -> dict[str, Any]:
        """Store one safety-answer event. Replies only after the event and its audit row are committed."""
        _check_envelope(event, "answer")
        if not _text(event["answer"].get("questionId")):
            raise error(422, "EVENT_MALFORMED", "answer.questionId is required.")
        outcome = sync(event, user, "answer", db.answer_events, store.add_answer_event)
        # An invalid answer is still stored and acknowledged, so the queue is never blocked by it;
        # the gate then fails closed (INPUT_INVALID) until a valid answer to that question arrives.
        return acknowledged(event, outcome, answerValid=is_valid_answer(event["answer"]))

    @app.post("/sync/context")
    def sync_context(event: dict[str, Any] = Body(...), user: dict[str, Any] = Depends(patient)) -> dict[str, Any]:
        """Store one context snapshot: {regionId, appAnswers, movements}. The latest snapshot is the current one."""
        outcome = sync(event, user, "context", db.context_events, store.add_context_event)
        return acknowledged(event, outcome)

    # ------------------------------------------------------------ reads

    @app.get("/intakes/{intake_id}/gate")
    def gate(intake_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        with engine.begin() as c:
            readable_intake(c, intake_id, user)
            return store.run_gate(c, intake_id, "gate_read")

    @app.get("/intakes/{intake_id}/report")
    def patient_report(intake_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        """Patient-safe report. Never contains the differential, a condition name or a score."""
        with engine.begin() as c:
            readable_intake(c, intake_id, user)
            verdict = store.run_gate(c, intake_id, "patient_report")["verdict"]
            context = store.current_context(c, intake_id)
        base = {"audience": "patient", "intakeId": intake_id, "banner": BANNER, "talkToDoctor": True}
        if verdict == "RED_FLAG":
            return {**base, "status": "REFER", "message": REFERRAL}
        if verdict == "CLARIFY":
            return {**base, "status": "INCOMPLETE", "message": INCOMPLETE}
        movements, _ = store.usable_movements(context.get("movements"))
        return {**base, "status": "READY", **build_patient_report(narrow(movements))}

    @app.get("/intakes/{intake_id}/doctor-report")
    def doctor_report(intake_id: str, user: dict[str, Any] = Depends(doctor)) -> dict[str, Any]:
        """Doctor-only report in the shape of mobile/src/reports/doctorReport.ts, plus optional extras."""
        with engine.begin() as c:
            readable_intake(c, intake_id, user)
            gate_output = store.run_gate(c, intake_id, "doctor_report")
            answers, _ = store.gate_inputs(c, intake_id)
            canonical = store.current_answers(c, intake_id)
            context = store.current_context(c, intake_id)
            store.record_doctor_action(c, intake_id, user["id"], "viewed_doctor_report")
        report: dict[str, Any] = {
            "audience": "doctor",
            "label": LABEL,
            "intakeId": intake_id,
            "facts": store.facts(answers, context),
            "gate": gate_output,
            "differential": [],
            "banner": BANNER,
            "downstream": "blocked_by_gate",
            "narrowing": None,
            "muscleNote": None,
            "movementsNotUsed": [],
        }
        if gate_output["verdict"] != "SAFE":
            return report  # no narrowing, ranking or model output for a patient the gate has stopped

        movements, ignored = store.usable_movements(context.get("movements"))
        try:
            ranking = rank(canonical, movements, context.get("regionId"))
        except ValueError:
            ranking = rank(canonical, movements, None)  # an unrecognised region is treated as not recorded
        narrowing = narrow(movements)
        write_up = write_doctor_summary(ranking, narrowing, writer)
        explained = {item["conditionId"]: item["explanation"] for item in write_up["items"]}
        report.update(
            downstream="ranked",
            narrowing=narrowing,
            muscleNote=write_up["muscleNote"],
            movementsNotUsed=ignored,
            writeUpBy=write_up["generatedBy"],
            differential=[
                {
                    "condition": item["name"],
                    "reason": f"{explained[item['conditionId']]} ({item['uncertainty']}.)",
                    "source": item["source"],
                    "conditionId": item["conditionId"],
                    "rank": position,
                    "flagged": item["flagged"],
                    "score": item["score"],
                    "matchedFacts": item["matchedFacts"],
                    "contradictedFacts": item["contradictedFacts"],
                    "unknownFacts": item["unknownFacts"],
                    "rankRationale": item["rankRationale"],
                    "label": item["label"],
                }
                for position, item in enumerate(ranking, start=1)
            ],
        )
        return report

    @app.get("/intakes/{intake_id}/audit")
    def audit(intake_id: str, user: dict[str, Any] = Depends(doctor)) -> dict[str, Any]:
        """Doctor-only history: every gate run, every answer as first given and as changed, every context snapshot."""
        with engine.begin() as c:
            readable_intake(c, intake_id, user)
            store.record_doctor_action(c, intake_id, user["id"], "viewed_audit")
            return store.history(c, intake_id)

    return app
