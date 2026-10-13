"""Create demo users and print a bearer token for each. Demo only, not for real patients.

From the server folder:   .venv\\Scripts\\python -m app.seed
Tokens are printed once and only their hashes are stored. Do not commit or share them.
"""

from app import db, store
from app.config import load_env

DEMO_USERS = (("demo-patient", "patient", "Demo Patient"), ("demo-doctor", "doctor", "Demo Doctor"))


def main() -> None:
    load_env()
    engine = db.make_engine()
    with engine.begin() as c:
        for user_id, role, name in DEMO_USERS:
            store.upsert_user(c, user_id, role, name)
            token, expires = store.create_session(c, user_id)
            print(f"{role:<8} {user_id:<14} token: {token}   (expires {expires:%Y-%m-%d %H:%M} UTC)")


if __name__ == "__main__":
    main()
