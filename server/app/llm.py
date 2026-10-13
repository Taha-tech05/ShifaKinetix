"""Thin wrapper around the Groq-hosted model.

The model is used for two things only: choosing the next tool from an allowed
list, and writing up a ranking that code already produced. It never makes a
safety decision. Without GROQ_API_KEY everything falls back to code.

Check your key and model from the server folder:   .venv\\Scripts\\python -m app.llm
"""

import os

from app.config import load_env

load_env()

DEFAULT_MODEL = "openai/gpt-oss-120b"  # override with GROQ_MODEL
TIMEOUT_SECONDS = 20


class LLMUnavailableError(RuntimeError):
    pass


def available() -> bool:
    return bool(os.environ.get("GROQ_API_KEY"))


def model_name() -> str:
    return os.environ.get("GROQ_MODEL", DEFAULT_MODEL)


def chat(system: str, user: str, json_mode: bool = False) -> str:
    if not available():
        raise LLMUnavailableError("GROQ_API_KEY is not set")
    from groq import Groq  # imported here so the server and tests run without a key

    client = Groq(api_key=os.environ["GROQ_API_KEY"], timeout=TIMEOUT_SECONDS)
    extra = {"response_format": {"type": "json_object"}} if json_mode else {}
    response = client.chat.completions.create(
        model=model_name(),
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0,
        **extra,
    )
    return response.choices[0].message.content or ""


def check() -> int:
    """Make one tiny call and say plainly whether the key and model work."""
    if not available():
        print("No key found. Paste it after GROQ_API_KEY= in server/.env and save the file.")
        return 1
    print(f"Key found. Model: {model_name()}. Calling Groq...")
    try:
        reply = chat("Reply with the single word: ready", "Are you there?")
    except Exception as error:  # noqa: BLE001 - report any failure in plain words
        print(f"FAILED: {type(error).__name__}: {error}")
        print("If the model was not found, set GROQ_MODEL in server/.env to a current model name.")
        return 1
    print(f"OK. The model replied: {reply.strip()!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(check())
