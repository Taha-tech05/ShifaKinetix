"""API tests: sync, idempotency, access control, server-side safety, audit. Synthetic cases only."""

import json
import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError

from app.api import create_app
from app.conditions import CONDITIONS
from app.db import APPEND_ONLY
from app.gate import CONTENT_VERSION, QUESTIONS

REQUIRED = [q for q in QUESTIONS if q["required"]]
LABEL = "draft, awaiting clinician review"


def fresh_database(tmp_path, name="test"):
    """An empty database for one test: a SQLite file, or a new PostgreSQL schema when TEST_DATABASE_URL is set."""
    server = os.environ.get("TEST_DATABASE_URL")
    if not server:
        return f"sqlite:///{tmp_path / f'{name}.db'}"
    schema = f"t_{uuid.uuid4().hex}"
    admin = create_engine(server)
    with admin.begin() as c:
        c.execute(text(f"CREATE SCHEMA {schema}"))
    admin.dispose()
    return f"{server}?options=-csearch_path%3D{schema}"


@pytest.fixture
def api(tmp_path):
    app = create_app(fresh_database(tmp_path), dev_login=True)
    with TestClient(app) as client:
        yield client
    app.state.engine.dispose()


def login(api, user_id, role):
    reply = api.post("/auth/dev-login", json={"userId": user_id, "role": role})
    assert reply.status_code == 200, reply.text
    return {"Authorization": f"Bearer {reply.json()['token']}"}


@pytest.fixture
def patient(api):
    return login(api, "patient-1", "patient")


@pytest.fixture
def doctor(api):
    return login(api, "doctor-1", "doctor")


def answer(question_id, value="no"):
    q = next(q for q in QUESTIONS if q["questionId"] == question_id)
    if value == "unsure":
        return {"questionId": question_id, "type": q["type"], "value": None, "state": "unknown"}
    if value == "no":
        value = False if q["type"] == "yesno" else "normal"
    return {"questionId": question_id, "type": q["type"], "value": value, "state": "answered"}


def event(intake, given, key=None):
    return {"idempotencyKey": key or str(uuid.uuid4()), "intakeId": intake, "contentVersion": CONTENT_VERSION, "answer": given}


def send(api, who, intake, given, key=None):
    reply = api.post("/sync/answers", json=event(intake, given, key), headers=who)
    assert reply.status_code == 200, reply.text
    return reply.json()


def complete_screen(api, who, intake, **changed):
    last = None
    for q in REQUIRED:
        last = send(api, who, intake, answer(q["questionId"], changed.get(q["questionId"], "no")))
    return last


def movement(movement_id, painful=False, state="done"):
    return {"movementId": movement_id, "painful": painful, "weak": False, "unableToDo": False, "measuredAngle": None, "state": state}


def send_context(api, who, intake, key=None, **context):
    body = {"idempotencyKey": key or str(uuid.uuid4()), "intakeId": intake, "contentVersion": CONTENT_VERSION, "context": context}
    reply = api.post("/sync/context", json=body, headers=who)
    assert reply.status_code == 200, reply.text
    return reply.json()


def rule_ids(gate):
    return [rule["ruleId"] for rule in gate["firedRules"]]


# ---------------------------------------------------------------- sync and idempotency


def test_first_answer_is_stored_and_gate_is_evaluated_on_the_assembled_intake(api, patient):
    reply = send(api, patient, "intake-1", answer("chest"))
    assert reply["status"] == "stored" and reply["answerValid"] is True
    assert reply["intakeId"] == "intake-1" and reply["contentVersion"] == CONTENT_VERSION
    assert reply["gate"]["verdict"] == "CLARIFY", "one answer is not a completed safety screen"
    assert rule_ids(reply["gate"]) == [f"M_{q['questionId']}" for q in REQUIRED[1:]]


def test_complete_all_clear_screen_becomes_safe(api, patient):
    assert complete_screen(api, patient, "intake-1")["gate"] == {"verdict": "SAFE", "firedRules": []}


def test_same_event_sent_twice_is_stored_once(api, patient, doctor):
    first = send(api, patient, "intake-1", answer("chest"), key="key-1")
    again = send(api, patient, "intake-1", answer("chest"), key="key-1")
    assert first["status"] == "stored" and again["status"] == "duplicate"
    assert again["eventSeq"] == first["eventSeq"] and again["gate"] == first["gate"]
    history = api.get("/intakes/intake-1/audit", headers=doctor).json()
    assert len(history["answerHistory"]) == 1


