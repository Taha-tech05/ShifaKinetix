from fastapi import FastAPI

app = FastAPI(title="ShifaKinetix server", description="Demo only, not for real patients.")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
