"""Database schema. PostgreSQL in deployment, SQLite for local development and tests.

Set DATABASE_URL (for example postgresql+psycopg://user:password@host:5432/shifakinetix).
Without it the server uses a local SQLite file.

History tables are append-only: a database trigger rejects UPDATE and DELETE on
audit_log, answer_events, context_events and doctor_actions, so a bug or a
compromised application account cannot rewrite what a patient said or what the
gate decided.
"""

import os
from pathlib import Path

from sqlalchemy import (
    Column,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    func,
    inspect,
    text,
)

DEFAULT_URL = f"sqlite:///{Path(__file__).resolve().parents[1] / 'shifakinetix.db'}"
APPEND_ONLY = ("audit_log", "answer_events", "context_events", "doctor_actions")

metadata = MetaData()

users = Table(
    "users", metadata,
    Column("id", String(100), primary_key=True),
    Column("role", String(20), nullable=False),  # patient | doctor
    Column("display_name", String(200), nullable=False, default=""),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

sessions = Table(
    "sessions", metadata,
    Column("token_hash", String(64), primary_key=True),  # sha256 of the bearer token; the token is never stored
    Column("user_id", String(100), ForeignKey("users.id"), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("expires_at", DateTime(timezone=True), nullable=False),
)

intakes = Table(
    "intakes", metadata,
    Column("id", String(200), primary_key=True),
    Column("patient_id", String(100), ForeignKey("users.id"), nullable=False),
    Column("content_version", String(100), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

# One row per synced safety answer. A changed answer or a clarification is a new row; nothing is overwritten.
answer_events = Table(
    "answer_events", metadata,
    Column("seq", Integer, primary_key=True, autoincrement=True),
    Column("idempotency_key", String(200), nullable=False, unique=True),
    Column("intake_id", String(200), ForeignKey("intakes.id"), nullable=False, index=True),
    Column("question_id", String(200), nullable=False),
    Column("answer_json", Text, nullable=False),
    Column("content_version", String(100), nullable=False),
    Column("request_hash", String(64), nullable=False),
    Column("received_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

# One row per synced context snapshot (tapped region, raw app answers, movement results).
context_events = Table(
    "context_events", metadata,
    Column("seq", Integer, primary_key=True, autoincrement=True),
    Column("idempotency_key", String(200), nullable=False, unique=True),
    Column("intake_id", String(200), ForeignKey("intakes.id"), nullable=False, index=True),
    Column("context_json", Text, nullable=False),
    # Highest answer_events.seq the server had stored when this snapshot arrived. An answer with a higher seq
    # was received after this evidence, which is how the server decides a follow-up was answered for it.
    Column("answer_seq_before", Integer, nullable=False, server_default="0"),
    Column("content_version", String(100), nullable=False),
    Column("request_hash", String(64), nullable=False),
    Column("received_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

# One row per gate run on the server, including SAFE.
audit_log = Table(
    "audit_log", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("intake_id", String(200), nullable=False, index=True),
    Column("ts", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("cause", String(50), nullable=False),  # what caused this gate run
    Column("verdict", String(20), nullable=False),
    Column("fired_rules_json", Text, nullable=False),
    Column("matched_answers_json", Text, nullable=False),
    Column("rule_version", String(100), nullable=False),
)

# One row each time a doctor opens a report or the audit trail.
doctor_actions = Table(
    "doctor_actions", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("intake_id", String(200), nullable=False, index=True),
    Column("doctor_id", String(100), nullable=False),
    Column("action", String(50), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)


def _append_only_sql(dialect: str) -> list[str]:
    statements = []
    if dialect == "sqlite":
        for table in APPEND_ONLY:
            for operation in ("UPDATE", "DELETE"):
                statements.append(
                    f"CREATE TRIGGER IF NOT EXISTS {table}_no_{operation.lower()} BEFORE {operation} ON {table} "
                    f"BEGIN SELECT RAISE(ABORT, '{table} is append-only'); END"
                )
        return statements
    statements.append(
        "CREATE OR REPLACE FUNCTION shifa_append_only() RETURNS trigger AS $$ "
        "BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END; $$ LANGUAGE plpgsql"
    )
    for table in APPEND_ONLY:
        statements.append(f"DROP TRIGGER IF EXISTS {table}_append_only ON {table}")
        statements.append(
            f"CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION shifa_append_only()"
        )
        statements.append(f"DROP TRIGGER IF EXISTS {table}_no_truncate ON {table}")
        statements.append(
            f"CREATE TRIGGER {table}_no_truncate BEFORE TRUNCATE ON {table} "
            "FOR EACH STATEMENT EXECUTE FUNCTION shifa_append_only()"
        )
    return statements


def make_engine(url: str | None = None) -> Engine:
    """Create the engine, the tables and the append-only triggers."""
    url = url or os.environ.get("DATABASE_URL") or DEFAULT_URL
    options = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {"pool_pre_ping": True}
    engine = create_engine(url, **options)
    metadata.create_all(engine)
    with engine.begin() as connection:
        # Databases created before answer_seq_before existed get the column added; existing rows keep 0.
        if "answer_seq_before" not in {c["name"] for c in inspect(connection).get_columns("context_events")}:
            connection.execute(text("ALTER TABLE context_events ADD COLUMN answer_seq_before INTEGER NOT NULL DEFAULT 0"))
        for statement in _append_only_sql(engine.dialect.name):
            connection.execute(text(statement))
    return engine