def test_same_key_with_a_different_event_is_refused(api, patient):
    send(api, patient, "intake-1", answer("chest"), key="key-1")
    reply = api.post("/sync/answers", json=event("intake-1", answer("chest", True), "key-1"), headers=patient)
    assert reply.status_code == 409 and reply.json()["detail"]["code"] == "IDEMPOTENCY_KEY_REUSED"


def test_changed_answer_is_a_new_event_and_the_latest_one_counts(api, patient, doctor):
    complete_screen(api, patient, "intake-1")
    assert send(api, patient, "intake-1", answer("fever", True))["gate"]["verdict"] == "RED_FLAG"
    assert send(api, patient, "intake-1", answer("fever"))["gate"]["verdict"] == "SAFE"
    fever = [e for e in api.get("/intakes/intake-1/audit", headers=doctor).json()["answerHistory"] if e["questionId"] == "fever"]
    assert [e["answer"]["value"] for e in fever] == [False, True, False], "nothing is overwritten"


def test_wrong_content_version_is_refused_and_not_stored(api, patient, doctor):
    body = {**event("intake-1", answer("chest")), "contentVersion": "shoulder-0"}
    reply = api.post("/sync/answers", json=body, headers=patient)
    assert reply.status_code == 409 and reply.json()["detail"]["code"] == "CONTENT_VERSION_MISMATCH"
    assert api.get("/intakes/intake-1/audit", headers=doctor).status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"idempotencyKey": "k", "intakeId": "i", "contentVersion": CONTENT_VERSION},
        {"idempotencyKey": "", "intakeId": "i", "contentVersion": CONTENT_VERSION, "answer": {"questionId": "chest"}},
        {"idempotencyKey": "k", "intakeId": 5, "contentVersion": CONTENT_VERSION, "answer": {"questionId": "chest"}},
        {"idempotencyKey": "k", "intakeId": "i", "contentVersion": CONTENT_VERSION, "answer": "chest"},
        {"idempotencyKey": "k", "intakeId": "i", "contentVersion": CONTENT_VERSION, "answer": {}},
    ],
    ids=["empty", "no-answer", "blank-key", "numeric-intake", "answer-not-object", "answer-without-id"],
)
def test_malformed_event_is_rejected(api, patient, body):
    reply = api.post("/sync/answers", json=body, headers=patient)
    assert reply.status_code == 422 and reply.json()["detail"]["code"] == "EVENT_MALFORMED"


def test_invalid_answer_is_stored_and_fails_closed_until_corrected(api, patient):
    complete_screen(api, patient, "intake-1")
    bad = send(api, patient, "intake-1", {"questionId": "chest", "type": "yesno", "value": "false", "state": "answered"})
    assert bad["status"] == "stored" and bad["answerValid"] is False
    assert rule_ids(bad["gate"]) == ["INPUT_INVALID"] and bad["gate"]["verdict"] == "RED_FLAG"
    assert send(api, patient, "intake-1", answer("chest"))["gate"]["verdict"] == "SAFE"


def test_not_sure_then_clarification_then_referral(api, patient):
    complete_screen(api, patient, "intake-1")
    assert send(api, patient, "intake-1", answer("chest", "unsure"))["gate"]["verdict"] == "CLARIFY"
    still = {**answer("chest", "unsure"), "clarificationAttempted": True}
    reply = send(api, patient, "intake-1", still)
    assert reply["gate"]["verdict"] == "RED_FLAG" and rule_ids(reply["gate"]) == ["U_chest"]


# ---------------------------------------------------------------- authentication and ownership


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer nope"}, {"Authorization": "Basic abc"}, {"Authorization": "Bearer "}],
                         ids=["none", "unknown-token", "wrong-scheme", "empty-token"])
@pytest.mark.parametrize("method,path", [
    ("post", "/sync/answers"), ("post", "/sync/context"), ("get", "/intakes/intake-1/gate"),
    ("get", "/intakes/intake-1/report"), ("get", "/intakes/intake-1/doctor-report"), ("get", "/intakes/intake-1/audit"),
    ("get", "/auth/me"),
])
def test_anonymous_requests_get_401_everywhere(api, patient, method, path, headers):
    complete_screen(api, patient, "intake-1")
    kwargs = {"json": event("intake-1", answer("chest"))} if method == "post" else {}
    reply = getattr(api, method)(path, headers=headers, **kwargs)
    assert reply.status_code == 401 and reply.json()["detail"]["code"] == "NOT_AUTHENTICATED"
    assert reply.headers["www-authenticate"] == "Bearer"


