import os

from app.config import load_env


def test_env_file_is_loaded_without_overriding_real_variables(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text(
        "# a comment\n\nGROQ_API_KEY = 'abc123'\nGROQ_MODEL=some-model\nEMPTY_ONE=\nALREADY_SET=from-file\nnot a setting\n",
        encoding="utf-8",
    )
    for name in ("GROQ_API_KEY", "GROQ_MODEL", "EMPTY_ONE"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ALREADY_SET", "from-shell")

    assert load_env(env) == ["GROQ_API_KEY", "GROQ_MODEL"]
    assert os.environ["GROQ_API_KEY"] == "abc123"
    assert os.environ["GROQ_MODEL"] == "some-model"
    assert "EMPTY_ONE" not in os.environ
    assert os.environ["ALREADY_SET"] == "from-shell"
    monkeypatch.delenv("GROQ_API_KEY")
    monkeypatch.delenv("GROQ_MODEL")


def test_missing_env_file_is_fine(tmp_path):
    assert load_env(tmp_path / "nope.env") == []
