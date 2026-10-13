import pytest


@pytest.fixture(autouse=True)
def no_real_model(monkeypatch):
    """Tests never call the real Groq service, even when a key is in .env. They use fake models."""
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