def test_patient_cannot_get_the_differential_or_the_audit_trail(api, patient):
    complete_screen(api, patient, "intake-1")
    for path in ("/intakes/intake-1/doctor-report", "/intakes/intake-1/audit"):
        reply = api.get(path, headers=patient)
        assert reply.status_code == 403 and reply.json()["detail"]["code"] == "DOCTOR_ONLY"
        assert "differential" not in reply.text


def test_another_patient_cannot_read_or_write_someone_elses_intake(api, patient):
    complete_screen(api, patient, "intake-1")
    other = login(api, "patient-2", "patient")
    for path in ("/intakes/intake-1/gate", "/intakes/intake-1/report"):
        assert api.get(path, headers=other).status_code == 403
    write = api.post("/sync/answers", json=event("intake-1", answer("chest", True)), headers=other)
    assert write.status_code == 403 and write.json()["detail"]["code"] == "NOT_YOUR_INTAKE"
    assert api.get("/intakes/intake-1/gate", headers=patient).json()["verdict"] == "SAFE"
    assert api.get("/intakes/does-not-exist/gate", headers=other).status_code == 403, "no probing for ids"


def test_another_patient_cannot_replay_someone_elses_idempotency_key(api, patient):
    send(api, patient, "intake-1", answer("chest"), key="key-1")
    other = login(api, "patient-2", "patient")
    reply = api.post("/sync/answers", json=event("intake-1", answer("chest"), "key-1"), headers=other)
    assert reply.status_code == 403


def test_doctor_cannot_write_patient_answers(api, patient, doctor):
    reply = api.post("/sync/answers", json=event("intake-1", answer("chest")), headers=doctor)
    assert reply.status_code == 403 and reply.json()["detail"]["code"] == "PATIENT_ONLY"


def test_dev_login_is_off_unless_enabled(tmp_path):
    with TestClient(create_app(fresh_database(tmp_path, "off"), dev_login=False)) as client:
        assert client.post("/auth/dev-login", json={"userId": "x", "role": "doctor"}).status_code == 404


def test_a_patient_account_cannot_be_reissued_as_a_doctor(api, patient):
    reply = api.post("/auth/dev-login", json={"userId": "patient-1", "role": "doctor"})
    assert reply.status_code == 409
    assert api.get("/auth/me", headers=patient).json()["role"] == "patient"


# ---------------------------------------------------------------- server-side safety: the client's verdict is never trusted


def test_a_safe_verdict_sent_by_the_client_is_ignored(api, patient, doctor):
    complete_screen(api, patient, "intake-1", injury=True)
    forged = {**event("intake-1", answer("side", "left")), "gate": {"verdict": "SAFE", "firedRules": []}, "verdict": "SAFE"}
    reply = api.post("/sync/answers", json=forged, headers=patient)
    assert reply.status_code == 200 and reply.json()["gate"]["verdict"] == "RED_FLAG"
    send_context(api, patient, "intake-1", gateVerdict="SAFE", verdict="SAFE", movements=[movement("painful_arc", True)])
    report = api.get("/intakes/intake-1/doctor-report", headers=doctor).json()
    assert report["gate"]["verdict"] == "RED_FLAG" and report["differential"] == []
    assert api.get("/intakes/intake-1/report", headers=patient).json()["status"] == "REFER"


@pytest.mark.parametrize("changed,verdict,status", [
    ({"chest": True}, "RED_FLAG", "REFER"),
    ({"chest": "unsure"}, "CLARIFY", "INCOMPLETE"),
])
def test_red_flag_and_clarify_block_narrowing_ranking_and_write_up(api, patient, doctor, changed, verdict, status):
    complete_screen(api, patient, "intake-1", **changed)
    send_context(api, patient, "intake-1", regionId="shoulder_right_front",
                 movements=[movement("painful_arc", True), movement("empty_can", True)])
    report = api.get("/intakes/intake-1/doctor-report", headers=doctor).json()
    assert report["gate"]["verdict"] == verdict
    assert report["differential"] == [] and report["narrowing"] is None and report["downstream"] == "blocked_by_gate"
    patient_view = api.get("/intakes/intake-1/report", headers=patient).json()
    assert patient_view["status"] == status and "musclesThatMayBeInvolved" not in patient_view


