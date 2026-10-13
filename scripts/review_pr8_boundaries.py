"""PR8 review regressions: run after merging A into C, from the repo root.

    python -m pytest -q scripts/review_pr8_boundaries.py

Synthetic data only. These fail on PR8 f6c5601 and are acceptance criteria for
its input-validation and legacy-migration fixes. No network service is used.
"""
import sys
import uuid
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))
from app import db
from app.api import create_app
from app.gate import CONTENT_VERSION, QUESTIONS
from fastapi.testclient import TestClient
from sqlalchemy import text


@pytest.fixture
def assessment(tmp_path):
    url = f"sqlite:///{tmp_path / 'review.db'}"
    app = create_app(url, dev_login=True)
    with TestClient(app) as client:
        login = client.post('/auth/dev-login', json={'userId': 'synthetic-review', 'role': 'patient'})
        headers = {'Authorization': f"Bearer {login.json()['token']}"}

        def post(kind, payload):
            return client.post(f'/sync/{kind}', headers=headers, json={
                'idempotencyKey': str(uuid.uuid4()), 'intakeId': 'review-intake',
                'contentVersion': CONTENT_VERSION,
                'answer' if kind == 'answers' else 'context': payload,
            })

        for q in QUESTIONS:
            if q['required']:
                reply = post('answers', {'questionId': q['questionId'], 'type': q['type'],
                                        'state': 'answered', 'value': 'normal' if q['type'] == 'choice' else False})
                assert reply.status_code == 200
        assert reply.json()['gate']['verdict'] == 'SAFE'
        yield app, client, headers, post, url
    app.state.engine.dispose()


def test_unknown_safety_id_cannot_be_stored_as_invalid_then_disappear(assessment):
    _, client, headers, post, _ = assessment
    reply = post('answers', {'questionId': 'typo_chest', 'type': 'yesno', 'state': 'answered', 'value': True})
    if reply.status_code == 422:
        return  # Strict rejection is an acceptable contract, if documented.
    assert reply.status_code == 200
    assert reply.json()['answerValid'] is False
    assert reply.json()['gate']['verdict'] != 'SAFE'
    assert client.get('/intakes/review-intake/gate', headers=headers).json()['verdict'] != 'SAFE'


@pytest.mark.parametrize('movement', [
    {'movementId': 'sideways_raise', 'state': 'done'},
    {'movementId': 'sideways_raise', 'state': 'done', 'painful': False,
     'weak': None, 'unableToDo': None, 'measuredAngle': None},
])
def test_incomplete_movement_fields_cannot_grant_clearance(assessment, movement):
    _, _, _, post, _ = assessment
    reply = post('context', {'movements': [movement]})
    if reply.status_code == 422:
        return
    assert reply.status_code == 200
    assert reply.json()['gate']['verdict'] != 'SAFE'


def test_legacy_migration_cannot_promote_an_old_answer_to_a_followup(assessment):
    app, client, headers, post, url = assessment
    reply = post('context', {'movements': [{'movementId': 'sideways_raise', 'state': 'done',
                'painful': False, 'weak': False, 'unableToDo': True, 'measuredAngle': None}]})
    assert reply.json()['gate']['verdict'] == 'CLARIFY'
    # Recreate the pre-update schema after an old negative and newer danger signal.
    with app.state.engine.begin() as connection:
        connection.execute(text('ALTER TABLE context_events DROP COLUMN answer_seq_before'))
    migrated = db.make_engine(url)
    try:
        output = client.get('/intakes/review-intake/gate', headers=headers).json()
        assert output['verdict'] == 'CLARIFY', output
    finally:
        migrated.dispose()
