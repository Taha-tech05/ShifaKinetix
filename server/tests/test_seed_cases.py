"""The demo seed script: three clearly fake cases, each judged by the server's own gate."""

import pytest
from fastapi.testclient import TestClient

from app.api import create_app
from app.seed_cases import CASES, SEED_PATIENT, seed_cases


@pytest.fixture
def api(tmp_path):
    app = create_app(f"sqlite:///{tmp_path / 'seed.db'}", dev_login=True)
    with TestClient(app) as client:
        client.engine = app.state.engine
        yield client
    app.state.engine.dispose()


def doctor(api):
    token = api.post("/auth/dev-login", json={"userId": "demo-doctor", "role": "doctor"}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_three_cases_get_a_danger_a_safe_and_a_not_sure_verdict_from_the_server_gate(api):
    verdicts = {case: verdict for case, _label, verdict in seed_cases(api.engine)}
    assert verdicts == {"demo-case-danger": "RED_FLAG", "demo-case-safe": "SAFE", "demo-case-unsure": "CLARIFY"}


def test_the_doctor_api_agrees_with_the_seeded_verdicts(api):
    seed_cases(api.engine)
    who = doctor(api)
    assert api.get("/intakes/demo-case-danger/gate", headers=who).json()["verdict"] == "RED_FLAG"
    assert api.get("/intakes/demo-case-safe/gate", headers=who).json()["verdict"] == "SAFE"
    assert api.get("/intakes/demo-case-unsure/gate", headers=who).json()["verdict"] == "CLARIFY"


def test_reports_follow_the_gate_and_the_patient_report_has_no_differential(api):
    seed_cases(api.engine)
    who = doctor(api)
    danger = api.get("/intakes/demo-case-danger/doctor-report", headers=who).json()
    assert danger["gate"]["verdict"] == "RED_FLAG" and danger["differential"] == []
    unsure = api.get("/intakes/demo-case-unsure/doctor-report", headers=who).json()
    assert unsure["gate"]["verdict"] == "CLARIFY" and unsure["differential"] == []
    safe = api.get("/intakes/demo-case-safe/doctor-report", headers=who).json()
    assert safe["gate"]["verdict"] == "SAFE" and safe["facts"]
    patient = api.get("/intakes/demo-case-safe/report", headers=who).json()
    assert patient["audience"] == "patient" and "differential" not in patient and patient["status"] == "READY"


def test_cases_are_clearly_fake(api):
    assert SEED_PATIENT == "demo-seed-patient"
    assert all(case.startswith("demo-case-") for case, _ in CASES)
    seed_cases(api.engine)
    history = api.get("/intakes/demo-case-safe/audit", headers=doctor(api)).json()
    assert all(a["idempotencyKey"].startswith("seed:") for a in history["answerHistory"])


def test_running_it_twice_changes_nothing(api):
    first = seed_cases(api.engine)
    who = doctor(api)
    before = {c: api.get(f"/intakes/{c}/audit", headers=who).json() for c, _ in CASES}
    assert seed_cases(api.engine) == first
    after = {c: api.get(f"/intakes/{c}/audit", headers=who).json() for c, _ in CASES}
    for case, _ in CASES:
        assert len(after[case]["answerHistory"]) == len(before[case]["answerHistory"])
        assert len(after[case]["contextHistory"]) == len(before[case]["contextHistory"])
        assert len(after[case]["gateRuns"]) == len(before[case]["gateRuns"])