def test_live_app_signal_in_context_stops_a_canonically_safe_intake(api, patient, doctor):
    complete_screen(api, patient, "intake-1")
    signal = {"questionId": "Q_UNABLE_TO_MOVE_ARM", "type": "yesno", "value": True, "state": "answered"}
    reply = send_context(api, patient, "intake-1", appAnswers=[signal], movements=[movement("painful_arc", True)])
    assert reply["gate"]["verdict"] == "RED_FLAG" and rule_ids(reply["gate"]) == ["APP_REVIEW_Q_UNABLE_TO_MOVE_ARM"]
    assert api.get("/intakes/intake-1/doctor-report", headers=doctor).json()["differential"] == []


def test_unfinished_movement_in_context_is_not_treated_as_no_problem(api, patient):
    complete_screen(api, patient, "intake-1")
    reply = send_context(api, patient, "intake-1", movements=[movement("painful_arc", True), movement("empty_can", state="skipped")])
    assert reply["gate"]["verdict"] == "CLARIFY" and rule_ids(reply["gate"]) == ["U_unable", "U_numb"]


def test_canonical_answers_copied_into_the_context_are_not_counted_twice(api, patient):
    complete_screen(api, patient, "intake-1")
    reply = send_context(api, patient, "intake-1", appAnswers=[answer("chest"), answer("fever", True)])
    assert reply["gate"]["verdict"] == "SAFE", "safety answers come only from answer events"


@pytest.mark.parametrize("context", [{"appAnswers": "none"}, {"movements": "none"}, {"appAnswers": [None]}, {"movements": [5]}],
                         ids=["answers-string", "movements-string", "null-answer", "numeric-movement"])
def test_malformed_context_fails_closed(api, patient, context):
    complete_screen(api, patient, "intake-1")
    assert send_context(api, patient, "intake-1", **context)["gate"]["verdict"] != "SAFE"


def test_context_sync_is_idempotent_and_the_latest_snapshot_wins(api, patient, doctor):
    complete_screen(api, patient, "intake-1")
    first = send_context(api, patient, "intake-1", key="c-1", regionId="shoulder_right_top", movements=[])
    assert send_context(api, patient, "intake-1", key="c-1", regionId="shoulder_right_top", movements=[])["status"] == "duplicate"
    send_context(api, patient, "intake-1", key="c-2", regionId="shoulder_left_front", movements=[movement("lift_off", True)])
    history = api.get("/intakes/intake-1/audit", headers=doctor).json()["contextHistory"]
    assert [h["context"]["regionId"] for h in history] == ["shoulder_right_top", "shoulder_left_front"]
    assert first["status"] == "stored"
    facts = api.get("/intakes/intake-1/doctor-report", headers=doctor).json()["facts"]
    assert {"label": "Tapped region", "value": "shoulder_left_front"} in facts


# ---------------------------------------------------------------- reports


def safe_case(api, patient):
    complete_screen(api, patient, "intake-1")
    send_context(api, patient, "intake-1", regionId="shoulder_right_front", movements=[
        movement("painful_arc", True), movement("empty_can", True), movement("external_rotation"), movement("lift_off"),
        movement("M_APP_ONLY", True),
    ])


def test_doctor_report_matches_the_mobile_contract(api, patient, doctor):
    safe_case(api, patient)
    report = api.get("/intakes/intake-1/doctor-report", headers=doctor).json()
    assert report["audience"] == "doctor" and report["label"] == LABEL and report["intakeId"] == "intake-1"
    assert report["gate"] == {"verdict": "SAFE", "firedRules": []}
    assert all(set(fact) == {"label", "value"} and isinstance(fact["value"], str) for fact in report["facts"])
    assert {"label": "Do you have chest pressure or tightness now?", "value": "No"} in report["facts"]
    assert {"label": "Movement painful_arc", "value": "painful"} in report["facts"]
    for item in report["differential"]:
        assert {"condition", "reason", "source"} <= set(item)
        assert all(isinstance(item[key], str) and item[key].strip() for key in ("condition", "reason", "source"))
        assert item["label"] == LABEL
    assert [item["conditionId"] for item in report["differential"]][:2] == ["subacromial_impingement", "rotator_cuff_related_pain"]
    assert len(report["differential"]) == len(CONDITIONS) and report["downstream"] == "ranked"
    assert report["narrowing"]["candidates"][0]["muscleId"] == "supraspinatus"
    assert report["movementsNotUsed"] == ["M_APP_ONLY"]
    assert report["writeUpBy"] == "template", "tests never call the real model"
    assert "validated" not in json.dumps(report).lower()


def test_patient_report_never_contains_the_differential(api, patient):
    safe_case(api, patient)
    report = api.get("/intakes/intake-1/report", headers=patient).json()
    assert report["audience"] == "patient" and report["status"] == "READY"
    assert report["musclesThatMayBeInvolved"] == ["supraspinatus"]
    assert report["banner"] == "Demo only, not for real patients." and report["talkToDoctor"] is True
    text_of_report = json.dumps(report).lower()
    for condition in CONDITIONS:
        assert condition["id"] not in text_of_report and condition["name"].lower() not in text_of_report
    assert not {"differential", "gate", "facts", "score"} & set(report)
    assert "injured" not in text_of_report


def test_doctor_can_read_a_patients_patient_report_too(api, patient, doctor):
    safe_case(api, patient)
    assert api.get("/intakes/intake-1/report", headers=doctor).json()["status"] == "READY"


def test_unknown_intake_is_404_for_a_doctor(api, doctor):
    for path in ("/intakes/nope/doctor-report", "/intakes/nope/audit", "/intakes/nope/gate"):
        assert api.get(path, headers=doctor).status_code == 404


def test_unrecognised_region_does_not_break_the_report(api, patient, doctor):
    complete_screen(api, patient, "intake-1")
    send_context(api, patient, "intake-1", regionId="elbow_left", movements=[movement("painful_arc", True)])
    report = api.get("/intakes/intake-1/doctor-report", headers=doctor)
    assert report.status_code == 200 and len(report.json()["differential"]) == len(CONDITIONS)


# ---------------------------------------------------------------- audit


def test_every_gate_run_is_logged_including_safe_ones(api, patient, doctor):
    complete_screen(api, patient, "intake-1", injury=True, unable=True)
    api.get("/intakes/intake-1/report", headers=patient)
    api.get("/intakes/intake-1/doctor-report", headers=doctor)
    history = api.get("/intakes/intake-1/audit", headers=doctor).json()
    runs = history["gateRuns"]
    assert len(runs) == len(REQUIRED) + 2
    assert [r["cause"] for r in runs[-2:]] == ["patient_report", "doctor_report"]
    assert runs[0]["verdict"] == "CLARIFY" and runs[-1]["verdict"] == "RED_FLAG"
    last = runs[-1]
    assert [r["ruleId"] for r in last["firedRules"]] == ["R_injury", "R_unable", "R_injury_unable"]
    assert all(r["source"].strip() for r in last["firedRules"])
    assert {a["questionId"]: a["value"] for a in last["matchedAnswers"]} == {"injury": True, "unable": True}
    assert last["ruleVersion"] == CONTENT_VERSION and last["ts"]
    assert [a["action"] for a in history["doctorActions"]] == ["viewed_doctor_report", "viewed_audit"]


def test_safe_gate_runs_are_logged_too(api, patient, doctor):
    complete_screen(api, patient, "intake-1")
    runs = api.get("/intakes/intake-1/audit", headers=doctor).json()["gateRuns"]
    assert runs[-1]["verdict"] == "SAFE" and runs[-1]["firedRules"] == []


@pytest.mark.parametrize("table", APPEND_ONLY)
@pytest.mark.parametrize("statement", ["UPDATE {t} SET intake_id = 'tampered'", "DELETE FROM {t}"], ids=["update", "delete"])
def test_history_tables_reject_update_and_delete(api, patient, doctor, table, statement):
    safe_case(api, patient)
    api.get("/intakes/intake-1/doctor-report", headers=doctor)
    engine = api.app.state.engine
    with engine.connect() as c:
        before = c.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
    assert before > 0
    with pytest.raises(DBAPIError, match="append-only"), engine.begin() as c:
        c.execute(text(statement.format(t=table)))
    with engine.connect() as c:
        assert c.execute(text(f"SELECT COUNT(*) FROM {table} WHERE intake_id = 'intake-1'")).scalar() == before


def test_tokens_are_not_stored_in_the_database(api, patient):
    token = patient["Authorization"].split()[1]
    with api.app.state.engine.connect() as c:
        stored = [row[0] for row in c.execute(text("SELECT token_hash FROM sessions"))]
    assert stored and token not in stored and all(len(value) == 64 for value in stored)
